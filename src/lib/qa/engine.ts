import { subMonths } from "date-fns";
import {
  DataHealthIssueType,
  IssueSeverity,
  IssueStatus,
  KeywordType,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { findIncompletePairKeywords } from "@/lib/qa/pairing";
import { monthStart, normalizeText } from "@/lib/utils";

const GENERATED_ISSUE_TYPES: DataHealthIssueType[] = [
  DataHealthIssueType.EMPTY_IMPORT,
  DataHealthIssueType.KEYWORD_NOT_IN_PROJECT_SET,
  DataHealthIssueType.MISSING_MARKET_VALUE,
  DataHealthIssueType.UNDETECTED_BRANDED_QUERY,
  DataHealthIssueType.INCOMPLETE_KEYWORD_PAIR,
  DataHealthIssueType.DUPLICATE_KEYWORD,
  DataHealthIssueType.MISSING_COMPETITOR_MAPPING,
  DataHealthIssueType.DATE_INCONSISTENCY,
  DataHealthIssueType.RANK_OUTLIER,
  DataHealthIssueType.UNDETECTED_PAGE_SPECIFIC_QUERY,
];

type NewIssue = {
  projectId: string;
  importJobId?: string | null;
  reportingMonth?: Date | null;
  issueType: DataHealthIssueType;
  severity: IssueSeverity;
  title: string;
  details: string;
  metadata?: Prisma.InputJsonValue;
};

async function createIssue(issue: NewIssue) {
  return prisma.dataHealthIssue.create({
    data: {
      projectId: issue.projectId,
      importJobId: issue.importJobId ?? null,
      reportingMonth: issue.reportingMonth ?? null,
      issueType: issue.issueType,
      severity: issue.severity,
      status: IssueStatus.OPEN,
      title: issue.title,
      details: issue.details,
      metadata: issue.metadata,
    },
  });
}

async function clearGeneratedIssues(projectId: string, reportingMonth: Date, importJobId?: string) {
  await prisma.dataHealthIssue.deleteMany({
    where: {
      projectId,
      reportingMonth,
      issueType: { in: GENERATED_ISSUE_TYPES },
      ...(importJobId ? { importJobId } : {}),
      status: IssueStatus.OPEN,
    },
  });
}

async function checkIncompletePairs(projectId: string, reportingMonth: Date, importJobId?: string) {
  const activeKeywords = await prisma.keyword.findMany({
    where: { projectId, isActive: true, keywordType: { in: [KeywordType.LOCAL, KeywordType.CORE] } },
    include: {
      localPair: true,
      corePair: true,
    },
  });

  const missing = findIncompletePairKeywords(activeKeywords);

  if (missing.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.INCOMPLETE_KEYWORD_PAIR,
      severity: IssueSeverity.WARNING,
      title: "Incomplete local/core keyword pairs",
      details: `${missing.length} active keywords do not have a complete local/core pair mapping.`,
      metadata: {
        keywordIds: missing.slice(0, 30).map((item) => item.id),
      },
    });
  }
}

async function checkDuplicateKeywords(projectId: string, reportingMonth: Date, importJobId?: string) {
  const keywords = await prisma.keyword.findMany({ where: { projectId, isActive: true } });
  const groups = new Map<string, number>();

  for (const keyword of keywords) {
    const key = `${keyword.normalizedText}|${keyword.keywordType}|${keyword.marketId ?? "none"}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  const duplicates = [...groups.entries()].filter(([, count]) => count > 1);

  if (duplicates.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.DUPLICATE_KEYWORD,
      severity: IssueSeverity.ERROR,
      title: "Duplicate keyword definitions detected",
      details: `${duplicates.length} duplicate keyword groups detected in active keyword set.`,
      metadata: {
        sample: duplicates.slice(0, 20),
      },
    });
  }
}

async function checkUnknownKeywords(projectId: string, reportingMonth: Date, importJobId?: string) {
  const [visibilityUnknown, mapUnknown, organicUnknown, overviewUnknown] = await Promise.all([
    prisma.semrushVisibilityRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
    prisma.semrushMapPackRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
    prisma.semrushOrganicRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
    prisma.semrushRankingRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
  ]);

  const total = visibilityUnknown + mapUnknown + organicUnknown + overviewUnknown;

  if (total > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.KEYWORD_NOT_IN_PROJECT_SET,
      severity: IssueSeverity.ERROR,
      title: "Imported keywords missing from project keyword set",
      details: `${total} ranking rows were imported with keywords that are not mapped to project keywords.`,
      metadata: {
        visibilityUnknown,
        mapUnknown,
        organicUnknown,
        overviewUnknown,
      },
    });
  }
}

async function checkMissingCompetitors(projectId: string, reportingMonth: Date, importJobId?: string) {
  const missing = await prisma.semrushVisibilityRecord.count({
    where: { projectId, reportingMonth, competitorId: null },
  });

  if (missing > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.MISSING_COMPETITOR_MAPPING,
      severity: IssueSeverity.WARNING,
      title: "Visibility records missing competitor mapping",
      details: `${missing} visibility rows reference competitor domains not configured in this project.`,
      metadata: {
        count: missing,
      },
    });
  }
}

async function checkMissingMarket(projectId: string, reportingMonth: Date, importJobId?: string) {
  const activeMarketCount = await prisma.market.count({ where: { projectId, isActive: true } });
  if (activeMarketCount <= 1) {
    return;
  }

  const [visibilityMissing, mapMissing, organicMissing, overviewMissing] = await Promise.all([
    prisma.semrushVisibilityRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
    prisma.semrushMapPackRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
    prisma.semrushOrganicRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
    prisma.semrushRankingRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
  ]);

  const total = visibilityMissing + mapMissing + organicMissing + overviewMissing;

  if (total > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.MISSING_MARKET_VALUE,
      severity: IssueSeverity.WARNING,
      title: "Missing market values in multi-market project",
      details: `${total} ranking records for this month are missing market values.`,
      metadata: {
        visibilityMissing,
        mapMissing,
        organicMissing,
        overviewMissing,
      },
    });
  }
}

async function checkDateConsistency(projectId: string, reportingMonth: Date, importJobId?: string) {
  const [visibilityRows, mapRows, organicRows, overviewRows] = await Promise.all([
    prisma.semrushVisibilityRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
    prisma.semrushMapPackRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
    prisma.semrushOrganicRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
    prisma.semrushRankingRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
  ]);

  const rows = [...visibilityRows, ...mapRows, ...organicRows, ...overviewRows];
  const mismatches = rows.filter((row) => {
    return (
      row.capturedAt.getUTCFullYear() !== reportingMonth.getUTCFullYear() ||
      row.capturedAt.getUTCMonth() !== reportingMonth.getUTCMonth()
    );
  });

  if (mismatches.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.DATE_INCONSISTENCY,
      severity: IssueSeverity.WARNING,
      title: "Date inconsistencies detected",
      details: `${mismatches.length} ranking rows have capture dates outside the selected reporting month.`,
    });
  }
}

async function checkLikelyBrandedMisses(projectId: string, reportingMonth: Date, importJobId?: string) {
  const [project, brandTerms] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.brandExclusionTerm.findMany({ where: { projectId, isActive: true } }),
  ]);

  if (!project) {
    return;
  }

  const hints = [project.domain.split(".")[0], ...brandTerms.map((term) => term.term)]
    .map((term) => normalizeText(term || ""))
    .filter((term) => term.length >= 4);

  if (hints.length === 0) {
    return;
  }

  const records = await prisma.gSCQueryRecord.findMany({
    where: {
      projectId,
      reportingMonth,
      isBrandExcluded: false,
    },
    select: {
      query: true,
      normalizedQuery: true,
    },
  });

  const likelyMisses = records.filter((record) => hints.some((hint) => record.normalizedQuery.includes(hint)));

  if (likelyMisses.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.UNDETECTED_BRANDED_QUERY,
      severity: IssueSeverity.INFO,
      title: "Potential branded queries not excluded",
      details: `${likelyMisses.length} GSC queries look branded but are not excluded by current brand rules.`,
      metadata: {
        queries: likelyMisses.slice(0, 20).map((item) => item.query),
      },
    });
  }
}

async function checkLikelyPageSpecificMisses(projectId: string, reportingMonth: Date, importJobId?: string) {
  const pageTerms = await prisma.pageExclusionTerm.findMany({
    where: { projectId, isActive: true },
    select: { term: true, normalizedTerm: true },
  });

  const hints = pageTerms
    .map((term) => term.normalizedTerm || normalizeText(term.term || ""))
    .filter((term) => term.length >= 4);

  if (hints.length === 0) {
    return;
  }

  const records = await prisma.gSCQueryRecord.findMany({
    where: {
      projectId,
      reportingMonth,
      isPageExcluded: false,
    },
    select: {
      query: true,
      normalizedQuery: true,
    },
  });

  const likelyMisses = records.filter((record) => hints.some((hint) => record.normalizedQuery.includes(hint)));
  if (likelyMisses.length === 0) {
    return;
  }

  await createIssue({
    projectId,
    importJobId,
    reportingMonth,
    issueType: DataHealthIssueType.UNDETECTED_PAGE_SPECIFIC_QUERY,
    severity: IssueSeverity.INFO,
    title: "Potential page-specific queries not excluded",
    details: `${likelyMisses.length} GSC queries look page-specific but are not excluded by current page rules.`,
    metadata: {
      queries: likelyMisses.slice(0, 20).map((item) => item.query),
    },
  });
}

async function checkRankOutliers(projectId: string, reportingMonth: Date, importJobId?: string) {
  const previous = monthStart(subMonths(reportingMonth, 1));

  const [currentRows, previousRows] = await Promise.all([
    prisma.semrushRankingRecord.findMany({
      where: {
        projectId,
        reportingMonth,
        keywordId: { not: null },
        OR: [{ rankingType: { contains: "organic" } }, { rankingType: null }],
      },
      select: { keywordId: true, rank: true },
    }),
    prisma.semrushRankingRecord.findMany({
      where: {
        projectId,
        reportingMonth: previous,
        keywordId: { not: null },
        OR: [{ rankingType: { contains: "organic" } }, { rankingType: null }],
      },
      select: { keywordId: true, rank: true },
    }),
  ]);

  const previousMap = new Map<string, number>();
  for (const row of previousRows) {
    if (row.keywordId && row.rank !== null) {
      previousMap.set(row.keywordId, row.rank);
    }
  }

  let outlierCount = 0;
  for (const row of currentRows) {
    if (!row.keywordId) {
      continue;
    }

    const previousPosition = previousMap.get(row.keywordId);
    if (previousPosition === undefined) {
      continue;
    }

    if (row.rank === null) {
      continue;
    }

    if (Math.abs(previousPosition - row.rank) >= 20) {
      outlierCount += 1;
    }
  }

  if (outlierCount > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: DataHealthIssueType.RANK_OUTLIER,
      severity: IssueSeverity.WARNING,
      title: "Large month-over-month rank movement",
      details: `${outlierCount} organic keyword rows moved by 20+ positions from previous month.`,
      metadata: { outlierCount },
    });
  }
}

async function checkEmptyImport(importJobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });

  if (!job || job.rowCount > 0) {
    return;
  }

  await createIssue({
    projectId: job.projectId,
    importJobId,
    reportingMonth: job.reportingMonth,
    issueType: DataHealthIssueType.EMPTY_IMPORT,
    severity: IssueSeverity.ERROR,
    title: "Import contained zero rows",
    details: `${job.fileName} imported with no valid rows.`,
  });
}

export async function runQaForImportJob(importJobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!job) {
    return;
  }

  const reportingMonth = monthStart(job.reportingMonth);

  await clearGeneratedIssues(job.projectId, reportingMonth, importJobId);
  await checkEmptyImport(importJobId);
  await checkIncompletePairs(job.projectId, reportingMonth, importJobId);
  await checkDuplicateKeywords(job.projectId, reportingMonth, importJobId);
  await checkUnknownKeywords(job.projectId, reportingMonth, importJobId);
  await checkMissingCompetitors(job.projectId, reportingMonth, importJobId);
  await checkMissingMarket(job.projectId, reportingMonth, importJobId);
  await checkDateConsistency(job.projectId, reportingMonth, importJobId);
  await checkLikelyBrandedMisses(job.projectId, reportingMonth, importJobId);
  await checkLikelyPageSpecificMisses(job.projectId, reportingMonth, importJobId);
  await checkRankOutliers(job.projectId, reportingMonth, importJobId);
}

export async function runQaForProjectMonth(projectId: string, reportingMonthInput: Date) {
  const reportingMonth = monthStart(reportingMonthInput);

  await clearGeneratedIssues(projectId, reportingMonth);
  await checkIncompletePairs(projectId, reportingMonth);
  await checkDuplicateKeywords(projectId, reportingMonth);
  await checkUnknownKeywords(projectId, reportingMonth);
  await checkMissingCompetitors(projectId, reportingMonth);
  await checkMissingMarket(projectId, reportingMonth);
  await checkDateConsistency(projectId, reportingMonth);
  await checkLikelyBrandedMisses(projectId, reportingMonth);
  await checkLikelyPageSpecificMisses(projectId, reportingMonth);
  await checkRankOutliers(projectId, reportingMonth);

  return prisma.dataHealthIssue.findMany({
    where: {
      projectId,
      reportingMonth,
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });
}

export async function summarizeQa(projectId: string, reportingMonthInput: Date) {
  const reportingMonth = monthStart(reportingMonthInput);
  const issues = await prisma.dataHealthIssue.findMany({
    where: {
      projectId,
      reportingMonth,
    },
  });

  return {
    total: issues.length,
    open: issues.filter((item) => item.status === IssueStatus.OPEN).length,
    resolved: issues.filter((item) => item.status === IssueStatus.RESOLVED).length,
    bySeverity: {
      ERROR: issues.filter((item) => item.severity === IssueSeverity.ERROR).length,
      WARNING: issues.filter((item) => item.severity === IssueSeverity.WARNING).length,
      INFO: issues.filter((item) => item.severity === IssueSeverity.INFO).length,
    },
  };
}

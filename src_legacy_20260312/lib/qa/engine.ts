import { addMonths, subMonths } from "date-fns";
import { IssueSeverity, IssueStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { findLikelyBrandMisses } from "@/lib/import/service";
import { monthStart } from "@/lib/utils";

type IssuePayload = {
  projectId: string;
  importJobId?: string | null;
  reportingMonth?: Date | null;
  issueType: string;
  severity: IssueSeverity;
  title: string;
  details: string;
  metadata?: Record<string, unknown>;
};

async function createIssue(payload: IssuePayload) {
  return db.dataHealthIssue.create({
    data: {
      projectId: payload.projectId,
      importJobId: payload.importJobId ?? null,
      reportingMonth: payload.reportingMonth ?? null,
      issueType: payload.issueType,
      severity: payload.severity,
      status: IssueStatus.OPEN,
      title: payload.title,
      details: payload.details,
      metadata: {
        generatedBy: "qa_engine",
        ...(payload.metadata ?? {}),
      },
    },
  });
}

function isSameMonth(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

async function checkKeywordPairCompleteness(projectId: string, reportingMonth: Date, importJobId?: string) {
  const keywords = await db.keyword.findMany({
    where: { projectId, isActive: true },
    include: {
      localKeywordPair: true,
      coreKeywordPair: true,
    },
  });

  const missingPairs = keywords.filter((keyword) => {
    if (keyword.type === "LOCAL") {
      return !keyword.localKeywordPair;
    }

    return !keyword.coreKeywordPair;
  });

  if (missingPairs.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "incomplete_local_core_pairs",
      severity: IssueSeverity.ERROR,
      title: "Incomplete Local/Core keyword pairs",
      details: `${missingPairs.length} active keywords do not have complete local/core pairing.`,
      metadata: {
        keywordIds: missingPairs.slice(0, 50).map((keyword) => keyword.id),
        keywordTexts: missingPairs.slice(0, 50).map((keyword) => keyword.text),
      },
    });
  }
}

async function checkDuplicateKeywords(projectId: string, reportingMonth: Date, importJobId?: string) {
  const keywords = await db.keyword.findMany({
    where: { projectId, isActive: true },
    include: { market: true },
  });

  const bucket = new Map<string, string[]>();

  for (const keyword of keywords) {
    const key = `${keyword.normalizedText}|${keyword.type}|${keyword.marketId ?? "none"}`;
    const existing = bucket.get(key) ?? [];
    existing.push(keyword.id);
    bucket.set(key, existing);
  }

  const duplicates = [...bucket.entries()].filter(([, ids]) => ids.length > 1);

  if (duplicates.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "duplicate_keywords",
      severity: IssueSeverity.ERROR,
      title: "Duplicate keyword definitions detected",
      details: `${duplicates.length} duplicate keyword groups found in active keyword set.`,
      metadata: {
        groups: duplicates.slice(0, 20),
      },
    });
  }
}

async function checkMissingMarketValues(projectId: string, reportingMonth: Date, importJobId?: string) {
  const marketCount = await db.market.count({ where: { projectId, isActive: true } });

  if (marketCount <= 1) {
    return;
  }

  const [visibilityCount, mapCount, organicCount] = await Promise.all([
    db.semrushVisibilityRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
    db.semrushMapPackRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
    db.semrushOrganicRecord.count({ where: { projectId, reportingMonth, marketId: null } }),
  ]);

  const total = visibilityCount + mapCount + organicCount;

  if (total > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "missing_market",
      severity: IssueSeverity.WARNING,
      title: "Records missing market in multi-market project",
      details: `${total} records for ${reportingMonth.toISOString().slice(0, 10)} are missing market values.`,
      metadata: {
        visibilityCount,
        mapCount,
        organicCount,
      },
    });
  }
}

async function checkDateInconsistency(projectId: string, reportingMonth: Date, importJobId?: string) {
  const [visibilityRows, mapRows, organicRows] = await Promise.all([
    db.semrushVisibilityRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
    db.semrushMapPackRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
    db.semrushOrganicRecord.findMany({ where: { projectId, reportingMonth }, select: { capturedAt: true } }),
  ]);

  const mismatches = [...visibilityRows, ...mapRows, ...organicRows].filter(
    (record) => !isSameMonth(record.capturedAt, reportingMonth),
  );

  if (mismatches.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "date_inconsistency",
      severity: IssueSeverity.WARNING,
      title: "Date inconsistency found",
      details: `${mismatches.length} ranking rows have capture dates outside the selected reporting month.`,
      metadata: {
        mismatchCount: mismatches.length,
      },
    });
  }
}

async function checkEmptyImport(importJobId: string) {
  const job = await db.importJob.findUnique({ where: { id: importJobId } });
  if (!job) {
    return;
  }

  if (job.rowCount === 0) {
    await createIssue({
      projectId: job.projectId,
      importJobId: job.id,
      reportingMonth: job.reportingMonth,
      issueType: "empty_import",
      severity: IssueSeverity.ERROR,
      title: "Import contained zero rows",
      details: `${job.fileName} imported with no usable rows.`,
    });
  }
}

async function checkUnknownKeywords(projectId: string, reportingMonth: Date, importJobId?: string) {
  const [visibilityUnknown, mapUnknown, organicUnknown] = await Promise.all([
    db.semrushVisibilityRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
    db.semrushMapPackRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
    db.semrushOrganicRecord.count({ where: { projectId, reportingMonth, keywordId: null } }),
  ]);

  const totalUnknown = visibilityUnknown + mapUnknown + organicUnknown;

  if (totalUnknown > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "unknown_project_keywords",
      severity: IssueSeverity.ERROR,
      title: "Imported keywords missing from project keyword set",
      details: `${totalUnknown} imported ranking rows could not be mapped to existing project keywords.`,
      metadata: {
        visibilityUnknown,
        mapUnknown,
        organicUnknown,
      },
    });
  }
}

async function checkMissingCompetitors(projectId: string, reportingMonth: Date, importJobId?: string) {
  const count = await db.semrushVisibilityRecord.count({
    where: { projectId, reportingMonth, competitorId: null },
  });

  if (count > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "missing_competitor_mapping",
      severity: IssueSeverity.WARNING,
      title: "Visibility records with unmapped competitor",
      details: `${count} visibility rows have competitor domains not mapped to project competitors.`,
      metadata: {
        count,
      },
    });
  }
}

async function checkMissedBrandExclusions(projectId: string, reportingMonth: Date, importJobId?: string) {
  const [project, brandTerms] = await Promise.all([
    db.project.findUnique({ where: { id: projectId } }),
    db.brandExclusionTerm.findMany({ where: { projectId, isActive: true } }),
  ]);

  if (!project) {
    return;
  }

  const domainCore = project.domain.split(".")[0] ?? "";
  const brandHints = [domainCore, ...brandTerms.map((term) => term.term)].filter((term) => term.length >= 3);

  const likelyMisses = await findLikelyBrandMisses(projectId, reportingMonth, brandHints);

  if (likelyMisses.length > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "branded_query_missed",
      severity: IssueSeverity.WARNING,
      title: "Potential branded queries not excluded",
      details: `${likelyMisses.length} GSC queries appear branded but are not currently excluded.`,
      metadata: {
        sampleQueries: likelyMisses.slice(0, 20).map((query) => query.query),
      },
    });
  }
}

async function checkRankOutliers(projectId: string, reportingMonth: Date, importJobId?: string) {
  const previousMonth = monthStart(subMonths(reportingMonth, 1));
  const currentMonth = monthStart(reportingMonth);

  const [currentOrganic, previousOrganic] = await Promise.all([
    db.semrushOrganicRecord.findMany({
      where: { projectId, reportingMonth: currentMonth, keywordId: { not: null } },
      select: { keywordId: true, position: true },
    }),
    db.semrushOrganicRecord.findMany({
      where: { projectId, reportingMonth: previousMonth, keywordId: { not: null } },
      select: { keywordId: true, position: true },
    }),
  ]);

  const previousMap = new Map<string, number>();
  previousOrganic.forEach((row) => {
    if (row.keywordId) {
      previousMap.set(row.keywordId, row.position);
    }
  });

  const outlierCount = currentOrganic.reduce((count, row) => {
    if (!row.keywordId) {
      return count;
    }

    const previous = previousMap.get(row.keywordId);
    if (previous === undefined) {
      return count;
    }

    return Math.abs(row.position - previous) >= 20 ? count + 1 : count;
  }, 0);

  if (outlierCount > 0) {
    await createIssue({
      projectId,
      importJobId,
      reportingMonth,
      issueType: "rank_outlier",
      severity: IssueSeverity.WARNING,
      title: "Large rank movement outliers",
      details: `${outlierCount} keywords moved by 20+ organic positions month-over-month.`,
      metadata: {
        outlierCount,
        previousMonth,
      },
    });
  }
}

async function clearGeneratedIssues(projectId: string, reportingMonth: Date, importJobId?: string) {
  const where = {
    projectId,
    reportingMonth,
    ...(importJobId ? { importJobId } : {}),
    metadata: {
      path: ["generatedBy"],
      equals: "qa_engine",
    },
  } as const;

  await db.dataHealthIssue.deleteMany({ where });
}

export async function runQaForImportJob(importJobId: string) {
  const job = await db.importJob.findUnique({
    where: { id: importJobId },
    include: { project: true },
  });

  if (!job) {
    return;
  }

  const reportingMonth = monthStart(job.reportingMonth);

  await clearGeneratedIssues(job.projectId, reportingMonth, importJobId);
  await checkEmptyImport(importJobId);
  await checkKeywordPairCompleteness(job.projectId, reportingMonth, importJobId);
  await checkDuplicateKeywords(job.projectId, reportingMonth, importJobId);
  await checkMissingMarketValues(job.projectId, reportingMonth, importJobId);
  await checkDateInconsistency(job.projectId, reportingMonth, importJobId);
  await checkUnknownKeywords(job.projectId, reportingMonth, importJobId);
  await checkMissingCompetitors(job.projectId, reportingMonth, importJobId);
  await checkMissedBrandExclusions(job.projectId, reportingMonth, importJobId);
  await checkRankOutliers(job.projectId, reportingMonth, importJobId);
}

export async function runQaForProjectMonth(projectId: string, reportingMonth: Date) {
  const month = monthStart(reportingMonth);
  await clearGeneratedIssues(projectId, month);
  await checkKeywordPairCompleteness(projectId, month);
  await checkDuplicateKeywords(projectId, month);
  await checkMissingMarketValues(projectId, month);
  await checkDateInconsistency(projectId, month);
  await checkUnknownKeywords(projectId, month);
  await checkMissingCompetitors(projectId, month);
  await checkMissedBrandExclusions(projectId, month);
  await checkRankOutliers(projectId, month);

  return db.dataHealthIssue.findMany({
    where: { projectId, reportingMonth: month },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });
}

export async function summarizeQa(projectId: string, reportingMonth: Date) {
  const month = monthStart(reportingMonth);

  const issues = await db.dataHealthIssue.findMany({
    where: {
      projectId,
      reportingMonth: month,
    },
  });

  const bySeverity = {
    ERROR: issues.filter((issue) => issue.severity === IssueSeverity.ERROR).length,
    WARNING: issues.filter((issue) => issue.severity === IssueSeverity.WARNING).length,
    INFO: issues.filter((issue) => issue.severity === IssueSeverity.INFO).length,
  };

  return {
    total: issues.length,
    open: issues.filter((issue) => issue.status === IssueStatus.OPEN).length,
    resolved: issues.filter((issue) => issue.status === IssueStatus.RESOLVED).length,
    bySeverity,
  };
}

export function previousMonth(date: Date) {
  return monthStart(subMonths(date, 1));
}

export function nextMonth(date: Date) {
  return monthStart(addMonths(date, 1));
}

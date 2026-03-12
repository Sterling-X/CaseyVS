import {
  DataHealthIssueType,
  ImportJobStatus,
  ImportSourceType,
  IssueSeverity,
  IssueStatus,
  type ExclusionMatchType,
  Prisma,
  type BrandExclusionTerm,
  type PageExclusionTerm,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { evaluateQueryExclusions } from "@/lib/exclusions";
import { previewMappedRows } from "@/lib/import/mapping";
import { parseGscPerformanceZip } from "@/lib/import/gsc-zip-adapter";
import { transformSemrushOverview } from "@/lib/import/semrush-overview-adapter";
import { autoDetectMapping, getSourceDefinition } from "@/lib/import/source-definitions";
import { ColumnMapping, CommitImportInput, ParsedFile, ValidationIssue } from "@/lib/import/types";
import { runQaForImportJob } from "@/lib/qa/engine";
import { monthStart, normalizeDomain, normalizeText, parseDate } from "@/lib/utils";

export function detectDefaultMapping(sourceType: ImportSourceType, parsed: ParsedFile) {
  return autoDetectMapping(sourceType, parsed.headers);
}

export function buildPreview(sourceType: ImportSourceType, parsed: ParsedFile, mapping: ColumnMapping) {
  return previewMappedRows(sourceType, parsed.rows, mapping);
}

async function ensureMarket(projectId: string, marketName: string | undefined) {
  if (!marketName || !marketName.trim()) {
    return null;
  }

  const normalizedName = normalizeText(marketName);

  const existing = await prisma.market.findFirst({
    where: { projectId, normalizedName },
  });

  if (existing) {
    return existing;
  }

  return prisma.market.create({
    data: {
      projectId,
      name: marketName.trim(),
      normalizedName,
    },
  });
}

function buildValidationIssueRows(importJobId: string, issues: ValidationIssue[]) {
  return issues.map((issue) => ({
    importJobId,
    rowNumber: issue.rowNumber,
    field: issue.field,
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
  }));
}

async function upsertMappingProfileIfNeeded(input: CommitImportInput) {
  if (!input.saveMappingProfileName) {
    return input.mappingProfileId;
  }

  const definition = getSourceDefinition(input.sourceType);

  const profile = await prisma.importMappingProfile.upsert({
    where: {
      projectId_sourceType_name: {
        projectId: input.projectId,
        sourceType: input.sourceType,
        name: input.saveMappingProfileName,
      },
    },
    create: {
      projectId: input.projectId,
      sourceType: input.sourceType,
      name: input.saveMappingProfileName,
      mapping: input.mapping,
      requiredFields: definition.requiredFields,
      isDefault: false,
    },
    update: {
      mapping: input.mapping,
      requiredFields: definition.requiredFields,
    },
  });

  return profile.id;
}

async function loadQueryExclusions(projectId: string) {
  const [brandTerms, pageTerms] = await Promise.all([
    prisma.brandExclusionTerm.findMany({ where: { projectId, isActive: true } }),
    prisma.pageExclusionTerm.findMany({ where: { projectId, isActive: true } }),
  ]);

  return {
    brandTerms,
    pageTerms,
  };
}

function toExclusionTerms(terms: BrandExclusionTerm[] | PageExclusionTerm[]) {
  return terms.map((term) => ({
    term: term.term,
    normalizedTerm: term.normalizedTerm,
    matchType: term.matchType,
    category: term.category,
  }));
}

async function removeExistingRows(projectId: string, sourceType: ImportSourceType, reportingMonth: Date) {
  if (sourceType === ImportSourceType.SEMRUSH_VISIBILITY) {
    await prisma.semrushVisibilityRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.SEMRUSH_MAP_PACK) {
    await prisma.semrushMapPackRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.SEMRUSH_ORGANIC) {
    await prisma.semrushOrganicRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.GSC_QUERY) {
    await prisma.gSCQueryRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW) {
    await prisma.semrushRankingRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.GSC_PERFORMANCE_ZIP) {
    await Promise.all([
      prisma.gSCQueryRecord.deleteMany({ where: { projectId, reportingMonth } }),
      prisma.gSCPageRecord.deleteMany({ where: { projectId, reportingMonth } }),
      prisma.gSCCountryRecord.deleteMany({ where: { projectId, reportingMonth } }),
      prisma.gSCDeviceRecord.deleteMany({ where: { projectId, reportingMonth } }),
      prisma.gSCSearchAppearanceRecord.deleteMany({ where: { projectId, reportingMonth } }),
      prisma.gSCImportMeta.deleteMany({ where: { projectId, reportingMonth } }),
    ]);
  }
}

function parseDateOrFallback(value: unknown, fallback: Date) {
  return parseDate(value) ?? fallback;
}

function keepRawContent(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.slice(0, 1_000_000);
}

export async function commitImportJob(input: CommitImportInput) {
  const reportingMonth = monthStart(input.reportingMonth);
  const preview = buildPreview(input.sourceType, input.parsed, input.mapping);
  const issues = preview.issues;
  const hasBlockingErrors = issues.some((issue) => issue.severity === IssueSeverity.ERROR);
  const mappingProfileId = await upsertMappingProfileIfNeeded(input);

  const importJob = await prisma.importJob.create({
    data: {
      projectId: input.projectId,
      mappingProfileId: mappingProfileId ?? null,
      sourceType: input.sourceType,
      status: hasBlockingErrors ? ImportJobStatus.FAILED : ImportJobStatus.VALIDATED,
      fileName: input.fileName,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      uploadDate: input.uploadDate,
      reportingMonth,
      originalHeaders: input.parsed.headers,
      columnMappings: input.mapping,
      rowCount: input.parsed.rows.length,
      validRowCount: hasBlockingErrors
        ? Math.max(0, input.parsed.rows.length - issues.filter((issue) => issue.severity === IssueSeverity.ERROR).length)
        : input.parsed.rows.length,
      errorCount: issues.filter((issue) => issue.severity === IssueSeverity.ERROR).length,
      warningCount: issues.filter((issue) => issue.severity === IssueSeverity.WARNING).length,
      replaceExisting: Boolean(input.replaceExisting),
      summary: {
        headers: input.parsed.headers,
        mapping: input.mapping,
      },
    },
  });

  await prisma.rawImportFile.create({
    data: {
      projectId: input.projectId,
      importJobId: importJob.id,
      originalName: input.fileName,
      parsedColumns: input.parsed.headers,
      sizeBytes: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      rawContent: keepRawContent(input.rawContent),
    },
  });

  if (issues.length > 0) {
    await prisma.importValidationIssue.createMany({
      data: buildValidationIssueRows(importJob.id, issues),
    });
  }

  await prisma.rawImportRecord.createMany({
    data: input.parsed.rows.slice(0, 2000).map((row, index) => ({
      importJobId: importJob.id,
      rowNumber: index + 2,
      rawData: row as Prisma.InputJsonValue,
      transformedData: preview.rows[index]
        ? (preview.rows[index] as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      isValid: !issues.some((issue) => issue.rowNumber === index + 2 && issue.severity === IssueSeverity.ERROR),
      issues: issues
        .filter((issue) => issue.rowNumber === index + 2)
        .map((issue) => ({ field: issue.field, message: issue.message, severity: issue.severity })) as Prisma.InputJsonValue,
    })),
  });

  if (hasBlockingErrors) {
    await runQaForImportJob(importJob.id);
    return {
      importJob,
      preview,
      committed: false,
    };
  }

  if (input.replaceExisting) {
    await removeExistingRows(input.projectId, input.sourceType, reportingMonth);
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: {
      keywords: true,
      competitors: true,
      markets: true,
    },
  });

  const keywordMap = new Map<string, typeof project.keywords>();
  for (const keyword of project.keywords) {
    const key = keyword.normalizedText;
    const current = keywordMap.get(key) ?? [];
    current.push(keyword);
    keywordMap.set(key, current);
  }

  const competitorMap = new Map(project.competitors.map((competitor) => [competitor.normalizedDomain, competitor]));
  const marketMap = new Map(project.markets.map((market) => [market.normalizedName, market]));

  const unresolvedKeywordSet = new Set<string>();
  const unresolvedCompetitorSet = new Set<string>();

  const resolveKeyword = (keywordText: string, marketId: string | null) => {
    const normalized = normalizeText(keywordText);
    const candidates = keywordMap.get(normalized) ?? [];

    if (candidates.length === 0) {
      return null;
    }

    if (marketId) {
      const exact = candidates.find((item) => item.marketId === marketId);
      if (exact) {
        return exact;
      }
    }

    const noMarket = candidates.find((item) => item.marketId === null);
    return noMarket ?? candidates[0] ?? null;
  };

  if (input.sourceType === ImportSourceType.SEMRUSH_VISIBILITY) {
    const records: Prisma.SemrushVisibilityRecordCreateManyInput[] = [];

    for (let index = 0; index < preview.rows.length; index += 1) {
      const row = preview.rows[index] as Record<string, unknown>;
      const keywordText = String(row.keyword);
      const marketName = typeof row.market === "string" ? row.market.trim() : undefined;
      const market = marketName
        ? marketMap.get(normalizeText(marketName)) ?? (await ensureMarket(input.projectId, marketName))
        : null;

      if (market) {
        marketMap.set(market.normalizedName, market);
      }

      const competitorDomain = normalizeDomain(String(row.competitorDomain));
      const competitor = competitorMap.get(competitorDomain) ?? null;
      const keyword = resolveKeyword(keywordText, market?.id ?? null);

      if (!keyword) {
        unresolvedKeywordSet.add(keywordText);
      }

      if (!competitor) {
        unresolvedCompetitorSet.add(competitorDomain);
      }

      records.push({
        projectId: input.projectId,
        importJobId: importJob.id,
        keywordId: keyword?.id ?? null,
        keywordText,
        normalizedKeyword: normalizeText(keywordText),
        competitorId: competitor?.id ?? null,
        competitorDomain,
        normalizedCompetitorDomain: competitorDomain,
        visibilityScore: Number(row.visibilityScore),
        position: row.position === undefined || row.position === null ? null : Number(row.position),
        capturedAt: parseDateOrFallback(row.capturedAt, reportingMonth),
        reportingMonth,
        marketId: market?.id ?? null,
        rankingContext: typeof row.rankingContext === "string" ? row.rankingContext : null,
        device: typeof row.device === "string" ? row.device : null,
        sourceRowNumber: index + 2,
      });
    }

    if (records.length > 0) {
      await prisma.semrushVisibilityRecord.createMany({ data: records });
    }
  }

  if (input.sourceType === ImportSourceType.SEMRUSH_MAP_PACK) {
    const records: Prisma.SemrushMapPackRecordCreateManyInput[] = [];

    for (let index = 0; index < preview.rows.length; index += 1) {
      const row = preview.rows[index] as Record<string, unknown>;
      const keywordText = String(row.keyword);
      const marketName = typeof row.market === "string" ? row.market.trim() : undefined;
      const market = marketName
        ? marketMap.get(normalizeText(marketName)) ?? (await ensureMarket(input.projectId, marketName))
        : null;

      if (market) {
        marketMap.set(market.normalizedName, market);
      }

      const keyword = resolveKeyword(keywordText, market?.id ?? null);
      if (!keyword) {
        unresolvedKeywordSet.add(keywordText);
      }

      const domain = normalizeDomain(String(row.domain));

      records.push({
        projectId: input.projectId,
        importJobId: importJob.id,
        keywordId: keyword?.id ?? null,
        keywordText,
        normalizedKeyword: normalizeText(keywordText),
        domain,
        normalizedDomain: domain,
        position: Number(row.position),
        capturedAt: parseDateOrFallback(row.capturedAt, reportingMonth),
        reportingMonth,
        marketId: market?.id ?? null,
        device: typeof row.device === "string" ? row.device : null,
        sourceRowNumber: index + 2,
      });
    }

    if (records.length > 0) {
      await prisma.semrushMapPackRecord.createMany({ data: records });
    }
  }

  if (input.sourceType === ImportSourceType.SEMRUSH_ORGANIC) {
    const records: Prisma.SemrushOrganicRecordCreateManyInput[] = [];

    for (let index = 0; index < preview.rows.length; index += 1) {
      const row = preview.rows[index] as Record<string, unknown>;
      const keywordText = String(row.keyword);
      const marketName = typeof row.market === "string" ? row.market.trim() : undefined;
      const market = marketName
        ? marketMap.get(normalizeText(marketName)) ?? (await ensureMarket(input.projectId, marketName))
        : null;

      if (market) {
        marketMap.set(market.normalizedName, market);
      }

      const keyword = resolveKeyword(keywordText, market?.id ?? null);
      if (!keyword) {
        unresolvedKeywordSet.add(keywordText);
      }

      const domain = normalizeDomain(String(row.domain));

      records.push({
        projectId: input.projectId,
        importJobId: importJob.id,
        keywordId: keyword?.id ?? null,
        keywordText,
        normalizedKeyword: normalizeText(keywordText),
        domain,
        normalizedDomain: domain,
        position: Number(row.position),
        capturedAt: parseDateOrFallback(row.capturedAt, reportingMonth),
        reportingMonth,
        marketId: market?.id ?? null,
        device: typeof row.device === "string" ? row.device : null,
        searchVolume: row.searchVolume === undefined || row.searchVolume === null ? null : Number(row.searchVolume),
        sourceRowNumber: index + 2,
      });
    }

    if (records.length > 0) {
      await prisma.semrushOrganicRecord.createMany({ data: records });
    }
  }

  if (input.sourceType === ImportSourceType.GSC_QUERY) {
    const records: Prisma.GSCQueryRecordCreateManyInput[] = [];
    const exclusions = await loadQueryExclusions(input.projectId);
    const brandTerms = toExclusionTerms(exclusions.brandTerms);
    const pageTerms = toExclusionTerms(exclusions.pageTerms);

    for (let index = 0; index < preview.rows.length; index += 1) {
      const row = preview.rows[index] as Record<string, unknown>;
      const query = String(row.query);
      const exclusion = evaluateQueryExclusions(query, brandTerms, pageTerms);

      records.push({
        projectId: input.projectId,
        importJobId: importJob.id,
        query,
        normalizedQuery: normalizeText(query),
        clicks: Number(row.clicks),
        impressions: Number(row.impressions),
        ctr: Number(row.ctr),
        averagePosition: Number(row.averagePosition),
        dateRangeStart: parseDateOrFallback(row.dateRangeStart, reportingMonth),
        dateRangeEnd: parseDateOrFallback(row.dateRangeEnd, reportingMonth),
        reportingMonth,
        isBrandExcluded: exclusion.isBrandExcluded,
        isPageExcluded: exclusion.isPageExcluded,
        exclusionReasons: exclusion.reasons,
        sourceRowNumber: index + 2,
      });
    }

    if (records.length > 0) {
      await prisma.gSCQueryRecord.createMany({ data: records });
    }
  }

  if (unresolvedKeywordSet.size > 0) {
    await prisma.dataHealthIssue.createMany({
      data: [...unresolvedKeywordSet].map((keywordText) => ({
        projectId: input.projectId,
        importJobId: importJob.id,
        reportingMonth,
        issueType: DataHealthIssueType.UNMAPPED_KEYWORD,
        severity: IssueSeverity.ERROR,
        status: IssueStatus.OPEN,
        title: "Unmapped keyword in import",
        details: `Imported keyword not found in project keyword set: ${keywordText}`,
        metadata: {
          keywordText,
          sourceType: input.sourceType,
        },
      })),
    });
  }

  if (unresolvedCompetitorSet.size > 0 && input.sourceType === ImportSourceType.SEMRUSH_VISIBILITY) {
    await prisma.dataHealthIssue.createMany({
      data: [...unresolvedCompetitorSet].map((competitorDomain) => ({
        projectId: input.projectId,
        importJobId: importJob.id,
        reportingMonth,
        issueType: DataHealthIssueType.MISSING_COMPETITOR_MAPPING,
        severity: IssueSeverity.WARNING,
        status: IssueStatus.OPEN,
        title: "Visibility row missing competitor mapping",
        details: `Competitor domain from import is not mapped in project competitors: ${competitorDomain}`,
        metadata: {
          competitorDomain,
          sourceType: input.sourceType,
        },
      })),
    });
  }

  const committedImportJob = await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      status: ImportJobStatus.COMMITTED,
      committedAt: new Date(),
      validRowCount: preview.rows.length,
      summary: {
        headers: input.parsed.headers,
        mapping: input.mapping,
        unresolvedKeywordCount: unresolvedKeywordSet.size,
        unresolvedCompetitorCount: unresolvedCompetitorSet.size,
      },
    },
  });

  await runQaForImportJob(importJob.id);

  return {
    importJob,
    preview,
    committed: true,
  };
}

export async function getImportHistory(projectId: string) {
  return prisma.importJob.findMany({
    where: { projectId },
    include: {
      validationIssues: true,
      rawFile: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMappingProfiles(projectId: string, sourceType: ImportSourceType) {
  return prisma.importMappingProfile.findMany({
    where: { projectId, sourceType },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getGscExclusionAudit(projectId: string, reportingMonth: Date) {
  const month = monthStart(reportingMonth);
  return prisma.gSCQueryRecord.findMany({
    where: { projectId, reportingMonth: month },
    orderBy: { clicks: "desc" },
  });
}

export function previewSemrushOverviewImport(parsed: ParsedFile) {
  return transformSemrushOverview(parsed);
}

export async function previewGscZipImport(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseGscPerformanceZip(buffer);
}

type CommitSemrushOverviewInput = {
  projectId: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  rawContent?: string;
  reportingMonth: Date;
  uploadDate: Date;
  parsed: ParsedFile;
  replaceExisting?: boolean;
};

type CommitGscZipInput = {
  projectId: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  reportingMonth: Date;
  uploadDate: Date;
  zipBuffer: Buffer;
  replaceExisting?: boolean;
};

function truncateJsonForIssue(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return Prisma.JsonNull;
  }
}

async function createDuplicateImportIssueIfNeeded(input: {
  projectId: string;
  reportingMonth: Date;
  sourceType: ImportSourceType;
  importJobId: string;
}) {
  const duplicateCount = await prisma.importJob.count({
    where: {
      projectId: input.projectId,
      reportingMonth: input.reportingMonth,
      sourceType: input.sourceType,
      status: ImportJobStatus.COMMITTED,
      NOT: {
        id: input.importJobId,
      },
    },
  });

  if (duplicateCount === 0) {
    return;
  }

  await prisma.dataHealthIssue.create({
    data: {
      projectId: input.projectId,
      importJobId: input.importJobId,
      reportingMonth: input.reportingMonth,
      issueType: DataHealthIssueType.DUPLICATE_IMPORT_PERIOD,
      severity: IssueSeverity.WARNING,
      status: IssueStatus.OPEN,
      title: "Duplicate import for same project and period",
      details: `${duplicateCount} prior committed import(s) exist for this source and reporting month.`,
      metadata: {
        sourceType: input.sourceType,
      },
    },
  });
}

export async function commitSemrushOverviewImport(input: CommitSemrushOverviewInput) {
  const reportingMonth = monthStart(input.reportingMonth);
  const transformed = transformSemrushOverview(input.parsed);
  const hasBlockingErrors = transformed.issues.some((issue) => issue.severity === IssueSeverity.ERROR);

  const importJob = await prisma.importJob.create({
    data: {
      projectId: input.projectId,
      sourceType: ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW,
      status: hasBlockingErrors ? ImportJobStatus.FAILED : ImportJobStatus.VALIDATED,
      fileName: input.fileName,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      uploadDate: input.uploadDate,
      reportingMonth,
      originalHeaders: input.parsed.headers,
      rowCount: input.parsed.rows.length,
      validRowCount: transformed.rows.length,
      errorCount: transformed.issues.filter((issue) => issue.severity === IssueSeverity.ERROR).length,
      warningCount: transformed.issues.filter((issue) => issue.severity === IssueSeverity.WARNING).length,
      replaceExisting: Boolean(input.replaceExisting),
      summary: {
        detectedDomains: transformed.detectedDomains,
        detectedDates: transformed.detectedDates,
      },
    },
  });

  await prisma.rawImportFile.create({
    data: {
      projectId: input.projectId,
      importJobId: importJob.id,
      originalName: input.fileName,
      parsedColumns: input.parsed.headers,
      sizeBytes: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      rawContent: keepRawContent(input.rawContent),
    },
  });

  if (transformed.issues.length > 0) {
    await prisma.importValidationIssue.createMany({
      data: buildValidationIssueRows(importJob.id, transformed.issues),
    });
  }

  await prisma.rawImportRecord.createMany({
    data: input.parsed.rows.slice(0, 2000).map((row, index) => ({
      importJobId: importJob.id,
      rowNumber: index + 2,
      rawData: row as Prisma.InputJsonValue,
      transformedData: Prisma.JsonNull,
      isValid: !transformed.issues.some((issue) => issue.rowNumber === index + 2 && issue.severity === IssueSeverity.ERROR),
      issues: transformed.issues
        .filter((issue) => issue.rowNumber === index + 2)
        .map((issue) => ({ field: issue.field, message: issue.message, severity: issue.severity })) as Prisma.InputJsonValue,
    })),
  });

  if (hasBlockingErrors) {
    await runQaForImportJob(importJob.id);
    return {
      importJob,
      preview: transformed,
      committed: false,
    };
  }

  if (input.replaceExisting) {
    await removeExistingRows(input.projectId, ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW, reportingMonth);
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: {
      keywords: true,
      markets: true,
    },
  });

  const keywordMap = new Map<string, typeof project.keywords>();
  for (const keyword of project.keywords) {
    const list = keywordMap.get(keyword.normalizedText) ?? [];
    list.push(keyword);
    keywordMap.set(keyword.normalizedText, list);
  }

  const resolveKeyword = (keywordText: string) => {
    const normalized = normalizeText(keywordText);
    const candidates = keywordMap.get(normalized) ?? [];
    return candidates[0] ?? null;
  };

  const unresolvedKeywordSet = new Set<string>();
  const records: Prisma.SemrushRankingRecordCreateManyInput[] = transformed.rows.map((row, index) => {
    const keyword = resolveKeyword(row.keyword);
    if (!keyword) {
      unresolvedKeywordSet.add(row.keyword);
    }

    const capturedAt = parseDate(row.capturedAt) ?? reportingMonth;
    return {
      projectId: input.projectId,
      importJobId: importJob.id,
      keywordId: keyword?.id ?? null,
      marketId: keyword?.marketId ?? null,
      keywordText: row.keyword,
      normalizedKeyword: normalizeText(row.keyword),
      tags: row.tags,
      intents: row.intents,
      domain: normalizeDomain(row.domain),
      normalizedDomain: normalizeDomain(row.domain),
      capturedAt,
      reportingMonth: monthStart(capturedAt),
      rank: row.rank ?? null,
      rankingType: row.rankingType ? normalizeText(String(row.rankingType)) : null,
      landingUrl: row.landingUrl ?? null,
      difference: row.difference ?? null,
      searchVolume: row.searchVolume ?? null,
      cpc: row.cpc ?? null,
      keywordDifficulty: row.keywordDifficulty ?? null,
      sourceRowNumber: index + 2,
    };
  });

  if (records.length > 0) {
    await prisma.semrushRankingRecord.createMany({ data: records });
  }

  if (unresolvedKeywordSet.size > 0) {
    await prisma.dataHealthIssue.createMany({
      data: [...unresolvedKeywordSet].map((keywordText) => ({
        projectId: input.projectId,
        importJobId: importJob.id,
        reportingMonth,
        issueType: DataHealthIssueType.UNMAPPED_KEYWORD,
        severity: IssueSeverity.ERROR,
        status: IssueStatus.OPEN,
        title: "Unmapped keyword in Semrush overview import",
        details: `Keyword not found in project keyword set: ${keywordText}`,
        metadata: { keywordText, sourceType: ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW },
      })),
    });
  }

  const committedImportJob = await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      status: ImportJobStatus.COMMITTED,
      committedAt: new Date(),
      validRowCount: records.length,
      summary: {
        detectedDomains: transformed.detectedDomains,
        detectedDates: transformed.detectedDates,
        unresolvedKeywordCount: unresolvedKeywordSet.size,
      },
    },
  });

  await createDuplicateImportIssueIfNeeded({
    projectId: input.projectId,
    reportingMonth,
    sourceType: ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW,
    importJobId: importJob.id,
  });

  await runQaForImportJob(importJob.id);

  return {
    importJob: committedImportJob,
    preview: transformed,
    committed: true,
  };
}

type ExclusionTermInput = {
  term: string;
  normalizedTerm: string;
  matchType: ExclusionMatchType;
  category: string | null;
};

function reasonsToText(reasons: { type: string; term: string; category: string | null }[]) {
  if (reasons.length === 0) {
    return null;
  }
  return reasons.map((reason) => `${reason.type}:${reason.term}`).join(", ");
}

export async function commitGscZipImport(input: CommitGscZipInput) {
  const reportingMonth = monthStart(input.reportingMonth);
  const normalized = await parseGscPerformanceZip(input.zipBuffer);
  const hasBlockingErrors = normalized.issues.some((issue) => issue.severity === IssueSeverity.ERROR);
  const totalRows =
    normalized.queries.length +
    normalized.pages.length +
    normalized.countries.length +
    normalized.devices.length +
    normalized.appearances.length;

  const importJob = await prisma.importJob.create({
    data: {
      projectId: input.projectId,
      sourceType: ImportSourceType.GSC_PERFORMANCE_ZIP,
      status: hasBlockingErrors ? ImportJobStatus.FAILED : ImportJobStatus.VALIDATED,
      fileName: input.fileName,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      uploadDate: input.uploadDate,
      reportingMonth,
      rowCount: totalRows,
      validRowCount: totalRows,
      errorCount: normalized.issues.filter((issue) => issue.severity === IssueSeverity.ERROR).length,
      warningCount: normalized.issues.filter((issue) => issue.severity === IssueSeverity.WARNING).length,
      replaceExisting: Boolean(input.replaceExisting),
      summary: {
        filePresence: normalized.filePresence,
        filters: normalized.importMeta.filters,
      },
    },
  });

  await prisma.rawImportFile.create({
    data: {
      projectId: input.projectId,
      importJobId: importJob.id,
      originalName: input.fileName,
      parsedColumns: [],
      sizeBytes: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      rawContent: null,
    },
  });

  if (normalized.issues.length > 0) {
    await prisma.importValidationIssue.createMany({
      data: buildValidationIssueRows(importJob.id, normalized.issues),
    });
  }

  if (hasBlockingErrors) {
    await runQaForImportJob(importJob.id);
    return {
      importJob,
      preview: normalized,
      committed: false,
    };
  }

  if (input.replaceExisting) {
    await removeExistingRows(input.projectId, ImportSourceType.GSC_PERFORMANCE_ZIP, reportingMonth);
  }

  const exclusions = await loadQueryExclusions(input.projectId);
  const brandTerms = toExclusionTerms(exclusions.brandTerms) as ExclusionTermInput[];
  const pageTerms = toExclusionTerms(exclusions.pageTerms) as ExclusionTermInput[];

  if (normalized.queries.length > 0) {
    await prisma.gSCQueryRecord.createMany({
      data: normalized.queries.map((row, index) => {
        const exclusion = evaluateQueryExclusions(row.dimension, brandTerms, pageTerms);
        return {
          importJobId: importJob.id,
          projectId: input.projectId,
          query: row.dimension,
          normalizedQuery: normalizeText(row.dimension),
          clicks: row.currentClicks,
          impressions: row.currentImpressions,
          ctr: row.currentCtr,
          averagePosition: row.currentPosition,
          dateRangeStart: reportingMonth,
          dateRangeEnd: reportingMonth,
          reportingMonth,
          isBrandExcluded: exclusion.isBrandExcluded,
          isPageExcluded: exclusion.isPageExcluded,
          exclusionReasons: truncateJsonForIssue(exclusion.reasons),
          sourceRowNumber: index + 2,
          currentClicks: row.currentClicks,
          previousClicks: row.previousClicks,
          currentImpressions: row.currentImpressions,
          previousImpressions: row.previousImpressions,
          currentCtr: row.currentCtr,
          previousCtr: row.previousCtr,
          currentPosition: row.currentPosition,
          previousPosition: row.previousPosition,
          exclusionStatus: exclusion.isBrandExcluded || exclusion.isPageExcluded ? "excluded" : "included",
          exclusionReasonText: reasonsToText(exclusion.reasons),
        };
      }),
    });
  }

  if (normalized.pages.length > 0) {
    await prisma.gSCPageRecord.createMany({
      data: normalized.pages.map((row, index) => ({
        importJobId: importJob.id,
        projectId: input.projectId,
        reportingMonth,
        page: row.dimension,
        normalizedPage: normalizeText(row.dimension),
        currentClicks: row.currentClicks,
        previousClicks: row.previousClicks,
        currentImpressions: row.currentImpressions,
        previousImpressions: row.previousImpressions,
        currentCtr: row.currentCtr,
        previousCtr: row.previousCtr,
        currentPosition: row.currentPosition,
        previousPosition: row.previousPosition,
        sourceRowNumber: index + 2,
      })),
    });
  }

  if (normalized.countries.length > 0) {
    await prisma.gSCCountryRecord.createMany({
      data: normalized.countries.map((row, index) => ({
        importJobId: importJob.id,
        projectId: input.projectId,
        reportingMonth,
        country: row.dimension,
        normalizedCountry: normalizeText(row.dimension),
        currentClicks: row.currentClicks,
        previousClicks: row.previousClicks,
        currentImpressions: row.currentImpressions,
        previousImpressions: row.previousImpressions,
        currentCtr: row.currentCtr,
        previousCtr: row.previousCtr,
        currentPosition: row.currentPosition,
        previousPosition: row.previousPosition,
        sourceRowNumber: index + 2,
      })),
    });
  }

  if (normalized.devices.length > 0) {
    await prisma.gSCDeviceRecord.createMany({
      data: normalized.devices.map((row, index) => ({
        importJobId: importJob.id,
        projectId: input.projectId,
        reportingMonth,
        device: row.dimension,
        normalizedDevice: normalizeText(row.dimension),
        currentClicks: row.currentClicks,
        previousClicks: row.previousClicks,
        currentImpressions: row.currentImpressions,
        previousImpressions: row.previousImpressions,
        currentCtr: row.currentCtr,
        previousCtr: row.previousCtr,
        currentPosition: row.currentPosition,
        previousPosition: row.previousPosition,
        sourceRowNumber: index + 2,
      })),
    });
  }

  if (normalized.appearances.length > 0) {
    await prisma.gSCSearchAppearanceRecord.createMany({
      data: normalized.appearances.map((row, index) => ({
        importJobId: importJob.id,
        projectId: input.projectId,
        reportingMonth,
        appearance: row.dimension,
        normalizedAppearance: normalizeText(row.dimension),
        currentClicks: row.currentClicks,
        previousClicks: row.previousClicks,
        currentImpressions: row.currentImpressions,
        previousImpressions: row.previousImpressions,
        currentCtr: row.currentCtr,
        previousCtr: row.previousCtr,
        currentPosition: row.currentPosition,
        previousPosition: row.previousPosition,
        sourceRowNumber: index + 2,
      })),
    });
  }

  await prisma.gSCImportMeta.create({
    data: {
      importJobId: importJob.id,
      projectId: input.projectId,
      reportingMonth,
      searchType: normalized.importMeta.searchType,
      dateRangeLabel: normalized.importMeta.dateRangeLabel,
      currentRangeLabel: normalized.importMeta.currentRangeLabel,
      previousRangeLabel: normalized.importMeta.previousRangeLabel,
      appliedFilters: truncateJsonForIssue(normalized.importMeta.filters),
      rawFilters: truncateJsonForIssue(normalized.importMeta.rawFiltersRows),
    },
  });

  if (!normalized.importMeta.searchType || !normalized.importMeta.dateRangeLabel) {
    await prisma.dataHealthIssue.create({
      data: {
        projectId: input.projectId,
        importJobId: importJob.id,
        reportingMonth,
        issueType: DataHealthIssueType.MISSING_IMPORT_METADATA,
        severity: IssueSeverity.WARNING,
        status: IssueStatus.OPEN,
        title: "Missing import metadata from GSC Filters.csv",
        details: "Search type and/or date range label could not be parsed from Filters.csv.",
      },
    });
  }

  const committedImportJob = await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      status: ImportJobStatus.COMMITTED,
      committedAt: new Date(),
      validRowCount: totalRows,
      summary: {
        filePresence: normalized.filePresence,
        queryRows: normalized.queries.length,
        pageRows: normalized.pages.length,
        countryRows: normalized.countries.length,
        deviceRows: normalized.devices.length,
        appearanceRows: normalized.appearances.length,
      },
    },
  });

  await createDuplicateImportIssueIfNeeded({
    projectId: input.projectId,
    reportingMonth,
    sourceType: ImportSourceType.GSC_PERFORMANCE_ZIP,
    importJobId: importJob.id,
  });

  await runQaForImportJob(importJob.id);

  return {
    importJob: committedImportJob,
    preview: normalized,
    committed: true,
  };
}

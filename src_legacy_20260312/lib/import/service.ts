import {
  BrandExclusionTerm,
  ExclusionMatchType,
  GSCQueryRecord,
  ImportJob,
  ImportJobStatus,
  ImportSourceType,
  PageExclusionTerm,
} from "@prisma/client";
import { db } from "@/lib/db";
import { evaluateQueryExclusions } from "@/lib/exclusions";
import { previewMappedRows } from "@/lib/import/mapping";
import { autoDetectMapping, getSourceDefinition } from "@/lib/import/source-definitions";
import { ColumnMapping, CommitImportInput, ParsedFile, ValidationIssue } from "@/lib/import/types";
import { runQaForImportJob } from "@/lib/qa/engine";
import { monthStart, normalizeDomain, normalizeText } from "@/lib/utils";

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

  const normalizedName = marketName.trim();
  const existing = await db.market.findFirst({
    where: { projectId, name: { equals: normalizedName, mode: "insensitive" } },
  });

  if (existing) {
    return existing;
  }

  return db.market.create({
    data: {
      projectId,
      name: normalizedName,
    },
  });
}

function buildValidationIssueRows(importJobId: string, issues: ValidationIssue[]) {
  return issues.map((issue) => ({
    importJobId,
    rowNumber: issue.rowNumber,
    field: issue.field,
    severity: issue.severity,
    message: issue.message,
  }));
}

async function upsertMappingProfileIfNeeded(input: CommitImportInput) {
  if (!input.saveMappingProfileName) {
    return input.mappingProfileId;
  }

  const definition = getSourceDefinition(input.sourceType);

  const profile = await db.importMappingProfile.upsert({
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
    db.brandExclusionTerm.findMany({ where: { projectId, isActive: true } }),
    db.pageExclusionTerm.findMany({ where: { projectId, isActive: true } }),
  ]);

  return {
    brandTerms,
    pageTerms,
  };
}

function toExclusionTerms(terms: BrandExclusionTerm[] | PageExclusionTerm[]) {
  return terms.map((term) => ({
    term: term.term,
    matchType: term.matchType,
  }));
}

async function removeExistingRows(projectId: string, sourceType: ImportSourceType, reportingMonth: Date) {
  if (sourceType === ImportSourceType.SEMRUSH_VISIBILITY) {
    await db.semrushVisibilityRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.SEMRUSH_MAP_PACK) {
    await db.semrushMapPackRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.SEMRUSH_ORGANIC) {
    await db.semrushOrganicRecord.deleteMany({ where: { projectId, reportingMonth } });
    return;
  }

  if (sourceType === ImportSourceType.GSC_QUERY) {
    await db.gSCQueryRecord.deleteMany({ where: { projectId, reportingMonth } });
  }
}

function parseDateOrFallback(value: unknown, fallback: Date) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

export async function commitImportJob(input: CommitImportInput) {
  const reportingMonth = monthStart(input.reportingMonth);
  const preview = buildPreview(input.sourceType, input.parsed, input.mapping);
  const issues = preview.issues;
  const hasBlockingErrors = issues.some((issue) => issue.severity === "ERROR");
  const mappingProfileId = await upsertMappingProfileIfNeeded(input);

  const importJob = await db.importJob.create({
    data: {
      projectId: input.projectId,
      mappingProfileId: mappingProfileId ?? null,
      sourceType: input.sourceType,
      status: hasBlockingErrors ? ImportJobStatus.FAILED : ImportJobStatus.VALIDATED,
      fileName: input.fileName,
      uploadDate: input.uploadDate,
      reportingMonth,
      rowCount: input.parsed.rows.length,
      validRowCount: hasBlockingErrors
        ? Math.max(0, input.parsed.rows.length - issues.filter((issue) => issue.severity === "ERROR").length)
        : input.parsed.rows.length,
      errorCount: issues.filter((issue) => issue.severity === "ERROR").length,
      warningCount: issues.filter((issue) => issue.severity === "WARNING").length,
      replaceExisting: Boolean(input.replaceExisting),
      summary: {
        headers: input.parsed.headers,
        mapping: input.mapping,
      },
    },
  });

  await db.rawImportFile.create({
    data: {
      projectId: input.projectId,
      importJobId: importJob.id,
      originalName: input.fileName,
      parsedColumns: input.parsed.headers,
      sizeBytes: null,
      mimeType: null,
      storagePath: null,
      fileHash: null,
    },
  });

  if (issues.length > 0) {
    await db.importValidationIssue.createMany({
      data: buildValidationIssueRows(importJob.id, issues),
    });
  }

  await db.rawImportRecord.createMany({
    data: input.parsed.rows.slice(0, 1000).map((row, index) => ({
      importJobId: importJob.id,
      rowNumber: index + 2,
      rawData: row,
      transformedData: preview.rows[index] ?? null,
      isValid: !issues.some((issue) => issue.rowNumber === index + 2 && issue.severity === "ERROR"),
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

  const project = await db.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: {
      keywords: true,
      competitors: true,
      markets: true,
    },
  });

  const keywordMap = new Map(project.keywords.map((keyword) => [normalizeText(keyword.text), keyword]));
  const competitorMap = new Map(
    project.competitors.map((competitor) => [normalizeDomain(competitor.domain), competitor]),
  );
  const marketMap = new Map(project.markets.map((market) => [normalizeText(market.name), market]));

  const unresolvedKeywordSet = new Set<string>();
  const unresolvedCompetitorSet = new Set<string>();

  if (input.sourceType === ImportSourceType.SEMRUSH_VISIBILITY) {
    const records = [] as Parameters<typeof db.semrushVisibilityRecord.createMany>[0]["data"];

    for (const row of preview.rows) {
      const keywordText = String(row.keyword);
      const normalizedKeyword = normalizeText(keywordText);
      const competitorDomain = normalizeDomain(String(row.competitorDomain));
      const marketName = typeof row.market === "string" ? row.market.trim() : undefined;
      const capturedAt = parseDateOrFallback(row.capturedAt, reportingMonth);

      const market = marketName
        ? marketMap.get(normalizeText(marketName)) ?? (await ensureMarket(input.projectId, marketName))
        : null;

      if (market && !marketMap.has(normalizeText(market.name))) {
        marketMap.set(normalizeText(market.name), market);
      }

      const keyword = keywordMap.get(normalizedKeyword);
      const competitor = competitorMap.get(competitorDomain);

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
        competitorId: competitor?.id ?? null,
        competitorDomain,
        visibilityScore: Number(row.visibilityScore),
        position: row.position === undefined || row.position === null ? null : Number(row.position),
        capturedAt,
        reportingMonth,
        marketId: market?.id ?? null,
        rankingContext: typeof row.rankingContext === "string" ? row.rankingContext : null,
        device: typeof row.device === "string" ? row.device : null,
      });
    }

    if (records.length > 0) {
      await db.semrushVisibilityRecord.createMany({ data: records });
    }
  }

  if (input.sourceType === ImportSourceType.SEMRUSH_MAP_PACK) {
    const records = [] as Parameters<typeof db.semrushMapPackRecord.createMany>[0]["data"];

    for (const row of preview.rows) {
      const keywordText = String(row.keyword);
      const normalizedKeyword = normalizeText(keywordText);
      const marketName = typeof row.market === "string" ? row.market.trim() : undefined;
      const capturedAt = parseDateOrFallback(row.capturedAt, reportingMonth);

      const market = marketName
        ? marketMap.get(normalizeText(marketName)) ?? (await ensureMarket(input.projectId, marketName))
        : null;

      if (market && !marketMap.has(normalizeText(market.name))) {
        marketMap.set(normalizeText(market.name), market);
      }

      const keyword = keywordMap.get(normalizedKeyword);

      if (!keyword) {
        unresolvedKeywordSet.add(keywordText);
      }

      records.push({
        projectId: input.projectId,
        importJobId: importJob.id,
        keywordId: keyword?.id ?? null,
        keywordText,
        domain: normalizeDomain(String(row.domain)),
        position: Number(row.position),
        capturedAt,
        reportingMonth,
        marketId: market?.id ?? null,
        device: typeof row.device === "string" ? row.device : null,
      });
    }

    if (records.length > 0) {
      await db.semrushMapPackRecord.createMany({ data: records });
    }
  }

  if (input.sourceType === ImportSourceType.SEMRUSH_ORGANIC) {
    const records = [] as Parameters<typeof db.semrushOrganicRecord.createMany>[0]["data"];

    for (const row of preview.rows) {
      const keywordText = String(row.keyword);
      const normalizedKeyword = normalizeText(keywordText);
      const marketName = typeof row.market === "string" ? row.market.trim() : undefined;
      const capturedAt = parseDateOrFallback(row.capturedAt, reportingMonth);

      const market = marketName
        ? marketMap.get(normalizeText(marketName)) ?? (await ensureMarket(input.projectId, marketName))
        : null;

      if (market && !marketMap.has(normalizeText(market.name))) {
        marketMap.set(normalizeText(market.name), market);
      }

      const keyword = keywordMap.get(normalizedKeyword);

      if (!keyword) {
        unresolvedKeywordSet.add(keywordText);
      }

      records.push({
        projectId: input.projectId,
        importJobId: importJob.id,
        keywordId: keyword?.id ?? null,
        keywordText,
        domain: normalizeDomain(String(row.domain)),
        position: Number(row.position),
        capturedAt,
        reportingMonth,
        marketId: market?.id ?? null,
        device: typeof row.device === "string" ? row.device : null,
      });
    }

    if (records.length > 0) {
      await db.semrushOrganicRecord.createMany({ data: records });
    }
  }

  if (input.sourceType === ImportSourceType.GSC_QUERY) {
    const records = [] as Parameters<typeof db.gSCQueryRecord.createMany>[0]["data"];
    const exclusions = await loadQueryExclusions(input.projectId);
    const brandTerms = toExclusionTerms(exclusions.brandTerms);
    const pageTerms = toExclusionTerms(exclusions.pageTerms);

    for (const row of preview.rows) {
      const query = String(row.query);
      const exclusionResult = evaluateQueryExclusions(query, brandTerms, pageTerms);

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
        exclusionReasons: exclusionResult.reasons,
        isBrandExcluded: exclusionResult.isBrandExcluded,
        isPageExcluded: exclusionResult.isPageExcluded,
      });
    }

    if (records.length > 0) {
      await db.gSCQueryRecord.createMany({ data: records });
    }
  }

  if (unresolvedKeywordSet.size > 0) {
    await db.dataHealthIssue.createMany({
      data: [...unresolvedKeywordSet].map((keywordText) => ({
        projectId: input.projectId,
        importJobId: importJob.id,
        reportingMonth,
        issueType: "unmapped_keyword",
        severity: "ERROR",
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
    await db.dataHealthIssue.createMany({
      data: [...unresolvedCompetitorSet].map((competitorDomain) => ({
        projectId: input.projectId,
        importJobId: importJob.id,
        reportingMonth,
        issueType: "missing_competitor_mapping",
        severity: "WARNING",
        title: "Visibility row missing competitor mapping",
        details: `Competitor domain from import is not mapped in project competitors: ${competitorDomain}`,
        metadata: {
          competitorDomain,
          sourceType: input.sourceType,
        },
      })),
    });
  }

  await db.importJob.update({
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
  return db.importJob.findMany({
    where: { projectId },
    include: {
      validationIssues: true,
      rawFile: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMappingProfiles(projectId: string, sourceType: ImportSourceType) {
  return db.importMappingProfile.findMany({
    where: { projectId, sourceType },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getGscExclusionAudit(projectId: string, reportingMonth: Date) {
  const month = monthStart(reportingMonth);
  return db.gSCQueryRecord.findMany({
    where: { projectId, reportingMonth: month },
    orderBy: { clicks: "desc" },
  });
}

export function createExclusionTerm(term: string, matchType?: ExclusionMatchType) {
  return {
    term: term.trim(),
    matchType: matchType ?? ExclusionMatchType.CONTAINS,
  };
}

export async function findLikelyBrandMisses(
  projectId: string,
  reportingMonth: Date,
  brandHints: string[],
): Promise<GSCQueryRecord[]> {
  const month = monthStart(reportingMonth);
  const hints = brandHints.map((hint) => normalizeText(hint)).filter((hint) => hint.length >= 3);

  if (hints.length === 0) {
    return [];
  }

  const records = await db.gSCQueryRecord.findMany({
    where: {
      projectId,
      reportingMonth: month,
      isBrandExcluded: false,
    },
  });

  return records.filter((record) => hints.some((hint) => record.normalizedQuery.includes(hint)));
}

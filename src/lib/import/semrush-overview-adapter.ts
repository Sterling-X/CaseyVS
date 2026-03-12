import { IssueSeverity } from "@prisma/client";
import { ParsedFile, ParsedRow, ValidationIssue } from "@/lib/import/types";
import { normalizeDomain, parseInteger, parseNumber } from "@/lib/utils";

type DateSlot = {
  rankHeader?: string;
  typeHeader?: string;
  landingHeader?: string;
};

type ScopeLayout = {
  differenceHeader?: string;
  dateSlots: Map<string, DateSlot>;
};

type SemrushOverviewLayout = {
  keywordHeader: string;
  tagsHeader?: string;
  intentsHeader?: string;
  searchVolumeHeader?: string;
  cpcHeader?: string;
  keywordDifficultyHeader?: string;
  scopes: Map<string, ScopeLayout>;
};

export type SemrushOverviewNormalizedRow = {
  keyword: string;
  tags: string | null;
  intents: string | null;
  domain: string;
  capturedAt: string;
  rank: number | null;
  rankingType: string | null;
  landingUrl: string | null;
  difference: number | null;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
};

export type SemrushOverviewTransformResult = {
  rows: SemrushOverviewNormalizedRow[];
  issues: ValidationIssue[];
  layoutDetected: boolean;
  detectedDomains: string[];
  detectedDates: string[];
};

const DOMAIN_GROUP_RE = /^(.+?)_(\d{8}|difference)(?:_(type|landing))?$/i;

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function toIsoDate(stamp: string) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function isNonRankingValue(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  const text = String(value).trim().toLowerCase();
  return text === "" || text === "-" || text === "n/a" || text === "na";
}

function normalizeScopeToDomain(scope: string) {
  return normalizeDomain(
    scope
      .replace(/^https?:\/\//i, "")
      .replace(/^\*\./, "")
      .replace(/^\*/, "")
      .replace(/\/\*$/, "")
      .replace(/\*$/, ""),
  );
}

function firstHeader(headers: string[], patterns: RegExp[]) {
  return headers.find((header) => patterns.some((pattern) => pattern.test(normalizeHeader(header))));
}

function detectOverviewLayout(parsed: ParsedFile): SemrushOverviewLayout | null {
  const headers = parsed.headers;
  const keywordHeader = firstHeader(headers, [/^keyword$/, /\bkeyword\b/]);
  if (!keywordHeader) {
    return null;
  }

  const tagsHeader = firstHeader(headers, [/^tags$/, /\btag\b/]);
  const intentsHeader = firstHeader(headers, [/^intents$/, /\bintent\b/]);
  const searchVolumeHeader = firstHeader(headers, [/^search volume$/, /\bsearch volume\b/, /\bvolume\b/]);
  const cpcHeader = firstHeader(headers, [/^cpc$/, /\bcpc\b/]);
  const keywordDifficultyHeader = firstHeader(headers, [/^keyword difficulty$/, /\bkeyword difficulty\b/, /\bkd\b/]);

  const scopes = new Map<string, ScopeLayout>();

  for (const header of headers) {
    const match = header.match(DOMAIN_GROUP_RE);
    if (!match) {
      continue;
    }

    const scope = (match[1] ?? "").trim();
    const stamp = (match[2] ?? "").toLowerCase();
    const kind = (match[3] ?? "").toLowerCase();
    if (!scope) {
      continue;
    }

    const scopeLayout = scopes.get(scope) ?? { dateSlots: new Map<string, DateSlot>() };

    if (stamp === "difference") {
      scopeLayout.differenceHeader = header;
      scopes.set(scope, scopeLayout);
      continue;
    }

    if (!/^\d{8}$/.test(stamp)) {
      continue;
    }

    const dateSlot = scopeLayout.dateSlots.get(stamp) ?? {};
    if (kind === "type") {
      dateSlot.typeHeader = header;
    } else if (kind === "landing") {
      dateSlot.landingHeader = header;
    } else {
      dateSlot.rankHeader = header;
    }

    scopeLayout.dateSlots.set(stamp, dateSlot);
    scopes.set(scope, scopeLayout);
  }

  if (scopes.size === 0) {
    return null;
  }

  return {
    keywordHeader,
    tagsHeader,
    intentsHeader,
    searchVolumeHeader,
    cpcHeader,
    keywordDifficultyHeader,
    scopes,
  };
}

function parseRank(
  row: ParsedRow,
  rankHeader: string | undefined,
  rowNumber: number,
  issues: ValidationIssue[],
) {
  if (!rankHeader) {
    return null;
  }

  const raw = row[rankHeader];
  if (isNonRankingValue(raw)) {
    return null;
  }

  const rank = parseInteger(raw);
  if (rank === null || rank <= 0) {
    issues.push({
      rowNumber,
      field: rankHeader,
      code: "INVALID_RANKING_VALUE",
      message: `Invalid ranking value "${String(raw)}" in ${rankHeader}.`,
      severity: IssueSeverity.WARNING,
    });
    return null;
  }

  return rank;
}

function parseDifference(row: ParsedRow, differenceHeader: string | undefined) {
  if (!differenceHeader) {
    return null;
  }

  const raw = row[differenceHeader];
  if (isNonRankingValue(raw)) {
    return null;
  }

  return parseNumber(raw);
}

export function transformSemrushOverview(parsed: ParsedFile): SemrushOverviewTransformResult {
  const issues: ValidationIssue[] = [];
  const layout = detectOverviewLayout(parsed);

  if (!layout) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: null,
          field: null,
          code: "FAILED_HEADER_DETECTION",
          message: "Could not detect Semrush Rankings Overview domain/date header groups.",
          severity: IssueSeverity.ERROR,
        },
      ],
      layoutDetected: false,
      detectedDomains: [],
      detectedDates: [],
    };
  }

  const rows: SemrushOverviewNormalizedRow[] = [];
  const detectedDomainSet = new Set<string>();
  const detectedDateSet = new Set<string>();

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const keyword = cleanText(row[layout.keywordHeader]);
    if (!keyword) {
      return;
    }

    const tags = layout.tagsHeader ? cleanText(row[layout.tagsHeader]) : null;
    const intents = layout.intentsHeader ? cleanText(row[layout.intentsHeader]) : null;
    const searchVolume = layout.searchVolumeHeader ? parseInteger(row[layout.searchVolumeHeader]) : null;
    const cpc = layout.cpcHeader ? parseNumber(row[layout.cpcHeader]) : null;
    const keywordDifficulty = layout.keywordDifficultyHeader ? parseNumber(row[layout.keywordDifficultyHeader]) : null;

    for (const [scope, scopeLayout] of layout.scopes.entries()) {
      const domain = normalizeScopeToDomain(scope);
      if (!domain) {
        issues.push({
          rowNumber: null,
          field: scope,
          code: "MALFORMED_GROUP_HEADER",
          message: `Malformed Semrush domain group: ${scope}`,
          severity: IssueSeverity.WARNING,
        });
        continue;
      }

      detectedDomainSet.add(domain);
      const difference = parseDifference(row, scopeLayout.differenceHeader);

      for (const [stamp, slot] of scopeLayout.dateSlots.entries()) {
        const rank = parseRank(row, slot.rankHeader, rowNumber, issues);
        const rankingType = slot.typeHeader ? cleanText(row[slot.typeHeader]) : null;
        const landingUrl = slot.landingHeader ? cleanText(row[slot.landingHeader]) : null;
        const capturedAt = toIsoDate(stamp);

        detectedDateSet.add(capturedAt);
        rows.push({
          keyword,
          tags,
          intents,
          domain,
          capturedAt,
          rank,
          rankingType,
          landingUrl,
          difference,
          searchVolume,
          cpc,
          keywordDifficulty,
        });
      }
    }
  });

  return {
    rows,
    issues,
    layoutDetected: true,
    detectedDomains: [...detectedDomainSet].sort(),
    detectedDates: [...detectedDateSet].sort(),
  };
}

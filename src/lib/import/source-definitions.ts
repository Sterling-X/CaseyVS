import { ImportSourceType } from "@prisma/client";
import { SourceDefinition } from "@/lib/import/types";

export const sourceDefinitions: Record<ImportSourceType, SourceDefinition> = {
  [ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW]: {
    sourceType: ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW,
    label: "Semrush Position Tracking Rankings Overview (Wide Matrix)",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword text" },
      { key: "domain", label: "Domain", required: true, description: "Ranking domain parsed from grouped headers" },
      { key: "capturedAt", label: "Date", required: true, description: "Date parsed from grouped headers" },
      { key: "rank", label: "Rank", required: false, description: "Parsed rank (null when not ranking)" },
      { key: "rankingType", label: "Ranking Type", required: false, description: "Local/Organic or other Semrush type value" },
      { key: "landingUrl", label: "Landing URL", required: false, description: "Landing URL from overview export" },
      { key: "difference", label: "Difference", required: false, description: "Per-domain difference value when present" },
      { key: "tags", label: "Tags", required: false, description: "Keyword tags" },
      { key: "intents", label: "Intents", required: false, description: "Keyword intents" },
      { key: "searchVolume", label: "Search Volume", required: false, description: "Keyword search volume" },
      { key: "cpc", label: "CPC", required: false, description: "Keyword CPC" },
      { key: "keywordDifficulty", label: "Keyword Difficulty", required: false, description: "Keyword difficulty" },
    ],
    suggestedAliases: {
      keyword: ["keyword"],
      domain: ["domain"],
      capturedAt: ["date", "captured at"],
      rank: ["rank", "position"],
      rankingType: ["type", "ranking type"],
      landingUrl: ["landing", "landing url"],
      difference: ["difference"],
      tags: ["tags"],
      intents: ["intents"],
      searchVolume: ["search volume", "volume"],
      cpc: ["cpc"],
      keywordDifficulty: ["keyword difficulty", "kd"],
    },
  },
  [ImportSourceType.SEMRUSH_VISIBILITY]: {
    sourceType: ImportSourceType.SEMRUSH_VISIBILITY,
    label: "Semrush Position Tracking - SoLV / Visibility",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword text" },
      {
        key: "competitorDomain",
        label: "Competitor Domain",
        required: true,
        description: "Competitor domain in export",
      },
      {
        key: "visibilityScore",
        label: "Visibility / SoLV",
        required: true,
        description: "Visibility metric per competitor+keyword",
      },
      { key: "capturedAt", label: "Date", required: true, description: "Row capture date" },
      { key: "market", label: "Market", required: false, description: "Market/location" },
      { key: "position", label: "Position", required: false, description: "Ranking position" },
      {
        key: "rankingContext",
        label: "Ranking Context",
        required: false,
        description: "SERP context label",
      },
      { key: "device", label: "Device", required: false, description: "Device" },
    ],
    suggestedAliases: {
      keyword: ["keyword", "query", "key phrase", "term"],
      competitorDomain: ["competitor domain", "domain", "competitor", "url"],
      visibilityScore: [
        "visibility",
        "solv",
        "share of voice",
        "share of voice %",
        "visibility %",
        "visibility score",
      ],
      capturedAt: ["date", "captured at", "capture date", "report date"],
      market: ["market", "location", "city", "geo"],
      position: ["position", "rank", "average position"],
      rankingContext: ["context", "ranking context", "serp feature"],
      device: ["device", "platform"],
    },
  },
  [ImportSourceType.SEMRUSH_MAP_PACK]: {
    sourceType: ImportSourceType.SEMRUSH_MAP_PACK,
    label: "Semrush Position Tracking - Map Pack",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword" },
      { key: "domain", label: "Domain", required: true, description: "Ranking domain" },
      { key: "position", label: "Position", required: true, description: "Map pack position" },
      { key: "capturedAt", label: "Date", required: true, description: "Row capture date" },
      { key: "market", label: "Market", required: false, description: "Market/location" },
      { key: "device", label: "Device", required: false, description: "Device" },
    ],
    suggestedAliases: {
      keyword: ["keyword", "query", "term"],
      domain: ["domain", "url", "target"],
      position: ["position", "rank", "map position", "local pack rank"],
      capturedAt: ["date", "captured at", "capture date", "report date"],
      market: ["market", "location", "city", "geo"],
      device: ["device", "platform"],
    },
  },
  [ImportSourceType.SEMRUSH_ORGANIC]: {
    sourceType: ImportSourceType.SEMRUSH_ORGANIC,
    label: "Semrush Position Tracking - Organic SERP",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword" },
      { key: "domain", label: "Domain", required: true, description: "Ranking domain" },
      { key: "position", label: "Position", required: true, description: "Organic rank" },
      { key: "capturedAt", label: "Date", required: true, description: "Row capture date" },
      { key: "market", label: "Market", required: false, description: "Market/location" },
      { key: "device", label: "Device", required: false, description: "Device" },
      {
        key: "searchVolume",
        label: "Search Volume",
        required: false,
        description: "Optional search volume",
      },
    ],
    suggestedAliases: {
      keyword: ["keyword", "query", "term"],
      domain: ["domain", "url", "target"],
      position: ["position", "rank", "organic position"],
      capturedAt: ["date", "captured at", "capture date", "report date"],
      market: ["market", "location", "city", "geo"],
      device: ["device", "platform"],
      searchVolume: ["search volume", "volume", "sv"],
    },
  },
  [ImportSourceType.GSC_QUERY]: {
    sourceType: ImportSourceType.GSC_QUERY,
    label: "Google Search Console - Query Export",
    requiredFields: [
      { key: "query", label: "Query", required: true, description: "Search query" },
      { key: "clicks", label: "Clicks", required: true, description: "Clicks" },
      { key: "impressions", label: "Impressions", required: true, description: "Impressions" },
      { key: "ctr", label: "CTR", required: true, description: "CTR" },
      {
        key: "averagePosition",
        label: "Average Position",
        required: true,
        description: "Average position",
      },
      {
        key: "dateRangeStart",
        label: "Date Range Start",
        required: true,
        description: "Period start",
      },
      { key: "dateRangeEnd", label: "Date Range End", required: true, description: "Period end" },
    ],
    suggestedAliases: {
      query: ["query", "query text", "search term", "keyword"],
      clicks: ["clicks", "click"],
      impressions: ["impressions", "impr"],
      ctr: ["ctr", "ctr %", "click through rate"],
      averagePosition: ["position", "average position", "avg position", "avg pos"],
      dateRangeStart: ["start", "date range start", "start date", "range start"],
      dateRangeEnd: ["end", "date range end", "end date", "range end"],
    },
  },
  [ImportSourceType.GSC_PERFORMANCE_ZIP]: {
    sourceType: ImportSourceType.GSC_PERFORMANCE_ZIP,
    label: "Google Search Console Performance ZIP",
    requiredFields: [
      {
        key: "zipComponents",
        label: "ZIP Components",
        required: true,
        description: "Queries/Pages/Countries/Devices/Search appearance/Filters CSV files",
      },
    ],
    suggestedAliases: {
      zipComponents: ["zip", "queries.csv", "filters.csv"],
    },
  },
};

export function getSourceDefinition(sourceType: ImportSourceType) {
  return sourceDefinitions[sourceType];
}

export function autoDetectMapping(sourceType: ImportSourceType, headers: string[]) {
  const definition = getSourceDefinition(sourceType);
  const headerLookup = headers.map((header) => {
    const normalized = header.trim().toLowerCase();
    const canonical = normalized.replace(/[^a-z0-9]+/g, "");
    const tokens = normalized.split(/[^a-z0-9]+/g).filter(Boolean);
    return { original: header, normalized, canonical, tokens };
  });

  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  const toNormalized = (value: string) => value.trim().toLowerCase();
  const toCanonical = (value: string) => toNormalized(value).replace(/[^a-z0-9]+/g, "");
  const toTokens = (value: string) => toNormalized(value).split(/[^a-z0-9]+/g).filter(Boolean);

  const isMatch = (header: (typeof headerLookup)[number], alias: string) => {
    const aliasNormalized = toNormalized(alias);
    const aliasCanonical = toCanonical(alias);
    const aliasTokens = toTokens(alias);

    if (header.normalized === aliasNormalized || header.canonical === aliasCanonical) {
      return true;
    }

    if (aliasNormalized.length >= 4 && header.normalized.includes(aliasNormalized)) {
      return true;
    }

    if (header.normalized.length >= 4 && aliasNormalized.includes(header.normalized)) {
      return true;
    }

    return aliasTokens.length > 0 && aliasTokens.every((token) => header.tokens.includes(token));
  };

  for (const field of definition.requiredFields) {
    const candidates = [field.key, ...(definition.suggestedAliases[field.key] ?? [])];
    for (const alias of candidates) {
      const match = headerLookup.find(
        (header) => !usedHeaders.has(header.original) && isMatch(header, alias),
      );
      if (match) {
        mapping[field.key] = match.original;
        usedHeaders.add(match.original);
        break;
      }
    }
  }

  return mapping;
}

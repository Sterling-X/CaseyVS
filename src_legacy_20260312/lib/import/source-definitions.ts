import { ImportSourceType } from "@prisma/client";
import { SourceDefinition } from "@/lib/import/types";

export const sourceDefinitions: Record<ImportSourceType, SourceDefinition> = {
  [ImportSourceType.SEMRUSH_VISIBILITY]: {
    sourceType: ImportSourceType.SEMRUSH_VISIBILITY,
    label: "Semrush Position Tracking - SoLV/Visibility",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword text" },
      {
        key: "competitorDomain",
        label: "Competitor Domain",
        required: true,
        description: "Competitor or tracked domain",
      },
      {
        key: "visibilityScore",
        label: "Visibility / SoLV",
        required: true,
        description: "Visibility metric for the keyword and competitor",
      },
      { key: "capturedAt", label: "Date", required: true, description: "Record capture date" },
      { key: "market", label: "Market", required: false, description: "Market/geography" },
      {
        key: "position",
        label: "Position",
        required: false,
        description: "Optional ranking position",
      },
      {
        key: "rankingContext",
        label: "Ranking Context",
        required: false,
        description: "Optional ranking context or engine",
      },
      { key: "device", label: "Device", required: false, description: "Desktop/mobile if available" },
    ],
    suggestedAliases: {
      keyword: ["keyword", "key phrase", "query", "term"],
      competitorDomain: ["domain", "competitor", "competitor domain", "url"],
      visibilityScore: ["visibility", "solv", "share of voice", "% visibility"],
      capturedAt: ["date", "captured at", "report date", "month"],
      market: ["market", "location", "city", "geo"],
      position: ["position", "rank", "avg position"],
      rankingContext: ["context", "ranking context", "serp feature"],
      device: ["device", "platform"],
    },
  },
  [ImportSourceType.SEMRUSH_MAP_PACK]: {
    sourceType: ImportSourceType.SEMRUSH_MAP_PACK,
    label: "Semrush Position Tracking - Map Pack",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword text" },
      { key: "domain", label: "Domain", required: true, description: "Tracked domain" },
      { key: "position", label: "Position", required: true, description: "Map pack ranking position" },
      { key: "capturedAt", label: "Date", required: true, description: "Record capture date" },
      { key: "market", label: "Market", required: false, description: "Market/geography" },
      { key: "device", label: "Device", required: false, description: "Desktop/mobile if available" },
    ],
    suggestedAliases: {
      keyword: ["keyword", "query", "term"],
      domain: ["domain", "url", "target"],
      position: ["position", "rank", "map position", "local pack rank"],
      capturedAt: ["date", "captured at", "report date", "month"],
      market: ["market", "location", "city", "geo"],
      device: ["device", "platform"],
    },
  },
  [ImportSourceType.SEMRUSH_ORGANIC]: {
    sourceType: ImportSourceType.SEMRUSH_ORGANIC,
    label: "Semrush Position Tracking - Organic SERP",
    requiredFields: [
      { key: "keyword", label: "Keyword", required: true, description: "Tracked keyword text" },
      { key: "domain", label: "Domain", required: true, description: "Tracked domain" },
      { key: "position", label: "Position", required: true, description: "Organic ranking position" },
      { key: "capturedAt", label: "Date", required: true, description: "Record capture date" },
      { key: "market", label: "Market", required: false, description: "Market/geography" },
      { key: "device", label: "Device", required: false, description: "Desktop/mobile if available" },
    ],
    suggestedAliases: {
      keyword: ["keyword", "query", "term"],
      domain: ["domain", "url", "target"],
      position: ["position", "rank", "organic position"],
      capturedAt: ["date", "captured at", "report date", "month"],
      market: ["market", "location", "city", "geo"],
      device: ["device", "platform"],
    },
  },
  [ImportSourceType.GSC_QUERY]: {
    sourceType: ImportSourceType.GSC_QUERY,
    label: "Google Search Console - Query Export",
    requiredFields: [
      { key: "query", label: "Query", required: true, description: "Search query text" },
      { key: "clicks", label: "Clicks", required: true, description: "Clicks" },
      { key: "impressions", label: "Impressions", required: true, description: "Impressions" },
      { key: "ctr", label: "CTR", required: true, description: "Click-through rate" },
      { key: "averagePosition", label: "Average Position", required: true, description: "Average position" },
      { key: "dateRangeStart", label: "Date Range Start", required: true, description: "Start date" },
      { key: "dateRangeEnd", label: "Date Range End", required: true, description: "End date" },
    ],
    suggestedAliases: {
      query: ["query", "search term", "keyword"],
      clicks: ["clicks", "click"],
      impressions: ["impressions", "impr"],
      ctr: ["ctr", "click through rate"],
      averagePosition: ["position", "avg position", "average position"],
      dateRangeStart: ["start", "date range start", "from"],
      dateRangeEnd: ["end", "date range end", "to"],
    },
  },
};

export function getSourceDefinition(sourceType: ImportSourceType) {
  return sourceDefinitions[sourceType];
}

export function autoDetectMapping(sourceType: ImportSourceType, headers: string[]) {
  const definition = getSourceDefinition(sourceType);
  const normalizedHeaders = headers.reduce<Record<string, string>>((acc, header) => {
    acc[header.trim().toLowerCase()] = header;
    return acc;
  }, {});

  const mapping: Record<string, string> = {};

  for (const field of definition.requiredFields) {
    const aliases = [field.key, ...(definition.suggestedAliases[field.key] ?? [])];

    for (const alias of aliases) {
      const candidate = normalizedHeaders[alias.trim().toLowerCase()];
      if (candidate) {
        mapping[field.key] = candidate;
        break;
      }
    }
  }

  return mapping;
}

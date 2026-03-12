import { ImportSourceType } from "@prisma/client";
import { ParsedFile, ParsedRow } from "@/lib/import/types";
import { parseInteger } from "@/lib/utils";

type HeaderSlot = {
  valueHeader?: string;
  typeHeader?: string;
  landingHeader?: string;
};

type ScopeSlots = Map<string, HeaderSlot>;

type OverviewLayout = {
  scopeToDateSlots: Map<string, ScopeSlots>;
  dates: string[];
};

const DOMAIN_DATE_RE = /^(.+)_(\d{8}|difference)(?:_(type|landing))?$/i;

function normalizeDomainFromScope(scope: string) {
  const raw = scope
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^\*\./, "")
    .replace(/^\*/, "")
    .replace(/\/\*$/, "")
    .replace(/\*$/, "")
    .replace(/^www\./, "");

  const firstPath = raw.split("/")[0] ?? raw;
  return firstPath.toLowerCase();
}

function toIsoDate(stamp: string) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  const text = String(value).trim().toLowerCase();
  return text === "" || text === "-" || text === "n/a" || text === "na";
}

function parseOverviewLayout(headers: string[]): OverviewLayout | null {
  const scopeToDateSlots: Map<string, ScopeSlots> = new Map();
  const dateSet = new Set<string>();

  for (const header of headers) {
    const match = header.match(DOMAIN_DATE_RE);
    if (!match) {
      continue;
    }

    const scope = (match[1] ?? "").trim();
    const stamp = (match[2] ?? "").toLowerCase();
    const kind = match[3]?.toLowerCase();

    if (!scope || !/^\d{8}$/.test(stamp)) {
      continue;
    }

    dateSet.add(stamp);
    const dateSlots = scopeToDateSlots.get(scope) ?? new Map<string, HeaderSlot>();
    const slot = dateSlots.get(stamp) ?? {};

    if (kind === "type") {
      slot.typeHeader = header;
    } else if (kind === "landing") {
      slot.landingHeader = header;
    } else {
      slot.valueHeader = header;
    }

    dateSlots.set(stamp, slot);
    scopeToDateSlots.set(scope, dateSlots);
  }

  if (scopeToDateSlots.size === 0 || dateSet.size === 0) {
    return null;
  }

  return {
    scopeToDateSlots,
    dates: [...dateSet].sort(),
  };
}

function chooseActiveDate(stamps: string[], reportingMonth: Date) {
  const reportMonthKey = `${reportingMonth.getUTCFullYear()}${String(reportingMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthMatches = stamps.filter((stamp) => stamp.slice(0, 6) === reportMonthKey);

  if (monthMatches.length > 0) {
    return monthMatches[monthMatches.length - 1];
  }

  return stamps[stamps.length - 1] ?? null;
}

function normalizeType(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

function pickKeywordColumn(headers: string[]) {
  return headers.find((header) => header.toLowerCase() === "keyword") ?? headers.find((header) => header.toLowerCase().includes("keyword"));
}

function pickSearchVolumeColumn(headers: string[]) {
  return headers.find((header) => header.toLowerCase() === "search volume") ?? headers.find((header) => header.toLowerCase().includes("search volume"));
}

export function transformSemrushOverviewIfApplicable(
  sourceType: ImportSourceType,
  parsed: ParsedFile,
  reportingMonth: Date,
): ParsedFile {
  if (sourceType !== ImportSourceType.SEMRUSH_ORGANIC && sourceType !== ImportSourceType.SEMRUSH_MAP_PACK) {
    return parsed;
  }

  const layout = parseOverviewLayout(parsed.headers);
  if (!layout) {
    return parsed;
  }

  const keywordColumn = pickKeywordColumn(parsed.headers);
  if (!keywordColumn) {
    return parsed;
  }

  const searchVolumeColumn = pickSearchVolumeColumn(parsed.headers);
  const activeStamp = chooseActiveDate(layout.dates, reportingMonth);
  if (!activeStamp) {
    return parsed;
  }

  const capturedAt = toIsoDate(activeStamp);
  const transformedRows: ParsedRow[] = [];

  for (const row of parsed.rows) {
    const keywordRaw = row[keywordColumn];
    const keyword = keywordRaw === null || keywordRaw === undefined ? "" : String(keywordRaw).trim();
    if (!keyword) {
      continue;
    }

    for (const [scope, dateSlots] of layout.scopeToDateSlots.entries()) {
      const slot = dateSlots.get(activeStamp);
      if (!slot?.valueHeader) {
        continue;
      }

      const positionRaw = row[slot.valueHeader];
      if (isEmptyValue(positionRaw)) {
        continue;
      }

      const position = parseInteger(positionRaw);
      if (position === null || position <= 0) {
        continue;
      }

      const rankingType = normalizeType(slot.typeHeader ? row[slot.typeHeader] : null);
      const domain = normalizeDomainFromScope(scope);

      if (sourceType === ImportSourceType.SEMRUSH_ORGANIC && rankingType !== "organic") {
        continue;
      }

      if (sourceType === ImportSourceType.SEMRUSH_MAP_PACK && rankingType !== "local") {
        continue;
      }

      const base = {
        keyword,
        capturedAt,
        position,
        market: null,
        device: null,
      } as ParsedRow;

      transformedRows.push({
        ...base,
        domain,
        ...(sourceType === ImportSourceType.SEMRUSH_ORGANIC
          ? {
              searchVolume: searchVolumeColumn ? row[searchVolumeColumn] : null,
              rankingContext: rankingType || null,
              landingUrl: slot.landingHeader ? row[slot.landingHeader] : null,
            }
          : {
              rankingContext: rankingType || null,
              landingUrl: slot.landingHeader ? row[slot.landingHeader] : null,
            }),
      });
    }
  }

  if (transformedRows.length === 0) {
    return parsed;
  }

  if (sourceType === ImportSourceType.SEMRUSH_ORGANIC) {
    return {
      headers: ["keyword", "domain", "position", "capturedAt", "market", "device", "searchVolume", "rankingContext", "landingUrl"],
      rows: transformedRows,
    };
  }

  if (sourceType === ImportSourceType.SEMRUSH_MAP_PACK) {
    return {
      headers: ["keyword", "domain", "position", "capturedAt", "market", "device", "rankingContext", "landingUrl"],
      rows: transformedRows,
    };
  }

  return parsed;
}

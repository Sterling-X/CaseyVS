import { IssueSeverity } from "@prisma/client";
import JSZip from "jszip";
import { parseCsvContent } from "@/lib/import/file-parser";
import { ParsedFile, ParsedRow, ValidationIssue } from "@/lib/import/types";
import { normalizeText, parseInteger, parseNumber } from "@/lib/utils";

type MetricColumns = {
  currentClicks?: string;
  previousClicks?: string;
  currentImpressions?: string;
  previousImpressions?: string;
  currentCtr?: string;
  previousCtr?: string;
  currentPosition?: string;
  previousPosition?: string;
};

type GscDimensionRow = {
  dimension: string;
  currentClicks: number;
  previousClicks: number;
  currentImpressions: number;
  previousImpressions: number;
  currentCtr: number | null;
  previousCtr: number | null;
  currentPosition: number | null;
  previousPosition: number | null;
};

export type GscZipNormalized = {
  queries: GscDimensionRow[];
  pages: GscDimensionRow[];
  countries: GscDimensionRow[];
  devices: GscDimensionRow[];
  appearances: GscDimensionRow[];
  importMeta: {
    searchType: string | null;
    dateRangeLabel: string | null;
    currentRangeLabel: string | null;
    previousRangeLabel: string | null;
    filters: Record<string, string>;
    rawFiltersRows: ParsedRow[];
  };
  issues: ValidationIssue[];
  filePresence: {
    queries: boolean;
    pages: boolean;
    countries: boolean;
    devices: boolean;
    searchAppearance: boolean;
    filters: boolean;
  };
};

function normalizeZipPath(path: string) {
  return normalizeText(path).replace(/\\/g, "/");
}

function findFileBySuffix(files: Record<string, JSZip.JSZipObject>, suffix: string) {
  const normalizedSuffix = normalizeText(suffix);
  for (const [path, object] of Object.entries(files)) {
    if (object.dir) {
      continue;
    }

    const normalizedPath = normalizeZipPath(path);
    if (normalizedPath.endsWith(normalizedSuffix)) {
      return object;
    }
  }

  return null;
}

async function loadCsvFromZip(
  zipFiles: Record<string, JSZip.JSZipObject>,
  suffix: string,
): Promise<ParsedFile | null> {
  const file = findFileBySuffix(zipFiles, suffix);
  if (!file) {
    return null;
  }

  const content = await file.async("string");
  return parseCsvContent(content);
}

function isMetricHeader(header: string) {
  const text = normalizeText(header);
  return (
    /click|impression|ctr|position/.test(text) ||
    /(last|previous|current|difference)\s+\d*/.test(text)
  );
}

function detectDimensionHeader(headers: string[]) {
  const firstNonMetric = headers.find((header) => !isMetricHeader(header));
  return firstNonMetric ?? headers[0];
}

function findHeader(headers: string[], patterns: RegExp[]) {
  return headers.find((header) => patterns.some((pattern) => pattern.test(normalizeText(header))));
}

function detectMetricColumns(headers: string[]): MetricColumns {
  return {
    currentClicks: findHeader(headers, [/\blast\b.*\bclick/, /\bcurrent\b.*\bclick/, /^clicks$/]),
    previousClicks: findHeader(headers, [/\bprevious\b.*\bclick/, /\bprior\b.*\bclick/]),
    currentImpressions: findHeader(headers, [/\blast\b.*\bimpression/, /\bcurrent\b.*\bimpression/, /^impressions$/]),
    previousImpressions: findHeader(headers, [/\bprevious\b.*\bimpression/, /\bprior\b.*\bimpression/]),
    currentCtr: findHeader(headers, [/\blast\b.*\bctr/, /\bcurrent\b.*\bctr/, /^ctr$/]),
    previousCtr: findHeader(headers, [/\bprevious\b.*\bctr/, /\bprior\b.*\bctr/]),
    currentPosition: findHeader(headers, [/\blast\b.*\bposition/, /\bcurrent\b.*\bposition/, /^position$/]),
    previousPosition: findHeader(headers, [/\bprevious\b.*\bposition/, /\bprior\b.*\bposition/]),
  };
}

function getNumeric(row: ParsedRow, header: string | undefined) {
  if (!header) {
    return 0;
  }

  return parseInteger(row[header]) ?? 0;
}

function getFloat(row: ParsedRow, header: string | undefined) {
  if (!header) {
    return null;
  }

  const value = row[header];
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  return parseNumber(value);
}

function toDimensionRows(parsed: ParsedFile, issues: ValidationIssue[]): GscDimensionRow[] {
  if (parsed.headers.length === 0) {
    return [];
  }

  const dimensionHeader = detectDimensionHeader(parsed.headers);
  const metricColumns = detectMetricColumns(parsed.headers);

  if (!metricColumns.currentClicks && !metricColumns.currentImpressions) {
    issues.push({
      rowNumber: null,
      field: dimensionHeader,
      code: "MISSING_IMPORT_METADATA",
      message: `Could not detect current-period metric columns for ${dimensionHeader}.`,
      severity: IssueSeverity.WARNING,
    });
  }

  return parsed.rows
    .map((row) => {
      const dimension = String(row[dimensionHeader] ?? "").trim();
      if (!dimension) {
        return null;
      }

      return {
        dimension,
        currentClicks: getNumeric(row, metricColumns.currentClicks),
        previousClicks: getNumeric(row, metricColumns.previousClicks),
        currentImpressions: getNumeric(row, metricColumns.currentImpressions),
        previousImpressions: getNumeric(row, metricColumns.previousImpressions),
        currentCtr: getFloat(row, metricColumns.currentCtr),
        previousCtr: getFloat(row, metricColumns.previousCtr),
        currentPosition: getFloat(row, metricColumns.currentPosition),
        previousPosition: getFloat(row, metricColumns.previousPosition),
      };
    })
    .filter((item): item is GscDimensionRow => item !== null);
}

function parseFilters(parsed: ParsedFile | null) {
  const rows = parsed?.rows ?? [];
  const filters: Record<string, string> = {};

  for (const row of rows) {
    const values = Object.values(row).map((value) => String(value ?? "").trim()).filter(Boolean);
    if (values.length === 0) {
      continue;
    }

    if (values.length === 1) {
      const value = values[0];
      const splitIndex = value.indexOf(":");
      if (splitIndex > 0) {
        const key = value.slice(0, splitIndex).trim();
        const text = value.slice(splitIndex + 1).trim();
        if (key && text) {
          filters[key] = text;
        }
      }
      continue;
    }

    const key = values[0];
    const text = values.slice(1).join(" ").trim();
    if (key && text) {
      filters[key] = text;
    }
  }

  const searchType =
    filters["Search type"] ??
    filters["Search Type"] ??
    filters["Type"] ??
    null;

  const dateRangeLabel =
    filters["Date"] ??
    filters["Date range"] ??
    filters["Date Range"] ??
    null;

  const currentRangeLabel =
    filters["Current period"] ??
    filters["Last"] ??
    null;

  const previousRangeLabel =
    filters["Previous period"] ??
    filters["Previous"] ??
    null;

  return {
    searchType,
    dateRangeLabel,
    currentRangeLabel,
    previousRangeLabel,
    filters,
    rawFiltersRows: rows,
  };
}

export async function parseGscPerformanceZip(buffer: Buffer): Promise<GscZipNormalized> {
  const zip = await JSZip.loadAsync(buffer);
  const issues: ValidationIssue[] = [];
  const files = zip.files;

  const [queriesParsed, pagesParsed, countriesParsed, devicesParsed, appearanceParsed, filtersParsed] =
    await Promise.all([
      loadCsvFromZip(files, "queries.csv"),
      loadCsvFromZip(files, "pages.csv"),
      loadCsvFromZip(files, "countries.csv"),
      loadCsvFromZip(files, "devices.csv"),
      loadCsvFromZip(files, "search appearance.csv"),
      loadCsvFromZip(files, "filters.csv"),
    ]);

  const presence = {
    queries: Boolean(queriesParsed),
    pages: Boolean(pagesParsed),
    countries: Boolean(countriesParsed),
    devices: Boolean(devicesParsed),
    searchAppearance: Boolean(appearanceParsed),
    filters: Boolean(filtersParsed),
  };

  if (!presence.queries) {
    issues.push({
      rowNumber: null,
      field: "Queries.csv",
      code: "MISSING_GSC_COMPONENT",
      message: "GSC ZIP is missing Queries.csv.",
      severity: IssueSeverity.ERROR,
    });
  }

  for (const [key, exists] of Object.entries(presence)) {
    if (!exists) {
      issues.push({
        rowNumber: null,
        field: key,
        code: "MISSING_GSC_COMPONENT",
        message: `GSC ZIP component missing: ${key}`,
        severity: key === "queries" ? IssueSeverity.ERROR : IssueSeverity.WARNING,
      });
    }
  }

  return {
    queries: queriesParsed ? toDimensionRows(queriesParsed, issues) : [],
    pages: pagesParsed ? toDimensionRows(pagesParsed, issues) : [],
    countries: countriesParsed ? toDimensionRows(countriesParsed, issues) : [],
    devices: devicesParsed ? toDimensionRows(devicesParsed, issues) : [],
    appearances: appearanceParsed ? toDimensionRows(appearanceParsed, issues) : [],
    importMeta: parseFilters(filtersParsed),
    issues,
    filePresence: presence,
  };
}

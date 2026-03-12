import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ParsedFile, ParsedRow } from "@/lib/import/types";

const DELIMITER_CANDIDATES = [",", ";", "\t", "|"] as const;

function sanitizeRow(row: Record<string, unknown>) {
  const normalized: ParsedRow = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === "__parsed_extra") {
      continue;
    }

    if (value === undefined || value === null) {
      normalized[key] = null;
      continue;
    }

    if (typeof value === "number") {
      normalized[key] = value;
      continue;
    }

    normalized[key] = String(value).trim();
  }

  return normalized;
}

function finalize(headers: string[], rows: ParsedRow[]): ParsedFile {
  const filteredRows = rows.filter((row) =>
    Object.values(row).some((value) => value !== null && value !== ""),
  );

  return {
    headers: headers.map((header) => header.trim()).filter(Boolean),
    rows: filteredRows,
  };
}

function isDelimiterDetectionError(error: Papa.ParseError) {
  return (
    error.code === "UndetectableDelimiter" ||
    error.message.toLowerCase().includes("auto-detect delimiting character")
  );
}

function isFieldMismatchError(error: Papa.ParseError) {
  return (
    error.type === "FieldMismatch" ||
    error.code === "TooManyFields" ||
    error.code === "TooFewFields" ||
    /too many fields|too few fields/i.test(error.message)
  );
}

function parseWithHeader(content: string, delimiter?: string) {
  return Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    ...(delimiter ? { delimiter } : {}),
    transformHeader: (header) => header.trim(),
  });
}

function pickBestHeaderParse(content: string) {
  const attempts = [
    parseWithHeader(content),
    ...DELIMITER_CANDIDATES.map((delimiter) => parseWithHeader(content, delimiter)),
  ];

  let best = attempts[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const attempt of attempts) {
    const fields = attempt.meta.fields?.length ?? 0;
    const totalErrors = attempt.errors.length;
    const fatalErrors = attempt.errors.filter(
      (error) => !isFieldMismatchError(error) && !isDelimiterDetectionError(error),
    ).length;
    const score = fields * 1000 - fatalErrors * 200 - totalErrors * 3;

    if (score > bestScore) {
      bestScore = score;
      best = attempt;
    }
  }

  return best;
}

function makeUniqueHeaders(rawHeaders: string[]) {
  const seen = new Map<string, number>();
  const result: string[] = [];

  for (let index = 0; index < rawHeaders.length; index += 1) {
    const base = rawHeaders[index]?.trim() || `column_${index + 1}`;
    const normalized = base.toLowerCase();
    const nextCount = (seen.get(normalized) ?? 0) + 1;
    seen.set(normalized, nextCount);
    result.push(nextCount > 1 ? `${base}_${nextCount}` : base);
  }

  return result;
}

function inferHeaderIndex(rows: string[][]) {
  const limit = Math.min(rows.length - 1, 50);
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < limit; index += 1) {
    const current = rows[index].map((value) => String(value ?? "").trim());
    const next = rows[index + 1].map((value) => String(value ?? "").trim());
    const currentNonEmpty = current.filter(Boolean);
    const nextNonEmpty = next.filter(Boolean);

    if (currentNonEmpty.length < 2 || nextNonEmpty.length < 2) {
      continue;
    }

    const shapeRatio = Math.min(currentNonEmpty.length, nextNonEmpty.length) / Math.max(currentNonEmpty.length, nextNonEmpty.length);
    const alphaCount = currentNonEmpty.filter((value) => /[a-zA-Z]/.test(value)).length;
    const uniqueCount = new Set(currentNonEmpty.map((value) => value.toLowerCase())).size;
    const score = currentNonEmpty.length * 5 + shapeRatio * 10 + alphaCount + uniqueCount * 0.5 - index * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function parseByInferredHeader(content: string): ParsedFile | null {
  let best: ParsedFile | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const parsed = Papa.parse<string[]>(content, {
      header: false,
      delimiter,
      skipEmptyLines: true,
    });

    const rows = parsed.data.map((row) => row.map((value) => String(value ?? "").trim()));
    const headerIndex = inferHeaderIndex(rows);
    if (headerIndex < 0) {
      continue;
    }

    const headers = makeUniqueHeaders(rows[headerIndex]);
    if (headers.length < 2) {
      continue;
    }

    const dataRows: ParsedRow[] = rows.slice(headerIndex + 1).map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx] ?? null;
      });
      return sanitizeRow(record);
    });

    const candidate = finalize(headers, dataRows);
    const score = candidate.headers.length * 1000 + candidate.rows.length - parsed.errors.length * 5 - headerIndex;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function parseCsvContent(content: string): ParsedFile {
  const bestHeaderParse = pickBestHeaderParse(content);
  const headers = bestHeaderParse.meta.fields ?? [];
  const fatalErrors = bestHeaderParse.errors.filter(
    (error) => !isFieldMismatchError(error) && !isDelimiterDetectionError(error),
  );

  // Use standard header parsing when it produces useful columns and no fatal errors.
  if (headers.length > 1 && fatalErrors.length === 0) {
    const rows = bestHeaderParse.data.map((row) => sanitizeRow(row));
    return finalize(headers, rows);
  }

  // Fall back to detecting header row from raw CSV arrays. This handles
  // vendor exports with preamble lines above the real header.
  const inferred = parseByInferredHeader(content);
  if (inferred) {
    return inferred;
  }

  const firstError = fatalErrors[0] ?? bestHeaderParse.errors[0];
  if (firstError) {
    throw new Error(`CSV parse error at row ${firstError.row ?? "unknown"}: ${firstError.message}`);
  }

  throw new Error("CSV parse error: could not detect a valid header row.");
}

export function parseXlsxBuffer(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("XLSX file does not contain a worksheet.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: false,
  });

  if (data.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((row) => sanitizeRow(row));
  return finalize(headers, rows);
}

export async function parseUploadFile(file: File): Promise<ParsedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv") || file.type.includes("csv")) {
    return parseCsvContent(buffer.toString("utf8"));
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || file.type.includes("sheet")) {
    return parseXlsxBuffer(buffer);
  }

  throw new Error("Unsupported file type. Upload CSV or XLSX.");
}

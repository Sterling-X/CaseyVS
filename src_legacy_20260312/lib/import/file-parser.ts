import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ParsedFile, ParsedRow } from "@/lib/import/types";

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

export function parseCsvContent(content: string): ParsedFile {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    throw new Error(`CSV parse error at row ${firstError.row ?? "unknown"}: ${firstError.message}`);
  }

  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data.map((row) => sanitizeRow(row));
  return finalize(headers, rows);
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

import { ImportSourceType } from "@prisma/client";
import { ZodError } from "zod";
import {
  gscQuerySchema,
  semrushMapPackSchema,
  semrushOrganicSchema,
  semrushVisibilitySchema,
} from "@/lib/import/schemas";
import { getSourceDefinition } from "@/lib/import/source-definitions";
import { ColumnMapping, ParsedRow, PreviewResult, ValidationIssue } from "@/lib/import/types";

function getValue(row: ParsedRow, columnName: string | undefined) {
  if (!columnName) {
    return undefined;
  }

  return row[columnName] ?? undefined;
}

function mapRow(row: ParsedRow, mapping: ColumnMapping) {
  const normalized: Record<string, unknown> = {};

  for (const [targetField, sourceColumn] of Object.entries(mapping)) {
    normalized[targetField] = getValue(row, sourceColumn);
  }

  return normalized;
}

function toIssues(error: ZodError, rowNumber: number): ValidationIssue[] {
  return error.issues.map((issue) => ({
    rowNumber,
    field: issue.path[0] ? String(issue.path[0]) : null,
    message: issue.message,
    severity: "ERROR",
  }));
}

function getSchema(sourceType: ImportSourceType) {
  switch (sourceType) {
    case ImportSourceType.SEMRUSH_VISIBILITY:
      return semrushVisibilitySchema;
    case ImportSourceType.SEMRUSH_MAP_PACK:
      return semrushMapPackSchema;
    case ImportSourceType.SEMRUSH_ORGANIC:
      return semrushOrganicSchema;
    case ImportSourceType.GSC_QUERY:
      return gscQuerySchema;
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

export function validateMapping(sourceType: ImportSourceType, mapping: ColumnMapping) {
  const definition = getSourceDefinition(sourceType);
  const issues: ValidationIssue[] = [];

  for (const field of definition.requiredFields) {
    if (!field.required) {
      continue;
    }

    const mapped = mapping[field.key];
    if (!mapped) {
      issues.push({
        rowNumber: null,
        field: field.key,
        message: `Missing mapping for required field: ${field.label}`,
        severity: "ERROR",
      });
    }
  }

  return issues;
}

export function previewMappedRows(
  sourceType: ImportSourceType,
  rows: ParsedRow[],
  mapping: ColumnMapping,
): PreviewResult<Record<string, unknown>> {
  const mappingIssues = validateMapping(sourceType, mapping);
  if (mappingIssues.some((issue) => issue.severity === "ERROR")) {
    return {
      rows: [],
      issues: mappingIssues,
    };
  }

  const schema = getSchema(sourceType);
  const issues: ValidationIssue[] = [...mappingIssues];
  const transformedRows: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const mapped = mapRow(row, mapping);
    const parsed = schema.safeParse(mapped);

    if (!parsed.success) {
      issues.push(...toIssues(parsed.error, index + 2));
      transformedRows.push(mapped);
      return;
    }

    transformedRows.push(parsed.data as unknown as Record<string, unknown>);
  });

  return {
    rows: transformedRows,
    issues,
  };
}

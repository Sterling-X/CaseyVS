import { ImportSourceType, IssueSeverity } from "@prisma/client";
import { ZodError } from "zod";
import {
  gscQuerySchema,
  semrushMapPackSchema,
  semrushOverviewSchema,
  semrushOrganicSchema,
  semrushVisibilitySchema,
} from "@/lib/import/schemas";
import { getSourceDefinition } from "@/lib/import/source-definitions";
import { ColumnMapping, ParsedRow, PreviewResult, ValidationIssue } from "@/lib/import/types";

function getValue(row: ParsedRow, sourceColumn: string | undefined) {
  if (!sourceColumn) {
    return undefined;
  }

  return row[sourceColumn] ?? undefined;
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
    field: issue.path.length ? String(issue.path[0]) : null,
    code: "SCHEMA_VALIDATION",
    message: issue.message,
    severity: IssueSeverity.ERROR,
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
    case ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW:
      return semrushOverviewSchema;
    case ImportSourceType.GSC_PERFORMANCE_ZIP:
      throw new Error("GSC ZIP imports do not use column mapping preview.");
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

export function validateMapping(sourceType: ImportSourceType, mapping: ColumnMapping) {
  const definition = getSourceDefinition(sourceType);
  const issues: ValidationIssue[] = [];

  for (const field of definition.requiredFields) {
    if (field.required && !mapping[field.key]) {
      issues.push({
        rowNumber: null,
        field: field.key,
        code: "MISSING_REQUIRED_MAPPING",
        message: `Missing mapping for required field: ${field.label}`,
        severity: IssueSeverity.ERROR,
      });
    }
  }

  const usedSources = Object.values(mapping);
  const hasDuplicateSourceMappings = usedSources.length !== new Set(usedSources).size;
  if (hasDuplicateSourceMappings) {
    issues.push({
      rowNumber: null,
      field: null,
      code: "DUPLICATE_SOURCE_MAPPING",
      message: "A source column is mapped to multiple target fields.",
      severity: IssueSeverity.WARNING,
    });
  }

  return issues;
}

export function previewMappedRows(
  sourceType: ImportSourceType,
  rows: ParsedRow[],
  mapping: ColumnMapping,
): PreviewResult<Record<string, unknown>> {
  const mappingIssues = validateMapping(sourceType, mapping);
  if (mappingIssues.some((issue) => issue.severity === IssueSeverity.ERROR)) {
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

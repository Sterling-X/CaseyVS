import { ImportSourceType } from "@prisma/client";

export type ParsedRow = Record<string, string | number | null>;

export type ParsedFile = {
  headers: string[];
  rows: ParsedRow[];
};

export type ColumnMapping = Record<string, string>;

export type RequiredFieldDefinition = {
  key: string;
  label: string;
  required: boolean;
  description: string;
};

export type SourceDefinition = {
  sourceType: ImportSourceType;
  label: string;
  requiredFields: RequiredFieldDefinition[];
  suggestedAliases: Record<string, string[]>;
};

export type ValidationIssue = {
  rowNumber: number | null;
  field: string | null;
  message: string;
  severity: "ERROR" | "WARNING" | "INFO";
};

export type PreviewResult<T extends Record<string, unknown>> = {
  rows: T[];
  issues: ValidationIssue[];
};

export type CommitImportInput = {
  projectId: string;
  sourceType: ImportSourceType;
  fileName: string;
  reportingMonth: Date;
  uploadDate: Date;
  parsed: ParsedFile;
  mapping: ColumnMapping;
  mappingProfileId?: string;
  replaceExisting?: boolean;
  saveMappingProfileName?: string;
};

export type ImportPreviewRequest = {
  sourceType: ImportSourceType;
  rows: ParsedRow[];
  mapping: ColumnMapping;
};

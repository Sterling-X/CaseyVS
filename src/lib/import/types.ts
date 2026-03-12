import { ImportSourceType, IssueSeverity } from "@prisma/client";

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
  code: string;
  message: string;
  severity: IssueSeverity;
};

export type SemrushVisibilityNormalizedRow = {
  keyword: string;
  competitorDomain: string;
  visibilityScore: number;
  capturedAt: string;
  market?: string;
  position?: number;
  rankingContext?: string;
  device?: string;
};

export type SemrushMapPackNormalizedRow = {
  keyword: string;
  domain: string;
  position: number;
  capturedAt: string;
  market?: string;
  device?: string;
};

export type SemrushOrganicNormalizedRow = {
  keyword: string;
  domain: string;
  position: number;
  capturedAt: string;
  market?: string;
  device?: string;
  searchVolume?: number;
};

export type SemrushOverviewNormalizedRow = {
  keyword: string;
  tags?: string | null;
  intents?: string | null;
  domain: string;
  capturedAt: string;
  rank?: number | null;
  rankingType?: string | null;
  landingUrl?: string | null;
  difference?: number | null;
  searchVolume?: number | null;
  cpc?: number | null;
  keywordDifficulty?: number | null;
};

export type GscQueryNormalizedRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  averagePosition?: number;
  dateRangeStart: string;
  dateRangeEnd: string;
};

export type GscDimensionNormalizedRow = {
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

export type PreviewResult<T> = {
  rows: T[];
  issues: ValidationIssue[];
};

export type CommitImportInput = {
  projectId: string;
  sourceType: ImportSourceType;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  rawContent?: string;
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

// Core domain types matching the Prisma schema
// These are used throughout the app for type safety

export type ImportSourceType =
  | 'SEMRUSH_VISIBILITY'
  | 'SEMRUSH_MAP_PACK'
  | 'SEMRUSH_ORGANIC'
  | 'GSC_QUERIES'

export type ImportStatus =
  | 'PENDING'
  | 'MAPPING'
  | 'VALIDATING'
  | 'COMMITTED'
  | 'FAILED'
  | 'REPLACED'

export type KeywordType = 'LOCAL' | 'CORE' | 'BRANDED' | 'OTHER'

export type QAIssueType =
  | 'UNMAPPED_KEYWORD'
  | 'MISSING_REQUIRED_FIELD'
  | 'DUPLICATE_KEYWORD'
  | 'MISSING_COMPETITOR_MAPPING'
  | 'MISSING_MARKET_VALUE'
  | 'INCOMPLETE_KEYWORD_PAIR'
  | 'DATE_INCONSISTENCY'
  | 'EMPTY_IMPORT'
  | 'KEYWORD_NOT_IN_PROJECT_SET'
  | 'UNDETECTED_BRANDED_QUERY'
  | 'RANK_OUTLIER'
  | 'IMPORT_ERROR'

export type QASeverity = 'ERROR' | 'WARNING' | 'INFO'

export type ExclusionCategory =
  | 'FIRM_NAME'
  | 'ATTORNEY_NAME'
  | 'ABBREVIATION'
  | 'BRANDED_PHRASE'
  | 'ATTORNEY_BIO'
  | 'LOCATION_PAGE'
  | 'PAGE_SPECIFIC'

// Column mapping types for import wizard
export interface ColumnMapping {
  sourceColumn: string
  targetField: string
}

export interface ImportMappingConfig {
  [sourceColumn: string]: string
}

// Required fields per source type
export const REQUIRED_FIELDS: Record<ImportSourceType, string[]> = {
  SEMRUSH_VISIBILITY: ['keyword', 'competitor_domain', 'visibility_score', 'date'],
  SEMRUSH_MAP_PACK: ['keyword', 'domain', 'position', 'date'],
  SEMRUSH_ORGANIC: ['keyword', 'domain', 'position', 'date'],
  GSC_QUERIES: ['query', 'clicks', 'impressions'],
}

export const OPTIONAL_FIELDS: Record<ImportSourceType, string[]> = {
  SEMRUSH_VISIBILITY: ['solv_score', 'traffic_score', 'market'],
  SEMRUSH_MAP_PACK: ['market', 'device', 'url'],
  SEMRUSH_ORGANIC: ['market', 'device', 'url', 'search_volume'],
  GSC_QUERIES: ['ctr', 'average_position', 'date_range_start', 'date_range_end'],
}

export const ALL_TARGET_FIELDS: Record<ImportSourceType, string[]> = {
  SEMRUSH_VISIBILITY: [
    ...REQUIRED_FIELDS.SEMRUSH_VISIBILITY,
    ...OPTIONAL_FIELDS.SEMRUSH_VISIBILITY,
  ],
  SEMRUSH_MAP_PACK: [
    ...REQUIRED_FIELDS.SEMRUSH_MAP_PACK,
    ...OPTIONAL_FIELDS.SEMRUSH_MAP_PACK,
  ],
  SEMRUSH_ORGANIC: [
    ...REQUIRED_FIELDS.SEMRUSH_ORGANIC,
    ...OPTIONAL_FIELDS.SEMRUSH_ORGANIC,
  ],
  GSC_QUERIES: [
    ...REQUIRED_FIELDS.GSC_QUERIES,
    ...OPTIONAL_FIELDS.GSC_QUERIES,
  ],
}

export const SOURCE_TYPE_LABELS: Record<ImportSourceType, string> = {
  SEMRUSH_VISIBILITY: 'Semrush – SoLV / Visibility',
  SEMRUSH_MAP_PACK: 'Semrush – Map Pack Rankings',
  SEMRUSH_ORGANIC: 'Semrush – Organic SERP Rankings',
  GSC_QUERIES: 'Google Search Console – Queries',
}

export const FIELD_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  competitor_domain: 'Competitor Domain',
  visibility_score: 'Visibility Score',
  solv_score: 'SoLV Score',
  traffic_score: 'Traffic Score',
  domain: 'Domain',
  position: 'Position',
  date: 'Date',
  market: 'Market',
  device: 'Device',
  url: 'URL',
  search_volume: 'Search Volume',
  query: 'Query',
  clicks: 'Clicks',
  impressions: 'Impressions',
  ctr: 'CTR',
  average_position: 'Average Position',
  date_range_start: 'Date Range Start',
  date_range_end: 'Date Range End',
}

// Dashboard metric types
export interface KPICard {
  label: string
  value: number | string
  change?: number
  changeLabel?: string
  trend?: 'up' | 'down' | 'flat'
  format?: 'number' | 'percent' | 'rank' | 'score'
}

export interface MonthlyTrendPoint {
  month: string
  value: number
  label?: string
}

export interface CompetitorVisibility {
  domain: string
  name?: string
  visibilityScore: number
  solvScore?: number
  isPrimary: boolean
}

export interface KeywordRanking {
  keyword: string
  position: number | null
  previousPosition?: number | null
  movement?: number | null
  keywordType: KeywordType
  intentGroup?: string | null
  market?: string | null
  isPrimaryTarget: boolean
}

export interface GSCMetrics {
  totalClicks: number
  totalImpressions: number
  totalCtr: number
  totalAvgPosition: number
  nonBrandClicks: number
  nonBrandImpressions: number
  nonBrandCtr: number
  nonBrandAvgPosition: number
  nonBrandNonPageClicks: number
  nonBrandNonPageImpressions: number
}

// Import wizard state
export interface ImportWizardState {
  step: 'upload' | 'map' | 'preview' | 'validate' | 'commit'
  file?: File
  sourceType?: ImportSourceType
  reportingMonth?: string
  projectId?: string
  parsedHeaders?: string[]
  parsedRows?: Record<string, string>[]
  columnMappings?: ImportMappingConfig
  previewRows?: Record<string, string>[]
  validationErrors?: string[]
  validationWarnings?: string[]
  savedProfileId?: string
}

// Filter state for dashboards
export interface DashboardFilters {
  reportingMonth?: string
  market?: string
  keywordType?: KeywordType
  intentGroup?: string
  competitor?: string
  primaryTargetOnly?: boolean
  activeOnly?: boolean
}

// Parsed import row (after column mapping applied)
export interface NormalizedVisibilityRow {
  keyword: string
  competitor_domain: string
  visibility_score?: number
  solv_score?: number
  traffic_score?: number
  date?: string
  market?: string
}

export interface NormalizedMapPackRow {
  keyword: string
  domain: string
  position?: number
  date?: string
  market?: string
  device?: string
  url?: string
}

export interface NormalizedOrganicRow {
  keyword: string
  domain: string
  position?: number
  date?: string
  market?: string
  device?: string
  url?: string
  search_volume?: number
}

export interface NormalizedGSCRow {
  query: string
  clicks: number
  impressions: number
  ctr?: number
  average_position?: number
  date_range_start?: string
  date_range_end?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  validRows: number
  totalRows: number
  errorRows: number
}

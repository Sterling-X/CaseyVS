import { z } from 'zod'
import type { ImportSourceType, ValidationResult } from '@/types'
import { REQUIRED_FIELDS } from '@/types'
import { safeParseFloat, safeParseInt } from '@/lib/utils'

// Zod schemas for each normalized row type

export const visibilityRowSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  competitor_domain: z.string().min(1, 'Competitor domain is required'),
  visibility_score: z.number().nullable().optional(),
  solv_score: z.number().nullable().optional(),
  traffic_score: z.number().nullable().optional(),
  date: z.string().optional(),
  market: z.string().optional(),
})

export const mapPackRowSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  domain: z.string().min(1, 'Domain is required'),
  position: z.number().int().min(1).max(100).nullable().optional(),
  date: z.string().optional(),
  market: z.string().optional(),
  device: z.string().optional(),
  url: z.string().optional(),
})

export const organicRowSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  domain: z.string().min(1, 'Domain is required'),
  position: z.number().int().min(1).max(200).nullable().optional(),
  date: z.string().optional(),
  market: z.string().optional(),
  device: z.string().optional(),
  url: z.string().optional(),
  search_volume: z.number().nullable().optional(),
})

export const gscRowSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  clicks: z.number().int().min(0),
  impressions: z.number().int().min(0),
  ctr: z.number().min(0).max(1).nullable().optional(),
  average_position: z.number().min(1).nullable().optional(),
  date_range_start: z.string().optional(),
  date_range_end: z.string().optional(),
})

type RawRow = Record<string, string | number | null>

function applyMapping(row: RawRow, mapping: Record<string, string>): RawRow {
  const mapped: RawRow = {}
  for (const [sourceCol, targetField] of Object.entries(mapping)) {
    if (sourceCol in row) {
      mapped[targetField] = row[sourceCol]
    }
  }
  return mapped
}

export function validateAndTransformRows(
  rawRows: RawRow[],
  sourceType: ImportSourceType,
  columnMappings: Record<string, string>
): ValidationResult & { rows: RawRow[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const validRows: RawRow[] = []
  let errorCount = 0

  const requiredFields = REQUIRED_FIELDS[sourceType]

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2 // +2 for header row + 1-indexed
    const mapped = applyMapping(rawRows[i], columnMappings)

    // Check required fields
    const missingRequired = requiredFields.filter(
      f => mapped[f] === undefined || mapped[f] === null || mapped[f] === ''
    )
    if (missingRequired.length > 0) {
      errors.push(`Row ${rowNum}: Missing required fields: ${missingRequired.join(', ')}`)
      errorCount++
      continue
    }

    // Type coercions
    const transformed: RawRow = { ...mapped }

    if ('position' in transformed && transformed.position !== null) {
      transformed.position = safeParseInt(transformed.position)
    }
    if ('visibility_score' in transformed && transformed.visibility_score !== null) {
      transformed.visibility_score = safeParseFloat(transformed.visibility_score)
    }
    if ('solv_score' in transformed && transformed.solv_score !== null) {
      transformed.solv_score = safeParseFloat(transformed.solv_score)
    }
    if ('traffic_score' in transformed && transformed.traffic_score !== null) {
      transformed.traffic_score = safeParseFloat(transformed.traffic_score)
    }
    if ('clicks' in transformed) {
      transformed.clicks = safeParseInt(transformed.clicks) ?? 0
    }
    if ('impressions' in transformed) {
      transformed.impressions = safeParseInt(transformed.impressions) ?? 0
    }
    if ('ctr' in transformed && transformed.ctr !== null) {
      let ctr = safeParseFloat(transformed.ctr)
      // GSC sometimes exports CTR as percentage (e.g. 3.5 instead of 0.035)
      if (ctr !== null && ctr > 1) ctr = ctr / 100
      transformed.ctr = ctr
    }
    if ('average_position' in transformed && transformed.average_position !== null) {
      transformed.average_position = safeParseFloat(transformed.average_position)
    }
    if ('search_volume' in transformed && transformed.search_volume !== null) {
      transformed.search_volume = safeParseInt(transformed.search_volume)
    }

    // Validate with Zod
    let parseResult
    try {
      if (sourceType === 'SEMRUSH_VISIBILITY') {
        parseResult = visibilityRowSchema.safeParse(transformed)
      } else if (sourceType === 'SEMRUSH_MAP_PACK') {
        parseResult = mapPackRowSchema.safeParse(transformed)
      } else if (sourceType === 'SEMRUSH_ORGANIC') {
        parseResult = organicRowSchema.safeParse(transformed)
      } else {
        parseResult = gscRowSchema.safeParse(transformed)
      }
    } catch {
      errors.push(`Row ${rowNum}: Unexpected validation error`)
      errorCount++
      continue
    }

    if (!parseResult.success) {
      const issues = parseResult.error.issues.map(i => i.message).join('; ')
      errors.push(`Row ${rowNum}: ${issues}`)
      errorCount++
      continue
    }

    validRows.push(transformed)
  }

  if (rawRows.length === 0) {
    errors.push('File contains no data rows')
  }

  // Warn if large number of errors
  if (errorCount > 0 && errorCount === rawRows.length) {
    errors.unshift('All rows failed validation. Check column mappings.')
  } else if (errorCount > rawRows.length * 0.5) {
    warnings.push(`${errorCount} of ${rawRows.length} rows failed validation (>50% error rate). Check column mappings.`)
  }

  return {
    isValid: errors.length === 0 || (validRows.length > 0 && errorCount < rawRows.length),
    errors,
    warnings,
    validRows: validRows.length,
    totalRows: rawRows.length,
    errorRows: errorCount,
    rows: validRows,
  }
}

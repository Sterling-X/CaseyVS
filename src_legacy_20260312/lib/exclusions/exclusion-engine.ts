import type { BrandExclusionTerm, PageExclusionTerm, GSCQueryRecord } from '@prisma/client'

export type ExclusionResult = {
  isBranded: boolean
  isPageSpecific: boolean
  exclusionReason: string | null
  excludedBy: 'brand' | 'page' | null
}

export function classifyQuery(
  query: string,
  brandExclusions: BrandExclusionTerm[],
  pageExclusions: PageExclusionTerm[]
): ExclusionResult {
  const normalized = query.toLowerCase().trim()

  // Check brand exclusions
  for (const exclusion of brandExclusions) {
    const term = exclusion.term.toLowerCase().trim()
    if (!term) continue

    let matches = false
    if (exclusion.isRegex) {
      try {
        matches = new RegExp(term, 'i').test(normalized)
      } catch {
        // invalid regex, skip
      }
    } else {
      matches = normalized.includes(term)
    }

    if (matches) {
      return {
        isBranded: true,
        isPageSpecific: false,
        exclusionReason: `Brand term: "${exclusion.term}" (category: ${exclusion.category ?? 'unset'})`,
        excludedBy: 'brand',
      }
    }
  }

  // Check page exclusions
  for (const exclusion of pageExclusions) {
    const term = exclusion.term.toLowerCase().trim()
    if (!term) continue

    let matches = false
    if (exclusion.isRegex) {
      try {
        matches = new RegExp(term, 'i').test(normalized)
      } catch {
        // invalid regex, skip
      }
    } else {
      matches = normalized.includes(term)
    }

    if (matches) {
      return {
        isBranded: false,
        isPageSpecific: true,
        exclusionReason: `Page-specific term: "${exclusion.term}" (category: ${exclusion.category ?? 'unset'})`,
        excludedBy: 'page',
      }
    }
  }

  return {
    isBranded: false,
    isPageSpecific: false,
    exclusionReason: null,
    excludedBy: null,
  }
}

export function classifyAllQueries(
  records: Array<{ id: string; query: string }>,
  brandExclusions: BrandExclusionTerm[],
  pageExclusions: PageExclusionTerm[]
): Array<{ id: string; isBranded: boolean; isPageSpecific: boolean; exclusionReason: string | null }> {
  return records.map(record => {
    const result = classifyQuery(record.query, brandExclusions, pageExclusions)
    return {
      id: record.id,
      isBranded: result.isBranded,
      isPageSpecific: result.isPageSpecific,
      exclusionReason: result.exclusionReason,
    }
  })
}

export function aggregateGSCMetrics(records: GSCQueryRecord[]) {
  const total = {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    avgPosition: 0,
  }
  const nonBrand = { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 }
  const nonBrandNonPage = { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 }

  let totalPositionSum = 0
  let nonBrandPositionSum = 0
  let nonBrandNonPagePositionSum = 0
  let nonBrandCount = 0
  let nonBrandNonPageCount = 0

  for (const r of records) {
    total.clicks += r.clicks
    total.impressions += r.impressions
    if (r.averagePosition) totalPositionSum += r.averagePosition * r.impressions

    if (!r.isBranded && !r.isPageSpecific) {
      nonBrand.clicks += r.clicks
      nonBrand.impressions += r.impressions
      if (r.averagePosition) nonBrandPositionSum += r.averagePosition * r.impressions
      nonBrandCount += r.impressions

      nonBrandNonPage.clicks += r.clicks
      nonBrandNonPage.impressions += r.impressions
      if (r.averagePosition) nonBrandNonPagePositionSum += r.averagePosition * r.impressions
      nonBrandNonPageCount += r.impressions
    } else if (!r.isBranded && r.isPageSpecific) {
      nonBrand.clicks += r.clicks
      nonBrand.impressions += r.impressions
      if (r.averagePosition) nonBrandPositionSum += r.averagePosition * r.impressions
      nonBrandCount += r.impressions
    }
  }

  total.ctr = total.impressions > 0 ? total.clicks / total.impressions : 0
  total.avgPosition = total.impressions > 0 ? totalPositionSum / total.impressions : 0

  nonBrand.ctr = nonBrand.impressions > 0 ? nonBrand.clicks / nonBrand.impressions : 0
  nonBrand.avgPosition = nonBrandCount > 0 ? nonBrandPositionSum / nonBrandCount : 0

  nonBrandNonPage.ctr =
    nonBrandNonPage.impressions > 0 ? nonBrandNonPage.clicks / nonBrandNonPage.impressions : 0
  nonBrandNonPage.avgPosition =
    nonBrandNonPageCount > 0 ? nonBrandNonPagePositionSum / nonBrandNonPageCount : 0

  return { total, nonBrand, nonBrandNonPage }
}

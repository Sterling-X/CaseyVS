import { ExclusionMatchType, type BrandExclusionTerm, type PageExclusionTerm, type GSCQueryRecord } from "@prisma/client";
import { normalizeText } from "@/lib/utils";

export type ExclusionReason = {
  type: "brand" | "page";
  term: string;
  category: string | null;
};

export type ExclusionEvaluation = {
  isBrandExcluded: boolean;
  isPageExcluded: boolean;
  reasons: ExclusionReason[];
};

function matches(term: string, query: string, matchType: ExclusionMatchType) {
  switch (matchType) {
    case ExclusionMatchType.EXACT:
      return query === term;
    case ExclusionMatchType.STARTS_WITH:
      return query.startsWith(term);
    case ExclusionMatchType.ENDS_WITH:
      return query.endsWith(term);
    case ExclusionMatchType.REGEX:
      try {
        return new RegExp(term, "i").test(query);
      } catch {
        return false;
      }
    case ExclusionMatchType.CONTAINS:
    default:
      return query.includes(term);
  }
}

export function evaluateQueryExclusions(
  query: string,
  brandTerms: Pick<BrandExclusionTerm, "term" | "normalizedTerm" | "matchType" | "category">[],
  pageTerms: Pick<PageExclusionTerm, "term" | "normalizedTerm" | "matchType" | "category">[],
): ExclusionEvaluation {
  const normalizedQuery = normalizeText(query);
  const reasons: ExclusionReason[] = [];

  for (const item of brandTerms) {
    const normalizedTerm = item.normalizedTerm || normalizeText(item.term);
    if (normalizedTerm && matches(normalizedTerm, normalizedQuery, item.matchType)) {
      reasons.push({
        type: "brand",
        term: item.term,
        category: item.category ?? null,
      });
    }
  }

  for (const item of pageTerms) {
    const normalizedTerm = item.normalizedTerm || normalizeText(item.term);
    if (normalizedTerm && matches(normalizedTerm, normalizedQuery, item.matchType)) {
      reasons.push({
        type: "page",
        term: item.term,
        category: item.category ?? null,
      });
    }
  }

  return {
    isBrandExcluded: reasons.some((reason) => reason.type === "brand"),
    isPageExcluded: reasons.some((reason) => reason.type === "page"),
    reasons,
  };
}

export function aggregateGscMetrics(records: GSCQueryRecord[]) {
  const totals = {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    averagePosition: 0,
  };

  const nonBrand = {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    averagePosition: 0,
  };

  const nonBrandNonPage = {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    averagePosition: 0,
  };

  let totalsWeightedPosition = 0;
  let nonBrandWeightedPosition = 0;
  let nonBrandNonPageWeightedPosition = 0;

  for (const record of records) {
    totals.clicks += record.clicks;
    totals.impressions += record.impressions;
    totalsWeightedPosition += (record.averagePosition ?? 0) * record.impressions;

    if (!record.isBrandExcluded) {
      nonBrand.clicks += record.clicks;
      nonBrand.impressions += record.impressions;
      nonBrandWeightedPosition += (record.averagePosition ?? 0) * record.impressions;
    }

    if (!record.isBrandExcluded && !record.isPageExcluded) {
      nonBrandNonPage.clicks += record.clicks;
      nonBrandNonPage.impressions += record.impressions;
      nonBrandNonPageWeightedPosition += (record.averagePosition ?? 0) * record.impressions;
    }
  }

  totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  totals.averagePosition = totals.impressions > 0 ? totalsWeightedPosition / totals.impressions : 0;

  nonBrand.ctr = nonBrand.impressions > 0 ? nonBrand.clicks / nonBrand.impressions : 0;
  nonBrand.averagePosition =
    nonBrand.impressions > 0 ? nonBrandWeightedPosition / nonBrand.impressions : 0;

  nonBrandNonPage.ctr =
    nonBrandNonPage.impressions > 0 ? nonBrandNonPage.clicks / nonBrandNonPage.impressions : 0;
  nonBrandNonPage.averagePosition =
    nonBrandNonPage.impressions > 0
      ? nonBrandNonPageWeightedPosition / nonBrandNonPage.impressions
      : 0;

  return {
    total: totals,
    nonBrand,
    nonBrandNonPage,
  };
}

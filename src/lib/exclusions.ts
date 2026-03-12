import { ExclusionMatchType } from "@prisma/client";
import { normalizeText } from "@/lib/utils";

export type ExclusionTerm = {
  term: string;
  matchType: ExclusionMatchType;
};

export type ExclusionResult = {
  isBrandExcluded: boolean;
  isPageExcluded: boolean;
  reasons: string[];
};

function matchesTerm(text: string, term: ExclusionTerm) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term.term);

  if (!normalizedTerm) {
    return false;
  }

  if (term.matchType === ExclusionMatchType.EXACT) {
    return normalizedText === normalizedTerm;
  }

  if (term.matchType === ExclusionMatchType.REGEX) {
    try {
      const regex = new RegExp(term.term, "i");
      return regex.test(text);
    } catch {
      return false;
    }
  }

  return normalizedText.includes(normalizedTerm);
}

export function evaluateQueryExclusions(
  query: string,
  brandTerms: ExclusionTerm[],
  pageTerms: ExclusionTerm[],
): ExclusionResult {
  const reasons: string[] = [];

  brandTerms.forEach((term) => {
    if (matchesTerm(query, term)) {
      reasons.push(`brand:${term.term}`);
    }
  });

  pageTerms.forEach((term) => {
    if (matchesTerm(query, term)) {
      reasons.push(`page:${term.term}`);
    }
  });

  return {
    isBrandExcluded: reasons.some((reason) => reason.startsWith("brand:")),
    isPageExcluded: reasons.some((reason) => reason.startsWith("page:")),
    reasons,
  };
}

export function looksBrandedButNotExcluded(query: string, knownBrandHints: string[]) {
  const normalized = normalizeText(query);
  if (!normalized) {
    return false;
  }

  return knownBrandHints.some((hint) => {
    const normalizedHint = normalizeText(hint);
    return normalizedHint.length >= 3 && normalized.includes(normalizedHint);
  });
}

import { KeywordType } from "@prisma/client";

export type PairAwareKeyword = {
  id: string;
  keywordType: KeywordType;
  isActive: boolean;
  localPair?: { id: string } | null;
  corePair?: { id: string } | null;
};

export function findIncompletePairKeywords(keywords: PairAwareKeyword[]) {
  return keywords.filter((keyword) => {
    if (!keyword.isActive) {
      return false;
    }

    if (keyword.keywordType === KeywordType.LOCAL) {
      return !keyword.localPair;
    }

    if (keyword.keywordType === KeywordType.CORE) {
      return !keyword.corePair;
    }

    return false;
  });
}

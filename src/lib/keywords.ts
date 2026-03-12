import { KeywordType } from "@prisma/client";
import { normalizeText } from "@/lib/utils";

export function classifyKeywordType(keyword: string, marketTerms: string[]): KeywordType {
  const normalized = normalizeText(keyword);
  const hasMarket = marketTerms.some((term) => normalized.includes(normalizeText(term)));

  return hasMarket ? KeywordType.LOCAL : KeywordType.CORE;
}

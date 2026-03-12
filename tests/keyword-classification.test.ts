import { KeywordType } from '@prisma/client';
import { classifyKeywordType } from '@/lib/keywords';

describe('keyword classification', () => {
  it('classifies local keyword when it contains a market term', () => {
    expect(classifyKeywordType('miami divorce lawyer', ['Miami', 'Orlando'])).toBe(KeywordType.LOCAL);
  });

  it('classifies core keyword when no market term is present', () => {
    expect(classifyKeywordType('divorce lawyer', ['Miami', 'Orlando'])).toBe(KeywordType.CORE);
  });
});

import { KeywordType } from '@prisma/client';
import { findIncompletePairKeywords } from '@/lib/qa/pairing';

describe('keyword pairing logic', () => {
  it('returns active local/core keywords without pair links', () => {
    const incomplete = findIncompletePairKeywords([
      {
        id: 'k1',
        keywordType: KeywordType.LOCAL,
        isActive: true,
        localPair: null,
      },
      {
        id: 'k2',
        keywordType: KeywordType.CORE,
        isActive: true,
        corePair: { id: 'p1' },
      },
      {
        id: 'k3',
        keywordType: KeywordType.CORE,
        isActive: true,
        corePair: null,
      },
      {
        id: 'k4',
        keywordType: KeywordType.BRANDED,
        isActive: true,
      },
      {
        id: 'k5',
        keywordType: KeywordType.LOCAL,
        isActive: false,
        localPair: null,
      },
    ]);

    expect(incomplete.map((item) => item.id)).toEqual(['k1', 'k3']);
  });
});

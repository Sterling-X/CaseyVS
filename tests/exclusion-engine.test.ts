import { ExclusionMatchType } from '@prisma/client';
import { aggregateGscMetrics, evaluateQueryExclusions } from '@/lib/exclusions';

describe('exclusion engine', () => {
  it('classifies branded and page-specific queries with reasons', () => {
    const result = evaluateQueryExclusions(
      'casey law attorney profile',
      [{ term: 'casey law', normalizedTerm: 'casey law', matchType: ExclusionMatchType.CONTAINS, category: 'BRAND' }],
      [{ term: 'attorney profile', normalizedTerm: 'attorney profile', matchType: ExclusionMatchType.CONTAINS, category: 'PAGE' }],
    );

    expect(result.isBrandExcluded).toBe(true);
    expect(result.isPageExcluded).toBe(true);
    expect(result.reasons).toHaveLength(2);
  });

  it('aggregates non-brand and non-page metrics correctly', () => {
    const metrics = aggregateGscMetrics([
      {
        id: '1',
        importJobId: 'i1',
        projectId: 'p1',
        query: 'miami divorce lawyer',
        normalizedQuery: 'miami divorce lawyer',
        clicks: 100,
        impressions: 1000,
        ctr: 0.1,
        averagePosition: 7,
        dateRangeStart: null,
        dateRangeEnd: null,
        reportingMonth: new Date('2026-02-01T00:00:00.000Z'),
        isBrandExcluded: false,
        isPageExcluded: false,
        exclusionReasons: null,
        sourceRowNumber: 2,
        createdAt: new Date(),
      },
      {
        id: '2',
        importJobId: 'i1',
        projectId: 'p1',
        query: 'casey law',
        normalizedQuery: 'casey law',
        clicks: 20,
        impressions: 200,
        ctr: 0.1,
        averagePosition: 2,
        dateRangeStart: null,
        dateRangeEnd: null,
        reportingMonth: new Date('2026-02-01T00:00:00.000Z'),
        isBrandExcluded: true,
        isPageExcluded: false,
        exclusionReasons: null,
        sourceRowNumber: 3,
        createdAt: new Date(),
      },
    ]);

    expect(metrics.total.clicks).toBe(120);
    expect(metrics.nonBrand.clicks).toBe(100);
    expect(metrics.nonBrandNonPage.clicks).toBe(100);
  });
});

import { ImportSourceType } from '@prisma/client';
import { transformSemrushOverviewIfApplicable } from '@/lib/import/semrush-overview';

describe('semrush overview transformer', () => {
  const parsed = {
    headers: [
      'Keyword',
      '*.example.com/*_20260311',
      '*.example.com/*_20260311_type',
      '*.example.com/*_20260311_landing',
      '*.example.com/*_20260312',
      '*.example.com/*_20260312_type',
      '*.example.com/*_20260312_landing',
      '*.comp.com/*_20260312',
      '*.comp.com/*_20260312_type',
      '*.comp.com/*_20260312_landing',
      'Search Volume',
    ],
    rows: [
      {
        Keyword: 'miami divorce lawyer',
        '*.example.com/*_20260311': '3',
        '*.example.com/*_20260311_type': 'organic',
        '*.example.com/*_20260311_landing': 'https://example.com/a',
        '*.example.com/*_20260312': '2',
        '*.example.com/*_20260312_type': 'organic',
        '*.example.com/*_20260312_landing': 'https://example.com/b',
        '*.comp.com/*_20260312': '1',
        '*.comp.com/*_20260312_type': 'local',
        '*.comp.com/*_20260312_landing': 'https://comp.com/l',
        'Search Volume': '1000',
      },
    ],
  };

  it('expands into normalized organic rows for active month date', () => {
    const result = transformSemrushOverviewIfApplicable(
      ImportSourceType.SEMRUSH_ORGANIC,
      parsed,
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(result.headers).toEqual(
      expect.arrayContaining(['keyword', 'domain', 'position', 'capturedAt', 'searchVolume']),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      keyword: 'miami divorce lawyer',
      domain: 'example.com',
      position: 2,
      capturedAt: '2026-03-12',
      searchVolume: '1000',
    });
  });

  it('expands local rows for map pack imports', () => {
    const result = transformSemrushOverviewIfApplicable(
      ImportSourceType.SEMRUSH_MAP_PACK,
      parsed,
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      keyword: 'miami divorce lawyer',
      domain: 'comp.com',
      position: 1,
      capturedAt: '2026-03-12',
    });
  });

  it('does not auto-convert overview to visibility imports', () => {
    const result = transformSemrushOverviewIfApplicable(
      ImportSourceType.SEMRUSH_VISIBILITY,
      parsed,
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(result).toEqual(parsed);
  });
});

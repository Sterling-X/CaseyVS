import { ImportSourceType } from '@prisma/client';
import { previewMappedRows, validateMapping } from '@/lib/import/mapping';
import { autoDetectMapping } from '@/lib/import/source-definitions';

describe('import mapping validation', () => {
  it('flags missing required mappings', () => {
    const issues = validateMapping(ImportSourceType.SEMRUSH_MAP_PACK, {
      keyword: 'Keyword',
    });

    expect(issues.some((issue) => issue.code === 'MISSING_REQUIRED_MAPPING')).toBe(true);
  });

  it('parses valid mapped semrush map pack rows', () => {
    const preview = previewMappedRows(
      ImportSourceType.SEMRUSH_MAP_PACK,
      [
        {
          Keyword: 'miami divorce lawyer',
          Domain: 'familylawfirm.com',
          Position: '3',
          Date: '2026-02-15',
          Market: 'Miami',
        },
      ],
      {
        keyword: 'Keyword',
        domain: 'Domain',
        position: 'Position',
        capturedAt: 'Date',
        market: 'Market',
      },
    );

    expect(preview.issues.filter((issue) => issue.severity === 'ERROR')).toHaveLength(0);
    expect(preview.rows[0]).toMatchObject({
      keyword: 'miami divorce lawyer',
      domain: 'familylawfirm.com',
      position: 3,
    });
  });

  it('auto-detects non-standard visibility and gsc headers', () => {
    const visibilityMapping = autoDetectMapping(ImportSourceType.SEMRUSH_VISIBILITY, [
      'Key Phrase',
      'Competitor Domain',
      'Share of Voice %',
      'Capture Date',
      'City',
    ]);

    expect(visibilityMapping.keyword).toBe('Key Phrase');
    expect(visibilityMapping.visibilityScore).toBe('Share of Voice %');
    expect(visibilityMapping.capturedAt).toBe('Capture Date');

    const gscMapping = autoDetectMapping(ImportSourceType.GSC_QUERY, [
      'Query Text',
      'Clicks',
      'Impr',
      'CTR %',
      'Avg Pos',
      'Range Start',
      'Range End',
    ]);

    expect(gscMapping.query).toBe('Query Text');
    expect(gscMapping.ctr).toBe('CTR %');
    expect(gscMapping.averagePosition).toBe('Avg Pos');
    expect(gscMapping.dateRangeStart).toBe('Range Start');
    expect(gscMapping.dateRangeEnd).toBe('Range End');
  });
});

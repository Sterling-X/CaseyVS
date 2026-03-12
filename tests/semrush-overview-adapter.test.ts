import { parseCsvContent } from '@/lib/import/file-parser';
import { transformSemrushOverview } from '@/lib/import/semrush-overview-adapter';

describe('semrush overview adapter', () => {
  it('detects domain/date groups and normalizes rows', () => {
    const csv = [
      'Semrush Position Tracking Rankings Overview',
      'Project,Family Law Demo',
      '',
      'Keyword,Tags,Intents,*.familylawfirm.com/*_20260310,*.familylawfirm.com/*_20260310_type,*.familylawfirm.com/*_20260310_landing,*.competitor.com/*_20260310,*.competitor.com/*_20260310_type,*.competitor.com/*_20260310_landing,*.familylawfirm.com/*_difference,Search Volume,CPC,Keyword Difficulty',
      'miami divorce lawyer,primary,commercial,7,organic,https://familylawfirm.com/divorce,4,organic,https://competitor.com/divorce,-3,3200,12.5,44',
      'fort lauderdale child custody lawyer,primary,commercial,-,local,,2,local,https://competitor.com/custody,1,1900,10.2,40',
    ].join('\n');

    const parsed = parseCsvContent(csv);
    const result = transformSemrushOverview(parsed);

    expect(result.layoutDetected).toBe(true);
    expect(result.detectedDomains).toEqual(expect.arrayContaining(['familylawfirm.com', 'competitor.com']));
    expect(result.detectedDates).toEqual(['2026-03-10']);
    expect(result.rows).toHaveLength(4);

    const ownRanked = result.rows.find((row) => row.keyword === 'miami divorce lawyer' && row.domain === 'familylawfirm.com');
    expect(ownRanked).toMatchObject({
      rank: 7,
      rankingType: 'organic',
      difference: -3,
      searchVolume: 3200,
      cpc: 12.5,
      keywordDifficulty: 44,
    });

    const ownNotRanking = result.rows.find((row) => row.keyword.includes('child custody') && row.domain === 'familylawfirm.com');
    expect(ownNotRanking?.rank).toBeNull();
  });
});

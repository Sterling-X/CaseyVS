import { parseCsvContent } from '@/lib/import/file-parser';

describe('csv parser', () => {
  it('parses standard comma-delimited csv', () => {
    const parsed = parseCsvContent('keyword,domain\nmiami divorce lawyer,familylawfirm.com\n');

    expect(parsed.headers).toEqual(['keyword', 'domain']);
    expect(parsed.rows).toHaveLength(1);
  });

  it('falls back to semicolon-delimited csv when delimiter auto-detection fails', () => {
    const parsed = parseCsvContent('keyword;domain;position\nmiami divorce lawyer;familylawfirm.com;3\n');

    expect(parsed.headers).toEqual(['keyword', 'domain', 'position']);
    expect(parsed.rows[0]).toMatchObject({
      keyword: 'miami divorce lawyer',
      domain: 'familylawfirm.com',
      position: '3',
    });
  });

  it('detects header row after preamble lines', () => {
    const csv = [
      'Semrush export generated 2026-03-12',
      'Project: Family Law',
      'Market: Miami',
      '',
      'Keyword,Domain,Position',
      'miami divorce lawyer,familylawfirm.com,3',
    ].join('\n');

    const parsed = parseCsvContent(csv);

    expect(parsed.headers).toEqual(['Keyword', 'Domain', 'Position']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      Keyword: 'miami divorce lawyer',
      Domain: 'familylawfirm.com',
      Position: '3',
    });
  });
});

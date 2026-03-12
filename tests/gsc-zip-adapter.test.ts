import fs from 'node:fs';
import path from 'node:path';
import { parseGscPerformanceZip } from '@/lib/import/gsc-zip-adapter';

describe('gsc zip adapter', () => {
  it('parses required gsc csv files from zip', async () => {
    const fixturePath = path.resolve(process.cwd(), 'sample-data/gsc/performance_sample.zip');
    const buffer = fs.readFileSync(fixturePath);

    const result = await parseGscPerformanceZip(buffer);

    expect(result.filePresence.queries).toBe(true);
    expect(result.filePresence.pages).toBe(true);
    expect(result.filePresence.countries).toBe(true);
    expect(result.filePresence.devices).toBe(true);
    expect(result.filePresence.searchAppearance).toBe(true);
    expect(result.filePresence.filters).toBe(true);

    expect(result.queries.length).toBeGreaterThan(0);
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.countries.length).toBeGreaterThan(0);

    const query = result.queries[0];
    expect(query).toMatchObject({
      dimension: expect.any(String),
      currentClicks: expect.any(Number),
      previousClicks: expect.any(Number),
      currentImpressions: expect.any(Number),
      previousImpressions: expect.any(Number),
    });

    expect(result.importMeta.searchType).toBe('Web');
  });
});

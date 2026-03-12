import { aggregateSeriesByMonth, average, coverageRate, rankMovement } from '@/lib/dashboard/aggregations';

describe('dashboard aggregation helpers', () => {
  it('computes averages and handles empty arrays', () => {
    expect(average([2, 4, 6])).toBe(4);
    expect(average([])).toBeNull();
  });

  it('computes rank movement where lower rank is better', () => {
    expect(rankMovement(8, 12)).toBe(4);
    expect(rankMovement(14, 9)).toBe(-5);
    expect(rankMovement(null, 9)).toBeNull();
  });

  it('computes coverage rate safely', () => {
    expect(coverageRate(8, 10)).toBe(0.8);
    expect(coverageRate(0, 0)).toBe(0);
  });

  it('aggregates monthly series values', () => {
    const result = aggregateSeriesByMonth([
      { month: '2026-01', value: 20 },
      { month: '2026-01', value: 30 },
      { month: '2026-02', value: 10 },
      { month: '2026-02', value: null },
    ]);

    expect(result).toEqual([
      { month: '2026-01', average: 25 },
      { month: '2026-02', average: 10 },
    ]);
  });
});

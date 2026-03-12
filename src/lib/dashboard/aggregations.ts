export function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function rankMovement(current: number | null, previous: number | null) {
  if (current === null || previous === null) {
    return null;
  }

  return previous - current;
}

export function coverageRate(covered: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return covered / total;
}

export function aggregateSeriesByMonth<T extends { month: string; value: number | null }>(rows: T[]) {
  const grouped = new Map<string, number[]>();

  for (const row of rows) {
    if (row.value === null) {
      continue;
    }

    const bucket = grouped.get(row.month) ?? [];
    bucket.push(row.value);
    grouped.set(row.month, bucket);
  }

  return [...grouped.entries()].map(([month, values]) => ({
    month,
    average: average(values),
  }));
}

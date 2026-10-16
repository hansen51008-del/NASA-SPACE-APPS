import type { Hotspot } from "../types";
import { MONTHS } from "../types";
export function monthlyCounts(records: Hotspot[], year: number) {
  const counts = Array<number>(12).fill(0);
  for (const r of records) if (r.year === year) counts[r.month - 1]++;
  return counts;
}
export function analyze(
  records: Hotspot[],
  year: number,
  month: number | null,
  years: number[],
) {
  const historicalYears = years.filter((y) => y < year);
  const countFor = (y: number) =>
    records.filter((r) => r.year === y && (month === null || r.month === month))
      .length;
  const samples = historicalYears.map(countFor);
  const current = countFor(year);
  const mean = samples.length
    ? samples.reduce((a, b) => a + b, 0) / samples.length
    : 0;
  const sd = samples.length
    ? Math.sqrt(
        samples.reduce((sum, n) => sum + (n - mean) ** 2, 0) / samples.length,
      )
    : 0;
  const threshold = mean + 2 * sd;
  const enough = samples.length >= 3;
  return {
    current,
    mean,
    sd,
    threshold,
    baselineYears: historicalYears,
    enough,
    unusual: enough && current > threshold,
    change: mean > 0 ? ((current - mean) / mean) * 100 : null,
  };
}
export function peakMonth(counts: number[]) {
  return Math.max(...counts) > 0
    ? MONTHS[counts.indexOf(Math.max(...counts))]
    : "Tidak ada aktivitas";
}
export function regionRanking(records: Hotspot[]) {
  const counts = new Map<string, number>();
  records.forEach((r) =>
    counts.set(r.province, (counts.get(r.province) ?? 0) + 1),
  );
  return [...counts].sort((a, b) => b[1] - a[1]);
}

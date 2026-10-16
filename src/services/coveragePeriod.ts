import type { Hotspot } from "../types";

export type Coverage = { start: string; end: string };

// UI period semantics: null means the entire cache, including a year boundary.
export function coveredMonth(
  coverage: Coverage | undefined,
  year: number,
  month: number,
) {
  if (!coverage || month < 1 || month > 12) return false;
  return (
    Date.UTC(year, month - 1, 1) <= Date.parse(coverage.end) &&
    Date.UTC(year, month, 1) > Date.parse(coverage.start)
  );
}

export function inPeriod(
  record: Hotspot,
  year: number,
  month: number | null,
  coverage?: Coverage,
) {
  if (coverage) {
    const date = record.date.slice(0, 10);
    if (date < coverage.start || date > coverage.end) return false;
    if (month === null) return true;
  }
  return record.year === year && (month === null || record.month === month);
}

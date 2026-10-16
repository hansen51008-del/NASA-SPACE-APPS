import { describe, expect, it } from "vitest";
import { coveredMonth, inPeriod } from "../src/services/coveragePeriod";
import { calculateRisk } from "../src/services/riskService";
import type { Hotspot } from "../src/types";
import type { ObservationDataset } from "../src/services/observationProvider";

const record = (date: string): Hotspot => ({
  id: date,
  date: `${date}T03:00:00.000Z`,
  source: "MODIS",
  latitude: -2.3,
  longitude: 113.9,
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  confidence: "high",
  nativeConfidence: 90,
  province: "Kalimantan Tengah",
  isDemo: false,
});
describe("FIRMS coverage period", () => {
  it("only enables months that intersect the cache", () => {
    const coverage = { start: "2026-10-12", end: "2026-10-14" };
    expect(
      Array.from({ length: 12 }, (_, i) => i + 1).filter((m) =>
        coveredMonth(coverage, 2026, m),
      ),
    ).toEqual([10]);
    expect(coveredMonth(coverage, 2025, 10)).toBe(false);
    expect(coveredMonth(undefined, 2026, 10)).toBe(false);
  });
  it("includes the entire cache across a month/year boundary without changing demo semantics", () => {
    const coverage = { start: "2026-12-31", end: "2027-01-02" };
    const records = [
      record("2026-12-31"),
      record("2027-01-01"),
      record("2027-01-02"),
    ];
    expect(
      records.filter((r) => inPeriod(r, 2027, null, coverage)),
    ).toHaveLength(3);
    expect(records.filter((r) => inPeriod(r, 2027, null))).toHaveLength(2);
    expect(records.filter((r) => inPeriod(r, 2026, 12, coverage))).toHaveLength(
      1,
    );
    expect(inPeriod(record("2027-01-03"), 2027, null, coverage)).toBe(false);
    const dataset: ObservationDataset = {
      records,
      coverage,
      mode: "firms",
      years: [2026, 2027],
      notice: "Test",
      updatedAt: new Date().toISOString(),
    };
    expect(calculateRisk(dataset, "Indonesia", 2027, null)).toMatchObject({
      count: 3,
      days: 3,
    });
    expect(calculateRisk(dataset, "Indonesia", 2027, 2)).toMatchObject({
      days: 0,
      score: null,
      level: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyze, monthlyCounts } from "../src/services/anomalyService";
import { harmonize, distanceKm } from "../src/services/harmonizationService";
import {
  containsPoint,
  demoDataService,
  normalizeFirmsRow,
} from "../src/services/nasaDataService";
import type { Hotspot, Provinces } from "../src/types";
const observation = (overrides: Partial<Hotspot> = {}): Hotspot => ({
  id: "a",
  source: "MODIS",
  latitude: -2.3,
  longitude: 113.9,
  date: "2025-09-01T03:00:00.000Z",
  confidence: "nominal",
  nativeConfidence: 60,
  province: "Kalimantan Tengah",
  year: 2025,
  month: 9,
  isDemo: true,
  ...overrides,
});
describe("harmonization", () => {
  it("merges nearby cross-sensor observations, preserving membership and confidence", () => {
    const a = observation();
    const b = observation({
      id: "b",
      source: "VIIRS",
      longitude: 113.903,
      date: "2025-09-01T03:20:00.000Z",
      confidence: "high",
    });
    const result = harmonize([b, a]);
    expect(result).toHaveLength(1);
    expect(result[0].memberIds).toEqual(["a", "b"]);
    expect(result[0].sources).toEqual(["MODIS", "VIIRS"]);
    expect(result[0].confidence).toBe("high");
    expect(a.confidence).toBe("nominal");
  });
  it("does not collapse repeated same-sensor observations", () => {
    expect(harmonize([observation(), observation({ id: "b" })])).toHaveLength(
      2,
    );
  });
  it("does not merge observations beyond distance, time, or province limits", () => {
    for (const overrides of [
      { longitude: 114.0 },
      { date: "2025-09-01T05:00:00.000Z" },
      { province: "Riau" },
    ]) {
      expect(
        harmonize([
          observation(),
          observation({ id: "b", source: "VIIRS", ...overrides }),
        ]),
      ).toHaveLength(2);
    }
  });
  it("matches across the hour boundary and avoids transitive merging", () => {
    const result = harmonize([
      observation({ date: "2025-09-01T03:55:00.000Z" }),
      observation({
        id: "b",
        source: "VIIRS",
        date: "2025-09-01T04:10:00.000Z",
      }),
      observation({
        id: "c",
        source: "VIIRS",
        date: "2025-09-01T04:20:00.000Z",
      }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.flatMap((r) => r.memberIds).sort()).toEqual(["a", "b", "c"]);
  });
  it("calculates geographic distance in kilometres", () => {
    expect(
      distanceKm(observation(), observation({ latitude: -1.3 })),
    ).toBeCloseTo(111.195, 2);
  });
});
describe("anomalies", () => {
  it("compares a month with only earlier same-month baselines", () => {
    const records = [2020, 2021, 2022].flatMap((year) => [
      observation({ year }),
      observation({ year, month: 8 }),
    ]);
    records.push(
      ...Array.from({ length: 5 }, () => observation({ year: 2023 })),
      ...Array.from({ length: 100 }, () => observation({ year: 2025 })),
    );
    const result = analyze(records, 2023, 9, [2020, 2021, 2022, 2023, 2025]);
    expect(result.mean).toBe(1);
    expect(result.current).toBe(5);
    expect(result.unusual).toBe(true);
    expect(result.baselineYears).toEqual([2020, 2021, 2022]);
  });
  it("requires three baseline years and handles zero baselines", () => {
    expect(analyze([], 2021, null, [2020, 2021]).enough).toBe(false);
    expect(analyze([], 2023, 1, [2020, 2021, 2022, 2023])).toMatchObject({
      enough: true,
      unusual: false,
      change: null,
    });
    expect(monthlyCounts([], 2025)).toEqual(Array(12).fill(0));
  });
});
describe("FIRMS normalization", () => {
  const row = {
    latitude: "-2.3",
    longitude: "113.9",
    acq_date: "2025-09-01",
    acq_time: 35,
    confidence: "h",
    bright_ti4: 340,
  };
  it("preserves VIIRS categories without inventing numeric confidence", () => {
    expect(
      normalizeFirmsRow(row, "VIIRS", "Kalimantan Tengah", "real"),
    ).toMatchObject({
      date: "2025-09-01T00:35:00.000Z",
      confidence: "high",
      nativeConfidence: "h",
      brightness: 340,
      isDemo: false,
    });
  });
  it("classifies MODIS native confidence", () => {
    expect(
      normalizeFirmsRow({ ...row, confidence: 80 }, "MODIS", "Riau", "real")
        .confidence,
    ).toBe("high");
    expect(
      normalizeFirmsRow({ ...row, confidence: 29 }, "MODIS", "Riau", "real")
        .confidence,
    ).toBe("low");
  });
  it("rejects invalid time, confidence, and geographic data", () => {
    for (const update of [
      { confidence: "unknown" },
      { latitude: "NaN" },
      { longitude: "" },
      { longitude: 181 },
      { acq_time: "2501" },
      { acq_date: "2025-02-30" },
    ])
      expect(() =>
        normalizeFirmsRow({ ...row, ...update }, "VIIRS", "Riau", "bad"),
      ).toThrow();
  });
});
describe("demo data integrity", () => {
  it("is deterministic, covers the provinces and years, and places every observation inside its province", async () => {
    const boundaries = JSON.parse(
      readFileSync("public/data/indonesia-provinces.geojson", "utf8"),
    ) as Provinces;
    expect(boundaries.features).toHaveLength(38);
    const records = await demoDataService.loadRecords(boundaries);
    const again = await demoDataService.loadRecords(boundaries);
    expect(records).toEqual(again);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
    expect(new Set(records.map((r) => r.province)).size).toBe(38);
    expect(new Set(records.map((r) => r.year)).size).toBe(6);
    const features = new Map(
      boundaries.features.map((f) => [f.properties.PROVINSI, f]),
    );
    expect(
      records.every(
        (r) =>
          r.isDemo &&
          containsPoint(features.get(r.province)!, [r.longitude, r.latitude]),
      ),
    ).toBe(true);
    const harmonized = harmonize(records);
    expect(harmonized.length).toBeLessThan(records.length);
    expect(harmonized.flatMap((r) => r.memberIds)).toHaveLength(records.length);
  }, 30000);
});

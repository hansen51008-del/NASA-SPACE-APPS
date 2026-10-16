import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Hotspot, Provinces } from "../src/types";
import type {
  ObservationDataset,
  FirmsCache,
} from "../src/services/observationProvider";
import {
  loadObservations,
  parseFirmsCache,
} from "../src/services/observationProvider";
import { calculateRisk, riskBrief } from "../src/services/riskService";
import { collectFirms } from "../scripts/sync-firms";

const boundaries = JSON.parse(
  readFileSync("public/data/indonesia-provinces.geojson", "utf8"),
) as Provinces;
const records = (count: number): Hotspot[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `test-${i}`,
    source: "MODIS",
    latitude: -2.3,
    longitude: 113.9,
    date: "2025-09-01T00:00:00.000Z",
    year: 2025,
    month: 9,
    confidence: "high",
    nativeConfidence: 90,
    province: "Kalimantan Tengah",
    isDemo: true,
  }));
const demo = (count: number): ObservationDataset => ({
  records: records(count),
  mode: "demo",
  years: [2025],
  notice: "Test fixture",
});
const csv = (sensor: string, day = "2026-10-14") =>
  `latitude,longitude,acq_date,acq_time,confidence,instrument,brightness,bright_ti4,satellite\n-2.3,113.9,${day},0300,${sensor === "MODIS" ? "90" : "h"},${sensor},340,340,${sensor === "MODIS" ? "Terra" : "N"}\n`;
const cache = (): FirmsCache => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  coverage: { start: "2026-10-12", end: "2026-10-14" },
  products: [
    { name: "MODIS_NRT", text: csv("MODIS") },
    { name: "VIIRS_SNPP_NRT", text: csv("VIIRS") },
  ],
});

describe("transparent risk indicator", () => {
  it.each([
    [0, "Aman", 0],
    [60, "Waspada", 40],
    [150, "Siaga", 80],
  ] as const)("%i observations produce %s", (count, level, score) => {
    const risk = calculateRisk(demo(count), "Kalimantan Tengah", 2025, 9);
    expect(risk).toMatchObject({ level, score, count, days: 30, change: null });
    expect(riskBrief(risk, "Kalimantan Tengah")).toContain(level);
  });
  it("changes with region and period without inventing history", () => {
    expect(calculateRisk(demo(150), "Riau", 2025, 9).score).toBe(0);
    expect(calculateRisk(demo(150), "Kalimantan Tengah", 2025, 8).score).toBe(
      0,
    );
    const real = parseFirmsCache(cache(), boundaries);
    expect(calculateRisk(real, "Indonesia", 2026, 9)).toMatchObject({
      level: null,
      score: null,
      days: 0,
    });
    expect(calculateRisk(real, "Indonesia", 2026, 10)).toMatchObject({
      days: 3,
      change: null,
    });
  });
  it("does not label stale cache as safe", () => {
    const real = parseFirmsCache(
      { ...cache(), updatedAt: "2000-01-01T00:00:00.000Z" },
      boundaries,
    );
    expect(calculateRisk(real, "Indonesia", 2026, 10).level).toBeNull();
  });
  it("uses prior-year growth only when at least three years exist", () => {
    const dataset = demo(120);
    dataset.years = [2022, 2023, 2024, 2025];
    dataset.records.push(
      ...[2022, 2023, 2024].flatMap((year) =>
        records(30).map((r) => ({
          ...r,
          id: `${year}-${r.id}`,
          year,
          date: `${year}-09-01T00:00:00.000Z`,
        })),
      ),
    );
    expect(calculateRisk(dataset, "Indonesia", 2025, 9)).toMatchObject({
      level: "Siaga",
      score: 90,
      change: 300,
    });
  });
});

describe("FIRMS cache and safe fallback", () => {
  it("normalizes original CSV with sensor, province and provenance", () => {
    const dataset = parseFirmsCache(cache(), boundaries);
    expect(dataset.mode).toBe("firms");
    expect(dataset.years).toEqual([2026]);
    expect(dataset.records).toHaveLength(2);
    expect(dataset.records[0]).toMatchObject({
      isDemo: false,
      source: "MODIS",
      province: "Kalimantan Tengah",
      provenance: { file: "MODIS_NRT", row: 2 },
    });
  });
  it("rejects missing products, invalid rows, invalid dates and out-of-window records", () => {
    expect(() =>
      parseFirmsCache({ ...cache(), products: [] }, boundaries),
    ).toThrow();
    expect(() =>
      parseFirmsCache(
        { ...cache(), coverage: { start: "2026-02-30", end: "2026-10-14" } },
        boundaries,
      ),
    ).toThrow();
    const bad = cache();
    bad.products[0].text = csv("MODIS").replace("-2.3", "NaN");
    expect(() => parseFirmsCache(bad, boundaries)).toThrow();
    const outside = cache();
    outside.products[0].text = csv("MODIS", "2025-01-01");
    expect(() => parseFirmsCache(outside, boundaries)).toThrow();
  });
  it.each([404, 503, 200])(
    "falls back to labeled synthetic data on unusable response %i",
    async (status) => {
      const fetcher = (async () =>
        new Response(status === 200 ? "<html>Vite SPA fallback</html>" : "", {
          status,
        })) as typeof fetch;
      const dataset = await loadObservations(boundaries, undefined, fetcher);
      expect(dataset.mode).toBe("demo");
      expect(dataset.notice).toContain("Mode Demo");
      expect(dataset.records.every((r) => r.isDemo)).toBe(true);
    },
  );
  it("loads a valid cache instead of demo", async () => {
    const fetcher = (async () => Response.json(cache())) as typeof fetch;
    expect((await loadObservations(boundaries, undefined, fetcher)).mode).toBe(
      "firms",
    );
  });
  it("fetches two official endpoints server-side and never stores the key", async () => {
    const urls: string[] = [];
    const fetcher = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(
        csv(String(url).includes("MODIS_NRT") ? "MODIS" : "VIIRS"),
      );
    }) as typeof fetch;
    const result = await collectFirms(
      "fixture-secret-only",
      boundaries,
      fetcher,
      new Date("2026-10-15T05:00:00Z"),
    );
    expect(urls).toHaveLength(2);
    expect(
      urls.every(
        (url) =>
          url.startsWith(
            "https://firms.modaps.eosdis.nasa.gov/api/area/csv/",
          ) && url.endsWith("/3/2026-10-12"),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("fixture-secret-only");
  });
  it("rejects upstream failure and non-CSV responses instead of producing fake real data", async () => {
    await expect(
      collectFirms(
        "fixture-secret-only",
        boundaries,
        (async () => new Response("denied", { status: 403 })) as typeof fetch,
      ),
    ).rejects.toThrow();
    await expect(
      collectFirms(
        "fixture-secret-only",
        boundaries,
        (async () => new Response("Invalid MAP_KEY")) as typeof fetch,
      ),
    ).rejects.toThrow();
  });
});

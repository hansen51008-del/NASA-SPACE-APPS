import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { demoDataService } from "../src/services/nasaDataService";
import { calculateRisk } from "../src/services/riskService";
import {
  layerRecords,
  harmonize,
  largestCell,
} from "../src/services/harmonizationService";
import { analyze } from "../src/services/anomalyService";
import { inPeriod } from "../src/services/coveragePeriod";
import { YEARS } from "../src/types";
import {
  computeDashboard,
  createAnalysisCache,
} from "../src/services/dashboardAnalysis";

it("preserves original counts, scores, anomalies, grid and CSV values across map quality modes", async () => {
  const records = await demoDataService.loadRecords(
    JSON.parse(readFileSync("public/data/indonesia-provinces.geojson", "utf8")),
  );
  const dataset = { records, mode: "demo" as const, years: YEARS, notice: "" };
  const timings: number[] = [];
  for (const [region, month] of [
    ["Indonesia", null],
    ["Riau", 9],
    ["Maluku", 1],
  ] as const) {
    const start = performance.now();
    const risk = calculateRisk(dataset, region, 2025, month);
    const all = layerRecords(records, "Harmonized");
    const regional = all.filter(
      (r) => region === "Indonesia" || r.province === region,
    );
    const selected = regional.filter((r) => inPeriod(r, 2025, month));
    const raw = records.filter(
      (r) =>
        inPeriod(r, 2025, month) &&
        (region === "Indonesia" || r.province === region),
    );
    const csvOf = (items: typeof selected) =>
      items
        .map((r) =>
          [
            r.id,
            "sources" in r ? (r.sources as string[]).join("|") : r.source,
            r.latitude,
            r.longitude,
            r.date,
            r.confidence,
            r.province,
            r.year,
            r.month,
            r.isDemo,
            "memberIds" in r ? (r.memberIds as string[]).join("|") : r.id,
          ]
            .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\r\n");
    const csv = csvOf(selected);
    const result = {
      count: selected.length,
      harmonizedCount: harmonize(raw).length,
      risk,
      anomaly: analyze(regional, 2025, month, YEARS),
      grid: largestCell(selected),
      csv: createHash("sha256").update(csv).digest("hex"),
    };
    timings.push(performance.now() - start);
    expect(result).toMatchSnapshot(`${region}/${month}`);
    const selection = {
      region,
      month,
      year: 2025,
      layer: "Harmonized" as const,
      highOnly: false,
    };
    for (const quality of ["high", "low"]) {
      const next = computeDashboard(dataset, selection);
      expect(
        {
          count: next.selectedActivity.length,
          harmonizedCount: next.harmonizedCount,
          risk: next.risk,
          anomaly: next.anomaly,
          grid: next.gridCount,
          csv: createHash("sha256")
            .update(csvOf(next.selectedActivity))
            .digest("hex"),
        },
        quality,
      ).toEqual(result);
    }
    const cached = createAnalysisCache(dataset);
    expect(cached(selection)).toBe(cached(selection));
  }
  console.log(
    "Original analytics ms per scenario:",
    timings.map((n) => Number(n.toFixed(1))),
  );
}, 30000);

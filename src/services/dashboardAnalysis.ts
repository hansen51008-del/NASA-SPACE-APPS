import type { Layer, Hotspot } from "../types";
import type { RiskIndicator } from "./riskService";
import { MONTHS } from "../types";
import type { ObservationDataset } from "./observationProvider";
import { calculateRisk } from "./riskService";
import { harmonize, layerRecords, largestCell } from "./harmonizationService";
import { analyze, monthlyCounts, regionRanking } from "./anomalyService";
import { inPeriod } from "./coveragePeriod";
export interface AnalysisSelection {
  region: string;
  year: number;
  month: number | null;
  layer: Layer;
  highOnly: boolean;
}
// The original services and the order of province filtering are intentionally unchanged.
export function computeDashboard(
  data: ObservationDataset,
  s: AnalysisSelection,
  prepared?: { rawAll: Hotspot[]; allActivity: Hotspot[]; risk: RiskIndicator },
) {
  const { region, year, month, layer, highOnly } = s;
  const isDemo = data.mode !== "firms",
    years = data.years;
  const coverage = isDemo ? undefined : data.coverage;
  const risk = prepared?.risk ?? calculateRisk(data, region, year, month);
  const rawAll =
    prepared?.rawAll ??
    data.records.filter((r) => !highOnly || r.confidence === "high");
  const allActivity = prepared?.allActivity ?? layerRecords(rawAll, layer);
  const regionalActivity = allActivity.filter(
    (r) => region === "Indonesia" || r.province === region,
  );
  const mapRecords = allActivity.filter((r) =>
    inPeriod(r, year, month, coverage),
  );
  const selectedActivity = mapRecords.filter(
    (r) => region === "Indonesia" || r.province === region,
  );
  const selectedRaw = rawAll.filter(
    (r) =>
      inPeriod(r, year, month, coverage) &&
      (region === "Indonesia" || r.province === region),
  );
  const harmonizedCount = harmonize(selectedRaw).length;
  const counts = monthlyCounts(regionalActivity, year);
  const history = years.map((y) => ({
    year: y,
    counts: monthlyCounts(regionalActivity, y),
  }));
  const earlier = history.filter((h) => h.year < year);
  const baseline = MONTHS.map((_, i) =>
    earlier.length
      ? earlier.reduce((sum, h) => sum + h.counts[i], 0) / earlier.length
      : 0,
  );
  const anomaly = analyze(regionalActivity, year, month, isDemo ? years : []);
  const ranking = regionRanking(mapRecords);
  const activeRegions = new Set(selectedActivity.map((r) => r.province)).size;
  const high = selectedActivity.filter((r) => r.confidence === "high").length;
  const highPercent = selectedActivity.length
    ? Math.round((high / selectedActivity.length) * 100)
    : 0;
  const gridCount = largestCell(selectedActivity);
  const monthAnomalies = MONTHS.map((_, i) =>
    analyze(regionalActivity, year, i + 1, years),
  );
  return {
    risk,
    regionalActivity,
    mapRecords,
    selectedActivity,
    selectedRaw,
    harmonizedCount,
    counts,
    history,
    baseline,
    anomaly,
    ranking,
    activeRegions,
    high,
    highPercent,
    gridCount,
    monthAnomalies,
  };
}
export type DashboardAnalysis = ReturnType<typeof computeDashboard>;
export function createAnalysisCache(data: ObservationDataset) {
  const cache = new Map<string, DashboardAnalysis>();
  const layers = new Map<
    string,
    { rawAll: Hotspot[]; allActivity: Hotspot[] }
  >();
  const risks = new Map<string, RiskIndicator>();
  return (selection: AnalysisSelection, now = Date.now()) => {
    // Include the freshness boundary: a cached score must not stay Aman after expiry.
    const stale =
      data.mode === "firms" &&
      (!data.updatedAt || now - Date.parse(data.updatedAt) > 7 * 86400000);
    const key = JSON.stringify([selection, stale]);
    let value = cache.get(key);
    if (!value) {
      const layerKey = JSON.stringify([selection.layer, selection.highOnly]);
      let prepared = layers.get(layerKey);
      if (!prepared) {
        const rawAll = data.records.filter(
          (r) => !selection.highOnly || r.confidence === "high",
        );
        prepared = {
          rawAll,
          allActivity: layerRecords(rawAll, selection.layer),
        };
        layers.set(layerKey, prepared);
      }
      const riskKey = JSON.stringify([
        selection.region,
        selection.year,
        selection.month,
        stale,
      ]);
      let risk = risks.get(riskKey);
      if (!risk) {
        risk = calculateRisk(
          data,
          selection.region,
          selection.year,
          selection.month,
        );
        risks.set(riskKey, risk);
        if (risks.size > 96) risks.delete(risks.keys().next().value!);
      }
      value = computeDashboard(data, selection, { ...prepared, risk });
      cache.set(key, value);
      if (cache.size > 24) cache.delete(cache.keys().next().value!);
    }
    return value;
  };
}

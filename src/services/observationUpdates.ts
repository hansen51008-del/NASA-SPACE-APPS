import type { ObservationDataset } from "./observationProvider";
import { calculateRisk } from "./riskService";

export function observationUpdates(
  dataset: ObservationDataset,
  regions: readonly string[],
  year: number,
  month: number | null,
) {
  return regions.map((region) => {
    const risk = calculateRisk(dataset, region, year, month);
    return {
      region,
      title: risk.days
        ? `${region}: ${risk.count.toLocaleString("id-ID")} observasi hotspot gabungan dalam periode cakupan`
        : `${region}: belum ada cakupan untuk periode ini`,
      period: risk.period,
      level: risk.level,
      isDemo: dataset.mode === "demo",
      note:
        risk.score === null
          ? risk.note
          : risk.level === "Aman"
            ? "Aktivitas satelit rendah — tetap pantau arahan resmi."
            : "Indikator prototype; tetap pantau arahan resmi.",
    };
  });
}

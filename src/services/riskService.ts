import type { ObservationDataset } from "./observationProvider";
import { analyze } from "./anomalyService";
import { harmonize } from "./harmonizationService";
import { inPeriod } from "./coveragePeriod";

export type RiskLevel = "Aman" | "Waspada" | "Siaga";
export interface RiskIndicator {
  level: RiskLevel | null;
  score: number | null;
  count: number;
  high: number;
  days: number;
  change: number | null;
  points: { activity: number; confidence: number; increase: number };
  period: string;
  note: string;
}
export function calculateRisk(
  dataset: ObservationDataset,
  region: string,
  year: number,
  month: number | null,
): RiskIndicator {
  const wholeCache =
    dataset.mode === "firms" && month === null && dataset.coverage;
  const start = wholeCache
    ? Date.parse(wholeCache.start)
    : Date.UTC(year, month === null ? 0 : month - 1, 1);
  const end = wholeCache
    ? Date.parse(wholeCache.end) + 86400000 - 1
    : Date.UTC(year, month === null ? 12 : month, 1) - 1;
  const coverageStart = dataset.coverage
    ? Date.parse(dataset.coverage.start)
    : start;
  const coverageEnd = dataset.coverage
    ? Date.parse(dataset.coverage.end) + 86400000 - 1
    : end;
  const from = Math.max(start, coverageStart),
    to = Math.min(end, coverageEnd);
  const days = Math.max(0, Math.round((to - from + 1) / 86400000));
  const all = harmonize(dataset.records).filter(
    (r) => region === "Indonesia" || r.province === region,
  );
  const selected = all.filter((r) =>
    inPeriod(
      r,
      year,
      month,
      dataset.mode === "firms" ? dataset.coverage : undefined,
    ),
  );
  const high = selected.filter((r) => r.confidence === "high").length;
  const history =
    dataset.mode === "demo" ? analyze(all, year, month, dataset.years) : null;
  const change = history?.enough ? history.change : null;
  const activity = Math.min(50, (selected.length / Math.max(1, days)) * 10);
  const confidence = Math.min(30, (high / Math.max(1, days)) * 10);
  const increase = change === null ? 0 : Math.min(20, Math.max(0, change) / 5);
  const stale =
    dataset.mode === "firms" &&
    (!dataset.updatedAt ||
      Date.now() - Date.parse(dataset.updatedAt) > 7 * 86400000);
  const available = days > 0 && !stale;
  const score = available ? Math.round(activity + confidence + increase) : null;
  return {
    level:
      score === null
        ? null
        : score < 30
          ? "Aman"
          : score < 60
            ? "Waspada"
            : "Siaga",
    score,
    count: selected.length,
    high,
    days,
    change,
    points: { activity, confidence, increase },
    period: days
      ? `${new Date(from).toISOString().slice(0, 10)} — ${new Date(to).toISOString().slice(0, 10)} (UTC)`
      : "Di luar cakupan data",
    note: stale
      ? "Cache berusia lebih dari 7 hari. Perbarui sebelum menafsirkan status."
      : !days
        ? "Tidak ada cakupan untuk periode ini; bukan berarti tidak ada kebakaran."
        : dataset.mode === "demo"
          ? "Simulasi dengan data sintetis. Bukan status keselamatan aktual."
          : "Cakupan parsial; baseline historis dan cuaca belum tersedia. Tidak ada jaminan seluruh kebakaran terdeteksi.",
  };
}

export function riskBrief(risk: RiskIndicator, region: string) {
  if (risk.score === null)
    return `Status ${region} belum dapat dinilai. ${risk.note} Tetap pantau arahan BPBD/pemerintah setempat.`;
  const reason =
    risk.change !== null && risk.change > 0
      ? `Aktivitas meningkat ${risk.change.toFixed(0)}% dibanding rata-rata periode yang sama pada tahun sebelumnya.`
      : "Penilaian menggunakan jumlah observasi dan keyakinan tinggi per hari dalam cakupan data.";
  const action =
    risk.level === "Siaga"
      ? "Pantau arahan resmi dan siapkan kebutuhan dasar serta rencana komunikasi keluarga."
      : risk.level === "Waspada"
        ? "Periksa perlengkapan siaga dan informasi resmi setempat."
        : "Lanjutkan langkah pencegahan dan pemantauan; label Aman bukan jaminan bebas bahaya.";
  return `${region} berada pada level ${risk.level} (indikator ${risk.score}/100) untuk ${risk.period}, dengan ${risk.count} observasi dan ${risk.high} berkeyakinan tinggi. ${reason} ${action}`;
}

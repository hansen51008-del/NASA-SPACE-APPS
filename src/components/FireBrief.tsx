import { ArrowUpRight, FileText } from "lucide-react";
import type { Hotspot } from "../types";
import { MONTHS, YEARS, number } from "../types";
import {
  analyze,
  monthlyCounts,
  peakMonth,
  regionRanking,
} from "../services/anomalyService";
export function buildBrief(records: Hotspot[], year: number, region: string) {
  const current = records.filter((r) => r.year === year),
    counts = monthlyCounts(records, year);
  if (!current.length)
    return `Tidak ada observasi untuk ${region} pada ${year} dengan filter ini.`;
  const annualMean = current.length / 12;
  const start = counts.findIndex(
    (count, i) => i > 0 && count > counts[i - 1] && count > annualMean,
  );
  const unusual = MONTHS.filter(
    (_, i) => analyze(records, year, i + 1, YEARS).unusual,
  );
  const top = regionRanking(current)[0];
  return `${region} mencatat ${number(current.length)} observasi pada ${year}. ${start >= 0 ? `Aktivitas melampaui rata-rata bulanan tahun tersebut pada ${MONTHS[start]}. ` : ""}Puncak aktivitas terjadi pada ${peakMonth(counts)} (${number(Math.max(...counts))} observasi). ${year < 2023 ? "Diperlukan sedikitnya tiga tahun sebelumnya untuk menilai anomali." : unusual.length ? `${unusual.join(", ")} melampaui rata-rata historis bulanan + 2 simpangan baku.` : "Tidak ada bulan yang melampaui ambang anomali historis."} ${region === "Indonesia" ? `${top[0]} memiliki observasi tahunan terbanyak (${number(top[1])}).` : ""}`;
}
export default function FireBrief({
  records,
  year,
  region,
  onExpand,
}: {
  records: Hotspot[];
  year: number;
  region: string;
  onExpand: () => void;
}) {
  const counts = monthlyCounts(records, year),
    peak = peakMonth(counts);
  const unusual = counts
    .map((_, i) => analyze(records, year, i + 1, YEARS))
    .filter((a) => a.unusual).length;
  return (
    <section className="card brief-card">
      <div className="card-heading">
        <h3>
          <FileText size={16} /> Ringkasan aktivitas
        </h3>
        <span className="subtle-tag">{year}</span>
      </div>
      <div className="brief-insight">
        <span className="brief-line" />
        <p>
          {unusual ? (
            <>
              <strong>{unusual} bulan tidak biasa</strong> tercatat pada {year}.
            </>
          ) : (
            <>
              <strong>
                {peak === "Tidak ada aktivitas"
                  ? "Tidak ada aktivitas teramati"
                  : `${peak} adalah periode puncak`}
              </strong>{" "}
              pada {year}.
            </>
          )}
        </p>
      </div>
      <p className="brief-copy">{buildBrief(records, year, region)}</p>
      <button className="brief-button" onClick={onExpand}>
        <FileText size={14} /> Baca ringkasan lengkap <ArrowUpRight size={15} />
      </button>
    </section>
  );
}

import { ArrowRightLeft } from "lucide-react";
import { YEARS, number } from "../types";
import type { Hotspot } from "../types";
import { analyze, monthlyCounts, peakMonth } from "../services/anomalyService";
export default function YearComparison({
  records,
  year,
  comparisonYear,
  onChange,
  region,
}: {
  records: Hotspot[];
  year: number;
  comparisonYear: number;
  onChange: (year: number) => void;
  region: string;
}) {
  const current = records.filter((r) => r.year === year).length,
    previous = records.filter((r) => r.year === comparisonYear).length;
  return (
    <section className="card comparison-card">
      <div className="card-heading">
        <h3>
          <ArrowRightLeft size={16} /> Bandingkan tahun
        </h3>
        <span className="subtle-tag">{region}</span>
      </div>
      <p className="helper">
        Observasi sepanjang tahun · lapisan dan filter keyakinan terpilih
      </p>
      <div className="comparison-grid">
        <div>
          <span className="eyebrow">TAHUN TERPILIH · {year}</span>
          <strong>{number(current)}</strong>
          <span>Puncak: {peakMonth(monthlyCounts(records, year))}</span>
          <span>
            {analyze(records, year, null, YEARS).enough
              ? analyze(records, year, null, YEARS).unusual
                ? "Aktivitas tahunan tidak biasa"
                : "Dalam rentang historis"
              : "Baseline belum mencukupi"}
          </span>
        </div>
        <ArrowRightLeft className="muted" size={23} />
        <div>
          <select
            aria-label="Tahun pembanding"
            value={comparisonYear}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <strong>{number(previous)}</strong>
          <span>
            Puncak: {peakMonth(monthlyCounts(records, comparisonYear))}
          </span>
          <span>
            {analyze(records, comparisonYear, null, YEARS).enough
              ? analyze(records, comparisonYear, null, YEARS).unusual
                ? "Aktivitas tahunan tidak biasa"
                : "Dalam rentang historis"
              : "Baseline belum mencukupi"}
          </span>
        </div>
        <div className="comparison-change">
          <strong>
            {previous
              ? `${current >= previous ? "+" : ""}${(((current - previous) / previous) * 100).toFixed(1)}%`
              : "N/A"}
          </strong>
          <span>perubahan aktivitas</span>
        </div>
      </div>
    </section>
  );
}

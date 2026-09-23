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
    return `No observations for ${region} in ${year} under the current filters.`;
  const annualMean = current.length / 12;
  const start = counts.findIndex(
    (count, i) => i > 0 && count > counts[i - 1] && count > annualMean,
  );
  const unusual = MONTHS.filter(
    (_, i) => analyze(records, year, i + 1, YEARS).unusual,
  );
  const top = regionRanking(current)[0];
  return `${region} recorded ${number(current.length)} activity observations in ${year}. ${start >= 0 ? `Activity rose above the annual monthly average in ${MONTHS[start]}. ` : ""}Activity peaked in ${peakMonth(counts)} (${number(Math.max(...counts))} observations). ${year < 2023 ? "At least three earlier years are needed to assess anomalies." : unusual.length ? `${unusual.join(", ")} exceeded the prior-year monthly mean + 2 standard deviations.` : "No month exceeded the historical anomaly threshold."} ${region === "Indonesia" ? `${top[0]} had the highest annual activity (${number(top[1])}).` : ""}`;
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
          <FileText size={16} /> Fire brief
        </h3>
        <span className="subtle-tag">{year}</span>
      </div>
      <div className="brief-insight">
        <span className="brief-line" />
        <p>
          {unusual ? (
            <>
              <strong>
                {unusual} unusual {unusual === 1 ? "month" : "months"}
              </strong>{" "}
              identified in {year}.
            </>
          ) : (
            <>
              <strong>
                {peak === "No activity"
                  ? "No observed activity"
                  : `${peak} is the peak period`}
              </strong>{" "}
              for {year}.
            </>
          )}
        </p>
      </div>
      <p className="brief-copy">{buildBrief(records, year, region)}</p>
      <button className="brief-button" onClick={onExpand}>
        <FileText size={14} /> Read full brief <ArrowUpRight size={15} />
      </button>
    </section>
  );
}

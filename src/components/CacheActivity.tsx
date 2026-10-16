import type { Hotspot } from "../types";
import { number } from "../types";
import type { Coverage } from "../services/coveragePeriod";
import { coveredMonth } from "../services/coveragePeriod";

export default function CacheActivity({
  records,
  coverage,
  year,
  month,
}: {
  records: Hotspot[];
  coverage: Coverage;
  year: number;
  month: number | null;
}) {
  if (month !== null && !coveredMonth(coverage, year, month))
    return (
      <section className="card cache-activity">
        <h3>Belum dapat dinilai</h3>
        <p>Periode ini berada di luar cakupan cache.</p>
      </section>
    );
  const days: { date: string; count: number }[] = [];
  for (
    let time = Date.parse(coverage.start);
    time <= Date.parse(coverage.end);
    time += 86400000
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    if (
      month !== null &&
      (Number(date.slice(0, 4)) !== year || Number(date.slice(5, 7)) !== month)
    )
      continue;
    days.push({
      date,
      count: records.filter((r) => r.date.startsWith(date)).length,
    });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <section
      className="card cache-activity"
      aria-label="Aktivitas dalam cakupan cache"
    >
      <div className="card-heading">
        <h3>Observasi per hari</h3>
        <span className="subtle-tag">UTC</span>
      </div>
      <p className="helper">
        Hanya tanggal yang tercakup cache. Angka mengikuti wilayah dan filter
        peta, bukan riwayat lengkap atau prakiraan.
      </p>
      <ul>
        {days.map((day) => (
          <li key={day.date}>
            <time dateTime={day.date}>
              {new Date(`${day.date}T00:00:00Z`).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </time>
            <span className="cache-bar" aria-hidden="true">
              <i style={{ width: `${(day.count / max) * 100}%` }} />
            </span>
            <strong>
              {number(day.count)} <small>observasi</small>
            </strong>
          </li>
        ))}
      </ul>
      <p className="helper">
        Nol berarti tidak ada deteksi dalam data dan filter ini, bukan jaminan
        tidak ada kebakaran.
      </p>
    </section>
  );
}

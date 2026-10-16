import { MONTHS, number } from "../types";
export default function ActivityCalendar({
  data,
  selectedYear,
  onSelect,
}: {
  data: { year: number; counts: number[] }[];
  selectedYear: number;
  onSelect: (year: number, month: number) => void;
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.counts));
  return (
    <section className="card calendar-card">
      <div className="card-heading">
        <h3>Pola historis</h3>
        <span className="subtle-tag">2020–2025</span>
      </div>
      <p className="helper">Pola musiman dalam enam tahun demo</p>
      <div className="calendar-grid">
        <span />
        {MONTHS.map((m) => (
          <span className="calendar-month" key={m}>
            {m[0]}
          </span>
        ))}
        {data.map(({ year, counts }) => (
          <div className="calendar-row" key={year}>
            <span className={year === selectedYear ? "current-year" : ""}>
              {year}
            </span>
            {counts.map((n, i) => (
              <button
                key={i}
                className={year === selectedYear ? "selected-year-cell" : ""}
                style={{
                  backgroundColor: n
                    ? `color-mix(in srgb, #ee824a ${10 + (n / max) * 90}%, #242c25)`
                    : "#252c27",
                }}
                onClick={() => onSelect(year, i + 1)}
                aria-label={`${MONTHS[i]} ${year}: ${number(n)} observasi`}
                title={`${MONTHS[i]} ${year} · ${number(n)} observasi`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="calendar-legend">
        <span>Lebih sedikit</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <i
            key={n}
            style={{
              backgroundColor: `color-mix(in srgb, #ee824a ${10 + n * 22}%, #242c25)`,
            }}
          />
        ))}
        <span>Lebih banyak</span>
      </div>
    </section>
  );
}

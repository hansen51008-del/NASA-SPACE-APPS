import { useState } from "react";
import { MONTHS, number } from "../types";
export default function HotspotTrend({
  counts,
  baseline,
  baselineAvailable,
  year,
  onMonth,
}: {
  counts: number[];
  baseline: number[];
  baselineAvailable: boolean;
  year: number;
  onMonth: (m: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...counts, ...baseline) * 1.12;
  const point = (n: number, i: number) =>
    `${48 + i * 43.5},${157 - (n / max) * 128}`;
  const currentPath = counts
    .map((n, i) => `${i ? "L" : "M"}${point(n, i)}`)
    .join(" ");
  return (
    <section className="card trend-card">
      <div className="card-heading">
        <h3>Aktivitas dari waktu ke waktu</h3>
        <span className="subtle-tag">BULANAN</span>
      </div>
      <div className="chart-legend">
        <span>
          <i className="orange-line" />
          {year}
        </span>
        <span>
          <i className="dashed-line" />
          {baselineAvailable
            ? "Rata-rata tahun sebelumnya"
            : "Baseline belum tersedia"}
        </span>
        <span className="chart-unit">Observasi</span>
      </div>
      <svg
        viewBox="0 0 560 190"
        role="group"
        aria-label={`Grafik aktivitas bulanan ${year}`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ec753d" stopOpacity=".23" />
            <stop offset="1" stopColor="#ec753d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2="532"
              y1={157 - (i * 128) / 3}
              y2={157 - (i * 128) / 3}
              stroke="#3c5260"
              strokeDasharray="3 5"
            />
            <text
              x="35"
              y={161 - (i * 128) / 3}
              textAnchor="end"
              className="chart-label"
            >
              {number(Math.round((max * i) / 3))}
            </text>
          </g>
        ))}
        <path
          d={`${currentPath} L526.5,157 L48,157 Z`}
          fill="url(#chart-fill)"
        />
        {baselineAvailable && (
          <path
            d={baseline
              .map((n, i) => `${i ? "L" : "M"}${point(n, i)}`)
              .join(" ")}
            fill="none"
            stroke="#748578"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
        )}
        <path
          d={currentPath}
          fill="none"
          stroke="#ef854b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {hover !== null && (
          <line
            x1={48 + hover * 43.5}
            x2={48 + hover * 43.5}
            y1="12"
            y2="157"
            stroke="#d8e9df"
            strokeOpacity=".55"
            strokeDasharray="3 4"
            pointerEvents="none"
          />
        )}
        {counts.map((n, i) => (
          <g
            key={i}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onClick={() => onMonth(i + 1)}
            role="button"
            tabIndex={0}
            aria-label={`${MONTHS[i]} ${year}: ${number(n)} observasi; pilih bulan`}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onMonth(i + 1);
              }
            }}
            className="chart-point"
          >
            <rect
              x={30 + i * 43.5}
              y="15"
              width="35"
              height="155"
              fill="transparent"
            />
            <circle
              cx={48 + i * 43.5}
              cy={157 - (n / max) * 128}
              r={hover === i ? 5 : 2.8}
              fill="#ef854b"
            />
            <text
              x={48 + i * 43.5}
              y="183"
              textAnchor="middle"
              className="chart-label"
            >
              {MONTHS[i]}
            </text>
          </g>
        ))}
        {hover !== null && (
          <g
            className="trend-tooltip"
            pointerEvents="none"
            transform={`translate(${Math.max(47, Math.min(390, 48 + hover * 43.5 - 67))} 3)`}
          >
            <rect
              width="145"
              height="49"
              rx="6"
              fill="#223b43"
              stroke="#789b97"
            />
            <text x="11" y="17" fill="#dceee4" fontSize="10">
              {MONTHS[hover]} {year}
            </text>
            <text x="11" y="35" fill="#ffbe8a" fontSize="12" fontWeight="600">
              {number(counts[hover])}
              <tspan fill="#abc4cc" fontSize="9" fontWeight="400">
                {" "}
                observasi
              </tspan>
            </text>
          </g>
        )}
      </svg>
      <div className="chart-caption">
        {hover !== null
          ? `${MONTHS[hover]} ${year}: ${number(counts[hover])} observasi · baseline ${baselineAvailable ? number(Math.round(baseline[hover])) : "belum tersedia"}`
          : baselineAvailable
            ? "Pilih bulan untuk melihat aktivitasnya di peta."
            : "Belum ada tahun sebelumnya untuk baseline historis."}
      </div>
    </section>
  );
}

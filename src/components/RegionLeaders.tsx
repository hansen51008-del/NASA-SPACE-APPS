import { ArrowUpRight, MapPin } from "lucide-react";
import { number } from "../types";
export default function RegionLeaders({
  ranking,
  selected,
  period,
  onSelect,
}: {
  ranking: [string, number][];
  selected: string;
  period: string;
  onSelect: (name: string) => void;
}) {
  const total = ranking.reduce((sum, [, n]) => sum + n, 0);
  return (
    <section
      className="region-leaders"
      aria-label="Provinces ranked by activity"
    >
      <div className="leaders-heading">
        <div>
          <MapPin size={14} />
          <h3>Where activity concentrates</h3>
        </div>
        <span>{period} · Nationwide</span>
      </div>
      <div className="leaders-list">
        {ranking.slice(0, 5).map(([name, count], index) => (
          <button
            key={name}
            className={selected === name ? "selected" : ""}
            aria-label={`Explore ${name}`}
            aria-pressed={selected === name}
            onClick={() => onSelect(name)}
          >
            <span className="leader-rank">0{index + 1}</span>
            <div className="leader-data">
              <span className="leader-name">{name}</span>
              <div className="leader-stat">
                <strong>{number(count)}</strong>
                <span>{((count / total) * 100).toFixed(1)}% of total</span>
              </div>
              <span className="leader-meter">
                <i style={{ width: `${(count / ranking[0][1]) * 100}%` }} />
              </span>
            </div>
            <ArrowUpRight size={13} />
          </button>
        ))}
        {!ranking.length && (
          <p className="helper">No observations in the selected period.</p>
        )}
      </div>
    </section>
  );
}

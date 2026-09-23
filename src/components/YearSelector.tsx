import { CalendarDays, ChevronDown } from "lucide-react";
import { YEARS } from "../types";
export default function YearSelector({
  year,
  onChange,
}: {
  year: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="year-select">
      <CalendarDays size={16} />
      <span className="muted">Year</span>
      <select
        aria-label="Observation year"
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {YEARS.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

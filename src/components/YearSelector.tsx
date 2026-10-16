import { CalendarDays, ChevronDown } from "lucide-react";
import { YEARS } from "../types";
export default function YearSelector({
  year,
  onChange,
  years = YEARS,
}: {
  year: number;
  years?: number[];
  onChange: (n: number) => void;
}) {
  return (
    <label className="year-select">
      <CalendarDays size={16} />
      <span className="muted">Tahun</span>
      <select
        aria-label="Tahun observasi"
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

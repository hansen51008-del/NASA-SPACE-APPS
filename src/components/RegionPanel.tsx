import {
  ArrowUpRight,
  MapPin,
  SlidersHorizontal,
  Info,
  ChevronDown,
} from "lucide-react";
import type { Hotspot, Layer } from "../types";
import { number } from "../types";
import { peakMonth } from "../services/anomalyService";
import type { analyze } from "../services/anomalyService";
import LayerSelector from "./LayerSelector";
interface Props {
  region: string;
  regions: string[];
  onRegion: (r: string) => void;
  year: number;
  layer: Layer;
  setLayer: (l: Layer) => void;
  raw: Hotspot[];
  activity: number;
  counts: number[];
  anomaly: ReturnType<typeof analyze>;
  markers: boolean;
  setMarkers: (v: boolean) => void;
  borders: boolean;
  setBorders: (v: boolean) => void;
  density: boolean;
  setDensity: (v: boolean) => void;
  highOnly: boolean;
  setHighOnly: (v: boolean) => void;
  onMethod: () => void;
  month: number | null;
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-label">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" />
    </label>
  );
}
export default function RegionPanel(p: Props) {
  return (
    <aside className="region-panel">
      <LayerSelector value={p.layer} onChange={p.setLayer} />
      <section className="panel-section">
        <div className="eyebrow">
          <SlidersHorizontal size={13} /> MAP DISPLAY
        </div>
        <Toggle
          label="Hotspot detections"
          checked={p.markers}
          onChange={p.setMarkers}
        />
        <Toggle
          label="Province boundaries"
          checked={p.borders}
          onChange={p.setBorders}
        />
        <Toggle
          label="Activity intensity"
          checked={p.density}
          onChange={p.setDensity}
        />
        <Toggle
          label="High confidence only"
          checked={p.highOnly}
          onChange={p.setHighOnly}
        />
      </section>
      <section className="panel-section area-section">
        <div className="eyebrow">
          <MapPin size={13} /> AREA OF INTEREST
        </div>
        <div className="region-select">
          <select
            aria-label="Area of interest"
            value={p.region}
            onChange={(e) => p.onRegion(e.target.value)}
          >
            <option>Indonesia</option>
            {p.regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="region-subtitle">
          {p.region === "Indonesia" ? "National overview" : "Province overview"}
          <span>
            {p.year} · {p.month ? "Selected month" : "Full year"}
          </span>
        </div>
        <div className="region-total">
          <strong>{number(p.raw.length)}</strong>
          <span>detected hotspots</span>
        </div>
        <div className="sensor-split">
          <div>
            <span>
              <i className="sensor-dot modis" />
              MODIS
            </span>
            <strong>
              {number(p.raw.filter((r) => r.source === "MODIS").length)}
            </strong>
          </div>
          <div>
            <span>
              <i className="sensor-dot viirs" />
              VIIRS
            </span>
            <strong>
              {number(p.raw.filter((r) => r.source === "VIIRS").length)}
            </strong>
          </div>
        </div>
        <dl className="region-stats">
          <div>
            <dt>Harmonized observations</dt>
            <dd>{number(p.activity)}</dd>
          </div>
          <div>
            <dt>High-confidence detections</dt>
            <dd>
              {number(p.raw.filter((r) => r.confidence === "high").length)}
            </dd>
          </div>
          <div>
            <dt>
              Peak month <span className="muted">(year)</span>
            </dt>
            <dd>{peakMonth(p.counts)}</dd>
          </div>
        </dl>
        <div className={`anomaly-note ${p.anomaly.unusual ? "unusual" : ""}`}>
          <ArrowUpRight size={16} />
          <div>
            <strong>
              {!p.anomaly.enough
                ? "Building a baseline"
                : p.anomaly.unusual
                  ? "Unusual activity"
                  : "Within historical range"}
            </strong>
            <p>
              {p.anomaly.change === null
                ? "No historical comparison available"
                : `${p.anomaly.change >= 0 ? "+" : ""}${p.anomaly.change.toFixed(1)}% vs. prior-year average`}
            </p>
          </div>
        </div>
      </section>
      <button className="method-link" onClick={p.onMethod}>
        <Info size={14} /> How harmonization works <ArrowUpRight size={14} />
      </button>
    </aside>
  );
}

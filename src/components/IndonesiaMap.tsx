import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { geoArea, geoGraticule, geoMercator, geoPath } from "d3-geo";
import {
  Crosshair,
  Minus,
  Plus,
  Compass,
  Maximize2,
  Minimize2,
  MapPin,
  X,
  Box,
  Map as MapIcon,
  Palette,
  Check,
} from "lucide-react";
import type { Hotspot, Provinces } from "../types";
import { number } from "../types";
import { provinceColour } from "./mapAppearance";
import HotspotSymbols from "./HotspotSymbols";
const TerrainMap = lazy(() => import("./TerrainMap"));
interface Props {
  boundaries: Provinces;
  records: Hotspot[];
  selected: string;
  onSelect: (name: string) => void;
  showMarkers: boolean;
  showBorders: boolean;
  density: boolean;
  onDensityChange: (enabled: boolean) => void;
}
const labels: [string, number, number][] = [
  ["SUMATRA", 101.4, -0.4],
  ["KALIMANTAN", 114.2, 0.5],
  ["SULAWESI", 121.4, -2.7],
  ["PAPUA", 136.8, -3.6],
  ["JAVA", 110.7, -7.7],
  ["MALUKU", 128.9, -2.4],
  ["BALI & NUSA TENGGARA", 119, -9.8],
];
export default function IndonesiaMap({
  boundaries,
  records,
  selected,
  onSelect,
  showMarkers,
  showBorders,
  density,
  onDensityChange,
}: Props) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [dimensional, setDimensional] = useState(true);
  const mapPanel = useRef<HTMLDivElement>(null);
  const fallbackFullscreen = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = async () => {
    const panel = mapPanel.current;
    if (!panel) return;
    if (fullscreen) {
      if (document.fullscreenElement === panel) await document.exitFullscreen();
      fallbackFullscreen.current = false;
      setFullscreen(false);
    } else {
      try {
        await panel.requestFullscreen();
      } catch {
        fallbackFullscreen.current = true;
      }
      setFullscreen(true);
    }
  };
  useEffect(() => {
    const changed = () => {
      if (!fallbackFullscreen.current)
        setFullscreen(document.fullscreenElement === mapPanel.current);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fallbackFullscreen.current) {
        fallbackFullscreen.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);
  const [provinceColours, setProvinceColours] = useState(true);
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const projection = useMemo(
    () => geoMercator().center([118, -2.3]).scale(1150).translate([500, 226]),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(
    () =>
      geoGraticule()
        .extent([
          [94, -12],
          [143, 9],
        ])
        .step([5, 5])(),
    [],
  );
  const features = useMemo(
    () =>
      boundaries.features.map((feature) => {
        const copy = structuredClone(feature);
        if (geoArea(copy) > Math.PI * 2) {
          if (copy.geometry.type === "Polygon")
            copy.geometry.coordinates.forEach((r) => r.reverse());
          else
            copy.geometry.coordinates.forEach((p) =>
              p.forEach((r) => r.reverse()),
            );
        }
        return copy;
      }),
    [boundaries],
  );
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    records.forEach((r) =>
      result.set(r.province, (result.get(r.province) ?? 0) + 1),
    );
    return result;
  }, [records]);
  const highCounts = useMemo(() => {
    const result = new Map<string, number>();
    records.forEach((record) => {
      if (record.confidence === "high")
        result.set(record.province, (result.get(record.province) ?? 0) + 1);
    });
    return result;
  }, [records]);
  const shapes = useMemo(
    () =>
      features.map((feature) => ({
        feature,
        d: path(feature) ?? "",
        colour: provinceColour(
          feature.properties.PROVINSI,
          feature.properties.KODE_PROV,
        ),
        gradientId: `province-colour-${feature.properties.PROVINSI.replaceAll(" ", "-")}`,
      })),
    [features, path],
  );
  // Consolidate overlapping map symbols only. Analytical counts retain every observation.
  const symbols = useMemo(() => {
    const cells = new Map<
      string,
      { record: Hotspot; high: boolean; count: number }
    >();
    records.forEach((record) => {
      const key = `${record.province}:${Math.floor(record.longitude / 0.04)}:${Math.floor(record.latitude / 0.04)}`;
      const cell = cells.get(key);
      if (cell) {
        cell.count++;
        cell.high ||= record.confidence === "high";
      } else
        cells.set(key, {
          record,
          count: 1,
          high: record.confidence === "high",
        });
    });
    return [...cells.values()];
  }, [records]);
  const maxCount = Math.max(1, ...counts.values());
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  return (
    <div
      ref={mapPanel}
      className={`map-canvas atlas-map ${dimensional ? "is-dimensional" : "is-flat"} ${fullscreen ? "is-fullscreen" : ""}`}
    >
      <div className="map-topline">
        <span>
          <span className="status-dot" /> INDONESIAN ARCHIPELAGO{" "}
          <span className="map-divider">/</span> 38 PROVINCES
        </span>
        <span className="map-coordinate">2.30° S &nbsp; 118.00° E</span>
      </div>
      <div className="map-view-switch" aria-label="Map appearance">
        <button
          aria-pressed={dimensional}
          onClick={() => setDimensional(true)}
          title="Real elevation, mountains and valleys"
        >
          <Box size={13} />
          3D
        </button>
        <button
          aria-pressed={!dimensional}
          onClick={() => setDimensional(false)}
        >
          <MapIcon size={13} />
          2D
        </button>
        <button
          className="province-colour-toggle"
          aria-pressed={provinceColours && !density}
          onClick={() => {
            if (density) {
              onDensityChange(false);
              setProvinceColours(true);
            } else setProvinceColours((value) => !value);
          }}
          title={
            density
              ? "Switch from activity intensity to province colours"
              : "Toggle province colours"
          }
        >
          <Palette size={13} />
          Province colours{provinceColours && !density && <Check size={12} />}
        </button>
        <button
          onClick={toggleFullscreen}
          aria-label={
            fullscreen ? "Exit map fullscreen" : "Enter map fullscreen"
          }
          aria-pressed={fullscreen}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      {dimensional ? (
        <Suspense
          fallback={
            <div className="terrain-loading">Loading terrain viewer…</div>
          }
        >
          <TerrainMap
            boundaries={boundaries}
            records={records}
            selected={selected}
            onSelect={onSelect}
            showMarkers={showMarkers}
            showBorders={showBorders}
            density={density}
            provinceColours={provinceColours}
            onFallback={() => setDimensional(false)}
          />
        </Suspense>
      ) : (
        <svg
          className="geography"
          viewBox="0 0 1000 440"
          aria-label="Interactive map of Indonesian provinces"
          onPointerDown={(e) => {
            if (e.button === 0)
              setDrag({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
          }}
          onPointerMove={(e) => {
            if (drag && e.buttons === 1) {
              const scale =
                1000 / e.currentTarget.getBoundingClientRect().width;
              setPan({
                x: drag.px + (e.clientX - drag.x) * scale,
                y: drag.py + (e.clientY - drag.y) * scale,
              });
            }
          }}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => {
            setDrag(null);
            setHover(null);
          }}
        >
          <defs>
            <pattern
              id="map-grid"
              width="70"
              height="70"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 70 0 L 0 0 0 70"
                fill="none"
                stroke="#526a7a"
                strokeWidth=".6"
                opacity=".15"
              />
            </pattern>
            <radialGradient id="map-light">
              <stop stopColor="#304553" stopOpacity=".32" />
              <stop offset="1" stopColor="#111c24" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="land-fill" x1="0" y1="0" x2=".8" y2="1">
              <stop stopColor="#91a38a" />
              <stop offset=".5" stopColor="#738d78" />
              <stop offset="1" stopColor="#5f796c" />
            </linearGradient>
            {shapes.map(({ gradientId, colour }) => (
              <linearGradient
                key={gradientId}
                id={gradientId}
                x1="0"
                y1="0"
                x2=".65"
                y2="1"
              >
                <stop
                  stopColor={`color-mix(in srgb, ${colour} 78%, #eff4c9)`}
                />
                <stop offset=".45" stopColor={colour} />
                <stop
                  offset="1"
                  stopColor={`color-mix(in srgb, ${colour} 80%, #213c37)`}
                />
              </linearGradient>
            ))}
            <filter
              id="island-shadow"
              x="-20%"
              y="-30%"
              width="145%"
              height="170%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter
              id="coast-softness"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>
          <rect width="1000" height="440" fill="url(#map-grid)" />
          <rect width="1000" height="440" fill="url(#map-light)" />
          <g
            transform={`translate(${500 + pan.x} ${220 + pan.y}) scale(${zoom}) translate(-500 -220)`}
          >
            <g className="atlas-plane">
              <path d={path(graticule) ?? ""} className="graticule" />
              <line
                x1="15"
                x2="985"
                y1={projection([118, 0])![1]}
                y2={projection([118, 0])![1]}
                className="equator"
              />
              {[100, 110, 120, 130, 140].map((lon) => (
                <text
                  key={lon}
                  x={projection([lon, 0])![0]}
                  y="48"
                  className="coordinate-label"
                >
                  {lon}° E
                </text>
              ))}
              {[-10, -5, 0, 5].map((lat) => (
                <text
                  key={lat}
                  x="12"
                  y={projection([118, lat])![1] - 6}
                  className="coordinate-label"
                >
                  {Math.abs(lat)}°{lat === 0 ? "" : lat > 0 ? " N" : " S"}
                </text>
              ))}
              <text x="332" y="120" className="water-label">
                MALAYSIA
              </text>
              <text x="641" y="85" className="water-label">
                PHILIPPINES
              </text>
              <text x="214" y="326" className="ocean-label">
                INDIAN OCEAN
              </text>
              <text x="701" y="340" className="ocean-label">
                BANDA SEA
              </text>
              <text x="835" y="100" className="ocean-label">
                PACIFIC OCEAN
              </text>
              <text x="442" y="312" className="ocean-label">
                JAVA SEA
              </text>
              <g
                className="coastal-water"
                pointerEvents="none"
                aria-hidden="true"
              >
                {shapes.map(({ feature, d }) => (
                  <path
                    key={feature.properties.PROVINSI}
                    d={d}
                    fill="none"
                    stroke="#51b6b1"
                    strokeWidth="12"
                    opacity=".06"
                    filter="url(#coast-softness)"
                  />
                ))}
                {shapes.map(({ feature, d }) => (
                  <path
                    key={feature.properties.PROVINSI}
                    d={d}
                    fill="none"
                    stroke="#7bcebf"
                    strokeWidth="4"
                    opacity=".1"
                  />
                ))}
              </g>
              <g className="island-surface">
                {shapes.map(({ feature, d, gradientId }) => {
                  const name = feature.properties.PROVINSI;
                  const isSelected = selected === name;
                  return (
                    <path
                      key={name}
                      d={d}
                      className={`province ${isSelected ? "selected" : ""}`}
                      style={{
                        fill: isSelected
                          ? "#bbd7ac"
                          : density && counts.has(name)
                            ? `color-mix(in srgb, #ef7138 ${15 + ((counts.get(name) ?? 0) / maxCount) * 60}%, #263741)`
                            : provinceColours
                              ? `url(#${gradientId})`
                              : "url(#land-fill)",
                        strokeOpacity: showBorders ? 1 : 0.12,
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${name}`}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(name);
                        }
                      }}
                      onPointerEnter={() => setHover(name)}
                      onPointerLeave={() => setHover(null)}
                    >
                      <title>
                        {name}: {number(counts.get(name) ?? 0)} observations
                      </title>
                    </path>
                  );
                })}
                {showMarkers && (
                  <HotspotSymbols
                    symbols={symbols}
                    projection={projection}
                    selected={selected}
                  />
                )}
                <g pointerEvents="none">
                  {labels.map(([label, lon, lat]) => {
                    const p = projection([lon, lat])!;
                    return (
                      <text
                        key={label}
                        x={p[0]}
                        y={p[1]}
                        className="island-label"
                      >
                        {label}
                      </text>
                    );
                  })}
                </g>
              </g>
            </g>
          </g>
        </svg>
      )}
      {hover && (
        <div className="map-tooltip">
          <strong>{hover}</strong>
          <div className="map-hover-count">
            <b>{number(counts.get(hover) ?? 0)}</b>
            <span>observations</span>
          </div>
          <div className="map-hover-details">
            <span>
              High confidence <b>{number(highCounts.get(hover) ?? 0)}</b>
            </span>
            <span>
              National share{" "}
              <b>
                {records.length
                  ? (((counts.get(hover) ?? 0) / records.length) * 100).toFixed(
                      1,
                    )
                  : "0.0"}
                %
              </b>
            </span>
          </div>
          <span className="hover-prompt">Click to explore this province ↗</span>
        </div>
      )}
      {!dimensional && (
        <div className="map-tools">
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(4, z + 0.35))}
          >
            <Plus size={17} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.35))}
          >
            <Minus size={17} />
          </button>
          <span />
          <button aria-label="Reset map view" onClick={reset}>
            <Crosshair size={17} />
          </button>
          <button aria-label="Fit Indonesia to view" onClick={reset}>
            <Maximize2 size={16} />
          </button>
        </div>
      )}
      {!dimensional && (
        <div className="map-compass">
          <span>N</span>
          <Compass size={28} strokeWidth={1} />
        </div>
      )}
      <div className="map-selection">
        <MapPin size={13} />
        <span>
          {selected === "Indonesia" ? "Explore all 38 provinces" : selected}
        </span>
        {selected !== "Indonesia" && (
          <strong className="selected-count">
            {number(counts.get(selected) ?? 0)} <small>obs.</small>
          </strong>
        )}
        {selected === "Indonesia" ? (
          <span className="selection-hint">CLICK TO SELECT</span>
        ) : (
          <button
            aria-label="Clear province selection"
            onClick={() => onSelect("Indonesia")}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {!dimensional && (
        <div className="map-legend">
          <span className="legend-title">
            {density ? "PROVINCE ACTIVITY" : "DETECTION CONFIDENCE"}
          </span>
          <span className="legend-gradient" />
          <span>{density ? "Low" : "Low / nominal"}</span>
          <span>High</span>
          {showMarkers && (
            <small className="symbol-explanation">
              Stylized detection markers
            </small>
          )}
        </div>
      )}
      <div className="map-source">
        Boundaries:{" "}
        <a
          href="https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces"
          target="_blank"
          rel="noreferrer"
        >
          Deny Herianto · CC BY 4.0
        </a>{" "}
        <span>•</span> Demo observations
      </div>
      {!records.length && (
        <div className="map-empty">No observations for these filters.</div>
      )}
    </div>
  );
}

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { GeoProjection } from "d3-geo";
import type { Hotspot } from "../types";

export interface MapSymbol {
  record: Hotspot;
  high: boolean;
  count: number;
}

// All symbols stay anchored to observed coordinates. Decorative flames do not
// represent measured flame height, individual incidents, or a burned perimeter.
export default function HotspotSymbols({
  symbols,
  projection,
  selected,
  onInspect,
}: {
  symbols: MapSymbol[];
  projection: GeoProjection;
  selected: string;
  onInspect: (record: Hotspot) => void;
}) {
  const flameIds = useMemo(() => {
    const occupied = new Set<string>();
    const ids = new Set<string>();
    const candidates = symbols
      .filter(
        (symbol) =>
          selected === "Indonesia" || symbol.record.province === selected,
      )
      .sort(
        (a, b) => b.count - a.count || a.record.id.localeCompare(b.record.id),
      );
    for (const { record, high } of candidates) {
      if (!high) continue;
      const cell = `${Math.floor(record.longitude / 0.32)}:${Math.floor(record.latitude / 0.32)}`;
      if (occupied.has(cell)) continue;
      occupied.add(cell);
      ids.add(record.id);
      if (ids.size >= 100) break;
    }
    return ids;
  }, [symbols, selected]);

  return (
    <g className="hotspot-symbols" pointerEvents="none">
      <defs>
        <radialGradient id="ember-halo">
          <stop stopColor="#ffd67e" stopOpacity=".6" />
          <stop offset=".32" stopColor="#ff8a2c" stopOpacity=".35" />
          <stop offset="1" stopColor="#fb4b16" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="flame-outer" x1="0" y1="1" x2="0" y2="0">
          <stop stopColor="#f34819" />
          <stop offset=".5" stopColor="#ff942d" />
          <stop offset="1" stopColor="#ffd27a" />
        </linearGradient>
        <linearGradient id="flame-inner" x1="0" y1="1" x2="0" y2="0">
          <stop stopColor="#fff5c0" />
          <stop offset="1" stopColor="#ffd36c" />
        </linearGradient>
        <g id="flame-shape">
          <path
            d="M0 1 C-5 0 -5 -4 -2.5 -7 C-2.6 -4 -.8 -3 -.5 -5 C1 -8 -.7 -10 1.5 -13 C1 -8 5 -6 4 -2 C3.5 .1 2 1 0 1Z"
            fill="url(#flame-outer)"
          />
          <path
            d="M0 .5 C-2.5 -.3 -2 -3 -.5 -5 C-.4 -3 2 -3 1.8 -1.3 C1.6 0 .8 .6 0 .5Z"
            fill="url(#flame-inner)"
          />
        </g>
      </defs>
      {symbols.map(({ record, high, count }) => {
        const p = projection([record.longitude, record.latitude]);
        if (!p) return null;
        const focus = selected === "Indonesia" || selected === record.province;
        const radius = 1.05 + Math.min(1.05, Math.log2(count) * 0.22);
        return (
          <g
            key={record.id}
            className="ember-point"
            role="button"
            tabIndex={-1}
            aria-label={`Rincian hotspot ${record.province}, ${record.latitude.toFixed(2)}, ${record.longitude.toFixed(2)}`}
            pointerEvents={focus ? "all" : "none"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onInspect(record);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onInspect(record);
              }
            }}
            transform={`translate(${p[0]} ${p[1]})`}
            opacity={focus ? 1 : 0.12}
          >
            <circle r={5} fill="transparent" />
            <circle
              r={radius + 3.1}
              fill="url(#ember-halo)"
              opacity={high ? 0.75 : 0.3}
            />
            <circle r={radius + 0.4} fill="#9d3b19" opacity=".5" />
            <circle r={radius} fill={high ? "#ffae50" : "#db713a"} />
            {high && <circle r={radius * 0.42} fill="#fff2b5" />}
          </g>
        );
      })}
      {symbols
        .filter((symbol) => flameIds.has(symbol.record.id))
        .map(({ record }, index) => {
          const p = projection([record.longitude, record.latitude]);
          if (!p) return null;
          return (
            <g
              key={record.id}
              className={`fire-beacon ${selected !== "Indonesia" ? "fire-beacon-selected" : ""}`}
              transform={`translate(${p[0]} ${p[1]})`}
              style={
                {
                  "--fire-delay": `${-(index % 17) * 0.23}s`,
                  "--fire-duration": `${2.3 + (index % 7) * 0.21}s`,
                } as CSSProperties
              }
            >
              <g
                transform={selected !== "Indonesia" ? "scale(1.4)" : undefined}
              >
                {selected !== "Indonesia" && (
                  <g className="fire-haze-2d" fill="#aab4ae" opacity=".17">
                    <ellipse cx="2" cy="-17" rx="2.7" ry="4" />
                    <ellipse cx="4" cy="-23" rx="3.5" ry="4.7" />
                  </g>
                )}
                <ellipse
                  rx="6.5"
                  ry="3.2"
                  cy="1"
                  fill="url(#ember-halo)"
                  className="fire-groundlight"
                />
                <g className="fire-flame">
                  {selected !== "Indonesia" && (
                    <>
                      <use
                        href="#flame-shape"
                        transform="translate(-3 1) rotate(-17) scale(.65)"
                        opacity=".85"
                      />
                      <use
                        href="#flame-shape"
                        transform="translate(3 1) rotate(20) scale(.72)"
                        opacity=".9"
                      />
                    </>
                  )}
                  <use href="#flame-shape" />
                </g>
                <g className="fire-sparks">
                  <circle cx="-.8" cy="-6" r=".65" fill="#ffe7a0" />
                  <circle cx="1.5" cy="-2" r=".4" fill="#ffba67" />
                </g>
              </g>
            </g>
          );
        })}
    </g>
  );
}

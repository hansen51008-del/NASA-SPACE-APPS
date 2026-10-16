import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as GLMap,
  NavigationControl,
  ScaleControl,
  LngLatBounds,
  setWorkerUrl,
  type GeoJSONSource,
  type ExpressionSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  Mountain,
  Maximize2,
  Crosshair,
  ChevronDown,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Hotspot, Provinces } from "../types";
import { provinceColour } from "./mapAppearance";
import SelectedFireEffects, { selectedFireSites } from "./SelectedFireEffects";
import "maplibre-gl/dist/maplibre-gl.css";
import "../terrain.css";
import { useMapOrbit } from "./useMapOrbit";
import { provinceBorders } from "./provinceBorders";
import { useMapQuality } from "./MapQuality";
setWorkerUrl(workerUrl);

interface Props {
  boundaries: Provinces;
  records: Hotspot[];
  selected: string;
  onSelect: (name: string) => void;
  onInspect: (record: Hotspot) => void;
  showMarkers: boolean;
  showBorders: boolean;
  density: boolean;
  provinceColours: boolean;
  onFallback: () => void;
}
const places = [
  {
    name: "Bromo · Semeru",
    center: [112.922, -8.108] as [number, number],
    zoom: 11.65,
    bearing: -18,
    detail: "Lereng gunung api · Jawa Timur",
  },
  {
    name: "Rinjani",
    center: [116.42, -8.415] as [number, number],
    zoom: 11.1,
    bearing: -25,
    detail: "Danau kawah · Lombok",
  },
  {
    name: "Pegunungan Papua",
    center: [137.17, -4.08] as [number, number],
    zoom: 10.3,
    bearing: 20,
    detail: "Punggungan pegunungan · Papua",
  },
];
const dem = {
  type: "raster-dem" as const,
  tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
  encoding: "terrarium" as const,
  tileSize: 512,
  maxzoom: 12,
  attribution:
    '<a href="https://mapterhorn.com/attribution/" target="_blank" rel="noreferrer">Terrain: Mapterhorn contributors</a>',
};
const duration = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100;
// Supersample even ordinary 1x screens. Bound the render target on fullscreen
// displays instead of multiplying every GPU buffer by an unrestricted DPR.
const terrainPixelRatio = (width: number, height: number) =>
  Math.max(
    1,
    Math.min(
      Math.max(window.devicePixelRatio || 1, 1.5),
      2,
      Math.sqrt(6_000_000 / Math.max(1, width * height)),
    ),
  );

export default function TerrainMap(props: Props) {
  const {quality} = useMapQuality();
  const qualityRef = useRef(quality); qualityRef.current=quality;
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const current = useRef(props);
  current.current = props;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Memuat data elevasi…");
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState(places[0].name);
  const [relief, setRelief] = useState(1.5);
  const [pitch, setPitch] = useState(64);
  const [hover, setHover] = useState("");
  const [orbit, setOrbit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    () => !matchMedia("(max-width: 650px)").matches,
  );
  const [exploreOpen, setExploreOpen] = useState(
    () => !matchMedia("(max-width: 650px)").matches,
  );
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const [bearing, setBearing] = useState((places[0].bearing + 360) % 360);
  useMapOrbit(ready ? mapRef.current : null, orbit);
  const [surface, setSurface] = useState<"satellite" | "relief">("satellite");
  const [imageryStatus, setImageryStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    const mobile = matchMedia("(max-width: 650px)");
    const collapse = () => {
      if (mobile.matches) {
        setSettingsOpen(false);
        setExploreOpen(false);
      }
    };
    mobile.addEventListener("change", collapse);
    return () => mobile.removeEventListener("change", collapse);
  }, []);

  const fireSites = useMemo(
    () => selectedFireSites(props.records, props.selected),
    [props.records, props.selected],
  );
  const fireIndex = useRef(0);
  const inspectFire = () => {
    const map = mapRef.current;
    if (!map || !fireSites.length) return;
    const index = fireIndex.current++ % fireSites.length;
    const site = fireSites[index];
    map.flyTo({
      center: [site.longitude, site.latitude],
      zoom: 12,
      pitch: 62,
      bearing: -22,
      padding: 0,
      duration: duration(),
    });
    setFocus(`${props.selected} / observasi ${index + 1}`);
  };

  const provinceData = useMemo(() => {
    const counts = new Map<string, number>();
    props.records.forEach((r) =>
      counts.set(r.province, (counts.get(r.province) ?? 0) + 1),
    );
    const max = Math.max(1, ...counts.values());
    return {
      ...props.boundaries,
      features: props.boundaries.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          colour: provinceColour(f.properties.PROVINSI, f.properties.KODE_PROV),
          activity: (counts.get(f.properties.PROVINSI) ?? 0) / max,
        },
      })),
    };
  }, [props.boundaries, props.records]);
  const hotspots = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: props.records.map((r) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [r.longitude, r.latitude],
        },
        properties: {
          id: r.id,
          high: r.confidence === "high",
          province: r.province,
        },
      })),
    }),
    [props.records],
  );

  useEffect(() => {
    if (!host.current) return;
    let map: GLMap;
    try {
      map = new GLMap({
        locale: {
          "NavigationControl.ZoomIn": "Perbesar",
          "NavigationControl.ZoomOut": "Perkecil",
          "NavigationControl.ResetBearing": "Hadap utara",
          "AttributionControl.ToggleAttribution": "Tampilkan atribusi",
        },
        container: host.current,
        center: places[0].center,
        zoom: places[0].zoom,
        bearing: places[0].bearing,
        pitch: 64,
        maxPitch: 75,
        minZoom: 3,
        maxZoom: 15,
        renderWorldCopies: false,
        pixelRatio: qualityRef.current === "low" ? 1 : terrainPixelRatio(
          host.current.clientWidth,
          host.current.clientHeight,
        ),
        maxTileCacheZoomLevels: 5,
        maxTileCacheSize: 160,
        cancelPendingTileRequestsWhileZooming: true,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
        style: {
          version: 8,
          sources: {
            elevation: dem,
            shading: dem,
            overview: {
              type: "raster",
              tiles: [
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              // Only the regional overview. Never use its mismatched close-up
              // acquisitions (the old Semeru discontinuity was at z11 -> z12).
              maxzoom: 8,
              attribution:
                'Overview: <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Esri, Maxar, Earthstar Geographics, and the GIS User Community</a>',
            },
            imagery: {
              type: "raster",
              tiles: [
                // One annual mosaic across the pyramid: mixed-resolution imagery
                // otherwise changes acquisition/lighting when terrain selects LODs.
                "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
              ],
              tileSize: 256,
              maxzoom: 14,
              attribution:
                '<a href="https://cloudless.eox.at" target="_blank" rel="noreferrer">EOxCloudless</a> by <a href="https://eox.at" target="_blank" rel="noreferrer">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2024) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>',
            },
          },
          layers: [
            {
              id: "ocean",
              type: "background",
              paint: { "background-color": "#1d3453" },
            },
            {
              id: "elevation-colour",
              type: "color-relief",
              layout: { visibility: "none" },
              source: "shading",
              paint: {
                "color-relief-color": [
                  "interpolate",
                  ["linear"],
                  ["elevation"],
                  -100,
                  "#123955",
                  0,
                  "#245873",
                  1,
                  "#717171",
                  400,
                  "#616161",
                  1100,
                  "#777777",
                  1900,
                  "#8c8c8c",
                  2800,
                  "#91836c",
                  3700,
                  "#959181",
                  4800,
                  "#a5a293",
                ],
              },
            },
            {
              id: "satellite-overview",
              type: "raster",
              source: "overview",
              // Keep the cached overview underneath missing detail tiles. Hiding
              // it at zoom 10 exposed the blue background during fast zooms.
              paint: {
                "raster-saturation": -0.08,
                "raster-contrast": 0.04,
                "raster-brightness-min": 0.02,
                "raster-brightness-max": 1,
                "raster-fade-duration": 0,
                "raster-resampling": "linear",
              },
            },
            {
              id: "satellite-texture",
              layout: {visibility: qualityRef.current === "low" ? "none" : "visible"},
              type: "raster",
              source: "imagery",
              minzoom: 8,
              paint: {
                // Blend by map zoom, never by the individual terrain tile LOD.
                "raster-opacity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  0,
                  10,
                  1,
                ],
                "raster-saturation": 0.08,
                "raster-contrast": 0.04,
                "raster-brightness-min": 0.045,
                "raster-brightness-max": 0.98,
                "raster-fade-duration": 450,
                "raster-resampling": "linear",
              },
            },
            {
              id: "slope-shading",
              type: "hillshade",
              source: "shading",
              paint: {
                "hillshade-method": "multidirectional",
                "hillshade-exaggeration": 0.58,
                // A broad NW key and a weaker NE fill soften shadow gradients.
                // 30 degrees leaves flat terrain neutral in this algorithm.
                "hillshade-illumination-direction": [295, 335, 35],
                "hillshade-illumination-altitude": [30, 30, 30],
                "hillshade-illumination-anchor": "map",
                "hillshade-shadow-color": [
                  "rgba(18, 31, 42, 0.68)",
                  "rgba(26, 39, 47, 0.5)",
                  "rgba(33, 45, 50, 0.16)",
                ],
                "hillshade-highlight-color": [
                  "rgba(248, 224, 174, 0.72)",
                  "rgba(239, 222, 184, 0.54)",
                  "rgba(222, 222, 222, 0.22)",
                ],
                "hillshade-accent-color": "rgba(39, 39, 39, 0.3)",
                resampling: "linear",
              },
            },
          ],
          terrain: { source: "elevation", exaggeration: qualityRef.current === "low" ? 1 : 1.5 },
          sky: {
            "sky-color": "#789bb8",
            "horizon-color": "#d6ccb7",
            "fog-color": "#95a5ac",
            "fog-ground-blend": 1,
          },
        },
      });
    } catch {
      setFailed(true);
      setStatus(
        "Peta 3D tidak tersedia di browser ini. Peta 2D tetap dapat digunakan.",
      );
      return;
    }
    mapRef.current = map;
    map.addControl(
      new NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(
      new ScaleControl({ maxWidth: 100, unit: "metric" }),
      "bottom-left",
    );
    let hasElevationTiles = false;
    let wasDetailLoading = false;
    let elevationAvailable = false;
    const paintedTiles = new Map<string, { z: number; x: number; y: number }>();
    const centreHasPaint = () => {
      const centre = map.getCenter();
      const latitude = (centre.lat * Math.PI) / 180;
      const minimumZoom = Math.max(
        0,
        Math.min(12, Math.floor(map.getZoom()) - 1),
      );
      return [...paintedTiles.values()].some((tile) => {
        if (tile.z < minimumZoom) return false;
        const size = 2 ** tile.z;
        const x = Math.floor(((centre.lng + 180) / 360) * size);
        const y = Math.floor(
          ((1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2) * size,
        );
        return tile.x === x && tile.y === y;
      });
    };
    let pendingSince = performance.now();
    const timer = window.setInterval(() => {
      if (!elevationAvailable && performance.now() - pendingSince > 15000) {
        setStatus(
          "Data elevasi belum selesai dimuat. Periksa koneksi atau gunakan peta 2D.",
        );
        setFailed(true);
      }
    }, 1000);
    map.on("error", (event) => {
      if (
        ("sourceId" in event &&
          (event.sourceId === "imagery" || event.sourceId === "overview")) ||
        /tiles\.maps\.eox\.at|World_Imagery/.test(event.error.message)
      ) {
        setImageryStatus("error");
      }
      if (
        ("sourceId" in event &&
          (event.sourceId === "elevation" || event.sourceId === "shading")) ||
        /tiles\.mapterhorn\.com/.test(event.error.message)
      ) {
        setFailed(true);
        setStatus(
          "Sebagian data elevasi gagal dimuat. Periksa koneksi atau gunakan peta 2D.",
        );
      }
    });
    map.on("moveend", () => {
      // A tilt/orbit or a cached camera move must not restart the loading UI.
      if (centreHasPaint()) return;
      if (elevationAvailable) pendingSince = performance.now();
      elevationAvailable = false;
      setStatus("Memuat data elevasi…");
    });
    map.on("sourcedata", (event) => {
      if (
        (event.sourceId === "imagery" || event.sourceId === "overview") &&
        event.coord
      ) {
        setImageryStatus("loaded");
      }
      if (event.sourceId === "elevation" && event.coord) {
        const tile = event.coord.canonical;
        paintedTiles.set(`${tile.z}/${tile.x}/${tile.y}`, {
          z: tile.z,
          x: tile.x,
          y: tile.y,
        });
      }
      if (event.sourceId === "elevation" && event.coord)
        hasElevationTiles = true;
    });
    map.on("render", () => {
      const waitingForDetail =
        map.getZoom() >= 8 &&
        map.getLayoutProperty("satellite-texture", "visibility") !== "none" &&
        !map.isSourceLoaded("imagery");
      if (waitingForDetail !== wasDetailLoading) {
        wasDetailLoading = waitingForDetail;
        setDetailLoading(waitingForDetail);
      }
      // A slow distant tile must not block province controls or a usable local view.
      // The terrain API returns zero before DEM data arrives, so require a loaded
      // DEM tile plus an actual surface sample (or a fully loaded sea-level view).
      if (
        !elevationAvailable &&
        hasElevationTiles &&
        (map.isSourceLoaded("elevation") || centreHasPaint()) &&
        (Math.abs(map.queryTerrainElevation(map.getCenter()) ?? 0) > 1 ||
          map.isSourceLoaded("elevation"))
      ) {
        elevationAvailable = true;
        setStatus("Elevasi dimuat");
        setFailed(false);
      }
    });
    map.on("rotateend", () =>
      setBearing(Math.round((map.getBearing() + 360) % 360)),
    );
    map.on("pitchend", () => setPitch(Math.round(map.getPitch())));
    map.on("dragstart", () => setFocus("Custom view"));
    map.on("style.load", () => {
      map.addSource("provinces", {
        type: "geojson",
        data: current.current.boundaries,
      });
      map.addSource("province-borders", {
        type: "geojson",
        data: provinceBorders(current.current.boundaries),
      });
      map.addSource("detections", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "province-tint",
        type: "fill",
        source: "provinces",
        paint: {
          "fill-color": "#8d8d8d",
          "fill-opacity": 0.2,
          "fill-antialias": false,
        },
      });
      map.addLayer({
        id: "province-lines",
        type: "line",
        source: "province-borders",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#cccccc",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0.55,
            8,
            0.9,
            12,
            0.65,
          ],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.45,
            8,
            0.32,
            11,
            0,
          ],
        },
      });
      map.addLayer({
        id: "selected-province",
        type: "line",
        source: "province-borders",
        filter: ["==", ["get", "provinceA"], ""],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#e6d6a5",
          "line-width": 0.9,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.8,
            8,
            0.5,
            10,
            0,
          ],
        },
      });
      map.addLayer({
        id: "hotspot-glow",
        type: "circle",
        source: "detections",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            3,
            9,
            9,
            13,
            12,
          ],
          "circle-color": "#ff5c17",
          "circle-opacity": 0.12,
          "circle-blur": 0.85,
          "circle-pitch-alignment": "map",
        },
      });
      map.addLayer({
        id: "hotspot-core",
        type: "circle",
        source: "detections",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0.8,
            9,
            2,
            13,
            3,
          ],
          "circle-color": ["case", ["get", "high"], "#d8a56a", "#bd895c"],
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0,
            9,
            1,
          ],
          "circle-stroke-color": "#ee641f",
          "circle-pitch-alignment": "map",
        },
      });
      const motion = (moving: boolean) => host.current?.dispatchEvent(new CustomEvent("siaga-map-motion", {bubbles:true,detail:moving}));
      map.on("movestart", () => motion(true));
      map.on("moveend", () => motion(false));
      map.on("click", (e) => {
        if (current.current.showMarkers) {
          const hit = map.queryRenderedFeatures(
            [
              [e.point.x - 8, e.point.y - 8],
              [e.point.x + 8, e.point.y + 8],
            ],
            { layers: ["hotspot-core", "hotspot-glow"] },
          )[0];
          const record = current.current.records.find(
            (r) => r.id === hit?.properties?.id,
          );
          if (
            record &&
            (current.current.selected === "Indonesia" ||
              current.current.selected === record.province)
          ) {
            current.current.onInspect(record);
            return;
          }
        }
        const name = map.queryRenderedFeatures(e.point, {
          layers: ["province-tint"],
        })[0]?.properties?.PROVINSI;
        if (name) current.current.onSelect(name);
      });
      map.on("mousemove", "province-tint", (e) => {
        map.getCanvas().style.cursor = "pointer";
        setHover(e.features?.[0]?.properties?.PROVINSI ?? "");
      });
      map.on("mouseleave", "province-tint", () => {
        map.getCanvas().style.cursor = "";
        setHover("");
      });
      setReady(true);
    });
    const observer = new ResizeObserver(() => {
      if (!host.current) return;
      const ratio = qualityRef.current === "low" ? 1 : terrainPixelRatio(
        host.current.clientWidth,
        host.current.clientHeight,
      );
      if (Math.abs(map.getPixelRatio() - ratio) > 0.01)
        map.setPixelRatio(ratio);
      else map.resize();
    });
    observer.observe(host.current);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of ["satellite-texture", "satellite-overview"]) {
      map.setLayoutProperty(
        id,
        "visibility",
        surface === "satellite" && (id !== "satellite-texture" || quality !== "low") ? "visible" : "none",
      );
    }
    map.setLayoutProperty(
      "elevation-colour",
      "visibility",
      surface === "relief" ? "visible" : "none",
    );
    // Fixed geographic lighting, independent of bearing, tilt and zoom.
    map.setPaintProperty(
      "slope-shading",
      "hillshade-exaggeration",
      surface === "satellite" ? 0.58 : 0.62,
    );
    map.setPixelRatio(quality === "low" ? 1 : terrainPixelRatio(host.current?.clientWidth ?? 1,host.current?.clientHeight ?? 1));
    map.setTerrain({source:"elevation",exaggeration:quality === "low"?1:relief});
  }, [ready, surface, quality, relief]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const colour: ExpressionSpecification | string = props.density
      ? [
          "interpolate",
          ["linear"],
          ["get", "activity"],
          0,
          "#686868",
          1,
          "#ee743e",
        ]
      : props.provinceColours
        ? ["get", "colour"]
        : "#8d8d8d";
    map.setPaintProperty("province-tint", "fill-color", colour);
    // A fixed tint avoids brightness shifts as the camera zooms.
    map.setPaintProperty(
      "province-tint",
      "fill-opacity",
      props.density
        ? 0.5
        : props.provinceColours
          ? surface === "satellite"
            ? 0.045
            : 0.16
          : 0,
    );
    map.setLayoutProperty(
      "province-lines",
      "visibility",
      props.showBorders ? "visible" : "none",
    );
    ["hotspot-core", "hotspot-glow"].forEach((id) => {
      map.setLayoutProperty(
        id,
        "visibility",
        props.showMarkers ? "visible" : "none",
      );
      map.setFilter(
        id,
        props.selected === "Indonesia"
          ? null
          : ["==", ["get", "province"], props.selected],
      );
    });
    map.setLayoutProperty(
      "selected-province",
      "visibility",
      props.showBorders ? "visible" : "none",
    );
    map.setFilter("selected-province", [
      "any",
      ["==", ["get", "provinceA"], props.selected],
      ["==", ["get", "provinceB"], props.selected],
    ]);
  }, [
    ready,
    props.density,
    props.provinceColours,
    props.showBorders,
    props.showMarkers,
    props.selected,
    surface,
  ]);

  // Only rebuild worker GeoJSON tiles when their data changes.
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      (mapRef.current?.getSource("provinces") as GeoJSONSource)?.setData(
        provinceData,
      );
      (mapRef.current?.getSource("detections") as GeoJSONSource)?.setData(
        hotspots,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, provinceData, hotspots]);

  const nationalView = () => {
    mapRef.current?.fitBounds(
      [
        [94.5, -11.2],
        [141.2, 6.2],
      ],
      {
        padding: { top: 125, bottom: 135, left: 30, right: 40 },
        pitch: 25,
        bearing: 0,
        duration: duration(),
      },
    );
    setFocus("Indonesia");
  };
  const previousSelection = useRef(props.selected);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (props.selected === "Indonesia") {
      if (previousSelection.current !== "Indonesia") nationalView();
    } else {
      const feature = props.boundaries.features.find(
        (f) => f.properties.PROVINSI === props.selected,
      );
      if (feature) {
        const bounds = new LngLatBounds();
        const polygons =
          feature.geometry.type === "Polygon"
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;
        polygons.forEach((p) =>
          p[0].forEach((c) => bounds.extend([c[0], c[1]])),
        );
        map.fitBounds(bounds, {
          padding: { top: 140, bottom: 130, left: 55, right: 55 },
          pitch: 48,
          bearing: 0,
          maxZoom: 10,
          duration: duration(),
        });
        setFocus(props.selected);
      }
    }
    fireIndex.current = 0;
    previousSelection.current = props.selected;
  }, [ready, props.selected, props.boundaries]);

  return (
    <div
      className="terrain-view"
      data-ready={ready}
      data-bearing={bearing}
      data-orbit={orbit}
      data-settings-open={settingsOpen}
      data-explore-open={exploreOpen}
      data-surface={surface}
      data-imagery={imageryStatus}
      data-elevation={status === "Elevasi dimuat" ? "loaded" : "pending"}
    >
      <div
        ref={host}
        className="terrain-gl"
        aria-label="Peta relief 3D interaktif"
      />
      <div className="terrain-atmosphere" aria-hidden="true" />
      <SelectedFireEffects
        map={ready ? mapRef.current : null}
        records={props.records}
        selected={props.selected}
        visible={props.showMarkers && quality !== "low"}
      />
      <div
        className="terrain-destinations"
        aria-label="Pilihan tampilan pegunungan"
      >
        <button
          className="terrain-explore-toggle"
          aria-expanded={exploreOpen}
          aria-controls="terrain-viewpoints"
          onClick={() => {
            setExploreOpen(!exploreOpen);
            if (!exploreOpen && matchMedia("(max-width: 650px)").matches)
              setSettingsOpen(false);
          }}
        >
          <Mountain size={15} /> Jelajahi relief <ChevronDown size={13} />
        </button>
        {exploreOpen && (
          <div id="terrain-viewpoints" className="terrain-viewpoints">
            {places.map((place) => (
              <button
                key={place.name}
                aria-label={place.name}
                disabled={!ready}
                aria-pressed={focus === place.name}
                onClick={() => {
                  mapRef.current?.flyTo({
                    ...place,
                    padding: 0,
                    pitch: 64,
                    duration: duration(),
                  });
                  setFocus(place.name);
                }}
              >
                <span>{place.name}</span>
                <small>{place.detail}</small>
              </button>
            ))}
            <button
              onClick={nationalView}
              aria-label="Tampilkan seluruh Indonesia"
            >
              <Maximize2 size={12} /> Indonesia
            </button>
            {props.showMarkers && fireSites.length > 0 && (
              <button
                className="terrain-inspect"
                onClick={inspectFire}
                aria-label="Lihat hotspot terpilih"
              >
                <Crosshair size={13} /> Lihat hotspot
              </button>
            )}
          </div>
        )}
      </div>
      <div className="terrain-caption">
        <span className="terrain-eyebrow">
          {surface === "satellite"
            ? "SATELIT / RELIEF 3D"
            : "ELEVASI / RELIEF BERBAYANG"}
        </span>
        <strong>{focus}</strong>
        <span>
          {hover
            ? `${hover} · pilih untuk melihat`
            : "Hanya tampilan kamera · filter aktivitas tetap"}
        </span>
        {props.selected !== "Indonesia" && props.showMarkers && (
          <small className="selected-fire-note">
            Simbol observasi · bukan ukuran api
          </small>
        )}
      </div>
      <button
        ref={settingsTrigger}
        className="terrain-settings-trigger"
        hidden={settingsOpen}
        aria-expanded={settingsOpen}
        aria-controls="terrain-settings"
        onClick={() => {
          setSettingsOpen(true);
          if (matchMedia("(max-width: 650px)").matches) setExploreOpen(false);
        }}
      >
        <SlidersHorizontal size={15} /> Pengaturan peta
      </button>
      {settingsOpen && (
        <div
          id="terrain-settings"
          className="terrain-adjustments"
          aria-label="Pengaturan peta"
        >
          <div className="terrain-settings-heading">
            <span>
              <SlidersHorizontal size={13} /> Pengaturan peta
            </span>
            <button
              aria-label="Tutup pengaturan peta"
              onClick={() => {
                setSettingsOpen(false);
                requestAnimationFrame(() => settingsTrigger.current?.focus());
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            className="terrain-surface-options"
            role="group"
            aria-label="Permukaan peta"
          >
            <button
              aria-pressed={surface === "satellite"}
              onClick={() => setSurface("satellite")}
            >
              Satelit
            </button>
            <button
              aria-pressed={surface === "relief"}
              onClick={() => setSurface("relief")}
            >
              Relief berbayang
            </button>
          </div>
          <div
            className="terrain-camera-options"
            role="group"
            aria-label="Mode gerakan kamera"
          >
            <button aria-pressed={!orbit} onClick={() => setOrbit(false)}>
              Geser
            </button>
            <button aria-pressed={orbit} onClick={() => setOrbit(true)}>
              Putar 360°
            </button>
            <button
              aria-label="Hadap utara"
              onClick={() =>
                mapRef.current?.easeTo({ bearing: 0, duration: duration() })
              }
            >
              {bearing}° N
            </button>
          </div>
          <label>
            Relief{" "}
            <select
              aria-label="Pengali tinggi relief"
              value={relief}
              onChange={(e) => {
                const value = Number(e.target.value);
                setRelief(value);
                mapRef.current?.setTerrain({
                  source: "elevation",
                  exaggeration: value,
                });
              }}
            >
              <option value="1">1× skala asli</option>
              <option value="1.5">1.5× diperbesar</option>
              <option value="2.5">2.5× diperbesar</option>
            </select>
          </label>
          <label>
            Kemiringan{" "}
            <input
              aria-label="Kemiringan kamera"
              type="range"
              min="0"
              max="75"
              value={pitch}
              onChange={(e) => {
                const value = Number(e.target.value);
                setPitch(value);
                mapRef.current?.setPitch(value);
              }}
            />
            <span>{pitch}°</span>
          </label>
          <span className="terrain-gesture">
            {orbit
              ? "Geser untuk putar / miringkan · gulir atau tombol untuk perbesar"
              : "Geser untuk pindah · geser kanan untuk putar · gulir untuk perbesar"}
          </span>
          {surface === "relief" && (
            <small className="terrain-imagery-note">
              Warna relief lembut / citra satelit opsional
            </small>
          )}
          {surface === "satellite" && (
            <small className="terrain-imagery-note">
              {imageryStatus === "error" ? (
                <>
                  Citra tidak tersedia.{" "}
                  <button onClick={() => setSurface("relief")}>
                    Gunakan relief berbayang
                  </button>
                </>
              ) : imageryStatus === "loading" ? (
                "Memuat citra permukaan…"
              ) : detailLoading ? (
                "Memuat citra rinci · tampilan umum tetap tersedia"
              ) : (
                "Tampilan umum Esri / rincian Sentinel-2 · bukan siaran langsung"
              )}
            </small>
          )}
        </div>
      )}
      {status !== "Elevasi dimuat" && (
        <div
          className={`terrain-status ${failed ? "has-error" : ""}`}
          role="status"
        >
          {status}
          {failed && (
            <button onClick={props.onFallback}>Gunakan peta 2D</button>
          )}
        </div>
      )}
    </div>
  );
}

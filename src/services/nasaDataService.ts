import type { Hotspot, Provinces, Sensor, Confidence } from "../types";
import { YEARS } from "../types";
import type { Position } from "geojson";
export interface NasaDataService {
  loadRecords(boundaries: Provinces): Promise<Hotspot[]>;
}
export interface FirmsRow {
  latitude: string | number;
  longitude: string | number;
  acq_date: string;
  acq_time: string | number;
  confidence: string | number;
  brightness?: number;
  bright_ti4?: number;
}
export function normalizeFirmsRow(
  row: FirmsRow,
  source: Sensor,
  province: string,
  id: string,
): Hotspot {
  const latitude = Number(row.latitude),
    longitude = Number(row.longitude);
  if (
    String(row.latitude).trim() === "" ||
    String(row.longitude).trim() === "" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error("Invalid FIRMS coordinates");
  const time = String(row.acq_time).padStart(4, "0");
  if (
    !/^\d{4}$/.test(time) ||
    Number(time.slice(0, 2)) > 23 ||
    Number(time.slice(2)) > 59 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.acq_date)
  )
    throw new Error("Invalid FIRMS acquisition time");
  const date = `${row.acq_date}T${time.slice(0, 2)}:${time.slice(2)}:00.000Z`;
  if (
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== row.acq_date
  )
    throw new Error("Invalid FIRMS date");
  let confidence: Confidence;
  if (source === "MODIS") {
    const n = Number(row.confidence);
    if (
      String(row.confidence).trim() === "" ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > 100
    )
      throw new Error("Invalid MODIS confidence");
    confidence = n >= 80 ? "high" : n >= 30 ? "nominal" : "low";
  } else {
    const value = String(row.confidence).toLowerCase();
    const mapping: Record<string, Confidence> = {
      l: "low",
      n: "nominal",
      h: "high",
      low: "low",
      nominal: "nominal",
      high: "high",
    };
    if (!mapping[value]) throw new Error("Invalid VIIRS confidence");
    confidence = mapping[value];
  }
  return {
    id,
    source,
    latitude,
    longitude,
    date,
    confidence,
    nativeConfidence: row.confidence,
    brightness: source === "MODIS" ? row.brightness : row.bright_ti4,
    province,
    year: Number(row.acq_date.slice(0, 4)),
    month: Number(row.acq_date.slice(5, 7)),
    isDemo: false,
  };
}
function inRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function containsPoint(
  feature: Provinces["features"][number],
  point: Position,
) {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  return polygons.some(
    (p) =>
      inRing(point, p[0]) && !p.slice(1).some((hole) => inRing(point, hole)),
  );
}
export const demoDataService: NasaDataService = {
  async loadRecords(boundaries) {
    let seed = 20260919;
    const random = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const records: Hotspot[] = [];
    const season = [
      0.1, 0.09, 0.14, 0.2, 0.26, 0.38, 0.68, 1.05, 1.5, 1.1, 0.43, 0.15,
    ];
    for (const feature of boundaries.features) {
      const province = feature.properties.PROVINSI;
      const polygons =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      const positions = polygons.flat(2);
      const xs = positions.map((p) => p[0]),
        ys = positions.map((p) => p[1]);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const sites: Position[] = [];
      for (let attempt = 0; sites.length < 36 && attempt < 15000; attempt++) {
        const p = [
          minX + random() * (maxX - minX),
          minY + random() * (maxY - minY),
        ];
        if (containsPoint(feature, p)) sites.push(p);
      }
      if (!sites.length) continue;
      const weight = /Kalimantan Tengah/i.test(province)
        ? 7
        : /Kalimantan|Riau|Sumatera Selatan|Jambi/i.test(province)
          ? 4
          : /Papua|Sumatera|Sulawesi|Nusa Tenggara/i.test(province)
            ? 1.5
            : 0.45;
      for (const year of YEARS)
        for (let month = 1; month <= 12; month++) {
          const yearFactor = [0.7, 0.8, 0.88, 1.6, 1.0, 1.28][year - 2020];
          const spike =
            year === 2025 &&
            month === 9 &&
            /Kalimantan Tengah|Riau/i.test(province)
              ? 2.4
              : 1;
          const count = Math.round(
            18 *
              weight *
              season[month - 1] *
              yearFactor *
              spike *
              (0.8 + random() * 0.4),
          );
          for (let i = 0; i < count; i++) {
            const center = sites[Math.floor(random() * sites.length)];
            const jittered = [
              center[0] + (random() - 0.5) * 0.025,
              center[1] + (random() - 0.5) * 0.025,
            ];
            const point = containsPoint(feature, jittered) ? jittered : center;
            const source: Sensor = random() > 0.32 ? "VIIRS" : "MODIS";
            const confidence: Confidence =
              random() > 0.42 ? "high" : random() > 0.25 ? "nominal" : "low";
            const date = new Date(
              Date.UTC(
                year,
                month - 1,
                1 + Math.floor(random() * 27),
                3 + Math.floor(random() * 10),
                Math.floor(random() * 30),
              ),
            );
            const record: Hotspot = {
              id: `demo-${records.length}`,
              source,
              longitude: point[0],
              latitude: point[1],
              date: date.toISOString(),
              confidence,
              nativeConfidence:
                source === "MODIS"
                  ? confidence === "high"
                    ? 90
                    : confidence === "nominal"
                      ? 60
                      : 20
                  : confidence[0],
              brightness: Math.round(310 + random() * 80),
              province,
              year,
              month,
              isDemo: true,
            };
            records.push(record);
            if (random() < 0.25)
              records.push({
                ...record,
                id: `demo-${records.length}`,
                source: source === "MODIS" ? "VIIRS" : "MODIS",
                nativeConfidence:
                  source === "MODIS"
                    ? confidence[0]
                    : confidence === "high"
                      ? 90
                      : confidence === "nominal"
                        ? 60
                        : 20,
                date: new Date(date.getTime() + 20 * 60000).toISOString(),
              });
          }
        }
    }
    return records;
  },
};
// Replace this provider with a server-backed FIRMS adapter; no UI changes required.
// Never expose a FIRMS MAP_KEY in browser environment variables.
export const nasaDataService: NasaDataService = demoDataService;

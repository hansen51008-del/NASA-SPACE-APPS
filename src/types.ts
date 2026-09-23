import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
export type Sensor = "MODIS" | "VIIRS";
export type Layer = Sensor | "Harmonized";
export type Confidence = "low" | "nominal" | "high";
export interface Hotspot {
  id: string;
  source: Sensor;
  latitude: number;
  longitude: number;
  date: string;
  confidence: Confidence;
  nativeConfidence: number | string;
  brightness?: number;
  province: string;
  year: number;
  month: number;
  isDemo: boolean;
  satellite?: string;
  version?: string;
  frp?: number;
  provenance?: { file: string; row: number };
}
export interface Activity extends Hotspot {
  memberIds: string[];
  sources: Sensor[];
  members: Hotspot[];
  matchDistanceKm?: number;
  matchMinutes?: number;
}
export type Provinces = FeatureCollection<
  Polygon | MultiPolygon,
  { PROVINSI: string; KODE_PROV: string }
>;
export const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const number = (n: number) => n.toLocaleString("en-US");

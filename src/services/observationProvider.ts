import { demoDataService } from "./nasaDataService";
import { importFirms } from "./firmsImport";
import type { Hotspot, Provinces } from "../types";
import { YEARS } from "../types";

export const FIRMS_PRODUCTS = ["MODIS_NRT", "VIIRS_SNPP_NRT"] as const;
export interface FirmsCache {
  schemaVersion: 1;
  updatedAt: string;
  coverage: { start: string; end: string };
  products: { name: string; text: string }[];
}
export interface ObservationDataset {
  records: Hotspot[];
  mode: "demo" | "firms";
  notice: string;
  updatedAt?: string;
  coverage?: { start: string; end: string };
  years: number[];
}

export function parseFirmsCache(
  value: unknown,
  boundaries: Provinces,
): ObservationDataset {
  const cache = value as FirmsCache;
  const validDay = (s: unknown): s is string =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (
    !cache ||
    cache.schemaVersion !== 1 ||
    !validDay(cache.coverage?.start) ||
    !validDay(cache.coverage?.end) ||
    cache.coverage.start > cache.coverage.end ||
    typeof cache.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(cache.updatedAt)) ||
    !Array.isArray(cache.products) ||
    cache.products.length !== 2 ||
    FIRMS_PRODUCTS.some(
      (name) =>
        cache.products.filter(
          (p) => p.name === name && typeof p.text === "string",
        ).length !== 1,
    )
  ) {
    throw new Error("Cache FIRMS tidak valid");
  }
  const coverageDays =
    (Date.parse(cache.coverage.end) - Date.parse(cache.coverage.start)) /
      86400000 +
    1;
  if (coverageDays > 5)
    throw new Error("Cakupan cache melebihi kontrak sinkronisasi");
  for (const product of cache.products) {
    const expected = product.name === "MODIS_NRT" ? "MODIS" : "VIIRS";
    const single = importFirms([product], boundaries);
    if (single.rejected || single.records.some((r) => r.source !== expected))
      throw new Error("Produk FIRMS tidak sesuai sensor");
  }
  const report = importFirms(cache.products, boundaries);
  if (
    report.rejected ||
    report.records.some(
      (r) =>
        r.isDemo ||
        r.date.slice(0, 10) < cache.coverage.start ||
        r.date.slice(0, 10) > cache.coverage.end,
    )
  ) {
    throw new Error("Baris FIRMS tidak valid atau di luar cakupan");
  }
  // Missing months/years are never manufactured as historical zeroes.
  const years = Array.from(
    {
      length:
        Number(cache.coverage.end.slice(0, 4)) -
        Number(cache.coverage.start.slice(0, 4)) +
        1,
    },
    (_, i) => Number(cache.coverage.start.slice(0, 4)) + i,
  );
  return {
    records: report.records,
    mode: "firms",
    updatedAt: cache.updatedAt,
    coverage: cache.coverage,
    years,
    notice: "Data NASA FIRMS · cache observasi, bukan pemantauan langsung",
  };
}

export async function loadObservations(
  boundaries: Provinces,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<ObservationDataset> {
  let notice = "Mode Demo — data FIRMS belum dikonfigurasi";
  try {
    const response = await fetcher("/data/firms-cache.json", {
      signal,
      cache: "no-store",
    });
    if (
      response.ok &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      return parseFirmsCache(await response.json(), boundaries);
    }
    if (response.status !== 404 && !response.ok)
      notice = "Mode Demo — cache FIRMS gagal dimuat";
  } catch {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    notice = "Mode Demo — cache FIRMS tidak tersedia atau tidak valid";
  }
  return {
    records: await demoDataService.loadRecords(boundaries),
    mode: "demo",
    years: YEARS,
    notice,
  };
}

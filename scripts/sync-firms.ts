import { readFile, writeFile, rename } from "node:fs/promises";
import type { Provinces } from "../src/types";
import {
  FIRMS_PRODUCTS,
  parseFirmsCache,
} from "../src/services/observationProvider";
import type { FirmsCache } from "../src/services/observationProvider";

export async function collectFirms(
  key: string,
  boundaries: Provinces,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<FirmsCache> {
  // Three completed UTC days: explicit dates avoid a changing window across requests.
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      86400000,
  );
  const start = new Date(end.getTime() - 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const products: FirmsCache["products"] = [];
  for (const name of FIRMS_PRODUCTS) {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${name}/94,-12,142,7/3/${start}`;
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("FIRMS request failed");
    const text = await response.text();
    if (text.length > 30_000_000 || text.includes(key))
      throw new Error("Invalid response");
    products.push({ name, text });
  }
  const cache: FirmsCache = {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    coverage: { start, end: end.toISOString().slice(0, 10) },
    products,
  };
  parseFirmsCache(cache, boundaries); // Reject partial/malformed responses before replacing the cache.
  return cache;
}

export async function main() {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim();
  if (!key) {
    console.log(
      "NASA_FIRMS_MAP_KEY belum tersedia. Tanpa cache sebelumnya, aplikasi otomatis memakai Mode Demo. Cache yang sudah ada tetap dipertahankan.",
    );
    return;
  }
  const boundaries = JSON.parse(
    await readFile("public/data/indonesia-provinces.geojson", "utf8"),
  ) as Provinces;
  const cache = await collectFirms(key, boundaries);
  const destination = "public/data/firms-cache.json";
  await writeFile(`${destination}.tmp`, JSON.stringify(cache));
  await rename(`${destination}.tmp`, destination);
  console.log(
    `Cache NASA FIRMS diperbarui: ${cache.coverage.start} sampai ${cache.coverage.end} (UTC). Jalankan ulang build untuk distribusi statis.`,
  );
}

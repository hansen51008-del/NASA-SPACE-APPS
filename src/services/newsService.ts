export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
  provinces: string[];
}
export interface NewsSourceResult {
  id: string;
  name: string;
  url: string | null;
  status: "success" | "failed" | "unverified" | "disabled";
  matched: number;
}
export interface NewsCache {
  schemaVersion: 1;
  fetchedAt: string;
  sources: NewsSourceResult[];
  items: NewsItem[];
}
export const NEWS_LIMIT = 50;
export const relevantNews = (text: string) =>
  /\b(karhutla|kebakaran\s+(?:hutan|lahan)|titik\s+panas|hotspots?|kabut\s+asap|gambut|bpbd|manggala\s+agni)\b/i.test(
    text,
  );

export function normalizeNewsUrl(value: string, base?: string): string {
  const url = new URL(value, base);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
      url.hostname,
    )
  )
    throw new Error("URL berita tidak valid");
  for (const name of [...url.searchParams.keys()]) {
    if (/key|token|secret|auth|signature|credential|password/i.test(name))
      throw new Error("URL berkredensial tidak diizinkan");
    if (/^(utm_.+|fbclid|gclid|ref)$/i.test(name))
      url.searchParams.delete(name);
  }
  url.hash = "";
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}
export const newsTitleKey = (title: string) =>
  title
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const plain = (
  value: unknown,
  max: number,
  allowEmpty = false,
): value is string =>
  typeof value === "string" &&
  (allowEmpty || value.trim().length > 0) &&
  [...value].length <= max &&
  !/[<>\u0000-\u001f\u007f]/.test(value);
const timestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));

export function validateNewsCache(
  value: unknown,
  provinces: readonly string[],
): NewsCache {
  const cache = value as NewsCache;
  if (
    !cache ||
    cache.schemaVersion !== 1 ||
    !timestamp(cache.fetchedAt) ||
    !Array.isArray(cache.sources) ||
    !cache.sources.length ||
    cache.sources.length > 30 ||
    !Array.isArray(cache.items) ||
    cache.items.length > NEWS_LIMIT
  )
    throw new Error("Cache berita tidak valid");
  const ids = new Set<string>();
  for (const source of cache.sources) {
    if (
      !source ||
      !plain(source.id, 80) ||
      ids.has(source.id) ||
      !plain(source.name, 100) ||
      !["success", "failed", "unverified", "disabled"].includes(
        source.status,
      ) ||
      !Number.isInteger(source.matched) ||
      source.matched < 0 ||
      source.matched > 5000 ||
      (source.url !== null && normalizeNewsUrl(source.url) !== source.url) ||
      (source.status === "success" && !source.url)
    )
      throw new Error("Sumber berita tidak valid");
    ids.add(source.id);
  }
  const urls = new Set<string>(),
    titles = new Set<string>();
  let previous = Infinity;
  for (const item of cache.items) {
    if (
      !item ||
      !plain(item.title, 300) ||
      !plain(item.source, 100) ||
      !plain(item.summary, 200, true) ||
      !timestamp(item.publishedAt) ||
      Date.parse(item.publishedAt) > Date.parse(cache.fetchedAt) + 5 * 60_000 ||
      normalizeNewsUrl(item.url) !== item.url ||
      !Array.isArray(item.provinces) ||
      new Set(item.provinces).size !== item.provinces.length ||
      item.provinces.some((p) => !provinces.includes(p)) ||
      !cache.sources.some(
        (s) => s.status === "success" && s.name === item.source,
      )
    )
      throw new Error("Item berita tidak valid");
    const key = newsTitleKey(item.title),
      time = Date.parse(item.publishedAt);
    if (!key || urls.has(item.url) || titles.has(key) || time > previous)
      throw new Error("Urutan atau duplikasi berita tidak valid");
    urls.add(item.url);
    titles.add(key);
    previous = time;
  }
  // Return only the public schema, never propagate arbitrary cache fields into UI.
  return {
    schemaVersion: 1,
    fetchedAt: cache.fetchedAt,
    sources: cache.sources.map(({ id, name, url, status, matched }) => ({
      id,
      name,
      url,
      status,
      matched,
    })),
    items: cache.items.map(
      ({ title, source, url, publishedAt, summary, provinces }) => ({
        title,
        source,
        url,
        publishedAt,
        summary,
        provinces: [...provinces],
      }),
    ),
  };
}

export async function loadNews(
  provinces: readonly string[],
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<NewsCache> {
  const response = await fetcher("/data/news-cache.json", {
    signal,
    cache: "no-cache",
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("Berita belum tersedia");
  return validateNewsCache(await response.json(), provinces);
}

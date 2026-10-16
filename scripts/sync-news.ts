import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { SaxesParser } from "saxes";
import type { Provinces } from "../src/types";
import {
  NEWS_LIMIT,
  newsTitleKey,
  normalizeNewsUrl,
  relevantNews,
  validateNewsCache,
} from "../src/services/newsService";
import type {
  NewsCache,
  NewsItem,
  NewsSourceResult,
} from "../src/services/newsService";

export interface NewsSource {
  id: string;
  name: string;
  url: string | null;
  verified: boolean;
  enabled: boolean;
}
const MAX_BYTES = 2_000_000;
export function plainFeedText(input: string, limit: number): string {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
  };
  const decoded = input.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (whole, entity: string) => {
      if (!entity.startsWith("#"))
        return entities[entity.toLowerCase()] ?? whole;
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : " ";
    },
  );
  const text = decoded
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...text];
  return chars.length > limit
    ? chars
        .slice(0, limit - 1)
        .join("")
        .trimEnd() + "…"
    : text;
}

// Match longer province names first: Papua Barat Daya must not become Papua Barat/Papua.
export function tagProvinces(
  text: string,
  provinces: readonly string[],
): string[] {
  const aliases: Record<string, string[]> = {
    "DKI Jakarta": ["Jakarta", "Daerah Khusus Jakarta", "DK Jakarta"],
    "Daerah Istimewa Yogyakarta": [
      "DI Yogyakarta",
      "D.I. Yogyakarta",
      "Yogyakarta",
      "DIY",
    ],
    "Kepulauan Bangka Belitung": ["Bangka Belitung", "Babel"],
    "Kepulauan Riau": ["Kepri"],
    "Sumatera Utara": ["Sumut", "Sumatra Utara"],
    "Sumatera Barat": ["Sumbar", "Sumatra Barat"],
    "Sumatera Selatan": ["Sumsel", "Sumatra Selatan"],
    "Kalimantan Barat": ["Kalbar"],
    "Kalimantan Tengah": ["Kalteng"],
    "Kalimantan Selatan": ["Kalsel"],
    "Kalimantan Timur": ["Kaltim"],
    "Kalimantan Utara": ["Kaltara"],
    "Jawa Barat": ["Jabar"],
    "Jawa Tengah": ["Jateng"],
    "Jawa Timur": ["Jatim"],
    "Sulawesi Barat": ["Sulbar"],
    "Sulawesi Tengah": ["Sulteng"],
    "Sulawesi Selatan": ["Sulsel"],
    "Sulawesi Utara": ["Sulut"],
    "Sulawesi Tenggara": ["Sultra"],
    "Nusa Tenggara Barat": ["NTB"],
    "Nusa Tenggara Timur": ["NTT"],
    "Maluku Utara": ["Malut"],
  };
  let remaining = " " + newsTitleKey(text) + " ";
  const found = new Set<string>();
  const patterns = provinces
    .flatMap((province) =>
      [province, ...(aliases[province] ?? [])].map((name) => ({
        province,
        name: newsTitleKey(name),
      })),
    )
    .sort((a, b) => b.name.length - a.name.length);
  for (const { province, name } of patterns) {
    const token = " " + name + " ";
    if (remaining.includes(token)) {
      found.add(province);
      remaining = remaining.replaceAll(token, " ");
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b, "id"));
}

export function parseNewsFeed(
  xml: string,
  source: NewsSource,
  provinces: readonly string[],
  now = new Date(),
): NewsItem[] {
  if (
    !source.url ||
    Buffer.byteLength(xml) > MAX_BYTES ||
    /<!DOCTYPE|<!ENTITY/i.test(xml)
  )
    throw new Error("Feed tidak valid");
  const parser = new SaxesParser({ xmlns: true });
  const stack: string[] = [];
  let channel = false;
  let format = "",
    entryDepth = 0,
    entry: Record<string, string> | null = null,
    field = "",
    fieldDepth = 0,
    count = 0;
  const items: NewsItem[] = [];
  parser.on("opentag", (tag) => {
    const local = tag.local.toLowerCase();
    const parent = stack.at(-1);
    stack.push(local);
    if (local === "channel" && parent === "rss" && stack.length === 2)
      channel = true;
    if (stack.length > 32) throw new Error("Feed terlalu dalam");
    if (stack.length === 1) {
      if (
        local !== "rss" &&
        !(local === "feed" && tag.uri === "http://www.w3.org/2005/Atom")
      )
        throw new Error("Bukan RSS/Atom");
      format = local;
    }
    if (
      (format === "rss" &&
        local === "item" &&
        parent === "channel" &&
        stack.length === 3) ||
      (format === "feed" && local === "entry" && stack.length === 2)
    ) {
      if (++count > 5000) throw new Error("Feed terlalu besar");
      entry = {};
      entryDepth = stack.length;
    } else if (entry && stack.length === entryDepth + 1) {
      if (local === "link" && format === "feed") {
        const attrs = Object.values(tag.attributes);
        const attr = (key: string) => attrs.find((a) => a.local === key)?.value;
        if (
          (!attr("rel") || attr("rel") === "alternate") &&
          (!attr("type") || attr("type") === "text/html")
        )
          entry.link ??= attr("href") ?? "";
      } else if (
        [
          "title",
          "description",
          "summary",
          "pubdate",
          "published",
          "updated",
          "date",
          "link",
        ].includes(local)
      ) {
        field = local;
        fieldDepth = stack.length;
        entry[field] ??= "";
      }
    }
  });
  const text = (value: string) => {
    if (entry && field) entry[field] += value;
  };
  parser.on("text", text);
  parser.on("cdata", text);
  parser.on("error", () => {
    throw new Error("XML tidak valid");
  });
  parser.on("closetag", () => {
    if (stack.length === fieldDepth) {
      field = "";
      fieldDepth = 0;
    }
    if (entry && stack.length === entryDepth) {
      const title = plainFeedText(entry.title ?? "", 300);
      const fullSummary = plainFeedText(
        entry.description ?? entry.summary ?? "",
        MAX_BYTES,
      );
      const summary = plainFeedText(fullSummary, 200);
      const date =
        entry.pubdate ?? entry.published ?? entry.date ?? entry.updated;
      const time = Date.parse(date ?? "");
      if (
        title &&
        relevantNews(title + " " + fullSummary) &&
        Number.isFinite(time) &&
        time <= now.getTime() + 5 * 60_000
      ) {
        try {
          if (!entry.link?.trim()) throw new Error("Tautan kosong");
          const url = normalizeNewsUrl(entry.link.trim(), source.url!);
          items.push({
            title,
            summary,
            source: source.name,
            url,
            publishedAt: new Date(time).toISOString(),
            provinces: tagProvinces(title + " " + fullSummary, provinces),
          });
        } catch {
          /* Invalid/keyed links are discarded, never logged. */
        }
      }
      entry = null;
      field = "";
      fieldDepth = 0;
    }
    stack.pop();
  });
  parser.write(xml).close();
  if (!format || (format === "rss" && !channel))
    throw new Error("Feed kosong atau struktur tidak valid");
  return items;
}

async function boundedText(response: Response): Promise<string> {
  if (
    Number(response.headers.get("content-length")) > MAX_BYTES ||
    !response.body
  )
    throw new Error("Feed terlalu besar");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Feed terlalu besar");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function collectNews(
  sources: NewsSource[],
  provinces: readonly string[],
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<NewsCache> {
  if (!Array.isArray(sources) || !sources.length || sources.length > 30)
    throw new Error("Konfigurasi tidak valid");
  const results: NewsSourceResult[] = [],
    all: NewsItem[] = [];
  for (const source of sources) {
    if (
      !source ||
      typeof source.verified !== "boolean" ||
      typeof source.enabled !== "boolean" ||
      (source.url !== null && normalizeNewsUrl(source.url) !== source.url)
    )
      throw new Error("Konfigurasi sumber tidak valid");
    const result: NewsSourceResult = {
      id: source.id,
      name: source.name,
      url: source.url,
      status: !source.verified
        ? "unverified"
        : !source.enabled
          ? "disabled"
          : "failed",
      matched: 0,
    };
    results.push(result);
    if (!source.verified || !source.enabled || !source.url) continue;
    try {
      const response = await fetcher(source.url, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      });
      if (!response.ok) throw new Error("Sumber tidak tersedia");
      const items = parseNewsFeed(
        await boundedText(response),
        source,
        provinces,
        now,
      );
      result.status = "success";
      result.matched = items.length;
      all.push(...items);
    } catch {
      /* Store a generic status only: no upstream URL, error text, or body. */
    }
  }
  if (!results.some((r) => r.status === "success"))
    throw new Error("Semua sumber gagal");
  const urls = new Set<string>(),
    titles = new Set<string>();
  const items = all
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.url.localeCompare(b.url),
    )
    .filter((item) => {
      const title = newsTitleKey(item.title);
      if (urls.has(item.url) || titles.has(title)) return false;
      urls.add(item.url);
      titles.add(title);
      return true;
    })
    .slice(0, NEWS_LIMIT);
  return validateNewsCache(
    { schemaVersion: 1, fetchedAt: now.toISOString(), sources: results, items },
    provinces,
  );
}

export async function syncNewsFile(
  sources: NewsSource[],
  provinces: readonly string[],
  destination: string,
  fetcher: typeof fetch = fetch,
  now = new Date(),
) {
  const cache = await collectNews(sources, provinces, fetcher, now);
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(cache, null, 2) + "\n");
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return cache;
}
export async function main() {
  const sources = JSON.parse(
    await readFile("scripts/news-sources.json", "utf8"),
  ) as NewsSource[];
  const boundaries = JSON.parse(
    await readFile("public/data/indonesia-provinces.geojson", "utf8"),
  ) as Provinces;
  const cache = await syncNewsFile(
    sources,
    boundaries.features.map((f) => f.properties.PROVINSI),
    "public/data/news-cache.json",
  );
  console.log(
    `Cache berita diperbarui: ${cache.items.length} item; ${cache.sources.filter((s) => s.status === "success").length} sumber berhasil, ${cache.sources.filter((s) => s.status === "failed").length} gagal. Jalankan build untuk distribusi statis.`,
  );
}

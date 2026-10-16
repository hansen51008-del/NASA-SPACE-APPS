import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hotspot, Provinces } from "../src/types";
import type { ObservationDataset } from "../src/services/observationProvider";
import {
  loadNews,
  normalizeNewsUrl,
  validateNewsCache,
} from "../src/services/newsService";
import {
  collectNews,
  parseNewsFeed,
  plainFeedText,
  syncNewsFile,
  tagProvinces,
} from "../scripts/sync-news";
import type { NewsSource } from "../scripts/sync-news";
import { observationUpdates } from "../src/services/observationUpdates";
import { calculateRisk } from "../src/services/riskService";

const provinces = (
  JSON.parse(
    readFileSync("public/data/indonesia-provinces.geojson", "utf8"),
  ) as Provinces
).features.map((f) => f.properties.PROVINSI);
const rss = readFileSync("tests/fixtures/news-rss.xml", "utf8");
const atom = readFileSync("tests/fixtures/news-atom.xml", "utf8");
const now = new Date("2026-10-16T12:00:00.000Z");
const source: NewsSource = {
  id: "fixture",
  name: "Sumber fixture",
  url: "https://news.example.org/feed.xml",
  verified: true,
  enabled: true,
};
const response = (text = rss) =>
  new Response(text, { headers: { "Content-Type": "application/rss+xml" } });
afterEach(() => vi.useRealTimers());

describe("RSS/Atom ingestion", () => {
  it("filters and tags from the feed summary before truncation", async () => {
    const xml = `<rss><channel><item><title>Kesiapsiagaan warga</title><link>https://news.example.org/late</link><pubDate>${now.toUTCString()}</pubDate><description>${"Keterangan ".repeat(30)}karhutla di Riau.</description></item></channel></rss>`;
    const cache = await collectNews(
      [source],
      provinces,
      async () => response(xml),
      now,
    );
    expect(cache.items).toHaveLength(1);
    expect(cache.items[0].provinces).toEqual(["Riau"]);
    expect([...cache.items[0].summary].length).toBeLessThanOrEqual(200);
  });
  it("filters keywords, strips markup and images, and excludes full article content", () => {
    const items = parseNewsFeed(rss, source, provinces, now);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://news.example.org/riau",
      publishedAt: "2026-10-16T06:00:00.000Z",
      provinces: ["Kepulauan Riau", "Riau"],
    });
    expect(items[0].summary).toBe(
      "Latihan kesiapsiagaan di Riau & Kepulauan Riau.",
    );
    expect(JSON.stringify(items)).not.toMatch(
      /tracker|script|Artikel penuh|alert/,
    );
    expect(Object.keys(items[0]).sort()).toEqual(
      ["title", "source", "url", "publishedAt", "summary", "provinces"].sort(),
    );
  });
  it("supports Atom alternate links, dates, summaries and namespaces", () => {
    const items = parseNewsFeed(atom, source, provinces, now);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://news.example.org/papua",
      publishedAt: "2026-10-15T22:00:00.000Z",
      provinces: ["Papua Barat Daya"],
    });
    expect(items[1].provinces).toEqual(["Maluku Utara"]);
    expect(JSON.stringify(items)).not.toContain("Artikel lengkap");
  });
  it("tags every canonical province and prevents overlapping matches", () => {
    expect(provinces).toHaveLength(38);
    for (const name of provinces)
      expect(tagProvinces(`Karhutla di ${name}.`, provinces)).toEqual([name]);
    expect(tagProvinces("BPBD Kepri dan Kalteng", provinces)).toEqual([
      "Kalimantan Tengah",
      "Kepulauan Riau",
    ]);
  });
  it("limits summaries by Unicode characters and strips encoded HTML", () => {
    expect([...plainFeedText("🔥".repeat(220), 200)]).toHaveLength(200);
    expect(
      plainFeedText(
        "&lt;script&gt;secret&lt;/script&gt;<b>gambut</b>&nbsp;Riau",
        200,
      ),
    ).toBe("gambut Riau");
  });
  it.each([
    "<html>blocked</html>",
    "<rss><channel><item></channel>",
    '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]><rss/>',
    "<rss/>",
    "",
  ])("rejects malformed/unsafe/non-feed responses", (xml) => {
    expect(() => parseNewsFeed(xml, source, provinces, now)).toThrow();
  });
  it("rejects future-dated articles", () => {
    expect(
      parseNewsFeed(rss, source, provinces, new Date("2020-01-01")),
    ).toEqual([]);
  });
  it("normalizes tracking URLs and rejects credentialed or executable URLs", () => {
    expect(
      normalizeNewsUrl(
        "https://news.example.org/a/?utm_campaign=x&b=2&a=1#top",
      ),
    ).toBe("https://news.example.org/a?a=1&b=2");
    for (const url of [
      "javascript:alert(1)",
      "https://user:pass@news.example.org/a",
      "https://news.example.org/a?api_key=secret",
      "https://127.0.0.1/a",
    ])
      expect(() => normalizeNewsUrl(url)).toThrow();
  });
});

describe("news sync and cache", () => {
  it("skips unverified/disabled sources, records failures, deduplicates and sorts", async () => {
    const sources = [
      source,
      { ...source, id: "duplicate" },
      { ...source, id: "off", enabled: false },
      { ...source, id: "unknown", verified: false },
      { ...source, id: "fail", url: "https://news.example.org/fail" },
    ];
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith("/fail")
        ? new Response("", { status: 503 })
        : response(),
    );
    const cache = await collectNews(sources, provinces, fetcher, now);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(cache.items).toHaveLength(2);
    expect(cache.sources.map((s) => s.status)).toEqual([
      "success",
      "success",
      "disabled",
      "unverified",
      "failed",
    ]);
    expect(cache.items.map((i) => i.publishedAt)).toEqual(
      [...cache.items.map((i) => i.publishedAt)].sort().reverse(),
    );
  });
  it("deduplicates normalized titles across distinct URLs and caps at 50", async () => {
    const items = Array.from(
      { length: 60 },
      (_, i) =>
        `<item><title>Karhutla Riau ${i}</title><link>https://news.example.org/${i}</link><pubDate>${new Date(now.getTime() - i * 60_000).toUTCString()}</pubDate><description>Fixture</description></item>`,
    ).join("");
    const xml = `<rss><channel>${items}<item><title>KARHUTLA RIAU 0!</title><link>https://news.example.org/duplicate</link><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`;
    const cache = await collectNews(
      [source],
      provinces,
      async () => response(xml),
      now,
    );
    expect(cache.items).toHaveLength(50);
    expect(
      cache.items.filter((i) => /Riau 0|RIAU 0/.test(i.title)),
    ).toHaveLength(1);
  });
  it("preserves the old cache on total failure; atomically replaces validated success", async () => {
    const directory = await mkdtemp(join(tmpdir(), "siagaapi-news-test-"));
    const destination = join(directory, "news-cache.json");
    try {
      await writeFile(destination, "old cache");
      await expect(
        syncNewsFile(
          [source],
          provinces,
          destination,
          async () => response("<html>blocked</html>"),
          now,
        ),
      ).rejects.toThrow();
      expect(await readFile(destination, "utf8")).toBe("old cache");
      const cache = await syncNewsFile(
        [source],
        provinces,
        destination,
        async () => response(),
        now,
      );
      expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(cache);
      expect(await readdir(directory)).toEqual(["news-cache.json"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("rejects oversized upstream responses and supplies timeout/redirect protection", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response("x", { headers: { "content-length": "2000001" } }),
    );
    await expect(
      collectNews([source], provinces, fetcher, now),
    ).rejects.toThrow();
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
  });
  it("rejects malformed public caches and loads only the local JSON", async () => {
    const cache = await collectNews(
      [source],
      provinces,
      async () => response(),
      now,
    );
    expect(() =>
      validateNewsCache(
        {
          ...cache,
          items: [{ ...cache.items[0], url: "javascript:alert(1)" }],
        },
        provinces,
      ),
    ).toThrow();
    expect(() =>
      validateNewsCache(
        {
          ...cache,
          items: [{ ...cache.items[0], summary: "<img onerror=x>" }],
        },
        provinces,
      ),
    ).toThrow();
    expect(() =>
      validateNewsCache(
        { ...cache, items: [{ ...cache.items[0], provinces: ["invalid"] }] },
        provinces,
      ),
    ).toThrow();
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(cache), {
          headers: { "content-type": "application/json" },
        }),
    );
    expect(await loadNews(provinces, undefined, fetcher)).toEqual(cache);
    expect(fetcher).toHaveBeenCalledWith("/data/news-cache.json", {
      signal: undefined,
      cache: "no-cache",
    });
    await expect(
      loadNews(
        provinces,
        undefined,
        async () => new Response("", { status: 404 }),
      ),
    ).rejects.toThrow();
  });
});

describe("automatic observation updates", () => {
  const record: Hotspot = {
    id: "a",
    source: "MODIS",
    latitude: 0.5,
    longitude: 101.5,
    date: "2026-10-14T03:00:00.000Z",
    confidence: "high",
    nativeConfidence: 90,
    province: "Riau",
    year: 2026,
    month: 10,
    isDemo: false,
  };
  const dataset: ObservationDataset = {
    mode: "firms",
    notice: "Fixture",
    years: [2026],
    updatedAt: "2026-10-16T00:00:00.000Z",
    coverage: { start: "2026-10-12", end: "2026-10-14" },
    records: [
      record,
      { ...record, id: "b", source: "VIIRS", nativeConfidence: "h" },
    ],
  };
  it("uses existing harmonization and score unchanged, independently of map filters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const original = structuredClone(dataset);
    const [update] = observationUpdates(dataset, ["Riau"], 2026, null);
    expect(update.title).toContain("1 observasi hotspot gabungan");
    expect(update.level).toBe(calculateRisk(dataset, "Riau", 2026, null).level);
    expect(update.period).toBe("2026-10-12 — 2026-10-14 (UTC)");
    expect(dataset).toEqual(original);
  });
  it("never presents missing coverage or stale data as Aman", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(observationUpdates(dataset, ["Riau"], 2026, 9)[0]).toMatchObject({
      level: null,
      period: "Di luar cakupan data",
    });
    vi.setSystemTime(new Date("2026-10-24T00:00:00Z"));
    expect(
      observationUpdates(dataset, ["Riau"], 2026, null)[0].level,
    ).toBeNull();
  });
  it("labels demo data explicitly", () => {
    expect(
      observationUpdates(
        { ...dataset, mode: "demo", records: [{ ...record, isDemo: true }] },
        ["Riau"],
        2026,
        10,
      )[0].isDemo,
    ).toBe(true);
  });
});

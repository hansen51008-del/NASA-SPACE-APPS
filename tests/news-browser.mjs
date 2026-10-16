import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const url = process.env.APP_URL ?? "http://127.0.0.1:4173";
const firms = JSON.parse(
  await readFile("public/data/firms-cache.json", "utf8"),
);
const fixture = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  sources: [
    {
      id: "fixture",
      name: "Sumber fixture",
      url: "https://news.example.org/rss",
      status: "success",
      matched: 1,
    },
    {
      id: "failed",
      name: "Sumber gagal",
      url: "https://news.example.org/fail",
      status: "failed",
      matched: 0,
    },
    {
      id: "unknown",
      name: "Belum diverifikasi",
      url: null,
      status: "unverified",
      matched: 0,
    },
  ],
  items: [
    {
      title: "BPBD Riau membahas kesiapsiagaan karhutla",
      source: "Sumber fixture",
      url: "https://news.example.org/riau",
      publishedAt: new Date().toISOString(),
      summary: "Ringkasan fixture pengujian, bukan berita nyata.",
      provinces: ["Riau"],
    },
  ],
};
await mkdir("test-results", { recursive: true });
try {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [],
      externalNews = [];
    let newsRequests = 0,
      state = "ready",
      demo = false;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("news.example.org"))
        externalNews.push(request.url());
    });
    await page.addInitScript(() =>
      sessionStorage.setItem("siagaapi:intro-seen", "1"),
    );
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.route("**/data/firms-cache.json", (route) =>
      demo
        ? route.fulfill({ status: 404, body: "" })
        : route.fulfill({
            json: { ...firms, updatedAt: "2000-01-01T00:00:00.000Z" },
          }),
    );
    await page.route("**/data/news-cache.json", async (route) => {
      newsRequests++;
      if (state === "error") return route.fulfill({ status: 404, body: "" });
      if (state === "invalid")
        return route.fulfill({
          json: {
            ...fixture,
            items: [{ ...fixture.items[0], url: "javascript:alert(1)" }],
          },
        });
      return route.fulfill({
        json: { ...fixture, items: state === "empty" ? [] : fixture.items },
      });
    });
    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const open = async () => {
      await tab("Berita").click();
      await page.locator(".news-headlines").waitFor();
    };
    await page.goto(url);
    await page.locator(".risk-score").waitFor();
    assert.equal(newsRequests, 0, "No news request before opening the tab");
    assert.equal(await page.getByRole("tab").count(), 5);
    await tab("Berita").click();
    await page.locator(".news-item").waitFor();
    assert.equal(await tab("Berita").getAttribute("aria-selected"), "true");
    assert.match(
      await page.locator(".news-risk").innerText(),
      /Belum dapat dinilai/,
    );
    assert.match(
      await page.locator(".news-observations").innerText(),
      /Bukan berita dan bukan konfirmasi kebakaran/,
    );
    assert.match(
      await page.locator(".news-status").innerText(),
      /Sebagian sumber gagal/,
    );
    assert.equal(
      await page.locator(".news-read").getAttribute("href"),
      fixture.items[0].url,
    );
    assert.equal(await page.locator(".news-item img").count(), 0);
    assert.equal(await page.getByRole("tabpanel").count(), 1);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const element of await page
      .locator(
        ".main-tabs button, .news-kinds button, .news-filters select, .news-read",
      )
      .all())
      assert((await element.boundingBox()).height >= 44);
    await page.screenshot({
      path: `test-results/news-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Wilayah informasi").selectOption("Jawa Barat");
    await page
      .getByText("Belum ada berita bertag Jawa Barat", { exact: true })
      .waitFor();
    await page.getByLabel("Wilayah informasi").selectOption("Riau");
    await page.locator(".news-item").waitFor();
    await page
      .getByRole("button", { name: "Pembaruan observasi", exact: true })
      .click();
    assert.equal(await page.locator(".news-headlines").count(), 0);
    assert.match(
      await page.locator(".news-observation h3").innerText(),
      /Riau/,
    );
    await page.getByRole("button", { name: "Berita", exact: true }).click();
    assert.equal(await page.locator(".news-observations").count(), 0);
    await tab("Berita").press("Home");
    assert.equal(await tab("Beranda").getAttribute("aria-selected"), "true");
    for (const failure of ["error", "invalid", "empty"]) {
      state = failure;
      await open();
      await page
        .getByRole("heading", {
          name:
            failure === "empty"
              ? "Belum ada berita yang sesuai"
              : "Berita belum tersedia",
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".news-observation").count(), 1);
      await tab("Beranda").click();
    }
    state = "ready";
    demo = true;
    await page.reload();
    await page.locator(".risk-score").waitFor();
    await open();
    await page.locator(".news-item").waitFor();
    assert.match(
      await page.locator(".news-observation").innerText(),
      /Mode Demo/,
    );
    assert.doesNotMatch(
      await page.locator(".news-headlines").innerText(),
      /Mode Demo/,
    );
    assert.equal(page.url(), url + "/");
    assert.deepEqual(
      externalNews,
      [],
      "Browser only loads local cache, never RSS feeds",
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS news ${width}px: four tabs, filters, links, partial failure, stale observations, demo labels, unavailable/invalid/empty cache, keyboard and touch targets.`,
    );
    await page.close();
  }
  // Smoke-test the actual public cache bundled into the static preview as well.
  const actual = JSON.parse(
    await readFile("public/data/news-cache.json", "utf8"),
  );
  const page = await browser.newPage({
    viewport: { width: 360, height: 900 },
    reducedMotion: "reduce",
  });
  await page.addInitScript(() =>
    sessionStorage.setItem("siagaapi:intro-seen", "1"),
  );
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto(url);
  await page.locator(".risk-score").waitFor();
  await page.getByRole("tab", { name: "Berita", exact: true }).click();
  await page.locator(".news-sources").waitFor();
  assert.equal(
    await page.locator(".news-item").count(),
    Math.min(12, actual.items.length),
  );
  await page.screenshot({
    path: "test-results/news-public-cache-360.png",
    fullPage: true,
  });
  await page.close();
  console.log(
    `PASS actual static news cache: ${actual.items.length} cached items rendered.`,
  );
} finally {
  await browser.close();
}

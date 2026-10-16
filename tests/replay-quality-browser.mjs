import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("siagaapi:intro-seen", "1");
      localStorage.setItem("siagaapi:quality", "low");
    } catch {}
  });
  const tiles = await page.evaluate(() => {
    const make = (size, colour) => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const x = c.getContext("2d");
      x.fillStyle = colour;
      x.fillRect(0, 0, size, size);
      return c.toDataURL().split(",")[1];
    };
    return { dem: make(512, "rgb(128,0,0)"), image: make(256, "#807c70") };
  });
  let detailRequests = 0;
  await page.route(/^https:\/\//, (r) => {
    const url = r.request().url();
    if (url.includes("s2cloudless")) detailRequests++;
    const dem = url.includes("tiles.mapterhorn.com");
    if (dem || url.includes("World_Imagery") || url.includes("s2cloudless"))
      return r.fulfill({
        contentType: "image/png",
        body: Buffer.from(dem ? tiles.dem : tiles.image, "base64"),
      });
    return r.abort();
  });
  await page.route("**/data/firms-cache.json", (r) =>
    r.fulfill({ status: 404, body: "" }),
  );
  await page.goto("http://127.0.0.1:4173");
  await page.locator(".risk-score").waitFor();
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await page.getByRole("tab", { name: "Peta aktivitas", exact: true }).click();
  await page.locator('.terrain-view[data-ready="true"]').waitFor();
  assert.ok(
    await page
      .locator(".maplibregl-canvas")
      .evaluate((c) => c.width / c.clientWidth <= 1.01),
  );
  await page.locator(".map-period-controls > summary").click();
  await page
    .getByLabel("Wilayah pemantauan", { exact: true })
    .selectOption("Riau");
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await page.waitForTimeout(500);
  assert.ok((await page.locator(".selected-fire-anchor").count()) <= 6);
  assert.equal(detailRequests, 0);
  await page
    .getByRole("button", { name: "Kualitas rendah", exact: true })
    .click();
  await page.waitForFunction(() => {
    const c = document.querySelector(".maplibregl-canvas");
    return c && c.width / c.clientWidth > 1;
  });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page
    .getByRole("button", { name: "Putar arsip demo", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  const month = () =>
    page
      .locator('.replay .month-button[aria-pressed="true"]')
      .getAttribute("aria-label");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await month();
  await page.waitForTimeout(2400);
  assert.equal(await month(), paused);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    (previous) =>
      document
        .querySelector('.replay .month-button[aria-pressed="true"]')
        ?.getAttribute("aria-label") !== previous,
    paused,
  );
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await page
    .locator(".atlas-map")
    .evaluate((el) => (el.style.display = "none"));
  await page.waitForTimeout(100);
  const offscreen = await month();
  await page.waitForTimeout(2400);
  assert.equal(await month(), offscreen);
  await page.locator(".atlas-map").evaluate((el) => (el.style.display = ""));
  await page
    .getByRole("button", { name: "Jeda pemutaran", exact: true })
    .click();
  console.log(
    "PASS 3D DPR 1/reversal, max 6 fire effects, no Sentinel detail in low mode, replay hidden/offscreen pause and resume",
  );
} finally {
  await browser.close();
}

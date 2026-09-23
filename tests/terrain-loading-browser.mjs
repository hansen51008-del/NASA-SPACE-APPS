import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
let releaseDetail;
const detailGate = new Promise((resolve) => {
  releaseDetail = resolve;
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await mkdir("test-results/loading", { recursive: true });
  const fixtures = await page.evaluate(() => {
    const png = (size, colour) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, size, size);
      return canvas.toDataURL().split(",")[1];
    };
    return {
      dem: png(512, "rgb(131,232,0)"),
      overview: png(256, "rgb(82,104,62)"),
      detail: png(256, "rgb(118,130,96)"),
    };
  });
  await page.route("https://tiles.mapterhorn.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(fixtures.dem, "base64"),
    }),
  );
  await page.route("**/World_Imagery/MapServer/tile/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(fixtures.overview, "base64"),
    }),
  );
  await page.route("**/s2cloudless-2024_3857/default/g/**", async (route) => {
    await detailGate;
    await route
      .fulfill({
        contentType: "image/png",
        body: Buffer.from(fixtures.detail, "base64"),
      })
      .catch(() => {});
  });
  await page.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await page.locator('.terrain-view[data-ready="true"]').waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Province colours", exact: true })
    .click();
  await page.getByLabel("Hotspot detections", { exact: true }).uncheck();
  await page.getByLabel("Province boundaries", { exact: true }).uncheck();
  await page.evaluate(() => {
    const element = document.querySelector(".terrain-gl");
    let fiber =
      element[
        Object.keys(element).find((key) => key.startsWith("__reactFiber"))
      ];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate?.getCenter && candidate?.getStyle) {
          window.testTerrainMap = candidate;
          return;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    throw new Error("Map ref unavailable");
  });
  await page.addStyleTag({
    content:
      ".terrain-view > :not(.terrain-gl), .map-topline, .map-view-switch, .map-selection, .map-source, .maplibregl-control-container {visibility:hidden!important}",
  });
  for (const zoom of [7, 8.5, 10.2, 12.3]) {
    await page.evaluate(
      (zoom) =>
        window.testTerrainMap.jumpTo({
          center: [112.94, -8.035],
          zoom,
          pitch: 60,
          bearing: -18,
        }),
      zoom,
    );
    await page.waitForFunction(() =>
      window.testTerrainMap.isSourceLoaded("overview"),
    );
    await page.waitForTimeout(500);
    const bytes = await page
      .locator(".maplibregl-canvas")
      .screenshot({ path: `test-results/loading/zoom-${zoom}.png` });
    const blueFraction = await page.evaluate(
      async (data) => {
        const img = new Image();
        img.src = data;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(
          Math.round(img.width * 0.25),
          Math.round(img.height * 0.4),
          Math.round(img.width * 0.5),
          Math.round(img.height * 0.2),
        ).data;
        let blue = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 2] > pixels[i] + 5) blue++;
        return blue / (pixels.length / 4);
      },
      `data:image/png;base64,${bytes.toString("base64")}`,
    );
    console.log(`Zoom ${zoom}, detail held: blue fraction ${blueFraction}`);
    assert.ok(
      blueFraction < 0.005,
      `Zoom ${zoom}: loaded land must not turn into a blue background while detail is delayed`,
    );
  }
  releaseDetail();
  await page.waitForFunction(() =>
    window.testTerrainMap.isSourceLoaded("imagery"),
  );
  await page
    .locator(".maplibregl-canvas")
    .screenshot({ path: "test-results/loading/detail-loaded.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: overview retained across rapid zoom while close-up imagery is delayed.",
  );
} finally {
  releaseDetail();
  await browser.close();
}

import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const overviewZooms = [];
page.on("request", (request) => {
  const match = request.url().match(/World_Imagery\/MapServer\/tile\/(\d+)\//);
  if (match) overviewZooms.push(Number(match[1]));
});
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mkdir("test-results/lighting", { recursive: true });
  // A uniformly grey, deterministic satellite fixture isolates rendering from
  // acquisition dates, network delays and different imagery at different zooms.
  const textures = await page.evaluate(() => {
    const make = (size, colour) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, size, size);
      return canvas.toDataURL().split(",")[1];
    };
    return {
      dem: make(512, "rgb(131,232,0)"),
      satellite: make(256, "rgb(128,128,128)"),
    };
  });
  await page.route("https://tiles.mapterhorn.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(textures.dem, "base64"),
    }),
  );
  await page.route("**/s2cloudless-2024_3857/default/g/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(textures.satellite, "base64"),
    }),
  );
  await page.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await page.locator('.terrain-view[data-ready="true"]').waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Warna provinsi", exact: true })
    .click();
  await page.getByLabel("Deteksi hotspot", { exact: true }).uncheck();
  await page.getByLabel("Batas provinsi", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Satelit", exact: true }).click();
  await page.locator('.terrain-view[data-imagery="loaded"]').waitFor();
  // Test-only access to the public Map API through its owning React ref.
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
    throw new Error("Map ref belum tersedia");
  });
  await page.addStyleTag({
    content:
      ".terrain-view > :not(.terrain-gl), .map-topline, .map-view-switch, .map-selection, .map-source, .maplibregl-control-container { visibility: hidden !important; }",
  });
  const resolution = await page
    .locator(".maplibregl-canvas")
    .evaluate((canvas) => ({
      pixels: canvas.width * canvas.height,
      ratio: canvas.width / canvas.clientWidth,
    }));
  assert.ok(
    resolution.ratio >= 1.49,
    "HD render supersamples a standard desktop screen",
  );
  assert.ok(
    resolution.pixels <= 6_010_000,
    "HD render target stays within the pixel budget",
  );
  const measurements = [];
  for (let index = 0; index < 8; index++) {
    await page.evaluate((i) => {
      window.testTerrainMap.jumpTo({
        center: [112.94 + (i % 2) * 0.002, -8.035],
        zoom: 10.6,
        bearing: -18 + (i % 3) * 2,
        pitch: 64,
      });
    }, index);
    await page.waitForTimeout(800);
    const bytes = await page
      .locator(".maplibregl-canvas")
      .screenshot({ path: `test-results/lighting/frame-${index}.png` });
    measurements.push(
      await page.evaluate(
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
            Math.floor(img.width * 0.2),
            Math.floor(img.height * 0.4),
            Math.floor(img.width * 0.6),
            Math.floor(img.height * 0.25),
          ).data;
          let nonGrey = 0,
            sum = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const [r, g, b] = pixels.slice(i, i + 3);
            if (Math.max(r, g, b) - Math.min(r, g, b) > 6) nonGrey++;
            sum += (r + g + b) / 3;
          }
          return {
            nonGrey: nonGrey / (pixels.length / 4),
            mean: sum / (pixels.length / 4),
          };
        },
        `data:image/png;base64,${bytes.toString("base64")}`,
      ),
    );
  }
  console.log("Uniform surface during small camera moves:", measurements);
  assert.ok(
    measurements.every((frame) => frame.nonGrey < 0.01),
    "No coloured DEM/background tiles may replace a loaded satellite surface",
  );
  const means = measurements.map((frame) => frame.mean);
  assert.ok(
    Math.max(...means) - Math.min(...means) < 2,
    "Small camera moves must not change surface brightness",
  );
  assert.deepEqual(errors, []);
  if (process.argv.includes("--live")) {
    // Compare the SAME geographic patch at adjacent imagery levels. The former
    // source changes acquisition at Semeru (11 -> 12), even at fixed map zoom.
    const template = await page.evaluate(
      () => window.testTerrainMap.getStyle().sources.imagery.tiles[0],
    );
    const tiles = [];
    for (const z of [11, 12, 13, 14]) {
      const x = Math.floor(((112.922 + 180) / 360) * 2 ** z);
      const y = Math.floor(
        ((1 - Math.asinh(Math.tan((-8.108 * Math.PI) / 180)) / Math.PI) / 2) *
          2 ** z,
      );
      const response = await page.request.get(
        template.replace("{z}", z).replace("{x}", x).replace("{y}", y),
        { timeout: 30000 },
      );
      assert.ok(
        response.ok(),
        `Live imagery z${z} returned ${response.status()}`,
      );
      tiles.push({
        z,
        x,
        y,
        data: `data:image/jpeg;base64,${(await response.body()).toString("base64")}`,
      });
    }
    const differences = await page.evaluate(async (tiles) => {
      const images = await Promise.all(
        tiles.map(async (tile) => {
          const img = new Image();
          img.src = tile.data;
          await img.decode();
          return img;
        }),
      );
      const sample = (img, x, y, size) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, x, y, size, size, 0, 0, 32, 32);
        return ctx.getImageData(0, 0, 32, 32).data;
      };
      return tiles.slice(1).map((tile, i) => {
        const parent = sample(
          images[i],
          (tile.x % 2) * 128,
          (tile.y % 2) * 128,
          128,
        );
        const child = sample(images[i + 1], 0, 0, 256);
        let error = 0;
        for (let p = 0; p < parent.length; p++)
          if (p % 4 !== 3) error += Math.abs(parent[p] - child[p]);
        return { zoom: tile.z, difference: error / (32 * 32 * 3) };
      });
    }, tiles);
    console.log(
      "Semeru imagery colour difference across detail levels:",
      differences,
    );
    assert.ok(
      differences.every((d) => d.difference < 15),
      "Semeru imagery should preserve its appearance across detail levels",
    );
    // Capture the real surface and real elevation after the isolated fixture.
    await page.unroute("https://tiles.mapterhorn.com/**");
    await page.unroute("**/s2cloudless-2024_3857/default/g/**");
    await page.evaluate(() => {
      const map = window.testTerrainMap;
      for (const id of ["imagery", "elevation", "shading"])
        map.getSource(id).setTiles(map.getStyle().sources[id].tiles);
      map.jumpTo({
        center: [112.922, -8.108],
        zoom: 12,
        pitch: 64,
        bearing: -18,
      });
    });
    await page.waitForFunction(
      () => window.testTerrainMap.areTilesLoaded(),
      null,
      { timeout: 45000 },
    );
    const slopeColours = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(
        (i) =>
          window.testTerrainMap.jumpTo({
            bearing: -18 + i * 2,
            center: [112.922 + i * 0.001, -8.108],
          }),
        i,
      );
      await page.waitForTimeout(1000);
      const screenshot = await page
        .locator(".maplibregl-canvas")
        .screenshot({ path: `test-results/lighting/semeru-live-${i}.png` });
      slopeColours.push(
        await page.evaluate(async (base64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${base64}`;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          return [
            [112.913, -8.114],
            [112.918, -8.113],
            [112.922, -8.112],
          ].map((lnglat) => {
            const point = window.testTerrainMap.project(lnglat);
            const pixels = ctx.getImageData(
              Math.round(point.x) - 3,
              Math.round(point.y) - 3,
              7,
              7,
            ).data;
            const colour = [0, 0, 0];
            for (let p = 0; p < pixels.length; p += 4)
              for (let c = 0; c < 3; c++) colour[c] += pixels[p + c] / 49;
            return colour;
          });
        }, screenshot.toString("base64")),
      );
    }
    const slopeChanges = slopeColours
      .slice(1)
      .map(
        (samples) =>
          samples.reduce(
            (sum, colour, i) =>
              sum +
              colour.reduce(
                (s, c, j) => s + Math.abs(c - slopeColours[0][i][j]),
                0,
              ),
            0,
          ) / 9,
      );
    console.log(
      "Fixed mountain locations during camera moves (colour difference):",
      slopeChanges,
    );
    assert.ok(
      slopeChanges.every((change) => change < 18),
      "Small camera moves must not produce abrupt illumination changes on the same mountain slopes",
    );
    await page.evaluate(() =>
      window.testTerrainMap.jumpTo({
        center: [112.95, -7.942],
        zoom: 11.8,
        pitch: 75,
        bearing: 155,
      }),
    );
    await page.waitForFunction(
      () => window.testTerrainMap.areTilesLoaded(),
      null,
      { timeout: 45000 },
    );
    await page
      .locator(".maplibregl-canvas")
      .screenshot({ path: "test-results/lighting/bromo-reference-angle.png" });
    await page.evaluate(() =>
      window.testTerrainMap.jumpTo({
        center: [118, -2],
        zoom: 4,
        pitch: 25,
        bearing: 0,
      }),
    );
    await page.waitForFunction(
      () => window.testTerrainMap.areTilesLoaded(),
      null,
      { timeout: 45000 },
    );
    await page
      .locator(".maplibregl-canvas")
      .screenshot({ path: "test-results/lighting/ocean-national.png" });
    assert.ok(
      overviewZooms.length > 0,
      "Gambaran nasional uses the reference ocean imagery",
    );
    assert.ok(
      overviewZooms.every((z) => z <= 8),
      "Overview never requests the old mismatched close-up acquisitions",
    );
    assert.deepEqual(errors, []);
  }
} finally {
  await browser.close();
}

import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
let testingOffline = false;
page.on("pageerror", (e) => errors.push(e.message));
let tileResponses = 0;
let imageryRequests = 0;
page.on("request", (r) => {
  if (r.url().includes("s2cloudless-2024_3857/default/g")) imageryRequests++;
});
page.on("response", (r) => {
  if (r.url().includes("tiles.mapterhorn.com")) {
    tileResponses++;
    if (tileResponses < 4) console.log("TILE", r.status(), r.url());
  }
});
page.on("requestfailed", (r) => {
  if (!testingOffline && r.failure()?.errorText !== "net::ERR_ABORTED")
    console.log("FAILED", r.url(), r.failure()?.errorText);
});
page.on("console", (message) => {
  if (!testingOffline && message.type() === "error")
    console.log("BROWSER", message.text());
});
try {
  await mkdir("test-results", { recursive: true });
  await page.goto(
    process.argv[2] ?? process.env.APP_URL ?? "http://127.0.0.1:5173",
    {
      waitUntil: "domcontentloaded",
    },
  );
  await page
    .locator('.terrain-view[data-ready="true"]')
    .waitFor({ timeout: 45000 });
  await page
    .locator('.terrain-view[data-elevation="loaded"]')
    .waitFor({ timeout: 60000 });
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-surface"),
    "satellite",
  );
  await page
    .locator('.terrain-view[data-imagery="loaded"]')
    .waitFor({ timeout: 60000 });
  assert.ok(
    imageryRequests > 0,
    "Default terrain shows vegetation from satellite imagery",
  );
  await page.locator(".map-canvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-bromo.png" });
  await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await page.waitForTimeout(1200);
  await page
    .locator('.terrain-view[data-elevation="loaded"]')
    .waitFor({ timeout: 60000 });
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-calm-close.png" });
  await page.getByRole("button", { name: /Bromo/ }).click();
  await page.waitForTimeout(1500);
  assert.match(await page.locator(".terrain-caption").innerText(), /Bromo/);
  const observations = await page.locator(".metric-main").first().innerText();
  await page
    .getByRole("button", { name: "Relief berbayang", exact: true })
    .click();
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-surface"),
    "relief",
  );
  await page.waitForTimeout(500);
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-relief.png" });
  await page.getByRole("button", { name: "Satelit", exact: true }).click();
  await page
    .locator('.terrain-view[data-imagery="loaded"]')
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Relief berbayang", exact: true })
    .click();
  assert.equal(
    await page.locator(".metric-main").first().innerText(),
    observations,
  );
  await page.getByLabel("Pengali tinggi relief").selectOption("2.5");
  await page.getByRole("button", { name: "Rinjani", exact: true }).click();
  await page.waitForTimeout(1500);
  await page
    .locator('.terrain-view[data-elevation="loaded"]')
    .waitFor({ timeout: 60000 });
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-rinjani.png" });
  await page
    .getByRole("button", { name: "Warna provinsi", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Warna provinsi", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page
    .getByRole("button", { name: "Tampilkan seluruh Indonesia", exact: true })
    .click();
  await page.waitForTimeout(1500);
  await page
    .locator('.terrain-view[data-elevation="loaded"]')
    .waitFor({ timeout: 60000 });
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-indonesia.png" });
  await page
    .getByLabel("Wilayah pantauan", { exact: true })
    .selectOption("Jawa Timur");
  await page.waitForTimeout(1500);
  assert.match(
    await page.locator(".terrain-caption").innerText(),
    /Jawa Timur/,
  );
  const flames = page.locator(".selected-fire-anchor");
  assert.ok((await flames.count()) > 0 && (await flames.count()) <= 24);
  assert.ok(
    (
      await flames.evaluateAll((elements) =>
        elements.map((e) => e.dataset.province),
      )
    ).every((name) => name === "Jawa Timur"),
  );
  await page.waitForTimeout(2000);
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/selected-fire.png" });
  assert.equal(await flames.first().getAttribute("data-renderer"), "shader");
  const paintedFire = () =>
    page
      .locator(".fire-fluid")
      .first()
      .evaluate((canvas) => {
        const pixels = canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0,
          signature = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 20) visible++;
          signature += pixels[i] * i;
        }
        return { visible, signature };
      });
  assert.ok(
    (await paintedFire()).visible > 200,
    "Shader paints visible fire and smoke",
  );
  const beforeAnimation = await paintedFire();
  await page.waitForTimeout(200);
  assert.notEqual((await paintedFire()).signature, beforeAnimation.signature);
  await page
    .getByRole("button", { name: "Lihat hotspot terpilih", exact: true })
    .click();
  await page.waitForTimeout(1800);
  await page
    .locator('.terrain-view[data-elevation="loaded"]')
    .waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  assert.match(
    await page.locator(".terrain-caption").innerText(),
    /observasi 1/,
  );
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/fire-closeup.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () =>
      document.querySelector(".selected-fire-anchor")?.dataset.motion ===
      "still",
  );
  const still = await paintedFire();
  await page.waitForTimeout(250);
  assert.equal(
    (await paintedFire()).signature,
    still.signature,
    "Reduced motion freezes procedural fire",
  );
  const pitchSignatures = [];
  for (const tilt of [0, 30, 60, 75, 0]) {
    await page.getByLabel("Kemiringan kamera").fill(String(tilt));
    await page.waitForTimeout(600);
    assert.equal(await flames.first().getAttribute("data-pitch"), String(tilt));
    assert.equal(
      await page.locator(".terrain-view").getAttribute("data-elevation"),
      "loaded",
      "Tilting cached terrain does not restart loading",
    );
    const frame = await paintedFire();
    assert.ok(frame.visible > 200, `Fire remains visible at ${tilt} degrees`);
    pitchSignatures.push(frame.signature);
    assert.ok(
      await flames.evaluateAll((nodes) =>
        nodes.every((node) => !/NaN|Infinity/.test(node.style.transform)),
      ),
    );
    await page
      .locator(".map-canvas")
      .screenshot({ path: `test-results/fire-tilt-${tilt}.png` });
  }
  assert.notEqual(
    pitchSignatures[0],
    pitchSignatures[3],
    "Fire perspective changes with tilt",
  );
  assert.equal(
    pitchSignatures[0],
    pitchSignatures[4],
    "Returning to top-down restores the same static projection",
  );

  await page.getByLabel("Kemiringan kamera").fill("60");
  await page.getByRole("button", { name: "Orbit 360", exact: false }).click();
  const mapBox = await page.locator(".maplibregl-canvas").boundingBox();
  const startBearing = Number(
    await page.locator(".terrain-view").getAttribute("data-bearing"),
  );
  for (let turn = 1; turn <= 2; turn++) {
    await page.mouse.move(
      mapBox.x + mapBox.width * 0.2,
      mapBox.y + mapBox.height * 0.42,
    );
    await page.mouse.down();
    await page.mouse.move(
      mapBox.x + mapBox.width * 0.8,
      mapBox.y + mapBox.height * 0.42,
      { steps: 12 },
    );
    await page.mouse.up();
    await page.waitForTimeout(300);
    const expected = (startBearing + mapBox.width * 0.6 * 0.45 * turn) % 360;
    const actual = Number(
      await page.locator(".terrain-view").getAttribute("data-bearing"),
    );
    assert.ok(
      Math.abs(((actual - expected + 540) % 360) - 180) < 2,
      `Orbit wraps continuously: ${actual} vs ${expected}`,
    );
  }
  assert.match(
    await page.locator(".terrain-caption").innerText(),
    /observasi 1/,
    "Orbit drag does not select another province",
  );
  await page.getByRole("button", { name: "Hadap utara", exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-bearing"),
    "0",
  );
  await page.getByRole("button", { name: "Geser", exact: true }).click();
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-orbit"),
    "false",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByLabel("Deteksi hotspot", { exact: true }).uncheck();
  assert.equal(await flames.count(), 0);
  await page.getByLabel("Deteksi hotspot", { exact: true }).check();
  assert.ok((await flames.count()) > 0);
  await page
    .getByRole("button", { name: "Hapus pilihan provinsi", exact: true })
    .click();
  assert.equal(await flames.count(), 0);
  await page
    .getByLabel("Wilayah pantauan", { exact: true })
    .selectOption("Jawa Timur");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Rinjani", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2200);
  await page
    .locator('.terrain-view[data-elevation="loaded"]')
    .waitFor({ timeout: 60000 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-mobile.png" });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  assert.equal(await page.locator(".province").count(), 38);
  // Exercise the fallback used when native fullscreen is belum tersedia.
  await page.locator(".map-canvas").evaluate((e) => {
    e.requestFullscreen = () => Promise.reject(new Error("Unavailable"));
  });
  await page
    .getByRole("button", { name: "Buka peta layar penuh", exact: true })
    .click();
  await page.locator(".map-canvas.is-fullscreen").waitFor();
  await page.keyboard.press("Escape");
  await page
    .locator(".map-canvas.is-fullscreen")
    .waitFor({ state: "detached" });

  assert.equal(await page.locator(".maplibregl-canvas").count(), 0);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page
    .locator('.terrain-view[data-ready="true"]')
    .waitFor({ timeout: 30000 });
  assert.match(
    await page.locator(".terrain-caption").innerText(),
    /Jawa Timur/,
  );
  assert.deepEqual(errors, []);
  await page.getByRole("button", { name: "2D", exact: true }).click();
  testingOffline = true;
  await page.route("**/s2cloudless-2024_3857/default/g/**", (route) =>
    route.abort(),
  );
  await page.route("**/World_Imagery/MapServer/tile/**", (route) =>
    route.abort(),
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  await page.getByRole("button", { name: "Satelit", exact: true }).click();
  await page
    .getByRole("button", { name: "Gunakan relief berbayang", exact: true })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Gunakan relief berbayang", exact: true })
    .click();
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-surface"),
    "relief",
  );
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.route("**/tiles.mapterhorn.com/**", (route) => route.abort());
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page
    .getByRole("button", { name: "Gunakan peta 2D", exact: true })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Gunakan peta 2D", exact: true })
    .click();
  assert.equal(await page.locator(".province").count(), 38);
  assert.deepEqual(errors, []);
  console.log(
    "Satellite texture, surface switching, terrain rendering, viewpoints, relief controls, selection, mobile, and imagery/DEM network fallbacks passed.",
  );
} catch (error) {
  console.log(
    "Motion state",
    await page.evaluate(() => ({
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      markers: [...document.querySelectorAll(".selected-fire-anchor")]
        .slice(0, 2)
        .map((e) => ({ ...e.dataset })),
    })),
  );
  console.log(
    "Terrain status:",
    await page.locator(".terrain-view").getAttribute("data-ready"),
    await page.locator(".terrain-status").allTextContents(),
    errors,
  );
  await page.screenshot({
    path: "test-results/terrain-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}

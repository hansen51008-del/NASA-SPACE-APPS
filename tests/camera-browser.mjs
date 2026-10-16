import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await page.locator('.terrain-view[data-ready="true"]').waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const explore = page.getByRole("button", {
    name: "Explore relief",
    exact: true,
  });
  await explore.click();
  assert.equal(await explore.getAttribute("aria-expanded"), "false");
  assert.equal(
    await page.getByRole("button", { name: "Rinjani", exact: true }).count(),
    0,
  );
  await explore.click();
  await page.getByRole("button", { name: "Rinjani", exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-bearing"),
    "335",
  );
  assert.match(await page.locator(".terrain-caption").innerText(), /Rinjani/);
  await page
    .getByRole("button", { name: "Pegunungan Papua", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-bearing"),
    "20",
  );
  await page.getByLabel("Kemiringan kamera").fill("45");
  await page
    .getByRole("button", { name: "Tutup pengaturan peta", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Satelit", exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  assert.equal(await page.getByLabel("Kemiringan kamera").inputValue(), "45");
  await page
    .getByLabel("Wilayah pantauan", { exact: true })
    .selectOption("Jawa Timur");
  await page.locator(".map-canvas").scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Buka peta layar penuh", exact: true })
    .click();
  await page.locator(".map-canvas.is-fullscreen").waitFor();
  await page.waitForTimeout(300);
  assert.ok(
    await page.locator(".map-canvas").evaluate((e) => {
      const r = e.getBoundingClientRect();
      return (
        Math.abs(r.width - innerWidth) < 2 &&
        Math.abs(r.height - innerHeight) < 2
      );
    }),
  );
  assert.ok(
    await page.evaluate(() =>
      document.fullscreenElement?.classList.contains("map-canvas"),
    ),
    "Native fullscreen entered",
  );
  await page.getByLabel("Kemiringan kamera").fill("60");
  await page.getByRole("button", { name: "Orbit 360", exact: false }).click();
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  const start = Number(
    await page.locator(".terrain-view").getAttribute("data-bearing"),
  );
  for (let turn = 1; turn <= 2; turn++) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.42);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.42, {
      steps: 15,
    });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const expected = (start + box.width * 0.6 * 0.45 * turn) % 360;
    const actual = Number(
      await page.locator(".terrain-view").getAttribute("data-bearing"),
    );
    assert.ok(
      Math.abs(((actual - expected + 540) % 360) - 180) < 2,
      `Continuous orbit ${actual} vs ${expected}`,
    );
    assert.equal(
      await page.getByLabel("Wilayah pantauan", { exact: true }).inputValue(),
      "Jawa Timur",
      "Dragging does not select a province",
    );
  }
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.5,
    box.y + box.height * 0.4 + 80,
    { steps: 10 },
  );
  await page.mouse.up();
  assert.equal(await page.getByLabel("Kemiringan kamera").inputValue(), "40");
  await page.getByRole("button", { name: "Hadap utara", exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-bearing"),
    "0",
  );
  await page.getByRole("button", { name: "Geser", exact: true }).click();
  assert.equal(
    await page.locator(".terrain-view").getAttribute("data-orbit"),
    "false",
  );
  await page
    .getByRole("button", { name: "Keluar dari peta layar penuh", exact: true })
    .click();
  await page
    .locator(".map-canvas.is-fullscreen")
    .waitFor({ state: "detached" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".map-canvas").scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-controls-mobile-open.png" });
  await page
    .getByRole("button", { name: "Tutup pengaturan peta", exact: true })
    .click();
  await page
    .locator(".map-canvas")
    .screenshot({ path: "test-results/terrain-controls-mobile-closed.png" });
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  assert.equal(await page.getByLabel("Kemiringan kamera").inputValue(), "40");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.locator(".map-canvas").evaluate((e) => {
    e.requestFullscreen = () => Promise.reject(new Error("Unavailable"));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Buka peta layar penuh", exact: true })
    .click();
  await page.locator(".map-canvas.is-fullscreen").waitFor();
  assert.equal(await page.locator(".province").count(), 38);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.keyboard.press("Escape");
  await page
    .locator(".map-canvas.is-fullscreen")
    .waitFor({ state: "detached" });
  assert.notEqual(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Explore relief destinations, collapsible settings with preserved camera, mobile panels, native fullscreen, orbit beyond 360 degrees, vertical tilt, north reset, pan mode, mobile 2D fullscreen fallback, Escape and cleanup.",
  );
} finally {
  await browser.close();
}

import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
await mkdir("test-results/quality", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 360, height: 800 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("siagaapi:intro-seen", "1");
    } catch {}
  });
  await page.route(/^https:\/\//, (r) => r.abort());
  await page.goto("http://127.0.0.1:4173");
  await page.locator(".risk-score").waitFor();
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  const risk = await page.locator(".risk-score").innerText();
  const open = async () => {
    await page
      .getByRole("tab", { name: "Peta aktivitas", exact: true })
      .click();
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page
      .getByRole("button", { name: "Sensor & filter", exact: true })
      .click();
  };
  await open();
  const toggle = page.getByRole("button", {
    name: "Kualitas rendah",
    exact: true,
  });
  const highCount = await page.locator(".ember-point").count();
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".fire-beacon").count(), 0);
  assert.ok((await page.locator(".ember-point").count()) <= highCount);
  assert.ok((await toggle.boundingBox()).height >= 44);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "test-results/quality/mobile.png" });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await open();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await page
    .getByRole("button", { name: "Tutup panel filter", exact: true })
    .click();
  assert.equal(await page.locator(".observation-details").count(), 0);
  await page
    .getByRole("button", { name: "Rincian hotspot", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Pilih observasi" })
    .count()
    .catch(() => {});
  assert.equal(await page.locator(".weather-context").count(), 0);
  await page.locator(".observation-picker > button").first().click();
  await page
    .getByRole("region", { name: "Rincian observasi", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Beranda", exact: true }).click();
  assert.equal(await page.locator(".risk-score").innerText(), risk);
  await page.close();
  // Test-only RAF throttling: production has no remote telemetry or test switch.
  const lag = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  lag.setDefaultTimeout(30000);
  await lag.addInitScript(() => {
    try {
      sessionStorage.setItem("siagaapi:intro-seen", "1");
    } catch {}
    const raf = requestAnimationFrame.bind(window),
      cancel = cancelAnimationFrame.bind(window);
    let id = 0;
    const pending = new Map();
    window.requestAnimationFrame = (cb) => {
      const key = ++id;
      const timer = setTimeout(() => {
        const real = raf((t) => {
          pending.delete(key);
          cb(t);
        });
        pending.set(key, { real });
      }, 80);
      pending.set(key, { timer });
      return key;
    };
    window.cancelAnimationFrame = (key) => {
      const job = pending.get(key);
      if (job?.timer) clearTimeout(job.timer);
      if (job?.real) cancel(job.real);
      pending.delete(key);
    };
  });
  await lag.route(/^https:\/\//, (r) => r.abort());
  await lag.goto("http://127.0.0.1:4173");
  await lag.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await lag.getByRole("tab", { name: "Peta aktivitas", exact: true }).click();
  await lag.getByRole("button", { name: "2D", exact: true }).click();
  await lag.locator(".map-period-controls > summary").click();
  await lag
    .getByLabel("Wilayah pemantauan", { exact: true })
    .selectOption("Riau");
  await lag
    .getByText("Perangkat terasa berat. Aktifkan mode kualitas rendah?", {
      exact: true,
    })
    .waitFor();
  assert.notEqual(
    await lag.evaluate(() => localStorage.getItem("siagaapi:quality")),
    "low",
  );
  await lag
    .getByRole("button", { name: "Tidak, terima kasih", exact: true })
    .click();
  await lag.waitForTimeout(4000);
  assert.equal(await lag.locator(".lag-banner").count(), 0);
  assert.equal(
    await lag.evaluate(() => sessionStorage.getItem("siagaapi:lag-dismissed")),
    "1",
  );
  console.log(
    "PASS quality: persistence, reversal, static symbols, unchanged risk, explicit hotspot choice, 360px, sustained lag/dismissal",
  );
  await lag.close();
} finally {
  await browser.close();
}

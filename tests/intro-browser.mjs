import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const url = process.env.APP_URL ?? "http://127.0.0.1:5175";
await mkdir("test-results", { recursive: true });
const errors = [];
try {
  for (const width of [360, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/^https:\/\//, (route) => route.abort());
    // Hold only the cache response: the intro must finish without waiting for data.
    let releaseCache;
    const cacheGate = new Promise((resolve) => {
      releaseCache = resolve;
    });
    let cacheRequested = false;
    await page.route("**/data/firms-cache.json", async (route) => {
      cacheRequested = true;
      await cacheGate;
      await route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator(".app-intro").waitFor();
    await page.clock.runFor(550);
    // Capture the settled entrance; the auto-dismiss timer remains paused.
    await page.locator(".app-intro-brand").evaluate((element) => {
      for (const animation of element.getAnimations()) animation.finish();
    });
    assert.equal(await page.locator(".app-content").getAttribute("inert"), "");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: `test-results/intro-${width}.png` });
    await page.clock.runFor(900);
    await page.locator(".app-intro").waitFor({ state: "detached" });
    assert.equal(cacheRequested, true, "Data loading starts behind the intro");
    releaseCache();
    await page.locator(".risk-score").waitFor();
    assert.equal(
      await page
        .getByRole("tab", { name: "Beranda", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page.reload();
    await page.locator(".risk-score").waitFor();
    assert.equal(
      await page.locator(".app-intro").count(),
      0,
      "Refresh does not repeat the intro in this tab",
    );
    // A new session can dismiss with either a button or the keyboard.
    await page.evaluate(() => sessionStorage.removeItem("siagaapi:intro-seen"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Lanjut ke Beranda" }).waitFor();
    if (width === 360)
      await page.getByRole("button", { name: "Lanjut ke Beranda" }).click();
    else await page.keyboard.press("Escape");
    await page.locator(".app-intro").waitFor({ state: "detached" });
    assert.equal(
      await page.locator(".app-content").getAttribute("inert"),
      null,
    );
    await context.close();
  }
  for (const reducedMotion of ["reduce", "no-preference"]) {
    const context = await browser.newContext({ reducedMotion });
    await context.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new Error("Storage blocked");
        },
      });
    });
    const page = await context.newPage();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.goto(url, { waitUntil: "domcontentloaded" });
    if (reducedMotion === "reduce") {
      await page.locator(".app-content").waitFor();
      assert.equal(await page.locator(".app-intro").count(), 0);
    } else {
      await page.locator(".app-intro").waitFor();
      await page.getByRole("button", { name: "Lanjut ke Beranda" }).click();
    }
    await page.locator(".risk-score").waitFor();
    assert.equal(await page.locator(".app-intro").count(), 0);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: intro auto-dismiss, skip, Escape, once per tab session, parallel data loading, blocked storage, reduced motion, desktop/mobile, no runtime errors.",
  );
} finally {
  await browser.close();
}

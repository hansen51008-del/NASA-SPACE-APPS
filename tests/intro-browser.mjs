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
    assert.equal(await page.locator(".app-intro").textContent(), "SiagaApi");
    assert.equal(
      await page
        .getByRole("heading", { name: "SiagaApi", exact: true })
        .count(),
      1,
    );
    assert.equal(await page.locator(".app-intro button").count(), 0);
    assert.equal(
      await page
        .locator(".app-intro-flame")
        .evaluate((el) => getComputedStyle(el).animationName),
      "intro-flame-rise",
    );
    // Inspect the upward burst while the auto-dismiss timer remains paused.
    await page.locator(".app-intro-brand").evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 700;
      }
    });
    const mark = await page.locator(".app-intro-mark").boundingBox();
    const burst = await page.locator(".app-intro-fire").boundingBox();
    assert.ok(
      burst.height > mark.height * 1.5 &&
        burst.height < mark.height * 2.1 &&
        burst.y < mark.y - 60,
      "Fire rises upward without overwhelming the logo",
    );
    await page.screenshot({ path: `test-results/intro-burst-${width}.png` });
    // Inspect the decay and settled logo.
    await page.locator(".app-intro-brand").evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 1100;
      }
    });
    assert.equal(await page.locator(".app-content").getAttribute("inert"), "");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: `test-results/intro-${width}.png` });
    await page.locator(".app-intro-brand").evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true }))
        animation.currentTime = 1900;
    });
    await page.screenshot({ path: `test-results/intro-settled-${width}.png` });
    await page.clock.runFor(1900);
    await page.locator(".app-intro").waitFor({ state: "detached" });
    assert.equal(cacheRequested, true, "Data loading starts behind the intro");
    releaseCache();
    await page.clock.resume();
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
    // Keyboard dismissal remains available without a visible button.
    await page.evaluate(() => sessionStorage.removeItem("siagaapi:intro-seen"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".app-intro").waitFor();
    await page.keyboard.press("Escape");
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
      await page.clock.runFor(2500);
    }
    await page.clock.resume();
    await page.locator(".risk-score").waitFor();
    assert.equal(await page.locator(".app-intro").count(), 0);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: logo-only intro, flame animation, auto-dismiss, Escape, once per tab session, parallel data loading, blocked storage, reduced motion, desktop/mobile, no runtime errors.",
  );
} finally {
  await browser.close();
}

import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const url = process.env.APP_URL ?? "http://127.0.0.1:5175";
const tab = (name) => page.getByRole("tab", { name, exact: true });
await mkdir("test-results", { recursive: true });
try {
  await page.route(/^https:\/\//, (route) => route.abort());
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await page.locator(".risk-score").waitFor();
    assert.equal(await tab("Beranda").getAttribute("aria-selected"), "true");
    assert.equal(
      await page.locator(".workspace").count(),
      0,
      "Map is lazy mounted",
    );
    assert.equal(await page.locator(".metrics").isVisible(), false);
    assert.equal(
      await page.getByRole("button", { name: "Ekspor CSV" }).count(),
      0,
    );
    await page.locator(".emergency-checklist input").first().check();
    await page.screenshot({
      path: `test-results/tabs-home-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Buka Peta aktivitas", exact: true })
      .click();
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.getByLabel("Wilayah pemantauan").selectOption("Riau");
    await page.getByRole("button", { name: "VIIRS", exact: true }).click();
    assert.equal(await page.locator(".citizen-grid").isVisible(), false);
    assert.equal(await page.locator(".metrics").isVisible(), false);
    await page.screenshot({
      path: `test-results/tabs-map-${width}.png`,
      fullPage: true,
    });
    await tab("Beranda").click();
    // Region changes intentionally reset the checklist; tab switches must not.
    await page.locator(".emergency-checklist input").first().check();
    const score = await page.locator(".risk-score").innerText();
    await page
      .getByRole("button", { name: "Buka Data & analitik", exact: true })
      .click();
    assert.equal(await page.locator(".metrics").isVisible(), true);
    assert.equal(await page.locator(".workspace").isVisible(), false);
    assert.equal(
      await page.getByRole("button", { name: "Ekspor CSV" }).isVisible(),
      true,
    );
    await page.screenshot({
      path: `test-results/tabs-data-${width}.png`,
      fullPage: true,
    });
    for (const name of ["Beranda", "Peta aktivitas", "Data & analitik"]) {
      await tab(name).click();
      assert.equal(await page.getByRole("tabpanel").count(), 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.ok(
        await tab(name).evaluate(
          (el) => el.getBoundingClientRect().height >= 44,
        ),
      );
      assert.equal(page.url(), url + "/", "Tabs do not change the URL");
    }
    await tab("Beranda").click();
    assert.equal(await page.locator(".risk-score").innerText(), score);
    assert.equal(
      await page.locator(".emergency-checklist input").first().isChecked(),
      true,
    );
    await tab("Beranda").press("ArrowRight");
    assert.equal(
      await tab("Peta aktivitas").getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "2D", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "VIIRS", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await tab("Peta aktivitas").press("End");
    assert.equal(
      await tab("Data & analitik").getAttribute("aria-selected"),
      "true",
    );
    await tab("Data & analitik").press("Home");
    assert.equal(await tab("Beranda").getAttribute("aria-selected"), "true");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: three tabs, home-first, CTA, keyboard, shared filters, preserved checklist/map, no URL change, 360px/1440px layout and touch targets.",
  );
} finally {
  await browser.close();
}

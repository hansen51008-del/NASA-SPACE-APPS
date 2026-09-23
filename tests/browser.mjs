import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Activity explorer", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "3D", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.locator(".province").first().waitFor();
  assert.equal(await page.locator(".province").count(), 38);
  const colourToggle = page.getByRole("button", {
    name: "Province colours",
    exact: true,
  });
  const provinceFills = () =>
    page
      .locator(".province")
      .evaluateAll((elements) => elements.map((element) => element.style.fill));
  const activityBeforeColour = await page
    .locator(".metric-main")
    .first()
    .innerText();
  assert.equal(await colourToggle.getAttribute("aria-pressed"), "true");
  assert.ok(new Set(await provinceFills()).size > 1);
  await colourToggle.click();
  assert.equal(await colourToggle.getAttribute("aria-pressed"), "false");
  assert.equal(new Set(await provinceFills()).size, 1);
  assert.equal(
    await page
      .getByRole("button", { name: "3D", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page.getByRole("button", { name: "2D", exact: true }).click();
  assert.equal(await page.locator(".island-depth").count(), 0);
  assert.equal(new Set(await provinceFills()).size, 1);
  await colourToggle.click();
  assert.ok(new Set(await provinceFills()).size > 1);
  await page.getByLabel("Activity intensity", { exact: true }).check();
  assert.equal(await colourToggle.getAttribute("aria-pressed"), "false");
  await colourToggle.click();
  assert.equal(
    await page.getByLabel("Activity intensity", { exact: true }).isChecked(),
    false,
  );
  assert.equal(await colourToggle.getAttribute("aria-pressed"), "true");
  assert.equal(
    await page.locator(".metric-main").first().innerText(),
    activityBeforeColour,
  );
  assert.equal(await page.locator(".province").count(), 38);
  assert.ok((await page.locator(".fire-beacon").count()) > 0);
  assert.ok((await page.locator(".fire-beacon").count()) <= 100);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".fire-flame")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  const search = page.getByRole("combobox", { name: "Search provinces" });
  await search.fill("no-matching-province");
  await search.press("ArrowDown");
  await search.press("Enter");
  assert.match(
    await page.locator(".search-empty").innerText(),
    /No province matches/,
  );
  await search.fill("Kalimantan");
  await page.screenshot({
    path: "test-results/province-search.png",
    fullPage: true,
  });
  await search.fill("Kalimantan Tengah");
  await search.press("Enter");
  assert.equal(
    await page.getByLabel("Area of interest", { exact: true }).inputValue(),
    "Kalimantan Tengah",
  );
  await page.getByRole("button", { name: "Explore Riau", exact: true }).click();
  assert.equal(
    await page.getByLabel("Area of interest", { exact: true }).inputValue(),
    "Riau",
  );
  await page
    .getByRole("button", { name: "Clear province selection", exact: true })
    .click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Show Jan", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Show Dec", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.locator(".chart-point").first().hover();
  assert.match(await page.locator(".trend-tooltip").textContent(), /Jan 2025/);
  const before = await page.locator(".metric-main").first().innerText();
  await page
    .getByLabel("Area of interest", { exact: true })
    .selectOption("Kalimantan Tengah");
  await page.waitForTimeout(150);
  assert.notEqual(
    await page.locator(".metric-main").first().innerText(),
    before,
  );
  await page.getByRole("button", { name: "Select Riau", exact: true }).click();
  assert.equal(
    await page.getByLabel("Area of interest", { exact: true }).inputValue(),
    "Riau",
  );
  await page.getByRole("button", { name: "VIIRS", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "VIIRS", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByLabel("Observation year").selectOption("2023");
  await page.getByRole("button", { name: "Show Sep", exact: true }).click();
  assert.match(await page.locator(".context-title").innerText(), /Sep/);
  await page.getByLabel("High confidence only", { exact: true }).check();
  assert.match(await page.locator(".confidence-ring").innerText(), /100%/);
  await page.getByRole("button", { name: "Play replay" }).click();
  await page.waitForFunction(() => {
    const active = document.querySelector('.month-button[aria-pressed="true"]');
    return active && active.getAttribute("aria-label") !== "Show Sep";
  });
  await page.getByRole("button", { name: "Pause replay" }).click();
  const pausedMonth = await page
    .locator('.month-button[aria-pressed="true"]')
    .getAttribute("aria-label");
  assert.notEqual(pausedMonth, "Show Sep");
  await page.waitForTimeout(200);
  assert.equal(
    await page
      .locator('.month-button[aria-pressed="true"]')
      .getAttribute("aria-label"),
    pausedMonth,
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.match(await page.locator(".context-title").innerText(), /Full year/);
  await page.getByLabel("High confidence only", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Harmonized", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export data" }).click(),
  ]);
  assert.match(
    download.suggestedFilename(),
    /BARA_DEMO_Riau_2023_annual_Harmonized.csv/,
  );
  const exportedCsv = await readFile(await download.path(), "utf8");
  assert.match(exportedCsv, /source_or_sources/);
  assert.match(exportedCsv, /MODIS\|VIIRS|VIIRS\|MODIS/);
  assert.equal(
    exportedCsv.split("\r\n").length - 1,
    Number(
      (await page.locator(".metric-main").first().innerText()).replaceAll(
        ",",
        "",
      ),
    ),
  );
  await page
    .getByRole("button", { name: "Compare years", exact: true })
    .first()
    .click();
  await page.getByLabel("Comparison year").selectOption("2021");
  assert.equal(await page.getByLabel("Comparison year").inputValue(), "2021");
  await page.getByRole("button", { name: "Read full brief" }).click();
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), true);
  assert.match(await page.locator(".full-brief").innerText(), /Riau recorded/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), false);
  await page
    .getByRole("button", { name: "Historical insights", exact: true })
    .first()
    .click();
  assert.equal(await page.locator(".critical-months button").count(), 12);
  await page.getByRole("button", { name: "Explorer", exact: true }).click();
  await page
    .getByLabel("Area of interest", { exact: true })
    .selectOption("Indonesia");
  await page.getByLabel("Observation year").selectOption("2025");
  await page.getByLabel("Activity intensity", { exact: true }).check();
  await page.getByLabel("Hotspot detections", { exact: true }).uncheck();
  assert.equal(await page.locator(".hotspot-symbols").count(), 0);
  await page.screenshot({ path: "test-results/intensity.png", fullPage: true });
  await page.getByLabel("Activity intensity", { exact: true }).uncheck();
  await page.getByLabel("Hotspot detections", { exact: true }).check();
  assert.ok((await page.locator(".fire-beacon").count()) > 0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset map view", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile should not overflow horizontally",
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "About the data and methodology" })
    .click();
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS: province search and empty results, ranked province links, monthly step controls, chart tooltips, 3D/2D, 38 provinces, region selection, layers, year/month filters, confidence, replay, reset, CSV, comparison, briefs, anomalies, display controls, map controls, mobile layout, dialogs, and no runtime errors.",
  );
} finally {
  await browser.close();
}

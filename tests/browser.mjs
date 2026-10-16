import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const go = async (name) => {
  await page.getByRole("tab", { name, exact: true }).click();
  if (name === "Peta aktivitas") {
    for (const selector of [".map-period-controls", ".area-section"]) {
      const panel = page.locator(selector);
      if ((await panel.getAttribute("open")) === null)
        await panel.locator("summary").click();
    }
  }
};
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
try {
  // This suite verifies the retained demo archive, independent of a local FIRMS cache.
  await page.route("**/data/firms-cache.json", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173", {
    waitUntil: "networkidle",
  });
  await go("Peta aktivitas");
  await page.locator(".map-canvas").waitFor();
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
    name: "Warna provinsi",
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
  await page.getByLabel("Intensitas aktivitas", { exact: true }).check();
  assert.equal(await colourToggle.getAttribute("aria-pressed"), "false");
  await colourToggle.click();
  assert.equal(
    await page.getByLabel("Intensitas aktivitas", { exact: true }).isChecked(),
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
  const search = page.getByRole("combobox", { name: "Cari provinsi" });
  await search.fill("no-matching-province");
  await search.press("ArrowDown");
  await search.press("Enter");
  assert.match(
    await page.locator(".search-empty").innerText(),
    /Tidak ada provinsi yang cocok dengan/,
  );
  await search.fill("Kalimantan");
  await page.screenshot({
    path: "test-results/province-search.png",
    fullPage: true,
  });
  await search.fill("Kalimantan Tengah");
  await search.press("Enter");
  assert.equal(
    await page.getByLabel("Wilayah pantauan", { exact: true }).inputValue(),
    "Kalimantan Tengah",
  );
  await go("Data & analitik");
  await page
    .getByRole("button", { name: "Jelajahi Riau", exact: true })
    .click();
  await go("Peta aktivitas");
  assert.equal(
    await page.getByLabel("Wilayah pantauan", { exact: true }).inputValue(),
    "Riau",
  );
  await page
    .getByRole("button", { name: "Hapus pilihan provinsi", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bulan berikutnya", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Tampilkan Jan", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("button", { name: "Bulan sebelumnya", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Tampilkan Des", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Atur ulang", exact: true }).click();
  await go("Data & analitik");
  await page.locator(".chart-point").first().hover();
  assert.match(await page.locator(".trend-tooltip").textContent(), /Jan 2025/);
  const before = await page.locator(".metric-main").first().innerText();
  await go("Peta aktivitas");
  await page
    .getByLabel("Wilayah pantauan", { exact: true })
    .selectOption("Kalimantan Tengah");
  await page.waitForTimeout(150);
  assert.notEqual(
    await page.locator(".metric-main").first().innerText(),
    before,
  );
  await page
    .getByRole("button", { name: "Tutup panel wilayah", exact: true })
    .click();
  await page.getByRole("button", { name: "Pilih Riau", exact: true }).click();
  await page
    .getByRole("button", { name: "Wilayah & periode", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Wilayah pantauan", { exact: true }).inputValue(),
    "Riau",
  );
  await page.getByRole("button", { name: "VIIRS", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "VIIRS", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  if ((await page.locator(".map-period-controls").getAttribute("open")) === null)
    await page.locator(".map-period-controls > summary").click();
  await page.getByLabel("Tahun observasi").selectOption("2023");
  await page
    .getByRole("button", { name: "Tampilkan Sep", exact: true })
    .click();
  assert.match(await page.locator(".context-title").innerText(), /Sep/);
  await page.getByLabel("Hanya keyakinan tinggi", { exact: true }).check();
  assert.match(await page.locator(".confidence-ring").innerText(), /100%/);
  await page.getByRole("button", { name: "Putar arsip demo" }).click();
  await page.waitForFunction(() => {
    const active = document.querySelector('.month-button[aria-pressed="true"]');
    return active && active.getAttribute("aria-label") !== "Tampilkan Sep";
  });
  await page.getByRole("button", { name: "Jeda pemutaran" }).click();
  const pausedMonth = await page
    .locator('.month-button[aria-pressed="true"]')
    .getAttribute("aria-label");
  assert.notEqual(pausedMonth, "Tampilkan Sep");
  await page.waitForTimeout(200);
  assert.equal(
    await page
      .locator('.month-button[aria-pressed="true"]')
      .getAttribute("aria-label"),
    pausedMonth,
  );
  await page.getByRole("button", { name: "Atur ulang", exact: true }).click();
  assert.match(
    await page.locator(".context-title").innerText(),
    /Seluruh tahun/,
  );
  await page.getByLabel("Hanya keyakinan tinggi", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Gabungan", exact: true }).click();
  await go("Data & analitik");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Ekspor CSV" }).click(),
  ]);
  assert.match(
    download.suggestedFilename(),
    /SiagaApi_DEMO_Riau_2023_annual_Harmonized.csv/,
  );
  const exportedCsv = await readFile(await download.path(), "utf8");
  assert.match(exportedCsv, /source_or_sources/);
  assert.match(exportedCsv, /MODIS\|VIIRS|VIIRS\|MODIS/);
  assert.equal(
    exportedCsv.split("\r\n").length - 1,
    Number(
      (await page.locator(".metric-main").first().innerText()).replaceAll(
        ".",
        "",
      ),
    ),
  );
  await page
    .getByRole("button", { name: "Bandingkan tahun", exact: true })
    .first()
    .click();
  await page.getByLabel("Tahun pembanding").selectOption("2021");
  assert.equal(await page.getByLabel("Tahun pembanding").inputValue(), "2021");
  await go("Beranda");
  await page.getByRole("button", { name: /Baca ringkasan/ }).click();
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), true);
  assert.match(await page.locator(".full-brief").innerText(), /Riau mencatat/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), false);
  await go("Data & analitik");
  await page
    .getByRole("button", { name: "Pola historis", exact: true })
    .first()
    .click();
  assert.equal(await page.locator(".critical-months button").count(), 12);
  await go("Peta aktivitas");
  await page
    .getByLabel("Wilayah pantauan", { exact: true })
    .selectOption("Indonesia");
  await page.getByLabel("Tahun observasi").selectOption("2025");
  await page.getByLabel("Intensitas aktivitas", { exact: true }).check();
  await page.getByLabel("Deteksi hotspot", { exact: true }).uncheck();
  assert.equal(await page.locator(".hotspot-symbols").count(), 0);
  await page.screenshot({ path: "test-results/intensity.png", fullPage: true });
  await page.getByLabel("Intensitas aktivitas", { exact: true }).uncheck();
  await page.getByLabel("Deteksi hotspot", { exact: true }).check();
  assert.ok((await page.locator(".fire-beacon").count()) > 0);
  await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await page
    .getByRole("button", { name: "Atur ulang peta", exact: true })
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
  await page.getByRole("button", { name: "Tentang data dan metode" }).click();
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), true);
  await page.getByRole("button", { name: "Tutup dialog" }).click();
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS: province search and empty results, ranked province links, monthly step controls, chart tooltips, 3D/2D, 38 provinces, region selection, layers, year/month filters, confidence, replay, reset, CSV, comparison, briefs, anomalies, display controls, map controls, mobile layout, dialogs, and no runtime errors.",
  );
} finally {
  await browser.close();
}

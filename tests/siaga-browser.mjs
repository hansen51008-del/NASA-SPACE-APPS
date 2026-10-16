import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results", { recursive: true });
// Isolate rendering from external terrain/font services; retain local 2D geography.
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
const url = process.env.APP_URL ?? "http://127.0.0.1:5175";
const header =
  "latitude,longitude,acq_date,acq_time,confidence,instrument,brightness,bright_ti4,satellite\n";
function fixture(count) {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    coverage: { start: "2026-10-12", end: "2026-10-14" },
    products: [
      {
        name: "MODIS_NRT",
        text:
          header +
          Array.from(
            { length: count },
            (_, i) =>
              `-2.3,113.9,2026-10-14,${String(300 + i).padStart(4, "0")},90,MODIS,340,,Terra\n`,
          ).join(""),
      },
      { name: "VIIRS_SNPP_NRT", text: header },
    ],
  };
}
try {
  await page.route("**/data/firms-cache.json", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto(url);
  await page
    .getByText("Mode Demo — data FIRMS belum dikonfigurasi", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  assert.equal(await page.locator(".province").count(), 38);
  await page.getByLabel("Wilayah pemantauan").selectOption("Riau");
  await page.getByLabel("Bulan pemantauan").selectOption("9");
  assert.match(await page.locator(".risk-brief").innerText(), /Riau/);
  const scoreBefore = await page.locator(".risk-score").innerText();
  await page.getByRole("button", { name: "VIIRS", exact: true }).click();
  await page.getByLabel("Hanya keyakinan tinggi", { exact: true }).check();
  assert.equal(
    await page.locator(".risk-score").innerText(),
    scoreBefore,
    "Map display filters must not change risk",
  );
  await page
    .getByRole("button", { name: "Tentang SiagaApi", exact: true })
    .click();
  assert.match(
    await page.locator("dialog").innerText(),
    /bukan produk resmi NASA/,
  );
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "test-results/siaga-demo-desktop.png",
    fullPage: true,
  });
  await page.unroute("**/data/firms-cache.json");
  for (const [count, level] of [
    [0, "Aman"],
    [6, "Waspada"],
    [15, "Siaga"],
  ]) {
    await page.route("**/data/firms-cache.json", (route) =>
      route.fulfill({ json: fixture(count) }),
    );
    await page.reload();
    await page.locator(`.risk-${level.toLowerCase()}`).waitFor();
    assert.match(
      await page.locator(".data-provenance").first().innerText(),
      /MODIS_NRT.*VIIRS_SNPP_NRT/,
    );
    assert.equal(await page.getByLabel("Tahun observasi").inputValue(), "2026");
    assert.equal(await page.getByLabel("Bulan pemantauan").inputValue(), "all");
    assert.equal(
      await page.locator('.citizen-filters option[value="all"]').innerText(),
      "Seluruh cakupan cache",
    );
    assert.equal(
      await page.locator(".citizen-filters option:disabled").count(),
      11,
    );
    assert.equal(
      await page.locator(".replay, .calendar-card, .comparison-card").count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Bandingkan tahun", exact: true })
        .count(),
      0,
    );
    assert.equal(await page.locator(".cache-activity li").count(), 3);
    await page.getByLabel("Bulan pemantauan").selectOption("10");
    assert.equal(await page.getByLabel("Bulan pemantauan").inputValue(), "10");
    await page.getByLabel("Bulan pemantauan").selectOption("all");
    await page
      .getByLabel("Wilayah pemantauan")
      .selectOption("Kalimantan Tengah");
    assert.equal(await page.locator(".risk-score strong").innerText(), level);
    if (level === "Aman")
      assert.match(
        await page.locator(".safe-status-copy").innerText(),
        /tetap pantau arahan resmi/,
      );
    await page.locator(".emergency-checklist input").first().check();
    if (level === "Siaga") {
      await page
        .getByRole("button", { name: "Lihat simulasi rencana bantuan" })
        .click();
      assert.match(
        await page.locator(".emergency-panel").innerText(),
        /Tidak ada laporan atau permintaan bantuan yang dikirim/,
      );
      assert.match(
        await page.locator(".safe-point-demo").innerText(),
        /Kalimantan Tengah/,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "Mobile must not overflow",
      );
      await page.screenshot({
        path: "test-results/siaga-siaga-mobile.png",
        fullPage: true,
      });
      for (const width of [360, 768]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `No overflow at ${width}px`,
        );
        if (width === 360) {
          const positions = await page.evaluate(() =>
            [
              ".risk-status",
              ".risk-brief",
              ".emergency-panel",
              ".workspace",
              ".analytics-heading",
            ].map(
              (selector) =>
                document.querySelector(selector).getBoundingClientRect().top,
            ),
          );
          assert.deepEqual(
            [...positions].sort((a, b) => a - b),
            positions,
            "Citizen content order on mobile",
          );
          assert.ok(
            await page
              .getByLabel("Bulan pemantauan")
              .evaluate((el) => el.getBoundingClientRect().height >= 44),
          );
          await page.screenshot({
            path: "test-results/siaga-refined-mobile-360.png",
            fullPage: true,
          });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1050 });
    }
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.screenshot({
      path: `test-results/siaga-${level.toLowerCase()}-desktop.png`,
      fullPage: true,
    });
    // Even a manually dispatched invalid selection cannot bypass the guard.
    await page.getByLabel("Bulan pemantauan").evaluate((el) => {
      el.value = "9";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.equal(await page.getByLabel("Bulan pemantauan").inputValue(), "all");
    assert.equal(await page.locator(".risk-score strong").innerText(), level);
    await page.unroute("**/data/firms-cache.json");
  }
  if (existsSync("public/data/firms-cache.json")) {
    await page.reload();
    await page.locator(".cache-activity").waitFor();
    assert.match(
      await page.locator(".data-provenance").first().innerText(),
      /Data NASA FIRMS/,
    );
    assert.equal(await page.getByLabel("Bulan pemantauan").inputValue(), "all");
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.screenshot({
      path: "test-results/siaga-local-cache-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 360, height: 800 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "test-results/siaga-local-cache-mobile.png",
      fullPage: true,
    });
    console.log(
      "PASS: existing local FIRMS cache loads without changing its contents; desktop and 360px mobile verified.",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: demo fallback, 38 provinces, region/period filters, stable risk across map filters, About modal, Aman/Waspada/Siaga, cache provenance, missing coverage, checklist, simulated help, desktop/mobile, no runtime errors. FIRMS responses are test fixtures, not a live connection.",
  );
} finally {
  await browser.close();
}

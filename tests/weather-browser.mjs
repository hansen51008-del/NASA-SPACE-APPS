import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const live = process.argv.includes("--live");
const fixture = await readFile(
  new URL("./fixtures/weather.json", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const url = process.env.APP_URL ?? "http://127.0.0.1:4173";
await mkdir("test-results", { recursive: true });
try {
  for (const width of live ? [360] : [1440, 360]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [];
    const requests = [];
    let fail = false;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().startsWith("https://api.open-meteo.com/"))
        requests.push(request.url());
    });
    await page.addInitScript(() =>
      sessionStorage.setItem("siagaapi:intro-seen", "1"),
    );
    await page.route(/^https:\/\//, (route) =>
      route.request().url().startsWith("https://api.open-meteo.com/") && live
        ? route.continue()
        : route.abort(),
    );
    if (!live)
      await page.route("https://api.open-meteo.com/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (fail) return route.fulfill({ status: 429, body: "" });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: fixture,
        });
      });
    await page.goto(url);
    await page.locator(".risk-score").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector("main")?.getAttribute("aria-busy") === "false",
    );
    assert.equal(requests.length, 0, "No weather request on home");
    const originalScore = await page.locator(".risk-score").innerText();
    await page
      .getByRole("tab", { name: "Peta aktivitas", exact: true })
      .click();
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.locator(".ember-point").first().waitFor({ state: "attached" });
    assert.equal(requests.length, 0, "No weather request on map load");
    const opener = page.getByRole("button", {
      name: "Rincian hotspot",
      exact: true,
    });
    assert((await opener.boundingBox()).height >= 44);
    await opener.click();
    await page.locator(".observation-picker > button").first().click();
    if (!live) await page.locator(".weather-loading").waitFor();
    const panel = page.getByRole("region", {
      name: "Rincian observasi",
      exact: true,
    });
    await page
      .locator(".weather-temperature, .weather-error")
      .waitFor({ timeout: 12000 });
    if (await page.locator(".weather-error").count()) {
      throw new Error(
        `Weather failed (${live ? "live CORS" : "fixture"}): ${await page.locator(".weather-error").innerText()}`,
      );
    }
    assert.equal(requests.length, 1);
    const params = new URL(requests[0]).searchParams;
    assert.match(params.get("latitude"), /^-?\d+\.\d{2}$/);
    assert.match(params.get("longitude"), /^-?\d+\.\d{2}$/);
    assert.equal(await page.locator(".weather-rain rect").count(), 14);
    assert.match(
      await page.locator(".weather-rain svg").getAttribute("aria-label"),
      /Hujan harian/,
    );
    assert.match(
      await panel.innerText(),
      /Cuaca tidak masuk ke perhitungan skor/,
    );
    assert.equal(
      await page.locator(".weather-credit").getAttribute("href"),
      "https://open-meteo.com",
    );
    if (!live)
      assert.match(await page.locator(".weather-dry").innerText(), /5 hari/);
    await page.locator(".weather-temperature").scrollIntoViewIfNeeded();
    const bounds = await panel.boundingBox();
    assert(
      bounds.x >= 0 && bounds.x + bounds.width <= width,
      "Panel within viewport",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No horizontal overflow",
    );
    assert(
      await panel.evaluate((el) => el.scrollWidth <= el.clientWidth),
      "No panel overflow",
    );
    await page.screenshot({
      path: `test-results/weather-${live ? "live-" : ""}${width}.png`,
    });
    await page.keyboard.press("Escape");
    assert.equal(await panel.count(), 0);
    assert(
      await opener.evaluate((el) => el === document.activeElement),
      "Focus returns to opener",
    );
    await opener.click();
    await page.locator(".observation-picker > button").first().click();
    await page.locator(".weather-temperature").waitFor();
    assert.equal(requests.length, 1, "Reopening uses cache");
    await page.keyboard.press("Escape");
    if (!live) {
      // A fresh page retains session cache while a fresh module loses its memory cache.
      await page.reload();
      await page
        .getByRole("tab", { name: "Peta aktivitas", exact: true })
        .click();
      await page.getByRole("button", { name: "2D", exact: true }).click();
      await opener.click();
      await page.locator(".observation-picker > button").first().click();
      await page.locator(".weather-temperature").waitFor();
      assert.equal(requests.length, 1, "Reload uses session cache");
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        for (const key of Object.keys(sessionStorage))
          if (key.startsWith("siagaapi:weather:"))
            sessionStorage.removeItem(key);
      });
      fail = true;
      await page.reload();
      await page
        .getByRole("tab", { name: "Peta aktivitas", exact: true })
        .click();
      await page.getByRole("button", { name: "2D", exact: true }).click();
      await opener.click();
      await page.locator(".observation-picker > button").first().click();
      await page
        .getByText("Cuaca tidak tersedia. Data hotspot tetap berlaku.", {
          exact: true,
        })
        .waitFor();
      assert.match(await panel.innerText(), /Deteksi bukan kejadian kebakaran/);
      fail = false;
      await page
        .getByRole("button", { name: "Coba lagi", exact: true })
        .click();
      await page.locator(".weather-temperature").waitFor();
      await page.keyboard.press("Escape");
    }
    if (!live) {
      const point = await page
        .locator(".ember-point")
        .evaluateAll((elements) => {
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const x = rect.x + rect.width / 2,
              y = rect.y + rect.height / 2;
            if (document.elementFromPoint(x, y)?.closest(".ember-point") === el)
              return { x, y };
          }
          return null;
        });
      assert.equal(
        await panel.count(),
        0,
        "Escape closes after retry even if the retry button unmounted",
      );
      assert(point, "A visible hotspot can be selected");
      await page.mouse.click(point.x, point.y);
      await page.locator(".weather-temperature").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "3D", exact: true }).click();
      await page.locator('.terrain-view[data-ready="true"]').waitFor();
      await opener.click();
      await page.locator(".observation-picker > button").first().click();
      await page.locator(".weather-temperature").waitFor();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("tab", { name: "Beranda", exact: true }).click();
    assert.equal(await page.locator(".risk-score").innerText(), originalScore);
    assert.deepEqual(errors, []);
    console.log(
      `${live ? "Live Open-Meteo CORS" : "Weather fixture UI"} ${width}px: PASS (${requests.length} request(s))`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}

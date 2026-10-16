import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
await mkdir("test-results/assistant", { recursive: true });
try {
  for (const width of [360, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 850 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("siagaapi:intro-seen", "1");
      } catch {}
      window.mockRequests = [];
      window.mockStops = 0;
      const original = window.fetch.bind(window);
      window.fetch = async (input, options) => {
        if (String(input) === "/api/chat" && options?.method === "POST") {
          window.mockRequests.push(JSON.parse(options.body));
          if (window.mockError) return new Response("{}", { status: 429 });
          return new Response(
            new ReadableStream({
              start(c) {
                let closed = false;
                const encoder = new TextEncoder();
                c.enqueue(
                  encoder.encode(
                    'data: {"type":"delta","text":"**Observasi** satelit "}\n\n',
                  ),
                );
                const timer = setTimeout(() => {
                  if (closed) return;
                  c.enqueue(
                    encoder.encode(
                      'data: {"type":"delta","text":"bukan konfirmasi kebakaran. <img src=x onerror=alert(1)>"}\n\ndata: {"type":"done"}\n\n',
                    ),
                  );
                  closed = true;
                  c.close();
                }, 1800);
                options.signal.addEventListener("abort", () => {
                  clearTimeout(timer);
                  window.mockStops++;
                  if (!closed) {
                    closed = true;
                    c.close();
                  }
                });
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }
        return original(input, options);
      };
    });
    await page.route("**/api/chat", (r) =>
      r.fulfill({ json: { available: true } }),
    );
    await page.goto(process.env.APP_URL ?? "http://127.0.0.1:4173");
    await page.waitForFunction(
      () =>
        document.querySelector("main")?.getAttribute("aria-busy") === "false",
    );
    await page.getByRole("tab", { name: "Asisten AI", exact: true }).click();
    await page
      .getByText("Mulai dari yang ingin kamu pahami.", { exact: true })
      .waitFor();
    assert.equal(await page.locator(".chat-topics button").count(), 9);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `test-results/assistant/welcome-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Apakah hotspot sama dengan kebakaran?",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Hentikan jawaban", exact: true })
      .waitFor();
    await page.getByText("Observasi", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Hentikan jawaban", exact: true })
      .click();
    await page.getByText("Jawaban dihentikan.", { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.mockStops), 1);
    await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
    await page
      .getByRole("button", { name: "Salin jawaban", exact: true })
      .waitFor();
    await page.waitForTimeout(2100);
    assert.equal(await page.locator(".chat-answer img").count(), 0);
    assert.ok((await page.locator(".chat-answer strong").count()) > 0);
    const payload = await page.evaluate(() => window.mockRequests.at(-1));
    assert.ok(JSON.stringify(payload.context).length < 2048);
    assert.ok(!("records" in payload.context));
    await page.screenshot({
      path: `test-results/assistant/conversation-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Percakapan baru", exact: true })
      .click();
    await page.evaluate(() => (window.mockError = true));
    await page
      .getByRole("textbox", { name: "Pesan untuk Asisten Siaga" })
      .fill("Jelaskan indikator risiko");
    await page
      .getByRole("textbox", { name: "Pesan untuk Asisten Siaga" })
      .press("Enter");
    await page.getByRole("alert").waitFor();
    await page.route("**/api/chat", (r) =>
      r.fulfill({ json: { available: false } }),
    );
    await page.reload();
    await page.getByRole("tab", { name: "Asisten AI", exact: true }).click();
    await page
      .getByText("Asisten AI sedang tidak tersedia.", { exact: true })
      .waitFor();
    assert.ok(
      await page
        .getByRole("textbox", { name: "Pesan untuk Asisten Siaga" })
        .isDisabled(),
    );
    await page
      .getByText("Apakah skor ini prediksi kebakaran?", { exact: true })
      .click();
    await page
      .getByText("Bukan. Skor adalah heuristik prototype", { exact: false })
      .waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS Asisten AI ${width}px: welcome, context, streaming, stop/retry, escaped output, no-key FAQ, no overflow`,
    );
  }
} finally {
  await browser.close();
}

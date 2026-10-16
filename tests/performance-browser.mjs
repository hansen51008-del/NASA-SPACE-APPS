import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
const label = process.argv[2] ?? "before";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("Page error:", e.message);
});
await mkdir("test-results/performance", { recursive: true });
let tileRequests = 0;
try {
  await page.addInitScript((low) => {
    sessionStorage.setItem("siagaapi:intro-seen", "1");
    if (low) localStorage.setItem("siagaapi:quality", "low");
  }, label.includes("low"));
  const tiles = await page.evaluate(() => {
    const image = (size, fill) => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const x = c.getContext("2d");
      x.fillStyle = fill;
      x.fillRect(0, 0, size, size);
      return c.toDataURL().split(",")[1];
    };
    return { dem: image(512, "rgb(128,0,0)"), image: image(256, "#807c70") };
  });
  await page.route(/^https:\/\//, (route) => {
    const dem = route.request().url().includes("tiles.mapterhorn.com");
    if (dem || /World_Imagery|s2cloudless/.test(route.request().url())) {
      tileRequests++;
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(dem ? tiles.dem : tiles.image, "base64"),
      });
    }
    return route.abort();
  });
  await page.route("**/data/firms-cache.json", (r) =>
    r.fulfill({ status: 404, body: "" }),
  );
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:4173");
  await page.locator(".risk-score").waitFor();
  console.log("Home ready");
  await page.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") !== "true",
  );
  const readyStart = Date.now();
  await page.getByRole("tab", { name: "Peta aktivitas", exact: true }).click();
  await page.locator('.terrain-view[data-ready="true"]').waitFor();
  const readyMs = Date.now() - readyStart;
  console.log("Map ready", readyMs);
  await page.evaluate(() => {
    let f = document.querySelector(".terrain-gl");
    f = f[Object.keys(f).find((k) => k.startsWith("__reactFiber"))];
    while (f) {
      let h = f.memoizedState;
      while (h) {
        if (h.memoizedState?.current?.getCenter) {
          window.perfMap = h.memoizedState.current;
          return;
        }
        h = h.next;
      }
      f = f.return;
    }
    throw Error("Map ref unavailable");
  });
  const scenes = [];
  async function sample(name, action) {
    console.log("Sampling", name);
    const beforeMetrics = await cdp.send("Performance.getMetrics");
    await page.evaluate(() => {
      window.framesProbe = [];
      window.tasksProbe = [];
      window.probeActive = true;
      cancelAnimationFrame(window.probeFrame);
      window.probeStarted = performance.now();
      window.tickCount = 0;
      let month = document.querySelector(
        '.month-button[aria-pressed="true"]',
      )?.textContent;
      window.tickObserver = new MutationObserver(() => {
        const next = document.querySelector(
          '.month-button[aria-pressed="true"]',
        )?.textContent;
        if (next !== month) {
          window.tickCount++;
          month = next;
        }
      });
      window.tickObserver.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-pressed"],
      });
      window.taskObserver = new PerformanceObserver((list) =>
        window.tasksProbe.push(...list.getEntries().map((e) => e.duration)),
      );
      try {
        window.taskObserver.observe({ type: "longtask", buffered: false });
      } catch {}
      let last = performance.now();
      const loop = (now) => {
        window.framesProbe.push(now - last);
        last = now;
        if (window.probeActive) window.probeFrame = requestAnimationFrame(loop);
      };
      window.probeFrame = requestAnimationFrame(loop);
    });
    await action();
    await page.waitForTimeout(4000);
    const result = await page.evaluate(() => {
      window.probeActive = false;
      cancelAnimationFrame(window.probeFrame);
      window.taskObserver.disconnect();
      window.tickObserver.disconnect();
      const frames = window.framesProbe
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      const elapsedMs = performance.now() - window.probeStarted;
      return {
        elapsedMs,
        ticks: window.tickCount,
        frames: frames.length,
        medianMs: frames[Math.floor(frames.length / 2)] ?? null,
        p95Ms: frames[Math.floor(frames.length * 0.95)] ?? null,
        fps: (frames.length * 1000) / elapsedMs,
        longFrames:
          frames.filter((n) => n > 1000 / 24).length /
          Math.max(1, frames.length),
        longTasks: window.tasksProbe.length,
        maxLongTaskMs: Math.max(0, ...window.tasksProbe),
        heapMB: performance.memory?.usedJSHeapSize / 1048576 || null,
      };
    });
    const afterMetrics = await cdp.send("Performance.getMetrics");
    const metric = (m) =>
      m.metrics.find((x) => x.name === "ScriptDuration")?.value ?? 0;
    const scriptingMs = (metric(afterMetrics) - metric(beforeMetrics)) * 1000;
    scenes.push({
      name,
      ...result,
      scriptingMs,
      scriptingMsPerTick: result.ticks ? scriptingMs / result.ticks : null,
    });
  }
  await sample("3D pan/zoom", () =>
    page.evaluate(() =>
      window.perfMap.easeTo({
        center: [113, -8.05],
        zoom: 11.9,
        duration: 3500,
      }),
    ),
  );
  await page.locator(".map-period-controls > summary").click();
  await page
    .getByLabel("Wilayah pemantauan", { exact: true })
    .selectOption("Riau");
  await page.waitForTimeout(1600);
  await sample("3D province fire effects", () =>
    page.evaluate(() => window.perfMap.easeTo({ bearing: 40, duration: 3500 })),
  );
  await sample("3D replay", () =>
    page.getByRole("button", { name: "Putar arsip demo", exact: true }).click(),
  );
  await page
    .getByRole("button", { name: "Jeda pemutaran", exact: true })
    .click();
  if (errors.length) {
    await page.reload();
    await page.locator(".risk-score").waitFor();
    await page
      .getByRole("tab", { name: "Peta aktivitas", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await sample("2D pan/zoom", async () => {
    const box = await page.locator(".geography").boundingBox();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, {
      steps: 24,
    });
    await page.mouse.up();
    await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  });
  await page.locator(".map-period-controls").evaluate((el) => (el.open = true));
  await sample("2D replay", async () => {
    await page
      .getByRole("button", { name: "Putar arsip demo", exact: true })
      .click();
  });
  await page
    .getByRole("button", { name: "Jeda pemutaran", exact: true })
    .click();
  const output = {
    label,
    measuredAt: new Date().toISOString(),
    environment: {
      os: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      browser: browser.version(),
      viewport: "1280x800, DPR 1",
      headless: true,
      tiles: "local flat DEM/solid imagery fixtures; no network latency",
      data: "bundled deterministic Mode Demo",
    },
    readyMs,
    tileRequests,
    scenes,
  };
  output.errors = errors;
  await writeFile(
    `test-results/performance/${label}.json`,
    JSON.stringify(output, null, 2),
  );
  console.log(JSON.stringify(output));
} catch (e) {
  await page.screenshot({ path: "test-results/performance/error.png" });
  throw e;
} finally {
  await browser.close();
}

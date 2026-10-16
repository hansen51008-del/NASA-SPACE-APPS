import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const url = process.env.APP_URL ?? "http://127.0.0.1:5175";
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    window.introAudioProbe = { contexts: [], starts: 0 };
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        // Exercise the blocked-autoplay path with a real, suspended audio engine.
        void this.suspend();
        window.introAudioProbe.contexts.push(this);
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => {
          window.introAudioProbe.starts++;
          return start(...args);
        };
        return source;
      }
    };
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator(".app-intro").waitFor();
  assert.equal(await page.evaluate(() => window.introAudioProbe.starts), 0);
  await page.mouse.click(20, 20);
  await page.waitForFunction(() => window.introAudioProbe.starts === 1);
  await page.mouse.click(20, 20);
  assert.equal(
    await page.evaluate(() => window.introAudioProbe.starts),
    1,
    "A second tap does not replay the sound",
  );
  await page.clock.runFor(2500);
  await page.waitForFunction(() =>
    window.introAudioProbe.contexts.every(
      (context) => context.state === "closed",
    ),
  );

  const levels = await page.evaluate(async () => {
    const { scheduleIntroSound } =
      await import("/src/components/introSound.ts");
    const context = new OfflineAudioContext(1, 96000, 48000);
    scheduleIntroSound(context, 0.2);
    const rendered = await context.startRendering();
    const samples = rendered.getChannelData(0);
    const peak = (start, end) =>
      samples
        .slice(start * 48000, end * 48000)
        .reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    return {
      before: peak(0, 0.19),
      sound: peak(0.2, 1.25),
      after: peak(1.3, 2),
    };
  });
  assert.equal(levels.before, 0);
  assert.ok(
    levels.sound > 0.01 && levels.sound < 0.5,
    "The effect is audible and has headroom below clipping",
  );
  assert.equal(levels.after, 0, "No lingering sound after the effect");
  assert.deepEqual(errors, []);
  await page.close();

  const unsupported = await browser.newPage();
  await unsupported.route(/^https:\/\//, (route) => route.abort());
  await unsupported.addInitScript(() => {
    window.AudioContext = undefined;
  });
  await unsupported.goto(url);
  await unsupported.locator(".risk-score").waitFor();
  assert.equal(await unsupported.locator(".app-intro").count(), 0);
  console.log(
    "PASS: audio synthesis, bounded volume, autoplay blocked until interaction, no replay, cleanup after intro, unsupported audio fallback.",
  );
} finally {
  await browser.close();
}

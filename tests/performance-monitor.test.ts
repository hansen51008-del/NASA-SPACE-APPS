import { afterEach, expect, it, vi } from "vitest";
import {
  createPerformanceMonitor,
  deviceHints,
  COOLDOWN_MS,
} from "../src/utils/performanceMonitor";
import { qualityDisplay } from "../src/components/MapQuality";
afterEach(() => vi.useRealTimers());
it("requires sustained measured lag, including on weak devices", () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const monitor = createPerformanceMonitor(true);
  let notified = false;
  for (let i = 0; i < 200; i++) {
    vi.advanceTimersByTime(16);
    notified ||= monitor.sample(Date.now()).notify;
  }
  expect(notified).toBe(false);
  for (let i = 0; i < 10; i++) {
    vi.advanceTimersByTime(60);
    notified ||= monitor.sample(Date.now()).notify;
  }
  expect(notified).toBe(false);
  for (let i = 0; i < 65; i++) {
    vi.advanceTimersByTime(60);
    notified ||= monitor.sample(Date.now()).notify;
  }
  expect(notified).toBe(true);
});
it("uses hysteresis, cooldown and discards hidden frame gaps", () => {
  const monitor = createPerformanceMonitor();
  let time = 0,
    alerts = 0;
  const feed = (duration: number, ms: number) => {
    for (let i = 0; i < duration / ms; i++) {
      time += ms;
      if (monitor.sample(time).notify) alerts++;
    }
  };
  feed(4000, 60);
  expect(alerts).toBe(1);
  feed(2000, 35);
  expect(monitor.sample(time).laggy).toBe(true);
  feed(6000, 16);
  expect(monitor.sample(time).laggy).toBe(false);
  feed(4000, 60);
  expect(alerts).toBe(1);
  monitor.sample(time, false);
  time += COOLDOWN_MS;
  expect(monitor.sample(time).notify).toBe(false);
  feed(4000, 60);
  expect(alerts).toBe(2);
});
it("handles missing hardware APIs and maps quality only to display settings", () => {
  expect(deviceHints()).toBe(false);
  expect(deviceHints({})).toBe(false);
  expect(deviceHints({ connection: { saveData: true } })).toBe(true);
  expect(deviceHints({ hardwareConcurrency: 2 })).toBe(true);
  expect(qualityDisplay("low")).toMatchObject({
    maxDpr: 1,
    fireFps: 12,
    fireCount: 6,
    cell: 0.08,
    detail: false,
  });
  expect(qualityDisplay("high")).toMatchObject({
    fireFps: 24,
    fireCount: 24,
    cell: 0.04,
    detail: true,
  });
});

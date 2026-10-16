export const FRAME_LIMIT_MS = 1000 / 24;
export const WINDOW_MS = 3000;
export const RECOVERY_MS = 2000;
export const COOLDOWN_MS = 30000;
export function createPerformanceMonitor(weakDevice = false) {
  const sustainedMs = weakDevice ? 2500 : WINDOW_MS;
  let frames: { time: number; ms: number }[] = [],
    last: number | null = null,
    started: number | null = null,
    laggy = false,
    recovery: number | null = null,
    lastAlert = -Infinity;
  return {
    sample(time: number, active = true) {
      if (!active) {
        frames = [];
        last = null;
        started = null;
        laggy = false;
        recovery = null;
        return { laggy: false, notify: false, median: 0, longShare: 0 };
      }
      started ??= time;
      if (last !== null && time > last) frames.push({ time, ms: time - last });
      last = time;
      frames = frames.filter((f) => f.time >= time - WINDOW_MS);
      const values = frames.map((f) => f.ms).sort((a, b) => a - b);
      const median = values.length ? values[Math.floor(values.length / 2)] : 0;
      const longShare =
        values.filter((v) => v > FRAME_LIMIT_MS).length /
        Math.max(1, values.length);
      const sustained = frames.length > 1 && time - started >= sustainedMs;
      let notify = false;
      if (sustained && median > FRAME_LIMIT_MS && longShare > 0.6) {
        recovery = null;
        if (!laggy && time - lastAlert >= COOLDOWN_MS) {
          notify = true;
          lastAlert = time;
        }
        laggy = true;
      } else if (median < 1000 / 30 && longShare < 0.3) {
        recovery ??= time;
        if (time - recovery >= RECOVERY_MS) laggy = false;
      } else recovery = null;
      return { laggy, notify, median, longShare };
    },
  };
}
// Optional browser APIs are hints only; never automatically change quality.
export function deviceHints(nav?: {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}) {
  return (
    !!nav &&
    ((nav.hardwareConcurrency ?? 8) <= 2 ||
      (nav.deviceMemory ?? 8) <= 2 ||
      !!nav.connection?.saveData)
  );
}

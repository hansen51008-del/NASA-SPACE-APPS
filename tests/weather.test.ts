import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/weather.json";

let weather: typeof import("../src/services/weatherService");
let storage: Map<string, string>;
let request: ReturnType<typeof vi.fn>;
const prefix = "siagaapi:weather:v1:";
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T07:15:00Z"));
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  request = vi.fn(async () => new Response(JSON.stringify(fixture)));
  vi.stubGlobal("fetch", request);
  weather = await import("../src/services/weatherService");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("weather pure functions", () => {
  it("counts only the trailing days below 1 mm", () => {
    expect(weather.dryStreak([0, 2, 0, 0.9, 0])).toBe(3);
    expect(weather.dryStreak([0, 1])).toBe(0);
    expect(weather.dryStreak([])).toBe(0);
    expect(weather.dryStreak(Array(14).fill(0))).toBe(14);
    expect(weather.dryStreak([0, NaN, 0])).toBe(1);
    expect(weather.dryStreak([0, -1])).toBe(0);
  });
  it("labels compass sectors and normalizes wrapping", () => {
    expect(
      [0, 45, 90, 135, 180, 225, 270, 315].map(weather.windDirectionLabel),
    ).toEqual([
      "Utara",
      "Timur laut",
      "Timur",
      "Tenggara",
      "Selatan",
      "Barat daya",
      "Barat",
      "Barat laut",
    ]);
    expect(weather.windDirectionLabel(22.49)).toBe("Utara");
    expect(weather.windDirectionLabel(22.5)).toBe("Timur laut");
    expect(weather.windDirectionLabel(359)).toBe("Utara");
    expect(weather.windDirectionLabel(360)).toBe("Utara");
    expect(weather.windDirectionLabel(-90)).toBe("Barat");
    expect(weather.windDirectionLabel(NaN)).toBe("Tidak tersedia");
  });
});

describe("weather response validation", () => {
  it("accepts the fixture and strips unrelated fields", () => {
    const data = weather.validateWeatherResponse({
      ...fixture,
      extra: "ignored",
    });
    expect(data.daily.time).toHaveLength(15);
    expect(data.current.temperature_2m).toBe(31.2);
    expect(data).not.toHaveProperty("extra");
  });
  it.each([
    null,
    { ...fixture, current: { ...fixture.current, temperature_2m: null } },
    { ...fixture, current: { ...fixture.current, temperature_2m: Infinity } },
    { ...fixture, current: { ...fixture.current, relative_humidity_2m: 101 } },
    { ...fixture, current: { ...fixture.current, time: "2026-10-16T29:00" } },
    { ...fixture, timezone: "not/a/timezone" },
    { ...fixture, daily: { ...fixture.daily, precipitation_sum: [0] } },
    { ...fixture, daily: { ...fixture.daily, precipitation_sum: Array(15) } },
    {
      ...fixture,
      daily: { ...fixture.daily, temperature_2m_min: Array(15).fill(40) },
    },
    {
      ...fixture,
      daily: { ...fixture.daily, time: Array(15).fill("2026-10-16") },
    },
    {
      ...fixture,
      daily: { ...fixture.daily, precipitation_sum: Array(15).fill(-1) },
    },
    {
      ...fixture,
      current_units: { ...fixture.current_units, temperature_2m: "°F" },
    },
  ])("rejects malformed data %#", (data) => {
    expect(() => weather.validateWeatherResponse(data)).toThrow(
      weather.WeatherError,
    );
  });
});

describe("weather request, privacy and cache", () => {
  it("makes no request on import; rounds public coordinates and sends required parameters", async () => {
    expect(request).not.toHaveBeenCalled();
    await weather.fetchWeather(-6.123456, 106.987654);
    const [url, options] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      latitude: "-6.12",
      longitude: "106.99",
      past_days: "14",
      forecast_days: "1",
      timezone: "auto",
      current:
        "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    });
    expect(options.credentials).toBe("omit");
    expect(options.referrerPolicy).toBe("no-referrer");
    expect(storage.has(prefix + "-6.12,106.99")).toBe(true);
    expect([...storage.keys()].join()).not.toContain("123456");
  });
  it("rounds user locations to one decimal before network and storage", async () => {
    await weather.fetchWeather(-6.123456, 106.987654, undefined, "user");
    const params = new URL(request.mock.calls[0][0] as unknown as string)
      .searchParams;
    expect(params.get("latitude")).toBe("-6.1");
    expect(params.get("longitude")).toBe("107.0");
    expect(storage.has(prefix + "-6.1,107.0")).toBe(true);
  });
  it("reuses rounded-coordinate memory cache and prevents callers mutating cached results", async () => {
    const first = await weather.fetchWeather(-6.121, 106.991);
    first.current.temperature_2m = 100;
    storage.clear();
    const second = await weather.fetchWeather(-6.124, 106.994);
    expect(second.current.temperature_2m).toBe(31.2);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("reuses session cache after module reload, then expires at 30 minutes", async () => {
    await weather.fetchWeather(-6, 107);
    vi.resetModules();
    const reloaded = await import("../src/services/weatherService");
    vi.advanceTimersByTime(29 * 60_000);
    await reloaded.fetchWeather(-6, 107);
    expect(request).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    await reloaded.fetchWeather(-6, 107);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("ignores corrupt and invalid session cache", async () => {
    storage.set(prefix + "-6.00,107.00", "{broken");
    await weather.fetchWeather(-6, 107);
    storage.set(
      prefix + "-7.00,107.00",
      JSON.stringify({ savedAt: Date.now(), data: {} }),
    );
    await weather.fetchWeather(-7, 107);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("works with memory cache when storage is unavailable", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
      removeItem() {
        throw Error();
      },
    });
    await weather.fetchWeather(-6, 107);
    await weather.fetchWeather(-6, 107);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not cache invalid responses, HTTP failures or network errors", async () => {
    request.mockResolvedValueOnce(new Response("{}"));
    await expect(weather.fetchWeather(-6, 107)).rejects.toMatchObject({
      code: "invalid",
    });
    request.mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(weather.fetchWeather(-6, 107)).rejects.toMatchObject({
      code: "rate-limit",
    });
    request.mockRejectedValueOnce(new TypeError("offline"));
    await expect(weather.fetchWeather(-6, 107)).rejects.toMatchObject({
      code: "network",
    });
    expect(storage.size).toBe(0);
    await weather.fetchWeather(-6, 107);
    expect(request).toHaveBeenCalledTimes(4);
  });
  it("aborts and rejects at 8 seconds even when fetch never settles", async () => {
    request.mockImplementationOnce(() => new Promise(() => {}));
    const result = weather.fetchWeather(-6, 107);
    const rejected = expect(result).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(7999);
    const options = request.mock.calls[0][1] as unknown as RequestInit;
    expect(options.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(options.signal?.aborted).toBe(true);
    expect(storage.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("propagates caller cancellation and never caches a late response", async () => {
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = weather.fetchWeather(-6, 107, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    controller.abort();
    await rejected;
    finish(new Response(JSON.stringify(fixture)));
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await expect(
      weather.fetchWeather(-6, 107, controller.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid coordinates before any request", async () => {
    await expect(weather.fetchWeather(NaN, 107)).rejects.toMatchObject({
      code: "coordinates",
    });
    await expect(weather.fetchWeather(-91, 107)).rejects.toMatchObject({
      code: "coordinates",
    });
    expect(request).not.toHaveBeenCalled();
  });
});

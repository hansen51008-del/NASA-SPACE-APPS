export type WeatherLocation = "hotspot" | "user";
export interface WeatherData {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}
export class WeatherError extends Error {
  constructor(
    public readonly code:
      | "invalid"
      | "coordinates"
      | "timeout"
      | "aborted"
      | "network"
      | "rate-limit"
      | "http",
  ) {
    super(
      {
        invalid: "Respons cuaca tidak valid.",
        coordinates: "Koordinat tidak valid.",
        timeout: "Batas waktu 8 detik terlampaui.",
        aborted: "Permintaan dibatalkan.",
        network: "Koneksi cuaca gagal atau dibatasi browser.",
        "rate-limit": "Layanan cuaca sedang membatasi permintaan.",
        http: "Layanan cuaca sedang tidak tersedia.",
      }[code],
    );
    this.name = "WeatherError";
  }
}
const TTL = 30 * 60 * 1000;
const PREFIX = "siagaapi:weather:v1:";
interface Cached {
  savedAt: number;
  data: WeatherData;
}
const memory = new Map<string, Cached>();
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WeatherError("invalid");
  return value as Record<string, unknown>;
};
const finite = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new WeatherError("invalid");
  return value;
};
function date(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new WeatherError("invalid");
  return value;
}
export function validateWeatherResponse(value: unknown): WeatherData {
  const root = object(value),
    current = object(root.current),
    daily = object(root.daily);
  if (typeof root.timezone !== "string" || !root.timezone)
    throw new WeatherError("invalid");
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: root.timezone });
  } catch {
    throw new WeatherError("invalid");
  }
  if (
    typeof current.time !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(
      current.time,
    )
  )
    throw new WeatherError("invalid");
  const today = date(current.time.slice(0, 10));
  if (!Array.isArray(daily.time) || daily.time.length !== 15)
    throw new WeatherError("invalid");
  const days = Array.from(daily.time, date);
  if (
    days[14] !== today ||
    days.some(
      (day, i) =>
        i > 0 && Date.parse(day) - Date.parse(days[i - 1]) !== 86400000,
    )
  )
    throw new WeatherError("invalid");
  function numbers(field: string) {
    const values = daily[field];
    if (!Array.isArray(values) || values.length !== days.length)
      throw new WeatherError("invalid");
    return Array.from(values, finite);
  }
  const result: WeatherData = {
    timezone: root.timezone,
    current: {
      time: current.time,
      temperature_2m: finite(current.temperature_2m),
      relative_humidity_2m: finite(current.relative_humidity_2m),
      precipitation: finite(current.precipitation),
      wind_speed_10m: finite(current.wind_speed_10m),
      wind_direction_10m: finite(current.wind_direction_10m),
    },
    daily: {
      time: days,
      temperature_2m_max: numbers("temperature_2m_max"),
      temperature_2m_min: numbers("temperature_2m_min"),
      precipitation_sum: numbers("precipitation_sum"),
    },
  };
  const c = result.current,
    d = result.daily;
  if (
    c.relative_humidity_2m < 0 ||
    c.relative_humidity_2m > 100 ||
    c.precipitation < 0 ||
    c.wind_speed_10m < 0 ||
    c.wind_direction_10m < 0 ||
    c.wind_direction_10m > 360 ||
    d.precipitation_sum.some((n) => n < 0) ||
    d.temperature_2m_min.some((n, i) => n > d.temperature_2m_max[i])
  )
    throw new WeatherError("invalid");
  // Reject unexpected units; the API request explicitly fixes Celsius, km/h, mm.
  if (root.current_units !== undefined) {
    const u = object(root.current_units);
    if (
      u.temperature_2m !== "°C" ||
      u.relative_humidity_2m !== "%" ||
      u.precipitation !== "mm" ||
      u.wind_speed_10m !== "km/h" ||
      u.wind_direction_10m !== "°"
    )
      throw new WeatherError("invalid");
  }
  if (root.daily_units !== undefined) {
    const u = object(root.daily_units);
    if (
      u.temperature_2m_max !== "°C" ||
      u.temperature_2m_min !== "°C" ||
      u.precipitation_sum !== "mm"
    )
      throw new WeatherError("invalid");
  }
  return result;
}

/** Chronological daily values. Missing/invalid rainfall breaks the known streak. */
export function dryStreak(dailyPrecip: readonly number[]): number {
  let count = 0;
  for (let i = dailyPrecip.length - 1; i >= 0; i--) {
    const rain = dailyPrecip[i];
    if (!Number.isFinite(rain) || rain < 0 || rain >= 1) break;
    count++;
  }
  return count;
}
export function windDirectionLabel(deg: number): string {
  if (!Number.isFinite(deg)) return "Tidak tersedia";
  return [
    "Utara",
    "Timur laut",
    "Timur",
    "Tenggara",
    "Selatan",
    "Barat daya",
    "Barat",
    "Barat laut",
  ][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function readCache(key: string): WeatherData | null {
  let entry: unknown = memory.get(key);
  try {
    entry ??= JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    /* Memory remains usable without storage. */
  }
  try {
    const candidate = object(entry),
      age = Date.now() - finite(candidate.savedAt);
    if (age < 0 || age >= TTL) throw new WeatherError("invalid");
    const data = validateWeatherResponse(candidate.data);
    memory.set(key, { savedAt: candidate.savedAt as number, data });
    return structuredClone(data);
  } catch {
    memory.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Storage is optional. */
    }
    return null;
  }
}
function saveCache(key: string, data: WeatherData) {
  const entry = { savedAt: Date.now(), data };
  if (memory.size >= 128) memory.delete(memory.keys().next().value!);
  memory.set(key, entry);
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* Quota/private mode: retain the memory cache. */
  }
}

export async function fetchWeather(
  lat: number,
  lon: number,
  signal?: AbortSignal,
  location: WeatherLocation = "hotspot",
): Promise<WeatherData> {
  if (signal?.aborted) throw new WeatherError("aborted");
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    throw new WeatherError("coordinates");
  const decimals = location === "user" ? 1 : 2;
  const latitude = lat.toFixed(decimals),
    longitude = lon.toFixed(decimals);
  const key = `${PREFIX}${latitude},${longitude}`;
  const cached = readCache(key);
  if (cached) return cached;
  const params = new URLSearchParams({
    latitude,
    longitude,
    current:
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    past_days: "14",
    forecast_days: "1",
    timezone: "auto",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 8000);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () =>
      reject(new WeatherError(timedOut ? "timeout" : "aborted"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try {
    const request = (async () => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`,
        {
          signal: controller.signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
        },
      );
      if (!response.ok)
        throw new WeatherError(response.status === 429 ? "rate-limit" : "http");
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new WeatherError("invalid");
      }
      const data = validateWeatherResponse(json);
      if (controller.signal.aborted)
        throw new WeatherError(timedOut ? "timeout" : "aborted");
      saveCache(key, data);
      return structuredClone(data);
    })();
    return await Promise.race([request, aborted]);
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    throw new WeatherError("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

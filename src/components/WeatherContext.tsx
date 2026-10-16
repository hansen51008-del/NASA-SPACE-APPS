import { useEffect, useId, useState } from "react";
import { CloudSun } from "lucide-react";
import {
  dryStreak,
  fetchWeather,
  WeatherError,
  windDirectionLabel,
} from "../services/weatherService";
import type { WeatherData, WeatherLocation } from "../services/weatherService";
import "./WeatherContext.css";

const number = (n: number) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
type State =
  | { key: string; status: "loading" }
  | { key: string; status: "ready"; data: WeatherData }
  | { key: string; status: "error"; message: string };

export default function WeatherContext({
  latitude,
  longitude,
  location = "hotspot",
}: {
  latitude: number;
  longitude: number;
  location?: WeatherLocation;
}) {
  const id = useId();
  const key = `${latitude},${longitude},${location}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ key, status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, status: "loading" });
    void fetchWeather(latitude, longitude, controller.signal, location).then(
      (data) => {
        if (!controller.signal.aborted)
          setState({ key, status: "ready", data });
      },
      (error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            status: "error",
            message:
              error instanceof WeatherError
                ? error.message
                : "Koneksi cuaca gagal.",
          });
      },
    );
    return () => controller.abort();
  }, [key, latitude, longitude, location, attempt]);
  const active = state.key === key ? state : { status: "loading" as const };
  const data = active.status === "ready" ? active.data : null;
  const rain = data?.daily.precipitation_sum.slice(0, 14) ?? [];
  const maximum = Math.max(1, ...rain);
  const rainSummary = data
    ? data.daily.time
        .slice(0, 14)
        .map((date, i) => `${date}: ${number(rain[i])} mm`)
        .join("; ")
    : "";
  return (
    <section
      className="weather-context"
      aria-labelledby={`${id}-title`}
      aria-busy={active.status === "loading"}
    >
      <h4 id={`${id}-title`}>
        <CloudSun size={18} aria-hidden="true" /> Konteks cuaca
      </h4>
      <p className="weather-model">
        Cuaca model (bukan pengukuran stasiun), ± puluhan km
      </p>
      {active.status === "loading" && (
        <div className="weather-loading" role="status">
          <span>Memuat cuaca…</span>
          <div aria-hidden="true" className="weather-skeleton">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
      {active.status === "error" && (
        <div role="status" className="weather-error">
          <p>Cuaca tidak tersedia. Data hotspot tetap berlaku.</p>
          <small>{active.message}</small>
          <button onClick={() => setAttempt((n) => n + 1)}>Coba lagi</button>
        </div>
      )}
      {data && (
        <>
          <div className="weather-temperature">
            <strong>{number(data.current.temperature_2m)} °C</strong>
            <span>Suhu sekarang (model)</span>
          </div>
          <p>
            Waktu model: {data.current.time.replace("T", " ")} · {data.timezone}
          </p>
          <p className="weather-temporal">
            Konteks saat ini, bukan cuaca pada waktu observasi hotspot.
          </p>
          <dl className="weather-values">
            <div>
              <dt>Maks / min hari ini</dt>
              <dd>
                {number(data.daily.temperature_2m_max[14])} /{" "}
                {number(data.daily.temperature_2m_min[14])} °C
              </dd>
            </div>
            <div>
              <dt>Kelembapan</dt>
              <dd>{number(data.current.relative_humidity_2m)}%</dd>
            </div>
            <div>
              <dt>
                Angin dari {windDirectionLabel(data.current.wind_direction_10m)}
              </dt>
              <dd>{number(data.current.wind_speed_10m)} km/jam</dd>
            </div>
            <div>
              <dt>Hujan hari ini (model)</dt>
              <dd>{number(data.daily.precipitation_sum[14])} mm</dd>
            </div>
          </dl>
          <p>
            Angka harian mencakup hari ini secara penuh, termasuk jam yang belum
            berlalu.
          </p>
          <figure className="weather-rain">
            <figcaption>Hujan 14 hari terakhir yang sudah selesai</figcaption>
            <svg
              viewBox="0 0 280 100"
              role="img"
              aria-label={`Hujan harian dalam mm. ${rainSummary}`}
            >
              <line
                x1="0"
                y1="82"
                x2="280"
                y2="82"
                stroke="currentColor"
                opacity=".3"
              />
              {rain.map((amount, i) => (
                <rect
                  key={data.daily.time[i]}
                  x={i * 20 + 3}
                  y={82 - (amount / maximum) * 64}
                  width="13"
                  height={(amount / maximum) * 64}
                  rx="2"
                >
                  <title>
                    {data.daily.time[i]}: {number(amount)} mm
                  </title>
                </rect>
              ))}
              <text x="2" y="12">
                {number(maximum)} mm
              </text>
              <text x="2" y="98">
                {data.daily.time[0].slice(5)}
              </text>
              <text x="278" y="98" textAnchor="end">
                {data.daily.time[13].slice(5)}
              </text>
            </svg>
            <p>
              Total {number(rain.reduce((sum, n) => sum + n, 0))} mm; tertinggi{" "}
              {number(Math.max(...rain))} mm/hari.
            </p>
          </figure>
          <span className="weather-dry">
            {dryStreak(rain)} hari tanpa hujan berturut-turut
          </span>
          <p>
            Ambang &lt; 1 mm/hari, dihitung mundur sampai kemarin; paling banyak
            14 hari yang tersedia.
          </p>
        </>
      )}
      <p className="weather-interpretation">
        Kondisi kering dan berangin umumnya meningkatkan kerentanan. Ini
        konteks, bukan prediksi.
      </p>
      <p>Cuaca tidak masuk ke perhitungan skor.</p>
      <details className="weather-privacy">
        <summary>Privasi & sumber cuaca</summary>
        <p>
          Koordinat {location === "user" ? "lokasi pengguna" : "hotspot publik"}{" "}
          dibulatkan ke {location === "user" ? "1" : "2"} desimal sebelum
          dikirim ke Open-Meteo. Hasil disimpan sementara di memori dan sesi
          browser selama 30 menit. Open-Meteo menerima koordinat yang dibulatkan
          dan alamat IP koneksi.
        </p>
        <p>
          Data berlisensi CC BY 4.0; API gratis untuk penggunaan non-komersial.
        </p>
      </details>
      <a
        className="weather-credit"
        href="https://open-meteo.com"
        target="_blank"
        rel="noreferrer"
      >
        Weather data by Open-Meteo.com
      </a>
    </section>
  );
}

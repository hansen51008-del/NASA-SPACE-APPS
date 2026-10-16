import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw, Satellite } from "lucide-react";
import { loadNews } from "../services/newsService";
import type { NewsCache } from "../services/newsService";
import type { ObservationDataset } from "../services/observationProvider";
import { observationUpdates } from "../services/observationUpdates";
import "./NewsFeed.css";

const date = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; cache: NewsCache };
export default function NewsFeed({
  dataset,
  provinces,
  year,
  month,
  initialRegion,
}: {
  dataset: ObservationDataset;
  provinces: readonly string[];
  year: number;
  month: number | null;
  initialRegion: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [region, setRegion] = useState(initialRegion);
  const [kind, setKind] = useState<"all" | "news" | "observations">("all");
  const [limit, setLimit] = useState(12);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    setState({ status: "loading" });
    let active = true;
    void loadNews(provinces, controller.signal)
      .then((cache) => {
        if (active) setState({ status: "ready", cache });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [provinces, attempt]);
  const updates = useMemo(
    () => observationUpdates(dataset, [region], year, month),
    [dataset, region, year, month, now],
  );
  const cache = state.status === "ready" ? state.cache : null;
  const items =
    cache?.items.filter(
      (item) => region === "Indonesia" || item.provinces.includes(region),
    ) ?? [];
  const stale = cache && now - Date.parse(cache.fetchedAt) > 7 * 86400000;
  return (
    <div className="news-feed">
      <div className="news-filters">
        <div className="news-kinds" role="group" aria-label="Jenis informasi">
          {(
            [
              ["all", "Semua"],
              ["news", "Berita"],
              ["observations", "Pembaruan observasi"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Wilayah informasi
          <select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              setLimit(12);
            }}
          >
            <option value="Indonesia">Seluruh Indonesia</option>
            {provinces.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="news-caption">
        Berita ditautkan ke penerbit asal. Ringkasan satelit ditandai terpisah.
      </p>
      <div className={`news-columns ${kind !== "all" ? "news-single" : ""}`}>
        {kind !== "observations" && (
          <section
            className="news-headlines"
            aria-labelledby="news-headlines-title"
          >
            <h2 id="news-headlines-title">
              <Newspaper size={19} /> Berita
            </h2>
            {state.status === "loading" && (
              <div className="news-loading" role="status">
                Memuat berita…
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </div>
            )}
            {state.status === "error" && (
              <div className="news-empty" role="status">
                <h3>Berita belum tersedia</h3>
                <p>
                  Cache berita belum tersedia atau gagal dimuat. Ringkasan
                  observasi tetap dapat dibaca.
                </p>
                <button
                  className="outline-button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <RefreshCw size={16} /> Coba lagi
                </button>
              </div>
            )}
            {cache && (
              <>
                <p className="news-caption">
                  Disinkronkan{" "}
                  <time dateTime={cache.fetchedAt}>
                    {date(cache.fetchedAt)}
                  </time>
                  . Bukan pembaruan langsung.
                </p>
                {stale && (
                  <p className="news-status">
                    Cache berita lebih dari 7 hari; periksa tanggal artikel dan
                    sumber asal.
                  </p>
                )}
                {cache.sources.some((s) => s.status === "failed") && (
                  <p className="news-status">
                    Sebagian sumber gagal diperbarui. Daftar ini mungkin belum
                    lengkap.
                  </p>
                )}
                {!items.length && (
                  <div className="news-empty">
                    <h3>
                      {region === "Indonesia"
                        ? "Belum ada berita yang sesuai"
                        : `Belum ada berita bertag ${region}`}
                    </h3>
                    <p>
                      Feed yang tersedia belum memuat judul atau ringkasan yang
                      cocok. Ini tidak berarti tidak ada kejadian.
                    </p>
                  </div>
                )}
                <div className="news-list">
                  {items.slice(0, limit).map((item) => (
                    <article className="news-item" key={item.url}>
                      <div className="news-byline">
                        <span>BERITA · {item.source}</span>
                        <time dateTime={item.publishedAt}>
                          {date(item.publishedAt)}
                        </time>
                      </div>
                      <h3>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.title}
                          <ExternalLink size={15} aria-hidden="true" />
                        </a>
                      </h3>
                      {item.summary && <p>{item.summary}</p>}
                      {!!item.provinces.length && (
                        <p className="news-tags">
                          {item.provinces.join(" · ")}
                        </p>
                      )}
                      <a
                        className="news-read"
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Baca di sumber asal: ${item.title}`}
                      >
                        Baca di sumber asal{" "}
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </article>
                  ))}
                </div>
                {items.length > limit && (
                  <button
                    className="outline-button"
                    onClick={() => setLimit((value) => value + 12)}
                  >
                    Tampilkan berita lainnya
                  </button>
                )}
                <details className="news-sources">
                  <summary>Sumber & batas berita</summary>
                  <p>
                    Hanya judul dan ringkasan pendek dari RSS/Atom. Tidak
                    menyalin artikel penuh atau gambar. Tag wilayah berdasarkan
                    nama provinsi pada judul/ringkasan; tag bukan verifikasi
                    lokasi kejadian.
                  </p>
                  <ul>
                    {cache.sources.map((source) => (
                      <li key={source.id}>
                        <span>{source.name}</span>
                        <span>
                          {
                            {
                              success: "Berhasil",
                              failed: "Gagal diperbarui",
                              unverified: "Belum terverifikasi · nonaktif",
                              disabled: "Nonaktif",
                            }[source.status]
                          }
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p>
                    Pembaruan berita dilakukan saat sinkronisasi server. Memuat
                    ulang halaman hanya membaca cache yang tersedia.
                  </p>
                </details>
              </>
            )}
          </section>
        )}
        {kind !== "news" && (
          <section
            className="news-observations"
            aria-labelledby="news-observations-title"
          >
            <h2 id="news-observations-title">
              <Satellite size={19} /> Pembaruan observasi
            </h2>
            <p className="news-caption">
              Ringkasan otomatis dari observasi satelit. Bukan berita dan bukan
              konfirmasi kebakaran.
            </p>
            {updates.map((update) => (
              <article className="news-observation" key={update.region}>
                <span className="subtle-tag">
                  {update.isDemo
                    ? "Mode Demo · observasi sintetis"
                    : "Cache NASA FIRMS"}
                </span>
                <h3>{update.title}</h3>
                <p className="news-period">{update.period}</p>
                <p
                  className={`news-risk news-risk-${update.level?.toLowerCase() ?? "unknown"}`}
                >
                  Indikator risiko:{" "}
                  <strong>{update.level ?? "Belum dapat dinilai"}</strong>
                </p>
                <p>{update.note}</p>
                {update.isDemo && (
                  <p>Simulasi; tidak menggambarkan kondisi saat ini.</p>
                )}
              </article>
            ))}
            <p className="news-caption">
              Mengikuti periode pilihan aplikasi. Pilih provinsi untuk membaca
              ringkasan wilayah. Skor bukan prediksi atau peringatan resmi.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

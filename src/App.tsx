import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Flame,
  Globe2,
  Grid2X2,
  Map,
  MapPin,
  Radio,
  Satellite,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Layer, Provinces } from "./types";
import { MONTHS, YEARS, number } from "./types";
import { loadObservations } from "./services/observationProvider";
import type { ObservationDataset } from "./services/observationProvider";
import { calculateRisk, riskBrief } from "./services/riskService";
import RiskStatusCard from "./components/RiskStatusCard";
import RiskBrief from "./components/RiskBrief";
import EmergencyActionPanel from "./components/EmergencyActionPanel";
import {
  harmonize,
  largestCell,
  layerRecords,
} from "./services/harmonizationService";
import {
  analyze,
  monthlyCounts,
  regionRanking,
} from "./services/anomalyService";
import IndonesiaMap from "./components/IndonesiaMap";
import RegionPanel from "./components/RegionPanel";
import YearSelector from "./components/YearSelector";
import FireReplay from "./components/FireReplay";
import HotspotTrend from "./components/HotspotTrend";
import ActivityCalendar from "./components/ActivityCalendar";
import YearComparison from "./components/YearComparison";
import { buildBrief } from "./components/FireBrief";
import CacheActivity from "./components/CacheActivity";
import { coveredMonth, inPeriod } from "./services/coveragePeriod";
import ProvinceSearch from "./components/ProvinceSearch";
import RegionLeaders from "./components/RegionLeaders";
type View = "explorer" | "history" | "compare";
export default function App() {
  const [data, setData] = useState<
    | ({
        boundaries: Provinces;
      } & ObservationDataset)
    | null
  >(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState(2025),
    [month, setMonth] = useState<number | null>(null);
  const [region, setRegion] = useState("Indonesia"),
    [layer, setLayer] = useState<Layer>("Harmonized");
  const [markers, setMarkers] = useState(true),
    [borders, setBorders] = useState(true),
    [density, setDensity] = useState(false),
    [highOnly, setHighOnly] = useState(false);
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View>("explorer"),
    [comparisonYear, setComparisonYear] = useState(2024);
  const [modal, setModal] = useState<"method" | "brief" | "about" | null>(null);
  const [exported, setExported] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const analytics = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/data/indonesia-provinces.geojson", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Batas provinsi tidak dapat dimuat.");
        const boundaries: Provinces = await response.json();
        const dataset = await loadObservations(boundaries, controller.signal);
        if (!controller.signal.aborted) {
          setData({ boundaries, ...dataset });
          if (dataset.mode === "firms" && dataset.coverage) {
            setYear(Number(dataset.coverage.end.slice(0, 4)));
            setMonth(null);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Observasi tidak dapat dimuat.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!playing || data?.mode === "firms") return;
    const timer = window.setInterval(
      () => setMonth((m) => (m === null || m === 12 ? 1 : m + 1)),
      1300 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed, data?.mode]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!exported) return;
    const timer = setTimeout(() => setExported(false), 2500);
    return () => clearTimeout(timer);
  }, [exported]);
  const years = data?.years ?? YEARS;
  const isDemo = data?.mode !== "firms";
  const layerLabel = layer === "Harmonized" ? "Gabungan" : layer;
  const coverage = !isDemo ? data?.coverage : undefined;
  const periodLabel = month
    ? `${MONTHS[month - 1]} ${year}`
    : isDemo
      ? "Seluruh tahun"
      : "Seluruh cakupan cache";
  const hasCoverage =
    isDemo ||
    (month === null ? !!coverage : coveredMonth(coverage, year, month));
  const risk = useMemo(
    () => (data ? calculateRisk(data, region, year, month) : null),
    [data, region, year, month],
  );
  const rawAll = useMemo(
    () =>
      data?.records.filter((r) => !highOnly || r.confidence === "high") ?? [],
    [data, highOnly],
  );
  const allActivity = useMemo(
    () => layerRecords(rawAll, layer),
    [rawAll, layer],
  );
  const regionalActivity = useMemo(
    () =>
      allActivity.filter(
        (r) => region === "Indonesia" || r.province === region,
      ),
    [allActivity, region],
  );
  const mapRecords = useMemo(
    () => allActivity.filter((r) => inPeriod(r, year, month, coverage)),
    [allActivity, year, month, coverage],
  );
  const selectedActivity = useMemo(
    () =>
      mapRecords.filter((r) => region === "Indonesia" || r.province === region),
    [mapRecords, region],
  );
  const selectedRaw = useMemo(
    () =>
      rawAll.filter(
        (r) =>
          inPeriod(r, year, month, coverage) &&
          (region === "Indonesia" || r.province === region),
      ),
    [rawAll, year, region, month, coverage],
  );
  const harmonizedCount = useMemo(
    () => harmonize(selectedRaw).length,
    [selectedRaw],
  );
  const counts = useMemo(
    () => monthlyCounts(regionalActivity, year),
    [regionalActivity, year],
  );
  const history = useMemo(
    () =>
      years.map((y) => ({
        year: y,
        counts: monthlyCounts(regionalActivity, y),
      })),
    [regionalActivity, years],
  );
  const baseline = useMemo(() => {
    const earlier = history.filter((h) => h.year < year);
    return MONTHS.map((_, i) =>
      earlier.length
        ? earlier.reduce((sum, h) => sum + h.counts[i], 0) / earlier.length
        : 0,
    );
  }, [history, year]);
  const anomaly = useMemo(
    () => analyze(regionalActivity, year, month, isDemo ? years : []),
    [regionalActivity, year, month, years, isDemo],
  );
  const ranking = useMemo(() => regionRanking(mapRecords), [mapRecords]);
  const activeRegions = new Set(selectedActivity.map((r) => r.province)).size;
  const high = selectedActivity.filter((r) => r.confidence === "high").length;
  const highPercent = selectedActivity.length
    ? Math.round((high / selectedActivity.length) * 100)
    : 0;
  const changeYear = (y: number) => {
    if (!years.includes(y)) return;
    setYear(y);
    if (!isDemo) setMonth(null);
    setPlaying(false);
  };
  const changeMonth = (m: number) => {
    if (!isDemo && !coveredMonth(coverage, year, m)) return;
    setMonth(m);
    setPlaying(false);
  };
  function navigate(next: View) {
    setView(next);
    if (next !== "explorer")
      setTimeout(
        () =>
          analytics.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function exportData() {
    const csvValue = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = [
      "id",
      "source_or_sources",
      "latitude",
      "longitude",
      "date_utc",
      "confidence_class",
      "province",
      "year",
      "month",
      "demo",
      "member_ids",
    ];
    const rows = selectedActivity.map((r) =>
      [
        r.id,
        "sources" in r ? (r.sources as string[]).join("|") : r.source,
        r.latitude,
        r.longitude,
        r.date,
        r.confidence,
        r.province,
        r.year,
        r.month,
        r.isDemo,
        "memberIds" in r ? (r.memberIds as string[]).join("|") : r.id,
      ]
        .map(csvValue)
        .join(","),
    );
    const url = URL.createObjectURL(
      new Blob([[header.join(","), ...rows].join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `SiagaApi_${isDemo ? "DEMO" : "FIRMS"}_${region.replaceAll(" ", "-")}_${year}_${month ?? "annual"}_${layer}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  }
  return (
    <>
      <header className="topbar">
        <a
          href="#"
          className="brand"
          aria-label="Beranda SiagaApi"
          onClick={(e) => {
            e.preventDefault();
            navigate("explorer");
          }}
        >
          <span className="brand-icon">
            <Flame size={23} fill="currentColor" />
          </span>
          <span>
            SiagaApi
          </span>
          <span className="brand-subtitle">
            KESIAPSIAGAAN
            <br />
            KARHUTLA
          </span>
        </a>
        <nav aria-label="Navigasi utama">
          <button
            className={view === "explorer" ? "active" : ""}
            onClick={() => navigate("explorer")}
          >
            <Map size={15} /> Peta & kesiapsiagaan
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => navigate("history")}
          >
            <ActivityIcon size={15} />{" "}
            {isDemo ? "Pola historis" : "Ringkasan data"}
          </button>
          {isDemo && (
            <button
              className={view === "compare" ? "active" : ""}
              onClick={() => navigate("compare")}
            >
              <Grid2X2 size={15} /> Bandingkan tahun
            </button>
          )}
        </nav>
        <div className="header-end">
          <button
            className="text-button"
            aria-haspopup="dialog"
            onClick={() => setModal("about")}
          >
            Tentang SiagaApi
          </button>
          <span className="observatory-label">
            <span className="orbit-icon">
              <Satellite size={19} />
            </span>{" "}
            PROTOTYPE
          </span>
          <button
            className="icon-button"
            aria-label="Tentang data dan metode"
            onClick={() => setModal("method")}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              <Globe2 size={12} /> KESIAPSIAGAAN KARHUTLA{" "}
              <ChevronRight size={11} /> INDONESIA
            </div>
            <h1>Kenali risiko. Siapkan langkah.</h1>
            <p>
              Pilih wilayah, pahami indikator karhutla, dan siapkan keluarga.
            </p>
          </div>
          <div className="page-actions">
            <div className="archive-label">
              <Satellite size={16} />
              <span>
                MODIS + VIIRS{" "}
                <small>
                  {isDemo ? "ARSIP DEMO 2020–2025" : "CACHE NASA FIRMS"}
                </small>
              </span>
            </div>
            <span className="demo-badge">
              <span /> {isDemo ? "MODE DEMO" : "DATA FIRMS · CACHE"}
            </span>
            <button
              className="outline-button"
              onClick={exportData}
              disabled={!data}
            >
              {exported ? <Check size={15} /> : <ArrowDownToLine size={15} />}{" "}
              {exported ? "Diekspor" : "Ekspor CSV"}
            </button>
          </div>
        </div>
        <div className="context-bar">
          <div className="context-title">
            <span className="status-dot" />
            <strong>Pantauan wilayah</strong>
            <span className="vertical-divider" />
            <span>{region}</span>
            <ChevronRight size={12} />
            <span>{periodLabel}</span>
          </div>
          <div className="context-controls">
            {month !== null && (
              <button
                className="text-button"
                onClick={() => {
                  setMonth(null);
                  setPlaying(false);
                }}
              >
                {isDemo ? "Tampilkan seluruh tahun" : "Seluruh cakupan cache"}{" "}
                <X size={12} />
              </button>
            )}
            <YearSelector year={year} onChange={changeYear} years={years} />
          </div>
        </div>
        {error ? (
          <div className="load-state" role="alert">
            <h2>Data belum dapat dimuat</h2>
            <p>{error}</p>
            <button
              className="outline-button"
              onClick={() => window.location.reload()}
            >
              Coba lagi
            </button>
          </div>
        ) : !data ? (
          <div className="load-state">
            <Radio size={28} className="loading-icon" />
            <h2>Menyiapkan data wilayah</h2>
            <p>Memuat batas provinsi dan observasi yang tersedia…</p>
          </div>
        ) : (
          <>
            <p className="journey-intro">
              01 Pilih wilayah & periode / 02 Baca indikator risiko / 03 Siapkan
              tindakan warga
            </p>
            <div className="data-provenance" role="status">
              <strong>{data.notice}</strong>
              {data.mode === "firms" ? (
                <p>
                  Sumber: NASA FIRMS / MODIS_NRT + VIIRS_SNPP_NRT. Sinkronisasi:{" "}
                  {data.updatedAt} / cakupan {data.coverage?.start} sampai{" "}
                  {data.coverage?.end} (UTC). Cache tidak diperbarui otomatis;
                  cakupan satelit bukan jaminan semua kebakaran teramati.
                </p>
              ) : (
                <p>
                  Observasi sintetis untuk demonstrasi. Tidak mencerminkan
                  kondisi kebakaran saat ini.
                </p>
              )}
            </div>
            <div className="citizen-filters">
              <label>
                Wilayah
                <select
                  aria-label="Wilayah pemantauan"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option>Indonesia</option>
                  {data.boundaries.features
                    .map((f) => f.properties.PROVINSI)
                    .sort()
                    .map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                </select>
              </label>
              <label>
                Periode
                <select
                  aria-label="Bulan pemantauan"
                  value={month ?? "all"}
                  onChange={(e) => {
                    if (e.target.value === "all") {
                      setMonth(null);
                      setPlaying(false);
                    } else changeMonth(Number(e.target.value));
                  }}
                >
                  <option value="all">
                    {isDemo ? "Seluruh tahun" : "Seluruh cakupan cache"}
                  </option>
                  {MONTHS.map((name, i) => (
                    <option
                      key={name}
                      value={i + 1}
                      disabled={!isDemo && !coveredMonth(coverage, year, i + 1)}
                    >
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!isDemo && (
              <p className="coverage-explanation">
                Pilihan bulan dibatasi pada {coverage?.start} sampai{" "}
                {coverage?.end} (UTC). Bulan lain tidak memiliki cakupan dan
                dinonaktifkan; ini bukan data satu bulan penuh.
              </p>
            )}
            {risk && (
              <div className="citizen-grid">
                <div className="citizen-summary">
                  <RiskStatusCard risk={risk} region={region} />
                  <RiskBrief
                    risk={risk}
                    region={region}
                    onExpand={() => setModal("brief")}
                  />
                </div>
                <EmergencyActionPanel
                  key={`${region}-${year}-${month}-${risk.level}`}
                  level={risk.level}
                  region={region}
                />
              </div>
            )}
            <div className="metrics">
              <Metric
                label={
                  layer === "Harmonized"
                    ? "Observasi gabungan"
                    : `Deteksi ${layer}`
                }
                value={
                  hasCoverage
                    ? number(selectedActivity.length)
                    : "Belum dapat dinilai"
                }
                icon={<Flame size={17} />}
                sub={
                  layer === "Harmonized"
                    ? `${number(selectedRaw.length)} deteksi sumber`
                    : "Observasi satelit"
                }
                detail="Bukan kejadian kebakaran individual"
                spark={isDemo ? counts : undefined}
              />
              <Metric
                label="Keyakinan tinggi"
                value={hasCoverage ? number(high) : "Belum dapat dinilai"}
                icon={<ShieldCheck size={17} />}
                sub={`${highPercent}% dari observasi terpilih`}
                detail="Kategori keyakinan sensor"
                progress={hasCoverage ? highPercent : undefined}
              />
              <Metric
                label="Provinsi dengan aktivitas"
                value={
                  hasCoverage
                    ? number(activeRegions).padStart(2, "0")
                    : "Belum dapat dinilai"
                }
                suffix={region === "Indonesia" ? "/ 38" : "/ 1"}
                icon={<MapPin size={17} />}
                sub={
                  region === "Indonesia" ? "Provinsi dengan deteksi" : region
                }
                detail="Dalam periode terpilih"
              />
              <Metric
                label="Sel grid terpadat"
                value={
                  hasCoverage
                    ? number(largestCell(selectedActivity))
                    : "Belum dapat dinilai"
                }
                suffix="obs."
                icon={<Grid2X2 size={17} />}
                sub="Observasi terbanyak dalam sel 0,05°"
                detail="Kepadatan spasial · bukan batas kebakaran"
              />
            </div>
            <div className="workspace">
              <section className="map-panel">
                <div className="map-heading">
                  <h2>
                    <span className="live-square" /> Peta aktivitas
                  </h2>
                  <ProvinceSearch
                    regions={data.boundaries.features
                      .map((feature) => feature.properties.PROVINSI)
                      .sort()}
                    ranking={ranking}
                    onSelect={setRegion}
                  />
                  <div>
                    <span className="subtle-tag">
                      {layerLabel.toUpperCase()}
                    </span>
                    <span className="map-hint">
                      Pilih provinsi untuk melihat rincian{" "}
                      <ArrowUpRight size={12} />
                    </span>
                  </div>
                </div>
                <IndonesiaMap
                  boundaries={data.boundaries}
                  records={mapRecords}
                  selected={region}
                  onSelect={setRegion}
                  showMarkers={markers}
                  showBorders={borders}
                  density={density}
                  onDensityChange={setDensity}
                />
                {isDemo && (
                  <FireReplay
                    month={month}
                    setMonth={setMonth}
                    playing={playing}
                    setPlaying={setPlaying}
                    counts={counts}
                    speed={speed}
                    setSpeed={setSpeed}
                    year={year}
                  />
                )}
              </section>
              <RegionPanel
                isDemo={isDemo}
                periodLabel={periodLabel}
                region={region}
                regions={data.boundaries.features
                  .map((f) => f.properties.PROVINSI)
                  .sort()}
                onRegion={setRegion}
                year={year}
                layer={layer}
                setLayer={setLayer}
                raw={selectedRaw}
                activity={harmonizedCount}
                counts={counts}
                anomaly={anomaly}
                markers={markers}
                setMarkers={setMarkers}
                borders={borders}
                setBorders={setBorders}
                density={density}
                setDensity={setDensity}
                highOnly={highOnly}
                setHighOnly={setHighOnly}
                onMethod={() => setModal("method")}
                month={month}
              />
            </div>
            <RegionLeaders
              ranking={ranking}
              selected={region}
              period={`${periodLabel} ${year}`}
              onSelect={(name) => {
                setRegion(name);
                document
                  .querySelector(".workspace")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
            <div className="analytics-heading" ref={analytics}>
              <div>
                <h2>
                  {view === "compare"
                    ? "Perbandingan tahunan"
                    : isDemo
                      ? "Pola historis"
                      : "Ringkasan cakupan cache"}
                </h2>
                <span>
                  {region} <span className="divider-dot">/</span> {layerLabel}{" "}
                  <span className="divider-dot">/</span>{" "}
                  {isDemo
                    ? "Analisis tahunan demo"
                    : "Observasi dalam cakupan cache"}
                </span>
              </div>
              {isDemo && (
                <button
                  className="text-button"
                  onClick={() =>
                    navigate(view === "compare" ? "history" : "compare")
                  }
                >
                  {view === "compare" ? "Pola historis" : "Bandingkan tahun"}{" "}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
            {view === "compare" && isDemo && (
              <YearComparison
                records={regionalActivity}
                year={year}
                comparisonYear={comparisonYear}
                onChange={setComparisonYear}
                region={region}
              />
            )}
            {!isDemo && (
              <p className="data-provenance">
                Arsip FIRMS hanya mencakup rentang sinkronisasi di atas. Grafik
                berikut menunjukkan jumlah yang tersedia, bukan total
                bulanan/tahunan lengkap. Baseline, kalender historis, dan
                perbandingan tahunan belum dapat dihitung dari cache singkat
                ini.
              </p>
            )}
            <div className="analytics-grid">
              {isDemo ? (
                <HotspotTrend
                  counts={counts}
                  baseline={baseline}
                  baselineAvailable={
                    isDemo && history.some((h) => h.year < year)
                  }
                  year={year}
                  onMonth={changeMonth}
                />
              ) : coverage ? (
                <CacheActivity
                  records={selectedActivity}
                  coverage={coverage}
                  year={year}
                  month={month}
                />
              ) : (
                <p>Belum dapat dinilai: cakupan tidak tersedia.</p>
              )}
              {isDemo && (
                <ActivityCalendar
                  data={history}
                  selectedYear={year}
                  onSelect={(y, m) => {
                    changeYear(y);
                    setMonth(m);
                  }}
                />
              )}
            </div>
            {view === "history" && isDemo && (
              <section className="card historical-detail">
                <div className="card-heading">
                  <h3>Periode tidak biasa · {year}</h3>
                  <span className="subtle-tag">RATA-RATA + 2σ</span>
                </div>
                <p className="helper">
                  Setiap bulan dibandingkan dengan bulan yang sama pada tahun
                  sebelumnya. Diperlukan sedikitnya tiga tahun baseline.
                </p>
                <div className="critical-months">
                  {MONTHS.map((name, i) => {
                    const a = analyze(regionalActivity, year, i + 1, years);
                    return (
                      <button
                        key={name}
                        className={a.unusual ? "is-unusual" : ""}
                        onClick={() => {
                          changeMonth(i + 1);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <span>{name}</span>
                        <strong>{number(a.current)}</strong>
                        <small>
                          {!a.enough
                            ? "Baseline belum tersedia"
                            : a.unusual
                              ? "Tidak biasa"
                              : "Rentang biasa"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <div className="data-notice">
              <InfoMark />
              <p>
                <strong>Observasi, bukan kejadian kebakaran.</strong> Deteksi
                satelit bukan konfirmasi kebakaran individual.{" "}
                {isDemo
                  ? "Data sintetis untuk demonstrasi."
                  : "Observasi NASA FIRMS sesuai cakupan cache."}{" "}
                Skor bukan prediksi atau peringatan resmi.
              </p>
              <button onClick={() => setModal("method")}>
                Data & metode <ArrowUpRight size={13} />
              </button>
            </div>
          </>
        )}
        <footer>
          <span>
            <span className="footer-brand">SiagaApi</span> Kesiapsiagaan
            karhutla · {isDemo ? "Mode Demo" : "Cache FIRMS"}
          </span>
          <span>
            PROTOTYPE <i /> INDONESIA
          </span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="modal"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="modal-top">
          <span className="eyebrow">
            SiagaApi /{" "}
            {modal === "about"
              ? "TENTANG SIAGAAPI"
              : modal === "method"
                ? "DATA & METODE"
                : "RINGKASAN AKTIVITAS"}
          </span>
          <button
            autoFocus
            className="icon-button"
            aria-label="Tutup dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
        </div>
        {modal === "about" ? (
          <>
            <h2>Tentang SiagaApi</h2>
            <p className="modal-intro">
              Prototype kesiapsiagaan warga
            </p>
            <p>
              Kebakaran hutan dan lahan di Indonesia melepaskan emisi karbon.
              Kerusakan habitat mengancam keanekaragaman hayati. Kabut asap
              berdampak pada kesehatan dan kehidupan masyarakat.
            </p>
            <p>
              SiagaApi menghubungkan pemantauan MODIS/VIIRS, indikator risiko
              yang transparan, dan checklist kesiapsiagaan. Pilih wilayah dan
              periode untuk memahami aktivitas yang tercatat serta langkah
              persiapan.
            </p>
            <p>
              <span className="subtle-tag">
                SDG 13 / Penanganan perubahan iklim
              </span>{" "}
              <span className="subtle-tag">SDG 15 / Ekosistem daratan</span>
            </p>
            <h3>Observasi, bukan kejadian kebakaran</h3>
            <p>
              Deteksi satelit bukan konfirmasi kejadian kebakaran. Skor adalah
              heuristik prototype, bukan prediksi pasti, pengukuran luas
              terbakar, atau peringatan resmi. Titik aman, rencana evakuasi, dan
              bantuan hanya simulasi.
            </p>
            <p className="helper">
              Menggunakan data publik NASA FIRMS saat cache tersedia; bukan
              produk resmi NASA.{" "}
              {isDemo
                ? "Saat ini Mode Demo: observasi sintetis."
                : "Saat ini menggunakan cache observasi FIRMS."}
            </p>
          </>
        ) : modal === "method" ? (
          <>
            <h2>Cara membaca observasi dan indikator.</h2>
            <p className="modal-intro">
              {isDemo
                ? "Mode Demo · observasi sintetis"
                : "Cache NASA FIRMS · bukan koneksi langsung"}
            </p>
            <h3>01 / Sumber observasi</h3>
            <p>
              Mode Demo memakai observasi sintetis 2020–2025 di 38 provinsi.
              Mode FIRMS membaca cache MODIS_NRT dan VIIRS_SNPP_NRT yang
              disinkronkan di server. Provinsi ditentukan melalui
              point-in-polygon. Badge sumber, waktu sinkronisasi, dan cakupan
              membedakan kedua mode. Tidak ada pengukuran luas terbakar.
            </p>
            <h3>02 / Penggabungan observasi</h3>
            <p>
              Observasi diurutkan menurut waktu UTC. Deteksi MODIS dan VIIRS
              dipasangkan, termasuk lintas provinsi, bila berjarak paling jauh
              <strong> 1 km dan 60 menit</strong>. Pencocokan satu-ke-satu
              memilih observasi terdekat yang tersedia. Deteksi sensor yang sama
              tetap terpisah. Kedua ID sumber dipertahankan; lokasi, provinsi,
              bulan, dan tahun mengikuti observasi yang lebih awal.
            </p>
            <p>
              Prototype ini mengurangi observasi yang tumpang tindih. Perbedaan
              resolusi sensor, waktu lintasan, tutupan awan, dan sensitivitas
              deteksi belum dikoreksi. Hasilnya bukan produk historis gabungan
              yang telah divalidasi secara ilmiah.
            </p>
            <h3>03 / Keyakinan sensor & kepadatan</h3>
            <p>
              Keyakinan MODIS dikelompokkan menjadi rendah (&lt;30), nominal
              (30–79), atau tinggi (≥80). VIIRS memakai kategori rendah,
              nominal, dan tinggi asli sensor tanpa persentase buatan. Pasangan
              observasi memakai kategori tertinggi anggotanya. Pada eksplorasi
              peta, filter keyakinan tinggi diterapkan sebelum pencocokan. Sel
              terpadat dihitung pada grid geografis 0,05°, bukan kelompok
              kejadian kebakaran atau ukuran kepadatan dengan luas setara.
            </p>
            <p>
              Simbol peta yang tumpang tindih diringkas dalam sel tampilan 0,04°
              memakai lokasi salah satu anggota dan kategori keyakinan
              tertinggi. Tampilan ini tidak mengubah jumlah observasi dalam
              analisis.
            </p>
            <h3>04 / Anomali historis</h3>
            <p>
              Pada arsip demo, aktivitas dianggap tidak biasa bila melebihi
              rata-rata historis + 2 simpangan baku populasi untuk wilayah,
              lapisan, dan filter terpilih. Baseline memakai periode kalender
              yang sama pada sedikitnya tiga tahun sebelumnya. Anomali bulanan
              dan tahunan dihitung terpisah; ringkasan berasal dari perhitungan
              ini. Cache FIRMS singkat belum mendukung analisis historis
              tersebut.
            </p>
            <h3>05 / Batas wilayah & integrasi data</h3>
            <p>
              Peta menggunakan{" "}
              <a
                href="https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces"
                target="_blank"
                rel="noreferrer"
              >
                Indonesia 38-province GeoJSON by Deny Herianto{" "}
                <ExternalLink size={12} />
              </a>
              , dengan lisensi{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              . File batas wilayah tidak diubah; orientasi poligon dinormalisasi
              untuk tampilan. Batas saat ini dipakai untuk seluruh tahun demo
              tanpa rekonstruksi perubahan batas historis.
            </p>
            <p>
              Cache diperbarui melalui sinkronisasi di server. Kredensial tidak
              dikirim ke browser. Cache yang tidak valid memakai fallback demo;
              cache lebih dari 7 hari tidak menghasilkan status risiko.{" "}
              <a
                href="https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html"
                target="_blank"
                rel="noreferrer"
              >
                Dokumentasi API NASA FIRMS <ExternalLink size={12} />
              </a>
            </p>
          </>
        ) : (
          <>
            <h2>
              {region} · {year}
            </h2>
            <p className="modal-intro">
              {layerLabel} ·{" "}
              {highOnly ? "Hanya keyakinan tinggi" : "Semua kategori keyakinan"}{" "}
              ·{periodLabel} · {isDemo ? "DEMO SINTETIS" : "CACHE FIRMS"}
            </p>
            <p className="full-brief">
              {risk ? riskBrief(risk, region) : "Data belum tersedia."}
              {isDemo && (
                <>
                  <br />
                  <br />
                  {buildBrief(regionalActivity, year, region)}
                </>
              )}
            </p>
            <h3>Observasi terbanyak di Indonesia</h3>
            <p className="helper">
              {periodLabel} {year} · {layerLabel} observasi
            </p>
            <div className="ranking">
              {ranking.slice(0, 5).map(([name, count], i) => (
                <button
                  key={name}
                  onClick={() => {
                    setRegion(name);
                    setModal(null);
                  }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <strong>{name}</strong>
                  <b>{number(count)}</b>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <p className="helper">
              {isDemo
                ? "Dihitung dari data sintetis."
                : "Dihitung dari cakupan cache FIRMS."}{" "}
              Indikator bukan konfirmasi tingkat keparahan atau instruksi
              evakuasi.
            </p>
            <button
              className="outline-button"
              onClick={() => setModal("method")}
            >
              Lihat metode perhitungan <ArrowUpRight size={14} />
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
function InfoMark() {
  return <span className="info-mark">i</span>;
}
function Metric({
  label,
  value,
  suffix,
  icon,
  sub,
  detail,
  spark,
  progress,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  sub: string;
  detail: string;
  spark?: number[];
  progress?: number;
}) {
  return (
    <section className="metric">
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-main">
        <strong>{value}</strong>
        {suffix && <span>{suffix}</span>}
        {spark && (
          <div className="mini-bars" aria-hidden="true">
            {spark.map((n, i) => (
              <i
                key={i}
                style={{ height: `${5 + (n / Math.max(1, ...spark)) * 28}px` }}
              />
            ))}
          </div>
        )}
        {progress !== undefined && (
          <div
            className="confidence-ring"
            style={{
              background: `conic-gradient(#9cbaa5 ${progress}%, #303b32 0)`,
            }}
          >
            <span>{progress}%</span>
          </div>
        )}
      </div>
      <p>{sub}</p>
      <small>{detail}</small>
    </section>
  );
}

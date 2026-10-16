import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  Home,
  Grid2X2,
  Map,
  MapPin,
  Newspaper,
  MessageCircle,
  Radio,
  Satellite,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Layer, Provinces } from "./types";
import { MONTHS, YEARS, number } from "./types";
import { loadObservations } from "./services/observationProvider";
import type { ObservationDataset } from "./services/observationProvider";
import { riskBrief } from "./services/riskService";
import RiskStatusCard from "./components/RiskStatusCard";
import RiskBrief from "./components/RiskBrief";
import EmergencyActionPanel from "./components/EmergencyActionPanel";
import { useDashboardAnalysis } from "./components/useDashboardAnalysis";
import { useMapReplay } from "./components/useMapReplay";
import { MapPerformance, QualityControl } from "./components/MapQuality";
import { buildChatContext } from "./services/chatProtocol";
import IndonesiaMap from "./components/IndonesiaMap";
import RegionPanel from "./components/RegionPanel";
import YearSelector from "./components/YearSelector";
import FireReplay from "./components/FireReplay";
import HotspotTrend from "./components/HotspotTrend";
import ActivityCalendar from "./components/ActivityCalendar";
import YearComparison from "./components/YearComparison";
import { buildBrief } from "./components/FireBrief";
import CacheActivity from "./components/CacheActivity";
import { coveredMonth } from "./services/coveragePeriod";
import ProvinceSearch from "./components/ProvinceSearch";
import RegionLeaders from "./components/RegionLeaders";
type View = "history" | "compare";
const NewsFeed = lazy(() => import("./components/NewsFeed"));
const AssistantChat = lazy(() => import("./components/AssistantChat"));
type Tab = "home" | "map" | "data" | "news" | "chat";
const tabs = [
  { id: "home", label: "Beranda", icon: Home },
  { id: "map", label: "Peta aktivitas", icon: Map },
  { id: "data", label: "Data & analitik", icon: ActivityIcon },
  { id: "news", label: "Berita", icon: Newspaper },
  { id: "chat", label: "Asisten AI", icon: MessageCircle },
] as const;
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
  const [view, setView] = useState<View>("history"),
    [comparisonYear, setComparisonYear] = useState(2024);
  const [modal, setModal] = useState<"method" | "brief" | "about" | null>(null);
  const [exported, setExported] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [mapVisited, setMapVisited] = useState(false);
  const [chatVisited, setChatVisited] = useState(false);
  const [mapPanel, setMapPanel] = useState<"location" | "layers" | null>(null);
  const [desktopPanels, setDesktopPanels] = useState({
    location: true,
    layers: true,
  });
  const [mobileMap, setMobileMap] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMobileMap(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const panelOpen = (name: "location" | "layers") =>
    mobileMap ? mapPanel === name : desktopPanels[name];
  const toggleMapPanel = (name: "location" | "layers") => {
    if (mobileMap) setMapPanel(mapPanel === name ? null : name);
    else
      setDesktopPanels((current) => ({ ...current, [name]: !current[name] }));
  };
  const closeMapPanel = (name: "location" | "layers") => {
    if (mobileMap) setMapPanel(null);
    else setDesktopPanels((current) => ({ ...current, [name]: false }));
    document.getElementById(`toggle-map-${name}`)?.focus();
  };
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(81);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() =>
      setHeaderHeight(header.getBoundingClientRect().height),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
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
  const { analysis, pending, analysisError } = useDashboardAnalysis(data, {
    region,
    year,
    month,
    layer,
    highOnly,
  });
  useMapReplay(
    playing,
    tab === "map" && data?.mode === "demo",
    pending,
    speed,
    setMonth,
  );
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
  const newsProvinces = useMemo(
    () =>
      data?.boundaries.features
        .map((f) => f.properties.PROVINSI)
        .sort((a, b) => a.localeCompare(b, "id")) ?? [],
    [data],
  );
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
  const {
    risk,
    regionalActivity,
    mapRecords,
    selectedActivity,
    selectedRaw,
    harmonizedCount,
    counts,
    history,
    baseline,
    anomaly,
    ranking,
    activeRegions,
    high,
    highPercent,
    gridCount,
    monthAnomalies,
  } = analysis;
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
  function navigate(next: Tab) {
    setTab(next);
    if (next === "chat") setChatVisited(true);
    if (next === "map") setMapVisited(true);
    setPlaying(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      document.getElementById(`tab-${next}`)?.focus({ preventScroll: true });
      window.dispatchEvent(new Event("resize"));
    });
  }
  function exportData() {
    if (pending || analysisError) return;
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
  const contextControls = (
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
  );
  const locationControls = data ? (
    <>
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
          Bulan tanpa data tidak dapat dipilih. Cakupan bukan satu bulan penuh.
        </p>
      )}
    </>
  ) : null;
  const sourceDetails = data ? (
    <div className="data-provenance" role="status">
      <strong>{isDemo ? "Mode Demo" : "Cache NASA FIRMS"}</strong>
      <p>
        {isDemo
          ? "Observasi sintetis, bukan kondisi saat ini."
          : `Cakupan ${data.coverage?.start} sampai ${data.coverage?.end} (UTC), bukan pantauan langsung.`}
      </p>
      <details>
        <summary>Sumber dan batas data</summary>
        <p>{data.notice}</p>
        {data.mode === "firms" ? (
          <p>
            Sumber: NASA FIRMS / MODIS_NRT + VIIRS_SNPP_NRT. Sinkronisasi:{" "}
            {data.updatedAt} / cakupan {data.coverage?.start} sampai{" "}
            {data.coverage?.end} (UTC). Cache tidak diperbarui otomatis; cakupan
            satelit bukan jaminan semua kebakaran teramati.
          </p>
        ) : (
          <p>
            Observasi sintetis untuk demonstrasi. Tidak mencerminkan kondisi
            kebakaran saat ini.
          </p>
        )}
      </details>
    </div>
  ) : null;
  return (
    <>
      <header className="topbar" ref={headerRef}>
        <a
          href="#"
          className="brand"
          aria-label="Beranda SiagaApi"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-icon">
            <Flame size={23} fill="currentColor" />
          </span>
          <span>SiagaApi</span>
          <span className="brand-subtitle">
            KESIAPSIAGAAN
            <br />
            KARHUTLA
          </span>
        </a>
        <nav aria-label="Navigasi utama">
          <div
            role="tablist"
            aria-label="Bagian SiagaApi"
            className="main-tabs"
          >
            {tabs.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                className={tab === id ? "active" : ""}
                onClick={() => navigate(id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    navigate(tabs[next].id);
                  }
                }}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
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
      <main
        aria-busy={pending}
        className={
          tab === "map"
            ? "map-layout"
            : tab === "home"
              ? "home-layout"
              : undefined
        }
        style={
          { "--app-header-height": `${headerHeight}px` } as React.CSSProperties
        }
      >
        {pending && (
          <div className="analysis-progress" role="status">
            Memperbarui analisis…
          </div>
        )}
        {analysisError && (
          <p role="alert">Analisis tidak dapat dimuat. Muat ulang halaman.</p>
        )}
        <MapPerformance
          active={tab === "map"}
          animating={playing || (markers && region !== "Indonesia")}
        />
        <div className="page-heading" hidden={tab === "chat"}>
          <div>
            <div className="breadcrumb">
              <Globe2 size={12} /> KESIAPSIAGAAN KARHUTLA{" "}
              <ChevronRight size={11} /> INDONESIA
            </div>
            <h1>
              {tab === "home"
                ? "Kenali risiko. Siapkan langkah."
                : tab === "map"
                  ? "Jelajahi aktivitas satelit"
                  : tab === "news"
                    ? "Berita & pembaruan"
                    : "Data & analitik"}
            </h1>
            <p>
              {tab === "home"
                ? "Pahami indikator risiko dan siapkan keluarga."
                : tab === "map"
                  ? "Pilih wilayah, periode, dan lapisan observasi satelit."
                  : tab === "news"
                    ? "Kabar dari sumber asal, dengan konteks observasi satelit."
                    : "Baca pola observasi sesuai wilayah dan periode pilihan."}
            </p>
          </div>
          <div className="page-actions">
            {tab !== "news" && (
              <span className="demo-badge">
                <span /> {isDemo ? "Mode Demo" : "Cache NASA FIRMS"}
              </span>
            )}
            {tab === "data" && (
              <button
                className="outline-button"
                onClick={exportData}
                disabled={!data || pending || analysisError}
              >
                {exported ? <Check size={15} /> : <ArrowDownToLine size={15} />}{" "}
                {exported ? "Diekspor" : "Ekspor CSV"}
              </button>
            )}
          </div>
        </div>
        {tab === "data" && contextControls}
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
            {tab === "data" && locationControls}
            {tab === "home" && (
              <details className="home-context">
                <summary>
                  <span>
                    <MapPin size={16} /> {region}
                  </span>
                  <span>
                    {periodLabel} <ChevronRight size={16} />
                  </span>
                </summary>
                {contextControls}
                {locationControls}
              </details>
            )}
            <section
              id="panel-home"
              role="tabpanel"
              aria-labelledby="tab-home"
              tabIndex={0}
              hidden={tab !== "home"}
            >
              {risk && (
                <div className="citizen-grid">
                  <div className="citizen-summary">
                    <RiskStatusCard
                      risk={
                        pending || analysisError
                          ? {
                              ...risk,
                              level: null,
                              score: null,
                              note: "Analisis sedang diperbarui.",
                            }
                          : risk
                      }
                      region={region}
                    />
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
              <div className="home-actions">
                <button
                  className="outline-button"
                  aria-label="Buka Peta aktivitas"
                  onClick={() => navigate("map")}
                >
                  <Map size={22} />
                  <span>
                    <strong>Buka Peta aktivitas</strong>
                    <small>Jelajahi observasi di wilayahmu</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <button
                  className="outline-button"
                  aria-label="Buka Data & analitik"
                  onClick={() => navigate("data")}
                >
                  <ActivityIcon size={22} />
                  <span>
                    <strong>Buka Data & analitik</strong>
                    <small>Lihat pola dan rincian observasi</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
            <section
              id="panel-map"
              role="tabpanel"
              aria-labelledby="tab-map"
              tabIndex={0}
              hidden={tab !== "map"}
            >
              {tab === "map" && (
                <div
                  className={`map-floating map-location ${panelOpen("location") ? "is-open" : ""}`}
                  id="map-location-panel"
                >
                  <div className="floating-heading">
                    <h2>Jelajahi wilayah</h2>
                    <button
                      className="map-panel-close"
                      aria-label="Tutup panel wilayah"
                      onClick={() => closeMapPanel("location")}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <ProvinceSearch
                    regions={data.boundaries.features
                      .map((feature) => feature.properties.PROVINSI)
                      .sort()}
                    ranking={ranking}
                    onSelect={setRegion}
                  />
                  <div className="map-area-summary">
                    <span>{region}</span>
                    <strong>
                      {hasCoverage
                        ? number(selectedActivity.length)
                        : "Belum dapat dinilai"}
                      <small> observasi satelit</small>
                    </strong>
                  </div>
                  <details className="map-period-controls">
                    <summary>Ubah wilayah & periode</summary>
                    {contextControls}
                    {locationControls}
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
                  </details>
                  <div className="map-source-compact">
                    <span className="source-chip">
                      <span />
                      {isDemo ? "Mode Demo" : "Cache NASA FIRMS"}
                    </span>
                    <span>
                      {isDemo
                        ? `${year} ? data sintetis`
                        : `${coverage?.start} s.d. ${coverage?.end} UTC`}
                    </span>
                    <details className="map-data-details">
                      <summary>Data & batasan</summary>
                      <p>
                        Observasi satelit bukan konfirmasi kebakaran. Filter
                        peta tidak mengubah indikator risiko.
                      </p>
                      {sourceDetails}
                      <button
                        className="text-button"
                        onClick={() => setModal("method")}
                      >
                        Sumber, atribusi & metode
                      </button>
                    </details>
                  </div>
                </div>
              )}
              <div className="map-bottom-controls">
                <button
                  id="toggle-map-location"
                  aria-expanded={panelOpen("location")}
                  aria-controls="map-location-panel"
                  onClick={() => toggleMapPanel("location")}
                >
                  Wilayah & periode
                </button>
                <button
                  id="toggle-map-layers"
                  aria-expanded={panelOpen("layers")}
                  aria-controls="map-layer-panel"
                  onClick={() => toggleMapPanel("layers")}
                >
                  Sensor & filter
                </button>
              </div>
              {mapVisited && (
                <>
                  <div className="workspace">
                    <section className="map-panel">
                      <div className="map-heading">
                        <h2>
                          <span className="live-square" /> Peta aktivitas
                        </h2>
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
                    </section>
                    <div
                      className={`map-floating map-layers ${panelOpen("layers") ? "is-open" : ""}`}
                      id="map-layer-panel"
                    >
                      <div className="floating-heading">
                        <h2>Lapisan peta</h2>
                        <button
                          className="map-panel-close"
                          aria-label="Tutup panel filter"
                          onClick={() => closeMapPanel("layers")}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <QualityControl />
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
                  </div>
                </>
              )}
            </section>
            <section
              id="panel-data"
              role="tabpanel"
              aria-labelledby="tab-data"
              tabIndex={0}
              hidden={tab !== "data"}
            >
              <p className="coverage-explanation">
                Pilihan peta: {layerLabel} ?{" "}
                {highOnly
                  ? "Hanya keyakinan tinggi"
                  : "Semua kategori keyakinan"}
                .{" "}
                <button className="text-button" onClick={() => navigate("map")}>
                  Ubah filter peta
                </button>
              </p>
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
                    hasCoverage ? number(gridCount) : "Belum dapat dinilai"
                  }
                  suffix="obs."
                  icon={<Grid2X2 size={17} />}
                  sub="Observasi terbanyak dalam sel 0,05°"
                  detail="Kepadatan spasial · bukan batas kebakaran"
                />
              </div>
              <RegionLeaders
                ranking={ranking}
                selected={region}
                period={`${periodLabel} ${year}`}
                onSelect={(name) => {
                  setRegion(name);
                  navigate("map");
                }}
              />
              <div className="analytics-heading">
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
                      setView(view === "compare" ? "history" : "compare")
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
                  Arsip FIRMS hanya mencakup rentang sinkronisasi yang tersedia.
                  Grafik berikut menunjukkan jumlah yang tersedia, bukan total
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
                      const a = monthAnomalies[i];
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
              <button
                className="outline-button"
                onClick={() => setModal("method")}
              >
                Sensor, metode & batas data <CircleHelp size={16} />
              </button>
            </section>
            {tab === "news" && (
              <section
                id="panel-news"
                role="tabpanel"
                aria-labelledby="tab-news"
                tabIndex={0}
              >
                <Suspense fallback={<p role="status">Memuat berita…</p>}>
                  <NewsFeed
                    dataset={data}
                    provinces={newsProvinces}
                    year={year}
                    month={month}
                    initialRegion={region}
                  />
                </Suspense>
              </section>
            )}
            {chatVisited && (
              <section
                id="panel-chat"
                role="tabpanel"
                aria-labelledby="tab-chat"
                hidden={tab !== "chat"}
                tabIndex={0}
              >
                <Suspense fallback={<p role="status">Memuat asisten…</p>}>
                  <AssistantChat
                    active={tab === "chat"}
                    context={buildChatContext(
                      region,
                      periodLabel,
                      risk,
                      data,
                      pending || analysisError,
                    )}
                    onNavigate={navigate}
                  />
                </Suspense>
              </section>
            )}
            {tab !== "map" && tab !== "news" && tab !== "chat" && sourceDetails}
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
            karhutla · {isDemo ? "Mode Demo" : "Cache NASA FIRMS"}
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
            <p className="modal-intro">Prototype kesiapsiagaan warga</p>
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
                : "Saat ini menggunakan Cache NASA FIRMS."}
            </p>
            <h3>Konteks cuaca & privasi</h3>
            <p>
              Cuaca model (bukan pengukuran stasiun), ± puluhan km. Cuaca saat
              ini tersedia saat membuka rincian hotspot; bukan cuaca pada waktu
              observasi lama dan tidak masuk ke perhitungan skor.
            </p>
            <p>
              Koordinat hotspot dibulatkan ke 2 desimal sebelum dikirim ke
              Open-Meteo. Penyedia menerima koordinat tersebut dan alamat IP
              koneksi. Hasil disimpan di memori dan sesi browser selama 30
              menit.
            </p>
            <p>
              <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
                Weather data by Open-Meteo.com
              </a>
              . Data berlisensi{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              ;{" "}
              <a
                href="https://open-meteo.com/en/terms"
                target="_blank"
                rel="noreferrer"
              >
                API gratis untuk penggunaan non-komersial
              </a>
              .
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
              ini. Cache NASA FIRMS singkat belum mendukung analisis historis
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

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
import type { Hotspot, Layer, Provinces } from "./types";
import { MONTHS, YEARS, number } from "./types";
import { nasaDataService } from "./services/nasaDataService";
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
import FireBrief, { buildBrief } from "./components/FireBrief";
import ProvinceSearch from "./components/ProvinceSearch";
import RegionLeaders from "./components/RegionLeaders";
type View = "explorer" | "history" | "compare";
export default function App() {
  const [data, setData] = useState<{
    boundaries: Provinces;
    records: Hotspot[];
  } | null>(null);
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
  const [modal, setModal] = useState<"method" | "brief" | null>(null);
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
        if (!response.ok)
          throw new Error("Province boundaries could not be loaded.");
        const boundaries: Provinces = await response.json();
        const records = await nasaDataService.loadRecords(boundaries);
        if (!controller.signal.aborted) setData({ boundaries, records });
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Unable to load observations.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setMonth((m) => (m === null || m === 12 ? 1 : m + 1)),
      1300 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!exported) return;
    const timer = setTimeout(() => setExported(false), 2500);
    return () => clearTimeout(timer);
  }, [exported]);
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
    () =>
      allActivity.filter(
        (r) => r.year === year && (month === null || r.month === month),
      ),
    [allActivity, year, month],
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
          r.year === year &&
          (region === "Indonesia" || r.province === region) &&
          (month === null || r.month === month),
      ),
    [rawAll, year, region, month],
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
      YEARS.map((y) => ({
        year: y,
        counts: monthlyCounts(regionalActivity, y),
      })),
    [regionalActivity],
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
    () => analyze(regionalActivity, year, month, YEARS),
    [regionalActivity, year, month],
  );
  const ranking = useMemo(() => regionRanking(mapRecords), [mapRecords]);
  const activeRegions = new Set(selectedActivity.map((r) => r.province)).size;
  const high = selectedActivity.filter((r) => r.confidence === "high").length;
  const highPercent = selectedActivity.length
    ? Math.round((high / selectedActivity.length) * 100)
    : 0;
  const changeYear = (y: number) => {
    setYear(y);
    setPlaying(false);
  };
  const changeMonth = (m: number) => {
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
    link.download = `BARA_DEMO_${region.replaceAll(" ", "-")}_${year}_${month ?? "annual"}_${layer}.csv`;
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
          aria-label="BARA home"
          onClick={(e) => {
            e.preventDefault();
            navigate("explorer");
          }}
        >
          <span className="brand-icon">
            <Flame size={23} fill="currentColor" />
          </span>
          <span>
            BARA<span className="brand-period">.</span>
          </span>
          <span className="brand-subtitle">
            INDONESIA HOTSPOT
            <br />
            OBSERVATORY
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "explorer" ? "active" : ""}
            onClick={() => navigate("explorer")}
          >
            <Map size={15} /> Explorer
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => navigate("history")}
          >
            <ActivityIcon size={15} /> Historical insights
          </button>
          <button
            className={view === "compare" ? "active" : ""}
            onClick={() => navigate("compare")}
          >
            <Grid2X2 size={15} /> Compare years
          </button>
        </nav>
        <div className="header-end">
          <span className="challenge-label">
            <span className="orbit-icon">
              <Satellite size={19} />
            </span>{" "}
            NASA SPACE APPS <b>2026</b>
          </span>
          <button
            className="icon-button"
            aria-label="About the data and methodology"
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
              <Globe2 size={12} /> EARTH OBSERVATION <ChevronRight size={11} />{" "}
              INDONESIA
            </div>
            <h1>Indonesia hotspot monitor</h1>
            <p>MODIS and VIIRS observations across 38 provinces.</p>
          </div>
          <div className="page-actions">
            <div className="archive-label">
              <Satellite size={16} />
              <span>
                MODIS + VIIRS <small>2020 — 2025 OBSERVATION ARCHIVE</small>
              </span>
            </div>
            <span className="demo-badge">
              <span /> DEMO DATA
            </span>
            <button
              className="outline-button"
              onClick={exportData}
              disabled={!data}
            >
              {exported ? <Check size={15} /> : <ArrowDownToLine size={15} />}{" "}
              {exported ? "Exported" : "Export data"}
            </button>
          </div>
        </div>
        <div className="context-bar">
          <div className="context-title">
            <span className="status-dot" />
            <strong>Hotspot intelligence</strong>
            <span className="vertical-divider" />
            <span>{region}</span>
            <ChevronRight size={12} />
            <span>{month ? MONTHS[month - 1] : "Full year"}</span>
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
                Show full year <X size={12} />
              </button>
            )}
            <YearSelector year={year} onChange={changeYear} />
          </div>
        </div>
        {error ? (
          <div className="load-state" role="alert">
            <h2>Unable to load the observatory</h2>
            <p>{error}</p>
            <button
              className="outline-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className="load-state">
            <Radio size={28} className="loading-icon" />
            <h2>Preparing the observatory</h2>
            <p>
              Loading province boundaries and reproducible demo observations…
            </p>
          </div>
        ) : (
          <>
            <div className="metrics">
              <Metric
                label={
                  layer === "Harmonized"
                    ? "Harmonized observations"
                    : `${layer} detections`
                }
                value={number(selectedActivity.length)}
                icon={<Flame size={17} />}
                sub={
                  layer === "Harmonized"
                    ? `${number(selectedRaw.length)} source detections`
                    : "Satellite observations"
                }
                detail="Not individual fire incidents"
                spark={counts}
              />
              <Metric
                label="High confidence"
                value={number(high)}
                icon={<ShieldCheck size={17} />}
                sub={`${highPercent}% of selected observations`}
                detail="Sensor confidence classes"
                progress={highPercent}
              />
              <Metric
                label="Provinces with activity"
                value={number(activeRegions).padStart(2, "0")}
                suffix={region === "Indonesia" ? "/ 38" : "/ 1"}
                icon={<MapPin size={17} />}
                sub={
                  region === "Indonesia"
                    ? "Provinces with detected activity"
                    : region
                }
                detail="Within the selected period"
              />
              <Metric
                label="Densest grid cell"
                value={number(largestCell(selectedActivity))}
                suffix="obs."
                icon={<Grid2X2 size={17} />}
                sub="Maximum observations in a 0.05° cell"
                detail="Spatial density · not a fire perimeter"
              />
            </div>
            <div className="workspace">
              <section className="map-panel">
                <div className="map-heading">
                  <h2>
                    <span className="live-square" /> Activity explorer
                  </h2>
                  <ProvinceSearch
                    regions={data.boundaries.features
                      .map((feature) => feature.properties.PROVINSI)
                      .sort()}
                    ranking={ranking}
                    onSelect={setRegion}
                  />
                  <div>
                    <span className="subtle-tag">{layer.toUpperCase()}</span>
                    <span className="map-hint">
                      Select a province to explore <ArrowUpRight size={12} />
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
              </section>
              <RegionPanel
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
              period={`${month ? MONTHS[month - 1] : "Full year"} ${year}`}
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
                    ? "Annual comparison"
                    : "Historical activity"}
                </h2>
                <span>
                  {region} <span className="divider-dot">/</span> {layer}{" "}
                  <span className="divider-dot">/</span> Full-year analysis
                </span>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  navigate(view === "compare" ? "history" : "compare")
                }
              >
                {view === "compare" ? "Historical insights" : "Compare years"}{" "}
                <ArrowRight size={14} />
              </button>
            </div>
            {view === "compare" && (
              <YearComparison
                records={regionalActivity}
                year={year}
                comparisonYear={comparisonYear}
                onChange={setComparisonYear}
                region={region}
              />
            )}
            <div className="analytics-grid">
              <HotspotTrend
                counts={counts}
                baseline={baseline}
                baselineAvailable={history.some((h) => h.year < year)}
                year={year}
                onMonth={changeMonth}
              />
              <ActivityCalendar
                data={history}
                selectedYear={year}
                onSelect={(y, m) => {
                  changeYear(y);
                  setMonth(m);
                }}
              />
              <FireBrief
                records={regionalActivity}
                year={year}
                region={region}
                onExpand={() => setModal("brief")}
              />
            </div>
            {view === "history" && (
              <section className="card historical-detail">
                <div className="card-heading">
                  <h3>Critical periods · {year}</h3>
                  <span className="subtle-tag">MEAN + 2σ</span>
                </div>
                <p className="helper">
                  Each month compared with the same month in earlier years. At
                  least three baseline years required.
                </p>
                <div className="critical-months">
                  {MONTHS.map((name, i) => {
                    const a = analyze(regionalActivity, year, i + 1, YEARS);
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
                            ? "No baseline"
                            : a.unusual
                              ? "Unusual"
                              : "Typical range"}
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
                <strong>Observations, not incidents.</strong> A hotspot is a
                satellite detection, not an individual fire. All activity shown
                is synthetic demo data.
              </p>
              <button onClick={() => setModal("method")}>
                Data & methodology <ArrowUpRight size={13} />
              </button>
            </div>
          </>
        )}
        <footer>
          <span>
            <span className="footer-brand">BARA.</span> Indonesia hotspot
            observatory · Demo dataset
          </span>
          <span>
            NASA SPACE APPS CHALLENGE 2026 <i /> INDONESIA
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
            BARA / {modal === "method" ? "DATA & METHODOLOGY" : "FIRE BRIEF"}
          </span>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
        </div>
        {modal === "method" ? (
          <>
            <h2>A transparent view of activity.</h2>
            <p className="modal-intro">
              Hackathon MVP · synthetic observations · no live NASA connection
            </p>
            <h3>01 / Source observations</h3>
            <p>
              Deterministic demo records cover 38 provinces and 2020–2025. All
              coordinates are sampled inside the published province polygons.
              The seasonal patterns and counts are invented for demonstration,
              and are not NASA measurements. A hotspot detection is not a fire
              incident; burned area is not calculated.
            </p>
            <h3>02 / Harmonization</h3>
            <p>
              Observations are sorted in UTC. A MODIS detection and a VIIRS
              detection in the same province are paired when they are within{" "}
              <strong>1 km and 60 minutes</strong>. Matching is one-to-one to
              the nearest available observation. Same-sensor detections remain
              separate. Each activity observation retains both source IDs; the
              first observation anchors its location, month, and year.
            </p>
            <p>
              This prototype reduces overlapping observations. It does not
              correct differences in sensor resolution, overpass times, cloud
              cover, or detection sensitivity, and is not a scientifically
              validated long-term harmonized product.
            </p>
            <h3>03 / Confidence & density</h3>
            <p>
              MODIS confidence is grouped as low (&lt;30), nominal (30–79), or
              high (≥80); VIIRS uses its native low, nominal, and high
              categories. No percentage is invented for VIIRS. Paired
              observations use the highest member confidence. The
              high-confidence filter runs before matching. The densest cell is a
              fixed 0.05° geographic grid cell, not a physical fire cluster or
              an equal-area density measure.
            </p>
            <p>
              Overlapping map symbols are consolidated in 0.04° display cells
              using an actual member location and the highest member confidence.
              This keeps the annual map readable without changing analytical
              counts.
            </p>
            <h3>04 / Historical anomalies</h3>
            <p>
              For the selected region, layer, and confidence filter, activity is
              unusual above the historical mean + 2 population standard
              deviations. Baselines use only earlier demo years and the same
              calendar period, with at least three years required. Annual and
              monthly anomalies are calculated separately. A brief is generated
              from these calculations, without AI-generated claims.
            </p>
            <h3>05 / Boundaries & data integration</h3>
            <p>
              The map uses the published{" "}
              <a
                href="https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces"
                target="_blank"
                rel="noreferrer"
              >
                Indonesia 38-province GeoJSON by Deny Herianto{" "}
                <ExternalLink size={12} />
              </a>
              , licensed{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              . The downloaded boundary file is unmodified; ring orientation is
              normalized for rendering. Current boundaries are used for all demo
              years, without historical boundary reconstruction.
            </p>
            <p>
              Real observations can replace the demo through the data-service
              interface. NASA FIRMS credentials and ingestion should run on a
              server.{" "}
              <a
                href="https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html"
                target="_blank"
                rel="noreferrer"
              >
                NASA FIRMS API documentation <ExternalLink size={12} />
              </a>
            </p>
          </>
        ) : (
          <>
            <h2>
              {region} · {year}
            </h2>
            <p className="modal-intro">
              {layer} ·{" "}
              {highOnly ? "High confidence only" : "All confidence classes"} ·
              Full-year analysis · DEMO DATA
            </p>
            <p className="full-brief">
              {buildBrief(regionalActivity, year, region)}
            </p>
            <h3>Highest activity across Indonesia</h3>
            <p className="helper">
              {month ? MONTHS[month - 1] : "Full year"} {year} · {layer}{" "}
              observations
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
              Computed from synthetic data. Anomalies indicate unusual
              observation counts, not verified fire severity.
            </p>
            <button
              className="outline-button"
              onClick={() => setModal("method")}
            >
              View calculation methods <ArrowUpRight size={14} />
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

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Check, Zap } from "lucide-react";
import {
  createPerformanceMonitor,
  deviceHints,
} from "../utils/performanceMonitor";
export type Quality = "high" | "low";
export const qualityDisplay = (quality: Quality) => ({
  animated: quality !== "low",
  detail: quality !== "low",
  maxDpr: quality === "low" ? 1 : 2,
  exaggeration: quality === "low" ? 1 : 1.5,
  fireFps: quality === "low" ? 12 : 24,
  fireCount: quality === "low" ? 6 : 24,
  cell: quality === "low" ? 0.08 : 0.04,
});
const Context = createContext({
  quality: "high" as Quality,
  preference: null as Quality | null,
  setQuality: (_q: Quality) => {},
});
export function QualityProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Quality | null>(() => {
    try {
      const v = localStorage.getItem("siagaapi:quality");
      return v === "high" || v === "low" ? v : null;
    } catch {
      return null;
    }
  });
  const value = useMemo(
    () => ({
      quality: preference ?? "high",
      preference,
      setQuality: (q: Quality) => {
        setPreference(q);
        try {
          localStorage.setItem("siagaapi:quality", q);
        } catch {
          /* Private browsing remains usable. */
        }
      },
    }),
    [preference],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useMapQuality = () => useContext(Context);
export function QualityControl() {
  const { quality, setQuality } = useMapQuality();
  const active = quality === "low";
  return (
    <div className="quality-control">
      <button
        type="button"
        className="quality-toggle"
        aria-pressed={active}
        title={
          active ? "Nonaktifkan kualitas rendah" : "Aktifkan kualitas rendah"
        }
        onClick={() => setQuality(active ? "high" : "low")}
      >
        <Zap size={16} aria-hidden="true" />
        <span>Kualitas rendah</span>
        {active && <Check size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
let dismissedInMemory = false;
export function MapPerformance({
  active,
  animating,
}: {
  active: boolean;
  animating: boolean;
}) {
  const { quality, setQuality } = useMapQuality();
  const [suggest, setSuggest] = useState(false);
  const dismissed = useRef(dismissedInMemory);
  useEffect(() => {
    try {
      dismissed.current ||=
        sessionStorage.getItem("siagaapi:lag-dismissed") === "1";
    } catch {}
  }, []);
  useEffect(() => {
    if (!active || quality === "low") return;
    const monitor = createPerformanceMonitor(deviceHints(navigator));
    let frame = 0,
      until = 0,
      moving = false,
      inView = false;
    const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    const tick = (time: number) => {
      frame = 0;
      const running =
        inView &&
        !document.hidden &&
        ((animating && !motionPreference.matches) || moving || time < until);
      const result = monitor.sample(time, running);
      if (result.notify && !dismissed.current) setSuggest(true);
      if (running) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      until = performance.now() + 3500;
      if (!frame && !document.hidden && inView)
        frame = requestAnimationFrame(tick);
    };
    const motion = (event: Event) => {
      moving = !!(event as CustomEvent).detail;
      start();
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      monitor.sample(performance.now(), false);
      if (!document.hidden && (animating || moving)) start();
    };
    const map = document.querySelector(".atlas-map");
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView && animating && !motionPreference.matches) start();
      else if (!inView) {
        cancelAnimationFrame(frame);
        frame = 0;
        monitor.sample(performance.now(), false);
      }
    });
    if (map) observer.observe(map);
    map?.addEventListener("pointerdown", start);
    map?.addEventListener("wheel", start);
    map?.addEventListener("siaga-map-motion", motion);
    document.addEventListener("visibilitychange", visibility);
    if (animating) start();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      map?.removeEventListener("pointerdown", start);
      map?.removeEventListener("wheel", start);
      map?.removeEventListener("siaga-map-motion", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, animating, quality]);
  if (!active || quality === "low" || !suggest || dismissed.current)
    return null;
  return (
    <aside className="lag-banner" role="status">
      <p>Perangkat terasa berat. Aktifkan mode kualitas rendah?</p>
      <button
        onClick={() => {
          setQuality("low");
          setSuggest(false);
        }}
      >
        Aktifkan
      </button>
      <button
        onClick={() => {
          dismissed.current = dismissedInMemory = true;
          setSuggest(false);
          try {
            sessionStorage.setItem("siagaapi:lag-dismissed", "1");
          } catch {}
        }}
      >
        Tidak, terima kasih
      </button>
    </aside>
  );
}

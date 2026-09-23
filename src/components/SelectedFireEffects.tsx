import { useEffect } from "react";
import { Marker, type Map as TerrainMap } from "maplibre-gl";
import type { Hotspot } from "../types";
import "../selected-fire.css";
import { createFireRenderer, fireCanvasSize } from "./fireRenderer";

export function selectedFireSites(records: Hotspot[], selected: string) {
  const occupied = new Set<string>();
  return records
    .filter((r) => r.province === selected)
    .sort(
      (a, b) =>
        Number(b.confidence === "high") - Number(a.confidence === "high") ||
        a.id.localeCompare(b.id),
    )
    .filter((r) => {
      const cell = `${Math.floor(r.longitude / 0.16)}:${Math.floor(r.latitude / 0.16)}`;
      if (occupied.has(cell)) return false;
      occupied.add(cell);
      return true;
    })
    .slice(0, 24);
}

// Decorative observation symbols only: sizes and animation do not encode
// fire severity, burned area, plume measurements, or incident counts.
export default function SelectedFireEffects({
  map,
  records,
  selected,
  visible,
}: {
  map: TerrainMap | null;
  records: Hotspot[];
  selected: string;
  visible: boolean;
}) {
  useEffect(() => {
    if (!map || !visible || selected === "Indonesia") return;
    const sites = selectedFireSites(records, selected);
    if (!sites.length) return;
    const renderer = createFireRenderer();
    const canvases: CanvasRenderingContext2D[] = [];
    const markers = sites.map((record, index) => {
      const element = document.createElement("div");
      element.className = "selected-fire-anchor";
      element.setAttribute("aria-hidden", "true");
      element.dataset.province = record.province;
      element.dataset.observation = record.id;
      element.dataset.renderer = renderer.engine;
      const effect = document.createElement("div");
      effect.className = "selected-fire-effect";
      const glow = document.createElement("div");
      glow.className = "fire-contact-glow";
      const canvas = document.createElement("canvas");
      canvas.className = "fire-fluid";
      canvas.width = fireCanvasSize.width;
      canvas.height = fireCanvasSize.height;
      const ctx = canvas.getContext("2d");
      if (ctx) canvases[index] = ctx;
      effect.append(glow, canvas);
      element.append(effect);
      return new Marker({
        element,
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
        opacityWhenCovered: 0,
      })
        .setLngLat([record.longitude, record.latitude])
        .addTo(map);
    });
    let active = sites.map(() => true);
    const resize = () => {
      const scale = Math.max(
        0.32,
        Math.min(1.4, 0.3 + (map.getZoom() - 5) * 0.18),
      );
      const container = map.getContainer();
      active = sites.map((site) => {
        const point = map.project([site.longitude, site.latitude]);
        return (
          point.x > -140 &&
          point.x < container.clientWidth + 140 &&
          point.y > -40 &&
          point.y < container.clientHeight + 200
        );
      });
      const bearing = (map.getBearing() * Math.PI) / 180;
      markers.forEach((marker, index) => {
        const site = sites[index];
        const latitudeScale = Math.cos((site.latitude * Math.PI) / 180);
        const step = 0.0005;
        // Project a short east/north segment along camera-right. Its horizontal
        // size gives perspective at this terrain location, including distance.
        const dx = (Math.cos(bearing) * step) / latitudeScale;
        const dy = -Math.sin(bearing) * step;
        const left = map.project([site.longitude - dx, site.latitude - dy]);
        const right = map.project([site.longitude + dx, site.latitude + dy]);
        const flatSpan =
          (2 * 512 * 2 ** map.getZoom() * step) / (360 * latitudeScale);
        const perspective = Math.max(
          0.2,
          Math.min(1.8, Math.abs(right.x - left.x) / flatSpan),
        );
        marker
          .getElement()
          .style.setProperty("--fire-scale", String(scale * perspective));
        marker
          .getElement()
          .style.setProperty(
            "--ground-depth",
            String(Math.max(0.25, Math.cos((map.getPitch() * Math.PI) / 180))),
          );
        marker.getElement().dataset.pitch = String(Math.round(map.getPitch()));
      });
    };
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = -Infinity;
    let inView = true;
    let reducedMotion = motion.matches;
    const draw = (now: number) => {
      if (now - previous >= 1000 / 24 || reducedMotion) {
        const drawable = canvases
          .map((ctx, index) => ({ ctx, index }))
          .filter(
            ({ index }) =>
              active[index] &&
              !markers[index]
                .getElement()
                .classList.contains("maplibregl-marker-covered"),
          );
        if (drawable.length) {
          renderer.render(reducedMotion ? 3.5 : now / 1000, map.getPitch());
          drawable.forEach(({ ctx, index }) => renderer.paint(ctx, index % 4));
        }
        previous = now;
      }
      if (!reducedMotion && !document.hidden && inView)
        frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      markers.forEach(
        (m) =>
          (m.getElement().dataset.motion = reducedMotion
            ? "still"
            : "animated"),
      );
      if (!document.hidden && inView) {
        previous = -Infinity;
        draw(performance.now());
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      resume();
    });
    observer.observe(map.getContainer());
    document.addEventListener("visibilitychange", resume);
    const syncMotion = () => {
      const next = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (next !== reducedMotion) {
        reducedMotion = next;
        resume();
      }
    };
    motion.addEventListener("change", syncMotion);
    // Some embedded/headless browsers update matches without dispatching change.
    // Polling this boolean also allows a paused renderer to resume, without RAF.
    const motionCheck = window.setInterval(syncMotion, 500);
    resize();
    resume();
    const cameraChanged = () => {
      resize();
      if (reducedMotion) resume();
    };
    map.on("move", cameraChanged);
    map.on("resize", cameraChanged);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", syncMotion);
      window.clearInterval(motionCheck);
      renderer.dispose();
      map.off("move", cameraChanged);
      map.off("resize", cameraChanged);
      markers.forEach((marker) => marker.remove());
    };
  }, [map, records, selected, visible]);
  return null;
}

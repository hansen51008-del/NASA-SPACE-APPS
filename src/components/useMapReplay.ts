import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

// Never catch up by skipping months after a slow frame, hidden tab, or worker job.
export function useMapReplay(
  playing: boolean,
  enabled: boolean,
  pending: boolean,
  speed: number,
  setMonth: Dispatch<SetStateAction<number | null>>,
) {
  useEffect(() => {
    if (!playing || !enabled || pending) return;
    const map = document.querySelector(".atlas-map");
    if (!map) return;
    let visible = false,
      frame = 0,
      previous = 0;
    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (!previous) previous = now;
      if (now - previous >= 1300 / speed) {
        setMonth((m) => (m === null || m === 12 ? 1 : m + 1));
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      frame = 0;
      if (visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    observer.observe(map);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [playing, enabled, pending, speed, setMonth]);
}

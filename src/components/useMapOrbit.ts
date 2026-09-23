import { useEffect } from "react";
import type { Map } from "maplibre-gl";

// An explicit one-pointer orbit mode; normal pan and native two-finger gestures
// are restored on exit. Coalesce pointer events to one camera update per frame.
export function useMapOrbit(map: Map | null, enabled: boolean) {
  useEffect(() => {
    if (!map || !enabled) return;
    const canvas = map.getCanvas();
    const handlers = [
      map.dragPan,
      map.dragRotate,
      map.touchZoomRotate,
      map.touchPitch,
    ];
    const previous = handlers.map((handler) => handler.isEnabled());
    handlers.forEach((handler) => handler.disable());
    let drag: {
      id: number;
      x: number;
      y: number;
      bearing: number;
      pitch: number;
    } | null = null;
    let frame = 0;
    let moved = false;
    let target: { bearing: number; pitch: number } | null = null;
    const flush = () => {
      frame = 0;
      if (target) {
        map.jumpTo(target);
        target = null;
      }
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      map.stop();
      moved = false;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      event.preventDefault();
      target = {
        bearing: drag.bearing + dx * 0.45,
        pitch: Math.max(0, Math.min(75, drag.pitch - dy * 0.25)),
      };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      cancelAnimationFrame(frame);
      flush();
      if (canvas.hasPointerCapture(drag.id))
        canvas.releasePointerCapture(drag.id);
      drag = null;
      canvas.style.cursor = "grab";
    };
    const click = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopImmediatePropagation();
        moved = false;
      }
    };
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    canvas.addEventListener("click", click, true);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("click", click, true);
      if (drag && canvas.hasPointerCapture(drag.id))
        canvas.releasePointerCapture(drag.id);
      canvas.style.cursor = "";
      handlers.forEach((handler, index) => {
        if (previous[index]) handler.enable();
      });
    };
  }, [map, enabled]);
}

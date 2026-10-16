import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Flame } from "lucide-react";
import "./AppIntro.css";

const SESSION_KEY = "siagaapi:intro-seen";

function shouldShowIntro() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

export default function AppIntro({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(shouldShowIntro);
  const content = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);

  function dismiss() {
    moveFocus.current = true;
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // The intro still closes when browser storage is unavailable.
    }
  }

  useEffect(() => {
    if (!visible) {
      if (moveFocus.current) content.current?.focus({ preventScroll: true });
      return;
    }
    intro.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(dismiss, 1400);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <>
      <div
        ref={content}
        className="app-content"
        data-intro={visible}
        inert={visible}
        aria-hidden={visible || undefined}
        tabIndex={-1}
      >
        {children}
      </div>
      {visible && (
        <section
          ref={intro}
          tabIndex={-1}
          className="app-intro"
          aria-label="Pembuka SiagaApi"
          onKeyDown={(event) => {
            if (event.key === "Escape") dismiss();
          }}
        >
          <div className="app-intro-brand">
            <span className="app-intro-mark" aria-hidden="true">
              <Flame size={42} fill="currentColor" strokeWidth={1.5} />
            </span>
            <h1>SiagaApi</h1>
            <p>Kenali risiko. Siapkan langkah.</p>
            <span className="app-intro-rule" aria-hidden="true" />
          </div>
          <div className="app-intro-footer">
            <span>Kesiapsiagaan karhutla</span>
            <button onClick={dismiss}>
              Lanjut ke Beranda <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}

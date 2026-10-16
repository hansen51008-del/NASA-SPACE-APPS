import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Flame } from "lucide-react";
import { startIntroSound } from "./introSound";
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
    const stopSound = startIntroSound();
    const timer = window.setTimeout(dismiss, 2400);
    return () => {
      window.clearTimeout(timer);
      stopSound();
    };
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
              <span className="app-intro-glow" />
              <span className="app-intro-blast" />
              <span className="app-intro-burst">
                {Array.from({ length: 18 }, (_, index) => (
                  <i
                    key={index}
                    style={
                      {
                        "--i": index,
                        "--drift": `${(index % 2 ? 1 : -1) * (24 + ((index * 37) % 112))}px`,
                        "--rise": `${130 + ((index * 31) % 150)}px`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
              <Flame
                className="app-intro-final-flame"
                size={54}
                fill="currentColor"
                strokeWidth={1.5}
              />
              <span className="app-intro-fire">
                <svg
                  className="app-intro-flame"
                  viewBox="0 0 120 160"
                  fill="none"
                >
                  <defs>
                    <linearGradient
                      id="intro-fire-outer"
                      x1="60"
                      y1="10"
                      x2="60"
                      y2="155"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#ffd193" />
                      <stop offset=".4" stopColor="#ff982f" />
                      <stop offset="1" stopColor="#dc461e" />
                    </linearGradient>
                    <linearGradient
                      id="intro-fire-inner"
                      x1="60"
                      y1="65"
                      x2="60"
                      y2="155"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#fff2cb" />
                      <stop offset="1" stopColor="#ffb44c" />
                    </linearGradient>
                  </defs>
                  <path
                    className="intro-flame-left"
                    fill="#ec6d28"
                    d="M51 149C13 148 5 120 18 99C25 86 31 80 25 59C48 75 50 92 45 108C61 97 70 124 51 149Z"
                  />
                  <path
                    className="intro-flame-right"
                    fill="#f58e35"
                    d="M68 150C99 147 114 127 104 103C97 85 83 76 91 48C69 67 67 89 74 104C53 106 49 140 68 150Z"
                  />
                  <path
                    className="intro-flame-outer"
                    fill="url(#intro-fire-outer)"
                    d="M60 153C25 153 16 130 24 108C32 88 51 78 48 59C46 42 54 22 70 6C60 35 85 45 82 66C79 82 65 92 73 107C79 98 85 95 86 85C111 119 98 153 60 153Z"
                  />
                  <path
                    className="intro-flame-inner"
                    fill="url(#intro-fire-inner)"
                    d="M60 151C39 151 35 132 44 115C52 103 64 92 61 75C80 93 76 110 68 122C77 118 81 110 81 110C92 134 78 151 60 151Z"
                  />
                  <path
                    className="intro-flame-core"
                    fill="#fff1c9"
                    d="M61 149C48 148 47 137 54 128C59 121 63 119 65 112C75 127 75 145 61 149Z"
                  />
                </svg>
                {Array.from({ length: 8 }, (_, index) => (
                  <i
                    key={index}
                    className="app-intro-ember"
                    style={{ "--i": index } as CSSProperties}
                  />
                ))}
              </span>
            </span>
            <h1 aria-label="SiagaApi">
              {Array.from("SiagaApi", (letter, index) => (
                <span
                  aria-hidden="true"
                  key={index}
                  style={{ "--i": index } as CSSProperties}
                >
                  {letter}
                </span>
              ))}
            </h1>
          </div>
        </section>
      )}
    </>
  );
}

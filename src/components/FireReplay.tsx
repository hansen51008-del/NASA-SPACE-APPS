import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { MONTHS, number } from "../types";
interface Props {
  month: number | null;
  setMonth: (month: number | null) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  counts: number[];
  speed: number;
  setSpeed: (speed: number) => void;
  year: number;
}
export default function FireReplay({
  month,
  setMonth,
  playing,
  setPlaying,
  counts,
  speed,
  setSpeed,
  year,
}: Props) {
  return (
    <div className="replay">
      <div className="replay-header">
        <span className="eyebrow">
          <span className="tiny-orange" /> PUTAR ARSIP DEMO
        </span>
        <div className="replay-period">
          <strong>
            {month ? `${MONTHS[month - 1]} ${year}` : `Jan – Des ${year}`}
          </strong>
          <span>
            {number(
              month ? counts[month - 1] : counts.reduce((sum, n) => sum + n, 0),
            )}{" "}
            observasi
          </span>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setPlaying(false);
            setMonth(null);
          }}
        >
          <RotateCcw size={12} /> Atur ulang
        </button>
      </div>
      <div className="replay-track">
        <div className="play-controls">
          <button
            className="step-button"
            aria-label="Bulan sebelumnya"
            onClick={() => {
              setPlaying(false);
              setMonth(month === null || month === 1 ? 12 : month - 1);
            }}
          >
            <SkipBack size={13} />
          </button>
          <button
            className={`play-button ${playing ? "playing" : ""}`}
            aria-label={playing ? "Jeda pemutaran" : "Putar arsip demo"}
            onClick={() => {
              if (!playing && month === null) setMonth(1);
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
          <button
            className="step-button"
            aria-label="Bulan berikutnya"
            onClick={() => {
              setPlaying(false);
              setMonth(month === null || month === 12 ? 1 : month + 1);
            }}
          >
            <SkipForward size={13} />
          </button>
        </div>
        <div className="month-track">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              aria-label={`Tampilkan ${m}`}
              aria-pressed={month === i + 1}
              title={`${m} ${year} · ${number(counts[i])} observasi`}
              className={`month-button ${month === i + 1 ? "active" : ""}`}
              onClick={() => {
                setPlaying(false);
                setMonth(i + 1);
              }}
            >
              <span
                className="timeline-bar"
                style={{
                  height: `${8 + (counts[i] / Math.max(1, ...counts)) * 32}px`,
                }}
              />
              <span>{m}</span>
            </button>
          ))}
        </div>
        <button
          className="speed-button"
          aria-label="Ubah kecepatan pemutaran"
          onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
        >
          {speed}×
        </button>
      </div>
    </div>
  );
}

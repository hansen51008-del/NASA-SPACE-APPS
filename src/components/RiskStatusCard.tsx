import { ShieldCheck } from "lucide-react";
import type { RiskIndicator } from "../services/riskService";

export default function RiskStatusCard({
  risk,
  region,
}: {
  risk: RiskIndicator;
  region: string;
}) {
  return (
    <section
      className={`card risk-status risk-${risk.level?.toLowerCase() ?? "unknown"}`}
      aria-labelledby="risk-title"
    >
      <div className="card-heading">
        <h2 id="risk-title">
          <ShieldCheck size={20} /> Indikator risiko
        </h2>
        <span className="subtle-tag">PROTOTYPE</span>
      </div>
      <p className="risk-region">
        {region} · {risk.period}
      </p>
      <div className="risk-score" aria-live="polite">
        <strong>{risk.level ?? "Belum dapat dinilai"}</strong>
        <span>
          {risk.score ?? "—"}
          <small> / 100</small>
        </span>
      </div>
      {risk.level === "Aman" && (
        <p className="safe-status-copy">
          Aktivitas satelit rendah — tetap pantau arahan resmi.
        </p>
      )}
      <div
        className="risk-meter"
        role="meter"
        aria-label="Skor indikator risiko"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={risk.score ?? undefined}
        aria-valuetext={
          risk.score === null ? "Belum dapat dinilai" : String(risk.score)
        }
      >
        <i style={{ width: `${risk.score ?? 0}%` }} />
      </div>
      <p className="risk-caution">{risk.note}</p>
      <details>
        <summary>Cara membaca skor</summary>
        <dl className="risk-factors">
          <div>
            <dt>Observasi satelit gabungan</dt>
            <dd>
              {risk.days
                ? risk.count.toLocaleString("id-ID")
                : "Belum dapat dinilai"}
            </dd>
          </div>
          <div>
            <dt>Keyakinan tinggi</dt>
            <dd>
              {risk.days
                ? risk.high.toLocaleString("id-ID")
                : "Belum dapat dinilai"}
            </dd>
          </div>
          <div>
            <dt>Perubahan dari rata-rata sebelumnya</dt>
            <dd>
              {risk.change === null
                ? "Belum tersedia"
                : `${risk.change >= 0 ? "+" : ""}${risk.change.toFixed(0)}%`}
            </dd>
          </div>
          <div>
            <dt>Cuaca</dt>
            <dd>Belum tersedia · tidak dihitung</dd>
          </div>
        </dl>

        <p>
          Rumus prototype: min(50, observasi/hari × 10) + min(30, keyakinan
          tinggi/hari × 10) + min(20, kenaikan positif % ÷ 5). Pembagi:{" "}
          {risk.days} hari dalam cakupan. Kontribusi:{" "}
          {risk.points.activity.toFixed(1)} +{" "}
          {risk.points.confidence.toFixed(1)} +{" "}
          {risk.points.increase.toFixed(1)}.
        </p>
        <p>
          Aman 0–29, Waspada 30–59, Siaga 60–100. Ambang heuristik ini belum
          dikalibrasi sebagai penilaian keselamatan. Skor nasional tidak setara
          dengan risiko personal atau skor provinsi. Filter sensor/keyakinan
          hanya mengubah eksplorasi peta.
        </p>
      </details>
    </section>
  );
}

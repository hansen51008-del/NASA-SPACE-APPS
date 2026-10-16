import { FileText } from "lucide-react";
import { riskBrief } from "../services/riskService";
import type { RiskIndicator } from "../services/riskService";

export default function RiskBrief({
  risk,
  region,
  onExpand,
}: {
  risk: RiskIndicator;
  region: string;
  onExpand: () => void;
}) {
  return (
    <section className="card risk-brief">
      <div className="card-heading">
        <h3>
          <FileText size={17} /> Mengapa status ini?
        </h3>
      </div>
      <p>
        {risk.score === null
          ? `${region} belum dapat dinilai. ${risk.note}`
          : `${region}: ${risk.count.toLocaleString("id-ID")} observasi satelit, termasuk ${risk.high.toLocaleString("id-ID")} berkeyakinan tinggi, menjadi dasar indikator risiko.`}
      </p>
      <details className="brief-details">
        <summary>Penjelasan lengkap</summary>
        <p>{riskBrief(risk, region)}</p>
      </details>
      <p className="helper">
        Indikator aktivitas satelit, bukan prediksi pasti atau peringatan resmi.
      </p>
      <button className="text-button" onClick={onExpand}>
        Baca ringkasan & observasi →
      </button>
    </section>
  );
}

import { FileText } from "lucide-react";
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
      <button className="text-button" onClick={onExpand}>
        Baca ringkasan & observasi →
      </button>
    </section>
  );
}

import { Layers } from "lucide-react";
import type { Layer } from "../types";
export default function LayerSelector({
  value,
  onChange,
}: {
  value: Layer;
  onChange: (layer: Layer) => void;
}) {
  return (
    <section className="layer-section">
      <div className="eyebrow">
        <Layers size={13} /> LAPISAN OBSERVASI
      </div>
      <div className="segmented">
        {(["MODIS", "VIIRS", "Harmonized"] as Layer[]).map((layer) => (
          <button
            key={layer === "Harmonized" ? "Gabungan" : layer}
            onClick={() => onChange(layer)}
            aria-pressed={value === layer}
            className={value === layer ? "active" : ""}
          >
            {layer === "Harmonized" ? "Gabungan" : layer}
          </button>
        ))}
      </div>
      <p className="helper">
        {value === "Harmonized"
          ? "Dua sensor dalam satu tampilan observasi."
          : `${value} dengan kategori keyakinan asli sensor.`}
      </p>
    </section>
  );
}

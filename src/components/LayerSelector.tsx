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
        <Layers size={13} /> OBSERVATION LAYER
      </div>
      <div className="segmented">
        {(["MODIS", "VIIRS", "Harmonized"] as Layer[]).map((layer) => (
          <button
            key={layer}
            onClick={() => onChange(layer)}
            aria-pressed={value === layer}
            className={value === layer ? "active" : ""}
          >
            {layer}
          </button>
        ))}
      </div>
      <p className="helper">
        {value === "Harmonized"
          ? "Two sensors. One consistent activity view."
          : `${value} detections with native confidence preserved.`}
      </p>
    </section>
  );
}

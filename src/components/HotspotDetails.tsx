import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Activity, Hotspot } from "../types";
import WeatherContext from "./WeatherContext";
export default function HotspotDetails({
  record,
  onClose,
}: {
  record: Hotspot;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, [record.id]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  const activity = record as Partial<Activity>;
  const members = activity.members ?? [record];
  return (
    <section
      className="observation-details"
      role="region"
      aria-label="Rincian observasi"
    >
      <header>
        <div>
          <small>
            {record.isDemo ? "OBSERVASI DEMO" : "OBSERVASI SATELIT"}
          </small>
          <h3>{record.province}</h3>
        </div>
        <button
          ref={close}
          onClick={onClose}
          aria-label="Tutup rincian observasi"
        >
          <X size={18} />
        </button>
      </header>
      <p>
        {members.length > 1
          ? "Observasi MODIS + VIIRS yang dipasangkan"
          : `Observasi ${record.source}`}{" "}
        ·{" "}
        {
          { low: "rendah", nominal: "nominal", high: "tinggi" }[
            record.confidence
          ]
        }{" "}
        (keyakinan)
      </p>
      <p>
        {record.latitude.toFixed(5)}°, {record.longitude.toFixed(5)}°
      </p>
      {activity.matchMinutes !== undefined && (
        <p className="observation-match">
          Jarak pasangan: {activity.matchDistanceKm?.toFixed(3)} km /{" "}
          {activity.matchMinutes.toFixed(0)} menit. Wilayah dan periode
          mengikuti observasi lebih awal.
        </p>
      )}
      <details className="observation-source">
        <summary>Detail observasi & sensor</summary>
        {members.map((member) => (
          <dl key={member.id}>
            <dt>Sensor / satelit</dt>
            <dd>
              {member.source} / {member.satellite ?? "Tidak tersedia"}
            </dd>
            <dt>Waktu pengamatan (UTC)</dt>
            <dd>{member.date.replace("T", " ").replace(".000Z", " UTC")}</dd>
            <dt>Keyakinan asli sensor</dt>
            <dd>
              {member.nativeConfidence} (
              {
                { low: "rendah", nominal: "nominal", high: "tinggi" }[
                  member.confidence
                ]
              }
              )
            </dd>
            <dt>Lokasi</dt>
            <dd>
              {member.latitude.toFixed(5)}, {member.longitude.toFixed(5)} ·{" "}
              {member.province}
            </dd>
            <dt>Kecerahan</dt>
            <dd>
              {member.brightness === undefined
                ? "Tidak tersedia"
                : `${member.brightness} K (${member.source === "VIIRS" ? "I4" : "21/22"})`}
            </dd>
            <dt>FRP</dt>
            <dd>
              {member.frp === undefined ? "Tidak tersedia" : `${member.frp} MW`}
            </dd>
            <dt>Sumber</dt>
            <dd>
              {member.provenance
                ? `${member.provenance.file}, baris ${member.provenance.row}`
                : "Generator demo sintetis"}
              {member.version ? ` · ${member.version}` : ""}
            </dd>
          </dl>
        ))}
      </details>
      <p className="helper">
        Deteksi bukan kejadian kebakaran. Ukuran simbol api tidak mengukur
        tingkat keparahan atau luas terbakar.
      </p>
      <WeatherContext
        key={record.id}
        latitude={record.latitude}
        longitude={record.longitude}
      />
    </section>
  );
}

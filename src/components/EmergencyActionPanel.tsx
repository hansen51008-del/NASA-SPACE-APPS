import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { RiskLevel } from "../services/riskService";

const steps = {
  Aman: [
    "Hindari pembakaran terbuka saat membersihkan lahan.",
    "Diskusikan rencana komunikasi keluarga.",
    "Pantau informasi karhutla dari BPBD/pemerintah setempat.",
  ],
  Waspada: [
    "Siapkan masker, dokumen penting, dan obat pribadi.",
    "Periksa air minum, senter, dan daya ponsel.",
    "Pantau informasi resmi dan kebutuhan anggota keluarga.",
  ],
  Siaga: [
    "Siapkan tas berisi dokumen, obat pribadi, masker, dan air minum.",
    "Pastikan semua anggota keluarga dapat dihubungi.",
    "Konfirmasi tempat tujuan dan akses yang aman kepada petugas setempat.",
    "Ikuti arahan evakuasi resmi bila diberikan.",
  ],
};

export default function EmergencyActionPanel({
  level,
  region,
}: {
  level: RiskLevel | null;
  region: string;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [requested, setRequested] = useState(false);
  const actions = steps[level ?? "Waspada"];
  return (
    <section className="card emergency-panel">
      <div className="card-heading">
        <h2>
          <ClipboardCheck size={20} /> Langkah warga
        </h2>
        <span className="subtle-tag">{level ?? "TETAP WASPADA"}</span>
      </div>
      <p>
        {level === "Siaga"
          ? "Persiapkan keluarga. Utamakan arahan resmi di lapangan."
          : level === "Aman"
            ? "Pencegahan dimulai dari kebiasaan sehari-hari."
            : "Periksa kesiapan sebelum kondisi berubah."}
      </p>
      <div className="emergency-checklist">
        {actions.map((action) => (
          <label key={action}>
            <input
              type="checkbox"
              checked={checked.includes(action)}
              onChange={(e) =>
                setChecked((old) =>
                  e.target.checked
                    ? [...old, action]
                    : old.filter((a) => a !== action),
                )
              }
            />
            <span>{action}</span>
          </label>
        ))}
      </div>
      {level === "Siaga" && (
        <>
          <div className="safe-point-demo">
            <strong>
              Simulasi titik aman — perlu verifikasi dengan BPBD/pemerintah
              setempat
            </strong>
            <p>
              Wilayah latihan:{" "}
              {region === "Indonesia"
                ? "pilih provinsi untuk konteks setempat"
                : region}
              .
            </p>
            <p>
              Titik A: tempat berkumpul keluarga (contoh fiktif). Titik B:
              tempat penerimaan warga yang harus dikonfirmasi petugas. Tidak ada
              alamat atau jalur yang telah diverifikasi.
            </p>
            <ol>
              <li>Sepakati kontak keluarga dan calon tempat berkumpul.</li>
              <li>Konfirmasi keamanan tujuan serta akses dengan petugas.</li>
              <li>
                Ikuti rencana dan arahan resmi; diagram latihan ini bukan rute
                evakuasi.
              </li>
            </ol>
          </div>
          <button
            className="outline-button help-simulation"
            onClick={() => setRequested(true)}
          >
            Lihat simulasi rencana bantuan
          </button>
          {requested && (
            <p className="risk-caution" role="status">
              Simulasi selesai. Tidak ada laporan atau permintaan bantuan yang
              dikirim. Untuk keadaan nyata, hubungi layanan darurat/BPBD
              setempat melalui kanal resmi.
            </p>
          )}
        </>
      )}
      <a
        className="text-button"
        href="https://bnpb.go.id/storage/app/media/Buku%20BNPB/Buku%20Saku%20Bencana%20BNPB.pdf"
        target="_blank"
        rel="noreferrer"
      >
        Rujukan kesiapsiagaan BNPB ↗
      </a>
      <p className="helper">
        Checklist tersimpan hanya selama panel ini dibuka. Jangan menunggu skor
        aplikasi jika ada bahaya nyata.
      </p>
    </section>
  );
}

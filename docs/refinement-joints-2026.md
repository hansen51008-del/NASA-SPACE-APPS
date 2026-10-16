# Refinement SiagaApi untuk JOINTS 2026

## Hasil

- Mode FIRMS langsung memilih **Seluruh cakupan cache**. Opsi bulan di luar cakupan dinonaktifkan, disertai penjelasan; handler juga menolak pemilihan periode yang tidak tersedia. Seluruh cakupan tetap benar bila cache melintasi pergantian bulan/tahun.
- Replay bulanan, kalender historis, perbandingan tahun, dan grafik 12 bulan tetap tersedia di Mode Demo. Mode FIRMS menggunakan grafik harian yang hanya memuat tanggal dalam cache, tanpa mengisi bulan lain dengan nol.
- Status di luar cakupan tetap **Belum dapat dinilai**. Status Aman disertai “Aktivitas satelit rendah — tetap pantau arahan resmi.”
- CTA menjadi tombol sekunder **Lihat simulasi rencana bantuan**. Penjelasan bahwa bantuan/titik aman adalah simulasi dan memerlukan konfirmasi pihak setempat tetap ada.
- Kontrol, label aksesibilitas, ringkasan, pengaturan peta, modal metode, nama bulan, dan format angka diselaraskan ke Indonesia. Nama produk serta atribusi sumber/lisensi dipertahankan.
- Mobile mengurutkan indikator → alasan → langkah warga → peta → analitik. Select dan tombol utama memiliki tinggi minimal 44 px, teks navigasi tetap terlihat, serta jarak kartu dirapatkan. Desktop mempertahankan dua kolom ringkasan dan langkah warga.

## File yang berubah dalam refinement ini

| Bagian | File |
| --- | --- |
| Integrasi dan tampilan | `src/App.tsx`, `src/types.ts`, `src/siaga.css` |
| Cakupan periode | **Baru:** `src/services/coveragePeriod.ts`, `src/components/CacheActivity.tsx`; diperbarui: `src/services/riskService.ts` |
| Bahasa keluaran analisis | `src/services/anomalyService.ts` (hanya teks saat tidak ada aktivitas) |
| Kesiapsiagaan | `src/components/RiskStatusCard.tsx`, `src/components/EmergencyActionPanel.tsx` |
| Kontrol dan analitik demo | `src/components/ActivityCalendar.tsx`, `src/components/FireBrief.tsx`, `src/components/FireReplay.tsx`, `src/components/HotspotTrend.tsx`, `src/components/YearComparison.tsx`, `src/components/YearSelector.tsx` |
| Bahasa peta dan wilayah | `src/components/HotspotDetails.tsx`, `src/components/IndonesiaMap.tsx`, `src/components/LayerSelector.tsx`, `src/components/ProvinceSearch.tsx`, `src/components/RegionLeaders.tsx`, `src/components/RegionPanel.tsx`, `src/components/TerrainMap.tsx` |
| Pengujian | **Baru:** `tests/coverage-period.test.ts`; diperbarui: `tests/siaga-browser.mjs`, `tests/browser.mjs`, `tests/camera-browser.mjs`, `tests/terrain-browser.mjs`, `tests/terrain-lighting-browser.mjs`, `tests/terrain-loading-browser.mjs` |
| Dokumentasi | `README.md`, `docs/siagaapi-setup.md`, dokumen ini |

Perubahan pada test kamera/terrain menyesuaikan selector dan teks ke label Indonesia. Mekanisme kamera, terrain, layer, dan ekspor CSV tidak diganti.

## Verifikasi

- `npm test`: **4 file, 29 test lulus**; termasuk batas bulan, seluruh cache lintas tahun, dan status tidak tersedia untuk periode di luar cakupan.
- `npm run build`: typecheck TypeScript dan build Vite berhasil. Peringatan ukuran bundle terrain yang sudah ada masih muncul.
- `tests/siaga-browser.mjs`: tiga level, fallback demo, batas pilihan periode, filter layer, checklist, modal, serta layout 360/390/768/1440 px berhasil diperiksa. Cache FIRMS lokal juga berhasil dimuat tanpa sinkronisasi ulang atau penulisan ke cache.
- `tests/browser.mjs`: regresi demo lulus untuk 38 provinsi, pencarian, filter, replay, tooltip, ekspor CSV, perbandingan tahun, ringkasan, anomali, kontrol peta, modal, dan mobile; tidak ada error runtime browser.
- Semua skrip browser yang disesuaikan lolos pemeriksaan sintaks. Suite terrain yang membutuhkan layanan tile eksternal tidak dijalankan ulang secara menyeluruh dalam refinement ini.
- Hash SHA-256 sebelum/sesudah identik untuk `public/data/firms-cache.json`, `src/services/observationProvider.ts`, `scripts/sync-firms.ts`, dan `scripts/run-sync.mjs`. Tidak ada perubahan arsitektur sinkronisasi, kredensial, atau cache.

Pratinjau lokal tersimpan di `test-results/siaga-local-cache-desktop.png` dan `test-results/siaga-local-cache-mobile.png`. Tidak ada commit, push, deploy, atau perubahan visibilitas repo.

# SiagaApi — data dan batas prototype

## Menjalankan

Node.js 20.19+ atau 22.12+ diperlukan. Dari root proyek:

```sh
npm install
npm run dev
npm test
npm run build
```

Di PowerShell gunakan `npm.cmd` jika eksekusi `npm.ps1` diblokir. Cache publik yang disertakan dapat dibaca tanpa key; Mode Demo digunakan bila cache hilang atau tidak valid. Untuk akses ponsel pada Wi-Fi yang sama gunakan `npm run dev:lan` dan alamat Network yang dicetak Vite.

## Mengaktifkan observasi NASA FIRMS

Minta MAP_KEY melalui [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/). Masukkan key sebagai environment variable server **NASA_FIRMS_MAP_KEY**, bukan `VITE_*`, argumen CLI, atau variabel frontend. Jangan commit key atau membagikan tangkapan layar nilainya.

Contoh PowerShell dengan input tersembunyi (key tidak masuk riwayat perintah):

```powershell
$firmsSecret = Read-Host 'NASA FIRMS MAP_KEY' -AsSecureString
$env:NASA_FIRMS_MAP_KEY = [System.Net.NetworkCredential]::new('', $firmsSecret).Password
npm.cmd run sync:firms
Remove-Item Env:NASA_FIRMS_MAP_KEY
npm.cmd run dev
```

Pada server/CI, injeksikan environment variable dari secret manager lalu jalankan `npm run sync:firms`. File `.env` tidak dimuat otomatis oleh skrip ini. Jangan menambahkan key ke source, README, atau cache. Setelah sinkronisasi, muat ulang browser. Untuk distribusi statis, jalankan `npm run build` **setelah** sinkronisasi sehingga cache masuk ke `dist/data/`. Tidak ada deploy otomatis.

## Arsitektur minimal

1. `scripts/run-sync.mjs` membundel skrip TypeScript server ke direktori sementara, menjalankannya, lalu menghapus bundle sementara.
2. `scripts/sync-firms.ts` membaca key dari environment dan mengambil CSV resmi **MODIS_NRT** serta **VIIRS_SNPP_NRT** untuk bounding box Indonesia, selama tiga hari UTC yang telah selesai. Format endpoint dan batas request mengikuti [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/). Ini bukan pengambilan arsip bulanan atau feed langsung.
3. Parser bersama memvalidasi CSV, menormalisasi confidence, menyaring titik di luar poligon Indonesia, menetapkan provinsi, dan mempertahankan produk, satelit, versi, baris sumber, serta waktu observasi. Bila salah satu produk gagal atau baris tidak valid, cache lama tidak diganti.
4. Cache `public/data/firms-cache.json` berisi CSV observasi publik dan metadata waktu/cakupan, **tanpa key maupun URL ber-key**. Cache publik ini sengaja dimasukkan ke commit agar deploy statis memakai observasi nyata meskipun sinkronisasi tidak tersedia. Untuk memperbarui salinan di repositori, jalankan `npm run sync:firms`, periksa bahwa cache hanya berisi data publik, lalu commit ulang cache. Key tetap server-side dan tidak pernah di-commit. File sementara `*.tmp` tetap diabaikan Git. Cache diganti setelah kedua produk tervalidasi; tidak digabung dengan data sintetis.
5. `observationProvider.ts` membaca cache dan menormalisasi observasi ke schema yang sudah digunakan peta. Cache hilang, tidak valid, atau gagal dimuat menghasilkan data sintetis berlabel **Mode Demo**. Tidak ada key = tidak ada request NASA dari skrip. Cache hasil sinkronisasi lama yang masih ada tetap dapat dibaca, dengan waktunya terlihat.

Key tidak pernah dibaca frontend. Error sinkronisasi tidak mencetak URL, key, atau isi respons upstream. Pengujian API menggunakan fixture dan tidak membuktikan request NASA berhasil; keberhasilan nyata baru ditandai saat sinkronisasi dengan key valid selesai.

## Deploy ke Vercel

Konfigurasi `vercel.json` memakai output `dist` dan perintah build berikut, dengan **titik koma**, bukan `&&`:

```sh
npm run sync:firms; npm run build
```

Di dashboard proyek Vercel, tambahkan environment variable server **NASA_FIRMS_MAP_KEY** untuk lingkungan deploy yang digunakan. Nama ini **BUKAN** berawalan `VITE_`. Nilai key hanya tersedia pada proses sinkronisasi server-side, tidak ditulis ke source, Git, frontend, URL aplikasi, cache, atau log.

Setiap deploy ulang menjalankan sinkronisasi untuk memperbarui cache sebelum build. Jika key valid dan request berhasil, hasil baru dipakai dalam artefak statis. Jika sync gagal atau key tidak ada, titik koma memastikan `npm run build` tetap dijalankan, memakai cache publik yang sudah ter-commit sebagai fallback. Jika cache fallback juga hilang atau tidak valid, UI masuk Mode Demo; cache yang terlalu lama tetap mengikuti batas penilaian keselamatan yang dijelaskan di bawah.

Pembaruan cache saat build Vercel hanya berlaku pada artefak deploy itu dan tidak otomatis mengubah Git. Untuk memperbarui fallback di repositori, jalankan `npm run sync:firms` secara lokal, periksa cache, lalu commit ulang. File `.env*`, `node_modules/`, `dist/`, `test-results/`, dan semua `*.tmp` tetap diabaikan Git. Konfigurasi ini tidak menjalankan commit, push, atau deploy dengan sendirinya.

## Indikator risiko yang transparan

Skor bukan peluang kebakaran, prediksi real-time, atau level resmi pemerintah. Seluruh observasi diharmonisasi sebelum pemilihan wilayah, sehingga pasangan lintas provinsi mengikuti observasi lebih awal. Filter layer/confidence hanya memengaruhi eksplorasi, bukan skor warga.

Rumus heuristik prototype:

```text
aktivitas = min(50, observasi gabungan / hari tercakup × 10)
confidence = min(30, observasi confidence tinggi / hari tercakup × 10)
kenaikan = min(20, max(0, kenaikan terhadap baseline dalam persen) / 5)
skor = round(aktivitas + confidence + kenaikan)
Aman: 0–29 | Waspada: 30–59 | Siaga: 60–100
```

Baseline memerlukan sedikitnya tiga tahun sebelumnya untuk periode yang sama. Dataset demo memiliki cakupan sintetis lengkap; cache FIRMS tiga hari tidak memiliki baseline historis, sehingga komponen kenaikan tidak tersedia dan kontribusinya nol. Cuaca belum diintegrasikan dan tidak dihitung. Tidak ada data hujan/angin buatan.

Skor memakai hari yang tersedia dalam pilihan periode, bukan membagi cache tiga hari seolah-olah sebulan penuh. Periode di luar cakupan atau cache yang disinkronkan lebih dari tujuh hari lalu menghasilkan **Belum dapat dinilai**, bukan Aman. Angka nol deteksi tidak menjamin tidak ada kebakaran. Skor nasional/provinsi dipengaruhi luas wilayah dan tidak cocok untuk perbandingan bahaya personal; ambangnya belum dikalibrasi atau divalidasi ilmiah.

Peta, replay, filter, statistik, dan ekspor tetap tersedia. Mode FIRMS langsung memilih seluruh cakupan cache. Bulan tanpa cakupan dinonaktifkan; grafik menampilkan observasi harian hanya pada tanggal yang tercakup. Replay bulanan dan navigasi perbandingan tahun hanya muncul pada Mode Demo. Kalender historis, anomali, dan perbandingan tahunan hanya aktif pada arsip demo lengkap agar hari/tahun tanpa cakupan tidak dianggap nol. Arsip historis nyata dan metadata cakupan lebih lengkap diperlukan untuk mengaktifkannya dengan data nyata.

## Kesiapsiagaan dan keselamatan

Risk Brief berubah mengikuti wilayah, periode, dan skor. Checklist pencegahan/persiapan/darurat mengikuti level dan direset saat konteks berubah. Referensi kebutuhan dasar: [Buku Saku BNPB](https://bnpb.go.id/storage/app/media/Buku%20BNPB/Buku%20Saku%20Bencana%20BNPB.pdf).

**Simulasi titik aman — perlu verifikasi dengan BPBD/pemerintah setempat.** Titik A/B dan langkah evakuasi adalah latihan perencanaan, tanpa lokasi, alamat, atau jalur darurat terverifikasi. Tombol **Lihat simulasi rencana bantuan** hanya menampilkan konfirmasi simulasi; tidak mengirim laporan atau memanggil petugas. Tidak ada notifikasi sungguhan, login, atau backend darurat.

Deteksi satelit bukan kejadian kebakaran yang terkonfirmasi dan tidak mengukur luas terbakar. Label Aman bukan jaminan keselamatan. Pantau BPBD/pemerintah setempat, ikuti arahan resmi, dan jangan menunggu skor aplikasi ketika ada bahaya nyata. Data FIRMS dapat terlambat dan deteksi dipengaruhi tutupan awan serta sensor. SiagaApi bukan produk resmi NASA, BNPB, atau BPBD.

## Verifikasi

`npm test` menguji Aman/Waspada/Siaga, perubahan wilayah/periode, baseline, cache lama, penolakan baris rusak, provenance, fallback tanpa cache, dan kontrak request server melalui fixture.

Untuk uji browser desktop/mobile, jalankan dev server pada port 5175, lalu:

```sh
npm run dev -- --port 5175
# Terminal lain; memerlukan Microsoft Edge terpasang
npm run test:siaga
```

Tes browser menggunakan fixture CSV pada request cache untuk tiga level; fixture ini tidak ditulis ke dataset produksi. Screenshot tersimpan di `test-results/siaga-*.png`.

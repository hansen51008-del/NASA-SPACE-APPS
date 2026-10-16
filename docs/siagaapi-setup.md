# SiagaApi — data dan batas prototype

## Asisten AI (Groq)

Tab Asisten AI menggunakan proxy Node `api/chat.ts` di Vercel. **GROQ_API_KEY** wajib hanya untuk jawaban AI, dan **GROQ_MODEL** opsional (default `openai/gpt-oss-120b`, diverifikasi di [dokumentasi model resmi](https://console.groq.com/docs/model/openai/gpt-oss-120b) pada 16 Oktober 2026). Jangan memakai awalan `VITE_`, memasukkan key ke URL, source, cache, log, screenshot, atau Git. Tanpa key, FAQ/fakta/konteks tetap tersedia dan input menampilkan “Asisten AI sedang tidak tersedia.”

Untuk lokal, simpan environment pada proses server. Contoh PowerShell tanpa menulis nilai key ke riwayat perintah:

```powershell
$siagaChatSecret = Read-Host 'Key Groq' -AsSecureString
$env:GROQ_API_KEY = [System.Net.NetworkCredential]::new('', $siagaChatSecret).Password
$env:GROQ_MODEL = 'openai/gpt-oss-120b'
Remove-Variable siagaChatSecret
npm.cmd run dev
# Setelah server dihentikan:
Remove-Item Env:GROQ_API_KEY
```

Jalankan di folder proyek dan hentikan server lama dengan Ctrl+C dahulu. Saat prompt `Key Groq` muncul, tempel key lalu Enter; input disamarkan dan tidak menjadi perintah dalam riwayat PowerShell. Environment ini berlaku pada terminal tersebut dan proses server yang dijalankannya; ulangi penyiapan bila membuka terminal baru.

GPT-OSS memakai `reasoning_effort: low` dan `include_reasoning: false`; hanya teks jawaban diteruskan ke browser. Batas `max_completion_tokens` mencakup reasoning dan jawaban, sehingga diberi ruang 2.048 token. Completion tanpa teks jawaban ditampilkan sebagai kegagalan yang bisa dicoba ulang, bukan balasan kosong.

Middleware Vite menjalankan handler yang sama di `/api/chat`; `npm run dev`, `dev:lan`, dan `preview` tetap bekerja. Alternatifnya gunakan `.env.local` yang diabaikan Git; middleware hanya membaca variabel berawalan `GROQ_` di Node, tidak menyuntikkannya ke bundle. Restart server setelah mengganti environment. `GET /api/chat` hanya mengembalikan status boolean ketersediaan, tidak key atau model rahasia. `npm run preview -- --port 4173 --strictPort` dapat dipakai untuk menguji UI tanpa key.

Di dashboard Vercel, set `GROQ_API_KEY` dan bila perlu `GROQ_MODEL` untuk environment yang sesuai sebelum deploy berikutnya. `vercel.json` tetap memakai `npm run sync:firms; npm run build` dan `dist`; tidak ada rewrite yang menelan `/api/*`. Vercel menjalankan `api/chat.ts` sebagai fungsi terpisah dari aset statis. Hosting yang hanya menyajikan folder `dist` tidak menyediakan proxy; tab tetap menampilkan keadaan tidak tersedia. Penambahan ini tidak melakukan deploy.

Server mengirim `POST https://api.groq.com/openai/v1/chat/completions`, `stream: true`, Bearer auth, lalu meneruskan hanya delta teks SSE; format mengikuti [Chat Completions](https://console.groq.com/docs/api-reference) dan [streaming resmi](https://console.groq.com/docs/text-chat). Model dapat diganti lewat environment sesuai akses akun, bukan dari browser. Tidak ada akses pencarian web atau alat eksternal dalam percakapan.

Batas yang diterapkan server: 12 pesan riwayat, 2.000 karakter per pesan, total 12.000 karakter, body 50.000 byte, konteks maksimal 2.048 karakter, maksimum 2.048 token completion (termasuk reasoning), timeout 30 detik, serta 8 permintaan per IP per menit. Hanya role user/assistant diterima; system prompt dibuat server dan tidak dapat diganti oleh payload. Origin browser harus sama. Pesan error generik; body error upstream dan isi percakapan tidak dicatat. Batas IP memakai memori proses dan header IP Vercel yang disediakan platform (socket pada lokal); batas ini perkiraan, dapat reset saat cold start dan tidak berlaku global antar-instance. Ini bukan pengganti kuota/budget penyedia atau proteksi edge untuk trafik publik besar.

Kuota dan biaya Groq mengikuti paket akun, model, dan token termasuk riwayat yang dikirim ulang; pantau pemakaian di konsol Groq. Stop meng-abort permintaan server ke upstream tetapi token yang sudah diproses dapat tetap dihitung. Pengujian repo memakai mock saja dan tidak memanggil layanan Groq berbayar. Key valid, akses model, biaya nyata, serta perilaku deploy Vercel memerlukan verifikasi tersendiri.

Privasi: pesan dan ringkasan wilayah/periode/indikator/faktor/sumber/cakupan dikirim ke Groq melalui server aplikasi. Tidak melampirkan observasi mentah maupun lokasi presisi. Riwayat ada di memori halaman, hilang saat muat ulang; aplikasi tidak menyimpan chat di server. Jangan mengirim data pribadi. Perlakuan data oleh penyedia mengikuti kebijakan Groq. Jawaban AI dapat keliru, bukan sumber resmi BNPB/BPBD/NASA; skor tetap heuristik prototype, bukan prediksi. Arahan bahaya mengikuti BPBD/pemerintah dan [112 jika layanan aktif setempat](https://layanan112.komdigi.go.id/faq).

Verifikasi: `npm test`, `npm run build`, lalu preview port 4173 dan `node tests/assistant-browser.mjs`. Browser test memock jawaban streaming, stop/retry, keadaan tanpa key, teks HTML yang harus tetap inert, dan layout 360/1280 px.

## Kualitas peta dan replay

Pilih **Kualitas rendah** pada panel Sensor & filter. Pilihan dibagi antara peta 2D/3D, disimpan di localStorage bila tersedia, dan dapat dikembalikan seketika. Indikator risiko, seluruh observasi analitis, anomali dan CSV tidak disederhanakan. Mode ini memakai DPR 1, maksimum 6 api/12 fps, simbol SVG statis, sel tampilan 0,08°, tanpa detail Sentinel-2/kabut dekoratif dan tanpa transisi kamera terprogram. Budget cache tile bersama diperkecil ke 48 per sumber dan 3 tingkat zoom tanpa membangun ulang peta.

Replay berjalan lewat RAF, menunggu analisis worker dan berhenti ketika halaman/peta tidak terlihat. Monitor lag memakai jendela 3 detik, median dan proporsi frame lambat, pemulihan 2 detik serta cooldown 30 detik. Petunjuk hardwareConcurrency/deviceMemory/Save-Data hanya menurunkan durasi bukti menjadi 2,5 detik; tetap harus ada frame lambat yang terukur. Pengguna mendapat banner opsional dan dapat menolaknya untuk seluruh sesi. Tidak ada pengalihan otomatis atau telemetri. Lihat [hasil pengukuran dan keterbatasan benchmark](./performance.md).

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
6. Analisis tampilan berjalan dalam `analysis.worker.ts`, memakai rumus dan layanan yang sama; cache hasil dibatasi dan memperhitungkan batas kedaluwarsa FIRMS. Kualitas visual tidak menjadi masukan perhitungan.
7. Peta, cache FIRMS, dan berita tetap dapat disajikan statis. **Asisten AI** menambahkan backend terbatas di `api/chat.ts` untuk meneruskan chat ke Groq; bukan backend pelaporan darurat. Tidak ada akun atau database percakapan.

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

Baseline memerlukan sedikitnya tiga tahun sebelumnya untuk periode yang sama. Dataset demo memiliki cakupan sintetis lengkap; cache FIRMS tiga hari tidak memiliki baseline historis, sehingga komponen kenaikan tidak tersedia dan kontribusinya nol. Cuaca Open-Meteo tersedia sebagai konteks terpisah di rincian hotspot dan tidak dihitung dalam skor. Tidak ada data hujan/angin buatan.

Skor memakai hari yang tersedia dalam pilihan periode, bukan membagi cache tiga hari seolah-olah sebulan penuh. Periode di luar cakupan atau cache yang disinkronkan lebih dari tujuh hari lalu menghasilkan **Belum dapat dinilai**, bukan Aman. Angka nol deteksi tidak menjamin tidak ada kebakaran. Skor nasional/provinsi dipengaruhi luas wilayah dan tidak cocok untuk perbandingan bahaya personal; ambangnya belum dikalibrasi atau divalidasi ilmiah.

Peta, replay, filter, statistik, dan ekspor tetap tersedia. Mode FIRMS langsung memilih seluruh cakupan cache. Bulan tanpa cakupan dinonaktifkan; grafik menampilkan observasi harian hanya pada tanggal yang tercakup. Replay bulanan dan navigasi perbandingan tahun hanya muncul pada Mode Demo. Kalender historis, anomali, dan perbandingan tahunan hanya aktif pada arsip demo lengkap agar hari/tahun tanpa cakupan tidak dianggap nol. Arsip historis nyata dan metadata cakupan lebih lengkap diperlukan untuk mengaktifkannya dengan data nyata.

## Kesiapsiagaan dan keselamatan

Risk Brief berubah mengikuti wilayah, periode, dan skor. Checklist pencegahan/persiapan/darurat mengikuti level dan direset saat konteks berubah. Referensi kebutuhan dasar: [Buku Saku BNPB](https://bnpb.go.id/storage/app/media/Buku%20BNPB/Buku%20Saku%20Bencana%20BNPB.pdf).

**Simulasi titik aman — perlu verifikasi dengan BPBD/pemerintah setempat.** Titik A/B dan langkah evakuasi adalah latihan perencanaan, tanpa lokasi, alamat, atau jalur darurat terverifikasi. Tombol **Lihat simulasi rencana bantuan** hanya menampilkan konfirmasi simulasi; tidak mengirim laporan atau memanggil petugas. Tidak ada notifikasi sungguhan, login, atau backend darurat.

Deteksi satelit bukan kejadian kebakaran yang terkonfirmasi dan tidak mengukur luas terbakar. Label Aman bukan jaminan keselamatan. Pantau BPBD/pemerintah setempat, ikuti arahan resmi, dan jangan menunggu skor aplikasi ketika ada bahaya nyata. Data FIRMS dapat terlambat dan deteksi dipengaruhi tutupan awan serta sensor. SiagaApi bukan produk resmi NASA, BNPB, atau BPBD.

## Konteks cuaca Open-Meteo

`src/services/weatherService.ts` meminta endpoint publik `https://api.open-meteo.com/v1/forecast` tanpa API key, hanya saat rincian hotspot dibuka. Parameter: `current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m`, `daily=temperature_2m_max,temperature_2m_min,precipitation_sum`, `past_days=14`, `forecast_days=1`, `timezone=auto`. Satuan ditetapkan ke Celsius, km/jam, dan mm. Respons harus berisi angka finite, 15 tanggal berurutan dengan panjang array konsisten; kegagalan menampilkan status cuaca tidak tersedia tanpa mengubah data hotspot.

Koordinat hotspot dibulatkan ke 2 desimal sebelum request; pilihan lokasi pengguna pada service memakai 1 desimal (fitur Cek jarak belum tersedia). Open-Meteo menerima koordinat yang dibulatkan dan alamat IP koneksi. Cache cuaca terpisah dari cache FIRMS: memori + `sessionStorage` selama 30 menit, dengan kunci koordinat yang dibulatkan. Timeout 8 detik memakai AbortController; menutup rincian membatalkan request. Tidak ada perubahan provider, cache, sinkronisasi, atau rumus risiko NASA FIRMS.

Grafik menampilkan 14 hari yang sudah selesai, sedangkan angka hari ini mencakup satu hari penuh termasuk jam yang belum berlalu. Badge kering memakai hujan <1 mm dari hari terakhir yang selesai, maksimal 14 hari tersedia. Cuaca berasal dari model, bukan pengukuran stasiun; konteks saat ini tidak menggambarkan cuaca pada tanggal hotspot lama dan tidak masuk ke skor. Pada Mode Demo, lokasi hotspot sintetis tetap dilabeli demo, sementara cuaca berasal dari model Open-Meteo.

[Weather data by Open-Meteo.com](https://open-meteo.com). Data berlisensi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); [API gratis dibatasi untuk penggunaan non-komersial](https://open-meteo.com/en/terms). Resolusi model tidak setara titik hotspot: Cuaca model (bukan pengukuran stasiun), ± puluhan km.

Unit test cuaca menggunakan fixture lokal tanpa jaringan. Dengan preview berjalan, jalankan `node tests/weather-browser.mjs` untuk interaksi desktop/mobile dan `node tests/weather-browser.mjs --live` untuk memeriksa request Open-Meteo nyata dari browser (memerlukan jaringan).

## Sinkronisasi berita

```sh
npm run sync:news
npm run build
```

`scripts/run-sync-news.mjs` mengikuti pola bundling esbuild ke direktori sementara dari sinkronisasi FIRMS, tanpa mengubah skrip FIRMS. `scripts/sync-news.ts` membaca konfigurasi `scripts/news-sources.json`; hanya sumber dengan `verified: true` dan `enabled: true` yang diambil. Feed Warta Bumi, Humaniora, dan Terkini ditemukan di [halaman RSS resmi ANTARA](https://www.antaranews.com/rss) dan diverifikasi HTTP 200/XML pada 16 Oktober 2026. BNPB/BMKG belum memiliki endpoint berita yang terverifikasi dalam konfigurasi, sehingga `url: null`, `verified: false`, dan `enabled: false`. Jangan mengisi URL berdasarkan tebakan. Periksa respons RSS/Atom nyata dan catat `discoveryUrl`, `checkedAt`, serta hasil pemeriksaan sebelum mengaktifkan sumber baru.

Parser XML `saxes` hanya dipakai di skrip server; tidak masuk bundle frontend. Setiap sumber dibatasi 15 detik dan 2 MB, tanpa mengikuti redirect; DTD/entity ditolak. Artikel disaring dengan kata kunci, dibersihkan menjadi teks, diberi tag provinsi dari 38 nama wilayah dan alias, lalu dideduplikasi berdasarkan URL normal dan judul. Item tanpa tanggal/tautan valid, tanggal masa depan, atau URL berkredensial dibuang. Ringkasan maksimal 200 karakter berasal dari description/summary feed; content artikel dan gambar tidak diambil. Tautan dan atribusi penerbit tetap tampil.

Cache `public/data/news-cache.json` memuat `schemaVersion`, `fetchedAt`, daftar `sources` dengan status `success`/`failed`/`unverified`/`disabled`, dan maksimal 50 `items` berurutan terbaru. Penulisan memakai file sementara `*.tmp` dan rename setelah validasi. Jika sebagian sumber gagal, cache baru memuat hasil sumber yang berhasil beserta status kegagalan. Jika seluruh sumber gagal atau validasi akhir gagal, cache sebelumnya beserta metadatanya tetap utuh; proses keluar dengan kegagalan generik tanpa mencetak URL ber-key, error upstream, atau respons mentah.

Cache berita publik sengaja disertakan di Git untuk distribusi statis, tanpa kredensial. Setelah sync, periksa hasil lalu perbarui salinan cache pada alur publikasi biasa. Konfigurasi `vercel.json` tetap menjalankan sinkronisasi FIRMS dan build seperti sebelumnya; **sync berita tidak otomatis berjalan pada deploy**. Tidak ada perubahan jadwal deploy atau key FIRMS. Browser hanya meminta cache lokal saat tab Berita dibuka dan melakukan revalidasi HTTP; Coba lagi tidak menyinkronkan feed penerbit.

Pembaruan observasi pada tab Berita memakai dataset yang sudah dimuat dan `calculateRisk`, sehingga pencocokan lintas provinsi, cakupan, skor, dan batas umur tujuh hari tetap sama. Filter wilayah informasi tidak mengubah filter peta atau skor Beranda. Periode mengikuti pilihan aplikasi; label Mode Demo hanya melekat pada observasi sintetis, bukan pada berita penerbit. Tidak ada berita fiktif sebagai pengganti cache yang hilang. Ringkasan otomatis selalu ditandai bukan berita dan bukan konfirmasi kebakaran.

## Verifikasi

`tests/news.test.ts` memakai fixture lokal RSS/Atom dan menguji sanitasi, 38 provinsi, validasi, deduplikasi, batas item, penyimpanan atomik, kegagalan sumber, dan batas risiko. Dengan `npm run preview -- --port 4173`, jalankan `node tests/news-browser.mjs` untuk desktop/mobile; `APP_URL` dapat menunjuk server lokal lain.

`npm test` menguji Aman/Waspada/Siaga, perubahan wilayah/periode, baseline, cache lama, penolakan baris rusak, provenance, fallback tanpa cache, dan kontrak request server melalui fixture.

Untuk uji browser desktop/mobile, jalankan dev server pada port 5175, lalu:

```sh
npm run dev -- --port 5175
# Terminal lain; memerlukan Microsoft Edge terpasang
npm run test:siaga
```

Tes browser menggunakan fixture CSV pada request cache untuk tiga level; fixture ini tidak ditulis ke dataset produksi. Screenshot tersimpan di `test-results/siaga-*.png`.

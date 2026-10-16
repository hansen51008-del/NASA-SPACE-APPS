# SiagaApi

Platform indikator risiko karhutla dan panduan kesiapsiagaan warga Indonesia, dibuat sebagai prototype JOINTS 2026. Kebakaran hutan dan lahan berdampak pada emisi karbon, keanekaragaman hayati, dan kesehatan masyarakat. SiagaApi membantu pengguna memilih wilayah dan periode, membaca observasi MODIS/VIIRS serta alasan indikator risiko, lalu menyiapkan tindakan keluarga.

**Alur utama:** pilih wilayah/periode → observasi hotspot → indikator Aman / Waspada / Siaga → alasan → daftar kesiapsiagaan.

## Fitur utama

- Peta 38 provinsi, relief 3D dan peta 2D, filter tahun/bulan/wilayah, pemutaran arsip, dan ekspor CSV tetap tersedia.
- Kartu indikator risiko menampilkan skor 0–100, faktor, cakupan, dan rumus yang dapat diperiksa.
- Ringkasan risiko mengikuti wilayah/periode dan skor, disertai langkah warga sesuai level.
- Pada level Siaga tersedia daftar kesiapsiagaan, simulasi bantuan, dan latihan rencana titik berkumpul yang belum diverifikasi.
- Penyedia data NASA FIRMS memakai cache dari skrip server-side; data sintetis cadangan selalu berlabel Mode Demo.

## Data, penyiapan, dan batas keselamatan

Jalankan `npm install` lalu `npm run dev`. Cache observasi publik yang disertakan dapat dibaca tanpa key; bila cache hilang atau tidak valid, aplikasi memakai Mode Demo. Untuk memperbarui data nyata, isi environment variable server `NASA_FIRMS_MAP_KEY`, jalankan `npm run sync:firms`, lalu muat ulang aplikasi. Key tidak boleh memakai awalan `VITE_` dan tidak dikirim ke browser. Untuk build statis, sinkronkan dahulu, baru jalankan `npm run build`.

Cache `public/data/firms-cache.json` sengaja disertakan dalam commit agar deploy statis memiliki observasi nyata sebagai cadangan bila sinkronisasi gagal atau key tidak tersedia. Cache hanya berisi observasi publik dan metadata, tanpa key atau URL ber-key. Untuk memperbarui salinan repositori, jalankan `npm run sync:firms`, periksa isi cache, lalu commit ulang cache. **Key tetap server-side dan tidak pernah di-commit.** File `.env*` dan semua `*.tmp` tetap diabaikan Git. Perubahan konfigurasi ini sendiri tidak membuat commit.

**[Panduan lengkap penyiapan, arsitektur data, rumus skor, dan verifikasi](./docs/siagaapi-setup.md)** memuat contoh PowerShell dengan input key tersembunyi serta bagian **Deploy ke Vercel**. Konfigurasi `vercel.json` menggunakan `npm run sync:firms; npm run build` dan output `dist`. Setiap deploy ulang mencoba memperbarui cache; kegagalan sync tidak menghentikan build. Hasil sync saat build tidak otomatis memperbarui salinan di Git.

Skrip mengambil MODIS_NRT dan VIIRS_SNPP_NRT dari API resmi untuk tiga hari UTC yang telah selesai. Label FIRMS menampilkan asal data, waktu sinkronisasi, dan cakupan; tidak ada klaim pemantauan langsung. Tanpa cache yang valid, aplikasi memakai data sintetis berlabel jelas. Parser CSV tersedia, tetapi belum ada tombol unggah di UI.

Skor merupakan heuristik prototype yang belum divalidasi sebagai penilaian keselamatan. Cuaca belum tersedia dan tidak dihitung. Periode tanpa cakupan atau cache lebih dari tujuh hari tidak diberi label Aman. Baseline historis, kalender, dan perbandingan tahunan nyata belum tersedia dari cache singkat; fitur tersebut tetap tersedia pada arsip demo.

Deteksi satelit bukan konfirmasi kejadian kebakaran dan bukan pengukuran luas terbakar. Label Aman bukan jaminan keselamatan. Titik aman/rencana evakuasi serta tombol Lihat simulasi rencana bantuan hanya simulasi, bukan lokasi/rute resmi atau pengiriman bantuan. Ikuti arahan BPBD/pemerintah setempat dan jangan menunggu skor aplikasi dalam keadaan berbahaya.

## Kaitan dengan keberlanjutan

- **SDG 13 — Penanganan Perubahan Iklim:** pola aktivitas dan indikator membantu pembahasan kesiapsiagaan musiman terhadap karhutla.
- **SDG 15 — Ekosistem Daratan:** pengamatan per wilayah membantu menentukan lokasi yang perlu diperiksa lebih lanjut terkait tekanan pada hutan dan habitat.

Ditujukan terutama bagi warga di wilayah rawan; BPBD, lembaga lingkungan, NGO, peneliti, dan jurnalis dapat mengeksplorasi observasi untuk tindak lanjut yang memerlukan verifikasi lapangan.

Live demo: akan ditambahkan setelah deploy Vercel.

## Menjalankan secara lokal

Memerlukan Node.js 20.19+ atau 22.12+.

```sh
npm install
npm run dev
```

Buka URL yang dicetak Vite (biasanya http://127.0.0.1:5173). Di Windows PowerShell, gunakan `npm.cmd` jika kebijakan eksekusi skrip memblokir `npm.ps1`.

```sh
npm run build
npm test
npm run preview
```

## Membuka di ponsel

Hubungkan ponsel dan laptop ke Wi-Fi yang sama (atau hubungkan laptop ke hotspot ponsel), lalu jalankan:

```sh
npm run dev:lan
```

Buka alamat **Network** yang dicetak Vite, menggunakan alamat IPv4 Wi-Fi dan port **5174**. Cari alamat tersebut dengan `ipconfig` di Windows; jangan gunakan `localhost` pada ponsel. Laptop dan terminal harus tetap menyala. Jika Windows meminta izin, izinkan Node.js pada jaringan privat. Bila ponsel tidak dapat terhubung, periksa firewall dan apakah Wi-Fi mengisolasi perangkat. IP dapat berubah saat berganti jaringan. Skrip LAN mengikuti [opsi host Vite](https://vite.dev/config/server-options#server-host); perintah pengembangan biasa tetap hanya dapat diakses secara lokal dari laptop.

## Kemampuan yang tersedia

- Batas wilayah terpublikasi untuk 38 provinsi, dapat dipilih dengan klik maupun keyboard; pergeseran, pembesaran, pengaturan ulang, sorotan provinsi terpilih, penanda hotspot, dan pewarnaan aktivitas provinsi.
- Enam tahun demo deterministik (2020–2025), pilihan Januari–Desember, pemutaran bulanan dengan putar/jeda, pengaturan kecepatan, dan pengaturan ulang ke seluruh tahun.
- Lapisan observasi MODIS, VIIRS, dan gabungan; pengaturan keyakinan sensor dan tampilan.
- Jumlah observasi sumber dan gabungan, kategori keyakinan, wilayah dengan observasi, serta jumlah observasi maksimum dalam sel grid 0,05°.
- Tren bulanan, rata-rata bulanan tahun sebelumnya, kalender aktivitas enam tahun, ambang anomali eksplisit, perbandingan setahun penuh, dan ringkasan berdasarkan perhitungan.
- Ekspor CSV untuk pilihan wilayah/tahun/bulan/lapisan/keyakinan, termasuk penanda demo dan keanggotaan sumber dalam observasi gabungan.
- UI responsif dan dokumentasi data/metode di dalam aplikasi.

## Arti angka yang ditampilkan

Hotspot adalah observasi, **bukan kejadian kebakaran**. Luas terbakar tidak disimpulkan. Jumlah observasi, kecerahan, pola musiman, dan anomali demo dibuat untuk demonstrasi dan tidak boleh dinyatakan sebagai pengukuran NASA.

Penggabungan mengurutkan deteksi berdasarkan waktu UTC dan secara greedy memasangkan observasi sensor berbeda terdekat yang tersedia dalam **1 km dan 60 menit**, termasuk lintas batas provinsi selama memenuhi batas jarak dan waktu; wilayah dan periode mengikuti observasi lebih awal. Pencocokan dilakukan satu-ke-satu; deteksi dari sensor yang sama tetap terpisah. Observasi pertama menjadi acuan lokasi dan waktu, termasuk bulan/tahunnya. Setiap hasil menyimpan ID sumber dan kategori keyakinan tertinggi anggotanya. Kecerahan tetap spesifik per sensor dan tidak dirata-ratakan. Pada eksplorasi peta, filter keyakinan tinggi diterapkan sebelum pencocokan.

Ini adalah prototype untuk mengurangi observasi tumpang tindih, bukan produk historis kebakaran yang konsisten dan tervalidasi. Perbedaan resolusi spasial, frekuensi lintasan, tutupan awan, dan sensitivitas sensor belum dikoreksi. Hal-hal tersebut memerlukan kalibrasi dan validasi ilmiah sebelum interpretasi data nyata. Metrik sel padat menghitung isi grid tetap, bukan kelompok kejadian, luas terbakar, atau kepadatan dengan luas setara.

Ambang anomali: jumlah observasi periode terpilih > rata-rata + 2 simpangan baku populasi. Baseline memakai semua tahun **sebelumnya** yang tersedia untuk wilayah, lapisan sensor, filter keyakinan, dan periode kalender yang sama, dengan minimal tiga tahun. Anomali tahunan dan bulanan dihitung terpisah. Data demo memiliki cakupan sintetis lengkap. Cache nyata memiliki cakupan tanggal parsial yang dinyatakan jelas; perbandingan historis dinonaktifkan dalam mode FIRMS dan periode di luar cakupan tidak diberi skor.

Grafik historis dan perbandingan demo menggunakan seluruh tahun terpilih. Ringkasan risiko warga memakai wilayah dan periode terpilih; modal rincinya juga mempertahankan ringkasan observasi setahun penuh pada Mode Demo. Peta, metrik utama, jumlah per wilayah, dan CSV memakai bulan terpilih atau seluruh tahun pada Mode Demo; pada mode FIRMS, pilihan seluruh periode mencakup seluruh cache. Panel wilayah menampilkan jumlah sumber kedua sensor sebagai konteks meskipun hanya satu lapisan sensor dipilih.

Simbol peta yang tumpang tindih diringkas dalam sel tampilan 0,04° menggunakan koordinat salah satu anggota yang sebenarnya. Optimasi tampilan ini tidak mengubah jumlah dalam analisis. Warna simbol memakai kategori keyakinan tertinggi dalam sel tampilan.

Tampilan 3D merender elevasi permukaan sebenarnya dengan MapLibre GL JS, memakai [tile relief Mapterhorn](https://mapterhorn.com/data-access/) dalam format Terrarium WebP 512 piksel (tile global hingga zoom 12). Warna elevasi dan bayangan terarah memperlihatkan gunung, kaldera, lembah, dan punggungan aliran air. Satelit adalah permukaan bawaan, dengan rincian vegetasi dan batuan lebih jelas, kecerahan mendekati alami, dan saturasi moderat. Relief berbayang merupakan pilihan palet elevasi hijau hingga warna batu, dengan bayangan lembut tanpa sorotan putih pada puncak.

Permukaan satelit memakai Esri World Imagery untuk tampilan regional (sumber dibatasi pada zoom 8) dan mosaik tahunan Sentinel-2 EOxCloudless 2024 untuk rincian medan. Antara zoom peta 8 dan 10, lapisan rinci berbaur perlahan di atas tampilan umum; keduanya memakai satu faktor perpaduan global berdasarkan zoom kamera, bukan perpaduan per tile. Piramida citra yang konsisten menghindari perbedaan pengambilan citra yang mencolok pada tingkat rincian berdekatan di peta dasar sebelumnya, khususnya Semeru.

Bayangan DEM multiarah memakai cahaya utama lebar dari barat laut (295 dan 335 derajat) dan cahaya pengisi lebih lemah dari timur laut (35 derajat), semuanya tetap secara geografis, menghasilkan sorotan hangat dan gradasi lembah sejuk yang lebih halus. Sudut elevasi cahaya 30 derajat menjaga permukaan datar tetap netral. Kekuatannya tidak bergantung pada arah, kemiringan, atau jarak kamera. Mosaik mengurangi awan; sisa awan dan sambungan geografis citra masih mungkin ada. Tile satelit diminta ketika permukaan itu dipilih. Mosaik rinci tetap memakai tahun 2024; tanggal citra tampilan umum bervariasi. Keduanya tidak disesuaikan dengan tahun aktivitas terpilih; ini bukan umpan langsung atau simulasi erosi.

Penyesuaian warna satelit tetap konstan pada berbagai zoom dan orientasi kamera. Bayangan relief terikat pada peta dengan sorotan hangat yang terbatas; warna provinsi tetap pada berbagai zoom dan kabut medan didorong ke cakrawala agar permukaan tidak tampak semakin terang saat kamera mendekat. Jika citra gagal dimuat, pengaturan permukaan menyediakan pilihan relief berbayang. Kamera bawaan Bromo–Semeru memberi tampilan dekat; preset Rinjani dan Papua serta tampilan seluruh Indonesia hanya mengubah kamera, bukan filter aktivitas. Memilih provinsi menyesuaikan tampilan ke cakupan geografisnya. Kontrol Lihat hotspot berpindah di antara observasi yang ditampilkan dari sudut kamera dekat tanpa mengubah filter data.

Gunakan Geser untuk navigasi atau Putar 360 untuk mengorbit dengan satu jari/tombol kiri: geseran horizontal memutar terus melewati arah utara, sedangkan geseran vertikal mengatur kemiringan antara 0 dan 75 derajat. Hadap utara memulihkan arah tanpa mengatur ulang zoom atau kemiringan. Tutup panel Pengaturan peta dengan tombol tutup dan buka kembali melalui Pengaturan peta; permukaan, relief, mode putar, dan kemiringan dipertahankan. Pada ponsel, kedua panel awalnya tertutup dan membuka salah satunya akan menutup yang lain agar peta tetap terlihat. Mode Geser mempertahankan gestur bawaan geser tombol kanan dan dua jari.

Layar penuh memperbesar tampilan 2D maupun 3D dengan mempertahankan kontrol peta; bila layar penuh bawaan tidak tersedia, aplikasi menggunakan tampilan seluas viewport yang dapat ditutup dengan Escape. Garis administratif menggambar batas bersama antarprovinsi satu kali. Pilihan provinsi menyorot batas bersama yang sama, berdasarkan identitas kedua provinsi yang berbatasan; kedua lapisan garis tidak menggambar garis pantai yang disederhanakan atau tepian pulau terpisah. Batas terpilih memudar pada zoom dekat. Gaya ini tidak meningkatkan akurasi batas wilayah.

Relief secara bawaan memakai pengali vertikal 1,5× yang diberi label jelas, dengan pilihan 1× dan 2,5×. Perbesar untuk melihat rincian medan lokal; pegunungan secara alami terlihat kecil pada skala nasional. Tile diminta untuk area kamera yang terlihat, termasuk cakrawala jauh, dengan cache tile terbatas. Perenderan HD memakai supersampling 1,5× pada layar standar, mendukung hingga 2× pada layar ber-DPI tinggi, dan menargetkan paling banyak enam juta piksel render tanpa turun di bawah 1×. Perubahan ukuran layar penuh menghitung ulang batas ini. Penyaringan tekstur linear memperhalus interpolasi medan dan citra. Jangan memotong citra atau elevasi mengikuti kotak batas Indonesia: pada sudut miring, pemotongan itu meninggalkan celah persegi panjang di laut. Pembaruan GeoJSON dipisahkan dari perubahan tampilan. Perubahan kemiringan/putaran yang datanya sudah tersimpan mempertahankan status siap, dan tile relief beresolusi lebih rendah yang sudah dimuat dapat menjadi pratinjau awal sambil menunggu rincian. Kecepatan pemuatan pertama tetap bergantung pada layanan tile eksternal dan koneksi.

Kontrol Warna provinsi mengubah warna tematik provinsi dalam 3D dan palet provinsi dalam 2D. Warna 3D tetap konstan pada berbagai zoom agar kecerahan permukaan konsisten. Memilih warna provinsi saat intensitas aktivitas aktif akan menonaktifkan intensitas. Perubahan tampilan ini tidak mengubah jumlah dalam analisis. Tombol 2D membuka geografi SVG yang dibundel lokal, termasuk provinsi yang dapat dipilih lewat keyboard; pencarian provinsi dan pemilih wilayah juga menyediakan pilihan lewat keyboard untuk 3D. Perenderan berada di `src/components/TerrainMap.tsx`, dengan mesin yang dimuat sesuai kebutuhan dan worker MapLibre yang dibundel terpisah untuk pengembangan maupun produksi. Relief memerlukan internet dan WebGL2; kegagalan pemuatan tile atau grafis yang tidak didukung menampilkan pesan dengan pilihan kembali ke 2D.

Dalam 2D, simbol hotspot memiliki inti bara dan cahaya lembut; hingga 100 simbol berkeyakinan tinggi yang tersebar secara spasial juga diberi animasi api dan percikan dekoratif. Dalam 3D, titik bercahaya mengikuti permukaan pada koordinat observasi. Provinsi terpilih juga menampilkan hingga 24 efek api dekoratif yang tersebar secara spasial, memprioritaskan observasi berkeyakinan tinggi dan memakai koordinat anggota sebenarnya. Atlas WebGL bersama merender empat variasi tepi api yang bergerak lembut, asap terbatas, cahaya kontak halus, dan bara naik yang jarang. Sprite 256 × 384 memendek secara perspektif mengikuti kemiringan kamera, memperlihatkan dasar bara dari atas, dan menyesuaikan cahaya permukaan dengan sudut pandang. Sprite ini bersifat prosedural dan menyesuaikan kamera, bukan simulasi fisik kebakaran.

Penanda canvas berbagi satu renderer yang dibatasi pada 24 bingkai per detik; penanda di luar layar atau tertutup medan dilewati. Animasi dijeda saat peta di luar layar atau halaman tersembunyi. Perangkat yang tidak dapat mengalokasikan konteks WebGL tambahan tetap menggunakan simbol bara sederhana. Penanda mengikuti perubahan kamera dan menghilang di balik punggungan. Provinsi terpilih juga mendapatkan simbol api lebih penuh dalam 2D. Efek 3D dipisahkan dalam `src/components/SelectedFireEffects.tsx`, `src/components/fireRenderer.ts`, dan `src/selected-fire.css`. Simbol mengikuti filter/pemutaran dan menghilang ketika deteksi disembunyikan. Bentuk simbol tidak mengukur tingkat keparahan, tinggi api, cakupan kejadian, atau luas terbakar. Preferensi pengurangan gerakan menonaktifkan animasi api dan perpindahan kamera beranimasi. Simbol SVG dipisahkan dalam `src/components/HotspotSymbols.tsx`.

Untuk uji dasar browser, jalankan server pengembangan pada port 5173, lalu jalankan `node tests/browser.mjs`. Pengujian memakai Microsoft Edge yang terpasang dalam mode tanpa jendela dan menyimpan tangkapan layar di `test-results/`.

Jalankan `node tests/camera-browser.mjs` untuk memeriksa layar penuh, putaran terus-menerus, kemiringan dengan geseran, pengembalian ke utara, tampilan cadangan pada ponsel, dan Escape.

Jalankan `node tests/terrain-browser.mjs` untuk uji integrasi 3D yang memerlukan jaringan: pemuatan tekstur satelit, pergantian permukaan, pemuatan relief, preset kamera, kontrol relief, pilihan provinsi, proyeksi api pada sudut 0/30/60/75 derajat, tata letak ponsel, dan penanganan kegagalan jaringan citra/DEM. Tangkapan layar disimpan ke `test-results/terrain-*.png`. Isi `APP_URL` untuk menguji pratinjau produksi sebagai pengganti server pengembangan.

Jalankan `node tests/terrain-lighting-browser.mjs` untuk memeriksa kestabilan kecerahan permukaan saat kamera bergerak sedikit, menggunakan fixture tile deterministik. Tambahkan `--live` untuk membandingkan area geografis Semeru yang sama pada berbagai tingkat rincian citra satelit sebenarnya dan merekam pergerakan kamera pada medan nyata di `test-results/lighting/`. Pengujian langsung memerlukan layanan citra dan elevasi.

## Arsitektur

`src/components/`: `IndonesiaMap`, `LayerSelector`, `RegionPanel`, `YearSelector`, `FireReplay`, `ActivityCalendar`, `HotspotTrend`, `YearComparison`, `FireBrief`, `RiskStatusCard`, `RiskBrief`, `EmergencyActionPanel`. `ErrorBoundary` membungkus `App` untuk menampilkan pesan Indonesia dan tombol Muat ulang jika terjadi error render.

`src/services/`: `observationProvider` (cache FIRMS tervalidasi dan cadangan demo), `riskService` (indikator warga yang transparan), `nasaDataService` (antarmuka penyedia data, generator demo, normalisasi baris FIRMS), `harmonizationService` (pencocokan, filter lapisan, isi grid), `anomalyService` (jumlah bulanan, baseline, puncak, peringkat).

`src/types.ts`: skema observasi ternormalisasi bersama. `src/styles.css`: gaya dashboard, warna peta, tipografi, dan aturan responsif. Proyeksi peta, perenderan geografi, dan kontrol tampilan dipisahkan dalam `IndonesiaMap` agar referensi desain berikutnya dapat diterapkan tanpa mengubah layanan analisis.

## Menghubungkan observasi FIRMS nyata

Gunakan sinkronisasi server-side dan penyedia cache yang sudah diimplementasikan, sesuai [panduan penyiapan](./docs/siagaapi-setup.md). `NASA_FIRMS_MAP_KEY` tetap berada di environment server; `npm run sync:firms` memvalidasi kedua produk sebelum memperbarui cache observasi publik yang sengaja disertakan dalam commit. UI menormalisasi baris CSV dengan `isDemo: false`, asal data, dan penetapan provinsi melalui point-in-polygon. Arsip historis dan metadata cakupan lengkap masih diperlukan sebelum perbandingan musiman data nyata diaktifkan. Jangan menggantikan cakupan setahun penuh dengan rentang NRT yang singkat.

Referensi: [atribut MODIS NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/descriptions/FIRMS_MODIS_Firehotspots.html), [tutorial API NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html), [panduan keyakinan sensor NASA](https://forum.earthdata.nasa.gov/viewtopic.php?t=5182).

## Atribusi geografi

File `public/data/indonesia-provinces.geojson` yang tidak dimodifikasi berasal dari [Deny Herianto, Indonesia GeoJSON & TopoJSON Maps (38 Provinces)](https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces), diunduh pada 19 September 2026, berlisensi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Lisensi sumber disertakan di `public/data/DATA_LICENSE.md`. Arah putaran poligon hanya dinormalisasi di memori untuk perenderan D3. Batas wilayah yang dipublikasikan komunitas ini sesuai untuk prototype dan tidak dinyatakan sebagai batas kadastral resmi. Geografi yang sama dipakai untuk semua tahun demo; perubahan provinsi secara historis tidak direkonstruksi.

Batas provinsi dan peta 2D dibundel lokal tanpa memerlukan layanan tile atau API key. Tile elevasi 3D diambil dari `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`, tanpa kredensial. Atribusi relief: sumber elevasi yang berkontribusi tercantum pada [atribusi Mapterhorn](https://mapterhorn.com/attribution/). Resolusi relief bervariasi menurut lokasi dan zoom; palet Relief berbayang diturunkan dari ketinggian, sedangkan Satelit memakai peta dasar citra. Elevasi nyata tidak menentukan asal observasi hotspot: label sumber membedakan data demo sintetis dari cache NASA FIRMS. Google Fonts bersifat opsional dan digantikan font sans-serif lokal bila tidak tersedia. Prototype ini menggunakan data publik NASA FIRMS dan bukan produk resmi NASA. Tanpa cache FIRMS yang valid, observasi dashboard tetap berupa data demo sintetis.

Citra satelit diminta dari layanan publik [EOX WMTS](https://maps.eox.at/): `s2cloudless-2024_3857`, tile 256 piksel hingga zoom 14 (zoom lebih tinggi memakai ulang resolusi itu). Atribusi: [EOxCloudless](https://cloudless.eox.at) oleh [EOX IT Services GmbH](https://eox.at) (Contains modified Copernicus Sentinel data 2024). Lapisan ini berlisensi [CC BY-NC-SA 4.0, untuk penggunaan nonkomersial](https://cloudless.eox.at/license-non-commercial); kredit penyedia dan lisensi ditautkan dalam kontrol atribusi peta. Prototype menggunakannya sebagai peta dasar visual, bukan bukti kebakaran.

Tampilan satelit regional: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), dengan kredit kepada Esri, Maxar, Earthstar Geographics, and the GIS User Community. Sumber ini dibatasi pada zoom 8 dan tetap berada di bawah lapisan rinci sebagai cadangan yang tersimpan. Bila tile rinci tidak tersedia atau terlambat, tampilan umum ini muncul menggantikan latar biru; pengambilan citra beresolusi tinggi yang tidak selaras dari sumber tersebut tidak pernah diminta.

Jalankan `node tests/terrain-loading-browser.mjs` untuk menahan pemuatan citra rinci saat memperbesar dari tingkat 7 hingga 12,3. Pengujian memastikan daratan yang sudah dimuat tidak berubah menjadi latar biru; tangkapan layar disimpan di `test-results/loading/`.

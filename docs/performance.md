# Pengukuran performa Peta aktivitas

Diukur 16 Oktober 2026 pada Windows 11 (win32 10.0.26200), Intel i7-12700H / 20 logical CPU, Edge 155.0.4283.45 headless, viewport 1280×800, DPR 1. Browser memakai ANGLE SwiftShader; hasil bukan benchmark GPU ponsel/desktop pengguna. Data Mode Demo bawaan deterministik; DEM datar dan citra warna tunggal dilayani fixture lokal, sehingga tidak mengukur latensi jaringan tile. Browser memiliki interval frame sekitar 6,1 ms pada mesin ini; angka di atas 60 fps bukan asumsi layar 60 Hz.

Baseline diambil dari build yang ada sebelum iterasi terakhir ini, yang sudah memiliki worker analisis dasar dan tombol kualitas. Tiap skenario diukur satu kali, pada sesi baru dengan urutan yang sama. Baseline siap 3D 1493 ms; sesudah kualitas biasa 1251 ms; kualitas rendah 1189 ms. Ini waktu sampai MapLibre style siap, bukan semua tile jaringan selesai. Percobaan sebelumnya yang gagal shader/kehabisan memori tidak dipakai dalam tabel.

## FPS rata-rata / p95 waktu frame (ms)

| Skenario                 |      Sebelum | Sesudah, biasa | Sesudah, rendah |
| ------------------------ | -----------: | -------------: | --------------: |
| 3D pan/zoom              | 0.5 / 3926.4 |   0.5 / 3587.1 |    0.9 / 1648.1 |
| 3D province fire effects |   15.5 / 6.2 |    8.8 / 793.7 |     36.8 / 18.2 |
| 3D replay                |   62.4 / 6.2 |    36.4 / 18.2 |     55.0 / 24.1 |
| 2D pan/zoom              | 32.2 / 363.4 |   34.4 / 381.6 |    34.0 / 351.4 |
| 2D replay                |  101.2 / 6.2 |    101.8 / 6.2 |      93.4 / 6.2 |

## Waktu scripting main thread per perubahan bulan (ms)

| Replay    | Sebelum | Sesudah, biasa | Sesudah, rendah |
| --------- | ------: | -------------: | --------------: |
| 3D replay |   149.4 |           69.4 |            34.7 |
| 2D replay |    34.0 |           60.7 |            20.7 |

Dihitung dari delta CDP Performance.ScriptDuration selama jendela replay dibagi jumlah perubahan bulan yang teramati (dua pada setiap sampel ini). Ini perkiraan biaya scripting dalam jendela replay, termasuk UI/peta, **bukan** durasi fungsi perhitungan murni atau waktu CPU worker. FPS memakai jumlah callback RAF dibagi waktu dinding sampel; p95 berasal dari selisih timestamp frame. Pan memakai 24 gerakan pointer, sehingga panjang sampel dapat melampaui 4 detik di renderer lambat. Long task maksimal pada replay 3D: sebelum 184 ms, biasa 0 ms, rendah 0 ms. Total request tile selama skenario: 153 / 154 / 142 (sebelum / biasa / rendah). Heap JS akhir: 40.3 / 38.8 / 36.7 MiB; tidak termasuk memori GPU dan bukan bukti bebas kebocoran.

## Hasil dan batas interpretasi

Scripting replay 3D menurun pada sampel ini; kualitas rendah juga mengurangi biaya scripting replay 2D. FPS/p95 kualitas biasa **tidak membaik merata**. Pan 3D tetap sangat berat pada SwiftShader, dengan jeda awal kompilasi/render terrain. Tidak tepat mengklaim seluruh peta lebih cepat berdasarkan satu sampel. Ulangi pada GPU nyata, beberapa iterasi dan ponsel fisik sebelum menarik kesimpulan distribusi performa.

Perbaikan: replay RAF tidak melompati periode dan berhenti ketika hidden/offscreen; harmonisasi layer dan risiko dicache per masukan yang relevan dalam worker; hasil filter dibatasi 24 entri dan risiko 96 entri; setData dibatch RAF; simbol SVG dimemoisasi dan drag hanya mengubah transform per frame; renderer atlas digunakan ulang dan dibuang saat peta dilepas. Rumus dan urutan filter administratif dipertahankan. Snapshot mengunci hitungan, risiko, anomali, sel terpadat dan hash baris CSV untuk Indonesia, Riau, Maluku.

Kualitas rendah: DPR 1, maksimum 6 efek api/12 fps, simbol SVG statis, sel tampilan 0,08°, tanpa detail Sentinel-2, kabut dekoratif atau transisi kamera terprogram. Budget tile diperkecil menjadi 48 per sumber / 3 tingkat zoom **di kedua kualitas**: pembatasan bersama ini menghindari membangun ulang instance MapLibre ketika toggle berubah. Mode biasa memulihkan detail, resolusi dan efek, sementara budget cache tetap 48. Atribusi sumber tetap ada. Detail titik dipilih secara eksplisit, tidak mengambil observasi pertama (Maluku) secara implisit.

## Mengulang

Jalankan npm run build, lalu npm run preview -- --port 4173 --strictPort. Jalankan node tests/performance-browser.mjs LABEL untuk biasa atau LABEL-low untuk rendah. JSON mentah ditulis ke test-results/performance/. Jangan menjalankan benchmark bersamaan dengan build/test lain. Jalankan npm test untuk snapshot dan fake-clock lag monitor; node tests/quality-browser.mjs untuk persistensi, penolakan banner dan pilihan titik. Tidak ada data performa yang dikirim ke server.

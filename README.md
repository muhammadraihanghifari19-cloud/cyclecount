# Cycle Count Dashboard

Dashboard stock accuracy dari hasil cycle count gudang Tegal (tab "CC BY HERON <BULAN> 26" di spreadsheet CYCLE COUNT TEGAL). Untuk pemakaian internal.

## Sales Dashboard

Buka `sales.html` di browser. Upload satu atau beberapa file CSV dari Magpie (bisa pilih banyak sekaligus). Data digabung otomatis, baris duplikat dari file yang tumpang tindih dibuang.

**Filter di sidebar:** brand, marketplace, rentang tanggal, pencarian, hanya non-bundle (punya kode SAP), dan batas harga wajar (bawaan Rp 100.000 — baris dengan VALUE_HET di atas itu tidak dihitung di omzet tapi qty tetap dihitung).

**Tab:**
- **Ringkasan:** qty dan omzet per hari, qty per brand.
- **Per Brand:** tabel dan grafik qty + omzet per brand.
- **Per Marketplace:** tabel dan grafik pie qty dan omzet.
- **Top SKU:** 100 SKU paling laku (urut qty), dengan kolom kode SAP dan brand. Kalau data cycle count sudah ada di browser (dari dashboard CC, dicentang "Simpan di perangkat ini"), kolom tambahan menampilkan berapa bulan SKU itu dihitung di cycle count dan akurasi terakhirnya.

**Format CSV:** kolom `ORDER_TIMESTAMP` berformat `"25 Oct, 2026, 13:08"`, `VALUE_HET` bertitik ribuan (`45.000`). Parser menangani keduanya secara otomatis.

**Catatan data Oktober:**
- File CSV dari Magpie bisa terpotong di 1.048.575 baris. Kalau terpotong, pecah per rentang tanggal yang lebih pendek sebelum mengunduh.
- Sekitar 83% baris adalah bundle (`IS_BUNDLE=true`) tanpa kode SAP. Filter "Hanya non-bundle" menampilkan baris yang bisa dihubungkan ke data cycle count.
- Baris dengan harga di atas batas (misalnya 9.999.999) tidak dihitung di omzet.



1. Buka `index.html` di browser (klik dua kali, tidak perlu server).
2. Klik **Upload .xlsx** dan pilih file CYCLE COUNT TEGAL.
3. Tunggu sampai selesai. File besar (sekitar 20 MB) butuh sekitar 20-35 detik karena dibaca di browser.

Data tidak pernah dikirim ke server. Bawaannya data hanya ada selama halaman terbuka, jadi perlu upload ulang setiap kali halaman dibuka. Kalau mau data tersimpan di perangkat itu (IndexedDB di browser), centang **Simpan di perangkat ini** di sidebar. Setelah itu data langsung tampil saat halaman dibuka lagi. Mematikan centang atau klik **Hapus data tersimpan** menghapusnya. Pakai pilihan ini hanya di perangkat yang boleh menyimpan data. Perangkat yang sudah punya data tersimpan sebelum pilihan ini ada dianggap sudah memilih menyimpan. Library ada di `lib/`, jadi tidak perlu internet.

Folder `data/` dan semua file `.xlsx`/`.csv` diabaikan git karena berisi data perusahaan. Jangan di-commit.

## Fitur

Halaman punya lima tab, dan filter di sidebar berlaku untuk semuanya (bulan, brand, PIC, kelas SKU, tanggal, pencarian, target akurasi).

- **Ringkasan:** kalimat besar di atas (akurasi, jarak ke target, batas selisih agar target tercapai, dan berapa pcs yang perlu turun) dengan beberapa sorotan singkat. Lalu kartu (akurasi total dengan panah naik/turun dibanding bulan sebelumnya, jumlah SKU, SKU cocok, di bawah target, selisih net lebih/kurang), grafik konsentrasi selisih (berapa SKU yang menyumbang berapa persen selisih, dan berapa SKU yang perlu dibereskan untuk capai target), tren akurasi antar bulan per brand, akurasi per hari/brand/PIC, dan grafik lebih vs kurang per bulan.
- **Heron vs Real:** tabel seperti tab Review di Excel: Heron, Real, gap, lebih, kurang, akurasi netto dan absolut, per bulan, per brand, dan per PIC. Angkanya sudah dicocokkan dengan tab Review untuk Februari dan April 2026.
- **Storage vs Display:** akurasi stok di rak storage dibanding rak display, tren per bulan, dan per brand/PIC. Display = Total - Storage.
- **Kelas & Cakupan:** akurasi per kelas SKU (A/B/C dari tab SKU CLASS), cakupan hitung per kelas (berapa SKU sudah dihitung), dan daftar SKU yang belum dihitung urut menurut penjualan.
- **Risiko:** daftar item (SKU + kode SAP) yang berpotensi selisih di hitungan berikutnya, urut menurut skor 0-100 dengan alasannya. Skor 80 ke atas dianggap risiko tinggi. Bisa diunduh sebagai CSV atau Excel per PIC (checklist dengan kolom Hasil hitung dan Catatan untuk diisi). Klik baris untuk melihat detailnya.
- **Penyebab:** laporan human error per kategori, per area, dan per bulan (dari tab REPORT HUMAN ERROR), serta daftar sumber potensi gap dan penanggung jawabnya (dari tab POTENSIAL GAP). Tab ini tidak mengikuti filter di sidebar.
- **Prioritas:** ranking PIC dan brand (klik untuk memfilter) serta SKU bermasalah berulang (di bawah target di 2 bulan atau lebih).
- **Detail SKU:** tabel per SKU dan kode SAP dengan Heron, Real, dan Gap untuk total, storage, dan display, plus akurasi. Bisa diurutkan dan dicari.
- Target akurasi bisa diubah (default 99%, tersimpan di browser), unduh hasil filter ke CSV atau Excel, cetak atau simpan PDF, mode terang/gelap.

## Rumus

- Akurasi SKU = 1 - |Real - Heron| / Heron (minimal 0%). Heron 0 dan Real 0 dihitung 100%. Heron 0 dan Real lebih dari 0 dihitung 0%.
- Akurasi gabungan (total, per brand, per PIC, per bulan, per hari) punya dua cara hitung, dan dashboard menampilkan keduanya:
  - **Netto** = 1 - |total Real - total Heron| / total Heron. Ini rumus yang dipakai tab Review per month, dashboard Excel, dan pivot per tanggal. Lebih dan kurang saling menutupi.
  - **Absolut** = 1 - jumlah |Real - Heron| per baris / total Heron. Lebih ketat, lebih dan kurang tidak saling menutupi (rumus tab "coretan itung akurasi").
  - Pilihan di sidebar ("Akurasi gabungan") menentukan mana yang dipakai untuk angka utama, warna, grafik, dan ranking. Bawaannya netto supaya sama dengan Excel. Akurasi per SKU sama di keduanya. Akurasi storage dan display ikut pilihan itu.
- Gap dihitung sendiri (Real - Heron), kolom Gap di spreadsheet tidak dipakai.
- Lebih = SKU dengan Real > Heron. Kurang = Real < Heron. Angkanya dijumlah dalam pcs.
- Sumber kolom: Total Heron dan Total Real di tab `CC BY HERON <BULAN> 26`, dibaca berdasarkan nama header. Storage diambil dari kolom `Stock Heron` dan `Stock Real` yang berdampingan, display = total dikurangi storage.
- Satu SKU (barcode) bisa punya beberapa kode SAP, misalnya kemasan lama dan baru. Item yang dinilai adalah **SKU + kode SAP**, jadi varian kemasan tidak digabung. Ini berlaku di SKU bermasalah berulang dan grafik konsentrasi selisih. Di tabel utama kolom Kode SAP menunjukkan variannya, dan pencarian bisa memakai kode SAP.
- Item yang muncul beberapa kali dalam satu bulan digabung (Heron dan Real dijumlah) saat menilai SKU bermasalah berulang. Di tabel utama tiap baris tetap tampil sendiri.
- Kode SAP diambil dari kolom `SAP Code`, atau `Odoo Code` kalau kosong. Kode Odoo diubah ke SAP dengan rumus SAP = 4.000.000.000 + Odoo (konsisten di 1.884 dari 1.885 baris tab SKU CLASS). Di beberapa bulan kolom `Odoo Code` sudah berisi nilai SAP, dan itu dipakai apa adanya. 30 baris dari 12.024 tidak punya kode dan memakai SKU saja.
- Baris dilewati kalau Tanggal bukan tanggal atau Total Heron/Total Real kosong atau error.
- Cakupan hitung = SKU di tab SKU CLASS yang muncul di bulan terpilih, dibagi total SKU kelas itu. Dihitung per SKU (barcode), bukan per kode SAP: varian kemasan dihitung satu SKU, dan dianggap sudah dihitung kalau salah satu variannya muncul. Tab SKU CLASS punya 2.060 baris untuk 1.978 SKU. Tab SKU CLASS berisi daftar SKU saat ini, jadi SKU lama yang sudah tidak ada di tab itu masuk "Tanpa kelas".

## Skor risiko

Skor dihitung per item (SKU + kode SAP) dari riwayat 6 bulan terakhir. Item tanpa riwayat tidak dinilai. Bobotnya (total 100):

| Faktor | Bobot |
|---|---|
| Besar selisih absolut (peringkat dibanding item lain) | 40 |
| Seberapa sering di bawah target (dihaluskan untuk riwayat pendek) | 30 |
| Bulan terakhir di bawah target | 10 |
| Kelas SKU (A = 10, B = 5, C = 0) | 10 |
| Arah selisih selalu sama (selalu lebih atau selalu kurang) | 5 |
| SKU punya varian kemasan (lebih dari satu kode SAP) | 5 |

Laporan human error 6 bulan terakhir yang cocok dengan item (lewat barcode atau kode Odoo/SAP) ditambahkan sebagai alasan, tapi tidak masuk skor.

**Hasil backtest** (`npm run backtest`): skor dihitung hanya dari bulan sebelum bulan yang diprediksi, lalu dibandingkan dengan hasil sebenarnya. Rata-rata April sampai November 2026, target 99%, 100 item teratas:

| Ukuran | Skor | Hanya lihat bulan terakhir | Acak |
|---|---|---|---|
| Presisi (benar di bawah target) | 70,5% | 70,6% | 60,8% |
| Selisih tertangkap (porsi total selisih bulan berikutnya) | 37,8% | 26,5% | 17,2% |

Artinya skor tidak lebih tepat menebak item mana yang di bawah target, tapi lebih baik menemukan item yang selisihnya besar. Hasil serupa untuk 50 dan 200 item teratas. Bobot dipilih dari data yang sama dengan pengujiannya (8 bulan), jadi angkanya agak optimistis. Ulangi backtest setelah ada bulan baru.

## Pembersihan label

Kolom Brand dan PIC di spreadsheet diisi manual dan tidak konsisten, jadi dibersihkan saat dibaca (`js/parse.js`):

- **Brand:** huruf besar/kecil disatukan dengan brand di tab SKU CLASS (BIODEF dan Biodef jadi satu). Brand kosong atau berisi kode koordinat (ada di Januari dan Juli) diambil dari SKU-nya. Kalau SKU tidak dikenal, jadi "Tidak diketahui". Brand yang berisi angka dianggap salah isi, jadi brand asli yang namanya mengandung angka akan tertukar. Belum ada kasus seperti itu di data ini.
- **PIC:** diambil nama depannya dengan huruf besar (AQIM MA'RUF ZAMAN jadi AQIM). Alias yang berlaku: SANTOS jadi SANTOSO, dan SYAEIF jadi SAIF. Alias SYAEIF adalah dugaan: SAIF berhenti di Oktober dan SYAEIF ELFA YANZA hanya muncul di November. Kalau salah, hapus alias itu di `PIC_ALIAS`. Nilai kosong atau berisi angka jadi "Tidak diketahui" (13 baris).

## Catatan

- Rata-rata waktu pengerjaan (CT) per PIC belum ada karena kolom "TOTAL CT" kosong atau 0 di semua tab bulan. Bisa ditambah kalau kolom itu mulai diisi.
- Nilai Rupiah belum ada karena tidak ada kolom harga di file ini.
- Tab penyebab: REPORT HUMAN ERROR berisi 457 laporan (Juni 2025 sampai November 2026), tapi hanya 65 di 2026, dan 54 di antaranya cocok dengan item di data hitungan. Tab Finding Report (catatan bebas), Item Selisih (satu hari, Februari 2025), dan CEK SELISIH (tautan prosedur) tidak dipakai.
- Tab bulan harus bernama `CC BY HERON <BULAN> 26` atau `... 2026`. Tab lama tanpa tahun (misalnya `CC BY HERON DESEMBER`) tidak dibaca.
- Brand di tab SKU CLASS bernama "Wardah Personal Care" terpisah dari "Wardah", jadi filter brand Wardah tidak menghitung SKU Personal Care di cakupan hitung.
- Sorotan brand dan PIC terendah hanya menghitung kelompok dengan minimal 10 SKU (akurasi kelompok kecil mudah ekstrem) dan melewatkan "Tidak diketahui".
- "SKU yang perlu dibereskan" = jumlah SKU teratas (menurut selisih absolut) yang harus selisihnya jadi nol supaya akurasi total mencapai target. Ini perkiraan, bukan jaminan.
- Teks di halaman sengaja singkat. Rumus akurasi muncul saat kursor diarahkan ke kartu "Akurasi total" dan ada di bagian Rumus di atas.

## Pengembangan

```
index.html        halaman
css/style.css     tampilan dan tema
js/parse.js       membaca tab bulan dan SKU CLASS, membersihkan label
js/calc.js        akurasi, ranking, tren, storage/display, lebih/kurang, kelas, cakupan
js/export.js      ekspor CSV/Excel
js/store.js       penyimpanan hasil bacaan di browser (IndexedDB)
js/ui.js          filter, tab, kartu, grafik, tabel
scripts/backtest.js  uji skor risiko pada data asli (tidak ikut tes)
tests/            tes dengan data tiruan
```

Jalankan tes: `npm test` (butuh Node, tanpa dependensi tambahan). Tes memakai data tiruan, bukan data perusahaan. Backtest: `npm run backtest` (opsi: `node scripts/backtest.js 99 100 --detail`), butuh `data/CYCLE COUNT TEGAL.xlsx`, hasil bacaan disimpan di `data/parsed-cache.json`. Kalau bentuk data hasil bacaan berubah, naikkan `SCHEMA` di `js/store.js` supaya cache lama diabaikan.

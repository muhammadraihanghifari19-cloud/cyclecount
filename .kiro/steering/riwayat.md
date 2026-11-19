---
inclusion: manual
---

# Riwayat keputusan dan temuan

Dipanggil dengan `#riwayat` di chat. Ringkasan alasan di balik keputusan dan hasil analisis selama pengembangan, supaya sesi baru (misalnya di laptop lain) tidak mengulang pekerjaan atau pertanyaan yang sama. Ini bukan transkrip. Isinya hanya angka agregat, tanpa data baris, nama orang, atau nama produk.

## Alur pengembangan
1. Awalnya repo hanya berisi README (belum ada kode). Pengguna ingin visualisasi web yang jelas dan tidak berlebihan. Dipilih HTML statis + Chart.js + SheetJS dengan upload xlsx di browser.
2. Versi pertama: kartu ringkasan, grafik per hari/brand/PIC, tabel akurasi per SKU (Heron vs Real).
3. Peningkatan: tren antar bulan, ranking PIC/brand, SKU bermasalah berulang, target akurasi, ekspor CSV/Excel, mode gelap, sidebar. Kode dipecah jadi modul dan diberi tes.
4. Fitur berikutnya, berurutan: simpan hasil bacaan di browser, storage vs display, lebih vs kurang, kelas SKU dan cakupan hitung, kalimat besar di atas dan grafik konsentrasi selisih (Pareto), kolom Heron/Real/Gap untuk storage dan display, penilaian per SKU + kode SAP, lalu "potensi gap": skor risiko dengan backtest dan tab penyebab.
5. Teks di halaman dipangkas atas permintaan pengguna (tidak mau penjelasan panjang).
6. Terakhir: diskusi asisten AI, hosting, pemindahan ke laptop lain, dan penyimpanan opsional. Lihat bagian "Ditahan" di `proyek.md`.

## Keputusan dan alasannya
- **Upload Excel di browser, tanpa backend.** Data perusahaan tidak boleh tersimpan di server. Pengguna menegaskan: web hanya menerima upload dan menampilkan, tiap orang upload dari laptopnya sendiri.
- **Rumus akurasi total** diambil dari tab "coretan itung akurasi" di spreadsheet (1 - selisih absolut / total Heron).
- **Label Brand dan PIC dibersihkan** karena diisi manual: huruf besar/kecil campur, nama pendek bergantian dengan nama lengkap, typo, dan sebagian terisi kode koordinat (ada di dua bulan).
- **Item dinilai per SKU + kode SAP.** Buktinya: SKU yang sama dengan dua kode SAP punya Heron dan Real sendiri-sendiri, dihitung di hari berbeda. Pada Januari dan Februari ada storage yang tercatat per rak sehingga terhitung dua kali pada beberapa SKU, dampaknya di bawah 1% dan tidak diperbaiki.
- **Display = total - storage.** Di tab bulan, dua baris di Agustus tidak konsisten di sumbernya (total tidak sama dengan storage + display). Dengan definisi ini, storage + display selalu sama dengan total.
- **Cakupan hitung per SKU (barcode), bukan per kode SAP.** Kemasan lama sering sudah tidak ada stoknya, jadi menghitungnya per kode akan membuat daftar "belum dihitung" penuh item kosong. Pengguna bisa mengubahnya kalau tim menetapkan kemasan lama dan baru harus dihitung sendiri-sendiri.
- **Warna akurasi tidak memakai kelas.** Pengguna memilih: warna tetap sama, prioritas kerja lewat tab Risiko (yang memakai kelas dan besar selisih).
- **Skor risiko:** bobot dipilih lewat backtest atas 8 bulan (Apr-Nov). Dibanding hanya melihat bulan terakhir, presisinya setara (sekitar 70,5% vs 70,6%, laju dasar 60,8%) tapi porsi selisih bulan berikutnya yang tertangkap di 100 item teratas lebih besar (37,8% vs 26,5%, acak 17,2%). Bobot dipilih dari data yang sama dengan pengujiannya, jadi angkanya agak optimistis. Ulangi backtest setelah ada bulan baru.
- **Laporan human error** hanya menjadi alasan tambahan di daftar risiko, tidak masuk skor. Dari 65 laporan 2026, 54 cocok dengan item di data hitungan.
- **Kartu "SKU dihitung"** menghitung SKU unik, sedangkan kartu lain memakai baris hitungan (ada SKU yang dihitung beberapa kali sebulan).
- **Penyimpanan di browser opsional dan bawaan mati**, karena sebagian laptop pengguna bersifat pribadi.
- **Hosting:** link terbuka tanpa nama orang di kode, plus `.vercelignore` dan `noindex`. Proteksi Vercel Authentication gratis, tapi di paket Hobby biasanya hanya untuk akun pemilik. Hobby ditujukan untuk pemakaian pribadi nonkomersial menurut pengetahuan saat itu, jadi cek ketentuannya. Berkas snapshot data dibatalkan karena tiap orang upload Excel sendiri.
- **Asisten AI:** hanya menerjemahkan pertanyaan jadi perintah laporan. Perhitungan tetap oleh kode, jadi jawaban tepat dan data tidak dikirim keluar. Kunci API tidak boleh ditanam di berkas halaman.

## Temuan data (agregat)
- Storage jauh lebih akurat daripada display (sekitar 96% vs 78% pada bulan yang dicek). Display sekitar 9% dari stok tapi sekitar sepertiga dari selisih.
- Selisih terkonsentrasi: 20 SKU teratas menyumbang sekitar sepertiga dari total selisih bulan itu.
- Jumlah SKU unik yang dihitung per bulan sangat bervariasi (Januari hampir semua dari sekitar 1.980 SKU di daftar kelas, bulan lain sering di bawah seribu, Oktober sangat sedikit). 96 SKU di daftar kelas belum pernah dihitung dalam 11 bulan. Bulan berjalan bisa belum selesai.
- Hitungan ganda dalam satu bulan: sekitar 455 kasus SKU-bulan (dari 12 ribuan baris). Sekitar 100 kasus adalah varian kode SAP (normal), sekitar 358 adalah hitung ulang SKU + kode sama di hari lain, terbesar di September (239). Hanya separuh yang selisihnya mengecil di hitungan kedua, jadi bukan pola "hitung ulang untuk membetulkan". Koordinat kosong di September menyulitkan analisis lokasi.
- Baris berstok nol di sistem dan fisik (H0 dan R0) 8-22% pada Januari sampai Mei. Baris ini ikut terhitung "cocok" dan menggembungkan jumlah baris, tapi tidak mengubah akurasi total.
- Selisih bisa dua arah (lebih dan kurang berimbang). Pengguna menjelaskan sebagian selisih kecil wajar karena stok sistem bergerak (orang checkout) saat fisik dihitung. Arah efeknya belum dipastikan. Sebagian besar selisih diyakini human error.
- Laporan human error: 457 laporan (Juni 2025 sampai November 2026), tapi hanya 65 di 2026. Kategori utama: salah penempatan, belum terinject link overmodal, FEFO tidak tepat, selisih stok.
- Tab yang diperiksa dan tidak dipakai: Finding Report (catatan bebas), Item Selisih (satu hari, Februari 2025), CEK SELISIH (tautan prosedur). Kolom UU ET02 rusak, tab UU SAP satu potret waktu, tidak ada kolom harga, kolom CT kosong.
- Kelas A (laku) menyumbang sebagian besar stok dan akurasi tertinggi, kelas C terendah. Kelas A dihitung tidak lebih sering daripada kelas lain.

## Pertanyaan untuk tim (belum dijawab)
1. Aturan frekuensi hitung per kelas (A tiap bulan? B tiap kuartal?).
2. Batas selisih yang dianggap wajar (toleransi), dan arah efek checkout saat penghitungan.
3. Apakah SKU berstok nol perlu dihitung, kenapa ada hari dengan lonjakan hitungan, dan kenapa koordinat kosong di September. Apakah hitung ulang disengaja.
4. Apakah kemasan lama dan baru harus dihitung terpisah.
5. Data harga per SKU (untuk nilai Rupiah) dan export stok SAP terbaru (untuk perbandingan Heron vs Real vs SAP).
6. Konfirmasi alias PIC yang masih dugaan (lihat `PIC_ALIAS` di `js/parse.js`).
7. Izin kantor untuk layanan AI luar dan hosting.

## Opsi yang ditimbang dan ditolak atau ditunda
- Backend dan basis data: ditunda sampai banyak pengguna atau perlu data terkumpul otomatis.
- AI lokal di laptop kerja (RAM 3,8 GB) dan model di dalam browser: tidak cocok. Kaggle atau Colab: untuk eksperimen, bukan layanan tetap.
- Cloudflare Access sebagai pengaman hosting: gratis sampai 50 pengguna, tapi butuh domain dan kemungkinan kartu kredit.
- Penilaian per SKU saja (varian digabung): ditawarkan sebagai pilihan, belum diminta.
- Model prediksi yang lebih canggih dari skor risiko: belum perlu.

## Cara kerja dengan pengguna
- Pengguna sering menjawab singkat atau menyerahkan keputusan. Beri rekomendasi dengan alasan, tulis asumsi, tanya hanya yang perlu.
- Pengguna sudah melihat sebagian tampilan di Chrome dan melaporkan hal yang janggal lewat tangkapan layar (contohnya selisih angka kartu, yang ternyata beda arti baris vs SKU unik). Verifikasi angka dengan data asli sebelum menyimpulkan.
- Jangan push atau deploy tanpa izin. Jangan commit data perusahaan.

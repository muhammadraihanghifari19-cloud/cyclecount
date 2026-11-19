# Cycle Count Dashboard: catatan proyek

Dashboard stock accuracy hasil cycle count gudang Tegal. Untuk pemakaian internal. Bahasa halaman dan percakapan: Indonesia.

## Preferensi pengguna
- Jawaban dan teks di halaman harus **singkat**. Tidak ada paragraf penjelasan di UI. Istilah gudang (Heron, Real, Gap, SKU, PIC) tidak perlu dijelaskan.
- Pengguna awam logistik. Ambil keputusan sendiri kalau diserahkan, tulis asumsinya, dan tanya hanya untuk hal yang benar-benar perlu.
- Data perusahaan **tidak disimpan di server**. Tiap pengguna upload Excel dari laptopnya sendiri, dan halaman memprosesnya di browser. Tidak ada backend.
- Jangan commit data perusahaan (`data/`, `*.xlsx`, `*.csv` sudah di `.gitignore`). Tes memakai data tiruan.
- Jangan push ke GitHub atau deploy tanpa izin pengguna.

## Cara jalan
- Buka `index.html` di browser, klik Upload .xlsx (file CYCLE COUNT TEGAL). Pembacaan file 21 MB butuh 20-35 detik di laptop Celeron.
- `npm test` (Node, `node:test`, tanpa dependensi). `npm run backtest` untuk menguji skor risiko (butuh `data/CYCLE COUNT TEGAL.xlsx`).
- Python tidak terpasang. Uji UI otomatis memakai jsdom dan fake-indexeddb yang dipasang di folder sementara di luar repo (tidak ikut repo).
- Setiap kali bentuk data hasil bacaan berubah, naikkan `SCHEMA` di `js/store.js`.

## Struktur
`index.html`, `css/style.css`, `js/parse.js` (baca tab, bersihkan label, kode SAP, tab penyebab), `js/calc.js` (semua hitungan), `js/export.js`, `js/store.js` (cache IndexedDB), `js/ui.js`, `scripts/backtest.js`, `tests/`, `lib/` (SheetJS, Chart.js). README.md berisi rumus dan fitur lengkap.

## Keputusan penting
- Tab sumber: `CC BY HERON <BULAN> 26` (11 bulan, kolom dibaca lewat nama header), `SKU CLASS` (kelas A/B/C), `REPORT HUMAN ERROR`, `POTENSIAL GAP`.
- Item yang dinilai = **SKU + kode SAP** (stok Heron dan Real dicatat per kombinasi itu; varian kemasan punya angka sendiri). Kode Odoo diubah ke SAP: SAP = 4.000.000.000 + Odoo. Cakupan hitung dihitung per SKU saja.
- Akurasi SKU = 1 - |Real - Heron| / Heron. Akurasi total = 1 - total selisih absolut / total Heron. Gap dihitung sendiri. Display = total - storage.
- Kartu "SKU dihitung" menghitung SKU unik. Kartu dan tabel lain memakai **baris hitungan** (satu SKU bisa dihitung beberapa kali sebulan).
- Warna akurasi: hijau di atas atau sama dengan target (bawaan 99%), kuning di bawah target tapi 95% ke atas, merah di bawah 95%. Kelas tidak ikut. Prioritas kerja memakai tab Risiko.
- Skor risiko 0-100 dari riwayat 6 bulan (bobot di `RISK_WEIGHTS`, dipilih lewat backtest). Skor 80 ke atas = risiko tinggi. Laporan human error hanya jadi alasan tambahan.
- Label Brand dan PIC dibersihkan saat dibaca (alias PIC ada di `js/parse.js`, `PIC_ALIAS`). Satu alias adalah dugaan dan belum dikonfirmasi pengguna.

## Fakta data yang sudah dicek
- Kolom TOTAL CT kosong atau 0 di semua tab, jadi tidak ada analisis waktu pengerjaan.
- Kolom UU ET02 di tab bulan rusak (`#REF!` atau kosong). Tab UU SAP hanya satu potret waktu. Perbandingan Heron vs SAP belum bisa dibuat.
- Tidak ada kolom harga, jadi tidak ada nilai Rupiah.
- Sebagian SKU dihitung lebih dari sekali sebulan: varian kode SAP (normal) dan hitung ulang di hari lain (September terbesar). 8-22% baris di Januari sampai Mei berstok nol di sistem dan fisik.
- Tidak ada aturan resmi soal frekuensi hitung per kelas atau batas selisih "wajar". Itu pertanyaan untuk tim.

## Ditahan atau belum dikerjakan
- Kotak "Pertanyaan cepat" (tombol laporan dan pencocokan kata kunci), lalu asisten AI sebagai penerjemah pertanyaan ke laporan. AI lokal: Ollama di laptop pribadi (RAM 16 GB, RTX 3050 4 GB VRAM), mulai dengan `qwen3.5:4b`, naik ke `qwen3:8b` kalau kurang pintar. Alternatif: Gemini API gratis dengan kunci milik pengguna. Kunci API tidak boleh ditanam di berkas halaman. AI hanya menerjemahkan pertanyaan jadi perintah laporan, perhitungan tetap oleh kode.
- Kartu "Baris cocok" tanpa baris stok nol, dan penanda "dihitung ulang" di tabel Detail SKU.
- Pilihan penilaian per SKU saja (varian digabung). Hanya kalau ada yang meminta.
- Penyimpanan di browser jadi opsional (bawaan mati), alias PIC dipindah dari kode ke pengaturan, `.vercelignore`, `noindex`, lalu hosting statis (Vercel atau lainnya).
- Uji visual: sebagian tampilan sudah dilihat pengguna di Chrome. Grafik tab Risiko dan Penyebab, hasil cetak PDF, dan unduhan Excel per PIC belum diperiksa manual.

## Lingkungan
- Laptop kerja (tempat proyek ini dikembangkan): Celeron N4020, RAM 3,8 GB. Dibawa ke rapat, jadi dashboard harus jalan offline.
- Laptop pribadi (IdeaPad Gaming 3, Ryzen 5 6600H, RTX 3050 4 GB, RAM 16 GB): untuk menguji AI lokal. Salinan Excel di laptop pribadi adalah keputusan pengguna, bukan sesuatu yang perlu diubah.

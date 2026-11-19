/* Ekspor hasil filter ke CSV / Excel. toCSV dan toRecords murni supaya bisa dites. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CCExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const HEADERS = ['Bulan', 'Tanggal', 'PIC', 'Brand', 'Kelas', 'SKU No', 'Kode SAP', 'Produk', 'Heron', 'Real', 'Gap',
                   'Heron Storage', 'Real Storage', 'Gap Storage', 'Heron Display', 'Real Display', 'Gap Display', 'Akurasi (%)'];

  // Nilai storage/display yang kosong (null) menjadi sel kosong.
  const opt = v => (v === null || v === undefined ? '' : v);

  function toRecords(list) {
    return list.map(r => [r.monthLabel, r.date, r.pic, r.brand, r.cls, r.sku, r.code || '', r.name, r.heron, r.real, r.gap,
                          opt(r.sHeron), opt(r.sReal), opt(r.sGap), opt(r.dHeron), opt(r.dReal), opt(r.dGap),
                          Math.round(r.acc * 10000) / 100]);
  }

  // Awalan = + - @ pada teks bisa dibaca Excel sebagai rumus, jadi diberi tanda petik.
  function cell(v) {
    let s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : String(v);
    if (/[",\r\n;]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function csvFrom(headers, records) {
    const lines = [headers.map(cell).join(',')].concat(records.map(r => r.map(cell).join(',')));
    return '\uFEFF' + lines.join('\r\n');
  }

  function toCSV(list) {
    return csvFrom(HEADERS, toRecords(list));
  }

  /* ---------- checklist risiko ---------- */

  // Dua kolom terakhir dikosongkan untuk diisi petugas.
  const RISK_HEADERS = ['PIC', 'Skor', 'SKU No', 'Kode SAP', 'Produk', 'Brand', 'Kelas', 'Alasan', 'Hasil hitung', 'Catatan'];

  function riskRecords(list) {
    return list.map(x => [x.pic, x.score, x.sku, x.code || '', x.name, x.brand, x.cls, x.reasons.join('; '), '', '']);
  }

  // Nama sheet Excel: maksimal 31 karakter, tanpa [ ] : * ? / \ , dan tidak boleh kosong.
  function sheetName(s, used) {
    let n = String(s || '').replace(/[\[\]:*?\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
    if (used) {
      let base = n, i = 2;
      while (used.has(n.toLowerCase())) n = base.slice(0, 31 - String(i).length - 1) + ' ' + i++;
      used.add(n.toLowerCase());
    }
    return n;
  }

  function riskCSV(list) {
    return csvFrom(RISK_HEADERS, riskRecords(list));
  }

  // Satu sheet per PIC, masing-masing berisi perPic item teratas menurut skor (list sudah terurut).
  function riskByPic(list, perPic) {
    const m = new Map();
    for (const x of list) {
      const k = x.pic || 'Tidak diketahui';
      if (!m.has(k)) m.set(k, []);
      if (m.get(k).length < perPic) m.get(k).push(x);
    }
    return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function downloadCSV(list, name) {
    download(new Blob([toCSV(list)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
  }

  function downloadRiskCSV(list, name) {
    download(new Blob([riskCSV(list)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
  }

  function downloadRiskXLSX(XLSX, list, name, perPic) {
    const wb = XLSX.utils.book_new(), used = new Set();
    for (const [pic, items] of riskByPic(list, perPic || 50)) {
      const ws = XLSX.utils.aoa_to_sheet([RISK_HEADERS].concat(riskRecords(items)));
      ws['!cols'] = [14, 7, 16, 12, 50, 14, 8, 55, 14, 24].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName(pic, used));
    }
    XLSX.writeFile(wb, name + '.xlsx');
  }

  function downloadXLSX(XLSX, list, name) {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS].concat(toRecords(list)));
    ws['!cols'] = [16, 12, 22, 14, 12, 16, 12, 50, 10, 10, 10, 14, 14, 13, 14, 14, 13, 12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Akurasi per SKU');
    XLSX.writeFile(wb, name + '.xlsx');
  }

  return { HEADERS, RISK_HEADERS, toRecords, toCSV, csvFrom, riskRecords, riskCSV, riskByPic, sheetName,
           downloadCSV, downloadXLSX, downloadRiskCSV, downloadRiskXLSX };
});

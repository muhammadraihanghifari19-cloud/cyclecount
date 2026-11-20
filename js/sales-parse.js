/* Parser CSV transaksi Magpie. Bebas DOM supaya bisa dites di Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SalesParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                   Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

  // "25 Oct, 2026, 13:08" → "2026-10-25". Pre-kompilasi regex sekali pakai.
  const RE_DATE = /(\d{1,2})\s+([A-Za-z]{3})[^0-9]*(\d{4})/;
  function parseDate(ts) {
    if (!ts) return null;
    const m = ts.match(RE_DATE);
    if (!m) return null;
    const mo = MONTHS[m[2]]; if (!mo) return null;
    return m[3] + '-' + String(mo).padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }

  // "25.500" → 25500 | "25500" → 25500 | lainnya → null
  function parsePrice(v) {
    if (v === '' || v === null || v === undefined) return null;
    const s = String(v).trim().replace(/\./g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // Parser CSV yang mengerti tanda kutip. Kembalikan array kolom per baris.
  function parseRow(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  // Parse satu teks CSV menjadi array baris objek.
  // Semua baris punya kutip di ORDER_TIMESTAMP, jadi pakai parser kolom-ke-kolom yang langsung
  // mengambil hanya kolom yang diperlukan tanpa membuat array lengkap per baris.
  function parseCSV(text) {
    const eol = text.indexOf('\n');
    if (eol < 0) return { rows: [], skipped: 0, header: [] };
    const header = parseRow(text.slice(0, eol).replace(/\r$/, ''));
    const idx = {};
    header.forEach((h, i) => { idx[h.trim()] = i; });
    const need = ['ORDER_TIMESTAMP', 'BRAND_NAME', 'MARKETPLACE_NAME',
                  'ORDER_NUMBER', 'SKU', 'SAP_CODE', 'IS_BUNDLE', 'QUANTITY', 'VALUE_HET'];
    for (const k of need) { if (idx[k] === undefined) return { rows: [], skipped: 0, header }; }
    const nCols = header.length;
    const iTS = idx.ORDER_TIMESTAMP, iBrand = idx.BRAND_NAME, iMP = idx.MARKETPLACE_NAME;
    const iOrd = idx.ORDER_NUMBER, iSku = idx.SKU, iSap = idx.SAP_CODE;
    const iBun = idx.IS_BUNDLE, iQty = idx.QUANTITY, iHet = idx.VALUE_HET;
    // Kolom yang perlu diambil (sorted ascending untuk scan satu kali per baris).
    const need_idx = [iTS, iBrand, iMP, iOrd, iSku, iSap, iBun, iQty, iHet].sort((a, b) => a - b);

    const rows = []; let skipped = 0;
    const lines = text.split('\n');
    for (let li = 1; li < lines.length; li++) {
      const line = lines[li];
      if (!line || line === '\r') continue;
      // Extrak hanya kolom yang dibutuhkan dengan scanner minimal.
      const llen = line.length;
      let ci = 0, pos = 0, ni = 0, q = false;
      const vals = new Array(nCols); // pre-allocate, isi hanya yang perlu
      let start = 0;
      // Scan karakter tapi hanya simpan nilai pada indeks yang dibutuhkan.
      outer: while (pos <= llen) {
        const c = pos < llen ? line.charCodeAt(pos) : 10;
        if (c === 34) { // '"'
          q = !q; pos++;
        } else if (c === 44 && !q) { // ','
          if (ni < need_idx.length && ci === need_idx[ni]) {
            let val = line.slice(start, pos);
            if (val.charCodeAt(0) === 34) val = val.slice(1, val.length - 1); // strip outer quotes
            vals[ci] = val; ni++;
          }
          ci++; pos++; start = pos;
        } else if (c === 10 && !q) { // '\n'
          if (ni < need_idx.length && ci === need_idx[ni]) {
            let val = line.slice(start, pos);
            if (val.endsWith('\r')) val = val.slice(0, -1);
            if (val.charCodeAt(0) === 34) val = val.slice(1, val.length - 1);
            vals[ci] = val;
          }
          ci++; break outer;
        } else pos++;
      }
      if (ci < nCols) { skipped++; continue; }
      const date = parseDate(vals[iTS]);
      if (!date) { skipped++; continue; }
      const price = parsePrice(vals[iHet]);
      const valueHet = (price !== null && price >= 1 && price <= 1000000) ? price : null;
      rows.push({
        date, monthKey: date.slice(0, 7),
        brand: vals[iBrand] || '', marketplace: vals[iMP] || '',
        orderNum: vals[iOrd] || '', sku: vals[iSku] || '', sapCode: vals[iSap] || '',
        isBundle: vals[iBun] === 'true',
        qty: parseInt(vals[iQty]) || 0,
        valueHet, priceRaw: price
      });
    }
    return { rows, skipped, header };
  }

  // Gabungkan banyak hasil parseCSV. Deduplikasi berdasarkan ORDER_NUMBER + SKU.
  function mergeResults(results) {
    const all = [], seen = new Set(); let totalSkipped = 0;
    for (const r of results) {
      totalSkipped += r.skipped;
      for (const row of r.rows) {
        const k = row.orderNum + '\x00' + row.sku;  // \x00 lebih cepat di-hash dari '|'
        if (seen.has(k)) continue;
        seen.add(k); all.push(row);
      }
    }
    return { rows: all, totalSkipped };
  }

  // Browser: baca banyak File sekaligus dengan progres.
  async function loadFiles(files, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (onProgress) onProgress('Membaca ' + f.name + ' (' + (i + 1) + '/' + files.length + ')...');
      await new Promise(res => setTimeout(res, 0)); // beri browser waktu untuk update UI
      const text = await f.text();
      if (onProgress) onProgress('Parsing ' + f.name + '...');
      await new Promise(res => setTimeout(res, 0));
      const r = parseCSV(text);
      results.push(Object.assign(r, { fileName: f.name, fileSize: f.size }));
    }
    if (onProgress) onProgress('Menggabungkan file...');
    await new Promise(res => setTimeout(res, 0));
    const merged = mergeResults(results);
    return { merged, perFile: results };
  }

  return { parseDate, parsePrice, parseRow, parseCSV, mergeResults, loadFiles };
});

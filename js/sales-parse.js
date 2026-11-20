/* Parser CSV transaksi Magpie. Bebas DOM supaya bisa dites di Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SalesParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                   Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

  // "25 Oct, 2026, 13:08" atau "1 Oct, 2026, 08:52" → "2026-10-25"
  function parseDate(ts) {
    if (!ts) return null;
    const m = ts.match(/(\d{1,2})\s+([A-Za-z]{3})[^0-9]*(\d{4})/);
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

  // Konversi satu baris menjadi objek ringkas. maxPrice: batas atas harga (bawaan 100000).
  function toRow(cols, idx) {
    const sku = cols[idx.SKU] || '';
    const sapRaw = cols[idx.SAP_CODE] || '';
    const isBundle = cols[idx.IS_BUNDLE] === 'true';
    const qty = parseInt(cols[idx.QUANTITY]) || 0;
    const price = parsePrice(cols[idx.VALUE_HET]);
    const valueHet = (price !== null && price >= 1 && price <= 1000000) ? price : null;
    const date = parseDate(cols[idx.ORDER_TIMESTAMP]);
    return {
      date, monthKey: date ? date.slice(0, 7) : null,
      brand: cols[idx.BRAND_NAME] || '',
      marketplace: cols[idx.MARKETPLACE_NAME] || '',
      store: cols[idx.STORE] || '',
      orderNum: cols[idx.ORDER_NUMBER] || '',
      sku, sapCode: sapRaw,
      isBundle, qty, valueHet,
      priceOk: valueHet !== null,
      priceRaw: price
    };
  }

  // Parse satu teks CSV menjadi array baris objek.
  // Harga di atas Rp 1.000.000 dianggap ngaco dan di-null-kan (qty tetap dihitung).
  function parseCSV(text) {
    const lines = text.split('\n');
    const header = parseRow(lines[0]);
    const idx = {};
    header.forEach((h, i) => { idx[h.trim()] = i; });
    const need = ['ORDER_TIMESTAMP', 'BRAND_NAME', 'MARKETPLACE_NAME', 'STORE',
                  'ORDER_NUMBER', 'SKU', 'SAP_CODE', 'IS_BUNDLE', 'QUANTITY', 'VALUE_HET'];
    for (const k of need) { if (idx[k] === undefined) return { rows: [], skipped: 0, header }; }
    const rows = [], seen = new Set(); let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, '');
      if (!line) continue;
      const cols = parseRow(line);
      if (cols.length !== header.length) { skipped++; continue; }
      const r = toRow(cols, idx);
      if (!r.date) { skipped++; continue; }
      rows.push(r);
    }
    return { rows, skipped, header };
  }

  // Gabungkan banyak hasil parseCSV. Deduplikasi berdasarkan ORDER_NUMBER + SKU.
  // Duplikat muncul kalau file tumpang tindih rentangnya.
  function mergeResults(results) {
    const all = [], seen = new Set(); let totalSkipped = 0;
    for (const r of results) {
      totalSkipped += r.skipped;
      for (const row of r.rows) {
        const k = row.orderNum + '|' + row.sku;
        if (seen.has(k)) continue;
        seen.add(k); all.push(row);
      }
    }
    return { rows: all, totalSkipped, dupes: seen.size - all.length };
  }

  // Browser: baca banyak File sekaligus, tampilkan progres.
  async function loadFiles(files, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (onProgress) onProgress('Membaca ' + f.name + ' (' + (i + 1) + '/' + files.length + ')...');
      const text = await f.text();
      const r = parseCSV(text);
      results.push(Object.assign(r, { fileName: f.name, fileSize: f.size }));
      await new Promise(res => setTimeout(res, 0));
    }
    const merged = mergeResults(results);
    return { merged, perFile: results };
  }

  return { parseDate, parsePrice, parseRow, parseCSV, mergeResults, loadFiles };
});

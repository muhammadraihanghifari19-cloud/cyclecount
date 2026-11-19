/* Membaca tab "CC BY HERON <BULAN> 26" dari workbook. Bagian murni bisa dites di Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calc.js'));
  else root.CCParse = factory(root.CCCalc);
})(typeof self !== 'undefined' ? self : this, function (calc) {

  const MONTH_TAB = /^CC BY HERON .*(26|2026)$/i;
  const MONTHS = {
    JAN: 1, JANUARI: 1, FEB: 2, FEBRUARI: 2, MAR: 3, MARET: 3, APR: 4, APRIL: 4, MEI: 5,
    JUN: 6, JUNI: 6, JUL: 7, JULI: 7, AGU: 8, AGT: 8, AGUSTUS: 8,
    SEP: 9, SEPT: 9, SEPTEMBER: 9, OKT: 10, OKTOBER: 10, NOV: 11, NOVEMBER: 11, DES: 12, DESEMBER: 12
  };
  const NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Info bulan dari nama tab, atau null kalau bukan tab bulan.
  function monthInfo(tab) {
    const name = String(tab).trim();
    if (!MONTH_TAB.test(name)) return null;
    const parts = name.replace(/^CC BY HERON\s+/i, '').toUpperCase().split(/\s+/);
    const m = MONTHS[parts[0]];
    const y = parseInt(parts[parts.length - 1], 10);
    if (!m || isNaN(y)) return null;
    const year = y < 100 ? 2000 + y : y;
    const mm = String(m).padStart(2, '0');
    return { tab, key: year + '-' + mm, order: year * 100 + m, label: NAMES[m - 1] + ' ' + year,
             short: NAMES[m - 1].slice(0, 3) + ' ' + String(year).slice(2) };
  }

  function sortMonths(infos) {
    return [...infos].sort((a, b) => a.order - b.order);
  }

  function excelDate(serial) {
    return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);
  }

  function toNum(v) {
    return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  }

  // Kode SAP (nomor material) sebagai teks. Kode Odoo = SAP - 4000000000, jadi kode Odoo diubah ke SAP.
  // Di beberapa bulan kolom "Odoo Code" sebenarnya sudah berisi nilai SAP (>= 4 miliar). Bukan angka = kosong.
  const SAP_BASE = 4000000000;
  function normCode(v) {
    const n = toNum(v);
    if (n === null || n <= 0) return '';
    return String(n >= SAP_BASE ? n : SAP_BASE + n);
  }

  // aoa = array of arrays dari sheet. Kembalikan null kalau header tidak lengkap.
  function parseSheet(aoa, info) {
    if (!aoa || !aoa.length) return null;
    const head = aoa[0].map(h => String(h).trim().toLowerCase());
    const col = n => head.indexOf(n);
    const c = { tgl: col('tanggal'), pic: col('pic'), brand: col('brand'), sku: col('sku no'),
                name: col('product name'), heron: col('total heron'), real: col('total real') };
    if (Object.values(c).some(i => i < 0)) return null;
    // Storage = kolom "Stock Heron" + "Stock Real" yang berdampingan. Display = total - storage,
    // sehingga storage + display selalu sama dengan total. Tanpa kolom itu, pemisahan dikosongkan (null).
    const sh = col('stock heron');
    const hasSplit = sh >= 0 && head[sh + 1] === 'stock real';
    // Kode SAP: kolom "SAP Code" dulu, kalau kosong pakai "Odoo Code".
    const codeCols = [col('sap code'), col('odoo code')].filter(i => i >= 0);
    const codeOf = r => { for (const i of codeCols) { const k = normCode(r[i]); if (k) return k; } return ''; };
    const rows = [];
    for (let i = 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (typeof r[c.tgl] !== 'number') continue;
      const heron = toNum(r[c.heron]), real = toNum(r[c.real]);
      if (heron === null || real === null) continue;
      const gap = real - heron;
      const sku = String(r[c.sku]).trim(), code = codeOf(r);
      const row = {
        monthKey: info.key, monthShort: info.short, monthLabel: info.label,
        date: excelDate(r[c.tgl]), pic: String(r[c.pic]).trim(), brand: String(r[c.brand]).trim(),
        // key = SKU + kode SAP. Satu SKU bisa punya beberapa kode SAP (kemasan lama/baru), dan masing-masing dihitung sendiri.
        sku, code, key: code ? sku + '|' + code : sku, name: String(r[c.name]), cls: 'Tanpa kelas',
        heron, real, gap, absGap: Math.abs(gap), acc: calc.skuAcc(heron, real),
        sHeron: null, sReal: null, sGap: null, dHeron: null, dReal: null, dGap: null
      };
      if (hasSplit) {
        const sHeron = toNum(r[sh]) || 0, sReal = toNum(r[sh + 1]) || 0;
        row.sHeron = sHeron; row.sReal = sReal; row.sGap = sReal - sHeron;
        row.dHeron = heron - sHeron; row.dReal = real - sReal; row.dGap = row.dReal - row.dHeron;
      }
      rows.push(row);
    }
    return rows;
  }

  // Tab "SKU CLASS": daftar SKU beserta kelas (A/B/C) dan penjualan.
  function parseClassSheet(aoa) {
    if (!aoa || !aoa.length) return [];
    const head = aoa[0].map(h => String(h).trim().toLowerCase());
    const c = { brand: head.indexOf('brand'), sku: head.indexOf('no. sku'), name: head.indexOf('product name'),
                cls: head.indexOf('class'), sales: head.indexOf('penjualan'), sap: head.indexOf('sap code'), odoo: head.indexOf('odoo code') };
    if (c.sku < 0 || c.cls < 0) return [];
    const out = [];
    for (let i = 1; i < aoa.length; i++) {
      const r = aoa[i];
      const sku = String(r[c.sku]).trim(), cls = String(r[c.cls]).trim().toUpperCase();
      if (!sku || !cls) continue;
      const code = (c.sap >= 0 ? normCode(r[c.sap]) : '') || (c.odoo >= 0 ? normCode(r[c.odoo]) : '');
      out.push({ sku, code, cls, brand: c.brand >= 0 ? String(r[c.brand]).trim() : '',
                 name: c.name >= 0 ? String(r[c.name]) : '', sales: c.sales >= 0 ? (toNum(r[c.sales]) || 0) : 0 });
    }
    return out;
  }

  /* ---------- pembersihan label ----------
     Kolom Brand dan PIC di spreadsheet diisi manual: huruf besar/kecil campur (BIODEF/Biodef), nama pendek
     dan nama lengkap bergantian (AQIM / AQIM MA'RUF ZAMAN), typo (SANTOS), dan kadang terisi kode koordinat. */

  // Nama depan -> nama baku. Tambahkan di sini kalau ada varian lain. SYAEIF dianggap SAIF: SAIF berhenti
  // di Oktober dan SYAEIF hanya muncul di November, pola yang sama dengan PIC lain yang berganti ke nama lengkap.
  const PIC_ALIAS = { SANTOS: 'SANTOSO', SYAEIF: 'SAIF' };
  const UNKNOWN = 'Tidak diketahui';
  const norm = s => String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();

  // Nama depan huruf besar. Kosong atau berisi angka (kode koordinat) = tidak diketahui.
  function cleanPic(v) {
    const k = norm(v).toUpperCase();
    if (!k || /\d/.test(k)) return UNKNOWN;
    const first = k.split(' ')[0];
    return PIC_ALIAS[first] || first;
  }

  // Brand: cocokkan tanpa peduli huruf besar/kecil dengan brand di tab SKU CLASS. Brand kosong atau berisi angka
  // diambil dari SKU-nya. Brand lain memakai penulisan yang paling sering muncul.
  function cleanLabels(rows, classList) {
    const classBrand = new Map(), skuBrand = new Map();
    for (const e of classList) {
      const b = norm(e.brand), k = b.toUpperCase();
      if (k && !classBrand.has(k)) classBrand.set(k, b);
      if (b) skuBrand.set(e.sku, b);
    }
    const casing = new Map();
    for (const r of rows) {
      const raw = norm(r.brand), k = raw.toUpperCase();
      if (!k || /\d/.test(k) || classBrand.has(k)) continue;
      const m = casing.get(k) || new Map();
      m.set(raw, (m.get(raw) || 0) + 1);
      casing.set(k, m);
    }
    const top = new Map([...casing].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
    for (const r of rows) {
      const k = norm(r.brand).toUpperCase();
      if (classBrand.has(k)) r.brand = classBrand.get(k);
      else if (!k || /\d/.test(k)) r.brand = skuBrand.get(r.sku) || UNKNOWN;
      else r.brand = top.get(k);
      r.pic = cleanPic(r.pic);
    }
    return rows;
  }

  /* ---------- tab penyebab ---------- */

  function cleanArea(v) {
    const u = norm(v).toUpperCase();
    if (!u) return UNKNOWN;
    if (u.includes('OVERMODAL')) return 'OVERMODAL';
    if (u.startsWith('STORAGE')) return 'STORAGE';
    return u;
  }

  // Kolom "barcode atau kode odoo" diisi bebas (satu atau beberapa angka). 13 digit = barcode SKU,
  // sampai 6 digit = kode Odoo (diubah ke SAP). Selain itu diabaikan.
  function refsOf(v) {
    const out = [], seen = new Set();
    for (const t of String(v === null || v === undefined ? '' : v).split(/[^0-9]+/).filter(Boolean)) {
      let ref = null;
      if (t.length === 13) ref = { sku: t };
      else if (t.length <= 6 && Number(t) > 0) ref = { code: normCode(Number(t)) };
      const k = ref && (ref.sku ? 's' + ref.sku : 'c' + ref.code);
      if (ref && !seen.has(k)) { seen.add(k); out.push(ref); }
    }
    return out;
  }

  // Tab "REPORT HUMAN ERROR". Satu laporan bisa punya beberapa kategori (dipisah koma).
  function parseHumanError(aoa) {
    if (!aoa || !aoa.length) return [];
    const head = aoa[0].map(h => String(h).trim().toLowerCase());
    const c = { ts: head.indexOf('timestamp'), area: head.indexOf('area'), coord: head.indexOf('koordinat'),
                id: head.indexOf('barcode atau kode odoo'), cat: head.indexOf('kategori') };
    if (c.ts < 0 || c.cat < 0) return [];
    const out = [];
    for (let i = 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (typeof r[c.ts] !== 'number') continue;
      const cats = String(r[c.cat]).split(',').map(s => norm(s).toUpperCase()).filter(Boolean);
      if (!cats.length) continue;
      const date = excelDate(r[c.ts]);
      out.push({ date, monthKey: date.slice(0, 7), area: c.area >= 0 ? cleanArea(r[c.area]) : UNKNOWN,
                 coord: c.coord >= 0 ? norm(r[c.coord]) : '', cats, refs: c.id >= 0 ? refsOf(r[c.id]) : [] });
    }
    return out;
  }

  // Tab "POTENSIAL GAP": daftar bernomor "1. NAMA" dengan penanggung jawab di kolom sebelahnya.
  function parsePotentialGap(aoa) {
    const out = [];
    for (const r of aoa || []) {
      const m = /^\s*(\d+)\.\s*(.+)$/.exec(String(r[0] === undefined ? '' : r[0]));
      if (m && norm(m[2])) out.push({ no: Number(m[1]), name: norm(m[2]), owner: norm(r[1]) });
    }
    return out;
  }

  // Beri tiap baris kelas dari daftar kelas. SKU yang tidak ada di daftar = "Tanpa kelas".
  function applyClass(rows, classList) {
    const byKey = new Map(), bySku = new Map();
    for (const e of classList) {
      byKey.set(e.code ? e.sku + '|' + e.code : e.sku, e.cls);
      if (!bySku.has(e.sku)) bySku.set(e.sku, e.cls);
    }
    for (const r of rows) r.cls = byKey.get(r.key) || bySku.get(r.sku) || 'Tanpa kelas';
    return rows;
  }

  const tick = () => new Promise(r => setTimeout(r, 0));

  function decodeXml(s) {
    return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  // Ambil daftar nama tab langsung dari xl/workbook.xml di dalam zip, tanpa unzip seluruh file (file bisa >20 MB).
  async function sheetNamesFast(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const min = Math.max(0, u8.length - 65557);
    let e = u8.length - 22;
    while (e >= min && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < min) throw new Error('bukan file zip');
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('central directory rusak');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      if (dec.decode(u8.subarray(p + 46, p + 46 + nlen)) === 'xl/workbook.xml') {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(start, start + csize);
        const xml = method === 0 ? dec.decode(data)
          : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
        return [...xml.matchAll(/<sheet\s[^>]*?\bname="([^"]*)"/g)].map(m => decodeXml(m[1]));
      }
      p += 46 + nlen + elen + clen;
    }
    throw new Error('workbook.xml tidak ditemukan');
  }

  // Browser: baca hanya tab bulan, lalu proses satu per satu agar halaman tetap responsif.
  async function loadWorkbook(XLSX, buffer, onProgress) {
    let names;
    try { names = await sheetNamesFast(buffer); }
    catch (e) { names = XLSX.read(buffer, { type: 'array', bookSheets: true }).SheetNames; }
    const months = sortMonths(names.map(monthInfo).filter(Boolean));
    if (!months.length) return { months: [], rows: [], skipped: [], classList: [], humanErrors: [], potentialGaps: [] };
    if (onProgress) onProgress('Membaca file (20-30 detik)...');
    await tick();
    const find = t => names.find(n => String(n).trim().toUpperCase() === t);
    const classTab = find('SKU CLASS'), heTab = find('REPORT HUMAN ERROR'), pgTab = find('POTENSIAL GAP');
    const extra = [classTab, heTab, pgTab].filter(Boolean);
    const wb = XLSX.read(buffer, { type: 'array', sheets: months.map(m => m.tab).concat(extra) });
    const rows = [], skipped = [], used = [];
    for (let i = 0; i < months.length; i++) {
      const info = months[i];
      if (onProgress) onProgress('Memproses ' + info.label + ' (' + (i + 1) + '/' + months.length + ')');
      await tick();
      const part = parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[info.tab], { header: 1, defval: '' }), info);
      if (part === null) { skipped.push(info.tab); continue; }
      for (const r of part) rows.push(r);
      used.push(info);
    }
    const classList = classTab
      ? parseClassSheet(XLSX.utils.sheet_to_json(wb.Sheets[classTab], { header: 1, defval: '' })) : [];
    cleanLabels(rows, classList);
    applyClass(rows, classList);
    const aoa = t => XLSX.utils.sheet_to_json(wb.Sheets[t], { header: 1, defval: '' });
    return { months: used, rows, skipped, classList,
             humanErrors: heTab ? parseHumanError(aoa(heTab)) : [],
             potentialGaps: pgTab ? parsePotentialGap(aoa(pgTab)) : [] };
  }

  return { MONTH_TAB, PIC_ALIAS, normCode, refsOf, parseHumanError, parsePotentialGap, monthInfo, sortMonths, excelDate, parseSheet, parseClassSheet, cleanPic, cleanLabels, applyClass,
           sheetNamesFast, loadWorkbook };
});

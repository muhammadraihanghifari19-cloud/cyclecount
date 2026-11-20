/* Hitungan penjualan Magpie. Bebas DOM. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SalesCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Ringkasan sekumpulan baris.
  function summarize(list) {
    let qty = 0, omzet = 0, omzetRows = 0;
    const orders = new Set(), skus = new Set(), brands = new Set();
    for (const r of list) {
      qty += r.qty;
      if (r.valueHet !== null) { omzet += r.valueHet * r.qty; omzetRows++; }
      orders.add(r.orderNum); skus.add(r.sku); if (r.brand) brands.add(r.brand);
    }
    return { n: list.length, qty, omzet, omzetRows, orders: orders.size, skus: skus.size, brands: brands.size };
  }

  function groupBy(list, key) {
    const m = new Map();
    for (const r of list) {
      const k = r[key] || '(kosong)';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }

  // Ringkasan per kelompok, diurutkan sesuai field.
  function groupSummary(list, key, sort) {
    const rows = [...groupBy(list, key)].map(([k, v]) => Object.assign({ key: k }, summarize(v)));
    if (sort === 'qty') return rows.sort((a, b) => b.qty - a.qty);
    if (sort === 'omzet') return rows.sort((a, b) => b.omzet - a.omzet);
    return rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  // Top N baris berdasarkan qty atau omzet.
  function topN(list, key, n, sort) {
    return groupSummary(list, key, sort || 'qty').slice(0, n);
  }

  // Qty dan omzet per tanggal. dateKeys: array tanggal yang diinginkan (urut).
  function trendByDay(list, dateKeys) {
    const m = new Map();
    for (const r of list) {
      if (!r.date) continue;
      const e = m.get(r.date) || { qty: 0, omzet: 0 };
      e.qty += r.qty;
      if (r.valueHet !== null) e.omzet += r.valueHet * r.qty;
      m.set(r.date, e);
    }
    return dateKeys.map(d => m.get(d) || { qty: 0, omzet: 0 });
  }

  // Semua tanggal unik dalam list, terurut.
  function uniqueDates(list) {
    return [...new Set(list.map(r => r.date).filter(Boolean))].sort();
  }

  // Semua kunci bulan unik, terurut.
  function uniqueMonths(list) {
    return [...new Set(list.map(r => r.monthKey).filter(Boolean))].sort();
  }

  // Filter baris.
  function filterRows(list, f) {
    const q = (f.q || '').trim().toLowerCase();
    return list.filter(r =>
      (!f.brand || r.brand === f.brand) &&
      (!f.marketplace || r.marketplace === f.marketplace) &&
      (!f.dateFrom || r.date >= f.dateFrom) &&
      (!f.dateTo || r.date <= f.dateTo) &&
      (!f.bundleOnly ? true : !r.isBundle) &&   // bundleOnly = hanya non-bundle (punya SAP)
      (!q || r.sku.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q) ||
             (r.sapCode || '').toLowerCase().includes(q) ||
             (r.store || '').toLowerCase().includes(q)));
  }

  // Hubungkan baris penjualan ke data cycle count lewat SAP_CODE atau SKU.
  // ccRows: baris dari parsed-cache (heron, real, monthKey, sku, code, acc, cls).
  // Kembalikan Map { sku → { ccMonths: Set, lastAcc, cls } }.
  function linkToCc(salesList, ccRows) {
    const bySap = new Map(), bySku = new Map();
    for (const r of ccRows) {
      if (r.code) {
        const e = bySap.get(r.code) || { ccMonths: new Set(), accs: [], cls: r.cls };
        e.ccMonths.add(r.monthKey); e.accs.push(r.acc); if (r.cls && r.cls !== 'Tanpa kelas') e.cls = r.cls;
        bySap.set(r.code, e);
      }
      const es = bySku.get(r.sku) || { ccMonths: new Set(), accs: [], cls: r.cls };
      es.ccMonths.add(r.monthKey); es.accs.push(r.acc); if (r.cls && r.cls !== 'Tanpa kelas') es.cls = r.cls;
      bySku.set(r.sku, es);
    }
    const out = new Map();
    for (const r of salesList) {
      const key = r.sku;
      if (out.has(key)) continue;
      const e = (r.sapCode && bySap.get(r.sapCode)) || bySku.get(r.sku);
      if (e) {
        const lastAcc = e.accs.length ? e.accs[e.accs.length - 1] : null;
        out.set(key, { ccMonths: e.ccMonths.size, lastAcc, cls: e.cls });
      }
    }
    return out;
  }

  // Statistik harga: jumlah baris, batas bawah, tengah, atas, berapa yang di-null-kan.
  function priceStats(list) {
    const all = list.map(r => r.priceRaw).filter(v => v !== null && v > 0).sort((a, b) => a - b);
    if (!all.length) return { count: 0, min: 0, median: 0, max: 0, nulled: 0 };
    const nulled = list.filter(r => r.valueHet === null && r.priceRaw !== null).length;
    return { count: all.length, min: all[0], median: all[Math.floor(all.length / 2)], max: all[all.length - 1], nulled };
  }

  return { summarize, groupBy, groupSummary, topN, trendByDay, uniqueDates, uniqueMonths,
           filterRows, linkToCc, priceStats };
});

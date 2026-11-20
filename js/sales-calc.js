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

  // Apakah SKU barcode Paragon standar (8993137 + 6 digit)?
  function isStdSku(sku) { return /^8993137\d{6}$/.test(sku); }

  // Hitung SKU unik berdasarkan jenisnya.
  function skuBreakdown(list) {
    const std = new Set(), mp = new Set(), dup = new Set(), other = new Set();
    for (const r of list) {
      const s = r.sku;
      if (isStdSku(s)) std.add(s);
      else if (/^DUP/i.test(s)) dup.add(s);
      else if (/^2030/.test(s)) mp.add(s);
      else other.add(s);
    }
    return { std: std.size, mp: mp.size, dup: dup.size, other: other.size, total: std.size + mp.size + dup.size + other.size };
  }

  // Kata-kata yang menandakan SKU non-jual (NFS, gift, sample, tester, GWP).
  const NFS_RE = /\b(nfs|not[\s_-]*for[\s_-]*sale|gift|sample|tester|gwp|gratis)\b/i;
  function isNfs(name) { return NFS_RE.test(name || ''); }

  // --- FSN Classification ---
  // Klasifikasi Fast / Slow / Non-moving berdasarkan rolling window dari semua data yang ada.
  // Referensi: FSN analysis (inventory management), persentil berdasarkan distribusi qty per SKU.
  //
  // Batas:
  //   Fast  : qty SKU ≥ p67 dari distribusi qty SKU yang terjual (top sepertiga)
  //   Slow  : 0 < qty < p67
  //   Non   : qty = 0 dalam seluruh rentang data
  //
  // ccSkus (optional Set): SKU yang ada di data cycle count. Kalau diisi, SKU di luar cc
  // tetap diklasifikasi tapi ditandai "tidak ada di CC".
  function fsnClassify(allRows, ccSkus) {
    // Kumpulkan total qty per SKU dari seluruh data (semua bulan yang di-upload).
    const qtyBySku = new Map();
    for (const r of allRows) {
      if (!r.sku) continue;
      qtyBySku.set(r.sku, (qtyBySku.get(r.sku) || 0) + r.qty);
    }
    // Hitung p67 dari SKU yang terjual (qty > 0).
    const sold = [...qtyBySku.values()].filter(v => v > 0).sort((a, b) => a - b);
    const p67 = sold.length ? sold[Math.floor(sold.length * 0.67)] : 0;

    const result = new Map();
    for (const [sku, qty] of qtyBySku) {
      result.set(sku, { qty, fsn: qty >= p67 ? 'F' : qty > 0 ? 'S' : 'N', inCc: !ccSkus || ccSkus.has(sku) });
    }
    // Tambahkan SKU yang ada di CC tapi tidak terjual sama sekali.
    if (ccSkus) {
      for (const sku of ccSkus) {
        if (!result.has(sku)) result.set(sku, { qty: 0, fsn: 'N', inCc: true });
      }
    }
    return { result, p67, soldCount: sold.length, totalSku: result.size };
  }

  // Label FSN yang terbaca.
  function fsnLabel(code) {
    return code === 'F' ? 'Fast' : code === 'S' ? 'Slow' : 'Non-moving';
  }

  // Ringkasan FSN per brand: berapa SKU F, S, N per brand, plus qty total.
  function fsnByBrand(allRows, fsnMap) {
    const brands = new Map();
    for (const r of allRows) {
      const sku = r.sku, brand = r.brand || '(kosong)';
      if (!brands.has(brand)) brands.set(brand, { brand, F: new Set(), S: new Set(), N: new Set(), qty: 0 });
      const b = brands.get(brand);
      b.qty += r.qty;
      const info = fsnMap.result.get(sku);
      if (info) b[info.fsn].add(sku);
    }
    return [...brands.values()]
      .map(b => ({ brand: b.brand, qty: b.qty, fast: b.F.size, slow: b.S.size, non: b.N.size, total: b.F.size + b.S.size + b.N.size }))
      .sort((a, b) => b.qty - a.qty);
  }

  // Rentang tanggal dari data yang ada.
  function dataRange(list) {
    if (!list.length) return null;
    let min = '9999', max = '';
    for (const r of list) { if (r.date && r.date < min) min = r.date; if (r.date && r.date > max) max = r.date; }
    const months = new Set(list.map(r => r.monthKey).filter(Boolean));
    return { from: min, to: max, months: months.size };
  }

  return { summarize, groupBy, groupSummary, topN, trendByDay, uniqueDates, uniqueMonths,
           filterRows, linkToCc, priceStats, isStdSku, skuBreakdown,
           isNfs, fsnClassify, fsnLabel, fsnByBrand, dataRange };
});

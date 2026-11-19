/* Fungsi hitungan murni (tanpa DOM) supaya bisa dites di Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CCCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Akurasi satu SKU: 1 - |Real - Heron| / Heron, minimal 0.
  function skuAcc(heron, real) {
    if (heron === 0) return real === 0 ? 1 : 0;
    return Math.max(0, 1 - Math.abs(real - heron) / Math.abs(heron));
  }

  // Di bawah target. Nilai yang tepat sama dengan target dianggap tidak bermasalah.
  function isBelow(acc, target) {
    return acc < target - 1e-9;
  }

  // Ringkasan sekumpulan baris. Akurasi total = 1 - sum|gap| / sum Heron.
  function summarize(list, target) {
    let heron = 0, real = 0, abs = 0, match = 0, below = 0;
    for (const r of list) {
      heron += r.heron; real += r.real; abs += r.absGap;
      if (r.gap === 0) match++;
      if (target !== undefined && isBelow(r.acc, target)) below++;
    }
    return { n: list.length, heron, real, abs, match, below, acc: heron ? Math.max(0, 1 - abs / heron) : 1 };
  }

  function groupBy(list, key) {
    const m = new Map();
    for (const r of list) {
      const k = r[key];
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }

  // Ringkasan per kelompok, diurutkan menurut nama kelompok.
  function groupSummary(list, key, target) {
    return [...groupBy(list, key)]
      .map(([k, v]) => Object.assign({ key: k }, summarize(v, target)))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  // Peringkat: akurasi terendah di atas.
  function rankByAcc(groups) {
    return [...groups].sort((a, b) => a.acc - b.acc || (a.key < b.key ? -1 : 1));
  }

  function filterRows(rows, f) {
    const q = (f.q || '').trim().toLowerCase();
    return rows.filter(r =>
      (!f.month || r.monthKey === f.month) &&
      (!f.brand || r.brand === f.brand) &&
      (!f.pic || r.pic === f.pic) &&
      (!f.cls || r.cls === f.cls) &&
      (!f.date || r.date === f.date) &&
      (!f.onlyGap || r.gap !== 0) &&
      (!f.belowOnly || isBelow(r.acc, f.target)) &&
      (!q || r.sku.toLowerCase().includes(q) || (r.code || '').includes(q) || r.name.toLowerCase().includes(q)));
  }

  // Kolom gap diurutkan menurut nilai absolut. Kolom storage/display yang kosong (null) dianggap paling kecil.
  function sortRows(list, key, dir) {
    const split = ['sHeron', 'sReal', 'sGap', 'dHeron', 'dReal', 'dGap'];
    const val = r => {
      if (key === 'gap') return r.absGap;
      if (split.includes(key)) {
        const v = r[key];
        return v === null || v === undefined ? -1 : (key.endsWith('Gap') ? Math.abs(v) : v);
      }
      return r[key];
    };
    return [...list].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
  }

  // Tren akurasi per bulan: satu seri "Total" dan satu seri per brand. null = tidak ada data.
  function trend(rows, monthKeys) {
    const brands = [...new Set(rows.map(r => r.brand))].filter(Boolean).sort();
    const series = (pred) => monthKeys.map(k => {
      const l = rows.filter(r => r.monthKey === k && pred(r));
      return l.length ? summarize(l).acc : null;
    });
    return {
      labels: monthKeys,
      series: [{ name: 'Total', data: series(() => true) }]
        .concat(brands.map(b => ({ name: b, data: series(r => r.brand === b) })))
    };
  }

  // Kunci bulan sebelumnya yang punya data. monthKeys harus sudah terurut.
  function previousMonthKey(monthKeys, key) {
    const i = monthKeys.indexOf(key);
    return i > 0 ? monthKeys[i - 1] : null;
  }

  // Kunci item = SKU + kode SAP (varian kemasan dihitung terpisah). Baris tanpa key memakai SKU.
  const keyOf = r => r.key || r.sku;

  // Item (SKU + kode SAP) yang di bawah target di >= minMonths bulan. Baris yang sama dalam satu bulan digabung.
  function problemSkus(rows, target, minMonths) {
    if (minMonths === undefined) minMonths = 2;
    const agg = new Map();
    for (const r of rows) {
      let e = agg.get(keyOf(r));
      if (!e) { e = { key: keyOf(r), sku: r.sku, code: r.code || '', name: '', brand: '', months: new Map() }; agg.set(keyOf(r), e); }
      if (!e.name && r.name) e.name = r.name;
      if (!e.brand && r.brand) e.brand = r.brand;
      const m = e.months.get(r.monthKey) || { heron: 0, real: 0 };
      m.heron += r.heron; m.real += r.real;
      e.months.set(r.monthKey, m);
    }
    const out = [];
    for (const e of agg.values()) {
      const months = [...e.months]
        .map(([monthKey, v]) => ({ monthKey, heron: v.heron, real: v.real, acc: skuAcc(v.heron, v.real), abs: Math.abs(v.real - v.heron) }))
        .sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));
      const bad = months.filter(m => isBelow(m.acc, target));
      if (bad.length >= minMonths) {
        out.push({ key: e.key, sku: e.sku, code: e.code, name: e.name, brand: e.brand, months, badMonths: bad.length,
                   absGap: bad.reduce((a, m) => a + m.abs, 0) });
      }
    }
    return out.sort((a, b) => b.badMonths - a.badMonths || b.absGap - a.absGap);
  }

  /* ---------- storage vs display ---------- */

  function accOf(heron, abs) {
    return heron > 0 ? Math.max(0, 1 - abs / heron) : (abs === 0 ? 1 : 0);
  }

  // Ringkasan storage dan display. Baris tanpa pemisahan (sHeron null) dilewati. null kalau tidak ada baris.
  function splitSummary(list) {
    let n = 0, sH = 0, sR = 0, sA = 0, dH = 0, dR = 0, dA = 0;
    for (const r of list) {
      if (r.sHeron === null || r.sHeron === undefined) continue;
      n++;
      sH += r.sHeron; sR += r.sReal; sA += Math.abs(r.sGap);
      dH += r.dHeron; dR += r.dReal; dA += Math.abs(r.dGap);
    }
    if (!n) return null;
    return {
      n,
      storage: { heron: sH, real: sR, abs: sA, acc: accOf(sH, sA) },
      display: { heron: dH, real: dR, abs: dA, acc: accOf(dH, dA) },
      // Porsi display di total selisih absolut dan di total stok sistem.
      displayAbsShare: sA + dA ? dA / (sA + dA) : 0,
      displayStockShare: sH + dH ? dH / (sH + dH) : 0
    };
  }

  function splitTrend(rows, monthKeys) {
    const out = { storage: [], display: [] };
    for (const k of monthKeys) {
      const s = splitSummary(rows.filter(r => r.monthKey === k));
      out.storage.push(s ? s.storage.acc : null);
      out.display.push(s ? s.display.acc : null);
    }
    return out;
  }

  function splitGroup(list, key) {
    return [...groupBy(list, key)].map(([k, v]) => {
      const s = splitSummary(v);
      return { key: k, n: v.length, storage: s ? s.storage.acc : null, display: s ? s.display.acc : null };
    }).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  /* ---------- selisih lebih vs kurang ---------- */

  // Lebih: Real > Heron. Kurang: Real < Heron. Nilai "kurang" dikembalikan positif.
  function overUnder(list) {
    const o = { over: 0, overN: 0, under: 0, underN: 0, match: 0 };
    for (const r of list) {
      if (r.gap > 0) { o.over += r.gap; o.overN++; }
      else if (r.gap < 0) { o.under += -r.gap; o.underN++; }
      else o.match++;
    }
    o.net = o.over - o.under;
    return o;
  }

  function overUnderTrend(rows, monthKeys) {
    const over = [], under = [];
    for (const k of monthKeys) {
      const o = overUnder(rows.filter(r => r.monthKey === k));
      over.push(o.over); under.push(o.under);
    }
    return { over, under };
  }

  /* ---------- kelas SKU dan cakupan ---------- */

  const CLASS_ORDER = ['A', 'B', 'C'];
  function classRank(c) {
    const i = CLASS_ORDER.indexOf(c);
    return i >= 0 ? i : (c === 'Tanpa kelas' ? 99 : 50);
  }

  function classSummary(list, target) {
    return groupSummary(list, 'cls', target).sort((a, b) => classRank(a.key) - classRank(b.key) || (a.key < b.key ? -1 : 1));
  }

  // Daftar kelas per SKU (barcode): varian kemasan dengan kode SAP berbeda dihitung sebagai satu SKU,
  // dan SKU dianggap sudah dihitung kalau salah satu variannya muncul di bulan itu.
  function uniqueBySku(classList, brand) {
    const b = (brand || '').toUpperCase();
    const m = new Map();
    for (const e of classList) {
      if (b && String(e.brand).toUpperCase() !== b) continue;
      if (!m.has(e.sku)) m.set(e.sku, e);
    }
    return [...m.values()];
  }

  // Cakupan hitung per kelas: SKU di daftar kelas yang muncul di rows. Brand dibandingkan tanpa peduli huruf besar/kecil.
  function coverage(classList, rows, brand) {
    const seen = new Set(rows.map(r => r.sku));
    const m = new Map();
    for (const e of uniqueBySku(classList, brand)) {
      const o = m.get(e.cls) || { key: e.cls, total: 0, counted: 0 };
      o.total++;
      if (seen.has(e.sku)) o.counted++;
      m.set(e.cls, o);
    }
    return [...m.values()]
      .map(o => Object.assign(o, { pct: o.total ? o.counted / o.total : 0 }))
      .sort((a, b2) => classRank(a.key) - classRank(b2.key) || (a.key < b2.key ? -1 : 1));
  }

  // SKU di daftar kelas yang belum muncul di rows. Urut: kelas, lalu penjualan terbesar.
  function uncounted(classList, rows, brand, cls) {
    const seen = new Set(rows.map(r => r.sku));
    return uniqueBySku(classList, brand)
      .filter(e => !seen.has(e.sku) && (!cls || e.cls === cls))
      .sort((a, b2) => classRank(a.cls) - classRank(b2.cls) || (b2.sales || 0) - (a.sales || 0));
  }

  /* ---------- konsentrasi selisih ---------- */

  // Selisih absolut per SKU, terbesar dulu, dengan porsi kumulatifnya. "allowed" = batas selisih absolut agar
  // akurasi total mencapai target. skuToTarget = berapa SKU teratas yang harus dibereskan sepenuhnya untuk sampai ke sana.
  function pareto(list, target) {
    const byItem = new Map();
    for (const r of list) {
      const e = byItem.get(keyOf(r)) || { sku: r.sku, code: r.code || '', name: '', abs: 0 };
      e.abs += r.absGap;
      if (!e.name && r.name) e.name = r.name;
      byItem.set(keyOf(r), e);
    }
    const items = [...byItem.values()].sort((a, b) => b.abs - a.abs);
    const total = items.reduce((a, e) => a + e.abs, 0);
    const heron = list.reduce((a, r) => a + r.heron, 0);
    const allowed = heron - heron * target;
    let cum = 0;
    const top = items.map(e => { cum += e.abs; return { sku: e.sku, code: e.code, name: e.name, abs: e.abs, cumPct: total ? cum / total : 0 }; });
    let skuToTarget = 0;
    if (total > allowed + 1e-9) {
      let rest = total;
      for (const e of items) { rest -= e.abs; skuToTarget++; if (rest <= allowed + 1e-9) break; }
    }
    return {
      total, heron, allowed, need: Math.max(0, total - allowed), items: top, skuToTarget, count: items.length,
      share: n => (top.length ? top[Math.min(n, top.length) - 1].cumPct : 0)
    };
  }

  /* ---------- skor risiko ---------- */

  // Bobot skor (total 100). Dipilih dari backtest (scripts/backtest.js): dibanding hanya melihat bulan terakhir,
  // bobot ini menangkap lebih banyak selisih bulan berikutnya di top 50/100/200 dengan presisi setara.
  const RISK_WEIGHTS = { rec: 30, last: 10, size: 40, dir: 5, clsA: 10, clsB: 5, variant: 5 };

  // Skor 0-100 per item (SKU + kode SAP) dari riwayat bulan-bulan SEBELUM opts.before (kalau diisi),
  // maksimal opts.maxMonths bulan terakhir. Item tanpa riwayat tidak dinilai.
  function riskScores(rows, target, opts) {
    opts = opts || {};
    const w = Object.assign({}, RISK_WEIGHTS, opts.weights);
    const maxMonths = opts.maxMonths || 6;
    const smooth = opts.smooth === undefined ? 1 : opts.smooth;
    let keys = [...new Set(rows.map(r => r.monthKey))].sort();
    if (opts.before) keys = keys.filter(k => k < opts.before);
    keys = keys.slice(-maxMonths);
    const win = new Set(keys);

    const items = new Map(), skuCodes = new Map();
    for (const r of rows) {
      if (!win.has(r.monthKey)) continue;
      const k = keyOf(r);
      let e = items.get(k);
      if (!e) {
        e = { key: k, sku: r.sku, code: r.code || '', name: '', brand: '', cls: r.cls, pic: '', last: '', months: new Map() };
        items.set(k, e);
      }
      if (r.monthKey >= e.last) { e.last = r.monthKey; e.cls = r.cls; e.pic = r.pic; if (r.brand) e.brand = r.brand; if (r.name) e.name = r.name; }
      const m = e.months.get(r.monthKey) || { heron: 0, real: 0 };
      m.heron += r.heron; m.real += r.real;
      e.months.set(r.monthKey, m);
      const cs = skuCodes.get(r.sku) || new Set();
      cs.add(r.code || '');
      skuCodes.set(r.sku, cs);
    }

    // Per item: akurasi per bulan, bulan di bawah target, total selisih absolut, arah selisih.
    const list = [];
    let totalBad = 0, totalCounted = 0;
    for (const e of items.values()) {
      const ms = [...e.months].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([monthKey, v]) =>
        ({ monthKey, acc: skuAcc(v.heron, v.real), gap: v.real - v.heron }));
      const bad = ms.filter(m => isBelow(m.acc, target)).length;
      const signs = ms.map(m => Math.sign(m.gap)).filter(s => s !== 0);
      const consistent = signs.length >= 2 && signs.every(s => s === signs[0]) ? signs[0] : 0;
      list.push({ e, n: ms.length, bad, lastBad: isBelow(ms[ms.length - 1].acc, target),
                  abs: ms.reduce((a, m) => a + Math.abs(m.gap), 0), consistent });
      totalBad += bad; totalCounted += ms.length;
    }
    const prior = totalCounted ? totalBad / totalCounted : 0;
    const absSorted = list.map(x => x.abs).sort((a, b) => a - b);
    const pctRank = v => {
      let less = 0, eq = 0;
      for (const a of absSorted) { if (a < v) less++; else if (a === v) eq++; else break; }
      return absSorted.length ? (less + eq / 2) / absSorted.length : 0;
    };

    const out = list.map(x => {
      const e = x.e;
      const rec = (x.bad + smooth * prior) / (x.n + smooth);
      const size = pctRank(x.abs);
      const parts = {
        rec: w.rec * rec, last: x.lastBad ? w.last : 0, size: w.size * size, dir: x.consistent ? w.dir : 0,
        cls: e.cls === 'A' ? w.clsA : e.cls === 'B' ? w.clsB : 0,
        variant: skuCodes.get(e.sku).size > 1 ? w.variant : 0
      };
      const score = Math.round(parts.rec + parts.last + parts.size + parts.dir + parts.cls + parts.variant);
      const why = [];
      if (x.bad > 0) why.push([parts.rec, x.bad + ' dari ' + x.n + ' bulan di bawah target']);
      if (parts.last) why.push([parts.last, 'bulan terakhir di bawah target']);
      if (size >= 0.8) why.push([parts.size, 'selisih termasuk 20% terbesar']);
      if (parts.dir) why.push([parts.dir, x.consistent < 0 ? 'selalu kurang' : 'selalu lebih']);
      if (parts.cls) why.push([parts.cls, 'kelas ' + e.cls]);
      if (parts.variant) why.push([parts.variant, 'ada varian kemasan']);
      why.sort((a, b) => b[0] - a[0]);
      return { key: e.key, sku: e.sku, code: e.code, name: e.name, brand: e.brand, cls: e.cls, pic: e.pic, lastMonth: e.last,
               score, months: x.n, bad: x.bad, abs: x.abs, reasons: why.slice(0, 3).map(r => r[1]) };
    });
    return out.sort((a, b) => b.score - a.score || b.abs - a.abs);
  }

  /* ---------- penyebab (laporan human error) ---------- */

  // Hitung per kategori ('cats', satu laporan bisa masuk beberapa kategori) atau per area ('area'). Terbanyak dulu.
  function causeCounts(reports, field) {
    const m = new Map();
    for (const r of reports) {
      for (const v of (field === 'cats' ? r.cats : [r.area])) m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
  }

  // Jumlah laporan per bulan untuk topN kategori terbanyak. Sisanya digabung jadi "LAINNYA".
  function causeByMonth(reports, topN) {
    const months = [...new Set(reports.map(r => r.monthKey))].sort();
    const top = causeCounts(reports, 'cats').slice(0, topN).map(x => x.key);
    const names = top.slice();
    if (causeCounts(reports, 'cats').length > topN) names.push('LAINNYA');
    const series = names.map(name => ({ name, data: months.map(() => 0) }));
    for (const r of reports) {
      const i = months.indexOf(r.monthKey);
      for (const c of r.cats) {
        const s = series.find(x => x.name === (top.includes(c) ? c : 'LAINNYA'));
        if (s) s.data[i]++;
      }
    }
    return { months, series };
  }

  // Geser kunci bulan ('2026-11') sebanyak delta bulan.
  function shiftMonth(key, delta) {
    const [y, m] = key.split('-').map(Number);
    const t = y * 12 + (m - 1) + delta;
    return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0');
  }

  // Tambahkan kategori laporan human error sejak sinceMonth ke tiap item (cocok lewat barcode SKU atau kode SAP).
  function annotateReports(items, reports, sinceMonth) {
    const bySku = new Map(), byCode = new Map();
    for (const r of reports) {
      if (sinceMonth && r.monthKey < sinceMonth) continue;
      for (const ref of r.refs) {
        const m = ref.sku ? bySku : byCode, k = ref.sku || ref.code;
        if (!m.has(k)) m.set(k, new Set());
        r.cats.forEach(c => m.get(k).add(c));
      }
    }
    return items.map(x => {
      const cats = new Set([...(bySku.get(x.sku) || []), ...(x.code ? byCode.get(x.code) || [] : [])]);
      return Object.assign({}, x, { repCats: [...cats].sort() });
    });
  }

  return {
    causeCounts, causeByMonth, shiftMonth, annotateReports,
    riskScores, RISK_WEIGHTS, pareto, skuAcc, isBelow, summarize, groupBy, groupSummary, rankByAcc, filterRows, sortRows, trend, previousMonthKey, problemSkus,
    splitSummary, splitTrend, splitGroup, overUnder, overUnderTrend, classRank, classSummary, coverage, uncounted
  };
});

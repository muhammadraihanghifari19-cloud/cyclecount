const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

// Data tiruan (bukan data perusahaan).
function row(o) {
  const base = { monthKey: '2026-10', date: '2026-10-01', pic: 'A', brand: 'X', sku: 'S1', code: '', name: 'Produk 1', heron: 100, real: 100 };
  const r = Object.assign(base, o);
  r.key = r.code ? r.sku + '|' + r.code : r.sku;
  r.gap = r.real - r.heron;
  r.absGap = Math.abs(r.gap);
  r.acc = C.skuAcc(r.heron, r.real);
  return r;
}

test('skuAcc: kasus dasar', () => {
  assert.equal(C.skuAcc(0, 0), 1);
  assert.equal(C.skuAcc(0, 5), 0);
  assert.equal(C.skuAcc(100, 100), 1);
  assert.equal(C.skuAcc(100, 90), 0.9);
  assert.equal(C.skuAcc(100, 110), 0.9);
  assert.equal(C.skuAcc(100, 250), 0);
  assert.equal(C.skuAcc(100, 0), 0);
});

test('summarize: akurasi total = 1 - sum|gap| / sum Heron', () => {
  const list = [row({ heron: 100, real: 90 }), row({ heron: 300, real: 310 }), row({ heron: 100, real: 100 })];
  const s = C.summarize(list, 0.99);
  assert.equal(s.n, 3);
  assert.equal(s.heron, 500);
  assert.equal(s.abs, 20);
  assert.equal(s.acc, 1 - 20 / 500);
  assert.equal(s.match, 1);
  assert.equal(s.below, 2);
  assert.equal(C.summarize([]).acc, 1);
});

test('isBelow: tepat sama dengan target tidak bermasalah', () => {
  assert.equal(C.isBelow(0.99, 0.99), false);
  assert.equal(C.isBelow(1 - 0.01, 0.99), false);
  assert.equal(C.isBelow(0.9899, 0.99), true);
  assert.equal(C.isBelow(1, 0.99), false);
});

test('groupSummary dan rankByAcc: akurasi terendah di atas', () => {
  const list = [row({ pic: 'A', heron: 100, real: 100 }), row({ pic: 'B', heron: 100, real: 80 }), row({ pic: 'C', heron: 100, real: 95 })];
  const g = C.groupSummary(list, 'pic', 0.99);
  assert.deepEqual(g.map(x => x.key), ['A', 'B', 'C']);
  assert.deepEqual(C.rankByAcc(g).map(x => x.key), ['B', 'C', 'A']);
});

test('filterRows: gabungan filter', () => {
  const list = [
    row({ sku: 'S1', brand: 'X', pic: 'A' }),
    row({ sku: 'S2', brand: 'Y', pic: 'B', heron: 10, real: 5, name: 'Serum Cerah' }),
    row({ sku: 'S3', brand: 'Y', pic: 'A', monthKey: '2026-11' })
  ];
  assert.equal(C.filterRows(list, {}).length, 3);
  assert.equal(C.filterRows(list, { month: '2026-11' }).length, 1);
  assert.equal(C.filterRows(list, { brand: 'Y', pic: 'A' }).length, 1);
  assert.equal(C.filterRows(list, { onlyGap: true }).length, 1);
  assert.equal(C.filterRows(list, { q: 'serum' }).length, 1);
  assert.equal(C.filterRows(list, { belowOnly: true, target: 0.99 }).length, 1);
});

test('sortRows: gap diurutkan menurut nilai absolut', () => {
  const list = [row({ sku: 'a', real: 95 }), row({ sku: 'b', real: 130 }), row({ sku: 'c', real: 99 })];
  assert.deepEqual(C.sortRows(list, 'gap', -1).map(r => r.sku), ['b', 'a', 'c']);
  assert.deepEqual(C.sortRows(list, 'sku', 1).map(r => r.sku), ['a', 'b', 'c']);
});

test('sortRows: kolom storage/display, nilai kosong dianggap terkecil', () => {
  const mk = (sku, sHeron, sGap) => Object.assign(row({ sku }), { sHeron, sGap });
  const list = [mk('a', 5, -3), mk('b', null, null), mk('c', 50, 20)];
  assert.deepEqual(C.sortRows(list, 'sHeron', -1).map(r => r.sku), ['c', 'a', 'b']);
  assert.deepEqual(C.sortRows(list, 'sGap', -1).map(r => r.sku), ['c', 'a', 'b']);
  assert.deepEqual(C.sortRows(list, 'sHeron', 1).map(r => r.sku), ['b', 'a', 'c']);
});

test('trend: seri total dan per brand, bulan tanpa data = null', () => {
  const list = [
    row({ monthKey: '2026-10', brand: 'X', heron: 100, real: 90 }),
    row({ monthKey: '2026-10', brand: 'Y', heron: 100, real: 100 }),
    row({ monthKey: '2026-11', brand: 'X', heron: 100, real: 100 })
  ];
  const t = C.trend(list, ['2026-09', '2026-10', '2026-11']);
  assert.equal(t.series[0].name, 'Total');
  assert.deepEqual(t.series[0].data, [null, 0.95, 1]);
  assert.deepEqual(t.series.find(s => s.name === 'Y').data, [null, 1, null]);
});

test('previousMonthKey: bulan pertama tidak error', () => {
  const keys = ['2026-09', '2026-10', '2026-11'];
  assert.equal(C.previousMonthKey(keys, '2026-11'), '2026-10');
  assert.equal(C.previousMonthKey(keys, '2026-09'), null);
  assert.equal(C.previousMonthKey(keys, 'x'), null);
});

test('problemSkus: butuh >= 2 bulan di bawah target', () => {
  const list = [
    row({ sku: 'ONE', monthKey: '2026-10', heron: 100, real: 50 }),
    row({ sku: 'ONE', monthKey: '2026-11', heron: 100, real: 100 }),
    row({ sku: 'TWO', monthKey: '2026-10', heron: 100, real: 90 }),
    row({ sku: 'TWO', monthKey: '2026-11', heron: 100, real: 120 }),
    row({ sku: 'GOOD', monthKey: '2026-10' }),
    row({ sku: 'GOOD', monthKey: '2026-11' })
  ];
  const p = C.problemSkus(list, 0.99, 2);
  assert.deepEqual(p.map(x => x.sku), ['TWO']);
  assert.equal(p[0].badMonths, 2);
  assert.equal(p[0].absGap, 30);
});

test('problemSkus: SKU dua kali dalam satu bulan dihitung satu bulan', () => {
  const list = [
    row({ sku: 'DUP', monthKey: '2026-10', heron: 100, real: 50 }),
    row({ sku: 'DUP', monthKey: '2026-10', heron: 100, real: 50 })
  ];
  assert.equal(C.problemSkus(list, 0.99, 2).length, 0);
  assert.equal(C.problemSkus(list, 0.99, 1)[0].months.length, 1);
});

test('problemSkus: baris ganda digabung sebelum dinilai', () => {
  // Gabungan: Heron 200, Real 200 -> akurasi 100%, tidak bermasalah walau tiap baris selisih.
  const list = [
    row({ sku: 'MIX', monthKey: '2026-10', heron: 100, real: 90 }),
    row({ sku: 'MIX', monthKey: '2026-10', heron: 100, real: 110 }),
    row({ sku: 'MIX', monthKey: '2026-11', heron: 100, real: 90 })
  ];
  const p = C.problemSkus(list, 0.99, 1);
  assert.equal(p[0].badMonths, 1);
  assert.equal(p[0].months[0].acc, 1);
});

/* ---------- storage vs display, lebih/kurang, kelas, cakupan ---------- */

function split(o) {
  const r = row(o);
  r.sHeron = o.sHeron; r.sReal = o.sReal; r.sGap = o.sReal - o.sHeron;
  r.dHeron = r.heron - o.sHeron; r.dReal = r.real - o.sReal; r.dGap = r.dReal - r.dHeron;
  return r;
}

test('splitSummary: akurasi storage dan display dihitung terpisah', () => {
  const list = [
    split({ heron: 100, real: 100, sHeron: 90, sReal: 90 }),   // display 10 -> 10
    split({ heron: 100, real: 90, sHeron: 80, sReal: 80 })     // display 20 -> 10
  ];
  const s = C.splitSummary(list);
  assert.equal(s.storage.heron, 170);
  assert.equal(s.storage.abs, 0);
  assert.equal(s.storage.acc, 1);
  assert.equal(s.display.heron, 30);
  assert.equal(s.display.abs, 10);
  assert.equal(s.display.acc, 1 - 10 / 30);
  assert.equal(s.displayAbsShare, 1);
  assert.equal(s.displayStockShare, 30 / 200);
});

test('splitSummary: baris tanpa pemisahan dilewati, semua kosong = null', () => {
  const noSplit = row({});
  noSplit.sHeron = null;
  assert.equal(C.splitSummary([noSplit]), null);
  assert.equal(C.splitSummary([]), null);
  const s = C.splitSummary([noSplit, split({ heron: 10, real: 10, sHeron: 10, sReal: 10 })]);
  assert.equal(s.n, 1);
});

test('splitTrend dan splitGroup', () => {
  const list = [
    split({ monthKey: '2026-10', brand: 'X', heron: 100, real: 90, sHeron: 100, sReal: 90 }),
    split({ monthKey: '2026-11', brand: 'Y', heron: 100, real: 100, sHeron: 50, sReal: 50 })
  ];
  const t = C.splitTrend(list, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(t.storage, [null, 0.9, 1]);
  assert.deepEqual(t.display, [null, 1, 1]);
  const g = C.splitGroup(list, 'brand');
  assert.deepEqual(g.map(x => x.key), ['X', 'Y']);
  assert.equal(g[0].storage, 0.9);
});

test('overUnder: lebih, kurang, cocok, dan net', () => {
  const o = C.overUnder([row({ heron: 100, real: 130 }), row({ heron: 100, real: 90 }), row({ heron: 50, real: 40 }), row({})]);
  assert.equal(o.over, 30);
  assert.equal(o.overN, 1);
  assert.equal(o.under, 20);
  assert.equal(o.underN, 2);
  assert.equal(o.match, 1);
  assert.equal(o.net, 10);
});

test('overUnderTrend: bulan tanpa data bernilai 0', () => {
  const t = C.overUnderTrend([row({ monthKey: '2026-10', heron: 100, real: 120 })], ['2026-09', '2026-10']);
  assert.deepEqual(t.over, [0, 20]);
  assert.deepEqual(t.under, [0, 0]);
});

test('classSummary: urutan A, B, C lalu kelas lain dan Tanpa kelas', () => {
  const list = ['C', 'Tanpa kelas', 'A', 'B', 'AA'].map(c => row({ cls: c }));
  assert.deepEqual(C.classSummary(list, 0.99).map(x => x.key), ['A', 'B', 'C', 'AA', 'Tanpa kelas']);
});

test('filterRows: filter kelas', () => {
  const list = [row({ cls: 'A' }), row({ cls: 'B' })];
  assert.equal(C.filterRows(list, { cls: 'B' }).length, 1);
});

const CL = [
  { sku: '1', brand: 'Wardah', cls: 'A', name: 'a', sales: 10 },
  { sku: '2', brand: 'WARDAH', cls: 'A', name: 'b', sales: 50 },
  { sku: '3', brand: 'Emina', cls: 'B', name: 'c', sales: 5 },
  { sku: '4', brand: 'Emina', cls: 'C', name: 'd', sales: 1 }
];

test('coverage: SKU yang sudah dihitung per kelas', () => {
  const cov = C.coverage(CL, [row({ sku: '1' }), row({ sku: '1' }), row({ sku: '3' }), row({ sku: 'tidak ada di daftar' })]);
  assert.deepEqual(cov.map(x => [x.key, x.total, x.counted]), [['A', 2, 1], ['B', 1, 1], ['C', 1, 0]]);
  assert.equal(cov[0].pct, 0.5);
});

test('coverage: filter brand tidak peka huruf besar/kecil', () => {
  const cov = C.coverage(CL, [row({ sku: '1' })], 'wardah');
  assert.deepEqual(cov.map(x => [x.key, x.total, x.counted]), [['A', 2, 1]]);
});

test('uncounted: urut kelas lalu penjualan terbesar, bisa difilter kelas', () => {
  const u = C.uncounted(CL, [row({ sku: '3' })], '', '');
  assert.deepEqual(u.map(x => x.sku), ['2', '1', '4']);
  assert.deepEqual(C.uncounted(CL, [], '', 'B').map(x => x.sku), ['3']);
  assert.deepEqual(C.uncounted(CL, [], 'emina', '').map(x => x.sku), ['3', '4']);
});

test('pareto: porsi kumulatif, batas untuk target, dan jumlah SKU yang perlu dibereskan', () => {
  // Heron total 1000, target 99% -> batas selisih 10. Selisih: 40, 30, 20, 5, 5 = 100.
  const mk = (sku, abs) => row({ sku, heron: 200, real: 200 + abs });
  const p = C.pareto([mk('a', 5), mk('b', 40), mk('c', 20), mk('d', 30), mk('e', 5)], 0.99);
  assert.equal(p.total, 100);
  assert.equal(p.heron, 1000);
  assert.equal(p.allowed, 10);
  assert.equal(p.need, 90);
  assert.deepEqual(p.items.map(x => x.sku).slice(0, 3), ['b', 'd', 'c']);
  assert.equal(p.share(1), 0.4);
  assert.equal(p.share(2), 0.7);
  assert.equal(p.share(99), 1);
  // Sisa selisih setelah membereskan 3 SKU teratas = 10, tepat di batas.
  assert.equal(p.skuToTarget, 3);
});

test('pareto: target sudah tercapai, dan daftar kosong tidak error', () => {
  const ok = C.pareto([row({ heron: 1000, real: 1005 })], 0.99);
  assert.equal(ok.need, 0);
  assert.equal(ok.skuToTarget, 0);
  const empty = C.pareto([], 0.99);
  assert.equal(empty.total, 0);
  assert.equal(empty.share(10), 0);
  assert.deepEqual(empty.items, []);
});

test('pareto: baris SKU yang sama dijumlahkan', () => {
  const p = C.pareto([row({ sku: 'x', heron: 100, real: 90 }), row({ sku: 'x', heron: 100, real: 130 }), row({ sku: 'y', heron: 100, real: 95 })], 0.99);
  assert.equal(p.items[0].sku, 'x');
  assert.equal(p.items[0].abs, 40);
  assert.equal(p.count, 2);
});

/* ---------- varian kemasan: satu SKU, beberapa kode SAP ---------- */

test('problemSkus: kode SAP berbeda pada SKU yang sama dinilai terpisah', () => {
  const list = [
    // Kemasan lama buruk di dua bulan, kemasan baru bagus. Kalau digabung per SKU, hasilnya tersamarkan.
    row({ sku: 'V', code: '4000000001', monthKey: '2026-10', heron: 100, real: 50 }),
    row({ sku: 'V', code: '4000000001', monthKey: '2026-11', heron: 100, real: 60 }),
    row({ sku: 'V', code: '4000000002', monthKey: '2026-10', heron: 1000, real: 1000 }),
    row({ sku: 'V', code: '4000000002', monthKey: '2026-11', heron: 1000, real: 1000 })
  ];
  const p = C.problemSkus(list, 0.99, 2);
  assert.equal(p.length, 1);
  assert.equal(p[0].code, '4000000001');
  assert.equal(p[0].key, 'V|4000000001');
  assert.equal(p[0].badMonths, 2);
});

test('pareto: varian kemasan dihitung sebagai item terpisah', () => {
  const list = [
    row({ sku: 'V', code: '4000000001', heron: 100, real: 50 }),
    row({ sku: 'V', code: '4000000002', heron: 100, real: 90 })
  ];
  const p = C.pareto(list, 0.99);
  assert.equal(p.count, 2);
  assert.deepEqual(p.items.map(x => x.code), ['4000000001', '4000000002']);
});

test('coverage dan uncounted: varian kemasan dihitung satu SKU, sudah dihitung kalau salah satu varian muncul', () => {
  const cl = [
    { sku: '1', code: '4000000001', brand: 'X', cls: 'A', name: 'lama', sales: 5 },
    { sku: '1', code: '4000000002', brand: 'X', cls: 'A', name: 'baru', sales: 9 },
    { sku: '2', code: '4000000003', brand: 'X', cls: 'A', name: 'lain', sales: 1 }
  ];
  const rows = [row({ sku: '1', code: '4000000002' })];
  const cov = C.coverage(cl, rows);
  assert.deepEqual(cov.map(x => [x.key, x.total, x.counted]), [['A', 2, 1]]);
  assert.deepEqual(C.uncounted(cl, rows).map(x => x.sku), ['2']);
});

test('filterRows: pencarian juga mencocokkan kode SAP', () => {
  const list = [row({ sku: 'S1', code: '4000000123' }), row({ sku: 'S2', code: '4000000456' })];
  assert.equal(C.filterRows(list, { q: '4000000456' }).length, 1);
});

/* ---------- skor risiko ---------- */

// Riwayat tiruan: `acc` per bulan menentukan Real dari Heron 100.
function hist(sku, reals, o) {
  return reals.map((real, i) => row(Object.assign({ sku, monthKey: '2026-0' + (i + 1), heron: 100, real }, o)));
}

test('riskScores: item yang selalu buruk skornya lebih tinggi dari yang selalu baik', () => {
  const rows = [].concat(hist('BAD', [60, 70, 65]), hist('GOOD', [100, 100, 100]), hist('MID', [100, 98, 100]));
  const r = C.riskScores(rows, 0.99);
  assert.deepEqual(r.map(x => x.sku), ['BAD', 'MID', 'GOOD']);
  assert.ok(r[0].score > r[2].score + 30);
  assert.ok(r[0].score <= 100 && r[2].score >= 0);
});

test('riskScores: hanya bulan sebelum opts.before yang dipakai (tanpa kebocoran masa depan)', () => {
  const rows = [].concat(hist('X', [100, 100, 100, 10]));
  const before = C.riskScores(rows, 0.99, { before: '2026-04' });
  assert.equal(before[0].months, 3);
  assert.equal(before[0].bad, 0);
  const all = C.riskScores(rows, 0.99);
  assert.equal(all[0].bad, 1);
  assert.ok(all[0].score > before[0].score);
});

test('riskScores: item yang baru muncul di bulan prediksi tidak dinilai', () => {
  const rows = [].concat(hist('OLD', [100, 100]), [row({ sku: 'NEW', monthKey: '2026-03', real: 10 })]);
  assert.deepEqual(C.riskScores(rows, 0.99, { before: '2026-03' }).map(x => x.sku), ['OLD']);
});

test('riskScores: arah konsisten (selalu kurang) terdeteksi dan menjadi alasan', () => {
  const rows = [].concat(hist('LESS', [95, 96, 97]), hist('MIXED', [95, 105, 95]));
  const r = C.riskScores(rows, 0.99);
  const less = r.find(x => x.sku === 'LESS'), mixed = r.find(x => x.sku === 'MIXED');
  assert.ok(less.reasons.includes('selalu kurang'));
  assert.ok(!mixed.reasons.includes('selalu kurang') && !mixed.reasons.includes('selalu lebih'));
});

test('riskScores: kelas A dan varian kemasan menaikkan skor', () => {
  const base = hist('S', [90, 90], { cls: 'C' });
  const a = hist('S', [90, 90], { cls: 'A' });
  assert.equal(C.riskScores(a, 0.99)[0].score - C.riskScores(base, 0.99)[0].score, C.RISK_WEIGHTS.clsA);
  const variant = [].concat(hist('V', [90, 90], { cls: 'C', code: '4000000001' }), hist('V', [100, 100], { cls: 'C', code: '4000000002' }));
  const on = C.riskScores(variant, 0.99).find(x => x.code === '4000000001');
  const off = C.riskScores(variant, 0.99, { weights: { variant: 0 } }).find(x => x.code === '4000000001');
  assert.equal(on.score - off.score, C.RISK_WEIGHTS.variant);
  assert.equal(C.riskScores(variant, 0.99).find(x => x.code === '4000000002').key, 'V|4000000002');
  // SKU tanpa varian tidak mendapat bobot itu.
  assert.equal(C.riskScores(hist('SOLO', [90, 90], { cls: 'C' }), 0.99)[0].score,
               C.riskScores(hist('SOLO', [90, 90], { cls: 'C' }), 0.99, { weights: { variant: 0 } })[0].score);
});

test('riskScores: alasan maksimal tiga dan daftar kosong tidak error', () => {
  const r = C.riskScores(hist('Z', [10, 10, 10], { cls: 'A' }), 0.99);
  assert.ok(r[0].reasons.length <= 3 && r[0].reasons.length >= 1);
  assert.deepEqual(C.riskScores([], 0.99), []);
});

test('riskScores: maxMonths membatasi riwayat ke bulan terakhir', () => {
  const rows = hist('M', [10, 10, 100, 100, 100, 100, 100, 100].slice(0, 8)).map((r, i) => Object.assign(r, { monthKey: '2026-' + String(i + 1).padStart(2, '0') }));
  assert.equal(C.riskScores(rows, 0.99, { maxMonths: 3 })[0].months, 3);
  assert.equal(C.riskScores(rows, 0.99, { maxMonths: 3 })[0].bad, 0);
});

/* ---------- penyebab (laporan human error) ---------- */

const rep = (monthKey, cats, area, refs) => ({ date: monthKey + '-10', monthKey, area: area || 'DISPLAY', coord: '', cats, refs: refs || [] });

test('causeCounts: laporan dengan beberapa kategori dihitung di tiap kategorinya', () => {
  const list = [rep('2026-01', ['A']), rep('2026-01', ['A', 'B']), rep('2026-02', ['B'], 'STORAGE'), rep('2026-02', ['C'])];
  assert.deepEqual(C.causeCounts(list, 'cats').map(x => [x.key, x.n]), [['A', 2], ['B', 2], ['C', 1]]);
  assert.deepEqual(C.causeCounts(list, 'area').map(x => [x.key, x.n]), [['DISPLAY', 3], ['STORAGE', 1]]);
  assert.deepEqual(C.causeCounts([], 'cats'), []);
});

test('causeByMonth: topN kategori, sisanya LAINNYA, bulan terurut', () => {
  const list = [rep('2026-02', ['A']), rep('2026-01', ['A']), rep('2026-01', ['B']), rep('2026-02', ['C']), rep('2026-02', ['D'])];
  const r = C.causeByMonth(list, 2);
  assert.deepEqual(r.months, ['2026-01', '2026-02']);
  assert.deepEqual(r.series.map(s => s.name), ['A', 'B', 'LAINNYA']);
  assert.deepEqual(r.series[0].data, [1, 1]);
  assert.deepEqual(r.series[2].data, [0, 2]);
  assert.equal(C.causeByMonth(list, 10).series.some(s => s.name === 'LAINNYA'), false);
});

test('shiftMonth: lintas tahun', () => {
  assert.equal(C.shiftMonth('2026-11', -2), '2026-09');
  assert.equal(C.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(C.shiftMonth('2026-12', 1), '2027-01');
});

test('annotateReports: cocok lewat barcode atau kode SAP, hanya sejak bulan yang ditentukan', () => {
  const items = [{ sku: '8993137000001', code: '4000000001' }, { sku: '8993137000002', code: '4000000002' }, { sku: '9', code: '' }];
  const reports = [
    rep('2026-10', ['SALAH PENEMPATAN'], 'DISPLAY', [{ sku: '8993137000001' }]),
    rep('2026-10', ['FEFO TIDAK TEPAT'], 'STORAGE', [{ code: '4000000002' }]),
    rep('2026-01', ['LAMA'], 'DISPLAY', [{ sku: '8993137000001' }]),
    rep('2026-10', ['TIDAK COCOK'], 'DISPLAY', [{ code: '4000000099' }])
  ];
  const r = C.annotateReports(items, reports, '2026-09');
  assert.deepEqual(r.map(x => x.repCats), [['SALAH PENEMPATAN'], ['FEFO TIDAK TEPAT'], []]);
  assert.deepEqual(C.annotateReports(items, reports)[0].repCats, ['LAMA', 'SALAH PENEMPATAN']);
  assert.equal(items[0].repCats, undefined);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

// Data tiruan (bukan data perusahaan).
function row(o) {
  const r = Object.assign({ monthKey: '2026-10', date: '2026-10-01', pic: 'A', brand: 'X', cls: 'A', sku: 'S1', code: '', name: 'P', heron: 100, real: 100 }, o);
  r.key = r.code ? r.sku + '|' + r.code : r.sku;
  r.gap = r.real - r.heron; r.absGap = Math.abs(r.gap); r.acc = C.skuAcc(r.heron, r.real);
  return r;
}

test('summarize: netto dan absolut dihitung bersamaan, lebih dan kurang saling menutupi di netto', () => {
  const list = [row({ heron: 100, real: 130 }), row({ heron: 100, real: 70 })];
  const s = C.summarize(list);
  assert.equal(s.accAbs, 1 - 60 / 200);
  assert.equal(s.accNet, 1);
  assert.equal(s.net, 0);
  assert.equal(s.acc, s.accAbs);                       // bawaan: absolut
  assert.equal(C.summarize(list, undefined, 'net').acc, 1);
  assert.equal(C.summarize(list, undefined, 'abs').acc, s.accAbs);
});

test('akurasi netto cocok dengan rumus tab Review di Excel', () => {
  // Contoh dari tab Review: Sistem 186.705, Fisik 180.380 -> 96,61%.
  const s = C.summarize([row({ heron: 186705, real: 180380 })]);
  assert.equal(Math.round(s.accNet * 10000) / 10000, 0.9661);
  // Contoh lain: Sistem 120.940, Fisik 144.677 -> 80,37%.
  assert.equal(Math.round(C.summarize([row({ heron: 120940, real: 144677 })]).accNet * 10000) / 10000, 0.8037);
});

test('netto tidak pernah lebih rendah dari absolut', () => {
  const list = [row({ heron: 50, real: 80 }), row({ heron: 70, real: 20 }), row({ heron: 30, real: 31 }), row({ heron: 0, real: 4 })];
  const s = C.summarize(list);
  assert.ok(s.accNet >= s.accAbs);
});

test('mode diteruskan ke groupSummary, classSummary, dan trend', () => {
  const list = [row({ brand: 'X', cls: 'A', heron: 100, real: 130 }), row({ brand: 'X', cls: 'A', heron: 100, real: 70 })];
  assert.equal(C.groupSummary(list, 'brand', 0.99, 'net')[0].acc, 1);
  assert.equal(C.groupSummary(list, 'brand', 0.99)[0].acc, 0.7);
  assert.equal(C.classSummary(list, 0.99, 'net')[0].acc, 1);
  assert.equal(C.trend(list, ['2026-10'], 'net').series[0].data[0], 1);
  assert.equal(C.trend(list, ['2026-10']).series[0].data[0], 0.7);
});

test('rankByAcc mengikuti mode yang dipilih', () => {
  const list = [row({ brand: 'A', heron: 100, real: 130 }), row({ brand: 'A', heron: 100, real: 70 }), row({ brand: 'B', heron: 100, real: 90 })];
  assert.deepEqual(C.rankByAcc(C.groupSummary(list, 'brand', 0.99, 'abs')).map(x => x.key), ['A', 'B']);
  assert.deepEqual(C.rankByAcc(C.groupSummary(list, 'brand', 0.99, 'net')).map(x => x.key), ['B', 'A']);
});

test('splitSummary: akurasi storage dan display ikut mode', () => {
  const mk = (sHeron, sReal, heron, real) => Object.assign(row({ heron, real }), {
    sHeron, sReal, sGap: sReal - sHeron, dHeron: heron - sHeron, dReal: real - sReal, dGap: (real - sReal) - (heron - sHeron) });
  const list = [mk(100, 130, 150, 150), mk(100, 70, 150, 150)];   // storage lebih 30 dan kurang 30, display kurang 30 dan lebih 30
  const abs = C.splitSummary(list, 'abs'), net = C.splitSummary(list, 'net');
  assert.equal(abs.storage.acc, 0.7);
  assert.equal(net.storage.acc, 1);
  assert.equal(net.storage.accAbs, 0.7);
  assert.equal(C.splitSummary(list).storage.acc, 0.7);
  assert.equal(C.splitTrend(list, ['2026-10'], 'net').storage[0], 1);
  assert.equal(C.splitGroup(list, 'brand', 'net')[0].storage, 1);
});

test('compareTable: Heron, Real, gap, lebih, kurang, dan kedua akurasi per kelompok', () => {
  const list = [
    row({ monthKey: '2026-11', heron: 100, real: 130 }), row({ monthKey: '2026-11', heron: 100, real: 70 }),
    row({ monthKey: '2026-10', sku: 'S2', heron: 1000, real: 990 })
  ];
  const t = C.compareTable(list, 'monthKey');
  assert.deepEqual(t.map(x => x.key), ['2026-10', '2026-11']);
  assert.equal(t[0].heron, 1000);
  assert.equal(t[0].real, 990);
  assert.equal(t[0].net, -10);
  assert.equal(t[0].under, 10);
  assert.equal(t[0].accNet, 0.99);
  assert.equal(t[1].over, 30);
  assert.equal(t[1].under, 30);
  assert.equal(t[1].accNet, 1);
  assert.equal(t[1].accAbs, 0.7);
  assert.equal(t[1].skus, 1);
  assert.equal(t[1].n, 2);
});

test('compareTable: urut Heron terbesar dan daftar kosong', () => {
  const list = [row({ brand: 'A', heron: 10 }), row({ brand: 'B', heron: 500 }), row({ brand: 'C', heron: 90 })];
  assert.deepEqual(C.compareTable(list, 'brand', 'heron').map(x => x.key), ['B', 'C', 'A']);
  assert.deepEqual(C.compareTable([], 'brand'), []);
});

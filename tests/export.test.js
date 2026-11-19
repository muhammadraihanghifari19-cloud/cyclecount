const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/export.js');

const r = (o) => Object.assign({ monthLabel: 'Oktober 2026', date: '2026-10-01', pic: 'A', brand: 'X', cls: 'A', sku: '1', code: '4000000001', name: 'Produk',
                                  heron: 100, real: 90, gap: -10, sHeron: 10, sReal: 6, sGap: -4, dHeron: 90, dReal: 84, dGap: -6,
                                  acc: 0.9 }, o);

test('toCSV: isi sama dengan baris yang diberikan', () => {
  const lines = E.toCSV([r({ sku: '111' }), r({ sku: '222' })]).replace('\uFEFF', '').split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], E.HEADERS.join(','));
  assert.ok(lines[1].includes(',111,'));
  assert.ok(lines[2].includes(',222,'));
});

test('toCSV: Heron, Real, dan Gap untuk total, storage, dan display', () => {
  assert.deepEqual(E.HEADERS.slice(8, 17), ['Heron', 'Real', 'Gap', 'Heron Storage', 'Real Storage', 'Gap Storage',
                                            'Heron Display', 'Real Display', 'Gap Display']);
  assert.equal(E.HEADERS[6], 'Kode SAP');
  assert.ok(E.toCSV([r({})]).includes(',1,4000000001,Produk,'));
  const line = E.toCSV([r({})]).replace('\uFEFF', '').split('\r\n')[1];
  assert.ok(line.endsWith(',100,90,-10,10,6,-4,90,84,-6,90'));
});

test('toCSV: pemisahan storage/display kosong (null) menjadi sel kosong', () => {
  const csv = E.toCSV([r({ sHeron: null, sReal: null, sGap: null, dHeron: undefined, dReal: null, dGap: null })]);
  assert.ok(csv.endsWith(',100,90,-10,,,,,,,90'));
});

test('toCSV: kolom kelas ikut diekspor', () => {
  assert.ok(E.HEADERS.includes('Kelas'));
  assert.ok(E.toCSV([r({ cls: 'B' })]).includes(',X,B,1,'));
});

test('toCSV: koma dan tanda kutip di nama produk tidak merusak kolom', () => {
  const csv = E.toCSV([r({ name: 'Serum, 30 ml "Baru"' })]);
  assert.ok(csv.includes('"Serum, 30 ml ""Baru"""'));
});

test('toCSV: teks berawalan = diberi tanda petik agar tidak jadi rumus', () => {
  assert.ok(E.toCSV([r({ name: '=1+1' })]).includes(",'=1+1,"));
});

test('toCSV: daftar kosong hanya berisi header', () => {
  assert.equal(E.toCSV([]).replace('\uFEFF', ''), E.HEADERS.join(','));
});

/* ---------- checklist risiko ---------- */

const rk = (o) => Object.assign({ pic: 'AQIM', score: 90, sku: '1', code: '4000000001', name: 'Produk', brand: 'X', cls: 'A',
                                  reasons: ['4 dari 4 bulan di bawah target', 'selalu kurang'] }, o);

test('riskRecords: kolom Hasil hitung dan Catatan dikosongkan untuk diisi petugas', () => {
  const [rec] = E.riskRecords([rk({})]);
  assert.equal(rec.length, E.RISK_HEADERS.length);
  assert.deepEqual(rec.slice(-2), ['', '']);
  assert.equal(rec[7], '4 dari 4 bulan di bawah target; selalu kurang');
});

test('riskCSV: nama produk dengan koma tidak merusak kolom, kode kosong menjadi sel kosong', () => {
  const csv = E.riskCSV([rk({ name: 'Serum, 30 ml', code: undefined })]);
  assert.ok(csv.includes('"Serum, 30 ml"'));
  assert.ok(csv.includes(',1,,"Serum, 30 ml"'));
  assert.equal(E.riskCSV([]).replace('\uFEFF', ''), E.RISK_HEADERS.join(','));
});

test('riskByPic: dikelompokkan per PIC, dibatasi per PIC, urutan skor terjaga', () => {
  const list = [rk({ pic: 'B', score: 99, sku: 'b1' }), rk({ pic: 'A', score: 95, sku: 'a1' }), rk({ pic: 'A', score: 90, sku: 'a2' }),
                rk({ pic: 'A', score: 80, sku: 'a3' }), rk({ pic: '', score: 70, sku: 'u1' })];
  const g = E.riskByPic(list, 2);
  assert.deepEqual(g.map(x => x[0]), ['A', 'B', 'Tidak diketahui']);
  assert.deepEqual(g[0][1].map(x => x.sku), ['a1', 'a2']);
});

test('sheetName: karakter terlarang dibuang, maksimal 31 karakter, nama kembar dibuat unik', () => {
  assert.equal(E.sheetName('A/B:C*D?[E]'), 'A B C D E');
  assert.equal(E.sheetName('x'.repeat(40)).length, 31);
  assert.equal(E.sheetName(''), 'Sheet');
  const used = new Set();
  assert.equal(E.sheetName('AQIM', used), 'AQIM');
  assert.equal(E.sheetName('aqim', used), 'aqim 2');
  assert.equal(E.sheetName('AQIM', used), 'AQIM 3');
});

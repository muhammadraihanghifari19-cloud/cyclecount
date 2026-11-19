const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/parse.js');

const HEAD = ['Tanggal', 'PIC', 'Brand', 'SKU No', 'Product Name', 'Total Heron', 'Total Real', 'Gap'];

test('monthInfo: nama tab bulan', () => {
  assert.equal(P.monthInfo('CC BY HERON NOVEMBER 2026').key, '2026-11');
  assert.equal(P.monthInfo('CC BY HERON OKT 2026').key, '2026-10');
  assert.equal(P.monthInfo('CC BY HERON SEPT 2026').key, '2026-09');
  assert.equal(P.monthInfo('CC BY HERON AGUSTUS 26').key, '2026-08');
  assert.equal(P.monthInfo('CC BY HERON JANUARI 26').label, 'Januari 2026');
  assert.equal(P.monthInfo('CC BY HERON MEI 26').short, 'Mei 26');
});

test('monthInfo: bukan tab bulan menghasilkan null', () => {
  assert.equal(P.monthInfo('CC BY HERON DESEMBER'), null);
  assert.equal(P.monthInfo('Review per month'), null);
  assert.equal(P.monthInfo('CC BY HERON BULANX 26'), null);
});

test('sortMonths: urut kronologis', () => {
  const infos = ['CC BY HERON NOVEMBER 2026', 'CC BY HERON JANUARI 26', 'CC BY HERON OKT 2026'].map(P.monthInfo);
  assert.deepEqual(P.sortMonths(infos).map(i => i.key), ['2026-01', '2026-10', '2026-11']);
});

test('excelDate', () => {
  assert.equal(P.excelDate(46328), '2026-11-02');
});

test('parseSheet: baris valid, gap dihitung sendiri, baris rusak dilewati', () => {
  const info = P.monthInfo('CC BY HERON NOVEMBER 2026');
  const aoa = [
    HEAD,
    ['', '', '', '', '', '', '', ''],
    ['KEEP THE SPIRIT', '', '', '', '', '', '', ''],
    [46328, ' Budi ', 'Wardah', 8993137702072, 'Serum', 100, 90, 999],
    [46328, 'Budi', 'Wardah', 111, 'Kosong', '', 5, 0],
    [46328, 'Budi', 'Wardah', 112, 'Error', '#REF!', 5, 0],
    ['bukan tanggal', 'Budi', 'Wardah', 113, 'X', 1, 1, 0]
  ];
  const rows = P.parseSheet(aoa, info);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pic, 'Budi');
  assert.equal(rows[0].sku, '8993137702072');
  assert.equal(rows[0].gap, -10);
  assert.equal(rows[0].acc, 0.9);
  assert.equal(rows[0].monthKey, '2026-11');
});

test('parseSheet: membaca berdasarkan nama header, bukan posisi', () => {
  const info = P.monthInfo('CC BY HERON JUNI 26');
  const aoa = [
    ['x', 'Tanggal', 'PIC', 'Brand', 'SKU No', 'Product Name', 'foo', 'Total Heron', 'Total Real'],
    ['', 46328, 'A', 'B', 'S', 'P', 0, 10, 10]
  ];
  assert.equal(P.parseSheet(aoa, info)[0].heron, 10);
});

test('parseSheet: header tidak lengkap menghasilkan null, tanpa error', () => {
  const info = P.monthInfo('CC BY HERON JUNI 26');
  assert.equal(P.parseSheet([['Tanggal', 'PIC']], info), null);
  assert.equal(P.parseSheet([], info), null);
});

test('parseSheet: storage dan display dipisah, total tetap sama dengan penjumlahan', () => {
  const info = P.monthInfo('CC BY HERON NOVEMBER 2026');
  const aoa = [
    ['Tanggal', 'PIC', 'Brand', 'SKU No', 'Product Name', 'Koordinat Storage', 'Stock Heron', 'Stock Real',
     'Stock Display 1', 'Stock Real', 'Total Heron', 'Total Real', 'Gap'],
    [46328, 'A', 'B', 1, 'P', 'SSR-1', 80, 70, 20, 25, 100, 95, -5],
    [46328, 'A', 'B', 2, 'P', 'SSR-2', '', '', 10, 10, 10, 10, 0]
  ];
  const rows = P.parseSheet(aoa, info);
  assert.equal(rows[0].sHeron, 80);
  assert.equal(rows[0].sReal, 70);
  assert.equal(rows[0].sGap, -10);
  assert.equal(rows[0].dHeron, 20);
  assert.equal(rows[0].dReal, 25);
  assert.equal(rows[0].dGap, 5);
  assert.equal(rows[0].sGap + rows[0].dGap, rows[0].gap);
  assert.equal(rows[1].sHeron, 0);
  assert.equal(rows[1].dHeron, 10);
});

test('parseSheet: tanpa kolom Stock Heron, pemisahan bernilai null', () => {
  const info = P.monthInfo('CC BY HERON JUNI 26');
  const rows = P.parseSheet([HEAD, [46328, 'A', 'B', 1, 'P', 10, 8, -2]], info);
  assert.equal(rows[0].sHeron, null);
  assert.equal(rows[0].dGap, null);
  assert.equal(rows[0].cls, 'Tanpa kelas');
});

test('parseClassSheet dan applyClass', () => {
  const aoa = [
    ['Brand', 'No. SKU', 'Product Name', 'Odoo Code', 'SAP Code', 'PENJUALAN', 'CLASS'],
    ['Wardah', 8993137006521, 'Serum', 1, 2, 91383, 'a'],
    ['Emina', 111, 'Cream', 1, 2, '', 'B'],
    ['Emina', '', 'Kosong', 1, 2, 5, 'C'],
    ['Emina', 222, 'Tanpa kelas', 1, 2, 5, '']
  ];
  const list = P.parseClassSheet(aoa);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { sku: '8993137006521', code: '4000000002', cls: 'A', brand: 'Wardah', name: 'Serum', sales: 91383 });
  assert.equal(list[1].sales, 0);
  const info = P.monthInfo('CC BY HERON JUNI 26');
  const rows = P.parseSheet([HEAD, [46328, 'A', 'B', 8993137006521, 'P', 10, 8, -2], [46328, 'A', 'B', 999, 'P', 10, 8, -2]], info);
  P.applyClass(rows, list);
  assert.equal(rows[0].cls, 'A');
  assert.equal(rows[1].cls, 'Tanpa kelas');
});

test('parseClassSheet: header tidak lengkap menghasilkan daftar kosong', () => {
  assert.deepEqual(P.parseClassSheet([['Brand', 'X']]), []);
  assert.deepEqual(P.parseClassSheet([]), []);
});

test('cleanPic: nama depan, huruf besar, alias, dan nilai tidak valid', () => {
  assert.equal(P.cleanPic("AQIM MA'RUF ZAMAN"), 'AQIM');
  assert.equal(P.cleanPic('aqim'), 'AQIM');
  assert.equal(P.cleanPic('  Viqi   Nur Faizin '), 'VIQI');
  assert.equal(P.cleanPic('SANTOS'), 'SANTOSO');
  assert.equal(P.cleanPic('SYAEIF ELFA YANZA'), 'SAIF');
  assert.equal(P.cleanPic(''), 'Tidak diketahui');
  assert.equal(P.cleanPic('G7.E13 e20'), 'Tidak diketahui');
});

test('cleanLabels: brand disatukan dengan tab kelas, kode koordinat diambil dari SKU', () => {
  const classList = [
    { sku: '1', brand: 'Wardah', cls: 'A', name: '', sales: 0 },
    { sku: '2', brand: 'Biodef', cls: 'B', name: '', sales: 0 },
    { sku: '3', brand: 'Emina', cls: 'C', name: '', sales: 0 }
  ];
  const mk = (sku, brand, pic) => ({ sku, brand, pic });
  const rows = [mk('1', 'WARDAH', 'aqim'), mk('2', 'biodef ', 'AQIM MA\'RUF ZAMAN'), mk('3', 'G7.E20', 'x1'),
                mk('3', '', 'Santos'), mk('999', 'G8.K32', 'B'), mk('50', 'WONDERLY', 'B'), mk('51', 'Wonderly', 'B'),
                mk('52', 'Wonderly', 'B')];
  P.cleanLabels(rows, classList);
  assert.deepEqual(rows.map(r => r.brand), ['Wardah', 'Biodef', 'Emina', 'Emina', 'Tidak diketahui', 'Wonderly', 'Wonderly', 'Wonderly']);
  assert.deepEqual(rows.slice(0, 4).map(r => r.pic), ['AQIM', 'AQIM', 'Tidak diketahui', 'SANTOSO']);
});

test('cleanLabels: tanpa daftar kelas, brand memakai penulisan paling sering', () => {
  const rows = [{ sku: '1', brand: 'OMG', pic: 'A' }, { sku: '2', brand: 'OMG', pic: 'A' }, { sku: '3', brand: 'Omg', pic: 'A' }];
  P.cleanLabels(rows, []);
  assert.deepEqual(rows.map(r => r.brand), ['OMG', 'OMG', 'OMG']);
});

test('normCode: Odoo diubah ke SAP, nilai SAP dibiarkan, bukan angka = kosong', () => {
  assert.equal(P.normCode(3828), '4000003828');
  assert.equal(P.normCode('3828'), '4000003828');
  assert.equal(P.normCode(4000003828), '4000003828');
  assert.equal(P.normCode(''), '');
  assert.equal(P.normCode('P9321'), '');
  assert.equal(P.normCode(0), '');
});

test('parseSheet: kode SAP dari kolom SAP Code atau Odoo Code, key = SKU + kode', () => {
  const info = P.monthInfo('CC BY HERON OKT 2026');
  const head = ['Tanggal', 'PIC', 'Brand', 'SKU No', 'Odoo Code', 'Product Name', 'SAP Code', 'Total Heron', 'Total Real'];
  const rows = P.parseSheet([
    head,
    [46328, 'A', 'B', 111, 3828, 'P', '', 10, 10],            // hanya Odoo
    [46328, 'A', 'B', 111, 3829, 'P', 4000003999, 10, 10],    // SAP menang
    [46328, 'A', 'B', 222, 4000006865, 'P', '', 10, 10],      // kolom Odoo berisi nilai SAP
    [46328, 'A', 'B', 333, '', 'P', '', 10, 10]               // tanpa kode
  ], info);
  assert.deepEqual(rows.map(r => r.code), ['4000003828', '4000003999', '4000006865', '']);
  assert.deepEqual(rows.map(r => r.key), ['111|4000003828', '111|4000003999', '222|4000006865', '333']);
});

test('applyClass: kelas dicocokkan per SKU + kode, lalu per SKU saja', () => {
  const classList = [
    { sku: '1', code: '4000000001', cls: 'A', brand: '', name: '', sales: 0 },
    { sku: '1', code: '4000000002', cls: 'B', brand: '', name: '', sales: 0 }
  ];
  const rows = [{ sku: '1', code: '4000000002', key: '1|4000000002' }, { sku: '1', code: '4000009999', key: '1|4000009999' },
                { sku: '1', code: '', key: '1' }, { sku: '5', code: '', key: '5' }];
  P.applyClass(rows, classList);
  assert.deepEqual(rows.map(r => r.cls), ['B', 'A', 'A', 'Tanpa kelas']);
});

test('refsOf: barcode 13 digit, kode Odoo diubah ke SAP, daftar campur, nilai tidak valid diabaikan', () => {
  assert.deepEqual(P.refsOf(8993137711203), [{ sku: '8993137711203' }]);
  assert.deepEqual(P.refsOf(6572), [{ code: '4000006572' }]);
  assert.deepEqual(P.refsOf('3856, 00533, 06750, 00890'),
    [{ code: '4000003856' }, { code: '4000000533' }, { code: '4000006750' }, { code: '4000000890' }]);
  assert.deepEqual(P.refsOf('3856, 3856'), [{ code: '4000003856' }]);
  assert.deepEqual(P.refsOf(''), []);
  assert.deepEqual(P.refsOf('abc'), []);
  assert.deepEqual(P.refsOf('123456789'), []);
});

test('parseHumanError: kategori dipisah, area dirapikan, baris tanpa timestamp atau kategori dilewati', () => {
  const aoa = [
    ['Timestamp', 'AREA', 'KOORDINAT', 'BARCODE ATAU KODE ODOO', 'KATEGORI', 'JUMLAH PCS JIKA ADA SELISIH'],
    [46000, 'OVERMODAL/PALET', 'G3-P06-B6', 8161, 'selisih stock, SALAH PENEMPATAN', ''],
    [46001, 'STORAGE GUDANG 5', 'X', 8993137711203, 'FEFO TIDAK TEPAT', 5],
    [46002, '', '', '', 'SALAH PENEMPATAN', ''],
    ['bukan tanggal', 'DISPLAY', '', 1, 'SALAH PENEMPATAN', ''],
    [46003, 'DISPLAY', '', 1, '', '']
  ];
  const r = P.parseHumanError(aoa);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0].cats, ['SELISIH STOCK', 'SALAH PENEMPATAN']);
  assert.equal(r[0].area, 'OVERMODAL');
  assert.equal(r[1].area, 'STORAGE');
  assert.equal(r[2].area, 'Tidak diketahui');
  assert.equal(r[0].monthKey, P.excelDate(46000).slice(0, 7));
  assert.deepEqual(r[0].refs, [{ code: '4000008161' }]);
  assert.deepEqual(P.parseHumanError([['A', 'B']]), []);
  assert.deepEqual(P.parseHumanError([]), []);
});

test('parsePotentialGap: baris bernomor dengan penanggung jawab, catatan bebas diabaikan', () => {
  const aoa = [
    ['POTENSIAL GAP', 'FOLLOW UP'],
    ['1. MOVEMENT STOCK INVENTORY (1.INBOUND 2.X)', 'KOORDINATOR INVENTORY'],
    ['2. RESERVED PICKING ', 'KOORDINATOR FULLFILLMENT'],
    ['', ''],
    ['Stok kosong di area display yang aktif, ...', '']
  ];
  const r = P.parsePotentialGap(aoa);
  assert.deepEqual(r.map(x => x.no), [1, 2]);
  assert.equal(r[1].name, 'RESERVED PICKING');
  assert.equal(r[1].owner, 'KOORDINATOR FULLFILLMENT');
  assert.deepEqual(P.parsePotentialGap(null), []);
});

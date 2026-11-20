const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sales-calc.js');

function row(o) {
  return Object.assign({ date: '2026-10-14', monthKey: '2026-10', brand: 'WARDAH', marketplace: 'TIKTOK SHOP',
                         store: 'TK', orderNum: 'ORD001', sku: '8993137000001', sapCode: '4000000001',
                         isBundle: false, qty: 1, valueHet: 45000, priceRaw: 45000 }, o);
}

test('summarize: qty, omzet, order unik, sku unik', () => {
  const list = [row({ qty: 2, valueHet: 10000 }), row({ orderNum: 'ORD002', sku: 'S2', qty: 3, valueHet: 20000 }), row({ orderNum: 'ORD001', sku: 'S3', qty: 1, valueHet: null })];
  const s = C.summarize(list);
  assert.equal(s.qty, 6);
  assert.equal(s.omzet, 10000 * 2 + 20000 * 3);
  assert.equal(s.orders, 2);
  assert.equal(s.skus, 3);
  assert.equal(C.summarize([]).qty, 0);
});

test('groupSummary: urutan qty dan omzet', () => {
  const list = [row({ brand: 'A', qty: 5 }), row({ brand: 'B', qty: 10 }), row({ brand: 'C', qty: 1 })];
  assert.deepEqual(C.groupSummary(list, 'brand', 'qty').map(x => x.key), ['B', 'A', 'C']);
  assert.deepEqual(C.groupSummary(list, 'brand').map(x => x.key), ['A', 'B', 'C']); // urut abjad
});

test('topN: n teratas berdasarkan qty', () => {
  const list = [row({ sku: 'A', qty: 5 }), row({ sku: 'B', qty: 10 }), row({ sku: 'C', qty: 1 }), row({ sku: 'D', qty: 7 })];
  assert.deepEqual(C.topN(list, 'sku', 2).map(x => x.key), ['B', 'D']);
});

test('trendByDay: hari tanpa data bernilai 0', () => {
  const list = [row({ date: '2026-10-14', qty: 3 }), row({ date: '2026-10-16', qty: 5 })];
  const t = C.trendByDay(list, ['2026-10-14', '2026-10-15', '2026-10-16']);
  assert.deepEqual(t.map(x => x.qty), [3, 0, 5]);
});

test('uniqueDates dan uniqueMonths: terurut', () => {
  const list = [row({ date: '2026-10-16' }), row({ date: '2026-10-14' }), row({ date: '2026-10-14', monthKey: '2026-10' })];
  assert.deepEqual(C.uniqueDates(list), ['2026-10-14', '2026-10-16']);
  assert.deepEqual(C.uniqueMonths(list), ['2026-10']);
});

test('filterRows: brand, marketplace, rentang tanggal, pencarian', () => {
  const list = [row({ brand: 'WARDAH', marketplace: 'TIKTOK SHOP', date: '2026-10-14' }),
                row({ brand: 'EMINA', marketplace: 'SHOPEE', date: '2026-10-20', sku: '999' }),
                row({ brand: 'WARDAH', marketplace: 'LAZADA', date: '2026-10-10' })];
  assert.equal(C.filterRows(list, { brand: 'EMINA' }).length, 1);
  assert.equal(C.filterRows(list, { marketplace: 'TIKTOK SHOP' }).length, 1);
  assert.equal(C.filterRows(list, { dateFrom: '2026-10-14', dateTo: '2026-10-20' }).length, 2);
  assert.equal(C.filterRows(list, { q: '999' }).length, 1);
  assert.equal(C.filterRows(list, {}).length, 3);
});

test('filterRows: bundleOnly hanya menampilkan non-bundle (yang punya SAP)', () => {
  const list = [row({ isBundle: false }), row({ isBundle: true }), row({ isBundle: false })];
  assert.equal(C.filterRows(list, { bundleOnly: true }).length, 2);
});

test('linkToCc: cocok lewat SAP dan lewat barcode, baris tidak cocok tidak masuk', () => {
  const sales = [row({ sku: 'SK1', sapCode: 'SAP1' }), row({ sku: 'SK2', sapCode: '' }), row({ sku: 'SK3', sapCode: 'SAP_X' })];
  const cc = [{ sku: 'OTHER', code: 'SAP1', monthKey: '2026-10', acc: 0.95, cls: 'A' },
              { sku: 'SK2', code: '', monthKey: '2026-10', acc: 0.99, cls: 'B' }];
  const m = C.linkToCc(sales, cc);
  assert.ok(m.has('SK1'));
  assert.ok(m.has('SK2'));
  assert.ok(!m.has('SK3'));
  assert.equal(m.get('SK1').lastAcc, 0.95);
  assert.equal(m.get('SK1').cls, 'A');
});

test('priceStats: nilai kosong dan harga ngaco', () => {
  const list = [row({ priceRaw: 25000, valueHet: 25000 }), row({ priceRaw: 9999999, valueHet: null }), row({ priceRaw: null, valueHet: null })];
  const s = C.priceStats(list);
  assert.equal(s.min, 25000);
  assert.equal(s.max, 9999999);
  assert.equal(s.nulled, 1);
});

test('isStdSku: barcode Paragon 8993137xxxxxx vs kode lain', () => {
  assert.equal(C.isStdSku('8993137000001'), true);
  assert.equal(C.isStdSku('2030097805289'), false);
  assert.equal(C.isStdSku('DUP8993137000001'), false);
  assert.equal(C.isStdSku('3002518811'), false);
});

test('skuBreakdown: hitung per jenis SKU', () => {
  const list = [
    row({ sku: '8993137000001' }), row({ sku: '8993137000002' }),
    row({ sku: '2030097805289' }), row({ sku: '2030097805290' }), row({ sku: '2030097805291' }),
    row({ sku: 'DUP8993137000001' }),
    row({ sku: '3002518811' })
  ];
  const bd = C.skuBreakdown(list);
  assert.equal(bd.std, 2);
  assert.equal(bd.mp, 3);
  assert.equal(bd.dup, 1);
  assert.equal(bd.other, 1);
  assert.equal(bd.total, 7);
  assert.equal(C.skuBreakdown([]).total, 0);
});

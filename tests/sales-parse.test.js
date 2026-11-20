const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/sales-parse.js');

test('parseDate: berbagai format tanggal Magpie', () => {
  assert.equal(P.parseDate('25 Oct, 2026, 13:08'), '2026-10-25');
  assert.equal(P.parseDate('1 Oct, 2026, 08:52'), '2026-10-01');
  assert.equal(P.parseDate('31 Dec, 2026, 23:59'), '2026-12-31');
  assert.equal(P.parseDate(''), null);
  assert.equal(P.parseDate(null), null);
  assert.equal(P.parseDate('bukan tanggal'), null);
});

test('parsePrice: titik ribuan dan nilai tidak valid', () => {
  assert.equal(P.parsePrice('25.500'), 25500);
  assert.equal(P.parsePrice('100000'), 100000);
  assert.equal(P.parsePrice('9.999.999'), 9999999);
  assert.equal(P.parsePrice(''), null);
  assert.equal(P.parsePrice(null), null);
  assert.equal(P.parsePrice('abc'), null);
  assert.equal(P.parsePrice(0), 0);
});

test('parseRow: koma di dalam tanda kutip tidak memecah kolom', () => {
  assert.deepEqual(P.parseRow('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(P.parseRow('"25 Oct, 2026, 13:08",TIKTOK SHOP,ORD001'), ['25 Oct, 2026, 13:08', 'TIKTOK SHOP', 'ORD001']);
  assert.deepEqual(P.parseRow('"isi ""kutip"" ganda",b'), ['isi "kutip" ganda', 'b']);
});

const CSV_HEADER = 'WAREHOUSE_NAME,MARKETPLACE_NAME,STORE,ORDER_NUMBER,AWB_CODE,CANCELLED_BY,CANCELLED_TIMESTAMP,COURIER_NAME,ORDER_TIMESTAMP,MARKETPLACE_STATUS,HERON_STATUS,COMPLETED_TIMESTAMP,RAW_FULFILLMENT_DEADLINE_TIMESTAMP,BRAND_NAME,MAGPIE_CODE,SAP_CODE,SKU,VARIANT_FULLNAME,IS_BUNDLE,QUANTITY,VALUE_HET';
function makeRow(o) {
  const d = { ts: '"25 Oct, 2026, 13:08"', brand: 'WARDAH', mp: 'TIKTOK SHOP', store: 'TK Store',
              order: 'ORD001', sku: '8993137000001', sap: '4000000001', bundle: 'false', qty: '2', het: '45.000' };
  Object.assign(d, o);
  return ['DC TEGAL',d.mp,d.store,d.order,'AWB001','Not cancelled','','J&T',d.ts,'completed','dispatched','','',d.brand,'M001',d.sap,d.sku,'Produk A',d.bundle,d.qty,d.het].join(',');
}

test('parseCSV: baris valid, harga ngaco di-null-kan, bundle terdeteksi', () => {
  const csv = [CSV_HEADER, makeRow({}), makeRow({ het: '9.999.999', bundle: 'true', sap: '' }), makeRow({ qty: '0', sku: 'S2', order: 'ORD002' })].join('\n');
  const { rows, skipped } = P.parseCSV(csv, 100000);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].valueHet, 45000);
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].date, '2026-10-25');
  assert.equal(rows[0].monthKey, '2026-10');
  assert.equal(rows[1].valueHet, null);    // ngaco: 9999999 > 100000
  assert.equal(rows[1].isBundle, true);
  assert.equal(rows[1].sapCode, '');
  assert.equal(rows[2].qty, 0);
  assert.equal(skipped, 0);
});

test('parseCSV: header tidak lengkap menghasilkan array kosong', () => {
  assert.equal(P.parseCSV('A,B,C\n1,2,3').rows.length, 0);
});

test('parseCSV: baris dengan jumlah kolom salah dilewati', () => {
  const csv = [CSV_HEADER, makeRow({}), 'baris,kurang,kolom'].join('\n');
  const { rows, skipped } = P.parseCSV(csv);
  assert.equal(rows.length, 1);
  assert.equal(skipped, 1);
});

test('mergeResults: deduplikasi ORDER_NUMBER + SKU antar file', () => {
  const r1 = P.parseCSV([CSV_HEADER, makeRow({ order: 'ORD001' }), makeRow({ order: 'ORD002', sku: 'S2' })].join('\n'));
  const r2 = P.parseCSV([CSV_HEADER, makeRow({ order: 'ORD001' }), makeRow({ order: 'ORD003', sku: 'S3' })].join('\n'));
  const { rows } = P.mergeResults([r1, r2]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.orderNum).sort(), ['ORD001', 'ORD002', 'ORD003']);
});

test('mergeResults: array kosong tidak error', () => {
  assert.equal(P.mergeResults([]).rows.length, 0);
  assert.equal(P.mergeResults([{ rows: [], skipped: 0 }]).rows.length, 0);
});

/* Uji skor risiko pada data asli: untuk tiap bulan M, skor dihitung HANYA dari bulan sebelum M,
   lalu dibandingkan dengan hasil sebenarnya di M. Jalankan: node scripts/backtest.js [target%] [K]
   Membaca data/CYCLE COUNT TEGAL.xlsx (tidak ikut git). Hasil bacaan disimpan di data/parsed-cache.json. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const XLSX = require(path.join(root, 'lib', 'xlsx.full.min.js'));
const P = require('../js/parse.js');
const C = require('../js/calc.js');

const target = parseFloat(process.argv[2] || '99') / 100;
const K = parseInt(process.argv[3] || '100', 10);
const file = path.join(root, 'data', 'CYCLE COUNT TEGAL.xlsx');
const cache = path.join(root, 'data', 'parsed-cache.json');

async function load() {
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(file).mtimeMs) {
    return JSON.parse(fs.readFileSync(cache, 'utf8'));
  }
  console.log('Membaca xlsx (20-35 detik)...');
  const b = fs.readFileSync(file);
  const res = await P.loadWorkbook(XLSX, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  fs.writeFileSync(cache, JSON.stringify(res));
  return res;
}

// Item per bulan: akurasi dan selisih absolut dari penjumlahan baris.
function monthItems(rows, monthKey) {
  const m = new Map();
  for (const r of rows) {
    if (r.monthKey !== monthKey) continue;
    const k = r.key || r.sku;
    const e = m.get(k) || { heron: 0, real: 0 };
    e.heron += r.heron; e.real += r.real;
    m.set(k, e);
  }
  const out = new Map();
  for (const [k, e] of m) out.set(k, { acc: C.skuAcc(e.heron, e.real), abs: Math.abs(e.real - e.heron) });
  return out;
}

function evaluate(rows, months, weights) {
  const results = [];
  for (let i = 3; i < months.length; i++) {          // butuh minimal 3 bulan riwayat
    const M = months[i];
    const actual = monthItems(rows, M);
    const scored = new Map(C.riskScores(rows, target, { before: M, weights }).map(x => [x.key, x]));
    const cand = [...actual.keys()].filter(k => scored.has(k));
    if (cand.length < K) continue;

    // Pembanding: hanya melihat bulan terakhir (di bawah target atau tidak, lalu selisih terbesar).
    const prev = monthItems(rows, months[i - 1]);
    const lastOnly = cand.map(k => {
      const p = prev.get(k);
      return { k, bad: p && C.isBelow(p.acc, target) ? 1 : 0, abs: p ? p.abs : 0 };
    }).sort((a, b) => b.bad - a.bad || b.abs - a.abs).map(x => x.k);

    const byScore = cand.slice().sort((a, b) => scored.get(b).score - scored.get(a).score || scored.get(b).abs - scored.get(a).abs);
    const totalAbs = cand.reduce((a, k) => a + actual.get(k).abs, 0);
    const metric = order => {
      const top = order.slice(0, K);
      return { prec: top.filter(k => C.isBelow(actual.get(k).acc, target)).length / K,
               capture: top.reduce((a, k) => a + actual.get(k).abs, 0) / totalAbs };
    };
    results.push({ month: M, n: cand.length,
      base: cand.filter(k => C.isBelow(actual.get(k).acc, target)).length / cand.length,
      random: K / cand.length, score: metric(byScore), last: metric(lastOnly) });
  }
  return results;
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const p = v => (v * 100).toFixed(1).padStart(5) + '%';

(async () => {
  const res = await load();
  const months = res.months.map(m => m.key);
  console.log('Target ' + (target * 100) + '%, K = ' + K + ', ' + res.rows.length + ' baris, ' + months.length + ' bulan\n');

  const detail = process.argv.includes('--detail');
  const variants = [
    ['Bobot bawaan', undefined],
    ['Frekuensi saja', { rec: 100, last: 0, size: 0, dir: 0, clsA: 0, clsB: 0, variant: 0 }],
    ['Besar selisih saja', { rec: 0, last: 0, size: 100, dir: 0, clsA: 0, clsB: 0, variant: 0 }],
    ['B: size 40, rec 30, last 10', { rec: 30, last: 10, size: 40, dir: 5, clsA: 10, clsB: 5, variant: 5 }],
    ['C: size 50, rec 25, last 10', { rec: 25, last: 10, size: 50, dir: 5, clsA: 5, clsB: 2, variant: 5 }],
    ['D: size 35, rec 35, last 15', { rec: 35, last: 15, size: 35, dir: 5, clsA: 5, clsB: 2, variant: 5 }]
  ];
  console.log('variasi bobot'.padEnd(30) + 'presisi@K   bulan-terakhir   gap-tertangkap@K   bulan-terakhir   acak');
  for (const [name, w] of variants) {
    const r = evaluate(res.rows, months, w);
    if (!r.length) { console.log(name + ': data tidak cukup'); continue; }
    if (!detail) {
      console.log(name.padEnd(30) + p(mean(r.map(x => x.score.prec))) + '      ' + p(mean(r.map(x => x.last.prec))) + '          ' +
        p(mean(r.map(x => x.score.capture))) + '         ' + p(mean(r.map(x => x.last.capture))) + '        ' + p(mean(r.map(x => x.random))));
      continue;
    }
    console.log('== ' + name);
    console.log('bulan     item  laju-dasar | presisi@K skor / bulan-terakhir | gap-tertangkap@K skor / bulan-terakhir / acak');
    for (const x of r) {
      console.log(x.month + '  ' + String(x.n).padStart(5) + '  ' + p(x.base) + '     |   ' + p(x.score.prec) + '   ' + p(x.last.prec) +
        '          |   ' + p(x.score.capture) + '   ' + p(x.last.capture) + '   ' + p(x.random));
    }
    console.log('rata-rata' + ' '.repeat(18) + p(mean(r.map(x => x.base))) + '     |   ' + p(mean(r.map(x => x.score.prec))) + '   ' +
      p(mean(r.map(x => x.last.prec))) + '          |   ' + p(mean(r.map(x => x.score.capture))) + '   ' +
      p(mean(r.map(x => x.last.capture))) + '   ' + p(mean(r.map(x => x.random))) + '\n');
  }
})().catch(e => { console.error('GAGAL', e); process.exit(1); });

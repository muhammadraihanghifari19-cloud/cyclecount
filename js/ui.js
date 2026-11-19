/* Tampilan: filter, kartu, grafik, tabel. Semua teks dari spreadsheet dimasukkan lewat textContent. */
(function () {
  const C = window.CCCalc, P = window.CCParse, E = window.CCExport, S = window.CCStore;
  const $ = id => document.getElementById(id);
  const PAGE = 100;
  const MIN_GROUP = 10;
  const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#f97316'];
  const COLOR_DISPLAY = '#a855f7';

  const state = {
    rows: [], months: [], classList: [], humanErrors: [], potentialGaps: [], monthShort: {}, monthLabel: {},
    target: 0.99, mode: 'net', page: 0, sortKey: 'absGap', sortDir: -1, charts: {}, tab: 'ringkasan', list: []
  };

  /* ---------- format dan helper DOM ---------- */
  const modeName = () => (state.mode === 'net' ? 'netto' : 'absolut');
  const fmt = n => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const pct = v => (v * 100).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const pct0 = v => Math.round(v * 100).toLocaleString('id-ID') + '%';
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const accClass = a => C.isBelow(a, state.target) ? (a >= Math.min(state.target, 0.95) ? 'mid' : 'low') : 'good';
  const p2 = v => (v === null || v === undefined) ? null : +(v * 100).toFixed(2);
  const signed = n => (n > 0 ? '+' : '') + fmt(n);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function pill(a) { return el('span', 'pill ' + accClass(a), pct(a)); }
  function setOptions(sel, first, items, keep) {
    const cur = sel.value;
    sel.textContent = '';
    const o0 = el('option', '', first); o0.value = ''; sel.appendChild(o0);
    for (const it of items) { const o = el('option', '', it.label); o.value = it.value; sel.appendChild(o); }
    if (keep && items.some(i => i.value === cur)) sel.value = cur;
  }
  function status(msg, err) { const s = $('status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }
  // Isi elemen dengan potongan teks; objek {b: '...'} ditebalkan.
  function rich(node, parts) {
    node.textContent = '';
    for (const p of parts) {
      if (typeof p === 'string') node.appendChild(document.createTextNode(p));
      else node.appendChild(el('b', '', p.b));
    }
  }
  function emptyRow(tb, cols, text) {
    const tr = el('tr'); const td = el('td', '', text); td.colSpan = cols; tr.appendChild(td); tb.appendChild(tr);
  }

  /* ---------- filter ---------- */
  function filters(extra) {
    return Object.assign({
      month: $('fMonth').value, brand: $('fBrand').value, pic: $('fPic').value, cls: $('fCls').value, date: $('fDate').value,
      q: $('fSearch').value, onlyGap: $('fGap').checked, belowOnly: $('fBelow').checked, target: state.target
    }, extra || {});
  }
  function fillDates() {
    const rows = C.filterRows(state.rows, { month: $('fMonth').value });
    const dates = [...new Set(rows.map(r => r.date))].sort();
    setOptions($('fDate'), 'Semua tanggal', dates.map(d => ({ value: d, label: d })), false);
  }

  /* ---------- memuat data ---------- */
  function applyData(d, note) {
    state.rows = d.rows;
    state.risk = null;
    state.months = d.months;
    state.classList = d.classList || [];
    state.humanErrors = d.humanErrors || [];
    state.potentialGaps = d.potentialGaps || [];
    const hasCauses = state.humanErrors.length > 0 || state.potentialGaps.length > 0;
    $('tabPenyebab').classList.toggle('hidden', !hasCauses);
    if (!hasCauses && state.tab === 'penyebab') state.tab = 'ringkasan';
    state.monthShort = {}; state.monthLabel = {};
    for (const m of d.months) { state.monthShort[m.key] = m.short; state.monthLabel[m.key] = m.label; }

    setOptions($('fMonth'), 'Semua bulan', d.months.map(m => ({ value: m.key, label: m.label })), false);
    $('fMonth').value = d.months[d.months.length - 1].key;
    const uniq = k => [...new Set(d.rows.map(r => r[k]).filter(Boolean))].sort().map(v => ({ value: v, label: v }));
    setOptions($('fBrand'), 'Semua brand', uniq('brand'), false);
    setOptions($('fPic'), 'Semua PIC', uniq('pic'), false);
    const classes = [...new Set(d.rows.map(r => r.cls))].sort((a, b) => C.classRank(a) - C.classRank(b) || (a < b ? -1 : 1));
    setOptions($('fCls'), 'Semua kelas', classes.map(v => ({ value: v, label: v })), false);
    fillDates();

    $('empty').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('controls').classList.remove('hidden');
    status(note);
    state.page = 0;
    render();
    showTab(state.tab);
  }

  async function onFile(file) {
    if (!file) return;
    status('Membaca file...');
    try {
      const res = await P.loadWorkbook(XLSX, await file.arrayBuffer(), status);
      if (!res.months.length) { status('Tab "CC BY HERON <BULAN> 26" tidak ditemukan di file ini.', true); return; }
      let msg = file.name + ': ' + fmt(res.rows.length) + ' baris, ' + res.months.length + ' bulan.';
      if (!res.classList.length) msg += ' Tab SKU CLASS tidak ditemukan, kelas dan cakupan tidak tersedia.';
      if (res.skipped.length) msg += ' Dilewati (header tidak lengkap): ' + res.skipped.join(', ') + '.';
      applyData(res, msg);
      state.saveData = { rows: res.rows, months: res.months, classList: res.classList,
                         humanErrors: res.humanErrors, potentialGaps: res.potentialGaps,
                         meta: { name: file.name, savedAt: Date.now() } };
      if ($('persist').checked) await persistNow(msg);
    } catch (e) {
      status('Gagal membaca file: ' + e.message, true);
    }
  }

  /* ---------- penyimpanan di perangkat (opsional) ---------- */
  // Bawaan mati: data hanya ada selama halaman terbuka. Kalau dicentang, hasil bacaan disimpan di browser
  // ini (IndexedDB, tidak dikirim ke mana pun) supaya tidak perlu upload ulang.
  function getFlag() { try { return localStorage.getItem('cc.persist'); } catch (e) { return null; } }
  function setFlag(v) { try { localStorage.setItem('cc.persist', v); } catch (e) {} }

  async function persistNow(msg) {
    const ok = await S.save(state.saveData);
    const pre = msg ? msg + ' ' : '';
    if (ok) { $('clearCache').classList.remove('hidden'); status(pre + 'Tersimpan di perangkat ini.'); }
    else status(pre + 'Penyimpanan di browser tidak tersedia.', true);
  }

  async function loadCached() {
    const flag = getFlag();
    if (flag === '0') return;
    const d = await S.load();
    if (!d || state.rows.length || !d.rows || !d.rows.length) return;
    // Perangkat yang sudah punya data tersimpan sebelum ada pilihan ini dianggap sudah memilih menyimpan.
    if (flag === null) { setFlag('1'); $('persist').checked = true; }
    state.saveData = d;
    const when = d.meta && d.meta.savedAt ? new Date(d.meta.savedAt).toLocaleString('id-ID') : '';
    applyData(d, 'Data tersimpan: ' + (d.meta ? d.meta.name : '') + (when ? ' (' + when + ')' : '') +
                 '. Upload file baru untuk memperbarui.');
    $('clearCache').classList.remove('hidden');
  }

  /* ---------- render ---------- */
  function render() {
    const f = filters();
    const list = C.filterRows(state.rows, f);
    state.list = list;
    const scope = C.filterRows(state.rows, { brand: f.brand, pic: f.pic, cls: f.cls });
    const probs = C.problemSkus(scope, state.target, 2);
    renderCards(f, list);
    renderCharts(f, list, scope);
    renderSplit(list, scope);
    renderClass(f);
    renderRanks(list);
    renderProblems(probs);
    renderRisk(f);
    renderCompare(list, scope);
    renderCauses();
    renderTable();
    renderHeadline(list);
    renderPareto(list);
    renderHighlights(f, list);
    $('sub').textContent = (f.month ? state.monthLabel[f.month] : 'Semua bulan') +
      (f.brand ? ' | ' + f.brand : '') + (f.pic ? ' | ' + f.pic : '') + (f.cls ? ' | Kelas ' + f.cls : '');
  }

  /* ---------- kalimat besar dan konsentrasi selisih ---------- */
  function renderHeadline(list) {
    const big = $('hlBig'), line = $('hlLine');
    big.textContent = ''; line.textContent = '';
    if (!list.length) { big.textContent = 'Tidak ada data untuk filter ini.'; return; }
    const s = C.summarize(list, undefined, state.mode), o = C.overUnder(list);
    const n0 = v => Math.round(v).toLocaleString('id-ID');
    big.appendChild(el('span', 'num ' + accClass(s.acc), pct(s.acc)));
    const d = (s.acc - state.target) * 100;
    big.appendChild(document.createTextNode('akurasi ' + modeName() + ', target ' + fmt(state.target * 100) + '% (' +
      (d >= 0 ? 'lewat ' : 'kurang ') + Math.abs(d).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' poin)'));
    // Selisih yang dibandingkan dengan batas mengikuti mode: netto = |total Real - total Heron|, absolut = jumlah selisih per baris.
    const gap = state.mode === 'net' ? Math.abs(s.net) : s.abs;
    const allowed = s.heron - s.heron * state.target, need = Math.max(0, gap - allowed);
    line.textContent = 'Netto ' + pct(s.accNet) + ' | Absolut ' + pct(s.accAbs) + '. Lebih ' + n0(o.over) + ' dan kurang ' + n0(o.under) +
      ' pcs saling menutupi, total pcs yang salah ' + n0(s.abs) + '. Batas selisih ' + modeName() + ' untuk target ' + n0(allowed) + ' pcs' +
      (need > 0 ? ', perlu turun ' + n0(need) + ' pcs.' : '. Target tercapai.');
  }

  function renderPareto(list) {
    const p = C.pareto(list, state.target), chips = $('parChips');
    chips.textContent = '';
    if (!p.items.length) { if (state.charts.chPareto) { state.charts.chPareto.destroy(); delete state.charts.chPareto; } return; }
    for (const n of [10, 20, 100]) {
      if (p.count < n && n !== 10) continue;
      const s = el('div', 'stat'); s.appendChild(el('b', '', Math.min(n, p.count) + ' SKU'));
      s.appendChild(document.createTextNode(' = ' + pct0(p.share(n)) + ' dari selisih')); chips.appendChild(s);
    }
    if (p.skuToTarget) {
      const s = el('div', 'stat strong'); s.appendChild(el('b', '', p.skuToTarget + ' SKU'));
      s.appendChild(document.createTextNode(' perlu dibereskan untuk capai target')); chips.appendChild(s);
    }
    const top = p.items.slice(0, 20);
    if (state.charts.chPareto) state.charts.chPareto.destroy();
    const tick = css('--mute'), grid = css('--line');
    state.charts.chPareto = new Chart($('chPareto'), {
      type: 'bar',
      data: {
        labels: top.map(x => { const n = x.name || x.sku; return n.length > 16 ? n.slice(0, 15) + '…' : n; }),
        datasets: [
          { type: 'bar', label: 'Selisih (pcs)', data: top.map(x => +x.abs.toFixed(2)), backgroundColor: css('--bad'), yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Kumulatif (%)', data: top.map(x => +(x.cumPct * 100).toFixed(1)), borderColor: css('--ink'),
            backgroundColor: css('--ink'), pointRadius: 3, tension: .2, yAxisID: 'y2', order: 1 }
        ]
      },
      options: {
        maintainAspectRatio: false, animation: { duration: 250 },
        plugins: {
          legend: { display: true, labels: { color: tick } },
          tooltip: { callbacks: { title: items => { const x = top[items[0].dataIndex]; return (x.name || x.sku) + ' (' + x.sku + (x.code ? ' / ' + x.code : '') + ')'; } } }
        },
        scales: {
          y: { ticks: { color: tick, callback: v => fmt(v) }, grid: { color: grid } },
          y2: { position: 'right', min: 0, max: 100, ticks: { color: tick, callback: v => v + '%' }, grid: { display: false } },
          x: { ticks: { color: tick, maxRotation: 60, minRotation: 40 }, grid: { display: false } }
        }
      }
    });
  }

  function renderCards(f, list) {
    const s = C.summarize(list, state.target, state.mode);
    $('cAcc').textContent = pct(s.acc);
    $('cAccK').textContent = 'Akurasi ' + modeName();
    $('cardAcc').className = 'card ' + (s.n ? accClass(s.acc) : '');
    $('cardAcc').title = 'Netto = 1 - |total Real - total Heron| / total Heron (rumus tab Review dan dashboard Excel). ' +
      'Absolut = 1 - jumlah |Real - Heron| per baris / total Heron. Akurasi per SKU sama di keduanya.';
    $('cAccS').textContent = '';
    if (f.month) {
      const prev = C.previousMonthKey(state.months.map(m => m.key), f.month);
      if (prev) {
        const p = C.filterRows(state.rows, { month: prev, brand: f.brand, pic: f.pic, cls: f.cls });
        if (p.length && s.n) {
          const d = (s.acc - C.summarize(p, undefined, state.mode).acc) * 100;
          $('cAccS').appendChild(el('span', d >= 0 ? 'up' : 'down',
            (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' poin'));
          $('cAccS').appendChild(document.createTextNode(' vs ' + state.monthLabel[prev]));
        }
      }
    }
    if (!$('cAccS').textContent) $('cAccS').textContent = (state.mode === 'net' ? 'Absolut ' + pct(s.accAbs) : 'Netto ' + pct(s.accNet));
    $('cSku').textContent = fmt(new Set(list.map(r => r.sku)).size);
    $('cSkuS').textContent = fmt(s.n) + ' baris hitungan';
    $('cMatch').textContent = fmt(s.match);
    $('cMatchS').textContent = s.n ? pct(s.match / s.n) + ' dari baris hitungan' : '';
    $('cBelow').textContent = fmt(s.below);
    $('cBelowS').textContent = s.n ? pct(s.below / s.n) + ' dari baris hitungan' : '';
    const o = C.overUnder(list);
    $('cGap').textContent = signed(o.net);
    $('cGapS').textContent = '+' + fmt(o.over) + ' lebih | -' + fmt(o.under) + ' kurang';
  }

  /* ---------- grafik ---------- */
  // cfg: type, labels, datasets, legend, percent (default true), stacked.
  function drawChart(id, cfg) {
    if (state.charts[id]) state.charts[id].destroy();
    const grid = css('--line'), tick = css('--mute');
    const percent = cfg.percent !== false;
    const y = { ticks: { color: tick }, grid: { color: grid } };
    if (percent) {
      const all = cfg.datasets.flatMap(d => d.data).filter(v => v !== null && v !== undefined);
      y.min = Math.max(0, Math.floor(Math.min(...all, state.target * 100) - 3));
      y.max = 100;
      y.ticks.callback = v => v + '%';
    } else {
      y.stacked = !!cfg.stacked;
      y.ticks.callback = v => fmt(v);
    }
    state.charts[id] = new Chart($(id), {
      type: cfg.type,
      data: { labels: cfg.labels, datasets: cfg.datasets },
      options: {
        maintainAspectRatio: false, spanGaps: true, animation: { duration: 250 },
        plugins: {
          legend: { display: !!cfg.legend, labels: { color: tick } },
          tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.parsed.y === null ? '-' :
            (percent ? c.parsed.y.toLocaleString('id-ID') + '%' : fmt(Math.abs(c.parsed.y)) + ' pcs')) } }
        },
        scales: { y, x: { ticks: { color: tick }, grid: { display: false }, stacked: !percent && !!cfg.stacked } }
      }
    });
  }

  function targetSet(n) {
    return { type: 'line', label: 'Target', data: Array(n).fill(+(state.target * 100).toFixed(2)), borderColor: css('--warn'),
             borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false, order: 0 };
  }
  function lineSet(label, data, color, thick) {
    return { type: 'line', label, data: data.map(p2), borderColor: color, backgroundColor: color,
             borderWidth: thick ? 3 : 1.75, pointRadius: thick ? 4 : 3, tension: .25, fill: false };
  }

  function renderCharts(f, list, scope) {
    const keys = state.months.map(m => m.key);
    const labels = keys.map(k => state.monthShort[k]);

    const t = C.trend(scope, keys, state.mode);
    const sets = t.series.map((s, i) => lineSet(i === 0 ? 'Total ' + modeName() : s.name, s.data, i === 0 ? css('--ink') : PALETTE[(i - 1) % PALETTE.length], i === 0));
    // Total dengan rumus lainnya sebagai garis putus-putus, supaya jarak netto dan absolut kelihatan.
    const other = C.trend(scope, keys, state.mode === 'net' ? 'abs' : 'net').series[0].data;
    sets.splice(1, 0, Object.assign(lineSet('Total ' + (state.mode === 'net' ? 'absolut' : 'netto'), other, css('--mute')),
      { borderDash: [3, 3], borderWidth: 1.5, pointRadius: 2 }));
    sets.push(targetSet(keys.length));
    drawChart('chTrend', { type: 'line', labels, datasets: sets, legend: true });

    const bars = (id, key) => {
      const g = C.groupSummary(list, key, state.target, state.mode);
      drawChart(id, {
        type: 'bar', labels: g.map(x => x.key),
        datasets: [{ type: 'bar', label: 'Akurasi', data: g.map(x => p2(x.acc)), order: 1,
                     backgroundColor: g.map(x => C.isBelow(x.acc, state.target) ? css('--bad') : css('--accent')) },
                   targetSet(g.length)]
      });
    };
    const day = C.groupSummary(list, 'date', state.target, state.mode);
    drawChart('chDay', { type: 'line', labels: day.map(x => x.key),
      datasets: [lineSet('Akurasi', day.map(x => x.acc), css('--accent')), targetSet(day.length)] });
    bars('chBrand', 'brand');
    bars('chPic', 'pic');

    const ou = C.overUnderTrend(scope, keys);
    drawChart('chOver', {
      type: 'bar', labels, percent: false, stacked: true, legend: true,
      datasets: [
        { type: 'bar', label: 'Lebih (Real > Heron)', data: ou.over, backgroundColor: css('--ok'), stack: 's' },
        { type: 'bar', label: 'Kurang (Real < Heron)', data: ou.under.map(v => -v), backgroundColor: css('--bad'), stack: 's' }
      ]
    });
  }

  /* ---------- storage vs display ---------- */
  function renderSplit(list, scope) {
    const s = C.splitSummary(list, state.mode);
    const keys = state.months.map(m => m.key), labels = keys.map(k => state.monthShort[k]);
    if (!s) {
      $('splitMsg').textContent = 'Data pemisahan storage dan display tidak tersedia untuk pilihan ini.';
      for (const id of ['sAcc', 'dAcc']) $(id).textContent = '-';
      $('sAccS').textContent = ''; $('dAccS').textContent = '';
    } else {
      rich($('splitMsg'), [
        'Display: ', { b: pct0(s.displayAbsShare) }, ' dari selisih, ', { b: pct0(s.displayStockShare) },
        ' dari stok. Akurasi display ', { b: pct(s.display.acc) }, ', storage ', { b: pct(s.storage.acc) }, '.'
      ]);
      $('sAcc').textContent = pct(s.storage.acc);
      $('dAcc').textContent = pct(s.display.acc);
      $('cardStorage').className = 'card ' + accClass(s.storage.acc);
      $('cardDisplay').className = 'card ' + accClass(s.display.acc);
      $('sAccS').textContent = 'Selisih abs ' + fmt(s.storage.abs) + ' dari Heron ' + fmt(s.storage.heron);
      $('dAccS').textContent = 'Selisih abs ' + fmt(s.display.abs) + ' dari Heron ' + fmt(s.display.heron);
    }

    const tr = C.splitTrend(scope, keys, state.mode);
    drawChart('chSplitTrend', { type: 'line', labels, legend: true, datasets: [
      lineSet('Storage', tr.storage, css('--accent'), true), lineSet('Display', tr.display, COLOR_DISPLAY, true), targetSet(keys.length)] });

    const grouped = (id, key) => {
      const g = C.splitGroup(list, key, state.mode);
      drawChart(id, { type: 'bar', labels: g.map(x => x.key), legend: true, datasets: [
        { type: 'bar', label: 'Storage', data: g.map(x => p2(x.storage)), backgroundColor: css('--accent'), order: 1 },
        { type: 'bar', label: 'Display', data: g.map(x => p2(x.display)), backgroundColor: COLOR_DISPLAY, order: 1 },
        targetSet(g.length)] });
    };
    grouped('chSplitBrand', 'brand');
    grouped('chSplitPic', 'pic');
  }

  /* ---------- kelas dan cakupan ---------- */
  function renderClass(f) {
    const noCls = C.filterRows(state.rows, Object.assign({}, f, { cls: '' }));
    const cs = C.classSummary(noCls, state.target, state.mode);
    drawChart('chClass', {
      type: 'bar', labels: cs.map(x => x.key),
      datasets: [{ type: 'bar', label: 'Akurasi', data: cs.map(x => p2(x.acc)), order: 1,
                   backgroundColor: cs.map(x => C.isBelow(x.acc, state.target) ? css('--bad') : css('--accent')) },
                 targetSet(cs.length)]
    });

    const monthRows = C.filterRows(state.rows, { month: f.month });
    const covBody = $('covBody'); covBody.textContent = '';
    const uncBody = $('uncBody'); uncBody.textContent = '';
    const when = f.month ? state.monthLabel[f.month] : 'semua bulan';
    if (!state.classList.length) {
      $('covHint').textContent = 'Tab SKU CLASS tidak ditemukan di file ini, jadi cakupan tidak bisa dihitung.';
      $('uncHint').textContent = '';
      emptyRow(covBody, 6, '-'); emptyRow(uncBody, 5, '-');
      return;
    }
    $('covHint').textContent = 'Sudah dihitung: ' + when + (f.brand ? ', ' + f.brand : '') + '.';
    const accByCls = new Map(cs.map(x => [x.key, x.acc]));
    for (const c of C.coverage(state.classList, monthRows, f.brand)) {
      const tr = el('tr');
      tr.appendChild(el('td', 'cls', c.key));
      tr.appendChild(el('td', 'n', fmt(c.total)));
      tr.appendChild(el('td', 'n', fmt(c.counted)));
      tr.appendChild(el('td', 'n', fmt(c.total - c.counted)));
      const tb = el('td'); const bar = el('div', 'bar');
      const fill = el('span'); fill.style.width = Math.round(c.pct * 100) + '%';
      bar.appendChild(fill); bar.appendChild(el('em', '', pct0(c.pct)));
      tb.appendChild(bar); tr.appendChild(tb);
      const ta = el('td', 'n');
      if (accByCls.has(c.key)) ta.appendChild(pill(accByCls.get(c.key))); else ta.textContent = '-';
      tr.appendChild(ta);
      covBody.appendChild(tr);
    }
    const unc = C.uncounted(state.classList, monthRows, f.brand, f.cls);
    $('uncHint').textContent = fmt(unc.length) + ' SKU belum dihitung' + (f.cls ? ' (kelas ' + f.cls + ')' : '') +
      (unc.length > 100 ? ', 100 teratas' : '') + '. Urut kelas, lalu penjualan.';
    if (!unc.length) emptyRow(uncBody, 5, 'Semua SKU sudah dihitung.');
    for (const e of unc.slice(0, 100)) {
      const tr = el('tr');
      tr.appendChild(el('td', 'cls', e.cls));
      tr.appendChild(el('td', '', e.sku));
      const tn = el('td', 'name', e.name); tn.title = e.name; tr.appendChild(tn);
      tr.appendChild(el('td', '', e.brand));
      tr.appendChild(el('td', 'n', fmt(e.sales)));
      uncBody.appendChild(tr);
    }
  }

  /* ---------- ranking ---------- */
  function renderRank(tbodyId, list, key, selectId) {
    const tb = $(tbodyId); tb.textContent = '';
    C.rankByAcc(C.groupSummary(list, key, state.target, state.mode)).forEach((g, i) => {
      const tr = el('tr', 'click');
      tr.title = 'Klik untuk memfilter';
      tr.appendChild(el('td', '', String(i + 1)));
      tr.appendChild(el('td', '', g.key));
      tr.appendChild(el('td', 'n', fmt(g.n)));
      const ta = el('td', 'n'); ta.appendChild(pill(g.acc)); tr.appendChild(ta);
      tr.appendChild(el('td', 'n', fmt(g.below)));
      tr.appendChild(el('td', 'n', fmt(g.abs)));
      tr.onclick = () => { $(selectId).value = $(selectId).value === g.key ? '' : g.key; state.page = 0; render(); };
      tb.appendChild(tr);
    });
  }
  function renderRanks(list) {
    renderRank('rankPic', list, 'pic', 'fPic');
    renderRank('rankBrand', list, 'brand', 'fBrand');
  }

  /* ---------- SKU bermasalah berulang ---------- */
  function renderProblems(probs) {
    $('probHint').textContent = fmt(probs.length) + ' SKU di bawah ' + fmt(state.target * 100) + '% di 2 bulan atau lebih' +
      (probs.length > 100 ? ' (100 teratas)' : '') + '.';
    const tb = $('probBody'); tb.textContent = '';
    if (!probs.length) { emptyRow(tb, 7, 'Tidak ada SKU yang memenuhi kriteria.'); return; }
    for (const p of probs.slice(0, 100)) {
      const tr = el('tr', 'click');
      tr.appendChild(el('td', '', p.sku));
      tr.appendChild(el('td', '', p.code || '-'));
      const tn = el('td', 'name', p.name); tn.title = p.name; tr.appendChild(tn);
      tr.appendChild(el('td', '', p.brand));
      tr.appendChild(el('td', 'n', String(p.badMonths)));
      const tm = el('td');
      for (const m of p.months) {
        tm.appendChild(el('span', 'chip' + (C.isBelow(m.acc, state.target) ? ' bad' : ''), (state.monthShort[m.monthKey] || m.monthKey) + ' ' + pct(m.acc)));
      }
      tr.appendChild(tm);
      tr.appendChild(el('td', 'n', fmt(p.absGap)));
      tr.onclick = () => {
        $('fSearch').value = p.code || p.sku; $('fMonth').value = ''; fillDates();
        $('fGap').checked = false; $('fBelow').checked = false; state.page = 0; render();
        showTab('detail');
      };
      tb.appendChild(tr);
    }
  }

  /* ---------- perbandingan Heron vs Real ---------- */
  function cmpFill(tbodyId, rows, labelOf, total) {
    const tb = $(tbodyId); tb.textContent = '';
    if (!rows.length) { emptyRow(tb, 9, 'Tidak ada data.'); return; }
    const add = (r, label, cls) => {
      const tr = el('tr', cls);
      tr.appendChild(el('td', '', label));
      tr.appendChild(el('td', 'n', fmt(r.n)));
      tr.appendChild(el('td', 'n', fmt(r.heron)));
      tr.appendChild(el('td', 'n', fmt(r.real)));
      const tg = el('td', 'n', signed(r.net));
      if (r.net) tg.style.color = r.net > 0 ? css('--ok') : css('--bad');
      tr.appendChild(tg);
      tr.appendChild(el('td', 'n', fmt(r.over)));
      tr.appendChild(el('td', 'n', fmt(r.under)));
      for (const a of [r.accNet, r.accAbs]) { const td = el('td', 'n'); td.appendChild(pill(a)); tr.appendChild(td); }
      tb.appendChild(tr);
    };
    rows.forEach(r => add(r, labelOf(r.key), ''));
    if (total) add(total, 'Total', 'total');
  }

  function renderCompare(list, scope) {
    const tot = l => { const s = C.summarize(l), o = C.overUnder(l);
      return { n: s.n, heron: s.heron, real: s.real, net: s.net, over: o.over, under: o.under, accNet: s.accNet, accAbs: s.accAbs }; };
    cmpFill('cmpMonth', C.compareTable(scope, 'monthKey'), k => state.monthLabel[k] || k, scope.length ? tot(scope) : null);
    cmpFill('cmpBrand', C.compareTable(list, 'brand', 'heron'), k => k, list.length ? tot(list) : null);
    cmpFill('cmpPic', C.compareTable(list, 'pic', 'heron'), k => k, list.length ? tot(list) : null);
  }

  /* ---------- risiko ---------- */
  const RISK_HIGH = 80;

  // Skor memakai seluruh riwayat (6 bulan terakhir) dan dihitung sekali per data dan target.
  function riskAll() {
    if (!state.risk || state.riskTarget !== state.target) {
      let items = C.riskScores(state.rows, state.target);
      // Laporan human error 6 bulan terakhir ditambahkan sebagai alasan. Tidak masuk skor.
      if (state.humanErrors.length && state.months.length) {
        const since = C.shiftMonth(state.months[state.months.length - 1].key, -5);
        items = C.annotateReports(items, state.humanErrors, since).map(x => x.repCats.length
          ? Object.assign({}, x, { reasons: x.reasons.concat('laporan human error: ' + x.repCats.join(', ').toLowerCase()) }) : x);
      }
      state.risk = items;
      state.riskTarget = state.target;
    }
    return state.risk;
  }
  function riskView(f) {
    const q = (f.q || '').trim().toLowerCase();
    return riskAll().filter(x => (!f.brand || x.brand === f.brand) && (!f.pic || x.pic === f.pic) && (!f.cls || x.cls === f.cls) &&
      (!q || x.sku.toLowerCase().includes(q) || (x.code || '').includes(q) || x.name.toLowerCase().includes(q)));
  }

  function renderRisk(f) {
    const view = riskView(f);
    state.riskList = view;
    const high = view.filter(x => x.score >= RISK_HIGH).length;
    $('riskHint').textContent = fmt(view.length) + ' item, ' + fmt(high) + ' berisiko tinggi (skor ' + RISK_HIGH + ' ke atas). Dari ' +
      (state.months.length > 6 ? 6 : state.months.length) + ' bulan terakhir.';
    $('riskCsv').disabled = $('riskXlsx').disabled = !view.length;
    const tb = $('riskBody'); tb.textContent = '';
    if (!view.length) { emptyRow(tb, 8, 'Tidak ada data.'); return; }
    for (const x of view.slice(0, 100)) {
      const tr = el('tr', 'click');
      const ts = el('td', 'n'); ts.appendChild(el('span', 'pill ' + (x.score >= RISK_HIGH ? 'low' : x.score >= 60 ? 'mid' : 'good'), String(x.score)));
      tr.appendChild(ts);
      tr.appendChild(el('td', '', x.sku));
      tr.appendChild(el('td', '', x.code || '-'));
      const tn = el('td', 'name', x.name); tn.title = x.name; tr.appendChild(tn);
      tr.appendChild(el('td', '', x.brand));
      tr.appendChild(el('td', 'cls', x.cls));
      tr.appendChild(el('td', '', x.pic));
      tr.appendChild(el('td', '', x.reasons.join('; ')));
      tr.onclick = () => {
        $('fSearch').value = x.code || x.sku; $('fMonth').value = ''; fillDates();
        $('fGap').checked = false; $('fBelow').checked = false; state.page = 0; render();
        showTab('detail');
      };
      tb.appendChild(tr);
    }
  }

  /* ---------- penyebab ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monLabel = k => MON[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4);

  // Grafik jumlah (bukan persen). cfg: type, labels, datasets, horizontal, stacked, legend.
  function drawCount(id, cfg) {
    if (state.charts[id]) state.charts[id].destroy();
    const tick = css('--mute'), grid = css('--line'), h = !!cfg.horizontal;
    const val = { ticks: { color: tick, callback: v => fmt(v) }, grid: { color: grid }, stacked: !!cfg.stacked, beginAtZero: true };
    const cat = { ticks: { color: tick }, grid: { display: false }, stacked: !!cfg.stacked };
    state.charts[id] = new Chart($(id), {
      type: cfg.type,
      data: { labels: cfg.labels, datasets: cfg.datasets },
      options: {
        indexAxis: h ? 'y' : 'x', maintainAspectRatio: false, animation: { duration: 250 },
        plugins: { legend: { display: !!cfg.legend, labels: { color: tick } } },
        scales: h ? { x: val, y: cat } : { y: val, x: cat }
      }
    });
  }

  function renderCauses() {
    const he = state.humanErrors;
    const pg = $('pgBody'); pg.textContent = '';
    $('pgPanel').classList.toggle('hidden', !state.potentialGaps.length);
    for (const x of state.potentialGaps) {
      const tr = el('tr');
      tr.appendChild(el('td', 'n', String(x.no)));
      tr.appendChild(el('td', '', x.name));
      tr.appendChild(el('td', '', x.owner || '-'));
      pg.appendChild(tr);
    }
    if (!he.length) {
      $('causeHint').textContent = 'Tab REPORT HUMAN ERROR tidak ada atau kosong.';
      for (const id of ['chCause', 'chArea', 'chCauseMonth']) if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
      return;
    }
    const months = [...new Set(he.map(r => r.monthKey))].sort();
    $('causeHint').textContent = fmt(he.length) + ' laporan, ' + monLabel(months[0]) + ' sampai ' + monLabel(months[months.length - 1]) + '.';
    const cats = C.causeCounts(he, 'cats');
    drawCount('chCause', { type: 'bar', horizontal: true, labels: cats.map(x => x.key),
      datasets: [{ label: 'Laporan', data: cats.map(x => x.n), backgroundColor: css('--accent') }] });
    const areas = C.causeCounts(he, 'area');
    drawCount('chArea', { type: 'bar', labels: areas.map(x => x.key),
      datasets: [{ label: 'Laporan', data: areas.map(x => x.n), backgroundColor: css('--accent') }] });
    const bm = C.causeByMonth(he, 3);
    const colors = [PALETTE[0], PALETTE[1], PALETTE[2], '#94a3b8'];
    drawCount('chCauseMonth', { type: 'bar', stacked: true, legend: true, labels: bm.months.map(monLabel),
      datasets: bm.series.map((s, i) => ({ label: s.name, data: s.data, backgroundColor: colors[i % colors.length] })) });
  }

  /* ---------- sorotan ---------- */
  function renderHighlights(f, list) {
    const ul = $('highlights'); ul.textContent = '';
    const add = parts => { const li = el('li'); rich(li, parts); ul.appendChild(li); };
    if (!list.length) return;

    // Kelompok dengan SKU sedikit diabaikan karena akurasinya mudah ekstrem.
    for (const [key, label] of [['brand', 'Brand'], ['pic', 'PIC']]) {
      const r = C.rankByAcc(C.groupSummary(list, key, state.target, state.mode)).filter(g => g.n >= MIN_GROUP && g.key !== 'Tidak diketahui');
      if (r.length > 1) add([label + ' terendah ', { b: r[0].key }, ' ' + pct(r[0].acc) + ' (' + r[0].n + ' baris)']);
    }
    const s = C.splitSummary(list, state.mode);
    if (s) add(['Display: ', { b: pct0(s.displayAbsShare) }, ' dari selisih, ' + pct0(s.displayStockShare) + ' dari stok']);
    if (state.classList.length) {
      const a = C.coverage(state.classList, C.filterRows(state.rows, { month: f.month }), f.brand).find(x => x.key === 'A');
      if (a) add(['Kelas A sudah dihitung ', { b: fmt(a.counted) + '/' + fmt(a.total) }, ' (' + pct0(a.pct) + ')']);
    }
    const high = riskView(f).filter(x => x.score >= RISK_HIGH).length;
    if (high) add(['Risiko selisih tinggi: ', { b: fmt(high) + ' item' }, ' (tab Risiko)']);
  }

  /* ---------- tabel utama ---------- */
  const gapCell = v => (v === null || v === undefined) ? '-' : signed(v);
  const numCell = v => (v === null || v === undefined) ? '-' : fmt(v);
  const COLS = [
    ['monthKey', 'Bulan', false, r => r.monthShort], ['date', 'Tanggal', false, r => r.date], ['pic', 'PIC', false, r => r.pic],
    ['brand', 'Brand', false, r => r.brand], ['cls', 'Kelas', false, r => r.cls], ['sku', 'SKU No', false, r => r.sku], ['code', 'Kode SAP', false, r => r.code || '-'],
    ['name', 'Produk', false, r => r.name],
    ['heron', 'Heron', true, r => fmt(r.heron), true], ['real', 'Real', true, r => fmt(r.real)], ['gap', 'Gap', true, r => signed(r.gap)],
    ['sHeron', 'Heron Storage', true, r => numCell(r.sHeron), true], ['sReal', 'Real Storage', true, r => numCell(r.sReal)],
    ['sGap', 'Gap Storage', true, r => gapCell(r.sGap)],
    ['dHeron', 'Heron Display', true, r => numCell(r.dHeron), true], ['dReal', 'Real Display', true, r => numCell(r.dReal)],
    ['dGap', 'Gap Display', true, r => gapCell(r.dGap)],
    ['acc', 'Akurasi', true, null, true]
  ];
  const GAP_KEYS = ['gap', 'sGap', 'dGap'];
  function sortedList() { return C.sortRows(state.list || [], state.sortKey, state.sortDir); }

  function renderTable() {
    const head = $('thead'); head.textContent = '';
    for (const [k, label, num, , grp] of COLS) {
      const th = el('th', 'sortable' + (num ? ' n' : '') + (grp ? ' grp' : ''), label + (state.sortKey === k ? (state.sortDir > 0 ? ' ▲' : ' ▼') : ''));
      th.onclick = () => {
        state.sortDir = state.sortKey === k ? -state.sortDir : (k === 'acc' ? 1 : -1);
        state.sortKey = k; state.page = 0; renderTable();
      };
      head.appendChild(th);
    }
    const list = sortedList();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    state.page = Math.min(state.page, pages - 1);
    const tb = $('tbody'); tb.textContent = '';
    for (const r of list.slice(state.page * PAGE, state.page * PAGE + PAGE)) {
      const tr = el('tr', C.isBelow(r.acc, state.target) ? 'below' : '');
      COLS.forEach(([k, , num, get, grp]) => {
        const td = el('td', (num ? 'n' : '') + (k === 'name' ? ' name' : '') + (k === 'cls' ? ' cls' : '') + (grp ? ' grp' : ''));
        if (k === 'acc') td.appendChild(pill(r.acc));
        else td.textContent = get(r);
        if (k === 'name') td.title = r.name;
        if (GAP_KEYS.includes(k) && r[k]) td.style.color = r[k] > 0 ? css('--ok') : css('--bad');
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    $('pageInfo').textContent = 'Halaman ' + (state.page + 1) + ' / ' + pages + ' (' + fmt(list.length) + ' baris)';
    $('prev').disabled = state.page === 0;
    $('next').disabled = state.page >= pages - 1;
  }

  /* ---------- tab ---------- */
  function showTab(name) {
    state.tab = name;
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + name));
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    // Grafik yang dibuat saat tab tersembunyi perlu dihitung ulang ukurannya.
    Object.values(state.charts).forEach(c => { if (c && c.resize) c.resize(); });
  }

  /* ---------- target, tema, ekspor ---------- */
  function loadTarget() {
    let v = NaN;
    try { v = parseFloat(localStorage.getItem('cc.target')); } catch (e) {}
    state.target = (v >= 0 && v <= 100) ? v / 100 : 0.99;
    $('fTarget').value = +(state.target * 100).toFixed(2);
  }
  function onTarget() {
    const v = parseFloat($('fTarget').value);
    if (!(v >= 0 && v <= 100)) return;
    state.target = v / 100;
    try { localStorage.setItem('cc.target', String(v)); } catch (e) {}
    state.page = 0;
    render();
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('cc.theme', t); } catch (e) {}
    $('theme').textContent = t === 'dark' ? 'Mode terang' : 'Mode gelap';
    if (state.rows.length) render();
  }
  function exportName() {
    const f = filters();
    return 'akurasi-cycle-count' + (f.month ? '-' + f.month : '-semua-bulan');
  }
  function reset() {
    $('fMonth').value = state.months[state.months.length - 1].key;
    $('fBrand').value = ''; $('fPic').value = ''; $('fCls').value = ''; $('fSearch').value = '';
    $('fGap').checked = false; $('fBelow').checked = false;
    fillDates(); state.page = 0; render();
  }

  /* ---------- pasang event ---------- */
  $('file').addEventListener('change', e => onFile(e.target.files[0]));
  $('fMonth').onchange = () => { fillDates(); state.page = 0; render(); };
  ['fBrand', 'fPic', 'fCls', 'fDate', 'fGap', 'fBelow'].forEach(id => $(id).onchange = () => { state.page = 0; render(); });
  $('fSearch').oninput = () => { state.page = 0; render(); };
  $('fTarget').onchange = onTarget;
  $('reset').onclick = reset;
  $('prev').onclick = () => { state.page--; renderTable(); };
  $('next').onclick = () => { state.page++; renderTable(); };
  $('expCsv').onclick = () => E.downloadCSV(sortedList(), exportName());
  $('expXlsx').onclick = () => E.downloadXLSX(XLSX, sortedList(), exportName());
  $('print').onclick = () => window.print();
  $('riskCsv').onclick = () => E.downloadRiskCSV((state.riskList || []).slice(0, 200), 'risiko-hitung-dulu');
  $('riskXlsx').onclick = () => E.downloadRiskXLSX(XLSX, state.riskList || [], 'risiko-hitung-dulu-per-pic', 50);
  $('theme').onclick = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('clearCache').onclick = async () => {
    await S.clear();
    $('clearCache').classList.add('hidden');
    status('Data tersimpan dihapus. Data yang sedang tampil tetap ada sampai halaman ditutup.');
  };
  $('persist').onchange = async () => {
    setFlag($('persist').checked ? '1' : '0');
    if ($('persist').checked) {
      if (state.saveData) await persistNow();
      else status('Penyimpanan aktif. Data disimpan setelah upload berikutnya.');
    } else {
      await S.clear();
      $('clearCache').classList.add('hidden');
      status('Penyimpanan dimatikan dan data tersimpan dihapus.');
    }
  };

  $('fMode').onchange = () => {
    state.mode = $('fMode').value === 'abs' ? 'abs' : 'net';
    try { localStorage.setItem('cc.mode', state.mode); } catch (e) {}
    if (state.rows.length) render();
  };

  try { state.mode = localStorage.getItem('cc.mode') === 'abs' ? 'abs' : 'net'; } catch (e) {}
  $('fMode').value = state.mode;
  $('persist').checked = getFlag() === '1';
  loadTarget();
  $('theme').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Mode terang' : 'Mode gelap';
  loadCached();
})();

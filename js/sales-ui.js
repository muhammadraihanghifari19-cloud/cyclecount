/* Tampilan Sales Dashboard. Mengonsumsi SalesParse, SalesCalc, CCStore dari window. */
(function () {
  const P = window.SalesParse, C = window.SalesCalc, S = window.CCStore;
  const $ = id => document.getElementById(id);
  const PALETTE = ['#2563eb','#f59e0b','#10b981','#ec4899','#8b5cf6','#06b6d4','#ef4444','#84cc16','#f97316','#a855f7'];
    const state = { rows: [], charts: {}, tab: 'ringkasan', ccMap: null, maxPrice: 100000,
                    fsn: null, dataRange: null };

  /* ---------- format ---------- */
  const fmt   = n => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  const fmtRp = n => 'Rp ' + Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  const css   = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function emptyRow(tb, cols, text) {
    const tr = el('tr'); const td = el('td', '', text); td.colSpan = cols; tr.appendChild(td); tb.appendChild(tr);
  }
  function status(msg, err) { const s = $('status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }

  function setOptions(sel, first, vals) {
    const cur = sel.value;
    sel.innerHTML = '';
    const o0 = el('option', '', first); o0.value = ''; sel.appendChild(o0);
    for (const v of vals) { const o = el('option', '', v); o.value = v; sel.appendChild(o); }
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }

  /* ---------- filter ---------- */
  function filters() {
    return {
      brand: $('fBrand').value, marketplace: $('fMp').value,
      dateFrom: $('fFrom').value || null, dateTo: $('fTo').value || null,
      q: $('fSearch').value,
      bundleOnly: $('fNonBundle').checked,
      fsnFilter: $('fFsn').value || ''
    };
  }

  /* ---------- upload ---------- */
  $('file').addEventListener('change', async e => {
    const files = [...e.target.files]; if (!files.length) return;
    status('Membaca ' + files.length + ' file...');
    try {
      const { merged, perFile } = await P.loadFiles(files, status);
      const ul = $('fileList'); ul.innerHTML = '';
      let totalDupe = 0;
      for (const f of perFile) {
        const li = el('li', f.rows.length === 0 ? 'warn' : '');
        li.textContent = f.fileName + ' (' + fmt(f.rows.length) + ' baris)';
        li.appendChild(el('span', '', f.rows.length ? '✓' : '!'));
        ul.appendChild(li);
        totalDupe += (f.rows.length > 0 ? 0 : 0);
      }
      const { rows } = merged;
      if (!rows.length) { status('Tidak ada baris valid.', true); return; }
      state.rows = rows;
      // Hitung FSN dari seluruh data (semua bulan yang di-upload).
      const ccSkus = state.ccMap ? new Set([...state.ccMap.keys()].map(k => k.split('|')[0])) : null;
      state.fsn = C.fsnClassify(rows, ccSkus);
      state.dataRange = C.dataRange(rows);

      // Coba ambil data cycle count dari IndexedDB (dari dashboard cc yang sama browser-nya).
      state.ccMap = null;
      if (S) {
        const cached = await S.load();
        if (cached && cached.rows && cached.rows.length) {
          state.ccMap = C.linkToCc(rows, cached.rows);
          $('ccColHead').classList.remove('hidden');
          $('ccAccHead').classList.remove('hidden');
        }
      }

      const dates = C.uniqueDates(rows);
      const brands = [...new Set(rows.map(r => r.brand).filter(Boolean))].sort();
      const mps = [...new Set(state.rows.map(r => r.marketplace).filter(Boolean))].sort();
      setOptions($('fBrand'), 'Semua brand', brands);
      setOptions($('fMp'), 'Semua marketplace', mps);
      $('fFrom').value = dates[0] || '';
      $('fTo').value = dates[dates.length - 1] || '';

      $('empty').classList.add('hidden');
      $('app').classList.remove('hidden');
      $('controls').classList.remove('hidden');
      const priceBad = C.priceStats(rows).nulled;
      status(fmt(rows.length) + ' baris dari ' + files.length + ' file.' + (priceBad ? ' ' + fmt(priceBad) + ' baris harga di-null-kan (> Rp 1.000.000).' : ''));
      render();
    } catch (err) {
      status('Gagal: ' + err.message, true);
    }
  });

  /* ---------- render ---------- */
  function render() {
    const f = filters();
    const list = C.filterRows(state.rows, f);
    const s = C.summarize(list);
    $('cQty').textContent = fmt(s.qty);
    $('cQtyS').textContent = fmt(s.n) + ' baris';
    $('cOmzet').textContent = s.omzetRows ? fmtRp(s.omzet) : '-';
    $('cOmzetS').textContent = s.omzetRows ? fmt(s.omzetRows) + ' baris punya harga' : 'semua harga di-null-kan';
    $('cOrders').textContent = fmt(s.orders);
    $('cOrdersS').textContent = '';
    $('cSkus').textContent = fmt(s.skus);
    const bd = C.skuBreakdown(list);
    $('cSkusS').textContent = 'barcode: ' + fmt(bd.std) + ' | kode MP: ' + fmt(bd.mp) + (bd.dup ? ' | DUP: ' + fmt(bd.dup) : '') + (bd.other ? ' | lain: ' + fmt(bd.other) : '');

    const brands = [...new Set(list.map(r => r.brand).filter(Boolean))].sort();
    const mps = [...new Set(list.map(r => r.marketplace).filter(Boolean))].sort();
    $('sub').textContent = fmt(list.length) + ' baris | ' + (f.dateFrom || '-') + ' s/d ' + (f.dateTo || '-') +
      (f.brand ? ' | ' + f.brand : '') + (f.marketplace ? ' | ' + f.marketplace : '');

    renderRingkasan(list);
    renderBrand(list);
    renderMp(list);
    renderTopSku(list);
    renderFsn();
    const dr = state.dataRange;
    $('sub').textContent = (dr ? 'Data ' + dr.months + ' bulan (' + dr.from + ' s/d ' + dr.to + ')'
      : fmt(list.length) + ' baris') +
      (f.brand ? ' | ' + f.brand : '') + (f.marketplace ? ' | ' + f.marketplace : '');
    $('dataPeriodNote').textContent = dr ? (dr.months < 2 ? '⚠ Hanya 1 bulan data. Upload data bulan lain untuk klasifikasi FSN lebih akurat.' :
      dr.months < 3 ? 'ℹ ' + dr.months + ' bulan data. Disarankan 3 bulan untuk FSN yang stabil.' : '') : '';
  }

  /* ---------- grafik ---------- */
  function mkChart(id, type, labels, datasets, opts) {
    if (state.charts[id]) state.charts[id].destroy();
    const tick = css('--mute'), grid = css('--line');
    const def = {
      maintainAspectRatio: false, animation: { duration: 200 },
      plugins: { legend: { display: !!opts.legend, labels: { color: tick } } },
      scales: { x: { ticks: { color: tick }, grid: { display: false } },
                y: { ticks: { color: tick, callback: opts.rp ? v => 'Rp ' + fmt(v) : v => fmt(v) }, grid: { color: grid }, beginAtZero: true } }
    };
    state.charts[id] = new Chart($(id), { type, data: { labels, datasets }, options: def });
  }

  function renderRingkasan(list) {
    const dates = C.uniqueDates(list);
    const trend = C.trendByDay(list, dates);
    mkChart('chDay', 'bar', dates.map(d => d.slice(5)), [{ label: 'Qty', data: trend.map(x => x.qty), backgroundColor: css('--accent') }], {});
    mkChart('chDayOmzet', 'bar', dates.map(d => d.slice(5)), [{ label: 'Omzet', data: trend.map(x => x.omzet), backgroundColor: css('--ok') }], { rp: true });
    const bg = C.groupSummary(list, 'brand', 'qty');
    mkChart('chBrandSum', 'bar', bg.map(x => x.key), [{ label: 'Qty', data: bg.map(x => x.qty), backgroundColor: PALETTE.slice(0, bg.length) }], {});
  }

  function renderBrand(list) {
    const rows = C.groupSummary(list, 'brand', 'qty');
    const tb = $('tbBrand'); tb.textContent = '';
    if (!rows.length) { emptyRow(tb, 6, 'Tidak ada data.'); return; }
    for (const r of rows) {
      const tr = el('tr');
      [r.key, fmt(r.n), fmt(r.qty), r.omzetRows ? fmtRp(r.omzet) : '-', fmt(r.orders), fmt(r.skus)].forEach((v, i) => {
        const td = el('td', i > 0 ? 'n' : '', v); tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    mkChart('chBrandBar', 'bar', rows.map(x => x.key), [
      { label: 'Qty', data: rows.map(x => x.qty), backgroundColor: css('--accent'), yAxisID: 'y' },
      { label: 'Omzet', data: rows.map(x => x.omzet), backgroundColor: css('--ok'), yAxisID: 'y2' }
    ], { legend: true });
    if (state.charts.chBrandBar) {
      try {
        state.charts.chBrandBar.options.scales.y2 = {
          position: 'right', ticks: { color: css('--mute'), callback: v => 'Rp ' + fmt(v) },
          grid: { display: false }, beginAtZero: true };
        state.charts.chBrandBar.update();
      } catch (e) {}
    }
  }

  function renderMp(list) {
    const rows = C.groupSummary(list, 'marketplace', 'qty');
    const tb = $('tbMp'); tb.textContent = '';
    if (!rows.length) { emptyRow(tb, 5, 'Tidak ada data.'); return; }
    for (const r of rows) {
      const tr = el('tr');
      [r.key, fmt(r.n), fmt(r.qty), r.omzetRows ? fmtRp(r.omzet) : '-', fmt(r.orders)].forEach((v, i) => {
        const td = el('td', i > 0 ? 'n' : '', v); tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    const colors = rows.map((_, i) => PALETTE[i % PALETTE.length]);
    mkChart('chMpQty', 'doughnut', rows.map(x => x.key), [{ data: rows.map(x => x.qty), backgroundColor: colors }], { legend: true });
    mkChart('chMpOmzet', 'doughnut', rows.map(x => x.key), [{ data: rows.map(x => x.omzet), backgroundColor: colors }], { legend: true });
  }

  function renderTopSku(list) {
    const f = filters();
    // Filter SKU NFS dari nama produk (tapi kita perlu nama produk per SKU dari VARIANT_FULLNAME)
    const skuMeta = new Map();
    for (const r of list) if (!skuMeta.has(r.sku)) skuMeta.set(r.sku, { sap: r.sapCode, brand: r.brand, name: r.sku });

    // Filter berdasarkan FSN kalau dipilih
    let topList = list;
    if (f.fsnFilter && state.fsn) {
      const fsnMap = state.fsn.result;
      topList = list.filter(r => { const info = fsnMap.get(r.sku); return info && info.fsn === f.fsnFilter; });
    }
    const top = C.topN(topList, 'sku', 100);
    const hasCc = !!state.ccMap && state.ccMap.size > 0;
    const hasFsn = !!state.fsn && state.fsn.result.size > 0;
    $('ccColHead').classList.toggle('hidden', !hasCc);
    $('ccAccHead').classList.toggle('hidden', !hasCc);
    $('fsnColHead').classList.toggle('hidden', !hasFsn);
    $('topSkuHint').textContent = top.length + ' SKU teratas (urut qty)' +
      (f.fsnFilter ? ' | filter: ' + C.fsnLabel(f.fsnFilter) : '') +
      (hasFsn ? ' | FSN dari ' + (state.dataRange ? state.dataRange.months + ' bulan' : 'seluruh data') : '') + '.';
    const tb = $('tbTopSku'); tb.textContent = '';
    if (!top.length) { emptyRow(tb, 8 + (hasCc ? 2 : 0) + (hasFsn ? 1 : 0), 'Tidak ada data.'); return; }
    for (const g of top) {
      const tr = el('tr'); const meta = skuMeta.get(g.key) || {};
      const isStd = C.isStdSku(g.key);
      const jenis = isStd ? 'barcode' : /^DUP/i.test(g.key) ? 'DUP' : /^2030/.test(g.key) ? 'kode MP' : 'lain';
      tr.appendChild(el('td', '', g.key));
      tr.appendChild(el('td', 'pill ' + (isStd ? 'good' : 'mid'), jenis));
      tr.appendChild(el('td', '', meta.sap || '-'));
      tr.appendChild(el('td', '', meta.brand || '-'));
      tr.appendChild(el('td', 'n', fmt(g.qty)));
      tr.appendChild(el('td', 'n', g.omzetRows ? fmtRp(g.omzet) : '-'));
      tr.appendChild(el('td', 'n', fmt(g.orders)));
      if (hasFsn) {
        const info = state.fsn.result.get(g.key);
        const fsn = info ? info.fsn : '?';
        const fsnCls = fsn === 'F' ? 'fsn-fast' : fsn === 'S' ? 'fsn-slow' : 'fsn-non';
        tr.appendChild(el('td', 'pill ' + fsnCls, C.fsnLabel(fsn)));
      }
      if (hasCc) {
        const cc = state.ccMap.get(g.key);
        const tdM = el('td', 'n ' + (cc ? 'cc-yes' : 'cc-no'), cc ? String(cc.ccMonths) + ' bln' : '—');
        const tdA = el('td', 'n ' + (cc && cc.lastAcc !== null ? 'cc-yes' : 'cc-no'),
          cc && cc.lastAcc !== null ? (cc.lastAcc * 100).toFixed(1) + '%' : '—');
        tr.appendChild(tdM); tr.appendChild(tdA);
      }
      tb.appendChild(tr);
    }
  }

  /* ---------- tab ---------- */
  function showTab(name) {
    state.tab = name;
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + name));
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    Object.values(state.charts).forEach(c => { if (c && c.resize) c.resize(); });
  }

  /* ---------- FSN tab ---------- */
  function renderFsn() {
    if (!state.fsn) return;
    const br = C.fsnByBrand(state.rows, state.fsn);
    // Ringkasan total
    let tF = 0, tS = 0, tN = 0;
    for (const b of br) { tF += b.fast; tS += b.slow; tN += b.non; }
    $('fsnTotal').textContent = 'Fast: ' + fmt(tF) + '  Slow: ' + fmt(tS) + '  Non-moving: ' + fmt(tN) +
      '  |  p67 = ' + fmt(state.fsn.p67) + ' qty';
    // Tabel per brand
    const tb = $('tbFsnBrand'); tb.textContent = '';
    for (const b of br) {
      const tr = el('tr');
      tr.appendChild(el('td', '', b.brand));
      tr.appendChild(el('td', 'n', fmt(b.qty)));
      tr.appendChild(el('td', 'n fsn-fast', fmt(b.fast)));
      tr.appendChild(el('td', 'n fsn-slow', fmt(b.slow)));
      tr.appendChild(el('td', 'n fsn-non', fmt(b.non)));
      tr.appendChild(el('td', 'n', fmt(b.total)));
      tr.appendChild(el('td', 'n', b.total ? (b.fast / b.total * 100).toFixed(0) + '%' : '-'));
      tb.appendChild(tr);
    }
    // Grafik batang tumpuk per brand
    const labels = br.slice(0, 15).map(x => x.brand);
    const sub = br.slice(0, 15);
    mkChart('chFsn', 'bar', labels, [
      { label: 'Fast', data: sub.map(x => x.fast), backgroundColor: css('--ok'), stack: 's' },
      { label: 'Slow', data: sub.map(x => x.slow), backgroundColor: css('--warn'), stack: 's' },
      { label: 'Non-moving', data: sub.map(x => x.non), backgroundColor: css('--bad'), stack: 's' }
    ], { legend: true, stacked: true });
  }

  /* ---------- ekspor ---------- */
  $('expCsv').onclick = () => {
    const f = filters(); const list = C.filterRows(state.rows, f);
    const skuMeta = new Map();
    for (const r of list) if (!skuMeta.has(r.sku)) skuMeta.set(r.sku, { sap: r.sapCode, brand: r.brand });
    const top = C.topN(list, 'sku', 1000);
    const hdr = 'SKU,SAP Code,Brand,Qty,Omzet (Rp),Order unik\r\n';
    const cell = v => { const s = String(v); return /[,"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const body = top.map(g => { const m = skuMeta.get(g.key) || {};
      return [g.key, m.sap || '', m.brand || '', g.qty, Math.round(g.omzet), g.orders].map(cell).join(','); }).join('\r\n');
    const blob = new Blob(['\uFEFF' + hdr + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'top-sku-sales.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* ---------- event ---------- */
  ['fBrand', 'fMp', 'fFrom', 'fTo', 'fNonBundle', 'fFsn'].forEach(id => $(id).onchange = render);
  $('fSearch').oninput = render;
  $('reset').onclick = () => {
    $('fBrand').value = ''; $('fMp').value = ''; $('fSearch').value = '';
    $('fNonBundle').checked = true;
    const dates = C.uniqueDates(state.rows);
    $('fFrom').value = dates[0] || ''; $('fTo').value = dates[dates.length - 1] || '';
    render();
  };
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('theme').onclick = () => {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('cc.theme', t); } catch (e) {}
    $('theme').textContent = t === 'dark' ? 'Mode terang' : 'Mode gelap';
    if (state.rows.length) render();
  };
  $('theme').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Mode terang' : 'Mode gelap';
})();

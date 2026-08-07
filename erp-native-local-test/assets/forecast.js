/* ============================================================================
   Demand Forecast — faithful static reproduction of the ERP /forecast module.
   Rolling-forecast editable grid + summary + run controls + modals.
   Real data from window.DATA; edits are local-only (demo, no backend).
   ============================================================================ */
(function () {
  const h = S.h

  // ── status badge map (exact ERP strings) ──
  const STATUS = {
    draft:     { t: 'Draft',                  c: '#6b7280', bg: '#f3f4f6' },
    submitted: { t: 'Submitted',              c: '#7c3aed', bg: '#f5f3ff' },
    approved:  { t: '✓ Approved',                c: '#2563eb', bg: '#eff6ff' },
    published: { t: 'Published (read-only)',   c: '#059669', bg: '#ecfdf5' },
    archived:  { t: 'Archived',               c: '#6b7280', bg: '#f3f4f6' },
  }
  // country tint (summary), matches ERP
  const CBG = { FR: '#eef4ff', PL: '#fef2f2', ES: '#fef8ec', NL: '#fdf0f6', SE: '#eefafd', DE: '#f3f4f6', GB: '#f5f3ff' }

  // ── module state ──
  let st = null
  function init() {
    const runs = (DATA.forecast_run || []).slice().sort((a, b) => (a.period_start < b.period_start ? 1 : -1))
    const countries = (DATA.country || []).filter(c => c.is_active && c.region === 'EU').sort((a, b) => a.sort_order - b.sort_order)
    st = {
      runs,
      countries,
      runId: runs[0] ? runs[0].id : null,
      view: 'edit',
      countryId: countries[0] ? countries[0].id : null,
      hideZero: false,
      cells: {},          // `${sku}|${ka}|${monthIso}` -> qty (local editable)
      cue: {},            // same key -> 'dirty'|'saving'|'saved'
    }
    seedCells()
  }
  function run() { return st.runs.find(r => r.id === st.runId) }
  function months() {
    const r = run(); if (!r) return []
    const n = r.month_count || 4
    const out = []
    for (let i = 0; i < n; i++) out.push(S.addMonths(r.period_start, i))
    return out
  }
  function seedCells() {
    st.cells = {}; st.cue = {}
    for (const c of (DATA.forecast_cell || [])) {
      if (c.run_id !== st.runId) continue
      st.cells[c.sku_id + '|' + c.ka_id + '|' + (c.month || '').slice(0, 10)] = Number(c.qty) || 0
    }
  }
  function skusActive() { return (DATA.sku || []).filter(s => s.is_active).sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code)) }
  function kasFor(countryId) {
    return (DATA.ka || []).filter(k => k.country_id === countryId && k.is_active && k.ka_type !== 'group')
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
  }
  function locked() { const r = run(); return r && (r.status === 'published' || r.status === 'archived') }

  // HQ stock per sku (latest per warehouse, summed by location)
  const hqStock = (function () {
    const seen = {}, cn = {}, ov = {}
    for (const r of (DATA.hq_stock || [])) {
      if (!r.warehouse) continue
      const k = r.sku_id + '|' + r.warehouse
      if (seen[k]) continue; seen[k] = 1               // rows are as_of desc first seen = latest
      const q = Number(r.stock_qty) || 0
      if (r.location === 'overseas') ov[r.sku_id] = (ov[r.sku_id] || 0) + q
      else cn[r.sku_id] = (cn[r.sku_id] || 0) + q
    }
    return { cn, ov }
  })()

  // ── cell get/set with autosave cue ──
  const key = (sku, ka, m) => sku + '|' + ka + '|' + m
  function getQ(sku, ka, m) { return st.cells[key(sku, ka, m)] || 0 }
  let saveTimer = null
  function setQ(sku, ka, m, v, inputEl) {
    const k = key(sku, ka, m)
    st.cells[k] = v; st.cue[k] = 'dirty'
    paintCell(inputEl, 'dirty')
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => flush(k, inputEl), 400)     // AUTOSAVE_MS
    refreshTotals()
  }
  function flush(k, inputEl) {
    if (st.cue[k] !== 'dirty') return
    st.cue[k] = 'saving'; paintCell(inputEl, 'saving')
    setTimeout(() => {                                        // simulate round-trip
      st.cue[k] = 'saved'; paintCell(inputEl, 'saved')
      setTimeout(() => { if (st.cue[k] === 'saved') { st.cue[k] = null; paintCell(inputEl, null) } }, 1500)
    }, 260)
  }
  function paintCell(el, cue) {
    if (!el) return
    el.style.background = cue === 'dirty' ? '#fefce8' : cue === 'saving' ? '#eff6ff' : cue === 'saved' ? '#ecfdf5' : ''
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════
  let ROOT = null
  function render(root) { ROOT = root; if (!st) init(); paint() }
  function paint() {
    S.clear(ROOT)
    ROOT.append(header(), selectorCard())
    if (st.view === 'edit') ROOT.append(kpiRow(), editCard())
    else ROOT.append(summaryKpis(), summaryCard())
    ROOT.append(footerHint())
    syncScopeChip()
  }
  function syncScopeChip() {
    const chip = document.getElementById('scope-chip')
    if (!chip) return
    if (st.view === 'summary') chip.textContent = 'EU · all countries'
    else { const c = country(); chip.textContent = (c ? c.code : 'EU') }
  }
  function country() { return st.countries.find(c => c.id === st.countryId) }

  // ── page header (host template) ──
  function header() {
    const r = run(), sb = STATUS[r ? r.status : 'draft'] || STATUS.draft
    return S.pageHeader({
      overline: (window.ROUTES && ROUTES.forecast.overline) || 'PLANNING & DELIVERY',
      title: '预测管理',
      pill: { text: (r ? r.code : '') + ' · ' + (r ? r.status : ''), color: sb.c },
      actions: [
        h('button.btn', { onclick: () => S.toast('导出模板 · demo') }, '导出模板'),
        h('button.btn', { onclick: () => S.toast('导入预测 · demo') }, '导入预测'),
        h('button.btn.primary', { onclick: openCreateModal }, '发起滚动预测'),
      ],
    })
  }

  // ── run controls (workflow + new cycle) ──
  function runControls() {
    const r = run(); const wrap = h('div', { style: { display: 'flex', gap: '6px' } })
    const btn = (label, cls, fn) => h('button.btn' + (cls ? '.' + cls : '') + '.sm', { onclick: fn }, label)
    const demo = (msg) => () => { S.toast(msg + ' · demo (no backend)') }
    if (r) {
      if (r.status === 'draft') wrap.append(btn('Submit for review', 'primary', demo('Submit for review')))
      else if (r.status === 'submitted') { wrap.append(btn('✓ Approve', 'primary', demo('Approve')), btn('Revert', '', demo('Revert to draft'))) }
      else if (r.status === 'approved') { wrap.append(btn('Publish', 'primary', demo('Publish')), btn('Revert', '', demo('Revert to draft'))) }
      else if (r.status === 'published') wrap.append(h('span.faint', { style: { fontSize: '12px', fontStyle: 'italic', alignSelf: 'center' } }, 'Published & locked'))
      else if (r.status === 'archived') wrap.append(h('span.faint', { style: { fontSize: '12px', fontStyle: 'italic', alignSelf: 'center' } }, 'Archived'))
    }
    wrap.append(btn('New cycle', '', openCreateModal))
    return wrap
  }

  // ── selector card: cycle + country pills ──
  function selectorCard() {
    const sel = h('select', { onchange: e => { st.runId = Number(e.target.value); seedCells(); paint() } },
      st.runs.map(r => h('option', { value: r.id, selected: r.id === st.runId },
        `${r.code} · ${S.ym(r.period_start)} ~ ${S.ym(r.period_end)} · ${r.status}`)))
    const row = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } }, [
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [h('span.field-label', '预测周期'), sel]),
      S.seg(st.view, [{ v: 'summary', label: '概览' }, { v: 'edit', label: '录入' }], v => { st.view = v; paint() }),
    ])
    if (st.view === 'edit') {
      const pills = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        st.countries.map(c => h('button', {
          class: 'btn sm' + (c.id === st.countryId ? ' primary' : ''),
          onclick: () => { st.countryId = c.id; paint() },
        }, `${c.code}`)))
      row.append(h('div', { style: { color: 'var(--c-border-strong)' } }, '│'),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [h('span.field-label', '区域'), pills]))
      row.append(h('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' } }, [
        S.toggle(st.hideZero, '仅看有量 SKU', v => { st.hideZero = v; paint() }), runControls()]))
    }
    return h('div.card', { style: { marginBottom: '14px' } }, h('div.card-body', row))
  }

  // ── KPI row (edit) ──
  function kpiRow() {
    const ms = months(), kas = kasFor(st.countryId), sk = skusActive()
    const monthTot = ms.map(() => 0); let grand = 0
    for (const s of sk) for (const ka of kas) ms.forEach((m, i) => { const q = getQ(s.id, ka.id, m); monthTot[i] += q; grand += q })
    const c = country()
    const tiles = [h('div.kpi', { style: { boxShadow: 'inset 0 0 0 2px var(--c-primary-weak)' } }, [
      h('div.label', `${c ? c.code : ''} ${ms.length}-month total`),
      h('div.value', { id: 'kpi-grand' }, S.fmtNum(grand)),
      h('div.sub', `${kas.length} KAs × ${sk.length} SKUs`)])]
    ms.forEach((m, i) => tiles.push(h('div.kpi', [h('div.label', S.ym(m)), h('div.value', { id: 'kpi-m' + i }, S.fmtNum(monthTot[i])), h('div.sub', S.monthLabel(S.ym(m)))])))
    return h('div.kpis', { style: { marginBottom: '14px' } }, tiles)
  }
  function refreshTotals() {
    // live-update KPI + footer totals without full repaint
    const ms = months(), kas = kasFor(st.countryId), sk = skusActive()
    const monthTot = ms.map(() => 0); let grand = 0
    for (const s of sk) for (const ka of kas) ms.forEach((m, i) => { const q = getQ(s.id, ka.id, m); monthTot[i] += q; grand += q })
    const g = document.getElementById('kpi-grand'); if (g) g.textContent = S.fmtNum(grand)
    ms.forEach((m, i) => { const e = document.getElementById('kpi-m' + i); if (e) e.textContent = S.fmtNum(monthTot[i]) })
  }

  // ── edit grid ──
  function editCard() {
    const ms = months(), kas = kasFor(st.countryId)
    const groups = S.groupBySeries(skusActive())
    const nCols = kas.length * ms.length

    // header (2 rows: KA names / month labels)
    const h1 = h('tr', [
      h('th', { style: stickyL(0, 90) }, 'SKU'),
      h('th', { style: stickyL(90, 210) }, 'Product'),
    ])
    kas.forEach(ka => h1.append(h('th', { colspan: ms.length, style: { textAlign: 'center', borderLeft: '1px solid var(--c-border)' } }, ka.name)))
    h1.append(h('th', { colspan: ms.length, class: 'num', style: { background: '#eef4ff' } }, 'Sub-total'))
    h1.append(h('th', { class: 'num', style: { background: '#fff7ed' } }, 'Total'),
      h('th', { colspan: 2, style: { textAlign: 'center', background: '#fff7ed' } }, 'Stock-HQ'))

    const h2 = h('tr', [h('th', { style: stickyL(0, 90) }, ''), h('th', { style: stickyL(90, 210) }, '')])
    kas.forEach(ka => ms.forEach(m => h2.append(h('th.num', { style: { borderLeft: '1px solid var(--c-border)' } }, S.monthLabel(S.ym(m))))))
    ms.forEach(m => h2.append(h('th.num', { style: { background: '#eef4ff' } }, S.monthLabel(S.ym(m)))))
    h2.append(h('th.num', { style: { background: '#fff7ed' } }, ''), h('th.num', { style: { background: '#fff7ed' } }, 'CN'), h('th.num', { style: { background: '#fff7ed' } }, 'Oversea'))

    const tbody = h('tbody')
    const colMonthTot = ms.map(() => 0)  // per subtotal-month grand
    let anyRow = false
    groups.forEach(g => {
      const bandCells = 2 + nCols + ms.length + 3
      const groupRows = []
      g.items.forEach(s => {
        let rowTot = 0; const subByMonth = ms.map(() => 0)
        const tds = [h('td', { style: Object.assign({ fontFamily: 'var(--font-mono)', fontWeight: 700 }, stickyL(0, 90)) }, s.code),
          h('td', { style: Object.assign({ color: 'var(--c-text-dim)' }, stickyL(90, 210)) }, s.name || '–')]
        kas.forEach(ka => ms.forEach((m, mi) => {
          const q = getQ(s.id, ka.id, m); rowTot += q; subByMonth[mi] += q
          const inp = h('input', {
            type: 'text', inputmode: 'numeric', value: q > 0 ? q : '',
            disabled: locked() ? true : null,
            style: { width: '48px', textAlign: 'right', border: '1px solid transparent', borderRadius: '4px', padding: '3px 4px', fontVariantNumeric: 'tabular-nums', color: q > 0 ? 'var(--c-text)' : 'var(--c-text-faint)', fontWeight: q > 0 ? 600 : 400 },
            oninput: e => { const v = parseInt((e.target.value || '').replace(/[^\d]/g, ''), 10) || 0; e.target.value = v > 0 ? v : ''; setQ(s.id, ka.id, m, v, e.target) },
            onblur: e => flush(key(s.id, ka.id, m), e.target),
            onkeydown: e => { if (e.key === 'Enter') e.target.blur() },
          })
          tds.push(h('td.num', { style: { borderLeft: mi === 0 ? '1px solid var(--c-border)' : '', padding: '2px 4px' } }, inp))
        }))
        subByMonth.forEach((v, i) => { colMonthTot[i] += v; tds.push(h('td.num', { style: { background: '#f5f9ff', color: v ? '' : 'var(--c-text-faint)' } }, v ? S.fmtNum(v) : '–')) })
        tds.push(h('td.num.strong', { style: { background: '#fffaf2' } }, rowTot ? S.fmtNum(rowTot) : '–'))
        tds.push(h('td.num', { style: { background: '#fffaf2', color: hqStock.cn[s.id] ? '' : 'var(--c-text-faint)' } }, hqStock.cn[s.id] ? S.fmtNum(hqStock.cn[s.id]) : '–'))
        tds.push(h('td.num', { style: { background: '#fffaf2', color: hqStock.ov[s.id] ? '' : 'var(--c-text-faint)' } }, hqStock.ov[s.id] ? S.fmtNum(hqStock.ov[s.id]) : '–'))
        if (st.hideZero && rowTot === 0) return
        anyRow = true
        groupRows.push(h('tr', tds))
      })
      if (!groupRows.length) return
      tbody.append(h('tr', h('td', { colspan: bandCells, style: { background: 'var(--c-surface-3)', fontWeight: 700, fontSize: '11px', position: 'sticky', left: 0 } }, `${g.series} · ${groupRows.length}`)))
      groupRows.forEach(r => tbody.append(r))
    })

    const table = h('table.tbl', { style: { minWidth: (300 + nCols * 54 + ms.length * 54 + 200) + 'px' } }, [h('thead', [h1, h2]), tbody])
    const scroll = h('div', { style: { overflow: 'auto', maxHeight: '640px' } }, anyRow ? table : h('div.empty', [h('div.ic', ''), 'No SKUs to show']))

    // toolbar strip
    const toolbar = h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)', fontSize: '12px' } }, [
      h('span', [h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#9b8cce', marginRight: '4px', verticalAlign: 'middle' } }), 'PO ',
        h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#52b788', margin: '0 4px 0 8px', verticalAlign: 'middle' } }), 'SO ', h('span.faint', 'ref = past 3 months avg')]),
      h('span.grow'),
      h('button.btn.sm', { onclick: openManageChannels }, `Manage channels (${kasFor(st.countryId).length})`),
      locked() ? h('span.chip', 'Read-only') : h('span.chip', { style: { color: 'var(--c-success)' } }, '✓ Auto-save on'),
    ])
    return h('div.card', { style: { marginBottom: '14px', overflow: 'hidden' } }, [toolbar, h('div.card-body.flush', scroll)])
  }
  function stickyL(left, w) { return { position: 'sticky', left: left + 'px', background: 'var(--c-surface)', zIndex: 2, minWidth: w + 'px', maxWidth: w + 'px', boxShadow: left ? '2px 0 0 var(--c-border)' : '' } }

  // ── summary view ──
  function summaryKpis() {
    const ms = months(); const cs = st.countries
    // sum cells across all countries for the run
    const byC = {}; let grand = 0; const monthTot = ms.map(() => 0)
    for (const c of (DATA.forecast_cell || [])) {
      if (c.run_id !== st.runId) continue
      const ka = (DATA.ka || []).find(k => k.id === c.ka_id); if (!ka) continue
      const q = Number(c.qty) || 0; byC[ka.country_id] = (byC[ka.country_id] || 0) + q; grand += q
      const mi = ms.indexOf((c.month || '').slice(0, 10)); if (mi >= 0) monthTot[mi] += q
    }
    const tiles = [h('div.kpi', { style: { boxShadow: 'inset 0 0 0 2px #ede9fe' } }, [h('div.label', `EU ${ms.length}-month total`), h('div.value', S.fmtNum(grand)), h('div.sub', `${cs.length} countries × ${ms.length} months`)])]
    cs.forEach(c => tiles.push(h('div.kpi', [h('div.label', `${c.code} total`), h('div.value', S.fmtNum(byC[c.id] || 0)), h('div.sub', grand ? Math.round((byC[c.id] || 0) / grand * 100) + '% of EU' : '')])))
    st._byC = byC
    return h('div.kpis', { style: { marginBottom: '14px' } }, tiles)
  }
  function summaryCard() {
    const ms = months(), cs = st.countries
    // cell index: sku -> country -> monthIso -> qty
    const idx = {}
    for (const c of (DATA.forecast_cell || [])) {
      if (c.run_id !== st.runId) continue
      const ka = (DATA.ka || []).find(k => k.id === c.ka_id); if (!ka) continue
      const m = (c.month || '').slice(0, 10)
      idx[c.sku_id] = idx[c.sku_id] || {}; idx[c.sku_id][ka.country_id] = idx[c.sku_id][ka.country_id] || {}
      idx[c.sku_id][ka.country_id][m] = (idx[c.sku_id][ka.country_id][m] || 0) + (Number(c.qty) || 0)
    }
    const h1 = h('tr', [h('th', { style: stickyL(0, 90) }, 'SKU'), h('th', { style: stickyL(90, 210) }, 'Product')])
    cs.forEach(c => h1.append(h('th', { colspan: ms.length, style: { textAlign: 'center', background: CBG[c.code] || '' } }, `${c.code}`)))
    h1.append(h('th', { colspan: ms.length, style: { textAlign: 'center', background: '#ede9fe' } }, 'EU TTL'), h('th.num', { style: { background: '#fff7ed' } }, 'Total'))
    const h2 = h('tr', [h('th', { style: stickyL(0, 90) }, ''), h('th', { style: stickyL(90, 210) }, '')])
    cs.forEach(c => ms.forEach(m => h2.append(h('th.num', { style: { background: CBG[c.code] || '' } }, S.monthLabel(S.ym(m))))))
    ms.forEach(m => h2.append(h('th.num', { style: { background: '#ede9fe' } }, S.monthLabel(S.ym(m)))))
    h2.append(h('th.num', { style: { background: '#fff7ed' } }, ''))

    const tbody = h('tbody')
    S.groupBySeries(skusActive()).forEach(g => {
      const rows = []
      g.items.forEach(s => {
        const si = idx[s.id] || {}; let rowTot = 0
        const euM = ms.map(() => 0)
        const tds = [h('td', { style: Object.assign({ fontFamily: 'var(--font-mono)', fontWeight: 700 }, stickyL(0, 90)) }, s.code),
          h('td', { style: Object.assign({ color: 'var(--c-text-dim)' }, stickyL(90, 210)) }, s.name || '–')]
        cs.forEach(c => ms.forEach((m, mi) => { const q = (si[c.id] || {})[m] || 0; euM[mi] += q; rowTot += q; tds.push(h('td.num', { style: { background: CBG[c.code] ? CBG[c.code] + '66' : '', color: q ? '' : 'var(--c-text-faint)' } }, q ? S.fmtNum(q) : '–')) }))
        euM.forEach(v => tds.push(h('td.num', { style: { background: '#f5f3ff', fontWeight: 600, color: v ? '' : 'var(--c-text-faint)' } }, v ? S.fmtNum(v) : '–')))
        tds.push(h('td.num.strong', { style: { background: '#fffaf2' } }, rowTot ? S.fmtNum(rowTot) : '–'))
        if (st.hideZero && rowTot === 0) return
        rows.push(h('tr', tds))
      })
      if (!rows.length) return
      const span = 2 + cs.length * ms.length + ms.length + 1
      tbody.append(h('tr', h('td', { colspan: span, style: { background: 'var(--c-surface-3)', fontWeight: 700, fontSize: '11px', position: 'sticky', left: 0 } }, `${g.series} · ${rows.length}`)))
      rows.forEach(r => tbody.append(r))
    })
    const table = h('table.tbl', { style: { minWidth: (300 + cs.length * ms.length * 52 + ms.length * 52 + 90) + 'px' } }, [h('thead', [h1, h2]), tbody])
    const bar = h('div', { style: { display: 'flex', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--c-border)' } }, [
      h('span.grow'),
      h('button.btn.sm', { onclick: () => S.toast('Export FCST Excel · demo') }, 'Export FCST Excel'),
      h('button.btn.sm', { onclick: () => S.toast('Export Stock CSV · demo') }, 'Export Stock CSV'),
    ])
    return h('div.card', { style: { overflow: 'hidden' } }, [bar, h('div.card-body.flush', h('div', { style: { overflow: 'auto', maxHeight: '640px' } }, table))])
  }

  function footerHint() {
    return h('div.faint', { style: { fontSize: '11px', marginTop: '12px', lineHeight: 1.6 } },
      st.view === 'edit'
        ? 'Edits auto-save as you type (saving · saved) — pause, blur or Enter to save. PO/SO reference columns and Stock-FD come from PSI/shipment feeds (omitted in this static demo). Writes are RLS-protected in the live app.'
        : 'Source: forecast_eu_summary (KA aggregated to country) · Monthly EU TTL = sum of countries · Total = sum of the window months.')
  }

  // ── Create-cycle modal ──
  function openCreateModal() {
    const o = S.overlay('modal', { title: 'New forecast cycle' })
    let mode = 'rollover'
    const monthInput = h('input', { type: 'month', value: '2026-07' })
    const info = h('div.faint', { style: { fontSize: '12px', margin: '6px 0 14px' } })
    const modeCard = (v, title, desc) => h('label', {
      style: { display: 'block', border: '1px solid var(--c-border-strong)', borderRadius: '9px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' },
      onclick: () => { mode = v; [...o.body.querySelectorAll('input[name=mode]')].forEach(r => r.checked = r.value === v) },
    }, [h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
      h('input', { type: 'radio', name: 'mode', value: v, checked: v === 'rollover' }), h('strong', title)]),
      h('div.faint', { style: { fontSize: '12px', marginTop: '4px', paddingLeft: '22px' } }, desc)])
    o.body.append(
      h('div.faint', { style: { fontSize: '12px', marginBottom: '10px' } }, 'Create a new rolling forecast window for the EU region. Default 3 months; start aligned to the 1st; code auto-generated.'),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [h('span.field-label', 'Start month'), monthInput]),
      info,
      modeCard('rollover', 'Roll over previous cycle · recommended', "Carries the previous cycle's same calendar month values in as grey reference (AugAug). The newly-added leading month starts empty."),
      modeCard('clone', 'Clone & shift months', "Copies every cell and shifts it forward by the month offset (source's Sep new Oct). Use only to duplicate a whole plan."),
    )
    const upd = () => { const v = monthInput.value || '2026-07'; info.textContent = `Window: ${v} ~ ${S.ym(S.addMonths(v + '-01', 2))} (3 months · rolling) · Code: EU-FCST-${v}` }
    monthInput.addEventListener('input', upd); upd()
    o.foot.append(h('button.btn', { onclick: o.close }, 'Cancel'),
      h('button.btn.primary', { onclick: () => { o.close(); S.toast((mode === 'clone' ? 'Clone & create' : 'Roll over & create') + ' · demo (no backend)') } }, mode === 'clone' ? 'Clone & create' : 'Roll over & create'))
  }

  // ── Manage-channels modal ──
  function openManageChannels() {
    const c = country()
    const o = S.overlay('modal', { title: `Manage Channels — ${c ? c.name_en : ''}` })
    const list = h('div')
    const draw = () => {
      S.clear(list)
      const kas = kasFor(st.countryId)
      list.append(h('div.field-label', { style: { marginBottom: '6px' } }, `Active channels (${kas.length})`))
      kas.forEach(k => {
        const icon = k.ka_type === 'distributor' ? '' : k.ka_type === 'group' ? '' : ''
        const par = k.parent_ka_id ? (DATA.ka.find(x => x.id === k.parent_ka_id) || {}).name : null
        list.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 4px', borderBottom: '1px solid var(--c-border)' } }, [
          h('span', icon), h('span', { style: { fontWeight: 600 } }, k.name), par ? h('span.faint', { style: { fontSize: '11px' } }, 'via ' + par) : null,
          h('span.grow'),
          h('button.btn.sm', { onclick: () => S.toast('Edit ' + k.name + ' · demo') }, 'Edit'),
          h('button.btn.sm', { onclick: () => S.toast('Deactivate ' + k.name + ' · demo') }, 'Deactivate'),
        ]))
      })
    }
    draw()
    o.body.append(h('button.btn.sm', { style: { marginBottom: '10px' }, onclick: () => S.toast('Add new channel · demo') }, '+ Add new channel'), list,
      h('div.faint', { style: { fontSize: '11px', marginTop: '12px' } }, 'Deactivated channels keep history but hide from forecast/PSI/shipment views'))
    o.foot.append(h('button.btn.primary', { onclick: o.close }, 'Done'))
  }

  window.Modules = window.Modules || {}
  window.Modules.forecast = { render }
})()

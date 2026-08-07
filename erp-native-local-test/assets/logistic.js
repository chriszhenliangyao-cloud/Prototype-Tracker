/* ============================================================================
   Logistic & Stock — faithful static reproduction of the ERP /admin/sku page.
   Stock/Specs view + Pricing (RRP / FD) view with inline-editable cells + SKU
   drawer + carton export. Real snapshot data; edits local-only (demo).
   ============================================================================ */
(function () {
  const h = S.h
  const PLN_EUR = 0.233, CNY_EUR = 0.13
  const CODE_W = 150, NAME_W = 210
  const WH_CODE = { '生产部': 'HQ', '雨鹤德国仓': 'DE1', '新欧达德国仓': 'DE2', '新欧达法国仓': 'FR1' }
  const WH_FULL = { '生产部': 'HQ — Central Warehouse, China (domestic) · 生产部', '雨鹤德国仓': 'DE1 — 3PL, Germany · 雨鹤德国仓', '新欧达德国仓': 'DE2 — 3PL, Germany · 新欧达德国仓', '新欧达法国仓': 'FR1 — 3PL, France · 新欧达法国仓' }
  const whCode = n => WH_CODE[n] || n.replace(/国?仓$/, '')

  const cById = {}; (DATA.country || []).forEach(c => cById[c.id] = c)
  const countries = () => (DATA.country || []).filter(c => c.is_active && c.region === 'EU').sort((a, b) => a.sort_order - b.sort_order)

  // stock
  const stock = (function () {
    const by = {}, seen = {}, whset = {}; let asOf = ''
    ;(DATA.hq_stock || []).forEach(r => {
      if (!r.warehouse) return
      whset[r.warehouse] = r.location
      if ((r.as_of_date || '') > asOf) asOf = r.as_of_date || ''
      const k = r.sku_id + '|' + r.warehouse; if (seen[k]) return; seen[k] = 1
      by[r.sku_id] = by[r.sku_id] || {}; by[r.sku_id][r.warehouse] = Number(r.stock_qty) || 0
    })
    const warehouses = Object.keys(whset).map(n => ({ name: n, location: whset[n] }))
      .sort((a, b) => (a.location === 'domestic' ? -1 : 1) - (b.location === 'domestic' ? -1 : 1) || a.name.localeCompare(b.name, 'zh'))
    return { by, warehouses, asOf: (asOf || '').slice(0, 10) }
  })()

  // pricing maps
  const rrpBySku = {}; (DATA.sku_country_pricing || []).forEach(r => { if (r.rrp == null) return; (rrpBySku[r.sku_id] = rrpBySku[r.sku_id] || {})[r.country_id] = Number(r.rrp) })
  const fdBySku = {}, fdColMap = {}
  ;(DATA.sku_fd_price || []).forEach(r => {
    if (r.fd_buying_price == null) return
    ;(fdBySku[r.sku_id] = fdBySku[r.sku_id] || {})[r.country_id + '|' + r.fd] = Number(r.fd_buying_price)
    const k = r.country_id + '|' + r.fd; if (!fdColMap[k]) fdColMap[k] = { country_id: r.country_id, fd: r.fd, currency: r.currency }
  })
  const cSort = id => (cById[id] || {}).sort_order || 99
  const fdCols = Object.values(fdColMap).sort((a, b) => cSort(a.country_id) - cSort(b.country_id) || a.fd.localeCompare(b.fd))

  // local editable overrides (demo)
  const edits = { ean: {}, box: {}, rrp: {}, fd: {} }

  // state
  let st = null
  function init() { st = { viewMode: 'stock', priceMetric: 'rrp', search: '', status: 'all', cat: 'all', showCarton: false } }
  const allSkus = () => (DATA.sku || []).slice().sort((a, b) => (b.is_active - a.is_active) || (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
  function filtered() {
    const q = st.search.trim().toLowerCase()
    return allSkus().filter(s => {
      if (st.status === 'active' && !s.is_active) return false
      if (st.status === 'inactive' && s.is_active) return false
      if (st.cat !== 'all' && (s.category || '') !== st.cat) return false
      if (q && !((s.code + ' ' + (s.name || '') + ' ' + (s.name_zh || '') + ' ' + (s.series || '') + ' ' + (s.family || '')).toLowerCase().includes(q))) return false
      return true
    })
  }

  // ═══ RENDER ═══
  let ROOT
  function render(root) { ROOT = root; if (!st) init(); paint() }
  function paint() {
    S.clear(ROOT)
    ROOT.append(headerBar(), toolbar(), viewTabs())
    ROOT.append(st.viewMode === 'stock' ? stockCard() : pricingCard())
    const chip = document.getElementById('scope-chip'); if (chip) chip.textContent = 'Master data'
  }
  function headerBar() {
    const act = allSkus().filter(s => s.is_active).length, ina = allSkus().length - act
    return S.pageHeader({
      overline: (window.ROUTES && ROUTES.logistic.overline) || 'MASTER DATA · LOGISTICS',
      title: '发货汇总',
      pill: { text: `${act} 在售 · ${ina} 停用`, color: 'var(--c-success)' },
      actions: [
        h('button.btn', { onclick: openExport }, '导出台账'),
        h('button.btn.primary', { onclick: () => openDrawer('create') }, '+ 新增 SKU'),
      ],
    })
  }
  function toolbar() {
    const cats = [...new Set(allSkus().map(s => s.category).filter(Boolean))].sort()
    const search = h('input', { type: 'text', value: st.search, placeholder: ' Search code / name / series / family…', style: { width: '260px' }, oninput: e => { st.search = e.target.value; paint(); const i = document.querySelector('.lg-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length) } } })
    search.classList.add('lg-search')
    const total = allSkus().length, act = allSkus().filter(s => s.is_active).length
    const statusSel = h('select', { onchange: e => { st.status = e.target.value; paint() } }, [
      h('option', { value: 'all', selected: st.status === 'all' }, `All status (${total})`),
      h('option', { value: 'active', selected: st.status === 'active' }, `✓ Active (${act})`),
      h('option', { value: 'inactive', selected: st.status === 'inactive' }, `⊘ Inactive (${total - act})`)])
    const catSel = h('select', { onchange: e => { st.cat = e.target.value; paint() } },
      [h('option', { value: 'all', selected: st.cat === 'all' }, 'All categories')].concat(cats.map(c => h('option', { value: c, selected: st.cat === c }, c))))
    return h('div.card', { style: { marginBottom: '12px' } }, h('div.card-body', h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
      search, statusSel, catSel, h('span.faint', { style: { fontSize: '12px' } }, `Showing ${filtered().length} of ${total}`),
      h('span.grow', { style: { flex: 1 } }), h('button.btn.primary.sm', { onclick: () => openDrawer('create') }, '+ Add SKU')])))
  }
  function viewTabs() {
    return h('div', { style: { marginBottom: '12px' } }, S.seg(st.viewMode, [{ v: 'stock', label: 'Inventory / Specs' }, { v: 'pricing', label: 'Pricing (RRP / FD)' }], v => { st.viewMode = v; paint() }))
  }

  // ── Stock view ──
  function stockCard() {
    const whs = stock.warehouses
    const bar = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--c-border)', fontSize: '12px' } }, [
      h('span.faint', 'Inventory · HQ = 生产部 (domestic) · DE1 / DE2 / FR1 = overseas 3PL · Total = all warehouses · read-only'),
      h('span.grow', { style: { flex: 1 } }),
      h('button.btn.sm', { onclick: () => { st.showCarton = !st.showCarton; paint() } }, (st.showCarton ? '▾ Hide' : '▸ Show') + ' carton specs'),
      h('button.btn.sm', { onclick: openExport }, 'Export carton specs'),
      stock.asOf ? h('span.chip.b', 'as of ' + stock.asOf) : null,
    ])
    // header
    const th = (label, extra) => h('th', extra || {}, label)
    const headCells = [h('th', { style: sticky(0, CODE_W) }, 'Code'), h('th', { style: sticky(CODE_W, NAME_W, true) }, 'Name'), th('EAN')]
    if (st.showCarton) headCells.push(th('Qty/Carton', { class: 'num' }), th('Carton kg', { class: 'num', title: '每箱重量 (gross kg)' }), th('Carton size', { title: '每箱尺寸 L*W*H' }), th('Carton qty/Pallet', { class: 'num', title: '每托箱数' }), th('Pallet weight', { class: 'num', title: '每托重量' }), th('Retail package size', { title: '产品彩盒尺寸' }))
    whs.forEach(w => headCells.push(h('th.num', { title: WH_FULL[w.name] || w.name }, whCode(w.name))))
    headCells.push(h('th.num', { title: 'Total on hand — all warehouses' }, 'Total'), th('Sort', { class: 'num' }), th('Edit', { class: 'num' }))

    const tbody = h('tbody')
    let any = false
    S.groupBySeries(filtered()).forEach(g => {
      const span = headCells.length
      const rows = g.items
      if (!rows.length) return
      tbody.append(h('tr', h('td', { colspan: span, style: { background: 'var(--c-surface-3)', fontWeight: 700, fontSize: '11px', position: 'sticky', left: 0 } }, `${g.series} · ${rows.length}`)))
      rows.forEach(s => {
        any = true
        const tds = [
          h('td', { style: Object.assign({ fontFamily: 'var(--font-mono)', fontWeight: 700 }, sticky(0, CODE_W)) }, s.code),
          h('td', { style: Object.assign({ opacity: s.is_active ? 1 : .55 }, sticky(CODE_W, NAME_W, true)) }, [s.name || '–', s.name_zh ? h('span.faint', { style: { fontSize: '11px' } }, ' · ' + s.name_zh) : null]),
          editableCell(edits.ean[s.id] != null ? edits.ean[s.id] : s.ean, v => { edits.ean[s.id] = v; S.toast(`${s.code} EAN updated`) }, 'ean'),
        ]
        if (st.showCarton) tds.push(
          editableCell(edits.box[s.id] != null ? edits.box[s.id] : s.box_qty, v => { edits.box[s.id] = v; S.toast(`${s.code} Qty/Carton updated`) }, 'num'),
          h('td.num', dash(s.carton_gross_kg)), h('td', dash(s.carton_dim_cm)), h('td.num', dash(s.cartons_per_pallet)), h('td.num', dash(s.pallet_gross_kg)), h('td', dash(s.colorbox_dim_cm)))
        let tot = 0
        whs.forEach(w => { const q = (stock.by[s.id] || {})[w.name] || 0; tot += q; tds.push(h('td.num', { style: { background: '#f0f6ff', color: q ? '' : 'var(--c-text-faint)' } }, q ? q.toLocaleString() : '–')) })
        tds.push(h('td.num.strong', { style: { background: '#eef2f7' } }, tot ? tot.toLocaleString() : '–'))
        tds.push(h('td.num.faint', s.sort_order), h('td.num', h('button.btn.sm', { onclick: () => openDrawer('edit', s) }, 'Edit')))
        tbody.append(h('tr', { style: { opacity: s.is_active ? 1 : .55 } }, tds))
      })
    })
    const table = h('table.tbl', { style: { minWidth: (CODE_W + NAME_W + 120 + whs.length * 84 + 90 + 150 + (st.showCarton ? 560 : 0)) + 'px' } }, [h('thead', h('tr', headCells)), tbody])
    return h('div.card', { style: { overflow: 'hidden' } }, [bar, h('div.card-body.flush', h('div', { style: { overflow: 'auto', maxHeight: '700px' } }, any ? table : h('div.empty', 'No SKUs match the filters')))])
  }

  // ── Pricing view ──
  function pricingCard() {
    const bar = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--c-border)', fontSize: '12px' } }, [
      h('span.faint', 'Per-country pricing · 各国本币（PLN 旁注 €≈）· 点数字即可行内改价'),
      h('span.grow', { style: { flex: 1 } }),
      S.seg(st.priceMetric, [{ v: 'rrp', label: 'RRP' }, { v: 'fd', label: 'FD buying price' }], v => { st.priceMetric = v; paint() }),
    ])
    let cols
    if (st.priceMetric === 'rrp') cols = countries().map(c => ({ key: c.id, label: `${c.code}`, cur: c.currency, country: c }))
    else cols = fdCols.map(f => ({ key: f.country_id + '|' + f.fd, label: `${(cById[f.country_id] || {}).code} · ${f.fd}`, cur: f.currency || (cById[f.country_id] || {}).currency, country: cById[f.country_id], fd: f.fd }))

    const head = h('tr', [h('th', { style: sticky(0, CODE_W) }, 'Code'), h('th', { style: sticky(CODE_W, NAME_W, true) }, 'Name')]
      .concat(cols.map(c => h('th.num', [c.label, h('div.faint', { style: { fontSize: '10px', fontWeight: 400 } }, c.cur)]))))
    const tbody = h('tbody')
    let any = false
    if (!cols.length) return h('div.card', h('div.card-body', h('div.empty', '无定价数据（你可能没有可见的国家）。')))
    filtered().forEach(s => {
      any = true
      const tds = [h('td', { style: Object.assign({ fontFamily: 'var(--font-mono)', fontWeight: 700 }, sticky(0, CODE_W)) }, s.code),
        h('td', { style: Object.assign({ color: 'var(--c-text-dim)', opacity: s.is_active ? 1 : .55 }, sticky(CODE_W, NAME_W, true)) }, s.name || '–')]
      cols.forEach(c => {
        let v
        if (st.priceMetric === 'rrp') v = edits.rrp[s.id + '|' + c.key] != null ? edits.rrp[s.id + '|' + c.key] : (rrpBySku[s.id] || {})[c.key]
        else v = edits.fd[s.id + '|' + c.key] != null ? edits.fd[s.id + '|' + c.key] : (fdBySku[s.id] || {})[c.key]
        tds.push(priceCell(v, c.cur, nv => {
          if (st.priceMetric === 'rrp') { edits.rrp[s.id + '|' + c.key] = nv; S.toast(`${s.code} · ${c.country.code} RRP ${nv == null ? 'cleared' : 'updated'}`) }
          else { edits.fd[s.id + '|' + c.key] = nv; S.toast(`${s.code} · ${c.country.code}·${c.fd} ${nv == null ? 'cleared' : 'updated'}`) }
        }))
      })
      tbody.append(h('tr', { style: { opacity: s.is_active ? 1 : .55 } }, tds))
    })
    const table = h('table.tbl', { style: { minWidth: (CODE_W + NAME_W + cols.length * 130) + 'px' } }, [h('thead', head), tbody])
    return h('div.card', { style: { overflow: 'hidden' } }, [bar, h('div.card-body.flush', h('div', { style: { overflow: 'auto', maxHeight: '700px' } }, any ? table : h('div.empty', 'No SKUs match the filters')))])
  }

  // ── inline editable cells ──
  function editableCell(val, onSave, kind) {
    const td = h('td', { class: kind === 'num' ? 'num' : '' })
    const show = () => { S.clear(td); td.append(h('span.cell-edit', { title: 'Click to edit', onclick: edit }, val != null && val !== '' ? String(val) : h('span.faint', '—'))) }
    const edit = () => {
      S.clear(td)
      const inp = h('input', { type: 'text', value: val != null ? val : '', style: { width: kind === 'num' ? '70px' : '120px', textAlign: kind === 'num' ? 'right' : 'left' } })
      const commit = () => { let nv = inp.value.replace(/[^\d]/g, ''); nv = nv === '' ? null : (kind === 'num' ? parseInt(nv, 10) : nv); val = nv; onSave(nv); show() }
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') show() })
      inp.addEventListener('blur', commit)
      td.append(inp); inp.focus(); inp.select()
    }
    show(); return td
  }
  function priceCell(val, cur, onSave) {
    const td = h('td.num')
    const disp = () => {
      S.clear(td)
      if (val == null) { td.append(h('span.cell-edit', { onclick: edit }, h('span.faint', '—'))); return }
      const main = Number(val).toFixed(2)
      const kids = [main]
      if (cur === 'PLN') kids.push(h('span.faint', { style: { fontSize: '10px', marginLeft: '4px' } }, `(€${(val * PLN_EUR).toFixed(2)})`))
      td.append(h('span.cell-edit', { title: 'Click to edit', onclick: edit }, kids))
    }
    const edit = () => {
      S.clear(td)
      const inp = h('input', { type: 'text', value: val != null ? val : '', style: { width: '84px', textAlign: 'right' } })
      const commit = () => { let raw = inp.value.replace(/[^\d.]/g, ''); const nv = raw === '' ? null : Number(raw); if (nv != null && (!isFinite(nv) || nv < 0)) { S.toast('价格应为非负数'); return disp() } val = nv; onSave(nv); disp() }
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') disp() })
      inp.addEventListener('blur', commit); td.append(inp); inp.focus(); inp.select()
    }
    disp(); return td
  }
  const dash = v => v == null || v === '' ? h('span.faint', '—') : String(v)
  function sticky(left, w, border) { return { position: 'sticky', left: left + 'px', background: 'var(--c-surface)', zIndex: 2, minWidth: w + 'px', maxWidth: w + 'px', boxShadow: border ? '2px 0 0 var(--c-border)' : (left ? '2px 0 0 var(--c-border)' : '') } }

  // ── SKU drawer (create / edit) ──
  function openDrawer(mode, sku) {
    const o = S.overlay('drawer', { title: mode === 'create' ? '+ Add new SKU' : 'Edit · ' + (sku ? sku.code : '') })
    const sec = (title) => h('div', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--c-text-faint)', fontWeight: 700, borderBottom: '1px solid var(--c-border)', paddingBottom: '5px', margin: '16px 0 10px' } }, title)
    const field = (label, node) => h('div', { style: { marginBottom: '10px' } }, [h('div.field-label', { style: { display: 'block', marginBottom: '3px' } }, label), node])
    const inp = (val, ph, w) => h('input', { type: 'text', value: val != null ? val : '', placeholder: ph || '', style: { width: w || '100%' } })
    const g2 = (a, b) => h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, [a, b])
    const S0 = sku || {}
    o.body.append(
      sec('Basic'),
      field('SKU code *', inp(S0.code, 'e.g. P75-P1-B')), field('Name (EN) *', inp(S0.name, 'e.g. Stellar 20k 45W')), field('Name (中文)', inp(S0.name_zh)),
      g2(field('Category', inp(S0.category, 'Power Bank / Charger')), field('Color', inp(S0.color))),
      g2(field('Series', inp(S0.series, 'MagPro / Charger')), field('Family', inp(S0.family))),
      sec('Physical'),
      field('EAN', inp(S0.ean, '13-digit barcode')),
      g2(field('Box qty（每箱数量）', inp(S0.box_qty)), field('Unit weight (g)', inp(S0.unit_weight_g))),
      sec('Carton & Pallet（装箱 / 托盘）'),
      g2(field('Carton size', inp(S0.carton_dim_cm, '47*42*35cm')), field('Carton weight kg', inp(S0.carton_gross_kg, '15.2'))),
      g2(field('Cartons / pallet', inp(S0.cartons_per_pallet)), field('Pallet weight kg', inp(S0.pallet_gross_kg))),
      field('Color box size', inp(S0.colorbox_dim_cm, '16*8*3cm')),
      sec('Pricing (admin internal)'),
      field('BOM ¥ (RMB · 成本)', inp(S0.bom_cost_rmb)),
      pricingBlock(sku),
      sec('Lifecycle'),
      g2(field('Lifecycle', h('select', { style: { width: '100%' } }, ['active', 'preview', 'preorder', 'eol', 'discontinued'].map(l => h('option', { selected: S0.lifecycle === l }, l)))), field('Launch date', h('input', { type: 'date', value: S0.launch_date || '', style: { width: '100%' } }))),
      field('Sort order', inp(S0.sort_order != null ? S0.sort_order : 999)),
      sec('Notes'), field('Notes', h('textarea', { rows: 3, style: { width: '100%', fontFamily: 'inherit' } }, S0.notes || '')),
    )
    o.foot.append(h('button.btn', { onclick: o.close }, 'Cancel'), h('button.btn.primary', { onclick: () => { o.close(); S.toast(mode === 'create' ? 'SKU created · demo' : (S0.code + ' updated · demo')) } }, mode === 'create' ? 'Create SKU' : 'Save changes'))
  }
  function pricingBlock(sku) {
    const wrap = h('div', { style: { marginTop: '6px' } })
    wrap.append(h('div', { style: { fontSize: '12px', fontWeight: 600, marginBottom: '4px' } }, 'RRP · 各国建议零售价'),
      h('div.faint', { style: { fontSize: '11px', marginBottom: '6px' } }, '同一产品各国定价不同，按各国本币填写。'))
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } })
    countries().forEach(c => {
      const v = sku ? (rrpBySku[sku.id] || {})[c.id] : null
      grid.append(h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' } }, [
        h('span', { style: { width: '52px' } }, `${c.code}`),
        h('input', { type: 'text', value: v != null ? v : '', placeholder: '—', style: { flex: 1 } }), h('span.faint', { style: { fontSize: '10px' } }, c.currency)]))
    })
    wrap.append(grid)
    if (fdCols.length) {
      wrap.append(h('div', { style: { fontSize: '12px', fontWeight: 600, margin: '12px 0 4px' } }, 'FD buying price · 对分销商出货价'))
      const g2 = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } })
      fdCols.forEach(f => {
        const c = cById[f.country_id] || {}; const v = sku ? (fdBySku[sku.id] || {})[f.country_id + '|' + f.fd] : null
        g2.append(h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' } }, [
          h('span', { style: { width: '90px' } }, `${c.code} · ${f.fd}`),
          h('input', { type: 'text', value: v != null ? v : '', placeholder: '—', style: { flex: 1 } }), h('span.faint', { style: { fontSize: '10px' } }, f.currency || c.currency)]))
      })
      wrap.append(g2)
    }
    return wrap
  }

  // ── Carton export modal ──
  function openExport() {
    const o = S.overlay('modal', { title: 'Export carton specs' })
    const sel = {}
    const list = filtered()
    const hasSpecs = s => [s.box_qty, s.carton_gross_kg, s.carton_dim_cm, s.cartons_per_pallet, s.pallet_gross_kg, s.colorbox_dim_cm].some(x => x != null)
    const count = () => Object.values(sel).filter(Boolean).length
    const foot = h('button.btn.primary', { onclick: () => { o.close(); S.toast(`Exported ${count()} SKUs · demo`) } }, 'Export')
    const rows = list.map(s => {
      const cb = h('input', { type: 'checkbox', onchange: e => { sel[s.id] = e.target.checked; foot.textContent = `Export (${count()})` } })
      return h('tr', { style: { opacity: s.is_active ? 1 : .55 } }, [h('td', cb), h('td.mono', s.code), h('td', s.name || '–'), h('td', hasSpecs(s) ? h('span', { style: { color: 'var(--c-success)' } }, '✓') : h('span.faint', '—'))])
    })
    o.body.append(h('div.faint', { style: { fontSize: '12px', marginBottom: '10px' } }, 'Exports carton specs only (not inventory).'),
      h('div.tbl-wrap', { style: { maxHeight: '360px', overflow: 'auto' } }, h('table.tbl', [h('thead', h('tr', [h('th', ''), h('th', 'Code'), h('th', 'Name'), h('th', 'Specs')])), h('tbody', rows)])))
    o.foot.append(h('button.btn', { onclick: o.close }, 'Cancel'), foot)
  }

  window.Modules = window.Modules || {}
  window.Modules.logistic = { render }
})()

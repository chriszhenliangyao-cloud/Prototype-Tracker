/* ============================================================================
   Performance — faithful static reproduction of the ERP /performance module.
   FCST Scorecard + Review (Sales Review + Profitability P&L stack).
   Aggregations computed client-side from the real snapshot (approximated
   allocation for freight/CN; static FX). Read-only demo.
   ============================================================================ */
(function () {
  const h = S.h
  const FX = { EUR: 1, PLN: 0.233, CNY: 0.13 }          // static demo rates (ERP fallbacks)
  const CAT_ORDER = ['Power bank', 'Charger', 'Cable', 'Wireless charger']
  const CN_TYPES = ['Rebate', 'Price Protection', 'Margin Protection', 'Quality', 'Delivery Fee', 'Other']
  const COLOR_WORDS = ['Black', 'White', 'Orange', 'Blue', 'Titan', 'DesertTitan', 'Red', 'LB', 'B', 'W', 'T', 'BU', 'D', 'O', 'R']
  const SCORE_BANDS = [
    { r: '90% – 110%', s: 100, lvl: 'Excellent', c: '#047857' },
    { r: '70–89% / 111–130%', s: 80, lvl: 'Good', c: '#1d4ed8' },
    { r: '50–69% / 131–150%', s: 60, lvl: 'Substandard', c: '#b45309' },
    { r: '<50% / >150%', s: 40, lvl: 'Unacceptable', c: '#dc2626' },
  ]

  // ── dims ──
  const skus = () => (DATA.sku || []).filter(s => s.is_active).sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
  const countries = () => (DATA.country || []).filter(c => c.is_active && c.region === 'EU').sort((a, b) => a.sort_order - b.sort_order)
  const skuById = {}; (DATA.sku || []).forEach(s => skuById[s.id] = s)
  const kaById = {}; (DATA.ka || []).forEach(k => kaById[k.id] = k)
  const cById = {}; (DATA.country || []).forEach(c => cById[c.id] = c)
  const cByCode = {}; (DATA.country || []).forEach(c => cByCode[c.code] = c)

  function stripColor(code) {
    if (!code) return code
    const p = code.split('-'); const last = p[p.length - 1]
    if (p.length > 1 && COLOR_WORDS.some(w => w.toLowerCase() === last.toLowerCase())) return p.slice(0, -1).join('-')
    return code
  }
  const eur = (turn, cur) => (turn == null ? 0 : Number(turn) * (FX[cur] || 1))
  function cnType(product) {
    const s = (product || '').toLowerCase()
    if (/rebate/.test(s)) return 'Rebate'
    if (/price prot/.test(s)) return 'Price Protection'
    if (/margin/.test(s)) return 'Margin Protection'
    if (/quality|defect|faulty/.test(s)) return 'Quality'
    if (/deliver|freight|logisti|ship/.test(s)) return 'Delivery Fee'
    return 'Other'
  }

  // ── state ──
  let st = null
  function init() {
    st = {
      year: 2026, q: 2, countryCode: countries()[0] ? countries()[0].code : 'FR',
      tab: 'kpi', reviewSub: 'sales', hideZero: true,
      pnlView: 'overview', logView: 'sku', metric: 'value', bpView: 'sku',
      openQ: null, sortModel: 'value', sortPo: 'value', expandRows: {},
    }
  }
  const monthsIso = () => [0, 1, 2].map(i => `${st.year}-${String(st.q * 3 - 2 + i).padStart(2, '0')}-01`)
  const monthsInt = () => [0, 1, 2].map(i => st.q * 3 - 2 + i)
  const monthsYm = () => monthsIso().map(m => m.slice(0, 7))

  // ═══ AGGREGATIONS ═══════════════════════════════════════════════════════
  // customer PO rows in the selected quarter (+ optional country)
  function posInQuarter(scopeCode) {
    const ym = monthsYm()
    return (DATA.channel_po || []).filter(p => {
      const m = (p.po_date || '').slice(0, 7)
      if (!ym.includes(m)) return false
      if (scopeCode && scopeCode !== 'ALL' && (cById[p.country_id] || {}).code !== scopeCode) return false
      return true
    })
  }
  function posInYear(scopeCode) {
    return (DATA.channel_po || []).filter(p => {
      if ((p.po_date || '').slice(0, 4) !== String(st.year)) return false
      if (scopeCode && scopeCode !== 'ALL' && (cById[p.country_id] || {}).code !== scopeCode) return false
      return true
    })
  }
  const freightByPo = (function () { const m = {}; (DATA.po_freight || []).forEach(f => { m[String(f.po_number).replace(/\.0$/, '')] = eur(f.delivery_fee, f.currency) }); return m })()
  const normPo = s => String(s == null ? '' : s).replace(/\.0$/, '')

  // Scorecard forecast/achieve for one country
  function scorecard(code) {
    const C = cByCode[code]; if (!C) return null
    const iso = monthsIso()
    const fc = {}, ach = {}
    // forecast: avg across runs of sum-across-channels
    const byRun = {}
    for (const cell of (DATA.forecast_cell || [])) {
      const ka = kaById[cell.ka_id]; if (!ka || ka.country_id !== C.id) continue
      const mi = iso.indexOf((cell.month || '').slice(0, 10)); if (mi < 0) continue
      byRun[cell.sku_id] = byRun[cell.sku_id] || {}
      byRun[cell.sku_id][mi] = byRun[cell.sku_id][mi] || {}
      byRun[cell.sku_id][mi][cell.run_id] = (byRun[cell.sku_id][mi][cell.run_id] || 0) + (Number(cell.qty) || 0)
    }
    for (const sku in byRun) { fc[sku] = [0, 0, 0]; for (let mi = 0; mi < 3; mi++) { const runs = Object.values(byRun[sku][mi] || {}); fc[sku][mi] = runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0 } }
    for (const p of posInQuarter(code)) { const mi = monthsYm().indexOf((p.po_date || '').slice(0, 7)); if (mi < 0) continue; ach[p.sku_id] = ach[p.sku_id] || [0, 0, 0]; ach[p.sku_id][mi] += Number(p.qty_ordered) || 0 }
    return { fc, ach }
  }
  function scoreFor(fc, ach) {
    if (fc <= 0 && ach <= 0) return null
    if (fc <= 0) return 40
    const a = Math.round(ach / fc * 100)
    if (a >= 90 && a <= 110) return 100
    if ((a >= 70 && a < 90) || (a > 110 && a <= 130)) return 80
    if ((a >= 50 && a < 70) || (a > 130 && a <= 150)) return 60
    return 40
  }
  const scoreColor = s => s == null ? '#d1d5db' : s >= 100 ? '#059669' : s >= 80 ? '#2563eb' : s >= 60 ? '#d97706' : '#dc2626'

  // P&L per country (Overview)
  function pnlRows() {
    const rows = []
    countries().forEach(C => {
      const pos = posInQuarter(C.code)
      if (!pos.length) return
      let rev = 0, units = 0, bom = 0; const poSet = {}; let freight = 0, freightPos = 0
      pos.forEach(p => { rev += eur(p.turnover, p.currency); units += Number(p.qty_ordered) || 0; const rmb = (skuById[p.sku_id] || {}).bom_cost_rmb || 0; bom += (Number(p.qty_ordered) || 0) * rmb * FX.CNY; poSet[normPo(p.po_number)] = 1 })
      Object.keys(poSet).forEach(po => { if (freightByPo[po] != null) { freight += freightByPo[po]; freightPos++ } })
      let cn = 0; (DATA.credit_note || []).forEach(c => { if (c.country_id === C.id && monthsYm().includes((c.cn_date || '').slice(0, 7))) cn += eur(c.amount, c.currency) })
      rows.push({ code: C.code, flag: C.flag_emoji, name: C.name_en, pos: Object.keys(poSet).length, units, revenue: rev, freight, freightPos, bom, cn })
    })
    return rows.sort((a, b) => b.revenue - a.revenue)
  }

  // by-SKU / by-PO P&L for scope
  function pnlByModel(scope, byPo) {
    const pos = posInQuarter(scope)
    const g = {}
    let totalVal = 0
    pos.forEach(p => {
      const val = eur(p.turnover, p.currency); totalVal += val
      const gk = byPo ? normPo(p.po_number) : stripColor((skuById[p.sku_id] || {}).code || ('#' + p.sku_id))
      const name = byPo ? ('PO ' + normPo(p.po_number)) : ((skuById[p.sku_id] || {}).name || gk)
      const r = g[gk] = g[gk] || { model: gk, name, qty: 0, value: 0, bom: 0, log: 0, logPos: 0, _pos: {} }
      r.qty += Number(p.qty_ordered) || 0; r.value += val
      r.bom += (Number(p.qty_ordered) || 0) * ((skuById[p.sku_id] || {}).bom_cost_rmb || 0) * FX.CNY
      r._pos[normPo(p.po_number)] = 1
    })
    // freight: per PO, allocate to group by value share (by-SKU) or exact (by-PO)
    Object.values(g).forEach(r => {
      Object.keys(r._pos).forEach(po => { if (freightByPo[po] != null) { r.logPos++ } })
    })
    if (byPo) { Object.values(g).forEach(r => { const po = r.model; r.log = freightByPo[po] || 0; r.logPos = freightByPo[po] != null ? 1 : 0 }) }
    else {
      // allocate each po's freight across its lines by value share
      const lineByPo = {}
      pos.forEach(p => { const po = normPo(p.po_number); (lineByPo[po] = lineByPo[po] || []).push(p) })
      Object.keys(lineByPo).forEach(po => {
        const f = freightByPo[po]; if (f == null) return
        const tot = lineByPo[po].reduce((a, p) => a + eur(p.turnover, p.currency), 0) || 1
        lineByPo[po].forEach(p => { const gk = stripColor((skuById[p.sku_id] || {}).code || ('#' + p.sku_id)); if (g[gk]) g[gk].log += f * eur(p.turnover, p.currency) / tot })
      })
    }
    // CN allocation by value share
    let cnTotal = 0; (DATA.credit_note || []).forEach(c => { if ((scope === 'ALL' || (cById[c.country_id] || {}).code === scope) && monthsYm().includes((c.cn_date || '').slice(0, 7))) cnTotal += eur(c.amount, c.currency) })
    const rows = Object.values(g)
    let assigned = 0
    rows.forEach(r => { r.cn = totalVal > 0 ? cnTotal * r.value / totalVal : 0; assigned += r.cn })
    const cnOthers = Math.max(0, cnTotal - assigned)
    const sortKey = byPo ? st.sortPo : st.sortModel
    const val = r => sortKey === 'qty' ? r.qty : sortKey === 'log' ? r.log : sortKey === 'gp' ? (r.value - r.log - r.bom) : sortKey === 'np' ? (r.value - r.log - r.bom - r.cn) : r.value
    rows.sort((a, b) => val(b) - val(a))
    return { rows, cnOthers }
  }

  // by category
  function pnlByCat(scope) {
    const pos = posInQuarter(scope)
    const g = {}
    pos.forEach(p => {
      let cat = (skuById[p.sku_id] || {}).category || '(uncat)'
      if (!CAT_ORDER.includes(cat)) cat = cat === '(uncat)' ? '(uncat)' : 'Other'
      const r = g[cat] = g[cat] || { category: cat, qty: 0, revenue: 0, bom: 0, log: 0, logPos: 0, cn: 0, target: 0 }
      r.qty += Number(p.qty_ordered) || 0; r.revenue += eur(p.turnover, p.currency); r.bom += (Number(p.qty_ordered) || 0) * ((skuById[p.sku_id] || {}).bom_cost_rmb || 0) * FX.CNY
    })
    // BP targets by category
    ;(DATA.business_plan || []).forEach(b => {
      if (b.year !== st.year) return
      if (Math.ceil(b.month / 3) !== st.q) return
      if (scope !== 'ALL' && (cById[b.country_id] || {}).code !== scope) return
      let cat = b.category || '(uncat)'; if (!CAT_ORDER.includes(cat) && cat !== '(uncat)') cat = 'Other'
      const r = g[cat] = g[cat] || { category: cat, qty: 0, revenue: 0, bom: 0, log: 0, logPos: 0, cn: 0, target: 0 }
      r.target += Number(b.si_value) || 0
    })
    const order = c => { const i = CAT_ORDER.indexOf(c.category); return i < 0 ? 99 : i }
    return Object.values(g).filter(r => r.revenue || r.target || r.cn).sort((a, b) => order(a) - order(b))
  }

  // annual achievement per scope
  function annual(scope) {
    const plan = [0, 0, 0, 0], planQty = [0, 0, 0, 0], actual = [0, 0, 0, 0], actualQty = [0, 0, 0, 0]
    ;(DATA.business_plan || []).forEach(b => { if (b.year !== st.year) return; if (scope !== 'ALL' && (cById[b.country_id] || {}).code !== scope) return; plan[Math.ceil(b.month / 3) - 1] += Number(b.si_value) || 0 })
    ;(DATA.business_plan_detail || []).forEach(b => { if (b.year !== st.year) return; if (scope !== 'ALL' && (cById[b.country_id] || {}).code !== scope) return; planQty[Math.ceil(b.month / 3) - 1] += Number(b.si_qty) || 0 })
    posInYear(scope).forEach(p => { const q = Math.ceil((parseInt((p.po_date || '').slice(5, 7), 10)) / 3) - 1; if (q < 0 || q > 3) return; actual[q] += eur(p.turnover, p.currency); actualQty[q] += Number(p.qty_ordered) || 0 })
    return { plan, planQty, actual, actualQty }
  }

  // BP details (SKU by quarter + month) for scope
  function bpDetail(scope) {
    // targets by base model
    const tgt = {}   // model -> {q:[{si,val}], m:[...]}
    ;(DATA.business_plan_detail || []).forEach(b => {
      if (b.year !== st.year) return; if (scope !== 'ALL' && (cById[b.country_id] || {}).code !== scope) return
      const key = stripColor(b.model_code)
      const t = tgt[key] = tgt[key] || { q: [0, 0, 0, 0], qv: [0, 0, 0, 0], m: Array(12).fill(0), mv: Array(12).fill(0) }
      const qi = Math.ceil(b.month / 3) - 1
      t.q[qi] += Number(b.si_qty) || 0; t.qv[qi] += Number(b.si_value) || 0
      t.m[b.month - 1] += Number(b.si_qty) || 0; t.mv[b.month - 1] += Number(b.si_value) || 0
    })
    // actuals by base model (+ colour children)
    const act = {}, childAgg = {}
    posInYear(scope).forEach(p => {
      const sku = skuById[p.sku_id] || {}; const base = stripColor(sku.code || ('#' + p.sku_id))
      const mo = parseInt((p.po_date || '').slice(5, 7), 10); const qi = Math.ceil(mo / 3) - 1
      const a = act[base] = act[base] || { q: [0, 0, 0, 0], qv: [0, 0, 0, 0], m: Array(12).fill(0), mv: Array(12).fill(0), name: base }
      a.q[qi] += Number(p.qty_ordered) || 0; a.qv[qi] += eur(p.turnover, p.currency)
      a.m[mo - 1] += Number(p.qty_ordered) || 0; a.mv[mo - 1] += eur(p.turnover, p.currency)
      const ck = base + '||' + (sku.code || p.sku_id)
      const c = (childAgg[base] = childAgg[base] || {}); const cc = c[ck] = c[ck] || { key: sku.code || ('#' + p.sku_id), name: sku.name || sku.code, siAct: 0, valAct: 0 }
      cc.siAct += Number(p.qty_ordered) || 0; cc.valAct += eur(p.turnover, p.currency)
    })
    const models = {}; Object.keys(tgt).forEach(k => models[k] = 1); Object.keys(act).forEach(k => models[k] = 1)
    const nameOf = k => { const s = (DATA.sku || []).find(x => stripColor(x.code) === k); return s ? stripColor(s.name || s.code) : k }
    const rowFor = (k, qi) => {
      const t = tgt[k], a = act[k]
      const siTgt = t ? t.q[qi] : 0, valTgt = t ? t.qv[qi] : 0
      const siAct = a ? a.q[qi] : null, valAct = a ? a.qv[qi] : null
      const kids = childAgg[k] ? Object.values(childAgg[k]) : []
      const children = kids.length >= 2 ? kids : null
      return { key: k, name: nameOf(k), siTgt, valTgt, siAct, valAct, children }
    }
    const skuByQuarter = [0, 1, 2, 3].map(qi => Object.keys(models).map(k => rowFor(k, qi)).filter(r => r.siTgt > 0 || (r.siAct != null && r.siAct > 0)).sort((a, b) => (b.valAct || 0) - (a.valAct || 0)))
    const month = Array.from({ length: 12 }, (_, mi) => {
      let siTgt = 0, valTgt = 0, siAct = 0, valAct = 0, any = false
      Object.keys(models).forEach(k => { const t = tgt[k], a = act[k]; if (t) { siTgt += t.m[mi]; valTgt += t.mv[mi] } if (a) { siAct += a.m[mi]; valAct += a.mv[mi]; if (a.m[mi]) any = true } })
      return { key: S.MONTHS[mi], name: S.MONTHS[mi], siTgt, valTgt, siAct: any || siTgt ? siAct : null, valAct: any || siTgt ? valAct : null, children: null }
    })
    return { skuByQuarter, month }
  }

  // CN by SKU by type
  function cnBySku(scope) {
    const g = {}; const others = {}; let othersTotal = 0
    ;(DATA.credit_note || []).forEach(c => {
      if (scope !== 'ALL' && (cById[c.country_id] || {}).code !== scope) return
      if (!monthsYm().includes((c.cn_date || '').slice(0, 7))) return
      const amt = eur(c.amount, c.currency); const type = cnType(c.product)
      const bm = (c.base_model || '').trim()
      if (!bm || bm === '/') { others[type] = (others[type] || 0) + amt; othersTotal += amt; return }
      const r = g[bm] = g[bm] || { model: bm, name: bm, by: {}, total: 0, lines: [] }
      r.by[type] = (r.by[type] || 0) + amt; r.total += amt
      r.lines.push({ desc: c.product || '', type, amt })
    })
    return { rows: Object.values(g).sort((a, b) => b.total - a.total), others, othersTotal }
  }

  // ═══ RENDER ═════════════════════════════════════════════════════════════
  let ROOT
  function render(root) { ROOT = root; if (!st) init(); if (st.openQ == null) st.openQ = st.q; paint() }
  function paint() {
    S.clear(ROOT)
    ROOT.append(headerBar(), selectorBar(), mainTabs())
    if (st.tab === 'kpi') ROOT.append(kpiTab())
    else if (st.tab === 'sales') ROOT.append(salesReview())
    else ROOT.append(profitabilityStack())
    const chip = document.getElementById('scope-chip'); if (chip) chip.textContent = st.countryCode === 'ALL' ? 'All countries' : (st.countryCode)
  }
  const scopeLabel = () => st.countryCode === 'ALL' ? 'All countries' : (st.countryCode)

  function headerBar() {
    return S.pageHeader({
      overline: (window.ROUTES && ROUTES.performance.overline) || 'BUSINESS PERFORMANCE',
      title: '经营分析',
      pill: { text: `${st.year} Q${st.q} · ${scopeLabel()}`, color: 'var(--c-primary)' },
      actions: [
        h('button.btn', { onclick: () => S.toast('导出报表 · demo') }, '导出报表'),
        h('button.btn.primary', { onclick: () => S.toast('刷新数据 · demo') }, '刷新数据'),
      ],
    })
  }

  function selectorBar() {
    const years = [2026, 2025, 2024]
    const ySel = h('select', { onchange: e => { st.year = Number(e.target.value); paint() } }, years.map(y => h('option', { value: y, selected: y === st.year }, y)))
    const qSel = h('select', { onchange: e => { st.q = Number(e.target.value); st.openQ = st.q; paint() } }, [1, 2, 3, 4].map(q => h('option', { value: q, selected: q === st.q }, 'Q' + q)))
    const pills = [h('button', { class: 'btn sm' + (st.countryCode === 'ALL' ? ' primary' : ''), onclick: () => { st.countryCode = 'ALL'; paint() } }, 'All')]
      .concat(countries().map(c => h('button', { class: 'btn sm' + (st.countryCode === c.code ? ' primary' : ''), onclick: () => { st.countryCode = c.code; paint() } }, `${c.code}`)))
    const chk = h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginLeft: 'auto' } }, [
      h('input', { type: 'checkbox', checked: st.hideZero, onchange: e => { st.hideZero = e.target.checked; paint() } }), 'Hide empty SKUs'])
    return h('div.card', { style: { marginBottom: '12px' } }, h('div.card-body', h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }, [
      h('span.field-label', 'Quarter'), ySel, qSel, h('span', { style: { color: 'var(--c-border-strong)' } }, '│'),
      h('span.field-label', 'Country'), h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, pills), chk,
    ])))
  }

  function mainTabs() {
    const tab = (v, label) => h('button', { class: st.tab === v ? 'active' : '', onclick: () => { st.tab = v; paint() } }, label)
    return h('div.tabline', { style: { marginBottom: '14px' } }, [
      tab('kpi', 'FCST Scorecard'), tab('sales', 'Sales Review'), tab('pnl', 'Profitability (P&L)'),
    ])
  }

  // ── KPI / Scorecard tab ──
  function kpiTab() {
    if (st.countryCode === 'ALL') return h('div.card', h('div.card-body', h('div.empty', [h('div.ic', ''), 'The FCST Scorecard is shown per country. Pick a country above (All is for the Profitability view).'])))
    const wrap = h('div')
    wrap.append(scoringStandard(), scorecardCard())
    return wrap
  }
  function scoringStandard() {
    const d = h('details', { style: { marginBottom: '14px' } })
    d.append(h('summary', { style: { cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: '10px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '9px' } }, 'Scoring standard — how the Score is calculated (click to expand)'))
    const rows = SCORE_BANDS.map(b => h('tr', [h('td', b.r), h('td.num.strong', { style: { color: b.c } }, b.s), h('td', { style: { color: b.c, fontWeight: 600 } }, b.lvl)]))
    d.append(h('div.card', { style: { marginTop: '8px' } }, h('div.card-body.flush', h('table.tbl', [h('thead', h('tr', [h('th', 'Accuracy Range'), h('th.num', 'Score'), h('th', 'Performance Level')])), h('tbody', rows)]))))
    return d
  }
  function scorecardCard() {
    const C = cByCode[st.countryCode]; const sc = scorecard(st.countryCode); const iso = monthsIso()
    let rows = skus().map(s => {
      const fc = (sc.fc[s.id] || [0, 0, 0]), ach = (sc.ach[s.id] || [0, 0, 0])
      const fcT = fc.reduce((a, b) => a + b, 0), achT = ach.reduce((a, b) => a + b, 0)
      return { s, fc, ach, fcT, achT }
    })
    if (st.hideZero) rows = rows.filter(r => r.fcT > 0 || r.achT > 0)
    const ttl = { fc: [0, 0, 0], ach: [0, 0, 0], fcT: 0, achT: 0 }
    rows.forEach(r => { for (let i = 0; i < 3; i++) { ttl.fc[i] += r.fc[i]; ttl.ach[i] += r.ach[i] } ttl.fcT += r.fcT; ttl.achT += r.achT })

    const numOr = v => v > 0 ? S.fmtNum(v) : h('span.faint', '0')
    const DIV = '2px solid var(--c-border-strong)'                 // 三大分组(FCST/Achieve/Achieve%)之间的分界线
    const bl = i => i === 0 ? { style: { borderLeft: DIV } } : {}  // 每组第一列加左边界
    const grp = (label, cls) => h('th', { colspan: 4, style: { textAlign: 'center', background: cls, borderLeft: DIV } }, label)
    const h1 = h('tr', [h('th', { style: sticky(0, 90) }, 'Model'), h('th', { style: sticky(90, 180) }, 'Product Name'),
      grp('FCST', '#eef2f7'), grp('Achieve', '#ecfdf5'), grp('Achieve %', '#fff7ed')])
    const mh = () => [...iso.map((m, i) => h('th.num', bl(i), S.monthLabel(S.ym(m)))), h('th.num.strong', 'Q' + st.q)]
    const h2 = h('tr', [h('th', { style: sticky(0, 90) }, ''), h('th', { style: sticky(90, 180) }, ''), ...mh(), ...mh(), ...mh()])

    const body = rows.map(r => h('tr', [
      h('td', { style: Object.assign({ fontFamily: 'var(--font-mono)', fontWeight: 700 }, sticky(0, 90)) }, r.s.code),
      h('td', { style: Object.assign({ color: 'var(--c-text-dim)' }, sticky(90, 180)) }, r.s.name || '–'),
      ...r.fc.map((v, i) => h('td.num', bl(i), numOr(Math.round(v)))), h('td.num.strong', numOr(Math.round(r.fcT))),
      ...r.ach.map((v, i) => h('td.num', bl(i), numOr(v))), h('td.num.strong', numOr(r.achT)),
      ...r.fc.map((v, i) => h('td.num', bl(i), S.pctText(S.pct(v, r.ach[i])))), h('td.num.strong', S.pctText(S.pct(r.fcT, r.achT))),
    ]))
    const tfoot = h('tfoot', [
      h('tr', { style: { fontWeight: 700, background: 'var(--c-surface-3)' } }, [
        h('td', { style: sticky(0, 90) }, 'TTL'), h('td', { style: sticky(90, 180) }, 'All SKUs'),
        ...ttl.fc.map((v, i) => h('td.num', bl(i), S.fmtNum(v))), h('td.num', S.fmtNum(ttl.fcT)),
        ...ttl.ach.map((v, i) => h('td.num', bl(i), S.fmtNum(v))), h('td.num', S.fmtNum(ttl.achT)),
        ...ttl.fc.map((v, i) => h('td.num', bl(i), S.pctText(S.pct(v, ttl.ach[i])))), h('td.num', S.pctText(S.pct(ttl.fcT, ttl.achT))),
      ]),
      h('tr', { style: { fontWeight: 700 } }, [
        h('td', { style: sticky(0, 90) }, 'Score'), h('td', { style: sticky(90, 180) }, 'by attainment'),
        h('td', { colspan: 8, style: { borderLeft: DIV } }, ''),
        ...ttl.fc.map((v, i) => { const s = scoreFor(v, ttl.ach[i]); return h('td.num', { style: Object.assign({ color: scoreColor(s) }, i === 0 ? { borderLeft: DIV } : {}) }, s == null ? '—' : s) }),
        (function () { const s = scoreFor(ttl.fcT, ttl.achT); return h('td.num', { style: { color: scoreColor(s), borderLeft: '2px solid var(--c-border)' } }, s == null ? '—' : s) })(),
      ]),
    ])
    const table = h('table.tbl', { style: { minWidth: '1100px' } }, [h('thead', [h1, h2]), h('tbody', rows.length ? body : [h('tr', h('td', { colspan: 14, style: { textAlign: 'center', padding: '30px', color: 'var(--c-text-faint)' } }, `No forecast / shipment data for ${st.countryCode} in ${st.year} Q${st.q}`))]), rows.length ? tfoot : null])
    const card = h('div.card', h('div.card-body.flush', h('div', { style: { overflow: 'auto', maxHeight: '620px' } }, table)))
    return card
  }
  function lineChart(ttl, iso, C) {
    const W = 720, H = 260, pad = 34
    const labels = iso.map(m => S.monthLabel(S.ym(m)))
    const max = Math.max(1, ...ttl.fc, ...ttl.ach)
    const x = i => pad + i * (W - pad * 2) / 2
    const y = v => H - pad - v / max * (H - pad * 2)
    const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ')
    const dots = (arr, col) => arr.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${col}"/>`).join('')
    const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px">
      ${[0, 0.5, 1].map(t => `<line x1="${pad}" y1="${y(max * t)}" x2="${W - pad}" y2="${y(max * t)}" stroke="#eee"/><text x="4" y="${y(max * t) + 4}" font-size="10" fill="#9ca3af">${S.fmtNum(max * t)}</text>`).join('')}
      <path d="${path(ttl.fc)}" fill="none" stroke="#64748b" stroke-width="2"/>${dots(ttl.fc, '#64748b')}
      <path d="${path(ttl.ach)}" fill="none" stroke="#059669" stroke-width="2"/>${dots(ttl.ach, '#059669')}
      ${labels.map((l, i) => `<text x="${x(i)}" y="${H - 10}" font-size="11" fill="#6b7280" text-anchor="middle">${l}</text>`).join('')}
    </svg>`
    return h('div.card', { style: { marginTop: '16px' } }, [
      h('div.card-head', [h('h2', `Monthly TTL — Forecast vs Achieve · ${C.flag_emoji} ${C.code} · ${st.year} Q${st.q}`)]),
      h('div.card-body', [h('div', { html: svg }), h('div', { style: { display: 'flex', gap: '16px', fontSize: '12px', marginTop: '8px' } }, [
        h('span', [h('span', { style: { color: '#64748b' } }, '━ '), 'Forecast']), h('span', [h('span', { style: { color: '#059669' } }, '━ '), 'Achieve'])])]),
    ])
  }

  // ── Review tab ──
  function reviewTab() {
    const wrap = h('div')
    wrap.append(S.seg(st.reviewSub, [{ v: 'sales', label: 'Sales Review' }, { v: 'pnl', label: 'Profitability (P&L)' }], v => { st.reviewSub = v; paint() }))
    wrap.append(h('div', { style: { height: '14px' } }))
    if (st.reviewSub === 'sales') wrap.append(salesReview())
    else wrap.append(profitabilityStack())
    return wrap
  }

  function salesReview() {
    if (st.countryCode === 'ALL') return h('div.card', h('div.card-body', h('div.empty', [h('div.ic', ''), 'Sales Review is filled per country. Pick a country above.'])))
    const C = cByCode[st.countryCode]
    const chans = (DATA.ka || []).filter(k => k.country_id === C.id && k.is_active && k.ka_type !== 'group')
    let flipped = false
    const card = h('div.card')
    const draw = () => {
      S.clear(card)
      card.append(h('div.card-head', { style: { background: flipped ? '#eef2ff' : '#ecfdf5' } }, [
        h('h2', flipped ? `Action Plan — ${C.code} ${st.year} Q${st.q + 1 > 4 ? 1 : st.q + 1}` : `Quarter Progress — ${C.code} ${st.year} Q${st.q}`),
        h('span.grow', { style: { flex: 1 } }),
        h('button.btn.sm', { onclick: () => { flipped = !flipped; draw() } }, flipped ? 'Flip to Progress' : 'Flip to Action Plan'),
        h('button.btn.sm.primary', { onclick: () => S.toast('Saved · demo') }, 'Save'),
      ]))
      const fields = flipped ? ['Next move', 'Target', 'Supports / resources needed'] : ['Progress', 'Win', 'Loss', 'Competition thinking']
      const body = h('div.card-body')
      chans.slice(0, 6).forEach(ch => {
        body.append(h('div', { style: { marginBottom: '12px' } }, [
          h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, ch.name),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + fields.length + ',1fr)', gap: '8px' } },
            fields.map(f => h('textarea', { rows: 2, placeholder: f, style: { width: '100%', resize: 'vertical', border: '1px solid var(--c-border-strong)', borderRadius: '6px', padding: '6px', fontFamily: 'inherit', fontSize: '12px' } }))),
        ]))
      })
      card.append(body)
    }
    draw()
    return card
  }

  function profitabilityStack() {
    const scope = st.countryCode
    return h('div', [annualCard(scope), bpCard(scope), profitCard(scope), logisticCard(scope), cnCard(scope)])
  }

  // Annual achievement
  function annualCard(scope) {
    const a = annual(scope)
    const isVal = st.metric === 'value'
    const plan = isVal ? a.plan : a.planQty, actual = isVal ? a.actual : a.actualQty
    const fmt = v => isVal ? S.eur(v) : (S.fmtNum(v) + ' units')
    const bar = (title, sub, tgt, act, future) => {
      const p = tgt > 0 ? Math.min(act / tgt * 100, 100) : 0
      const gap = act - tgt
      const fill = h('div', { style: { position: 'relative', height: '32px', background: 'var(--c-surface-3)', borderRadius: '8px', overflow: 'hidden' } }, [
        h('div', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: p + '%', background: 'linear-gradient(90deg,#059669,#34d399)', borderRadius: '8px' } }),
        h('div', { style: { position: 'absolute', left: p >= 25 ? '10px' : (p + '%'), top: '50%', transform: 'translateY(-50%)', color: p >= 25 ? '#fff' : 'var(--c-text-dim)', fontWeight: 700, fontSize: '12px', marginLeft: p >= 25 ? 0 : '6px' } }, tgt > 0 ? (future ? '—' : Math.round(act / tgt * 100) + '%') : '—'),
      ])
      return h('div', { style: { marginBottom: '10px' } }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } }, [
          h('span', [h('strong', title), ' ', h('span.faint', sub)]),
          h('span.faint', tgt > 0 ? `${fmt(act)} / ${fmt(tgt)} target` : (future ? 'not started' : `${fmt(act)} — no plan`))]),
        fill,
        tgt > 0 ? h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '3px' } }, [
          h('span.faint', `${fmt(act)} of ${fmt(tgt)}`),
          h('span', { style: { color: gap >= 0 ? 'var(--c-success)' : '#e11d48' } }, gap >= 0 ? `+${fmt(Math.abs(gap))} ahead` : `−${fmt(Math.abs(gap))} to target`)]) : null,
      ])
    }
    const yTgt = plan.reduce((a, b) => a + b, 0), yAct = actual.reduce((a, b) => a + b, 0)
    const nowQ = st.year > 2026 ? 0 : (st.year < 2026 ? 5 : 3)   // demo: Q3 2026 = current
    const body = h('div.card-body', [
      bar(`Year ${st.year}`, 'full-year target', yTgt, yAct, false),
      bar(`Q${st.q} ${st.year}`, 'this quarter', plan[st.q - 1], actual[st.q - 1], st.year === 2026 && st.q > 3),
    ])
    return h('div.card', [h('div.card-head', [h('h2', 'Annual achievement'), h('span.chip.b', `${scopeLabel()} · ${st.year}`), h('span.grow', { style: { flex: 1 } }),
      S.seg(st.metric, [{ v: 'value', label: '€ Value' }, { v: 'volume', label: '▦ Volume' }], v => { st.metric = v; paint() })]), body])
  }

  // BP details
  function bpCard(scope) {
    const d = bpDetail(scope)
    const head = h('div.card-head', [h('h2', 'BP & Achievement'), h('span.chip.b', scopeLabel()), h('span.faint', { style: { fontSize: '12px' } }, `target = BP · actual = PO · ${st.year} full-year`), h('span.grow', { style: { flex: 1 } }),
      S.seg(st.bpView, [{ v: 'sku', label: 'SKU' }, { v: 'month', label: 'Month' }], v => { st.bpView = v; paint() })])
    const body = h('div.card-body.flush')
    const achBadge = (t, a) => { if (!t || a == null) return h('span.faint', '(—)'); const p = Math.round(a / t * 100); const c = p >= 90 ? '#059669' : p >= 60 ? '#d97706' : '#e11d48'; return h('span', { style: { color: c, fontSize: '11px', fontWeight: 600 } }, ` (${p}%)`) }
    const rowTr = (r, indent) => h('tr', { style: indent ? { background: '#f8fafc' } : {} }, [
      h('td', { style: { paddingLeft: indent ? '26px' : '10px' } }, [r.children ? h('span', { style: { cursor: 'pointer', marginRight: '4px' }, onclick: () => { st.expandRows[r.key] = !st.expandRows[r.key]; paint() } }, st.expandRows[r.key] ? '▼' : '▶') : '', r.name, ' ', h('span.faint.mono', { style: { fontSize: '11px' } }, r.key)]),
      h('td.num', r.siTgt ? S.fmtNum(r.siTgt) : '—'),
      h('td.num', [r.siAct != null ? S.fmtNum(r.siAct) : '—', achBadge(r.siTgt, r.siAct)]),
      h('td.num', r.valTgt ? S.eur(r.valTgt) : '—'),
      h('td.num', [r.valAct != null ? S.eur(r.valAct) : '—', achBadge(r.valTgt, r.valAct)]),
    ])
    const headRow = h('tr', [h('th', st.bpView === 'sku' ? 'Product' : 'Month'), h('th.num', 'SI Target'), h('th.num', 'SI Unit (ach%)'), h('th.num', 'Value Target'), h('th.num', 'SI Value (ach%)')])
    if (st.bpView === 'month') {
      const t = h('table.tbl', [h('thead', headRow), h('tbody', d.month.map(r => rowTr(r, false)))])
      body.append(h('div.tbl-wrap', t))
    } else {
      const wrap = h('div')
      ;[1, 2, 3, 4].forEach(q => {
        const rows = d.skuByQuarter[q - 1]; const open = st.openQ === q
        const siT = rows.reduce((s, r) => s + r.siTgt, 0), siA = rows.reduce((s, r) => s + (r.siAct || 0), 0)
        wrap.append(h('div', { style: { borderBottom: '1px solid var(--c-border)' } }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', background: open ? 'var(--c-surface-2)' : '' }, onclick: () => { st.openQ = open ? 0 : q; paint() } }, [
            h('span', open ? '▼' : '▶'), h('strong', `Q${q} ${st.year}`), h('span.faint', { style: { fontSize: '12px' } }, `${rows.length} SKUs`), h('span.grow', { style: { flex: 1 } }),
            h('span.faint', { style: { fontSize: '12px' } }, `SI ${S.fmtNum(siA)}/${S.fmtNum(siT)}`)]),
          open ? h('div.tbl-wrap', h('table.tbl', [h('thead', headRow.cloneNode(true)), h('tbody', rows.length ? rows.flatMap(r => { const trs = [rowTr(r, false)]; if (r.children && st.expandRows[r.key]) r.children.forEach(c => trs.push(rowTr({ key: c.key, name: c.name, siTgt: 0, valTgt: 0, siAct: c.siAct, valAct: c.valAct, children: null }, true))); return trs }) : [h('tr', h('td', { colspan: 5, style: { padding: '16px', textAlign: 'center', color: 'var(--c-text-faint)' } }, 'No rows'))])])) : null,
        ]))
      })
      body.append(wrap)
    }
    return h('div.card', [head, body])
  }

  // Profitability card (overview/category/sku/po)
  function profitCard(scope) {
    const head = h('div.card-head', [h('h2', 'Profitability (P&L)'), h('span.chip.b', scopeLabel()), h('span.grow', { style: { flex: 1 } }),
      S.seg(st.pnlView, [{ v: 'overview', label: 'Overview' }, { v: 'category', label: 'By category' }, { v: 'sku', label: 'By SKU' }, { v: 'po', label: 'By PO' }], v => { st.pnlView = v; paint() })])
    let body
    if (st.pnlView === 'overview') body = pnlOverview(scope)
    else if (st.pnlView === 'category') body = pnlCategory(scope)
    else body = pnlModelTable(scope, st.pnlView === 'po')
    return h('div.card', [head, body])
  }
  function tile(label, value, sub, kind) {
    const bg = kind === 'np' ? '#059669' : kind === 'gp' ? '#ecfdf5' : kind === 'cost' ? '#fef2f2' : 'var(--c-surface)'
    const col = kind === 'np' ? '#fff' : 'inherit'
    return h('div', { style: { flex: 1, minWidth: '120px', background: bg, color: col, border: '1px solid var(--c-border)', borderRadius: '10px', padding: '12px' } }, [
      h('div', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.4px', opacity: .7, fontWeight: 600 } }, label),
      h('div', { style: { fontSize: '19px', fontWeight: 750, marginTop: '3px' } }, value), sub ? h('div', { style: { fontSize: '11px', opacity: .7, marginTop: '2px' } }, sub) : null])
  }
  function pnlOverview(scope) {
    const rows = pnlRows().filter(r => scope === 'ALL' || r.code === scope)
    const T = rows.reduce((t, r) => { t.rev += r.revenue; t.freight += r.freight; t.bom += r.bom; t.cn += r.cn; t.units += r.units; t.pos += r.pos; return t }, { rev: 0, freight: 0, bom: 0, cn: 0, units: 0, pos: 0 })
    const gp = T.rev - T.freight - T.bom, np = gp - T.cn
    const pctOf = (a, b) => b > 0 ? (a / b * 100).toFixed(1) + '%' : '—'
    const strip = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' } }, [
      tile('Revenue', S.eur(T.rev), `${T.pos} POs · ${S.fmtNum(T.units)} units`), op('−'),
      tile('Freight', S.eur(T.freight), `${pctOf(T.freight, T.rev)} of rev`, 'cost'), op('='),
      tile('Gross Profit', S.eur(gp), `GP ${pctOf(gp, T.rev)}`, 'gp'), op('−'),
      tile('Credit Notes', S.eur(T.cn), `${pctOf(T.cn, T.rev)} of rev`, 'cost'), op('='),
      tile('Net Profit', S.eur(np), `NP ${pctOf(np, T.rev - T.cn)}`, 'np'),
    ])
    const trs = rows.map(r => { const g = r.revenue - r.freight - r.bom, n = g - r.cn; return h('tr', [
      h('td', `${r.code}`), h('td.num', S.fmtNum(r.pos)), h('td.num', S.fmtNum(r.units)), h('td.num', S.eur(r.revenue)),
      h('td.num', r.freightPos ? `${S.eur(r.freight)} (${pctOf(r.freight, r.revenue)})` : h('span.faint', '—')),
      h('td.num', `${S.eur(g)} (${pctOf(g, r.revenue)})`), h('td.num', r.cn ? S.eur(r.cn) : h('span.faint', '—')), h('td.num', `${S.eur(n)} (${pctOf(n, r.revenue - r.cn)})`)]) })
    const table = h('table.tbl', [h('thead', h('tr', [h('th', 'Country'), h('th.num', 'PO Qty'), h('th.num', 'Units'), h('th.num', 'Revenue'), h('th.num', 'Freight (%)'), h('th.num', 'GP (GP %)'), h('th.num', 'CN'), h('th.num', 'NP (NP %)')])),
      h('tbody', trs), h('tfoot', h('tr', { style: { fontWeight: 700, background: 'var(--c-surface-3)' } }, [h('td', 'Total'), h('td.num', S.fmtNum(T.pos)), h('td.num', S.fmtNum(T.units)), h('td.num', S.eur(T.rev)), h('td.num', S.eur(T.freight)), h('td.num', S.eur(gp)), h('td.num', S.eur(T.cn)), h('td.num', S.eur(np))]))])
    return h('div.card-body', [strip, h('div.tbl-wrap', table)])
  }
  const op = s => h('div', { style: { fontSize: '18px', color: 'var(--c-text-faint)', fontWeight: 700 } }, s)
  function pnlCategory(scope) {
    const rows = pnlByCat(scope)
    const pctOf = (a, b) => b > 0 ? (a / b * 100).toFixed(1) + '%' : '—'
    const achPill = (rev, tgt) => { if (!tgt) return h('span.faint', '—'); const p = Math.round(rev / tgt * 100); const c = p >= 90 ? '#059669' : p >= 60 ? '#d97706' : '#e11d48'; return h('span.chip', { style: { color: c } }, p + '%') }
    const trs = rows.map(r => { const g = r.revenue - r.log - r.bom, n = g - r.cn; const gray = r.category === '(uncat)' || r.category === 'Other'
      return h('tr', [h('td', { style: { color: gray ? 'var(--c-text-faint)' : '' } }, r.category), h('td.num', r.target ? S.eur(r.target) : '—'), h('td.num', S.eur(r.revenue)), h('td.num', achPill(r.revenue, r.target)),
        h('td.num', r.log ? S.eur(r.log) : h('span.faint', '—')), h('td.num', `${S.eur(g)} (${pctOf(g, r.revenue)})`), h('td.num', r.cn ? S.eur(r.cn) : h('span.faint', '—')), h('td.num', `${S.eur(n)} (${pctOf(n, r.revenue - r.cn)})`)]) })
    return h('div.card-body', h('div.tbl-wrap', h('table.tbl', [h('thead', h('tr', [h('th', 'Category'), h('th.num', 'BP Target'), h('th.num', 'Actual Rev'), h('th.num', 'Achieve %'), h('th.num', 'Freight'), h('th.num', 'GP (GP %)'), h('th.num', 'CN'), h('th.num', 'NP (NP %)')])), h('tbody', trs)])))
  }
  function pnlModelTable(scope, byPo) {
    const { rows, cnOthers } = pnlByModel(scope, byPo)
    const pctOf = (a, b) => b > 0 ? (a / b * 100).toFixed(1) + '%' : '—'
    const sortKey = byPo ? st.sortPo : st.sortModel
    const setSort = k => () => { if (byPo) st.sortPo = k; else st.sortModel = k; paint() }
    const sh = (k, label, cls) => h('th', { class: (cls || 'num') + '', style: { cursor: 'pointer', color: sortKey === k ? 'var(--c-primary-text)' : '' }, onclick: setSort(k) }, [label, sortKey === k ? ' ▾' : ''])
    const firstCol = byPo ? 'PO' : 'SKU'
    const trs = rows.map(r => { const g = r.value - r.log - r.bom, n = g - r.cn; return h('tr', [
      h('td', [h('span', r.name), ' ', h('span.faint.mono', { style: { fontSize: '11px' } }, r.model)]),
      h('td.num', S.fmtNum(r.qty)), h('td.num', S.eur(r.value)),
      h('td.num', r.logPos ? `${S.eur(r.log)} (${pctOf(r.log, r.value)})` : h('span.faint', '—')),
      h('td.num', `${S.eur(g)} (${pctOf(g, r.value)})`), h('td.num', r.cn ? S.eur(r.cn) : h('span.faint', '—')), h('td.num', `${S.eur(n)} (${pctOf(n, r.value - r.cn)})`)]) })
    if (cnOthers > 0) trs.push(h('tr', { style: { background: '#fffbeb' } }, [h('td', h('span.faint', 'Others / non-product CN')), h('td.num', '—'), h('td.num', '—'), h('td.num', '—'), h('td.num', '—'), h('td.num', S.eur(cnOthers)), h('td.num', S.eur(-cnOthers))]))
    const T = rows.reduce((t, r) => { t.qty += r.qty; t.value += r.value; t.log += r.log; t.bom += r.bom; t.cn += r.cn; return t }, { qty: 0, value: 0, log: 0, bom: 0, cn: 0 })
    const Tg = T.value - T.log - T.bom, Tcn = T.cn + cnOthers, Tn = Tg - Tcn
    return h('div.card-body', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [h('th', firstCol), sh('qty', 'SI Qty'), sh('value', 'SI Value'), sh('log', 'Freight (%)'), sh('gp', 'GP (GP %)'), h('th.num', 'CN'), sh('np', 'NP (NP %)')])),
      h('tbody', trs),
      h('tfoot', h('tr', { style: { fontWeight: 700, background: 'var(--c-surface-3)' } }, [h('td', `TTL · ${rows.length} ${byPo ? 'POs' : 'SKUs'}`), h('td.num', S.fmtNum(T.qty)), h('td.num', S.eur(T.value)), h('td.num', S.eur(T.log)), h('td.num', S.eur(Tg)), h('td.num', S.eur(Tcn)), h('td.num', S.eur(Tn))])),
    ])))
  }
  function logisticCard(scope) {
    const { rows } = pnlByModel(scope, st.logView === 'po')
    const use = rows.filter(r => r.qty > 0)
    const head = h('div.card-head', [h('h2', st.logView === 'po' ? 'Logistic cost by PO' : 'Logistic cost by SKU'), h('span.chip', 'Avg unit cost'), h('span.grow', { style: { flex: 1 } }),
      S.seg(st.logView, [{ v: 'sku', label: 'By SKU' }, { v: 'po', label: 'By PO' }], v => { st.logView = v; paint() })])
    const pctOf = (a, b) => b > 0 ? (a / b * 100).toFixed(1) + '%' : '—'
    const trs = use.map(r => { const avg = r.logPos ? r.log / r.qty : null; return h('tr', [h('td', [h('span', r.name), ' ', h('span.faint.mono', { style: { fontSize: '11px' } }, r.model)]),
      h('td.num', S.eur(r.value)), h('td.num', S.fmtNum(r.qty)), h('td.num', r.logPos ? `${S.eur(r.log)} (${pctOf(r.log, r.value)})` : h('span.faint', '—')), h('td.num', avg != null ? S.eur2(avg) : h('span.faint', '—'))]) })
    let logCov = 0, qtyCov = 0; use.forEach(r => { if (r.logPos) { logCov += r.log; qtyCov += r.qty } })
    return h('div.card', [head, h('div.card-body.flush', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [h('th', st.logView === 'po' ? 'PO' : 'SKU'), h('th.num', 'Sell-in Revenue'), h('th.num', 'SI Qty'), h('th.num', 'Freight (%)'), h('th.num', 'Avg Unit Cost')])),
      h('tbody', trs), h('tfoot', h('tr', { style: { fontWeight: 700, background: 'var(--c-surface-3)' } }, [h('td', `TTL · ${use.length}`), h('td', ''), h('td.num', S.fmtNum(qtyCov)), h('td.num', S.eur(logCov)), h('td.num', qtyCov ? S.eur2(logCov / qtyCov) : '—')]))])))])
  }
  function cnCard(scope) {
    const { rows, others, othersTotal } = cnBySku(scope)
    const cols = CN_TYPES.filter(t => rows.some(r => r.by[t]) || others[t])
    const head = h('div.card-head', [h('h2', 'Credit Notes by SKU'), h('span.chip', { style: { color: '#e11d48' } }, 'By type')])
    if (!rows.length && !othersTotal) return h('div.card', [head, h('div.card-body', h('div.empty', [h('div.ic', ''), `No credit notes in ${st.year} Q${st.q}`]))])
    const rose = v => v ? h('span', { style: { color: '#e11d48' } }, S.eur(v)) : h('span.faint', '—')
    const trs = []
    rows.forEach(r => {
      trs.push(h('tr', [h('td', [r.lines.length >= 2 ? h('span', { style: { cursor: 'pointer', marginRight: '4px' }, onclick: () => { st.expandRows['cn' + r.model] = !st.expandRows['cn' + r.model]; paint() } }, st.expandRows['cn' + r.model] ? '▼' : '▶') : '', r.name, ' ', h('span.faint', { style: { fontSize: '11px' } }, `· ${r.lines.length} lines`)]),
        ...cols.map(t => h('td.num', rose(r.by[t]))), h('td.num.strong', rose(r.total))]))
      if (st.expandRows['cn' + r.model]) r.lines.forEach(l => trs.push(h('tr', { style: { background: '#f8fafc' } }, [h('td', { style: { paddingLeft: '26px', fontSize: '11px', color: 'var(--c-text-dim)' } }, l.desc.slice(0, 40)), ...cols.map(t => h('td.num', t === l.type ? rose(l.amt) : '')), h('td.num', rose(l.amt))])))
    })
    if (othersTotal) trs.push(h('tr', { style: { background: '#fffbeb' } }, [h('td', h('span.faint', 'Others / non-product CN')), ...cols.map(t => h('td.num', rose(others[t]))), h('td.num.strong', rose(othersTotal))]))
    const colTot = {}; cols.forEach(t => { colTot[t] = rows.reduce((s, r) => s + (r.by[t] || 0), 0) + (others[t] || 0) })
    const grand = rows.reduce((s, r) => s + r.total, 0) + othersTotal
    return h('div.card', [head, h('div.card-body.flush', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [h('th', 'SKU'), ...cols.map(t => h('th.num', t)), h('th.num', 'Total CN')])),
      h('tbody', trs), h('tfoot', h('tr', { style: { fontWeight: 700, background: 'var(--c-surface-3)' } }, [h('td', `TTL · ${rows.length} SKUs`), ...cols.map(t => h('td.num', S.eur(colTot[t]))), h('td.num', S.eur(grand))]))])))])
  }

  function sticky(left, w) { return { position: 'sticky', left: left + 'px', background: 'var(--c-surface)', zIndex: 2, minWidth: w + 'px', maxWidth: w + 'px', boxShadow: left ? '2px 0 0 var(--c-border)' : '' } }

  window.Modules = window.Modules || {}
  window.Modules.performance = { render }
})()

/* ============================================================================
   Shipment Workflow (履约流水线) — faithful vanilla-JS port of the ERP
   admin/po-shipment/po-shipment-view.tsx. Stage rail + per-stage grouped
   tables (expand every SKU) + real actions (local state) + weekly ledger.
   Batches synthesized from channel_po line fields. Demo: actions mutate local
   state so POs actually move between lanes; no backend.
   ============================================================================ */
(function () {
  const h = S.h

  // ── inject ERP's PosStyle once ──
  if (!document.getElementById('pos-style')) {
    const css = `
    .sw-root{max-width:1560px;margin:0 auto}
    .mainnode{cursor:pointer;display:flex;align-items:center;gap:8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:8px;padding:7px 10px;transition:background .12s,border-color .12s}
    .mainnode:hover{background:var(--c-surface-2)}
    .mainnode.active{border-color:var(--c-primary);background:var(--c-primary-weak)}
    .ni{width:7px;height:7px;border-radius:50%;background:var(--a);flex:none}
    .nl{font-size:12px;font-weight:600;color:var(--c-text);flex:1}
    .nc{font-size:13px;font-weight:700;color:var(--c-text);font-variant-numeric:tabular-nums}
    .mainnode.active .nc{color:var(--c-primary-text)}
    .conn{text-align:center;color:var(--c-border-strong);font-size:10px;line-height:1;margin:1px 0}
    .branchwrap{margin:4px 0 4px 18px;padding-left:12px;border-left:1.5px dashed var(--c-border-strong);display:flex;flex-direction:column;gap:5px}
    .branchnode{cursor:pointer;display:flex;align-items:center;gap:7px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:8px;padding:6px 9px;position:relative;transition:background .12s,border-color .12s}
    .branchnode::before{content:"";position:absolute;left:-13px;top:50%;width:11px;height:1.5px;background:var(--c-border-strong)}
    .branchnode:hover{background:var(--c-surface-2)}.branchnode.active{border-color:var(--c-primary);background:var(--c-primary-weak)}
    .bi{width:6px;height:6px;border-radius:50%;background:var(--a);flex:none}
    .bl{font-size:11.5px;font-weight:600;color:var(--c-text);flex:1}.bc{font-size:12px;font-weight:700;color:var(--c-text)}
    .lg-date{background:var(--c-surface);border:1px solid var(--c-border-strong);border-radius:8px;padding:5px 8px;font-size:12px;color:var(--c-text);outline:none;font-family:inherit}
    .lg-date:focus{border-color:var(--c-primary);box-shadow:0 0 0 3px var(--c-primary-weak)}
    .btn{border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--c-border-strong);background:var(--c-surface);color:var(--c-text);transition:background .12s;white-space:nowrap;text-align:center}
    .btn:hover{background:var(--c-surface-2)}.btn:active{transform:scale(.98)}.btn:disabled{opacity:.5;cursor:default}
    .b-green,.b-indigo{background:var(--c-primary);border-color:var(--c-primary);color:#fff}
    .b-green:hover,.b-indigo:hover{filter:brightness(1.06)}
    .b-blue,.b-grey{background:var(--c-surface);color:var(--c-text-dim)}
    .b-red{background:var(--c-surface);color:var(--c-danger)}
    .fld{border:1px solid var(--c-border-strong);border-radius:8px;padding:7px 9px;font-size:13px;outline:none;background:var(--c-surface)}
    .sw-card{background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;box-shadow:var(--shadow-sm)}
    table.sw{width:100%;border-collapse:collapse;font-size:13px}
    table.sw th{padding:9px 12px;font-size:11px;font-weight:600;color:var(--c-text-dim);text-align:left;position:sticky;top:0;z-index:1;background:var(--c-surface-3)}
    table.sw td{padding:8px 12px;border-top:1px solid var(--c-border);vertical-align:middle}
    table.sw tbody tr:hover{background:var(--c-surface-2)}
    .pill{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;background:var(--c-surface-3);color:var(--c-text-dim)}
    .pill-ctry,.pill-ka{background:var(--c-surface-3);color:var(--c-text-dim)}
    .mono{font-family:var(--font-mono)}
    .chev{cursor:pointer;color:var(--c-text-faint);transition:transform .12s;display:inline-block}.chev.open{transform:rotate(90deg)}
    .sw-sub{background:var(--c-surface-2)}
    .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .docbadge{margin-left:6px;padding:1px 6px;border-radius:6px;font-size:10px;cursor:pointer;background:var(--c-surface-3);color:var(--c-text-faint)}
    .hrail{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}
    .hnode{display:flex;align-items:center;gap:8px;flex:1;min-width:112px;padding:10px 12px;border:1px solid var(--c-border);border-radius:11px;background:var(--c-surface);cursor:pointer;box-shadow:var(--shadow-sm);transition:background .12s,border-color .12s}
    .hnode:hover{background:var(--c-surface-2)}
    .hnode.active{border-color:var(--c-primary);background:var(--c-primary-weak)}
    .hnode .hd{width:8px;height:8px;border-radius:50%;background:var(--a);flex:none}
    .hnode .hl{font-size:12.5px;font-weight:600;color:var(--c-text);flex:1;white-space:nowrap}
    .hnode .hc{font-size:17px;font-weight:800;color:var(--c-text);font-variant-numeric:tabular-nums}
    .hnode.active .hc{color:var(--c-primary-text)}
    `
    const el = document.createElement('style'); el.id = 'pos-style'; el.textContent = css; document.head.appendChild(el)
  }

  const STAGES = {
    new:       { key: 'new', icon: '', label: 'New PO', a: '#6366f1', bg: '#eef2ff', bd: '#c7d2fe', tx: '#4338ca', desc: '刚导入 / 手动新建、且尚未发货的单，等待核对。Confirm 进入待发；也可直接作废。' },
    toship:    { key: 'toship', icon: '', label: 'To Ship', a: '#f59e0b', bg: '#fffbeb', bd: '#fde68a', tx: '#b45309', desc: '已确认、等待发货。全发Mark shipped；只发一部分Partial（剩余量转入 Partial 车道继续跟）；客户取消Cancel。' },
    shipped:   { key: 'shipped', icon: '', label: 'Shipped', a: '#10b981', bg: '#ecfdf5', bd: '#a7f3d0', tx: '#047857', desc: '已全部发出、在途。展开逐批录入送达日；全部批次都送达即自动归入 Delivered。' },
    delivered: { key: 'delivered', icon: '', label: 'Delivered', a: '#64748b', bg: '#f8fafc', bd: '#e2e8f0', tx: '#475569', desc: '发满且全部批次都已送达 = 自动完成。展开可追溯每张 PO 下每个 SKU 的每一批发运。' },
    partial:   { key: 'partial', icon: '◑', label: 'Partial', a: '#0ea5e9', bg: '#f0f9ff', bd: '#bae6fd', tx: '#0369a1', desc: '部分已发，Remaining 为仍待发的未结量。展开可给已发批次录送达日；可多次 Ship remaining 分批发货，发完自动归 Shipped。' },
    cancelled: { key: 'cancelled', icon: '✗', label: 'Cancelled', a: '#f43f5e', bg: '#fff1f2', bd: '#fecdd3', tx: '#be123c', desc: '已取消（仍计入总额，只是状态标签）。误操作可 Reopen 退回待发。' },
  }
  const CCY_SYM = { EUR: '€', PLN: 'zł ', CNY: '¥' }
  const FX = { EUR: 1, PLN: 0.233, CNY: 0.13 }
  const PLN_EUR = 0.233
  const fmtNum = S.fmtNum
  const fmtMoney = (v, c) => v == null ? '–' : (CCY_SYM[c] || (c ? c + ' ' : '')) + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const convertMoney = (v, from, to) => from === to ? v : v * (FX[from] || 1) / (FX[to] || 1)
  const toEUR = (t, c) => t == null ? 0 : (c === 'PLN' ? t * PLN_EUR : t)
  const today = () => { const d = new Date(); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) }
  const daysSince = d => d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86400000)) : 0
  const ageTone = n => n > 30 ? 'background:#fff1f2;color:#be123c' : n > 14 ? 'background:#fffbeb;color:#b45309' : 'background:#f3f4f6;color:#6b7280'

  const sById = {}; (DATA.sku || []).forEach(s => sById[s.id] = s)
  const cById = {}; (DATA.country || []).forEach(c => cById[c.id] = c)
  const kById = {}; (DATA.ka || []).forEach(k => kById[k.id] = k)

  // OpsRow[]
  const ROWS = (DATA.channel_po || []).map(r => {
    const s = sById[r.sku_id] || {}, c = cById[r.country_id] || {}, k = kById[r.ka_id] || {}
    return {
      id: r.id, po_date: r.po_date, po_number: r.po_number, notes: r.notes,
      ship_date: r.ship_date, delivery_date: r.delivery_date, po_status: r.po_status,
      sku_code: s.code || ('#' + r.sku_id), sku_name: s.name || '', ean: s.ean || null,
      country_code: c.code || '', ka_name: k.name || null, qty: Number(r.qty_ordered) || 0,
      delivered_qty: r.delivered_qty != null ? Number(r.delivered_qty) : 0,
      fd_buying_price: r.fd_buying_price != null ? Number(r.fd_buying_price) : null,
      turnover: r.turnover != null ? Number(r.turnover) : null, currency: r.currency || 'EUR',
    }
  })
  // synthesize batches from line fields
  let BID = 1
  const BATCHES = []
  ROWS.forEach(l => { if (l.delivered_qty > 0 || l.ship_date || l.delivery_date) BATCHES.push({ id: BID++, po_id: l.id, qty: l.delivered_qty > 0 ? l.delivered_qty : l.qty, ship_date: l.ship_date, delivery_date: l.delivery_date, notes: null }) })
  const batchesFor = id => BATCHES.filter(b => b.po_id === id)

  const stageOf = r => r.po_status === 'cancelled' ? 'cancelled' : r.po_status === 'partial' ? 'partial'
    : r.delivery_date ? 'delivered' : r.ship_date ? 'shipped' : r.po_status === 'new' ? 'new' : 'toship'

  // mimic DB trigger: recompute line from its batches
  function recalc(l) {
    const bs = batchesFor(l.id)
    if (!bs.length) { l.delivered_qty = 0; l.ship_date = null; l.delivery_date = null; if (l.po_status === 'partial') l.po_status = null; return }
    l.delivered_qty = bs.reduce((s, b) => s + b.qty, 0)
    l.ship_date = bs.map(b => b.ship_date).filter(Boolean).sort()[0] || null
    const allDel = bs.every(b => b.delivery_date)
    l.delivery_date = allDel ? bs.map(b => b.delivery_date).filter(Boolean).sort().slice(-1)[0] : null
    if (l.po_status !== 'cancelled') l.po_status = (l.delivered_qty > 0 && l.delivered_qty < l.qty) ? 'partial' : null
  }

  // ── state ──
  let st = null
  function init() { st = { active: 'toship', open: {}, poSearch: '', kaFilter: '', dates: {}, weeksBack: 8, viewCcy: 'CNY', ledgerWeek: null } }
  const dateOf = k => st.dates[k] || today()
  const toggle = k => { st.open[k] = !st.open[k]; paint() }

  function buckets() {
    const b = { new: [], toship: [], shipped: [], delivered: [], partial: [], cancelled: [] }
    ROWS.forEach(r => b[stageOf(r)].push(r))
    for (const k in b) b[k].sort((a, z) => (z.po_date || '').localeCompare(a.po_date || ''))
    return b
  }
  function groupByPo(rows) {
    const m = {}
    rows.forEach(r => { const key = r.po_number ? 'po:' + r.po_number : 'id:' + r.id; (m[key] = m[key] || { key, po_number: r.po_number, country_code: r.country_code, ka_name: r.ka_name, po_date: r.po_date, lines: [] }).lines.push(r) })
    const gs = Object.values(m)
    gs.forEach(g => { g.lines.sort((a, z) => a.sku_code.localeCompare(z.sku_code)); g.po_date = g.lines.map(l => l.po_date).filter(Boolean).sort()[0]; g.qty = g.lines.reduce((s, l) => s + l.qty, 0) })
    return gs.sort((a, z) => (z.po_date || '').localeCompare(a.po_date || ''))
  }

  // ── actions (local) ──
  function confirmPo(ids) { ids.forEach(id => { const l = ROWS.find(r => r.id === id); if (l) l.po_status = null }); paint() }
  function cancelPo(ids, n) { if (!confirm(`取消 ${n} 行 PO？\n仍计入总额，只是打上 Cancelled 状态标签。`)) return; ids.forEach(id => { const l = ROWS.find(r => r.id === id); if (l) l.po_status = 'cancelled' }); paint() }
  function addBatches(defs) { defs.forEach(d => { BATCHES.push({ id: BID++, po_id: d.po_id, qty: d.qty, ship_date: d.ship_date, delivery_date: null, notes: null }); const l = ROWS.find(r => r.id === d.po_id); if (l) recalc(l) }); paint() }
  function markShipped(lines, key) { const b = lines.map(l => ({ po_id: l.id, qty: l.qty - (l.delivered_qty || 0), ship_date: dateOf(key) })).filter(x => x.qty > 0); if (!b.length) { alert('这些行已全部发完。'); return } addBatches(b) }
  function markPartial(l, key) { const inp = prompt(`部分发货 — 本次发货数量（共 ${l.qty}）：`, ''); if (inp == null) return; const n = Math.floor(Number(inp)); if (!Number.isFinite(n) || n <= 0 || n >= l.qty) { alert(`请输入 1 到 ${l.qty - 1} 之间的数量（整单发完请用 Mark shipped）。`); return } addBatches([{ po_id: l.id, qty: n, ship_date: dateOf(key) }]) }
  function shipRemaining(l, key) { const rem = l.qty - (l.delivered_qty || 0); if (rem <= 0) { alert('这一行已全部发完。'); return } if (!confirm(`把 ${l.sku_code} 的全部剩余量 ${rem} 在 ${dateOf(key)} 发出？\n发完该行将结清并归入 Shipped。`)) return; addBatches([{ po_id: l.id, qty: rem, ship_date: dateOf(key) }]) }
  function partialRemaining(l, key) { const rem = l.qty - (l.delivered_qty || 0); if (rem <= 1) { alert(`剩余仅 ${rem}，请直接用「发余量」发完。`); return } const inp = prompt(`部分发货 — 本次发货数量（剩余 ${rem}，需小于 ${rem}）：`, ''); if (inp == null) return; const n = Math.floor(Number(inp)); if (!Number.isFinite(n) || n <= 0 || n >= rem) { alert(`请输入 1 到 ${rem - 1} 之间的数量。`); return } addBatches([{ po_id: l.id, qty: n, ship_date: dateOf(key) }]) }
  function deliverGroup(lineIds, date) { BATCHES.forEach(b => { if (lineIds.includes(b.po_id) && !b.delivery_date) b.delivery_date = date }); lineIds.forEach(id => { const l = ROWS.find(r => r.id === id); if (l) recalc(l) }); paint() }
  function reopen(id) { if (!confirm('退回 To Ship？\n将删除该行的全部发货批次记录，并清除 shipped / partial / cancelled 标记。')) return; for (let i = BATCHES.length - 1; i >= 0; i--) if (BATCHES[i].po_id === id) BATCHES.splice(i, 1); const l = ROWS.find(r => r.id === id); if (l) { l.po_status = null; recalc(l) } paint() }

  // ── shared cells ──
  const ctryPill = r => h('span.pill.pill-ctry', r.country_code || '?')
  const kaPill = r => h('span.pill.pill-ka', r.ka_name || '-')
  const docBadge = po => po ? h('span.docbadge', { onclick: e => { e.stopPropagation(); S.toast('PO 文档：箱唛/送货单/装箱单/POD/发票 · demo') } }, 'DOC') : null
  const chev = (k) => h('span', { class: 'chev' + (st.open[k] ? ' open' : ''), onclick: e => { e.stopPropagation(); toggle(k) } }, '▶')
  const dateInput = (key) => h('input.lg-date', { type: 'date', max: today(), value: dateOf(key), onchange: e => { st.dates[key] = e.target.value } })
  const btn = (label, cls, fn, dis) => h('button.btn.' + cls, { disabled: dis ? true : null, onclick: e => { e.stopPropagation(); fn() } }, label)

  // ═══ RENDER ═══
  let ROOT
  function render(root) { ROOT = root; if (!st) init(); paint() }
  function paint() {
    S.clear(ROOT)
    const B = buckets()
    const wrap = h('div.sw-root')
    wrap.append(header(), rail(B), rightPanel(B), weeklyLedger())
    ROOT.append(wrap)
    const chip = document.getElementById('scope-chip'); if (chip) chip.textContent = STAGES[st.active].label
  }

  function header() {
    return h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' } }, [
      h('div', [h('h1', { style: { margin: 0, fontSize: '22px', fontWeight: 800 } }, '发货操作'),
        h('div', { style: { fontSize: '13px', color: 'var(--c-text-dim)', marginTop: '4px', maxWidth: '760px' } }, '一条履约流水线管完整 PO 生命周期。发货记录以批次存储，同一 SKU 可分多次发运、各批独立日期与备注。')]),
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
        h('button.btn', { onclick: () => S.toast('PO 明细导出 · demo') }, 'PO 明细'),
        h('button.btn', { onclick: () => S.toast('订单交期编辑/导出 · demo') }, '订单交期'),
        h('button.btn.b-green', { style: { padding: '9px 18px', fontSize: '13px' }, onclick: openShipConsole }, '＋ 发货操作台'),
      ])])
  }

  function railNode(meta, count, cls) {
    const vars = { '--a': meta.a, '--bg': meta.bg, '--bd': meta.bd, '--tx': meta.tx }
    if (cls === 'branch') return h('div', { class: 'branchnode' + (st.active === meta.key ? ' active' : ''), style: vars, onclick: () => { st.active = meta.key; paint() } }, [h('span.bi'), h('span.bl', meta.label), h('span.bc', count)])
    return h('div', { class: 'mainnode' + (st.active === meta.key ? ' active' : ''), style: vars, onclick: () => { st.active = meta.key; paint() } }, [h('span.ni'), h('span.nl', meta.label), h('span.nc', count)])
  }
  function rail(B) {
    const node = k => { const m = STAGES[k]; return h('div', { class: 'hnode' + (st.active === k ? ' active' : ''), onclick: () => { st.active = k; paint() } }, [h('span.hd', { style: { background: m.a } }), h('span.hl', m.label), h('span.hc', B[k].length)]) }
    return h('div.hrail', ['new', 'toship', 'partial', 'cancelled', 'shipped', 'delivered'].map(node))
  }

  function rightPanel(B) {
    const meta = STAGES[st.active]
    let list = B[st.active]
    if (st.poSearch) { const q = st.poSearch.toLowerCase(); list = list.filter(r => (r.po_number || '').toLowerCase().includes(q)) }
    if (st.kaFilter) list = list.filter(r => (r.ka_name || '') === st.kaFilter)
    const units = list.reduce((s, r) => s + r.qty, 0)
    const search = h('div', { style: { position: 'relative' } }, [
      h('span', { style: { position: 'absolute', left: '9px', top: '7px', fontSize: '12px', color: '#9ca3af' } }, ''),
      h('input.lg-date', { style: { paddingLeft: '26px', width: '190px', height: '34px', fontSize: '13px' }, placeholder: 'Search PO #…', value: st.poSearch, oninput: e => { st.poSearch = e.target.value; paint(); const i = document.querySelector('.sw-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length) } } })])
    search.querySelector('input').classList.add('sw-search')
    const tools = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [search])
    const head = h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' } }, [
      h('div', [h('div', { style: { fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: '8px' } }, [h('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: meta.a } }), meta.label, h('span', { style: { fontSize: '12px', fontWeight: 400, color: 'var(--c-text-faint)' } }, `· ${list.length} lines · ${fmtNum(units)} units`)]),
        h('div', { style: { fontSize: '12px', color: 'var(--c-text-faint)', marginTop: '2px', maxWidth: '880px' } }, meta.desc)]), tools])
    const table = tableFor(st.active, list)
    const wrapT = h('div', { style: { borderLeft: '3px solid ' + meta.a, borderRadius: '10px', overflow: 'hidden', marginTop: '10px' } },
      h('div', { style: { overflow: 'auto', maxHeight: '600px', border: '1px solid #f1f3f5', borderLeft: 'none', borderRadius: '0 10px 10px 0' } }, table))
    return h('div', { class: 'sw-card', style: { padding: '16px' } }, [head, wrapT])
  }

  // KA filter header cell
  function kaTh(list) {
    const names = [...new Set(list.map(r => r.ka_name).filter(Boolean))].sort()
    const sel = h('select', { style: { border: '1px solid ' + (st.kaFilter ? '#93c5fd' : '#e5e7eb'), color: st.kaFilter ? '#2563eb' : '#4b5563', borderRadius: '6px', fontSize: '11px', padding: '2px 4px', background: '#fff' }, onclick: e => e.stopPropagation(), onchange: e => { st.kaFilter = e.target.value; paint() } },
      [h('option', { value: '' }, 'All KAs')].concat(names.map(n => h('option', { value: n, selected: n === st.kaFilter }, n))))
    return h('th', sel)
  }
  const emptyRow = (span) => h('tr', h('td', { colspan: span, style: { padding: '48px', textAlign: 'center', color: '#d1d5db' } }, st.poSearch ? `没有匹配「${st.poSearch}」的 PO` : '此阶段暂无记录 '))

  function tableFor(stage, list) {
    if (stage === 'cancelled') return cancelledTable(list)
    if (stage === 'partial') return partialTable(list)
    if (stage === 'shipped') return shippedTable(list)
    if (stage === 'delivered') return deliveredTable(list)
    return groupedTable(list, stage === 'new')  // new / toship
  }

  const bg = () => 'var(--c-surface-3)'

  // 3.1 New / To Ship
  function groupedTable(list, isNew) {
    const groups = groupByPo(list)
    const ths = [h('th'), h('th', 'PO #'), h('th', 'Country'), kaTh(list), h('th', { style: { textAlign: 'center' } }, 'SKUs'), h('th.num', 'Total Qty'), h('th', 'PO Date')]
    if (!isNew) ths.push(h('th', { style: { textAlign: 'center' } }, 'Waiting'))
    const span = ths.length
    const tb = h('tbody')
    if (!groups.length) tb.append(emptyRow(span))
    groups.forEach(g => {
      const cells = [h('td', chev(g.key)), h('td', [h('span.mono', { style: { fontWeight: 600 } }, g.po_number || '（无 PO #）'), docBadge(g.po_number)]),
        h('td', ctryPill(g.lines[0])), h('td', kaPill(g.lines[0])), h('td', { style: { textAlign: 'center', color: '#6b7280' } }, g.lines.length), h('td.num', { style: { fontWeight: 700 } }, fmtNum(g.qty)), h('td', { class: 'mono', style: { color: '#6b7280' } }, g.po_date)]
      if (!isNew) { const age = daysSince(g.po_date); cells.push(h('td', { style: { textAlign: 'center' } }, h('span.pill', { style: ageTone(age) + '' }, age + 'd'))) }
      tb.append(h('tr', { style: { cursor: 'pointer' }, onclick: () => toggle(g.key) }, cells))
      if (st.open[g.key]) tb.append(subGrouped(g, isNew, span))
    })
    return h('table.sw', [h('thead', { style: { background: bg() } }, h('tr', ths)), tb])
  }
  function subGrouped(g, isNew, span) {
    const inner = h('table.sw', { style: { margin: 0 } }, [h('thead', h('tr', [h('th', 'SKU'), h('th', 'Product'), h('th.num', 'Qty'), h('th.num', 'Unit Price'), h('th.num', 'Turnover'), h('th', 'Notes')])),
      h('tbody', g.lines.map(l => h('tr', [h('td.mono', l.sku_code), h('td', { style: { color: '#6b7280' } }, l.sku_name || '-'), h('td.num', fmtNum(l.qty)), h('td.num', fmtMoney(l.fd_buying_price, l.currency)), h('td.num', fmtMoney(l.turnover, l.currency)), h('td', { style: { color: '#9ca3af' } }, l.notes || '—')]))) ])
    return h('tr.sw-sub', h('td', { colspan: span, style: { padding: '4px 4px 10px 34px' } }, [h('div', { style: { fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', margin: '4px 0' } }, `${g.lines.length} 个 SKU`), inner]))
  }

  // 3.2 Partial
  function partialTable(list) {
    const groups = groupByPo(list).map(g => { const delivered = g.lines.reduce((s, l) => s + (l.delivered_qty || 0), 0); return Object.assign(g, { delivered, remaining: g.qty - delivered }) })
    const ths = [h('th'), h('th', 'PO #'), h('th', 'Country'), kaTh(list), h('th', { style: { textAlign: 'center' } }, 'SKUs'), h('th.num', 'Ordered'), h('th.num', { style: { color: '#059669' } }, 'Delivered'), h('th.num', { style: { color: '#b45309' } }, 'Remaining'), h('th', 'PO Date')]
    const tb = h('tbody'); if (!groups.length) tb.append(emptyRow(ths.length))
    groups.forEach(g => {
      tb.append(h('tr', { style: { cursor: 'pointer' }, onclick: () => toggle(g.key) }, [h('td', chev(g.key)), h('td', [h('span.mono', { style: { fontWeight: 600 } }, g.po_number || '（无 PO #）'), docBadge(g.po_number)]), h('td', ctryPill(g.lines[0])), h('td', kaPill(g.lines[0])), h('td', { style: { textAlign: 'center', color: '#6b7280' } }, g.lines.length), h('td.num', fmtNum(g.qty)), h('td.num', { style: { color: '#047857', fontWeight: 600 } }, fmtNum(g.delivered)), h('td.num', { style: { color: '#b45309', fontWeight: 700 } }, fmtNum(g.remaining)), h('td', { class: 'mono', style: { color: '#6b7280' } }, g.po_date)]))
      if (st.open[g.key]) tb.append(partialSub(g, ths.length))
    })
    return h('table.sw', [h('thead', { style: { background: bg() } }, h('tr', ths)), tb])
  }
  function partialSub(g, span) {
    const inner = h('table.sw', { style: { margin: 0 } }, [h('thead', h('tr', [h('th', 'SKU'), h('th', 'Product'), h('th.num', 'Ordered'), h('th.num', 'Delivered'), h('th.num', 'Remaining'), h('th', 'Ship Date')])),
      h('tbody', g.lines.map(l => { const rem = l.qty - (l.delivered_qty || 0), bs = batchesFor(l.id)
        return h('tr', [h('td.mono', l.sku_code), h('td', { style: { color: '#6b7280' } }, l.sku_name), h('td.num', fmtNum(l.qty)), h('td.num', { style: { color: '#047857' } }, fmtNum(l.delivered_qty || 0)), h('td.num', { style: { color: '#b45309', fontWeight: 700 } }, fmtNum(rem)), h('td', [l.ship_date || '–', ' ', bs.length ? h('span.pill', { style: { background: '#f3f4f6', color: '#6b7280' } }, bs.length + '批') : null])]) })) ])
    return h('tr.sw-sub', h('td', { colspan: span, style: { padding: '4px 4px 10px 34px' } }, [h('div', { style: { fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', margin: '4px 0' } }, `${g.lines.length} 个 SKU`), inner]))
  }

  // 3.3 Shipped
  function shippedTable(list) {
    const groups = groupByPo(list).map(g => { const allb = g.lines.flatMap(l => batchesFor(l.id)); return Object.assign(g, { firstShip: allb.map(b => b.ship_date).filter(Boolean).sort()[0], undelivered: allb.filter(b => !b.delivery_date).length }) })
    const ths = [h('th'), h('th', 'PO #'), h('th', 'Country'), kaTh(list), h('th', { style: { textAlign: 'center' } }, 'SKUs'), h('th.num', 'Total Qty'), h('th', 'PO Date'), h('th', 'Shipped'), h('th', { style: { textAlign: 'center' } }, '送达进度')]
    const tb = h('tbody'); if (!groups.length) tb.append(emptyRow(ths.length))
    groups.forEach(g => {
      const prog = g.undelivered > 0 ? h('span.pill', { style: { background: 'var(--c-warn-weak)', color: 'var(--c-warn)' } }, `${g.undelivered} 批在途`) : h('span.pill', { style: { background: '#e9f9ef', color: '#16a34a' } }, '全部已达')
      tb.append(h('tr', { style: { cursor: 'pointer' }, onclick: () => toggle(g.key) }, [h('td', chev(g.key)), h('td', [h('span.mono', { style: { fontWeight: 600 } }, g.po_number || '（无 PO #）'), docBadge(g.po_number)]), h('td', ctryPill(g.lines[0])), h('td', kaPill(g.lines[0])), h('td', { style: { textAlign: 'center', color: '#6b7280' } }, g.lines.length), h('td.num', fmtNum(g.qty)), h('td', { class: 'mono', style: { color: '#6b7280' } }, g.po_date), h('td.mono', g.firstShip || '–'), h('td', { style: { textAlign: 'center' } }, prog)]))
      if (st.open[g.key]) tb.append(shippedSub(g, ths.length))
    })
    return h('table.sw', [h('thead', { style: { background: bg() } }, h('tr', ths)), tb])
  }
  function shippedSub(g, span) {
    const inner = h('table.sw', { style: { margin: 0 } }, [h('thead', h('tr', [h('th', 'SKU'), h('th', 'Product'), h('th.num', 'Qty'), h('th', 'Ship Date'), h('th', '送达')])),
      h('tbody', g.lines.map(l => { const bs = batchesFor(l.id), und = bs.filter(b => !b.delivery_date).length
        return h('tr', [h('td.mono', l.sku_code), h('td', { style: { color: '#6b7280' } }, l.sku_name), h('td.num', fmtNum(l.qty)), h('td', [l.ship_date || '–', ' ', bs.length ? h('span.pill', { style: { background: '#f3f4f6', color: '#6b7280' } }, bs.length + '批') : null]), h('td', und > 0 ? h('span', { style: { color: 'var(--c-warn)', fontSize: '11px' } }, `${und} 批在途`) : h('span', { style: { color: '#16a34a', fontSize: '11px' } }, '已达'))]) })) ])
    return h('tr.sw-sub', h('td', { colspan: span, style: { padding: '4px 4px 10px 34px' } }, [h('div', { style: { fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', margin: '4px 0' } }, `${g.lines.length} 个 SKU · 展开逐批录送达日`), inner]))
  }

  // 3.4 Delivered
  function deliveredTable(list) {
    const groups = groupByPo(list).map(g => { const allb = g.lines.flatMap(l => batchesFor(l.id)); return Object.assign(g, { turnover: g.lines.reduce((s, l) => s + (l.turnover || 0), 0), currency: g.lines[0].currency, firstShip: allb.map(b => b.ship_date).filter(Boolean).sort()[0], lastDelivery: allb.map(b => b.delivery_date).filter(Boolean).sort().slice(-1)[0], batchCount: allb.length }) }).sort((a, z) => (z.lastDelivery || '').localeCompare(a.lastDelivery || ''))
    const ccySel = h('select', { style: { fontSize: '10px', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '1px 3px' }, onclick: e => e.stopPropagation(), onchange: e => { st.viewCcy = e.target.value; paint() } }, ['CNY', 'EUR', 'PLN'].map(c => h('option', { value: c, selected: c === st.viewCcy }, c)))
    const ths = [h('th'), h('th', 'PO #'), h('th', 'Country'), kaTh(list), h('th', { style: { textAlign: 'center' } }, 'SKUs'), h('th.num', 'Total Qty'), h('th.num', 'Total Value'), h('th', 'PO Date'), h('th', 'Shipped'), h('th', 'Delivered'), h('th.num', ['Delivery fee ', ccySel]), h('th.num', 'Avg / unit')]
    const tb = h('tbody'); if (!groups.length) tb.append(emptyRow(ths.length))
    groups.forEach(g => {
      const multi = g.batchCount > g.lines.length
      tb.append(h('tr', { style: { cursor: 'pointer' }, onclick: () => toggle(g.key) }, [h('td', chev(g.key)), h('td', [h('span.mono', { style: { fontWeight: 600 } }, g.po_number || '（无 PO #）'), docBadge(g.po_number)]), h('td', ctryPill(g.lines[0])), h('td', kaPill(g.lines[0])), h('td', { style: { textAlign: 'center', color: '#6b7280' } }, [g.lines.length, multi ? h('span.pill', { style: { background: '#fffbeb', color: '#b45309', marginLeft: '4px' } }, g.batchCount + ' 批') : null]), h('td.num', fmtNum(g.qty)), h('td.num', { style: { fontWeight: 600 } }, g.turnover ? fmtMoney(g.turnover, g.currency) : '–'), h('td', { class: 'mono', style: { color: '#6b7280' } }, g.po_date), h('td.mono', g.firstShip || '–'), h('td', h('span.pill', { style: { background: '#f1f5f9', color: '#475569' } }, g.lastDelivery || '–')), h('td.num', { style: { color: '#9ca3af' } }, '–'), h('td.num', { style: { color: '#9ca3af' } }, '–')]))
      if (st.open[g.key]) tb.append(deliveredSub(g, ths.length))
    })
    return h('table.sw', [h('thead', { style: { background: bg() } }, h('tr', ths)), tb])
  }
  function deliveredSub(g, span) {
    const rows = []
    g.lines.forEach(l => { const bs = batchesFor(l.id); if (!bs.length) rows.push([l, null, true, 0]); else bs.forEach((b, i) => rows.push([l, b, i === 0, i])) })
    const inner = h('table.sw', { style: { margin: 0 } }, [h('thead', h('tr', [h('th', 'SKU'), h('th', 'Product'), h('th.num', '批次 Qty'), h('th.num', 'Unit Price'), h('th', 'Ship Date'), h('th', 'Delivery Date'), h('th', 'Notes')])),
      h('tbody', rows.map(([l, b, first, i]) => h('tr', [h('td.mono', first ? l.sku_code : ''), h('td', { style: { color: '#6b7280' } }, first ? l.sku_name : h('span', { style: { color: '#9ca3af' } }, '第 ' + (i + 1) + ' 批')), h('td.num', fmtNum(b ? b.qty : l.qty)), h('td.num', first ? fmtMoney(l.fd_buying_price, l.currency) : ''), h('td.mono', (b && b.ship_date) || l.ship_date || '–'), h('td', { class: 'mono', style: { color: '#047857' } }, (b && b.delivery_date) || l.delivery_date || '–'), h('td', { style: { color: '#9ca3af' } }, (b && b.notes) || (first ? l.notes : '') || '—')]))) ])
    return h('tr.sw-sub', h('td', { colspan: span, style: { padding: '4px 4px 10px 34px' } }, [h('div', { style: { fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', margin: '4px 0' } }, `发货明细 · ${g.lines.length} 个 SKU · ${g.batchCount} 批发运`), inner]))
  }

  // 3.5 Cancelled (flat)
  function cancelledTable(list) {
    const ths = [h('th', 'PO #'), h('th', 'Country'), kaTh(list), h('th', 'SKU'), h('th', 'Product'), h('th.num', 'Qty'), h('th.num', 'Unit Price'), h('th.num', 'Turnover'), h('th', 'PO Date'), h('th', 'Notes')]
    const tb = h('tbody')
    if (!list.length) tb.append(h('tr', h('td', { colspan: ths.length, style: { padding: '48px', textAlign: 'center', color: '#d1d5db' } }, st.poSearch ? `没有匹配「${st.poSearch}」的 PO` : '没有记录')))
    list.forEach(l => tb.append(h('tr', [h('td', [h('span.mono', { style: { fontWeight: 600 } }, l.po_number || '（无 PO #）'), docBadge(l.po_number)]), h('td', ctryPill(l)), h('td', kaPill(l)), h('td.mono', l.sku_code), h('td', { style: { color: '#6b7280' } }, l.sku_name), h('td.num', fmtNum(l.qty)), h('td.num', fmtMoney(l.fd_buying_price, l.currency)), h('td.num', fmtMoney(l.turnover, l.currency)), h('td', { class: 'mono', style: { color: '#6b7280' } }, l.po_date), h('td', { style: { color: '#9ca3af' } }, l.notes || '—')])))
    return h('table.sw', [h('thead', { style: { background: bg() } }, h('tr', ths)), tb])
  }

  // ═══ Weekly ledger ═══
  function isoWeekKey(iso) { const d = new Date(iso + 'T00:00:00Z'); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7); return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0') }
  function isoMonday(iso) { const d = new Date(iso + 'T00:00:00Z'); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10) }
  function buildLedger() {
    const m = {}
    const slot = k => m[k] || (m[k] = { key: k, monday: '', poSet: new Set(), inQty: 0, inEur: 0, outBatches: 0, outQty: 0, outDelivered: 0, pos: {}, ships: [] })
    ROWS.forEach(r => { if (!r.po_date) return; const k = isoWeekKey(r.po_date); const s = slot(k); s.monday = isoMonday(r.po_date); const pk = r.po_number || ('(no PO#)-' + r.id); s.poSet.add(pk); s.inQty += r.qty; s.inEur += toEUR(r.turnover, r.currency); const p = s.pos[pk] || (s.pos[pk] = { po: r.po_number, ka: r.ka_name, ctry: r.country_code, qty: 0, eur: 0, lines: 0 }); p.qty += r.qty; p.eur += toEUR(r.turnover, r.currency); p.lines++ })
    BATCHES.forEach(b => { if (!b.ship_date) return; const k = isoWeekKey(b.ship_date); const s = slot(k); s.monday = s.monday || isoMonday(b.ship_date); const l = ROWS.find(r => r.id === b.po_id) || {}; s.outBatches++; s.outQty += b.qty; if (b.delivery_date) s.outDelivered++; s.ships.push({ po: l.po_number, ka: l.ka_name, sku: l.sku_code, qty: b.qty, date: b.ship_date, delivered: !!b.delivery_date }) })
    return Object.values(m).sort((a, z) => z.key.localeCompare(a.key))
  }
  function weeklyLedger() {
    const all = buildLedger()
    const shown = all.slice(0, st.weeksBack)
    const active = shown.find(w => w.key === st.ledgerWeek) || shown[0]
    const maxV = Math.max(1, ...all.map(w => Math.max(w.inQty, w.outQty)))
    const rangeBtn = (v, label) => h('button.btn', { class: st.weeksBack === v ? '' : '', style: { background: st.weeksBack === v ? '#1f2937' : '#fff', color: st.weeksBack === v ? '#fff' : '#4b5563', border: '1px solid ' + (st.weeksBack === v ? '#1f2937' : '#e5e7eb') }, onclick: () => { st.weeksBack = v; paint() } }, label)
    const weekList = h('div', { style: { border: '1px solid #f1f3f5', borderRadius: '12px', padding: '6px', maxHeight: '300px', overflowY: 'auto' } },
      shown.length ? shown.map(w => h('button', { style: { display: 'grid', gridTemplateColumns: '78px 1fr 104px 104px', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', background: w === active ? '#f9fafb' : 'transparent', boxShadow: w === active ? '0 0 0 1px #d1d5db inset' : 'none', borderRadius: '8px', padding: '7px 8px', cursor: 'pointer' }, onclick: () => { st.ledgerWeek = w.key; paint() } }, [
        h('div', [h('div', { style: { fontWeight: 700, fontSize: '12px' } }, 'W' + w.key.slice(-2)), h('div', { style: { fontSize: '10px', color: '#9ca3af' } }, mdOf(w.monday) + ' 起')]),
        h('div', [bar('var(--c-primary)', w.inQty, maxV, '进单'), bar('#7aa095', w.outQty, maxV, '发货')]),
        h('div', { style: { textAlign: 'right', fontSize: '11px' } }, [h('div', w.poSet.size + ' PO'), h('div', { style: { color: '#9ca3af' } }, w.inEur ? '€' + Math.round(w.inEur).toLocaleString('en-US') : '—')]),
        h('div', { style: { textAlign: 'right', fontSize: '11px' } }, [h('div', w.outBatches + ' 批'), h('div', { style: { color: '#9ca3af' } }, w.outDelivered + ' 已达')])])) : h('div', { style: { padding: '20px', textAlign: 'center', color: '#9ca3af' } }, '暂无数据'))
    const detail = active ? h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' } }, [ledgerIntake(active), ledgerShip(active)]) : null
    return h('div', { class: 'sw-card', style: { padding: '16px', marginTop: '20px' } }, [
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } }, [
        h('div', [h('div', { style: { fontSize: '15px', fontWeight: 700 } }, '周台账'), h('div', { style: { fontSize: '12px', color: '#9ca3af' } }, '每周进单 vs 发货 · 点某周看明细')]),
        h('div', { style: { display: 'flex', gap: '6px' } }, [h('span', { style: { fontSize: '12px', color: '#9ca3af', alignSelf: 'center' } }, '显示'), rangeBtn(8, '8周'), rangeBtn(12, '12周'), rangeBtn(26, '26周'), rangeBtn(999, '全部')])]),
      weekList, detail])
  }
  const mdOf = iso => { if (!iso) return ''; const p = iso.split('-'); return parseInt(p[1], 10) + '/' + parseInt(p[2], 10) }
  function bar(color, v, max, label) { return h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', margin: '1px 0' } }, [h('div', { style: { height: '9px', width: Math.max(2, v / max * 100) + '%', background: color, borderRadius: '3px', minWidth: '2px' } }), h('span', { style: { fontSize: '10px', color: '#6b7280' } }, fmtNum(v))]) }
  function ledgerIntake(w) {
    const rows = Object.values(w.pos).sort((a, z) => z.qty - a.qty)
    return h('div', { style: { border: '1px solid var(--c-border)', borderRadius: '12px', overflow: 'hidden' } }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--c-surface-2)', color: 'var(--c-text)', fontWeight: 600, fontSize: '12px' } }, ['本周进单', h('span', { style: { color: 'var(--c-text-faint)' } }, w.key.slice(-3) + ' · ' + w.poSet.size + ' PO')]),
      h('div', { style: { maxHeight: '200px', overflowY: 'auto' } }, h('table.sw', [h('thead', h('tr', [h('th', 'PO #'), h('th', 'KA'), h('th', 'SKU'), h('th.num', 'Qty'), h('th.num', '金额')])), h('tbody', rows.length ? rows.map(p => h('tr', [h('td.mono', p.po || '—'), h('td', h('span.pill.pill-ka', p.ka || '-')), h('td', { style: { color: '#6b7280' } }, p.lines), h('td.num', fmtNum(p.qty)), h('td.num', p.eur ? '€' + Math.round(p.eur).toLocaleString('en-US') : '—')])) : [h('tr', h('td', { colspan: 5, style: { padding: '16px', textAlign: 'center', color: '#9ca3af' } }, '本周没有新进单'))])]))])
  }
  function ledgerShip(w) {
    const rows = w.ships.slice().sort((a, z) => (a.date || '').localeCompare(z.date || '') || (a.po || '').localeCompare(z.po || ''))
    return h('div', { style: { border: '1px solid var(--c-border)', borderRadius: '12px', overflow: 'hidden' } }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--c-surface-2)', color: 'var(--c-text)', fontWeight: 600, fontSize: '12px' } }, ['本周发货', h('span', { style: { color: 'var(--c-text-faint)' } }, w.ships.length + ' 批 · ' + fmtNum(w.outQty) + ' 台')]),
      h('div', { style: { maxHeight: '200px', overflowY: 'auto' } }, h('table.sw', [h('thead', h('tr', [h('th', 'PO #'), h('th', 'SKU'), h('th.num', 'Qty'), h('th', '发货日')])), h('tbody', rows.length ? rows.map(s => h('tr', [h('td.mono', s.po || '—'), h('td', [h('span.mono', s.sku), h('span', { style: { color: '#9ca3af', marginLeft: '4px', fontSize: '11px' } }, s.ka || '')]), h('td.num', fmtNum(s.qty)), h('td', [s.date, s.delivered ? h('span', { style: { color: '#059669', marginLeft: '4px' }, title: '已送达' }, '✓') : null])])) : [h('tr', h('td', { colspan: 4, style: { padding: '16px', textAlign: 'center', color: '#9ca3af' } }, '本周没有发货'))])]))])
  }

  // ═══ Modals ═══
  function openAddPo() {
    const o = S.overlay('modal', { title: 'Add PO manually' })
    o.body.append(h('div', { style: { color: '#6b7280', fontSize: '13px' } }, '手动新建 PO（落入 New PO，核对后 Confirm 进入待发）。一张 PO 可含多个 SKU。'),
      h('div.faint', { style: { fontSize: '12px', marginTop: '10px' } }, '（演示：完整录入表单在真实 ERP 中，含 国家/渠道/SKU 自动带出 FD 出货价）'))
    o.foot.append(h('button.btn.b-grey', { onclick: o.close }, 'Cancel'), h('button.btn.b-indigo', { onclick: () => { o.close(); S.toast('Create PO · demo') } }, 'Create PO'))
  }
  function openBulkShip(g) {
    const o = S.overlay('modal', { title: '◑ 选择发货 · ' + (g.po_number || '') })
    const picks = {}
    const rem = l => l.qty - (l.delivered_qty || 0)
    const dateI = h('input.lg-date', { type: 'date', max: today(), value: today() })
    const rowsEl = g.lines.map(l => { const r = rem(l); const qi = h('input.lg-date', { type: 'number', min: 0, max: r, value: r > 0 ? r : 0, disabled: r <= 0 ? true : null, style: { width: '70px', textAlign: 'right' }, oninput: e => { picks[l.id] = Math.min(Math.max(0, Math.floor(+e.target.value || 0)), r) } }); if (r > 0) picks[l.id] = r
      return h('tr', { style: { opacity: r <= 0 ? .4 : 1 } }, [h('td.mono', l.sku_code), h('td', { style: { color: '#6b7280' } }, l.sku_name), h('td.num', fmtNum(l.qty)), h('td.num', r <= 0 ? '已发完' : fmtNum(r)), h('td.num', qi)]) })
    o.body.append(h('div', { style: { color: '#6b7280', fontSize: '12px', marginBottom: '10px' } }, '勾选要发的 SKU 并填数量（可只发一部分）。发满剩余量的行归 Shipped，未发满的进 Partial 继续跟。'),
      h('div.tbl-wrap', h('table.sw', [h('thead', h('tr', [h('th', 'SKU'), h('th', 'Product'), h('th.num', 'Ordered'), h('th.num', 'Remaining'), h('th.num', 'Ship qty')])), h('tbody', rowsEl)])))
    o.foot.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' } }, ['发货日 ', dateI]),
      h('button.btn.b-grey', { onclick: o.close }, 'Cancel'),
      h('button.btn.b-green', { onclick: () => { const b = g.lines.map(l => ({ po_id: l.id, qty: picks[l.id] || 0, ship_date: dateI.value || today() })).filter(x => x.qty > 0); if (!b.length) { alert('请至少勾选一个 SKU 并填写发货数量。'); return } addBatches(b); o.close() } }, '确认发货'))
  }

  // ═══ 发货操作台 · cross-PO batch shipping console ═══
  function openShipConsole() {
    const o = S.overlay('modal', { title: '发货操作台 · 选择要发货的 PO（可跨 PO、可分批）' })
    o.panel.style.width = '1120px'; o.panel.style.maxWidth = '96vw'; o.panel.style.maxHeight = '90vh'
    const rem = l => l.qty - (l.delivered_qty || 0)
    const CC = [...new Set(ROWS.map(l => l.country_code).filter(Boolean))].sort()
    const cs = { q: '', country: 'all', sel: {}, qtys: {}, date: today() }
    ROWS.forEach(l => { if (cs.qtys[l.id] == null) cs.qtys[l.id] = rem(l) })
    const shipRows = () => ROWS.filter(l => { const s = stageOf(l); if (!(s === 'new' || s === 'toship' || s === 'partial')) return false; if (rem(l) <= 0) return false; if (cs.country !== 'all' && l.country_code !== cs.country) return false; const q = cs.q.trim().toLowerCase(); return !q || ((l.po_number || '') + ' ' + l.sku_code + ' ' + (l.ka_name || '') + ' ' + l.sku_name).toLowerCase().includes(q) })

    const summaryEl = h('span', { style: { fontSize: '12px', color: 'var(--c-text-dim)', fontWeight: 600 } })
    const confirmBtn = h('button.btn.b-green')
    function refreshSummary() {
      const ids = Object.keys(cs.sel).filter(k => cs.sel[k])
      const pos = new Set(ids.map(id => (ROWS.find(r => r.id === +id) || {}).po_number))
      const units = ids.reduce((s, id) => s + (cs.qtys[id] || 0), 0)
      summaryEl.textContent = `已选 ${ids.length} 个 SKU · 跨 ${pos.size} 个 PO · 共 ${fmtNum(units)} 件`
      confirmBtn.textContent = `确认发货 (${ids.length})`; confirmBtn.disabled = ids.length === 0
    }
    const tableWrap = h('div', { style: { overflow: 'auto', maxHeight: '52vh', border: '1px solid var(--c-border)', borderRadius: '10px' } })
    function drawTable() {
      const rows = shipRows(); const byPo = {}
      rows.forEach(l => { const k = l.po_number || ('id:' + l.id); (byPo[k] = byPo[k] || []).push(l) })
      const tb = h('tbody')
      Object.entries(byPo).forEach(([po, lines]) => {
        const allSel = lines.every(l => cs.sel[l.id])
        const poCk = h('input', { type: 'checkbox', checked: allSel, onchange: e => { lines.forEach(l => cs.sel[l.id] = e.target.checked); drawTable(); refreshSummary() } })
        tb.append(h('tr', { style: { background: 'var(--c-surface-2)' } }, [h('td', poCk), h('td', { colspan: 7 }, [h('span.mono', { style: { fontWeight: 700 } }, po.startsWith('id:') ? '（无 PO #）' : po), ' ', h('span.pill', lines[0].country_code), ' ', h('span.pill', lines[0].ka_name || '-'), h('span', { style: { marginLeft: '8px', color: 'var(--c-text-faint)', fontSize: '11px' } }, `${lines.length} SKU · 剩余合计 ${fmtNum(lines.reduce((s, l) => s + rem(l), 0))}`)])]))
        lines.forEach(l => {
          const ck = h('input', { type: 'checkbox', checked: !!cs.sel[l.id], onchange: e => { cs.sel[l.id] = e.target.checked; refreshSummary() } })
          const qi = h('input.lg-date', { type: 'number', min: 0, max: rem(l), value: cs.qtys[l.id], style: { width: '82px', textAlign: 'right' }, oninput: e => { cs.qtys[l.id] = Math.min(Math.max(0, Math.floor(+e.target.value || 0)), rem(l)); if (cs.sel[l.id]) refreshSummary() } })
          const partial = cs.qtys[l.id] > 0 && cs.qtys[l.id] < rem(l)
          tb.append(h('tr', [h('td', ck), h('td.mono', l.sku_code), h('td', { style: { color: 'var(--c-text-dim)' } }, l.sku_name), h('td.num', fmtNum(l.qty)), h('td.num', fmtNum(l.delivered_qty || 0)), h('td.num', { style: { fontWeight: 700 } }, fmtNum(rem(l))), h('td', h('span.pill', STAGES[stageOf(l)].label)), h('td', [qi, partial ? h('span', { style: { marginLeft: '6px', fontSize: '10px', color: 'var(--c-warn)' } }, '分批') : null])]))
        })
      })
      if (!rows.length) tb.append(h('tr', h('td', { colspan: 8, style: { padding: '40px', textAlign: 'center', color: 'var(--c-text-faint)' } }, '没有待发货的 PO')))
      tableWrap.replaceChildren(h('table.sw', [h('thead', h('tr', [h('th', { style: { width: '30px' } }), h('th', 'SKU'), h('th', '产品'), h('th.num', '订单量'), h('th.num', '已发'), h('th.num', '剩余'), h('th', '当前状态'), h('th', '本次发货')])), tb]))
    }
    const searchI = h('input.lg-date', { placeholder: '搜索 PO / SKU / 渠道', style: { width: '220px' }, oninput: e => { cs.q = e.target.value; drawTable() } })
    const cSel = h('select.lg-date', { onchange: e => { cs.country = e.target.value; drawTable() } }, [h('option', { value: 'all' }, '全部国家')].concat(CC.map(c => h('option', { value: c }, c))))
    o.body.append(h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' } }, [searchI, cSel, h('span', { style: { color: 'var(--c-text-faint)', fontSize: '12px' } }, '勾选要发的 SKU，可跨多个 PO 一起发；每行数量可小于剩余量即为分批'), h('span.grow'), summaryEl]), tableWrap)
    drawTable(); refreshSummary()
    const dateI = h('input.lg-date', { type: 'date', max: today(), value: cs.date, onchange: e => cs.date = e.target.value })
    confirmBtn.onclick = () => {
      const ids = Object.keys(cs.sel).filter(k => cs.sel[k])
      const b = ids.map(id => ({ po_id: +id, qty: cs.qtys[id] || 0, ship_date: cs.date })).filter(x => x.qty > 0)
      if (!b.length) { alert('请勾选要发货的 SKU 并填写数量。'); return }
      const pos = new Set(b.map(x => (ROWS.find(r => r.id === x.po_id) || {}).po_number))
      addBatches(b); o.close(); S.toast(`已发货 ${b.length} 行，跨 ${pos.size} 个 PO`)
    }
    o.foot.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' } }, ['发货日期', dateI]), h('button.btn.b-grey', { onclick: o.close }, '取消'), confirmBtn)
  }

  window.Modules = window.Modules || {}
  window.Modules.shipment = { render }
})()

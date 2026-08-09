/* Shipment Summary — market, period, PO and batch fulfilment overview. */
(function () {
  'use strict'
  const h = S.h
  const store = window.ShipmentStore
  if (!store) return

  const rows = store.rows
  const batches = store.batches
  let ROOT
  let st

  const fmt = S.fmtNum
  const lower = value => String(value || '').toLowerCase()
  const unique = values => [...new Set(values.filter(Boolean))].sort()
  const sum = (items, fn) => items.reduce((total, item) => total + Number(fn(item) || 0), 0)
  const today = '2026-08-08'

  function init() {
    st = {
      grain: 'quarter', period: '2026-Q3', market: 'all', customer: 'all', status: 'all',
      basis: 'ship', query: '', detail: 'po', open: {}, showAll: false, navigationContext: null, contextOpened: false,
    }
  }

  function isoWeek(dateString) {
    if (!dateString) return ''
    const d = new Date(dateString + 'T00:00:00Z')
    const day = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() - day + 3)
    const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
    const week = 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
    return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0')
  }

  function periodOptions(grain) {
    if (grain === 'week') return ['2026-W32', '2026-W31', '2026-W30', '2026-W29', '2026-W28']
    if (grain === 'month') return ['2026-08', '2026-07', '2026-06', '2026-05']
    if (grain === 'year') return ['2026', '2025']
    return ['2026-Q3', '2026-Q2', '2026-Q1', '2025-Q4']
  }

  function periodText(value) {
    if (/-W/.test(value)) return value.replace('-', ' · ')
    if (/Q/.test(value)) return value.slice(0, 4) + '年 ' + value.slice(5)
    if (value.length === 7) return value.slice(0, 4) + '年' + Number(value.slice(5)) + '月'
    return value + '年'
  }

  function matchesPeriod(dateString) {
    if (!dateString) return false
    if (st.grain === 'week') return isoWeek(dateString) === st.period
    if (st.grain === 'month') return dateString.slice(0, 7) === st.period
    if (st.grain === 'year') return dateString.slice(0, 4) === st.period
    const month = Number(dateString.slice(5, 7))
    const quarter = Math.ceil(month / 3)
    return dateString.slice(0, 4) + '-Q' + quarter === st.period
  }

  function batchGroupsFor(lines) {
    const ids = new Set(lines.map(line => line.id))
    const grouped = {}
    batches.filter(batch => ids.has(batch.po_id)).forEach(batch => {
      const key = batch.batch_ref || ('DATE-' + (batch.ship_date || batch.id))
      const group = grouped[key] || (grouped[key] = { key, rows: [], qty: 0, shipDate: '', deliveryDate: '', eta: '', warehouse: '', mode: '', carrier: '', tracking: '', invoice: '', notes: '' })
      group.rows.push(batch)
      group.qty += Number(batch.qty) || 0
      group.shipDate = group.shipDate || batch.ship_date || ''
      if (batch.delivery_date > group.deliveryDate) group.deliveryDate = batch.delivery_date
      if (batch.eta > group.eta) group.eta = batch.eta
      group.warehouse = group.warehouse || batch.warehouse || ''
      group.mode = group.mode || batch.transport_mode || ''
      group.carrier = group.carrier || batch.carrier || ''
      group.tracking = group.tracking || batch.tracking_number || ''
      group.invoice = group.invoice || batch.invoice_number || ''
      group.notes = group.notes || batch.notes || ''
    })
    return Object.values(grouped).sort((a, b) => (a.shipDate || '').localeCompare(b.shipDate || ''))
  }

  function buildGroups() {
    const grouped = {}
    rows.forEach(line => {
      const key = line.po_number ? 'po:' + line.po_number : 'line:' + line.id
      const group = grouped[key] || (grouped[key] = { key, poNumber: line.po_number || '未编号PO', lines: [], country: line.country_code || '—', customer: line.ka_name || '—' })
      group.lines.push(line)
    })
    return Object.values(grouped).map(group => {
      const groupBatches = batchGroupsFor(group.lines)
      group.ordered = sum(group.lines, line => line.qty)
      group.shipped = sum(groupBatches, batch => batch.qty)
      group.delivered = sum(groupBatches.filter(batch => batch.deliveryDate), batch => batch.qty)
      group.remaining = Math.max(0, group.ordered - group.shipped)
      group.batchGroups = groupBatches
      group.batchCount = groupBatches.length
      group.poDate = group.lines.map(line => line.po_date).filter(Boolean).sort()[0] || ''
      group.firstShip = groupBatches.map(batch => batch.shipDate).filter(Boolean).sort()[0] || ''
      group.lastShip = groupBatches.map(batch => batch.shipDate).filter(Boolean).sort().slice(-1)[0] || ''
      group.lastDelivery = groupBatches.map(batch => batch.deliveryDate).filter(Boolean).sort().slice(-1)[0] || ''
      group.plan = store.plans.find(plan => plan.po_number === group.poNumber && plan.status === 'open') || null
      group.amount = sum(group.lines, line => line.turnover)
      group.currency = group.lines[0] && group.lines[0].currency || 'EUR'
      const allCancelled = group.lines.every(line => line.po_status === 'cancelled')
      const allDelivered = group.shipped >= group.ordered && groupBatches.length && groupBatches.every(batch => batch.deliveryDate)
      group.status = allCancelled ? 'cancelled' : allDelivered ? 'delivered' : group.shipped >= group.ordered ? 'shipped' : group.shipped > 0 ? 'partial' : group.lines.every(line => line.po_status === 'new') ? 'new' : 'toship'
      group.nextShip = group.plan && group.plan.next_ship_date || ''
      group.filterDate = st.basis === 'po' ? group.poDate : st.basis === 'delivery' ? (group.lastDelivery || group.lastShip || group.poDate) : (group.lastShip || group.poDate)
      return group
    })
  }

  function filteredGroups() {
    const q = lower(st.query).trim()
    return buildGroups().filter(group => {
      if (!matchesPeriod(group.filterDate)) return false
      if (st.market !== 'all' && group.country !== st.market) return false
      if (st.customer !== 'all' && group.customer !== st.customer) return false
      if (st.status !== 'all' && group.status !== st.status) return false
      if (q && !lower(group.poNumber + ' ' + group.country + ' ' + group.customer + ' ' + group.lines.map(line => line.sku_code + ' ' + line.sku_name).join(' ')).includes(q)) return false
      return true
    }).sort((a, b) => {
      const riskA = a.plan ? 1 : 0, riskB = b.plan ? 1 : 0
      return riskB - riskA || (a.nextShip || '9999').localeCompare(b.nextShip || '9999') || (b.poDate || '').localeCompare(a.poDate || '')
    })
  }

  function filteredPlans(groups) {
    const keys = new Set(groups.map(group => group.poNumber))
    return store.plans.filter(plan => plan.status === 'open' && keys.has(plan.po_number)).sort((a, b) => (a.next_ship_date || '').localeCompare(b.next_ship_date || ''))
  }

  function setGrain(value) {
    st.grain = value
    st.period = periodOptions(value)[0]
    paint()
  }

  function periodFromMonths(months) {
    const values = (months || []).filter(Boolean).sort()
    if (!values.length) return null
    if (values.length >= 10) return { grain: 'year', period: values[0].slice(0, 4) }
    const firstMonth = Number(values[0].slice(5, 7))
    const sameQuarter = values.every(value => value.slice(0, 4) === values[0].slice(0, 4) && Math.ceil(Number(value.slice(5, 7)) / 3) === Math.ceil(firstMonth / 3))
    if (values.length >= 3 && sameQuarter) return { grain: 'quarter', period: values[0].slice(0, 4) + '-Q' + Math.ceil(firstMonth / 3) }
    return { grain: 'month', period: values[0].slice(0, 7) }
  }

  function applyNavigationContext(context) {
    const markets = unique(rows.map(row => row.country_code))
    st.market = context.market === 'ALL' || !markets.includes(context.market) ? 'all' : context.market
    st.customer = 'all'
    st.query = context.sku || context.product || ''
    st.detail = context.detail === 'exception' ? 'exception' : 'po'
    st.status = 'all'
    st.showAll = true
    st.contextOpened = false
    const period = periodFromMonths(context.months)
    if (period && periodOptions(period.grain).includes(period.period)) {
      st.grain = period.grain
      st.period = period.period
    }
  }

  function lineMatchesContext(line, context) {
    const sku = lower(context && context.sku).trim()
    const product = lower(context && context.product).trim()
    if (sku) return lower(line.sku_code).trim() === sku
    return product ? lower(line.sku_name).trim() === product : false
  }

  function navigationMatchInfo(groups) {
    const context = st.navigationContext
    if (!context) return null
    const market = context.market === 'ALL' ? 'all' : context.market
    const exactGroups = buildGroups().filter(group => {
      if (market !== 'all' && group.country !== market) return false
      return group.lines.some(line => lineMatchesContext(line, context))
    })
    const visibleGroups = groups.filter(group => group.lines.some(line => lineMatchesContext(line, context)))
    const visibleLines = sum(visibleGroups, group => group.lines.filter(line => lineMatchesContext(line, context)).length)
    const status = visibleGroups.length ? 'matched' : exactGroups.length ? 'period' : 'mapping'
    return { status, exactGroups, visibleGroups, visibleLines }
  }

  function navigationContextBand(matchInfo) {
    const context = st.navigationContext
    if (!context) return null
    const market = context.market === 'ALL' ? '全部市场' : context.market
    const detail = [market, context.category, context.sku, context.product].filter(Boolean).join(' · ')
    const statusText = matchInfo.status === 'matched'
      ? '已匹配' + matchInfo.visibleGroups.length + '个PO · ' + matchInfo.visibleLines + '条SKU明细，批次已展开'
      : matchInfo.status === 'period'
        ? periodText(st.period) + '无对应PO；其他期间有' + matchInfo.exactGroups.length + '个PO'
        : '物流数据未识别到' + (context.sku || context.product || '该产品') + '，未替换为其他产品'
    return h('section.ss-navigation-context', [
      h('span.ss-context-copy', [h('strong', '已从BP达成定位有效PO'), detail]),
      h('span.ss-context-match-status.' + matchInfo.status, statusText),
      h('button.btn.sm', { onclick: () => { st.navigationContext = null; st.contextOpened = false; st.query = ''; paint() } }, '清除定位'),
    ])
  }

  function render(root) {
    ROOT = root
    if (!st) init()
    const navigationContext = S.consumeNavigationContext('shipmentSummary')
    st.navigationContext = navigationContext
    if (navigationContext) applyNavigationContext(navigationContext)
    paint()
  }

  function paint() {
    S.clear(ROOT)
    const groups = filteredGroups()
    const matchInfo = navigationMatchInfo(groups)
    if (matchInfo && !st.contextOpened) {
      matchInfo.visibleGroups.slice(0, 6).forEach(group => { st.open[group.key] = true })
      st.contextOpened = true
    }
    const plans = filteredPlans(groups)
    ROOT.append(header())
    const contextBand = navigationContextBand(matchInfo)
    if (contextBand) ROOT.append(contextBand)
    ROOT.append(filters(), metrics(groups, plans), overview(groups, plans), details(groups, plans))
  }

  function header() {
    return S.pageHeader({
      overline: (window.ROUTES && ROUTES.shipmentSummary && ROUTES.shipmentSummary.overline) || 'SHIPMENT OVERVIEW',
      title: '发货汇总',
      pill: { text: '全部市场权限', color: 'var(--c-success)' },
      actions: [
        h('button.btn', { onclick: () => S.toast('发货汇总明细已导出 · 本地测试') }, '导出明细'),
        h('button.btn.primary', { onclick: () => document.querySelector('[data-logistics-view="shipment"]').click() }, '进入发货操作'),
      ],
    })
  }

  function field(label, control) { return h('label.ss-field', [h('span', label), control]) }
  function option(value, label, selected) { return h('option', { value, selected: selected ? true : null }, label) }

  function filters() {
    const markets = unique(rows.map(row => row.country_code))
    const customers = unique(rows.filter(row => st.market === 'all' || row.country_code === st.market).map(row => row.ka_name))
    const periodSelect = h('select', { 'aria-label': '统计周期', onchange: event => { st.period = event.target.value; paint() } }, periodOptions(st.grain).map(value => option(value, periodText(value), st.period === value)))
    const marketSelect = h('select', { 'aria-label': '市场', onchange: event => { st.market = event.target.value; st.customer = 'all'; paint() } }, [option('all', '全部可见市场 · ' + markets.length, st.market === 'all')].concat(markets.map(value => option(value, value, st.market === value))))
    const customerSelect = h('select', { 'aria-label': 'FD或客户', onchange: event => { st.customer = event.target.value; paint() } }, [option('all', '全部FD / 客户', st.customer === 'all')].concat(customers.map(value => option(value, value, st.customer === value))))
    const basisSelect = h('select', { 'aria-label': '统计口径', onchange: event => { st.basis = event.target.value; paint() } }, [option('ship', '实际发货日期', st.basis === 'ship'), option('po', 'PO日期', st.basis === 'po'), option('delivery', '实际送达日期', st.basis === 'delivery')])
    const statusSelect = h('select', { 'aria-label': '履约状态', onchange: event => { st.status = event.target.value; paint() } }, [option('all', '全部状态', st.status === 'all'), option('toship', '待发货', st.status === 'toship'), option('partial', '部分发货', st.status === 'partial'), option('shipped', '已发货', st.status === 'shipped'), option('delivered', '已送达', st.status === 'delivered'), option('cancelled', '已取消', st.status === 'cancelled')])
    const search = h('input', { type: 'search', 'aria-label': '搜索PO或SKU', placeholder: '搜索PO、SKU或产品', value: st.query, oninput: event => { st.query = event.target.value; paint(); const input = document.querySelector('.ss-search'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length) } } })
    search.classList.add('ss-search')
    const grain = h('div.ss-grain', ['week', 'month', 'quarter', 'year'].map(value => h('button', { class: st.grain === value ? 'active' : '', onclick: () => setGrain(value) }, ({ week: '周', month: '月', quarter: '季', year: '年' })[value])))
    return h('section.ss-filterbar', [field('时间维度', grain), field('统计周期', periodSelect), field('市场', marketSelect), field('FD / 客户', customerSelect), field('统计口径', basisSelect), field('PO / SKU', search), field('状态', statusSelect)])
  }

  function metrics(groups, plans) {
    const ordered = sum(groups, group => group.ordered)
    const shipped = sum(groups, group => group.shipped)
    const delivered = sum(groups, group => group.delivered)
    const remaining = sum(groups, group => group.remaining)
    const completed = groups.filter(group => group.status === 'shipped' || group.status === 'delivered').length
    const onTime = groups.length ? Math.max(0, Math.round((groups.length - plans.length) / groups.length * 1000) / 10) : 0
    const tile = (label, value, hint, tone) => h('div.ss-metric', [h('span', label), h('strong', { class: tone || '' }, value), h('small', hint)])
    return h('section.ss-metrics', [
      tile('PO订货量', fmt(ordered), groups.length + '个PO'),
      tile('本期已发货', fmt(shipped), '履约率 ' + (ordered ? (shipped / ordered * 100).toFixed(1) : '0.0') + '%', 'good'),
      tile('已送达', fmt(delivered), completed + '个PO已结清'),
      tile('待发数量', fmt(remaining), groups.filter(group => group.remaining > 0).length + '个PO未发满'),
      tile('准时发货率', onTime.toFixed(1) + '%', '按当前计划日期', onTime < 90 ? 'warn' : 'good'),
      tile('延期 / 阻塞', String(plans.length), '影响 ' + fmt(sum(plans, plan => plan.impact_qty)) + ' 件', plans.length ? 'danger' : 'good'),
    ])
  }

  function marketStats(groups) {
    const result = {}
    groups.forEach(group => {
      const item = result[group.country] || (result[group.country] = { market: group.country, ordered: 0, shipped: 0, delivered: 0, remaining: 0, pos: 0, risks: 0 })
      item.ordered += group.ordered; item.shipped += group.shipped; item.delivered += group.delivered; item.remaining += group.remaining; item.pos += 1; if (group.plan) item.risks += 1
    })
    return Object.values(result).sort((a, b) => b.shipped - a.shipped || a.market.localeCompare(b.market))
  }

  function overview(groups, plans) {
    const markets = marketStats(groups)
    const max = Math.max(1, ...markets.map(item => item.ordered))
    const bars = markets.length ? markets.map(item => h('button.ss-market-row', { onclick: () => { st.market = item.market; st.detail = 'market'; paint() } }, [
      h('strong', item.market),
      h('div.ss-market-bars', [h('span.shipped', { style: { width: Math.max(2, item.shipped / max * 100) + '%' } }), h('span.remaining', { style: { width: Math.max(0, item.remaining / max * 100) + '%' } })]),
      h('span.ss-market-value', fmt(item.shipped) + ' / ' + fmt(item.remaining)),
      h('small', item.pos + ' PO' + (item.risks ? ' · ' + item.risks + '异常' : '')),
    ])) : [h('div.ss-empty', '当前筛选范围暂无发货数据')]
    const exceptionRows = plans.slice(0, 4).map(plan => h('button.ss-exception', { onclick: () => { st.detail = 'exception'; st.query = plan.po_number; paint() } }, [
      h('span.ss-signal', { class: plan.reason_category === '质量' || plan.reason_category === '研发' ? 'danger' : 'warn' }),
      h('span', [h('strong', plan.po_number + ' · ' + plan.reason_category), h('small', plan.reason + ' · ' + plan.owner)]),
      h('time', { class: plan.next_ship_date < today ? 'danger' : '' }, plan.next_ship_date ? Number(plan.next_ship_date.slice(5, 7)) + '月' + Number(plan.next_ship_date.slice(8, 10)) + '日' : '待确认'),
    ]))
    return h('section.ss-overview', [
      h('div.ss-panel', [h('div.ss-panel-head', [h('strong', '各市场发货情况'), h('span', '已发货 / 待发 · ' + periodText(st.period))]), h('div.ss-market-chart', bars), h('div.ss-legend', [h('span', [h('i.shipped'), '已发货']), h('span', [h('i.remaining'), '待发'])])]),
      h('div.ss-panel', [h('div.ss-panel-head', [h('strong', '履约异常'), h('span', plans.length + '项需处理')]), h('div.ss-exception-list', exceptionRows.length ? exceptionRows : h('div.ss-empty', '当前没有延期或阻塞'))]),
    ])
  }

  function detailTabs() {
    const tabs = [{ value: 'market', label: '市场汇总' }, { value: 'po', label: 'PO履约' }, { value: 'exception', label: '延期与异常' }]
    return h('div.ss-detail-tabs', tabs.map(tab => h('button', { class: st.detail === tab.value ? 'active' : '', onclick: () => { st.detail = tab.value; st.query = ''; paint() } }, tab.label)))
  }

  function details(groups, plans) {
    const content = st.detail === 'market' ? marketTable(groups) : st.detail === 'exception' ? exceptionTable(plans) : poTable(groups)
    return h('section.ss-panel.ss-detail', [detailTabs(), content])
  }

  function marketTable(groups) {
    const body = marketStats(groups).map(item => h('tr', [h('td', h('strong', item.market)), h('td.num', fmt(item.pos)), h('td.num', fmt(item.ordered)), h('td.num', fmt(item.shipped)), h('td.num', fmt(item.delivered)), h('td.num', { class: item.remaining ? 'danger' : '' }, fmt(item.remaining)), h('td.num', (item.ordered ? item.shipped / item.ordered * 100 : 0).toFixed(1) + '%'), h('td.num', item.risks ? h('span.ss-badge.danger', item.risks + '项') : h('span.ss-badge.good', '正常'))]))
    return tableWrap(['市场', 'PO数', '订货量', '已发货', '已送达', '待发', '发货履约率', '异常'], body, '暂无市场数据')
  }

  function statusBadge(status) {
    const meta = { new: ['gray', 'New PO'], toship: ['gray', '待发货'], partial: ['warn', '部分发货'], shipped: ['blue', '已发货'], delivered: ['good', '已送达'], cancelled: ['danger', '已取消'] }[status] || ['gray', status]
    return h('span.ss-badge.' + meta[0], meta[1])
  }

  function poTable(groups) {
    const shown = st.showAll ? groups : groups.slice(0, 16)
    const body = []
    shown.forEach(group => {
      body.push(h('tr.ss-po-row', { onclick: () => { st.open[group.key] = !st.open[group.key]; paint() } }, [
        h('td', h('strong', (st.open[group.key] ? '▾ ' : '▸ ') + group.poNumber)), h('td', group.country), h('td', group.customer), h('td.num', fmt(group.ordered)), h('td.num', fmt(group.shipped)), h('td.num', fmt(group.delivered)), h('td.num', { class: group.remaining ? 'danger' : '' }, fmt(group.remaining)), h('td', group.batchCount + (group.remaining ? ' / +' : '')), h('td', group.nextShip || '—'), h('td', statusBadge(group.status)), h('td', group.plan ? h('span.ss-risk-text', group.plan.reason_category + ' · ' + group.plan.owner) : '—'),
      ]))
      if (st.open[group.key]) body.push(h('tr.ss-expanded', h('td', { colspan: 11 }, batchDetail(group))))
    })
    const wrap = tableWrap(['PO', '市场', 'FD / 客户', '订货量', '已发货', '已送达', '待发', '批次', '下一发货', '状态', '风险 / 责任人'], body, '当前筛选范围暂无PO')
    if (groups.length > 16) wrap.append(h('div.ss-table-foot', [h('span', '显示 ' + shown.length + ' / ' + groups.length + ' 个PO'), h('button.btn.sm', { onclick: () => { st.showAll = !st.showAll; paint() } }, st.showAll ? '收起' : '查看全部')]))
    return wrap
  }

  function batchDetail(group) {
    const items = group.batchGroups.map((batch, index) => {
      const delivered = !!batch.deliveryDate
      return h('div.ss-batch', { class: delivered ? 'done' : '' }, [
        h('div.ss-batch-head', [h('strong', '批次 ' + (batch.key.indexOf('INIT-') === 0 ? String(index + 1).padStart(2, '0') : batch.key)), h('span.ss-badge.' + (delivered ? 'good' : 'blue'), delivered ? '已送达' : '运输中')]),
        h('div.ss-batch-meta', [h('span', fmt(batch.qty) + '件'), h('span', '发货 ' + (batch.shipDate || '—')), h('span', delivered ? '送达 ' + batch.deliveryDate : 'ETA ' + (batch.eta || '待确认'))]),
        batch.tracking || batch.invoice ? h('small', [batch.tracking ? 'Tracking ' + batch.tracking : '', batch.tracking && batch.invoice ? ' · ' : '', batch.invoice ? 'Invoice ' + batch.invoice : '']) : null,
      ])
    })
    if (group.plan) items.push(h('div.ss-batch.plan', [
      h('div.ss-batch-head', [h('strong', '计划批次'), h('span.ss-badge.danger', '延期 / 阻塞')]),
      h('div.ss-batch-meta', [h('span', fmt(group.plan.impact_qty) + '件'), h('span', '原计划 ' + group.plan.original_ship_date), h('span', '新计划 ' + group.plan.next_ship_date)]),
      h('small.ss-risk-text', group.plan.reason_category + '：' + group.plan.reason + ' · ' + group.plan.owner),
    ]))
    if (!items.length) items.push(h('div.ss-empty', '尚未建立发货批次'))
    return h('div.ss-batch-grid', items)
  }

  function exceptionTable(plans) {
    const body = plans.map(plan => {
      const group = buildGroups().find(item => item.poNumber === plan.po_number)
      return h('tr', [h('td', h('strong', plan.po_number)), h('td', plan.country_code || '—'), h('td', plan.reason_category), h('td', plan.reason), h('td.num', fmt(plan.impact_qty)), h('td', plan.owner || '待分配'), h('td', plan.original_ship_date || '—'), h('td', { class: plan.next_ship_date < today ? 'danger' : '' }, plan.next_ship_date || '待确认'), h('td', group ? statusBadge(group.status) : '—'), h('td', h('button.btn.sm', { onclick: () => openHistory(plan) }, '查看记录'))])
    })
    return tableWrap(['PO', '市场', '原因分类', '原因说明', '影响数量', '负责人', '原计划', '新计划', 'PO状态', '历史'], body, '当前没有延期或阻塞')
  }

  function openHistory(plan) {
    const overlay = S.overlay('modal', { title: plan.po_number + ' · 延期与计划变更记录' })
    overlay.panel.style.width = '720px'
    const rows = (plan.history || []).map(item => h('tr', [h('td', item.at.slice(0, 16).replace('T', ' ')), h('td', item.action), h('td', item.from || '—'), h('td', item.to || '—'), h('td', item.reason || '—')]))
    overlay.body.append(tableWrap(['时间', '动作', '原计划', '新计划', '原因'], rows, '暂无历史记录'))
    overlay.foot.append(h('button.btn.primary', { onclick: overlay.close }, '关闭'))
  }

  function tableWrap(headers, body, emptyText) {
    const rowBody = body.length ? body : [h('tr', h('td.ss-empty', { colspan: headers.length }, emptyText))]
    return h('div.ss-table-wrap', h('table.ss-table', [h('thead', h('tr', headers.map((header, index) => h('th', { class: index >= 3 && index <= 7 ? 'num' : '' }, header)))), h('tbody', rowBody)]))
  }

  window.Modules = window.Modules || {}
  window.Modules.shipmentSummary = { render }
})()

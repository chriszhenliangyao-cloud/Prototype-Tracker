/* ============================================================================
   Demand Forecast — market panorama entry + GTM review + accuracy scorecard.
   The local test keeps DATA as its read-only source and persists the working
   draft in localStorage. Channel ownership is derived from KA parent/fd data.
   ============================================================================ */
(function () {
  const h = S.h
  const STORAGE_KEY = 'operationsForecastPanorama.v1'
  const REVIEW_TABS = [
    { v: 'overview', label: '总览' },
    { v: 'matrix', label: '渠道×产品' },
    { v: 'channel', label: 'FD与渠道' },
    { v: 'product', label: '产品' },
    { v: 'risk', label: '变动与风险' },
  ]
  const LIFECYCLE = {
    active: '在售', npi: '新品', launched: '已上市', eol: 'EOL', inactive: '停用',
  }

  let ROOT = null
  let st = null
  let saveTimer = null
  let reviewKeyboardBound = false

  function init() {
    const runs = (DATA.forecast_run || []).slice().sort((a, b) => a.period_start < b.period_start ? 1 : -1)
    const countries = (DATA.country || [])
      .filter(c => c.is_active && c.region === 'EU')
      .sort((a, b) => a.sort_order - b.sort_order)
    const defaultCountry = countries.find(c => c.code === 'FR') || countries[0]
    st = {
      runs,
      countries,
      runId: runs[0] ? runs[0].id : null,
      countryId: defaultCountry ? defaultCountry.id : null,
      view: 'entry',
      reviewTab: 'matrix',
      search: '',
      category: 'all',
      lifecycle: 'all',
      onlyChanged: false,
      showAllProducts: false,
      matrixMonthly: true,
      matrixOnlyChanged: false,
      matrixOnlyRisk: false,
      matrixShowAllProducts: false,
      matrixShowEmptyChannels: false,
      expandedFds: {},
      expandedRetailers: {},
      selectedRow: null,
      cells: {},
      baseline: {},
      dirty: {},
      notes: {},
      reviewComment: '',
      scoreFd: 'all',
      scoreSku: 'all',
      scoreOnlyExceptions: false,
      scoreView: 'overview',
      scoreQuarter: '2026-Q3',
      scoreNotes: {},
      navigationContext: null,
      lastSaved: null,
    }
    seedCells()
    loadDraft()
  }

  function run() { return st.runs.find(r => r.id === st.runId) }
  function previousRun() {
    const idx = st.runs.findIndex(r => r.id === st.runId)
    return idx >= 0 ? st.runs[idx + 1] : null
  }
  function isAllMarkets() { return st.countryId === 'all' }
  function country() { return isAllMarkets() ? null : st.countries.find(c => c.id === st.countryId) }
  function marketLabel() { return isAllMarkets() ? '全部可见市场' : ((country() ? country().name_zh : '') + '市场') }
  function months() {
    const r = run()
    if (!r) return []
    const count = Math.min(Number(r.month_count) || 3, 3)
    return Array.from({ length: count }, (_, i) => S.addMonths(r.period_start, i))
  }
  function cellKey(skuId, kaId, month) { return skuId + '|' + kaId + '|' + month }
  function rowKey(skuId, kaId) { return skuId + '|' + kaId }
  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key) }
  function qty(skuId, kaId, month) {
    const k = cellKey(skuId, kaId, month)
    return hasOwn(st.cells, k) ? Number(st.cells[k]) : null
  }
  function baselineQty(skuId, kaId, month) {
    const k = cellKey(skuId, kaId, month)
    return hasOwn(st.baseline, k) ? Number(st.baseline[k]) : null
  }

  function seedCells() {
    st.cells = {}
    st.baseline = {}
    st.dirty = {}
    const prev = previousRun()
    for (const cell of (DATA.forecast_cell || [])) {
      const month = (cell.month || '').slice(0, 10)
      const k = cellKey(cell.sku_id, cell.ka_id, month)
      if (cell.run_id === st.runId) st.cells[k] = Number(cell.qty) || 0
      if (prev && cell.run_id === prev.id) st.baseline[k] = Number(cell.qty) || 0
    }
  }

  function draftId() { return String(st.runId || 'none') }
  function loadDraft() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      const saved = all[draftId()]
      if (!saved) return
      st.cells = Object.assign(st.cells, saved.cells || {})
      st.dirty = Object.assign({}, saved.dirty || {})
      st.notes = Object.assign({}, saved.notes || {})
      st.reviewComment = saved.reviewComment || ''
      st.scoreNotes = Object.assign({}, saved.scoreNotes || {})
      st.lastSaved = saved.updatedAt || null
    } catch (error) { /* invalid local draft is ignored */ }
  }
  function persistDraft() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      const updatedAt = new Date().toISOString()
      all[draftId()] = {
        cells: st.cells,
        dirty: st.dirty,
        notes: st.notes,
        reviewComment: st.reviewComment,
        scoreNotes: st.scoreNotes,
        updatedAt,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      st.lastSaved = updatedAt
      updateSaveState('已自动保存 ' + timeText(updatedAt), 'saved')
    } catch (error) {
      updateSaveState('本地保存失败', 'error')
    }
  }
  function scheduleSave() {
    updateSaveState('正在保存…', 'saving')
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persistDraft, 360)
  }
  function timeText(iso) {
    if (!iso) return '--:--'
    const date = new Date(iso)
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
  }
  function updateSaveState(text, state) {
    document.querySelectorAll('[data-forecast-save-state]').forEach(el => {
      el.textContent = text
      el.dataset.state = state || ''
    })
  }

  function activeSkus() {
    return (DATA.sku || [])
      .filter(s => s.is_active)
      .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
  }
  function activeKas(countryId) {
    const scopeId = countryId == null ? st.countryId : countryId
    return (DATA.ka || [])
      .filter(ka => ka.country_id === scopeId && ka.is_active && ka.ka_type !== 'group')
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
  }
  function distributorFor(retailer, distributors) {
    if (retailer.parent_ka_id) {
      const parent = distributors.find(fd => fd.id === retailer.parent_ka_id)
      if (parent) return parent
    }
    if (retailer.fd) {
      const byCode = distributors.find(fd => fd.fd === retailer.fd || fd.name === retailer.fd)
      if (byCode) return byCode
      return { id: 'fd-' + retailer.fd, name: retailer.fd, fd: retailer.fd, synthetic: true, sort_order: 900 }
    }
    return { id: 'direct', name: 'Direct / 未配置FD', fd: null, synthetic: true, sort_order: 999 }
  }
  function hierarchy(countryId) {
    const scopeId = countryId == null ? st.countryId : countryId
    if (scopeId === 'all') return []
    const kas = activeKas(scopeId)
    const distributors = kas.filter(ka => ka.ka_type === 'distributor')
    const retailers = kas.filter(ka => ka.ka_type !== 'distributor')
    const byFd = new Map()
    const ensure = fd => {
      const id = String(fd.id)
      if (!byFd.has(id)) byFd.set(id, { id, fd, channels: [] })
      return byFd.get(id)
    }
    distributors.forEach(fd => ensure(fd))
    retailers.forEach(retailer => ensure(distributorFor(retailer, distributors)).channels.push(retailer))
    distributors.forEach(fd => {
      const hasOwnForecast = months().some(month => activeSkus().some(sku => qty(sku.id, fd.id, month) != null))
      if (hasOwnForecast || ensure(fd).channels.length === 0) {
        ensure(fd).channels.unshift(Object.assign({}, fd, { selfChannel: true, name: fd.name + ' 自营' }))
      }
    })
    return Array.from(byFd.values())
      .filter(group => group.channels.length)
      .sort((a, b) => (a.fd.sort_order || 999) - (b.fd.sort_order || 999) || a.fd.name.localeCompare(b.fd.name))
  }

  function rowHasData(sku, ka) {
    return months().some(month => qty(sku.id, ka.id, month) != null || baselineQty(sku.id, ka.id, month) != null)
  }
  function rowChanged(sku, ka) {
    return months().some(month => {
      const current = qty(sku.id, ka.id, month)
      const before = baselineQty(sku.id, ka.id, month)
      return current !== before && !(current == null && before == null)
    })
  }
  function matchesFilters(sku, ka, fd) {
    if (st.category !== 'all' && sku.category !== st.category) return false
    if (st.lifecycle !== 'all' && sku.lifecycle !== st.lifecycle) return false
    if (st.onlyChanged && !rowChanged(sku, ka)) return false
    if (!st.showAllProducts && !rowHasData(sku, ka)) return false
    const needle = st.search.trim().toLowerCase()
    if (!needle) return true
    return [fd.name, fd.fd, ka.name, ka.fd, sku.code, sku.name, sku.category]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(needle))
  }
  function skusForChannel(ka, fd) {
    return activeSkus().filter(sku => matchesFilters(sku, ka, fd))
  }
  function categories() {
    return Array.from(new Set(activeSkus().map(sku => sku.category).filter(Boolean))).sort()
  }

  function scopeRowsForCountry(countryId) {
    const rows = []
    const market = st.countries.find(item => item.id === countryId)
    hierarchy(countryId).forEach(group => group.channels.forEach(ka => {
      skusForChannel(ka, group.fd).forEach(sku => rows.push({ group, ka, sku, country: market }))
    }))
    return rows
  }
  function scopeRows() {
    if (isAllMarkets()) return st.countries.flatMap(item => scopeRowsForCountry(item.id))
    return scopeRowsForCountry(st.countryId)
  }
  function rowMonthTotal(skuId, kaId, month) {
    const value = qty(skuId, kaId, month)
    return value == null ? 0 : value
  }
  function rowsTotal(rows, month) {
    return rows.reduce((sum, row) => sum + rowMonthTotal(row.sku.id, row.ka.id, month), 0)
  }
  function rowsBaseline(rows, month) {
    return rows.reduce((sum, row) => sum + (baselineQty(row.sku.id, row.ka.id, month) || 0), 0)
  }
  function percentage(current, before) {
    if (!before) return current ? 100 : 0
    return (current - before) / before * 100
  }
  function varianceText(value) {
    const rounded = Math.round(value * 10) / 10
    return (rounded > 0 ? '+' : '') + rounded.toFixed(1) + '%'
  }
  function varianceClass(value) {
    if (value >= 10 || value <= -10) return 'forecast-variance high'
    if (value >= 5 || value <= -5) return 'forecast-variance watch'
    return 'forecast-variance calm'
  }

  function setQty(skuId, kaId, month, raw, input) {
    const k = cellKey(skuId, kaId, month)
    const clean = String(raw).replace(/[^\d]/g, '')
    if (clean === '') delete st.cells[k]
    else st.cells[k] = Math.max(0, parseInt(clean, 10) || 0)
    st.dirty[k] = true
    input.value = clean
    input.closest('.forecast-input-wrap').classList.add('is-edited')
    scheduleSave()
    refreshLiveNumbers()
  }
  function refreshLiveNumbers() {
    const rows = scopeRows()
    const monthList = months()
    document.querySelectorAll('[data-row-total]').forEach(el => {
      const parts = el.dataset.rowTotal.split('|')
      const total = monthList.reduce((sum, month) => sum + rowMonthTotal(Number(parts[0]), Number(parts[1]), month), 0)
      el.textContent = S.fmtNum(total)
    })
    document.querySelectorAll('[data-scope-total]').forEach(el => {
      const type = el.dataset.scopeType
      const id = el.dataset.scopeId
      const month = el.dataset.month
      const subset = rows.filter(row => type === 'fd' ? row.group.id === id : String(row.ka.id) === id)
      const total = month === 'all'
        ? monthList.reduce((sum, item) => sum + rowsTotal(subset, item), 0)
        : rowsTotal(subset, month)
      el.textContent = S.fmtNum(total)
    })
    const current = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = monthList.reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
    document.querySelectorAll('[data-country-total]').forEach(el => { el.textContent = S.fmtNum(current) })
    document.querySelectorAll('[data-country-variance]').forEach(el => {
      el.textContent = varianceText(percentage(current, before))
      el.className = varianceClass(percentage(current, before))
    })
  }

  function render(root) {
    ROOT = root
    if (!st) init()
    const navigationContext = S.consumeNavigationContext('forecast')
    st.navigationContext = navigationContext
    if (navigationContext) applyNavigationContext(navigationContext)
    bindReviewKeyboard()
    paint()
  }
  function applyNavigationContext(context) {
    const market = st.countries.find(item => item.code === context.market)
    st.countryId = context.market === 'ALL' || !context.market ? 'all' : market ? market.id : st.countryId
    st.view = context.view === 'review' ? 'review' : 'entry'
    st.reviewTab = 'product'
    st.search = context.sku || context.product || ''
    st.category = categories().includes(context.category) ? context.category : 'all'
    st.showAllProducts = true
    st.onlyChanged = false
    st.selectedRow = null
  }
  function navigationContextBand() {
    const context = st.navigationContext
    if (!context) return null
    const market = context.market === 'ALL' ? '全部市场' : context.market
    const detail = [market, context.category, context.sku, context.product].filter(Boolean).join(' · ')
    return h('div.forecast-navigation-context', [
      h('span', [h('strong', '已从BP达成定位'), detail]),
      h('button.btn.sm', { onclick: () => { st.navigationContext = null; st.search = ''; st.category = 'all'; paint() } }, '清除定位'),
    ])
  }
  function paint() {
    if (!document.fullscreenElement) document.documentElement.classList.remove('forecast-review-fullscreen')
    S.clear(ROOT)
    const workspace = h('div.forecast-workspace')
    workspace.append(pageHeader(), workspaceBar())
    const contextBand = navigationContextBand()
    if (contextBand) workspace.append(contextBand)
    if (st.view === 'entry') workspace.append(entryView())
    else if (st.view === 'review') workspace.append(reviewView())
    else workspace.append(scorecardView())
    ROOT.append(workspace)
    const chip = document.getElementById('scope-chip')
    if (chip) chip.textContent = country() ? country().code : 'EU'
  }

  function pageHeader() {
    const current = run()
    const prev = previousRun()
    return S.pageHeader({
      overline: (window.ROUTES && ROUTES.forecast.overline) || '计划与交付 · FORECAST MANAGEMENT',
      title: '预测管理',
      pill: {
        text: st.view === 'scorecard'
          ? ((current && current.status === 'published' ? '正式发布 · ' : '当前版本 · ') + (current ? current.code : '无版本'))
          : current === st.runs[0] ? 'v5草稿 · 基于' + (prev ? S.ym(prev.period_start) : '上月') + '版本' : '历史版本 · 只读',
        color: st.view === 'scorecard' && current && current.status === 'published'
          ? 'var(--c-success)'
          : current === st.runs[0] ? 'var(--c-primary)' : 'var(--c-text-faint)',
      },
      actions: [
        h('button.btn', { onclick: () => S.toast('已生成三个月预测模板') }, '导出模板'),
        h('button.btn', { onclick: () => S.toast('导入校验通过 · 本地测试') }, '批量导入'),
        h('button.btn.primary', { onclick: openCreateModal }, '发起新周期'),
      ],
    })
  }

  function workspaceBar() {
    const runSelect = h('select', {
      class: 'forecast-compact-select',
      ariaLabel: '预测周期',
      onchange: event => {
        st.runId = Number(event.target.value)
        seedCells()
        loadDraft()
        st.selectedRow = null
        st.scoreFd = 'all'
        st.scoreSku = 'all'
        paint()
      },
    }, st.runs.map(item => h('option', {
      value: item.id,
      selected: item.id === st.runId,
    }, S.ym(item.period_start) + '–' + S.ym(item.period_end))))

    const countrySelect = h('select', {
      class: 'forecast-compact-select',
      ariaLabel: '市场',
      onchange: event => {
        st.countryId = event.target.value === 'all' ? 'all' : Number(event.target.value)
        st.selectedRow = null
        st.scoreFd = 'all'
        paint()
      },
    }, [h('option', {
      value: 'all',
      selected: isAllMarkets(),
    }, '全部可见市场 · ' + st.countries.length)].concat(st.countries.map(item => h('option', {
      value: item.id,
      selected: item.id === st.countryId,
    }, item.code + ' · ' + item.name_zh))))

    const tabs = h('div.forecast-view-tabs', { role: 'tablist', ariaLabel: '预测管理视图' }, [
      h('button', {
        type: 'button', role: 'tab', ariaSelected: st.view === 'entry',
        class: st.view === 'entry' ? 'active' : '',
        onclick: () => { st.view = 'entry'; paint() },
      }, '市场全景填报'),
      h('button', {
        type: 'button', role: 'tab', ariaSelected: st.view === 'review',
        class: st.view === 'review' ? 'active' : '',
        onclick: () => {
          st.view = 'review'
          paint()
        },
      }, 'GTM评审'),
      h('button', {
        type: 'button', role: 'tab', ariaSelected: st.view === 'scorecard',
        class: st.view === 'scorecard' ? 'active' : '',
        onclick: () => {
          st.view = 'scorecard'
          paint()
        },
      }, '预测评分卡'),
    ])

    return h('div.forecast-workspace-bar', [
      tabs,
      st.view === 'scorecard' ? null : h('span.forecast-workspace-divider'),
      st.view === 'scorecard' ? null : h('label.forecast-inline-control', [h('span', '预测周期'), runSelect]),
      st.view === 'scorecard' ? null : h('label.forecast-inline-control', [h('span', '市场'), countrySelect]),
      h('span.grow'),
      h('span.forecast-cycle-status', [
        h('span.sync-dot'),
        st.view === 'entry' ? '销售填报中' : st.view === 'review' ? '销售已提交 · GTM待复核' : '评分口径 · 有效PO',
      ]),
    ])
  }

  function entryView() {
    if (isAllMarkets()) return allMarketsEntryView()
    const rows = scopeRows()
    const monthList = months()
    const total = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = monthList.reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
    const fdCount = hierarchy().filter(group => group.channels.some(ka => skusForChannel(ka, group.fd).length)).length
    const channelCount = new Set(rows.map(row => row.ka.id)).size
    const skuCount = new Set(rows.map(row => row.sku.id)).size
    const missing = rows.reduce((sum, row) => sum + monthList.filter(month => qty(row.sku.id, row.ka.id, month) == null).length, 0)
    const changed = rows.filter(row => rowChanged(row.sku, row.ka)).length

    return h('div', [
      entryToolbar(),
      h('div.forecast-summary-strip', [
        metric('三个月预测', h('span', { dataset: { countryTotal: '1' } }, S.fmtNum(total)), '件'),
        metric('较上月版本', h('span', { class: varianceClass(percentage(total, before)), dataset: { countryVariance: '1' } }, varianceText(percentage(total, before))), '同口径'),
        metric('覆盖范围', fdCount + ' FD / ' + channelCount + ' Retailer', skuCount + ' SKU'),
        metric('未填写', String(missing), '单元格', 'warn'),
        metric('变动与异常', String(changed), 'SKU', changed ? 'danger' : ''),
      ]),
      panoramaTable(),
      entryFooter(missing),
    ])
  }

  function allMarketsEntryView() {
    const rows = scopeRows()
    const monthList = months()
    const total = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = monthList.reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
    const marketData = marketSummaryData()
    const fdCount = new Set(rows.map(row => row.country.id + '|' + row.group.id)).size
    const channelCount = new Set(rows.map(row => row.ka.id)).size
    const skuCount = new Set(rows.map(row => row.sku.id)).size
    const changed = rows.filter(row => rowChanged(row.sku, row.ka)).length

    return h('div', [
      entryToolbar(),
      h('div.forecast-access-scope', [
        h('div', [h('strong', '全部可见市场汇总'), h('span', '按当前账号权限汇总 ' + st.countries.length + ' 个市场')]),
        h('span.grow'),
        S.badge('blue', '只读协调视图'),
        h('span', '市场级预测仍由对应销售人员填报'),
      ]),
      h('div.forecast-summary-strip', [
        metric('三个月预测', S.fmtNum(total), '件'),
        metric('较上月版本', h('span', { class: varianceClass(percentage(total, before)) }, varianceText(percentage(total, before))), '同口径'),
        metric('覆盖范围', st.countries.length + ' 市场 / ' + fdCount + ' FD', channelCount + ' Retailer · ' + skuCount + ' SKU'),
        metric('待协调市场', String(marketData.filter(item => Math.abs(item.variance) >= 10).length), '个', 'warn'),
        metric('变动与异常', String(changed), '渠道产品组合', changed ? 'danger' : ''),
      ]),
      h('div.forecast-all-market-grid', [
        h('section.card.forecast-all-market-panel', [
          h('div.forecast-section-head', [h('h3', '市场预测汇总'), h('span', '点击市场进入填报或评审')]),
          allMarketsTable(marketData),
        ]),
        h('section.card.forecast-all-market-panel', [
          h('div.forecast-section-head', [h('h3', '产品跨市场需求'), h('span', '用于供应统筹')]),
          allMarketProductTable(rows),
        ]),
      ]),
      h('div.forecast-readonly-actions', [
        h('span', '汇总口径：当前周期 · 当前账号可见市场 · 仅统计有预测或上版数据的组合'),
        h('span.grow'),
        h('button.btn', { onclick: () => S.toast('已导出跨市场汇总 · 本地测试') }, '导出汇总'),
        h('button.btn', { onclick: () => S.toast('供应协调摘要已生成 · 本地测试') }, '生成供应协调摘要'),
        h('button.btn.primary', { onclick: () => { st.view = 'review'; st.reviewTab = 'overview'; paint() } }, '进入区域评审'),
      ]),
    ])
  }

  function marketSummaryData() {
    return st.countries.map(item => {
      const rows = scopeRowsForCountry(item.id)
      const current = months().reduce((sum, month) => sum + rowsTotal(rows, month), 0)
      const before = months().reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
      return {
        country: item,
        rows,
        months: months().map(month => rowsTotal(rows, month)),
        current,
        before,
        variance: percentage(current, before),
        fdCount: new Set(rows.map(row => row.group.id)).size,
        channelCount: new Set(rows.map(row => row.ka.id)).size,
        skuCount: new Set(rows.map(row => row.sku.id)).size,
      }
    }).sort((a, b) => b.current - a.current)
  }

  function allMarketsTable(data) {
    return h('div.forecast-all-market-table-wrap', h('table.forecast-all-market-table', [
      h('thead', h('tr', [
        h('th', '市场'), ...months().map(month => h('th.num', S.monthLabel(S.ym(month)))),
        h('th.num', '三个月合计'), h('th.num', '较上版'), h('th', '覆盖'), h('th', '操作'),
      ])),
      h('tbody', data.map(item => h('tr', [
        h('td', [h('strong', item.country.code + ' · ' + item.country.name_zh), h('small', item.fdCount + ' FD · ' + item.channelCount + '渠道')]),
        ...item.months.map(value => h('td.num', S.fmtNum(value))),
        h('td.num.strong', S.fmtNum(item.current)),
        h('td.num', varianceNode(item.variance)),
        h('td', item.skuCount + ' SKU'),
        h('td', h('button.btn.sm', { onclick: () => { st.countryId = item.country.id; paint() } }, '进入市场')),
      ]))),
    ]))
  }

  function allMarketProductTable(rows) {
    const data = productStats(rows).slice(0, 12)
    return h('div.forecast-all-market-table-wrap', h('table.forecast-all-market-table', [
      h('thead', h('tr', [h('th', '产品'), ...months().map(month => h('th.num', S.monthLabel(S.ym(month)))), h('th.num', '合计'), h('th.num', '较上版')])),
      h('tbody', data.map(item => {
        const productRows = rows.filter(row => row.sku.id === item.sku.id)
        return h('tr', [
          h('td', [h('strong', item.sku.code), h('small', item.sku.name)]),
          ...months().map(month => h('td.num', S.fmtNum(rowsTotal(productRows, month)))),
          h('td.num.strong', S.fmtNum(item.current)),
          h('td.num', varianceNode(item.variance)),
        ])
      })),
    ]))
  }

  function metric(label, value, sub, tone) {
    return h('div.forecast-metric' + (tone ? '.' + tone : ''), [
      h('span.forecast-metric-label', label),
      h('strong.forecast-metric-value', value),
      h('span.forecast-metric-sub', sub),
    ])
  }

  function entryToolbar() {
    const search = h('input', {
      type: 'search',
      value: st.search,
      placeholder: '搜索FD、Retailer或SKU',
      ariaLabel: '搜索FD、Retailer或SKU',
      oninput: event => {
        st.search = event.target.value
        clearTimeout(event.target._paintTimer)
        event.target._paintTimer = setTimeout(() => {
          paint()
          const next = document.querySelector('.forecast-search input')
          if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length) }
        }, 220)
      },
    })
    const category = h('select', {
      ariaLabel: '品类',
      onchange: event => { st.category = event.target.value; paint() },
    }, [h('option', { value: 'all' }, '全部品类')].concat(categories().map(item => h('option', {
      value: item, selected: st.category === item,
    }, item))))
    const lifecycle = h('select', {
      ariaLabel: '生命周期',
      onchange: event => { st.lifecycle = event.target.value; paint() },
    }, [h('option', { value: 'all' }, '全部生命周期')].concat(Object.keys(LIFECYCLE).map(value => h('option', {
      value, selected: st.lifecycle === value,
    }, LIFECYCLE[value]))))

    return h('div.forecast-entry-toolbar', [
      h('label.forecast-search', [h('span', isAllMarkets() ? '产品 / 渠道' : '项目 / 渠道'), search]),
      h('label.forecast-filter', [h('span', '品类'), category]),
      h('label.forecast-filter', [h('span', '生命周期'), lifecycle]),
      h('span.grow'),
      S.toggle(st.showAllProducts, '显示全部产品', value => { st.showAllProducts = value; paint() }),
      S.toggle(st.onlyChanged, '仅看变更', value => { st.onlyChanged = value; paint() }),
      isAllMarkets()
        ? h('span.forecast-permission-note', '权限范围：' + st.countries.map(item => item.code).join(' / '))
        : h('button.btn.sm', { onclick: toggleAllGroups }, allGroupsExpanded() ? '全部收起' : '全部展开'),
    ])
  }

  function allGroupsExpanded() {
    return hierarchy().every(group => st.expandedFds[group.id] !== false && group.channels.every(ka => st.expandedRetailers[String(ka.id)] !== false))
  }
  function toggleAllGroups() {
    const collapse = allGroupsExpanded()
    hierarchy().forEach(group => {
      st.expandedFds[group.id] = !collapse
      group.channels.forEach(ka => { st.expandedRetailers[String(ka.id)] = !collapse })
    })
    paint()
  }

  function panoramaTable() {
    const monthList = months()
    const body = h('tbody')
    let visibleRows = 0

    hierarchy().forEach(group => {
      const groupRows = []
      group.channels.forEach(ka => {
        skusForChannel(ka, group.fd).forEach(sku => groupRows.push({ group, ka, sku }))
      })
      if (!groupRows.length) return
      const fdOpen = st.expandedFds[group.id] !== false
      body.append(summaryRow('fd', group.id, group.fd.name, groupRows, fdOpen, () => {
        st.expandedFds[group.id] = !fdOpen
        paint()
      }))
      if (!fdOpen) return

      group.channels.forEach(ka => {
        const channelRows = skusForChannel(ka, group.fd).map(sku => ({ group, ka, sku }))
        if (!channelRows.length) return
        const channelOpen = st.expandedRetailers[String(ka.id)] !== false
        body.append(summaryRow('retailer', String(ka.id), ka.name, channelRows, channelOpen, () => {
          st.expandedRetailers[String(ka.id)] = !channelOpen
          paint()
        }))
        if (!channelOpen) return
        channelRows.forEach(row => {
          body.append(productRow(row))
          visibleRows += 1
          if (st.selectedRow === rowKey(row.sku.id, row.ka.id)) body.append(detailRow(row))
        })
      })
    })

    if (!visibleRows) body.append(h('tr', h('td.forecast-empty', { colspan: 8 }, '当前筛选范围没有可显示的预测行。')))
    else body.append(countryTotalRow())

    const head = h('thead', h('tr', [
      h('th.forecast-col-channel', 'FD / Retailer'),
      h('th.forecast-col-product', '型号 / 产品'),
      ...monthList.map(month => h('th.num.forecast-col-month', [
        h('span', S.monthLabel(S.ym(month)) + ' ' + month.slice(0, 4)),
        h('small', '预测数量'),
      ])),
      h('th.num.forecast-col-total', '三个月合计'),
      h('th.num.forecast-col-variance', '较上月'),
      h('th.forecast-col-status', '填报状态'),
    ]))
    return h('div.card.forecast-table-card', [
      h('div.forecast-table-note', [
        h('strong', (country() ? country().name_zh : '') + '渠道供货关系'),
        h('span', '按 FD → Retailer → SKU 连续录入；小计随输入实时更新。'),
        h('span.grow'),
        h('span.forecast-legend.changed', '蓝框：已修改'),
        h('span.forecast-legend.missing', '浅黄：待填写'),
        h('span.forecast-legend.risk', '红色：高变动'),
      ]),
      h('div.forecast-table-scroll', h('table.tbl.forecast-panorama-table', [head, body])),
    ])
  }

  function summaryRow(type, id, name, rows, open, onToggle) {
    const monthList = months()
    const current = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = monthList.reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
    const variance = percentage(current, before)
    const missing = rows.reduce((sum, row) => sum + monthList.filter(month => qty(row.sku.id, row.ka.id, month) == null).length, 0)
    return h('tr', { class: 'forecast-group-row ' + type }, [
      h('td.forecast-hierarchy-cell', [
        h('button.forecast-disclosure', { type: 'button', ariaExpanded: open, onclick: onToggle }, open ? '▾' : '▸'),
        h('strong', name),
        h('span.forecast-group-kind', type === 'fd' ? 'FD' : 'Retailer'),
      ]),
      h('td.forecast-group-meta', rows.length + ' 个产品'),
      ...monthList.map(month => h('td.num', {
        dataset: { scopeTotal: '1', scopeType: type, scopeId: id, month },
      }, S.fmtNum(rowsTotal(rows, month)))),
      h('td.num.strong', {
        dataset: { scopeTotal: '1', scopeType: type, scopeId: id, month: 'all' },
      }, S.fmtNum(current)),
      h('td.num', h('span', { class: varianceClass(variance) }, varianceText(variance))),
      h('td', missing ? S.badge('amber', '待填 ' + missing) : S.badge('green', '已完成')),
    ])
  }

  function productRow(row) {
    const monthList = months()
    const current = monthList.reduce((sum, month) => sum + rowMonthTotal(row.sku.id, row.ka.id, month), 0)
    const before = monthList.reduce((sum, month) => sum + (baselineQty(row.sku.id, row.ka.id, month) || 0), 0)
    const variance = percentage(current, before)
    const missing = monthList.filter(month => qty(row.sku.id, row.ka.id, month) == null).length
    const rk = rowKey(row.sku.id, row.ka.id)
    return h('tr.forecast-product-row' + (st.selectedRow === rk ? '.selected' : ''), [
      h('td.forecast-retailer-rail', [
        h('span.forecast-ownership-line'),
        h('span', row.ka.selfChannel ? 'FD自营' : row.ka.name),
      ]),
      h('td.forecast-product-cell', h('button.forecast-product-button', {
        type: 'button',
        onclick: () => { st.selectedRow = st.selectedRow === rk ? null : rk; paint() },
      }, [
        h('strong', row.sku.code),
        h('span', row.sku.name || '—'),
        h('small', (LIFECYCLE[row.sku.lifecycle] || row.sku.lifecycle || '—') + ' · ' + (row.sku.category || '—')),
      ])),
      ...monthList.map(month => inputCell(row, month)),
      h('td.num.strong', { dataset: { rowTotal: rk } }, S.fmtNum(current)),
      h('td.num', [
        h('span', { class: varianceClass(variance) }, varianceText(variance)),
        Math.abs(variance) >= 10 ? h('span.forecast-alert-mark', '▲') : null,
      ]),
      h('td', missing
        ? S.badge('amber', '待填 ' + missing)
        : rowChanged(row.sku, row.ka) ? S.badge('blue', '已修改') : S.badge('green', '已完成')),
    ])
  }

  function inputCell(row, month) {
    const value = qty(row.sku.id, row.ka.id, month)
    const before = baselineQty(row.sku.id, row.ka.id, month)
    const k = cellKey(row.sku.id, row.ka.id, month)
    const changed = value !== before && !(value == null && before == null)
    const classes = ['forecast-input-wrap']
    if (value == null) classes.push('is-missing')
    if (changed) classes.push('is-changed')
    if (st.dirty[k]) classes.push('is-edited')
    return h('td.num.forecast-input-cell', h('div', { class: classes.join(' ') }, [
      h('input', {
        type: 'text', inputmode: 'numeric', value: value == null ? '' : value,
        ariaLabel: row.sku.code + ' ' + S.monthLabel(S.ym(month)) + '预测',
        oninput: event => setQty(row.sku.id, row.ka.id, month, event.target.value, event.target),
        onkeydown: event => {
          if (event.key === 'Enter') focusNextForecastInput(event.target)
        },
      }),
      changed && before != null ? h('small.forecast-before', '上版 ' + S.fmtNum(before)) : null,
    ]))
  }
  function focusNextForecastInput(current) {
    const inputs = Array.from(document.querySelectorAll('.forecast-panorama-table input'))
    const index = inputs.indexOf(current)
    if (index >= 0 && inputs[index + 1]) inputs[index + 1].focus()
  }

  function detailRow(row) {
    const rk = rowKey(row.sku.id, row.ka.id)
    const saved = st.notes[rk] || {}
    const reason = h('select', {
      onchange: event => {
        st.notes[rk] = Object.assign({}, st.notes[rk], { reason: event.target.value })
        scheduleSave()
      },
    }, ['促销调整', '客户需求变化', '新品上市', '供应限制', '渠道调整', '其他'].map(value => h('option', {
      value, selected: (saved.reason || '促销调整') === value,
    }, value)))
    const note = h('input', {
      type: 'text', value: saved.note || '', placeholder: '说明本次预测变化及评审要点',
      oninput: event => {
        st.notes[rk] = Object.assign({}, st.notes[rk], { note: event.target.value })
        scheduleSave()
      },
    })
    return h('tr.forecast-detail-row', h('td', { colspan: 8 }, h('div.forecast-detail-grid', [
      h('label', [h('span', '变更原因'), reason]),
      h('label', [h('span', '关联促销'), h('input', { type: 'text', value: saved.promotion || 'Back to School 8–9月', oninput: event => {
        st.notes[rk] = Object.assign({}, st.notes[rk], { promotion: event.target.value }); scheduleSave()
      } })]),
      h('label', [h('span', '项目阶段'), h('input', { type: 'text', value: LIFECYCLE[row.sku.lifecycle] || row.sku.lifecycle || '—', disabled: true })]),
      h('label.forecast-detail-note', [h('span', '销售说明'), note]),
    ])))
  }

  function countryTotalRow() {
    const rows = scopeRows()
    const monthList = months()
    const current = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = monthList.reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
    const variance = percentage(current, before)
    return h('tr.forecast-country-total', [
      h('td', { colspan: 2 }, (country() ? country().name_zh : '') + '市场合计'),
      ...monthList.map(month => h('td.num', S.fmtNum(rowsTotal(rows, month)))),
      h('td.num', { dataset: { countryTotal: '1' } }, S.fmtNum(current)),
      h('td.num', h('span', { class: varianceClass(variance), dataset: { countryVariance: '1' } }, varianceText(variance))),
      h('td', S.badge('blue', '销售草稿')),
    ])
  }

  function entryFooter(missing) {
    return h('div.forecast-sticky-actions', [
      h('span.forecast-save-state', { dataset: { forecastSaveState: '1', state: 'saved' } }, st.lastSaved ? '已自动保存 ' + timeText(st.lastSaved) : '自动保存已开启'),
      h('span', '已修改 ' + Object.keys(st.dirty).length + ' 项'),
      h('span', '未填写 ' + missing + ' 项'),
      h('span.grow'),
      h('button.btn', { onclick: persistDraft }, '保存草稿'),
      h('button.btn', { onclick: () => S.toast('已提交GTM复核 · 本地测试') }, '提交GTM复核'),
      h('button.btn.primary', { onclick: () => { st.view = 'review'; st.reviewTab = 'matrix'; paint() } }, '进入评审模式'),
    ])
  }

  // ── Rolling forecast accuracy scorecard ──────────────────────────────────
  // Retailer forecasts roll up to their supplying FD. Achievement uses the
  // current effective PO quantity; cancelled POs are excluded. Retailer rows
  // explain forecast composition only and are never scored as actuals.
  function poIsEffective(po) {
    const status = String(po.po_status || '').toLowerCase()
    const note = String(po.notes || '').toLowerCase()
    return status !== 'cancelled' && !note.includes('po cancelled')
  }

  function scoreCutoffDate() {
    return (DATA.channel_po || []).filter(poIsEffective).reduce((latest, po) => {
      const date = String(po.po_date || '').slice(0, 10)
      return date > latest ? date : latest
    }, '')
  }

  function scoreMonthStates() {
    const cutoff = scoreCutoffDate()
    const cutoffMonth = cutoff.slice(0, 7)
    return months().map(month => {
      const ym = S.ym(month)
      if (!cutoffMonth || ym > cutoffMonth) return 'pending'
      return ym === cutoffMonth ? 'active' : 'closed'
    })
  }

  function scoreFdGroup(countryId, kaId) {
    return hierarchy(countryId).find(group => String(group.fd.id) === String(kaId)
      || group.channels.some(channel => String(channel.id) === String(kaId))) || null
  }

  function buildScoreRows() {
    const monthList = months()
    const monthKeys = monthList.map(month => S.ym(month))
    const marketsById = new Map(st.countries.map(item => [item.id, item]))
    const kasById = new Map((DATA.ka || []).map(item => [item.id, item]))
    const skusById = new Map(activeSkus().map(item => [item.id, item]))
    const visibleCountries = new Set((isAllMarkets() ? st.countries : [country()]).filter(Boolean).map(item => item.id))
    const rows = new Map()

    const ensure = (market, group, sku) => {
      const key = market.id + '|' + group.id + '|' + sku.id
      if (!rows.has(key)) rows.set(key, {
        key,
        market,
        group,
        sku,
        forecast: monthList.map(() => 0),
        achieve: monthList.map(() => 0),
        retailers: new Map(),
        poLines: [],
      })
      return rows.get(key)
    }

    for (const cell of (DATA.forecast_cell || [])) {
      if (cell.run_id !== st.runId) continue
      const ka = kasById.get(cell.ka_id)
      const sku = skusById.get(cell.sku_id)
      if (!ka || !sku || !visibleCountries.has(ka.country_id)) continue
      const monthIndex = monthKeys.indexOf(String(cell.month || '').slice(0, 7))
      if (monthIndex < 0) continue
      const market = marketsById.get(ka.country_id)
      const group = scoreFdGroup(ka.country_id, ka.id)
      if (!market || !group) continue
      const row = ensure(market, group, sku)
      const value = Number(cell.qty) || 0
      row.forecast[monthIndex] += value
      const retailerKey = String(ka.id)
      if (!row.retailers.has(retailerKey)) row.retailers.set(retailerKey, {
        ka,
        values: monthList.map(() => 0),
      })
      row.retailers.get(retailerKey).values[monthIndex] += value
    }

    for (const po of (DATA.channel_po || [])) {
      if (!poIsEffective(po) || !visibleCountries.has(po.country_id)) continue
      const monthIndex = monthKeys.indexOf(String(po.po_date || '').slice(0, 7))
      if (monthIndex < 0) continue
      const market = marketsById.get(po.country_id)
      const ka = kasById.get(po.ka_id)
      const sku = skusById.get(po.sku_id)
      const group = ka ? scoreFdGroup(po.country_id, ka.id) : null
      if (!market || !ka || !sku || !group) continue
      const row = ensure(market, group, sku)
      const effectiveQty = Math.max(0, Number(po.qty_ordered) || 0)
      row.achieve[monthIndex] += effectiveQty
      row.poLines.push({ po, effectiveQty, monthIndex })
    }

    return Array.from(rows.values()).sort((a, b) => {
      return (a.market.sort_order - b.market.sort_order)
        || a.group.fd.name.localeCompare(b.group.fd.name)
        || (a.sku.sort_order - b.sku.sort_order)
        || a.sku.code.localeCompare(b.sku.code)
    })
  }

  function scoreAccuracy(forecastValues, achieveValues, indexes) {
    const use = indexes || forecastValues.map((_, index) => index)
    const forecast = use.reduce((sum, index) => sum + (Number(forecastValues[index]) || 0), 0)
    const achieve = use.reduce((sum, index) => sum + (Number(achieveValues[index]) || 0), 0)
    if (forecast <= 0 && achieve <= 0) return null
    if (forecast <= 0) return 0
    const error = use.reduce((sum, index) => sum + Math.abs((Number(achieveValues[index]) || 0) - (Number(forecastValues[index]) || 0)), 0)
    return Math.max(0, 100 - error / forecast * 100)
  }

  function scorePortfolioAccuracy(rows, indexes) {
    const use = indexes || months().map((_, index) => index)
    const forecast = rows.reduce((sum, row) => sum + use.reduce((monthSum, index) => monthSum + row.forecast[index], 0), 0)
    const achieve = rows.reduce((sum, row) => sum + use.reduce((monthSum, index) => monthSum + row.achieve[index], 0), 0)
    if (forecast <= 0 && achieve <= 0) return null
    if (forecast <= 0) return 0
    const error = rows.reduce((sum, row) => sum + use.reduce((monthSum, index) => {
      return monthSum + Math.abs(row.achieve[index] - row.forecast[index])
    }, 0), 0)
    return Math.max(0, 100 - error / forecast * 100)
  }

  function scoreAccuracyText(value) {
    if (value == null) return '待评估'
    return (Math.round(value * 10) / 10).toFixed(1) + '%'
  }

  function scoreTone(value) {
    if (value == null) return { kind: 'gray', label: '待评估', className: 'pending' }
    if (value >= 90) return { kind: 'green', label: '优秀', className: 'excellent' }
    if (value >= 80) return { kind: 'blue', label: '良好', className: 'good' }
    if (value >= 70) return { kind: 'amber', label: '关注', className: 'watch' }
    return { kind: 'red', label: '风险', className: 'risk' }
  }

  function scoreIndexes() {
    const states = scoreMonthStates()
    return states.map((state, index) => state === 'pending' ? null : index).filter(index => index != null)
  }

  function scoreRowSummary(row) {
    const indexes = scoreIndexes()
    const forecast = indexes.reduce((sum, index) => sum + row.forecast[index], 0)
    const achieve = indexes.reduce((sum, index) => sum + row.achieve[index], 0)
    const accuracy = scoreAccuracy(row.forecast, row.achieve, indexes)
    const unplanned = indexes.some(index => row.forecast[index] <= 0 && row.achieve[index] > 0)
    return {
      forecast,
      achieve,
      accuracy,
      deviation: achieve - forecast,
      unplanned,
      exception: unplanned || (accuracy != null && accuracy < 80),
    }
  }

  function scoreFilteredRows(allRows) {
    return allRows.filter(row => {
      const fdKey = row.market.id + '|' + row.group.id
      if (st.scoreFd !== 'all' && st.scoreFd !== fdKey) return false
      if (st.scoreSku !== 'all' && String(row.sku.id) !== String(st.scoreSku)) return false
      if (st.scoreOnlyExceptions && !scoreRowSummary(row).exception) return false
      return true
    })
  }

  const SCORE_HORIZONS = [
    { key: 'h1', lead: 1, label: 'H1 提前1个月', weight: 0.5 },
    { key: 'h2', lead: 2, label: 'H2 提前2个月', weight: 0.3 },
    { key: 'h3', lead: 3, label: 'H3 提前3个月', weight: 0.2 },
  ]

  function scoreQuarterMonths(quarterKey) {
    const match = String(quarterKey || '').match(/^(\d{4})-Q([1-4])$/)
    if (!match) return []
    const startMonth = (Number(match[2]) - 1) * 3 + 1
    return [0, 1, 2].map(offset => match[1] + '-' + String(startMonth + offset).padStart(2, '0') + '-01')
  }

  function scoreQuarterLabel(quarterKey) {
    return String(quarterKey || '').replace('-', ' ')
  }

  function scoreQuarterOptions() {
    const values = new Set()
    for (const cell of (DATA.forecast_cell || [])) {
      const date = String(cell.month || '').slice(0, 10)
      if (!date) continue
      const month = Number(date.slice(5, 7))
      values.add(date.slice(0, 4) + '-Q' + (Math.floor((month - 1) / 3) + 1))
    }
    values.add(st.scoreQuarter)
    return Array.from(values).sort().reverse()
  }

  function scorePreviousQuarter(quarterKey) {
    const match = String(quarterKey || '').match(/^(\d{4})-Q([1-4])$/)
    if (!match) return null
    const year = Number(match[1])
    const quarter = Number(match[2])
    return quarter === 1 ? (year - 1) + '-Q4' : year + '-Q' + (quarter - 1)
  }

  function scoreRunForLead(targetMonth, lead) {
    const sourceMonth = S.ym(S.addMonths(targetMonth, -lead))
    return st.runs.find(item => item.status === 'published' && S.ym(item.period_start) === sourceMonth) || null
  }

  function scoreQuarterMonthStates(quarterKey) {
    const cutoffMonth = scoreCutoffDate().slice(0, 7)
    return scoreQuarterMonths(quarterKey).map(month => {
      const ym = S.ym(month)
      if (!cutoffMonth || ym > cutoffMonth) return 'pending'
      return ym === cutoffMonth ? 'active' : 'closed'
    })
  }

  function scoreQuarterIndexes(quarterKey) {
    return scoreQuarterMonthStates(quarterKey)
      .map((state, index) => state === 'pending' ? null : index)
      .filter(index => index != null)
  }

  function scoreQuarterHorizonComplete(quarterKey, horizon, indexes) {
    const quarterMonths = scoreQuarterMonths(quarterKey)
    return indexes.every(index => Boolean(scoreRunForLead(quarterMonths[index], horizon.lead)))
  }

  function buildQuarterScoreRows(quarterKey) {
    const quarterMonths = scoreQuarterMonths(quarterKey)
    const monthKeys = quarterMonths.map(month => S.ym(month))
    const marketsById = new Map(st.countries.map(item => [item.id, item]))
    const kasById = new Map((DATA.ka || []).map(item => [item.id, item]))
    const skusById = new Map(activeSkus().map(item => [item.id, item]))
    const visibleCountries = new Set((isAllMarkets() ? st.countries : [country()]).filter(Boolean).map(item => item.id))
    const rows = new Map()

    const ensure = (market, group, sku) => {
      const key = market.id + '|' + group.id + '|' + sku.id
      if (!rows.has(key)) rows.set(key, {
        key,
        market,
        group,
        sku,
        h1: quarterMonths.map(() => 0),
        h2: quarterMonths.map(() => 0),
        h3: quarterMonths.map(() => 0),
        actual: quarterMonths.map(() => 0),
        poLines: [],
      })
      return rows.get(key)
    }

    SCORE_HORIZONS.forEach(horizon => {
      quarterMonths.forEach((targetMonth, monthIndex) => {
        const sourceRun = scoreRunForLead(targetMonth, horizon.lead)
        if (!sourceRun) return
        for (const cell of (DATA.forecast_cell || [])) {
          if (cell.run_id !== sourceRun.id || String(cell.month || '').slice(0, 7) !== monthKeys[monthIndex]) continue
          const ka = kasById.get(cell.ka_id)
          const sku = skusById.get(cell.sku_id)
          if (!ka || !sku || !visibleCountries.has(ka.country_id)) continue
          const market = marketsById.get(ka.country_id)
          const group = scoreFdGroup(ka.country_id, ka.id)
          if (!market || !group) continue
          ensure(market, group, sku)[horizon.key][monthIndex] += Number(cell.qty) || 0
        }
      })
    })

    for (const po of (DATA.channel_po || [])) {
      if (!poIsEffective(po) || !visibleCountries.has(po.country_id)) continue
      const monthIndex = monthKeys.indexOf(String(po.po_date || '').slice(0, 7))
      if (monthIndex < 0) continue
      const market = marketsById.get(po.country_id)
      const ka = kasById.get(po.ka_id)
      const sku = skusById.get(po.sku_id)
      const group = ka ? scoreFdGroup(po.country_id, ka.id) : null
      if (!market || !group || !sku) continue
      const row = ensure(market, group, sku)
      const effectiveQty = Math.max(0, Number(po.qty_ordered) || 0)
      row.actual[monthIndex] += effectiveQty
      row.poLines.push({ po, effectiveQty, monthIndex })
    }

    return Array.from(rows.values()).sort((a, b) => {
      return (a.market.sort_order - b.market.sort_order)
        || a.group.fd.name.localeCompare(b.group.fd.name)
        || (a.sku.sort_order - b.sku.sort_order)
        || a.sku.code.localeCompare(b.sku.code)
    })
  }

  function scoreSeriesPortfolioAccuracy(rows, seriesKey, indexes) {
    const forecast = rows.reduce((sum, row) => sum + indexes.reduce((monthSum, index) => monthSum + row[seriesKey][index], 0), 0)
    const actual = rows.reduce((sum, row) => sum + indexes.reduce((monthSum, index) => monthSum + row.actual[index], 0), 0)
    if (forecast <= 0 && actual <= 0) return null
    if (forecast <= 0) return 0
    const error = rows.reduce((sum, row) => sum + indexes.reduce((monthSum, index) => {
      return monthSum + Math.abs(row.actual[index] - row[seriesKey][index])
    }, 0), 0)
    return Math.max(0, 100 - error / forecast * 100)
  }

  function scoreWeightedAccuracy(scores, requireAll) {
    if (requireAll && SCORE_HORIZONS.some(horizon => scores[horizon.key] == null)) return null
    const available = SCORE_HORIZONS.filter(horizon => scores[horizon.key] != null)
    const totalWeight = available.reduce((sum, horizon) => sum + horizon.weight, 0)
    if (!totalWeight) return null
    return available.reduce((sum, horizon) => sum + scores[horizon.key] * horizon.weight, 0) / totalWeight
  }

  function scoreQuarterRowSummary(row, quarterKey) {
    const indexes = scoreQuarterIndexes(quarterKey)
    const scores = {}
    SCORE_HORIZONS.forEach(horizon => {
      scores[horizon.key] = scoreQuarterHorizonComplete(quarterKey, horizon, indexes)
        ? scoreAccuracy(row[horizon.key], row.actual, indexes)
        : null
    })
    const composite = scoreWeightedAccuracy(scores, false)
    const unplanned = indexes.some(index => row.h1[index] <= 0 && row.actual[index] > 0)
    return {
      scores,
      composite,
      actual: indexes.reduce((sum, index) => sum + row.actual[index], 0),
      unplanned,
      exception: unplanned || (composite != null && composite < 80),
    }
  }

  function scoreQuarterFilteredRows(allRows, quarterKey) {
    return allRows.filter(row => {
      const fdKey = row.market.id + '|' + row.group.id
      if (st.scoreFd !== 'all' && st.scoreFd !== fdKey) return false
      if (st.scoreSku !== 'all' && String(row.sku.id) !== String(st.scoreSku)) return false
      if (st.scoreOnlyExceptions && !scoreQuarterRowSummary(row, quarterKey).exception) return false
      return true
    })
  }

  function scoreQuarterSummary(rows, quarterKey) {
    const quarterMonths = scoreQuarterMonths(quarterKey)
    const states = scoreQuarterMonthStates(quarterKey)
    const indexes = scoreQuarterIndexes(quarterKey)
    const horizonScores = {}
    SCORE_HORIZONS.forEach(horizon => {
      horizonScores[horizon.key] = scoreQuarterHorizonComplete(quarterKey, horizon, indexes)
        ? scoreSeriesPortfolioAccuracy(rows, horizon.key, indexes)
        : null
    })
    const monthly = quarterMonths.map((month, index) => {
      const monthScores = {}
      SCORE_HORIZONS.forEach(horizon => {
        monthScores[horizon.key] = states[index] === 'pending' || !scoreRunForLead(month, horizon.lead)
          ? null
          : scoreSeriesPortfolioAccuracy(rows, horizon.key, [index])
      })
      return {
        month,
        state: states[index],
        forecasts: Object.fromEntries(SCORE_HORIZONS.map(horizon => [horizon.key, rows.reduce((sum, row) => sum + row[horizon.key][index], 0)])),
        actual: rows.reduce((sum, row) => sum + row.actual[index], 0),
        scores: monthScores,
        composite: states[index] === 'pending' ? null : scoreWeightedAccuracy(monthScores, true),
      }
    })
    return {
      quarterKey,
      states,
      indexes,
      horizonScores,
      composite: scoreWeightedAccuracy(horizonScores, true),
      actual: rows.reduce((sum, row) => sum + indexes.reduce((monthSum, index) => monthSum + row.actual[index], 0), 0),
      exceptionCount: rows.filter(row => scoreQuarterRowSummary(row, quarterKey).exception).length,
      monthly,
      status: states.every(state => state !== 'pending') ? 'locked' : 'active',
    }
  }

  function scoreQuarterComparison() {
    const previousKey = scorePreviousQuarter(st.scoreQuarter)
    if (!previousKey) return { key: null, score: null }
    const rows = scoreQuarterFilteredRows(buildQuarterScoreRows(previousKey), previousKey)
    const summary = scoreQuarterSummary(rows, previousKey)
    return { key: previousKey, score: summary.composite }
  }

  function scorecardView() {
    const allRows = buildScoreRows()
    const rows = scoreFilteredRows(allRows)
    const allQuarterRows = buildQuarterScoreRows(st.scoreQuarter)
    const quarterRows = scoreQuarterFilteredRows(allQuarterRows, st.scoreQuarter)
    const quarterSummary = scoreQuarterSummary(quarterRows, st.scoreQuarter)
    const previousQuarter = scoreQuarterComparison()
    const states = scoreMonthStates()
    const indexes = scoreIndexes()
    const cutoff = scoreCutoffDate()
    const forecastMonthly = months().map((_, index) => rows.reduce((sum, row) => sum + row.forecast[index], 0))
    const achieveMonthly = months().map((_, index) => rows.reduce((sum, row) => sum + row.achieve[index], 0))
    const formalForecast = forecastMonthly.reduce((sum, value) => sum + value, 0)
    const evaluatedForecast = indexes.reduce((sum, index) => sum + forecastMonthly[index], 0)
    const effectivePo = indexes.reduce((sum, index) => sum + achieveMonthly[index], 0)
    const accuracy = scorePortfolioAccuracy(rows, indexes)
    const monthlyAccuracy = months().map((_, index) => states[index] === 'pending' ? null : scorePortfolioAccuracy(rows, [index]))
    const exceptionCount = rows.filter(row => scoreRowSummary(row).exception).length
    const comparison = quarterSummary.composite != null && previousQuarter.score != null
      ? quarterSummary.composite - previousQuarter.score
      : null

    return h('div.forecast-scorecard', [
      scorecardToolbar(allRows, allQuarterRows, cutoff),
      st.scoreView === 'overview'
        ? scoreOverview({ accuracy, exceptionCount, forecastMonthly, achieveMonthly, states, monthlyAccuracy, quarterRows, quarterSummary, comparison, previousQuarter })
        : st.scoreView === 'current'
          ? scoreCurrentDetail({ rows, states, forecastMonthly, achieveMonthly, formalForecast, evaluatedForecast, effectivePo, accuracy, monthlyAccuracy, exceptionCount })
          : scoreQuarterDetail(quarterRows, quarterSummary, comparison, previousQuarter),
      scoreLegend(),
    ])
  }

  function scorecardToolbar(allRows, quarterRows, cutoff) {
    const fdMap = new Map()
    const skuMap = new Map()
    allRows.concat(quarterRows).forEach(row => {
      fdMap.set(row.market.id + '|' + row.group.id, row)
      skuMap.set(String(row.sku.id), row.sku)
    })
    const fdOptions = Array.from(fdMap.entries()).sort((a, b) => {
      return a[1].market.code.localeCompare(b[1].market.code) || a[1].group.fd.name.localeCompare(b[1].group.fd.name)
    })
    const skuOptions = Array.from(skuMap.values()).sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
    const scoreTabs = [
      { key: 'overview', label: '综合总览' },
      { key: 'current', label: '当前滚动明细' },
      { key: 'quarter', label: '季度复盘明细' },
    ]
    return h('div.forecast-score-toolbar', [
      h('div.forecast-score-view-tabs', { role: 'tablist', ariaLabel: '评分卡明细视图' }, scoreTabs.map(tab => h('button', {
        type: 'button',
        role: 'tab',
        ariaSelected: st.scoreView === tab.key,
        class: st.scoreView === tab.key ? 'active' : '',
        dataset: { scoreView: tab.key },
        onclick: () => { st.scoreView = tab.key; paint() },
      }, tab.label))),
      h('label.forecast-filter.forecast-score-version-filter', [h('span', '当前预测版本'), h('select', {
        onchange: event => {
          st.runId = Number(event.target.value)
          seedCells()
          loadDraft()
          st.scoreFd = 'all'
          st.scoreSku = 'all'
          paint()
        },
      }, st.runs.map(item => h('option', {
        value: item.id,
        selected: item.id === st.runId,
      }, item.code)))]),
      h('label.forecast-filter.forecast-score-quarter-filter', [h('span', '复盘季度'), h('select', {
        onchange: event => { st.scoreQuarter = event.target.value; paint() },
      }, scoreQuarterOptions().map(key => h('option', {
        value: key,
        selected: key === st.scoreQuarter,
      }, scoreQuarterLabel(key))))]),
      h('label.forecast-filter.forecast-score-market-filter', [h('span', '市场'), h('select', {
        onchange: event => {
          st.countryId = event.target.value === 'all' ? 'all' : Number(event.target.value)
          st.scoreFd = 'all'
          st.scoreSku = 'all'
          paint()
        },
      }, [h('option', { value: 'all', selected: isAllMarkets() }, '全部可见市场 · ' + st.countries.length)].concat(st.countries.map(item => h('option', {
        value: item.id,
        selected: item.id === st.countryId,
      }, item.code + ' · ' + item.name_zh))))]),
      h('label.forecast-filter', [h('span', 'FD'), h('select', {
        onchange: event => { st.scoreFd = event.target.value; paint() },
      }, [h('option', { value: 'all', selected: st.scoreFd === 'all' }, '全部FD')].concat(fdOptions.map(([key, row]) => h('option', {
        value: key, selected: st.scoreFd === key,
      }, (isAllMarkets() ? row.market.code + ' · ' : '') + row.group.fd.name))))]),
      h('label.forecast-filter.forecast-score-product-filter', [h('span', '产品'), h('select', {
        onchange: event => { st.scoreSku = event.target.value; paint() },
      }, [h('option', { value: 'all', selected: st.scoreSku === 'all' }, '全部产品')].concat(skuOptions.map(sku => h('option', {
        value: String(sku.id), selected: String(st.scoreSku) === String(sku.id),
      }, sku.code + ' · ' + sku.name))))]),
      S.toggle(st.scoreOnlyExceptions, '仅看异常', value => { st.scoreOnlyExceptions = value; paint() }),
      h('button.btn.sm.forecast-score-rules', { onclick: openScoreRules }, '查看评分规则'),
      h('span.forecast-score-cutoff', '有效PO截止 ' + (cutoff || '暂无PO')),
    ])
  }

  function scoreOverview(context) {
    const quarterTone = scoreTone(context.quarterSummary.composite)
    const comparisonText = context.comparison == null
      ? '样本不足'
      : (context.comparison >= 0 ? '+' : '') + scoreAccuracyText(context.comparison)
    const comparisonSub = context.previousQuarter.key
      ? scoreQuarterLabel(context.previousQuarter.key) + (context.previousQuarter.score == null ? '缺少完整H1/H2/H3版本' : ' ' + scoreAccuracyText(context.previousQuarter.score))
      : '暂无上一季度'
    return h('div.forecast-score-view.forecast-score-overview', [
      h('div.forecast-score-kpis.overview', [
        scoreKpi('当前滚动准确率', scoreAccuracyText(context.accuracy), '已产生有效PO月份', scoreTone(context.accuracy).className),
        scoreKpi('季度综合准确率', scoreAccuracyText(context.quarterSummary.composite), 'H1 50% + H2 30% + H3 20%', quarterTone.className),
        scoreKpi('较上季度', comparisonText, comparisonSub, context.comparison == null ? 'pending' : context.comparison >= 0 ? 'good' : 'risk'),
        scoreKpi('异常产品', String(context.quarterSummary.exceptionCount), '综合准确率低于80%或计划外PO', context.quarterSummary.exceptionCount ? 'risk' : 'excellent'),
      ]),
      h('div.forecast-score-overview-charts', [
        scoreTrend(context.forecastMonthly, context.achieveMonthly, context.states, context.monthlyAccuracy),
        scoreQuarterHorizonChart(context.quarterSummary),
      ]),
      scoreQuarterSummaryTable(context.quarterSummary),
      scoreQuarterDrilldown(context.quarterRows, context.quarterSummary, true),
    ])
  }

  function scoreCurrentDetail(context) {
    const deviation = context.effectivePo - context.evaluatedForecast
    return h('div.forecast-score-view.forecast-score-current-detail', [
      h('div.forecast-score-kpis.current', [
        scoreKpi('正式预测', S.fmtNum(context.formalForecast), '完整三个月'),
        scoreKpi('有效PO', S.fmtNum(context.effectivePo), scoreIndexes().length + '个月已纳入'),
        scoreKpi('当前滚动准确率', scoreAccuracyText(context.accuracy), '按正式预测绝对偏差汇总', scoreTone(context.accuracy).className),
        scoreKpi('累计偏差', (deviation > 0 ? '+' : '') + S.fmtNum(deviation), 'PO - 同期预测', deviation < 0 ? 'risk' : 'good'),
        scoreKpi('异常产品', String(context.exceptionCount), '准确率低于80%或计划外PO', context.exceptionCount ? 'risk' : 'excellent'),
      ]),
      scoreTrend(context.forecastMonthly, context.achieveMonthly, context.states, context.monthlyAccuracy),
      scoreMatrix(context.rows, context.states),
    ])
  }

  function scoreQuarterDetail(rows, summary, comparison, previousQuarter) {
    const comparisonText = comparison == null ? '样本不足' : (comparison >= 0 ? '+' : '') + scoreAccuracyText(comparison)
    return h('div.forecast-score-view.forecast-score-quarter-detail', [
      h('div.forecast-score-kpis.quarter', [
        scoreKpi('季度综合准确率', scoreAccuracyText(summary.composite), 'H1 50% + H2 30% + H3 20%', scoreTone(summary.composite).className),
        scoreKpi('已纳入有效PO', S.fmtNum(summary.actual), summary.indexes.length + '/3个月已评估'),
        scoreKpi('较上季度', comparisonText, previousQuarter.key ? scoreQuarterLabel(previousQuarter.key) : '暂无上一季度', comparison == null ? 'pending' : comparison >= 0 ? 'good' : 'risk'),
        scoreKpi('异常产品', String(summary.exceptionCount), '综合准确率低于80%或计划外PO', summary.exceptionCount ? 'risk' : 'excellent'),
      ]),
      scoreQuarterHorizonChart(summary),
      scoreQuarterSummaryTable(summary),
      scoreQuarterDrilldown(rows, summary, false),
    ])
  }

  function scoreQuarterHorizonChart(summary) {
    const bars = [
      { key: 'h3', label: 'H3 提前3个月', value: summary.horizonScores.h3, kind: 'h3' },
      { key: 'h2', label: 'H2 提前2个月', value: summary.horizonScores.h2, kind: 'h2' },
      { key: 'h1', label: 'H1 提前1个月', value: summary.horizonScores.h1, kind: 'h1' },
      { key: 'composite', label: '综合', value: summary.composite, kind: 'composite' },
    ]
    return h('section.card.forecast-score-horizon-card', [
      h('div.forecast-section-head', [
        h('h3', '季度提前期准确率'),
        h('span', scoreQuarterLabel(summary.quarterKey) + ' · 先汇总绝对偏差，再按提前期加权'),
      ]),
      h('div.forecast-score-horizon-chart', bars.map(item => h('div.forecast-score-horizon-item.' + item.kind, [
        h('div.forecast-score-horizon-track', h('div.forecast-score-horizon-bar', {
          style: { height: item.value == null ? '8px' : Math.max(12, item.value * 1.15) + 'px' },
        }, h('strong', scoreAccuracyText(item.value)))),
        h('span', item.label),
      ]))),
    ])
  }

  function scoreQuarterSummaryTable(summary) {
    const totalForecasts = Object.fromEntries(SCORE_HORIZONS.map(horizon => [horizon.key, summary.monthly.reduce((sum, month) => sum + month.forecasts[horizon.key], 0)]))
    const rows = summary.monthly.map(item => scoreQuarterSummaryRow(item)).concat([
      h('tr.forecast-score-quarter-total', [
        h('td', [h('strong', '季度合计'), h('small', summary.status === 'locked' ? '已锁定' : '进行中')]),
        h('td.num', S.fmtNum(totalForecasts.h3)),
        h('td.num', S.fmtNum(totalForecasts.h2)),
        h('td.num', S.fmtNum(totalForecasts.h1)),
        h('td.num.strong', S.fmtNum(summary.actual)),
        h('td.accuracy.' + scoreTone(summary.horizonScores.h3).className, scoreAccuracyText(summary.horizonScores.h3)),
        h('td.accuracy.' + scoreTone(summary.horizonScores.h2).className, scoreAccuracyText(summary.horizonScores.h2)),
        h('td.accuracy.' + scoreTone(summary.horizonScores.h1).className, scoreAccuracyText(summary.horizonScores.h1)),
        h('td.accuracy.' + scoreTone(summary.composite).className, scoreAccuracyText(summary.composite)),
        h('td', summary.status === 'locked' ? S.badge('green', '已锁定') : S.badge('blue', '进行中')),
      ]),
    ])
    return h('section.card.forecast-score-quarter-table-card', [
      h('div.forecast-section-head', [
        h('h3', '综合评分明细'),
        h('span', 'H1 50% · H2 30% · H3 20%'),
      ]),
      h('div.forecast-score-quarter-table-scroll', h('table.forecast-score-quarter-table', [
        h('thead', h('tr', [
          h('th', '复盘月份'),
          h('th.num', [h('strong', 'H3预测'), h('small', '提前3个月')]),
          h('th.num', [h('strong', 'H2预测'), h('small', '提前2个月')]),
          h('th.num', [h('strong', 'H1预测'), h('small', '提前1个月')]),
          h('th.num', '有效PO'),
          h('th', 'H3准确率'),
          h('th', 'H2准确率'),
          h('th', 'H1准确率'),
          h('th', '综合准确率'),
          h('th', '状态'),
        ])),
        h('tbody', rows),
      ])),
    ])
  }

  function scoreQuarterSummaryRow(item) {
    const tone = scoreTone(item.composite)
    return h('tr', [
      h('td', [h('strong', item.month.slice(0, 4) + '年' + Number(item.month.slice(5, 7)) + '月'), h('small', item.state === 'pending' ? '有效PO待更新' : item.state === 'active' ? '本月进行中' : '已关账')]),
      h('td.num', S.fmtNum(item.forecasts.h3)),
      h('td.num', S.fmtNum(item.forecasts.h2)),
      h('td.num', S.fmtNum(item.forecasts.h1)),
      h('td.num.strong', item.state === 'pending' ? '—' : S.fmtNum(item.actual)),
      h('td.accuracy.' + scoreTone(item.scores.h3).className, scoreAccuracyText(item.scores.h3)),
      h('td.accuracy.' + scoreTone(item.scores.h2).className, scoreAccuracyText(item.scores.h2)),
      h('td.accuracy.' + scoreTone(item.scores.h1).className, scoreAccuracyText(item.scores.h1)),
      h('td.accuracy.' + tone.className, scoreAccuracyText(item.composite)),
      h('td', item.state === 'pending' ? S.badge('gray', '待评估') : S.badge(tone.kind, tone.label)),
    ])
  }

  function scoreQuarterDrilldown(rows, summary, compact) {
    const bodyRows = compact ? rows.slice(0, 8) : rows
    const colSpan = isAllMarkets() ? 11 : 10
    return h('section.card.forecast-score-quarter-drilldown-card', [
      h('div.forecast-section-head', [
        h('h3', '市场 / FD / 产品下钻'),
        h('span', rows.length + '个组合' + (compact && rows.length > bodyRows.length ? ' · 切换“季度复盘明细”查看全部' : '') + ' · 点击行查看版本与PO来源'),
      ]),
      h('div.forecast-score-quarter-table-scroll' + (compact ? '.compact' : ''), h('table.forecast-score-quarter-table.forecast-score-quarter-drilldown', [
        h('thead', h('tr', [
          isAllMarkets() ? h('th', '市场') : null,
          h('th', 'FD'),
          h('th', '产品 / SKU'),
          h('th.num', 'H3预测'),
          h('th.num', 'H2预测'),
          h('th.num', 'H1预测'),
          h('th.num', '有效PO'),
          h('th', 'H3准确率'),
          h('th', 'H2准确率'),
          h('th', 'H1准确率'),
          h('th', '综合准确率'),
        ])),
        h('tbody', bodyRows.length ? bodyRows.map(row => scoreQuarterDrilldownRow(row, summary)) : h('tr', h('td.forecast-score-empty', { colspan: colSpan }, '当前筛选条件下暂无季度评分记录'))),
      ])),
    ])
  }

  function scoreQuarterDrilldownRow(row, summary) {
    const result = scoreQuarterRowSummary(row, summary.quarterKey)
    const indexes = summary.indexes
    const total = key => indexes.reduce((sum, index) => sum + row[key][index], 0)
    return h('tr', { tabindex: 0, onclick: () => openQuarterScoreDetail(row, summary), onkeydown: event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openQuarterScoreDetail(row, summary) }
    } }, [
      isAllMarkets() ? h('td', [h('strong', row.market.code), h('small', row.market.name_zh)]) : null,
      h('td', h('strong', row.group.fd.name)),
      h('td.forecast-score-product', [h('strong', row.sku.code), h('span', row.sku.name || '—')]),
      h('td.num', S.fmtNum(total('h3'))),
      h('td.num', S.fmtNum(total('h2'))),
      h('td.num', S.fmtNum(total('h1'))),
      h('td.num.strong', S.fmtNum(result.actual)),
      h('td.accuracy.' + scoreTone(result.scores.h3).className, scoreAccuracyText(result.scores.h3)),
      h('td.accuracy.' + scoreTone(result.scores.h2).className, scoreAccuracyText(result.scores.h2)),
      h('td.accuracy.' + scoreTone(result.scores.h1).className, scoreAccuracyText(result.scores.h1)),
      h('td.accuracy.' + scoreTone(result.composite).className, scoreAccuracyText(result.composite)),
    ])
  }

  function scoreLegend() {
    return h('div.forecast-score-legend', [
      h('strong', '预测准确率'),
      h('span.excellent', '优秀 ≥ 90%'),
      h('span.good', '良好 80%–89.9%'),
      h('span.watch', '关注 70%–79.9%'),
      h('span.risk', '风险 < 70%'),
      h('span.grow'),
      h('span', '当前滚动：所选正式版本 vs 有效PO · 季度综合：锁定H1/H2/H3版本 · 已取消PO不计入'),
    ])
  }

  function openScoreRules() {
    const overlay = S.overlay('modal', { title: '预测评分规则' })
    overlay.panel.classList.add('forecast-score-rules-modal')
    overlay.body.append(h('div.forecast-score-rules-content', [
      h('section', [h('h3', '当前滚动准确率'), h('p', '比较所选正式预测版本与同月有效PO。未来月份保持待评估；已取消PO数量不计入有效PO。')]),
      h('section', [h('h3', '季度综合准确率'), h('p', '每个复盘月份分别读取提前1个月、2个月和3个月发布的正式版本。先在市场、FD、SKU、月份层级汇总绝对偏差，再计算各提前期准确率。')]),
      h('div.forecast-score-formula', '季度综合 = H1 × 50% + H2 × 30% + H3 × 20%'),
      h('section', [h('h3', '特殊情况'), h('p', '预测为0但产生有效PO时记为计划外PO；预测与有效PO均为0时不评分；历史正式版本不足时显示样本不足。')]),
    ]))
    overlay.foot.append(h('span.grow'), h('button.btn.primary', { onclick: overlay.close }, '知道了'))
  }

  function openQuarterScoreDetail(row, summary) {
    const result = scoreQuarterRowSummary(row, summary.quarterKey)
    const quarterMonths = scoreQuarterMonths(summary.quarterKey)
    const noteKey = 'quarter|' + summary.quarterKey + '|' + row.key
    const note = st.scoreNotes[noteKey] || { reason: '', action: '' }
    const overlay = S.overlay('drawer', { title: row.group.fd.name + ' · ' + row.sku.code + ' · 季度复盘' })
    overlay.panel.classList.add('forecast-score-drawer')
    const reason = h('textarea', {
      rows: 3,
      placeholder: '记录三个提前期预测与有效PO的主要偏差原因…',
      value: note.reason || '',
      oninput: event => {
        st.scoreNotes[noteKey] = Object.assign({}, st.scoreNotes[noteKey], { reason: event.target.value })
        scheduleSave()
      },
    })
    const action = h('textarea', {
      rows: 3,
      placeholder: '记录下一季度预测调整、客户确认或产品动作…',
      value: note.action || '',
      oninput: event => {
        st.scoreNotes[noteKey] = Object.assign({}, st.scoreNotes[noteKey], { action: event.target.value })
        scheduleSave()
      },
    })

    overlay.body.append(
      h('div.forecast-score-drawer-context', [
        h('div', [h('span', '复盘季度'), h('strong', scoreQuarterLabel(summary.quarterKey))]),
        h('div', [h('span', '市场 / FD'), h('strong', row.market.code + ' · ' + row.group.fd.name)]),
        h('div', [h('span', '有效PO'), h('strong', S.fmtNum(result.actual))]),
        h('div', [h('span', '综合准确率'), h('strong', { class: scoreTone(result.composite).className }, scoreAccuracyText(result.composite))]),
      ]),
      h('section.forecast-score-drawer-section', [
        h('div.forecast-section-head', [h('h3', '月份与正式版本来源'), h('span', 'H1 / H2 / H3按目标月份自动匹配')]),
        h('div.forecast-score-drawer-table-wrap', h('table.forecast-score-drawer-table.forecast-quarter-source-table', [
          h('thead', h('tr', [h('th', '复盘月份'), h('th', '提前期'), h('th', '正式版本'), h('th.num', '预测'), h('th.num', '有效PO'), h('th.num', '准确率')])),
          h('tbody', quarterMonths.flatMap((month, monthIndex) => SCORE_HORIZONS.slice().reverse().map(horizon => {
            const sourceRun = scoreRunForLead(month, horizon.lead)
            const isPending = summary.states[monthIndex] === 'pending'
            const accuracy = isPending || !sourceRun ? null : scoreAccuracy(row[horizon.key], row.actual, [monthIndex])
            return h('tr', [
              h('td', month.slice(0, 4) + '年' + Number(month.slice(5, 7)) + '月'),
              h('td', horizon.key.toUpperCase()),
              h('td', sourceRun ? sourceRun.code : '历史版本缺失'),
              h('td.num', sourceRun ? S.fmtNum(row[horizon.key][monthIndex]) : '—'),
              h('td.num', isPending ? '—' : S.fmtNum(row.actual[monthIndex])),
              h('td.num.accuracy.' + scoreTone(accuracy).className, scoreAccuracyText(accuracy)),
            ])
          }))),
        ])),
      ]),
      h('section.forecast-score-drawer-section', [
        h('div.forecast-section-head', [h('h3', '季度有效PO明细'), h('span', row.poLines.length + '条')]),
        h('div.forecast-score-drawer-table-wrap', h('table.forecast-score-drawer-table', [
          h('thead', h('tr', [h('th', 'PO'), h('th', 'PO日期'), h('th', '状态'), h('th.num', '有效数量')])),
          h('tbody', row.poLines.length ? row.poLines.map(line => h('tr', [
            h('td', line.po.po_number || '—'),
            h('td', line.po.po_date || '—'),
            h('td', line.po.po_status === 'partial' ? S.badge('amber', '部分履行') : S.badge('green', '有效')),
            h('td.num.strong', S.fmtNum(line.effectiveQty)),
          ])) : h('tr', h('td', { colspan: 4 }, '当前季度暂无有效PO'))),
        ])),
      ]),
      h('div.forecast-score-review-fields', [
        h('label', [h('span', '季度偏差原因'), reason]),
        h('label', [h('span', '下季度动作'), action]),
      ]),
    )
    overlay.foot.append(
      h('span.forecast-save-state', { dataset: { forecastSaveState: '1', state: 'saved' } }, st.lastSaved ? '已自动保存 ' + timeText(st.lastSaved) : '自动保存已开启'),
      h('span.grow'),
      h('button.btn.primary', { onclick: () => { persistDraft(); overlay.close(); S.toast('季度复盘记录已保存') } }, '保存复盘'),
    )
  }

  function scoreKpi(label, value, sub, tone) {
    return h('div.forecast-score-kpi' + (tone ? '.' + tone : ''), [
      h('span', label), h('strong', value), h('small', sub),
    ])
  }

  function scoreTrend(forecastMonthly, achieveMonthly, states, monthlyAccuracy) {
    const max = Math.max(1, ...forecastMonthly, ...achieveMonthly)
    return h('section.card.forecast-score-trend-card', [
      h('div.forecast-section-head', [
        h('h3', '三个月正式预测与有效PO'),
        h('span', '未来月份保持待评估，不按零PO计为风险'),
      ]),
      h('div.forecast-score-trend', months().map((month, index) => {
        const accuracy = monthlyAccuracy[index]
        return h('div.forecast-score-trend-month', [
          h('div.forecast-score-bars', [
            scoreTrendBar('forecast', forecastMonthly[index], max, '预测 ' + S.fmtNum(forecastMonthly[index])),
            states[index] === 'pending'
              ? h('div.forecast-score-pending-bar', '待更新')
              : scoreTrendBar('po', achieveMonthly[index], max, 'PO ' + S.fmtNum(achieveMonthly[index])),
          ]),
          h('div.forecast-score-trend-label', [
            h('strong', S.monthLabel(S.ym(month)) + ' ' + month.slice(0, 4)),
            h('span', states[index] === 'pending' ? '待评估' : '准确率 ' + scoreAccuracyText(accuracy)),
          ]),
        ])
      })),
    ])
  }

  function scoreTrendBar(kind, value, max, label) {
    return h('div.forecast-score-bar.' + kind, {
      style: { height: Math.max(value ? 12 : 2, value / max * 112) + 'px' },
      title: label,
    }, h('span', label))
  }

  function scoreMatrix(rows, states) {
    const colSpan = isAllMarkets() ? 9 : 8
    const body = rows.length ? rows.map(row => scoreMatrixRow(row, states)) : [
      h('tr', h('td.forecast-score-empty', { colspan: colSpan }, '当前筛选条件下暂无正式预测或有效PO记录')),
    ]
    return h('section.card.forecast-score-matrix-card', [
      h('div.forecast-section-head', [
        h('h3', 'FD × 产品预测准确率'),
        h('span', rows.length + '个组合 · 点击任一行查看Retailer预测构成与PO明细'),
      ]),
      h('div.forecast-score-table-scroll', h('table.forecast-score-table', [
        h('thead', h('tr', [
          isAllMarkets() ? h('th', '市场') : null,
          h('th', 'FD'),
          h('th', '产品 / SKU'),
          ...months().map(month => h('th', [h('strong', S.monthLabel(S.ym(month))), h('small', '预测 / PO / 准确率')])),
          h('th', [h('strong', '三个月'), h('small', '正式预测 / 有效PO')]),
          h('th', '预测准确率'),
          h('th', '状态'),
        ])),
        h('tbody', body),
      ])),
    ])
  }

  function scoreMatrixRow(row, states) {
    const summary = scoreRowSummary(row)
    const tone = scoreTone(summary.accuracy)
    const totalForecast = row.forecast.reduce((sum, value) => sum + value, 0)
    const totalPo = row.achieve.reduce((sum, value) => sum + value, 0)
    return h('tr', { tabindex: 0, onclick: () => openScoreDetail(row), onkeydown: event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openScoreDetail(row) }
    } }, [
      isAllMarkets() ? h('td.forecast-score-market', [h('strong', row.market.code), h('span', row.market.name_zh)]) : null,
      h('td.forecast-score-fd', row.group.fd.name),
      h('td.forecast-score-product', [h('strong', row.sku.code), h('span', row.sku.name || '—'), h('small', row.sku.category || '—')]),
      ...months().map((month, index) => scoreMonthCell(row.forecast[index], row.achieve[index], states[index])),
      h('td.forecast-score-total', [h('strong', S.fmtNum(totalForecast) + ' / ' + S.fmtNum(totalPo)), h('small', '完整窗口')]),
      h('td.forecast-score-accuracy.' + tone.className, scoreAccuracyText(summary.accuracy)),
      h('td', summary.unplanned ? S.badge('red', '计划外PO') : S.badge(tone.kind, tone.label)),
    ])
  }

  function scoreMonthCell(forecast, achieve, state) {
    const accuracy = state === 'pending' ? null : scoreAccuracy([forecast], [achieve], [0])
    return h('td.forecast-score-month' + (state === 'pending' ? '.pending' : ''), [
      h('div', [h('span', '预测'), h('strong', S.fmtNum(forecast))]),
      h('div', [h('span', 'PO'), h('strong', state === 'pending' ? '—' : S.fmtNum(achieve))]),
      h('small', state === 'pending' ? '待评估' : '准确率 ' + scoreAccuracyText(accuracy)),
    ])
  }

  function openScoreDetail(row) {
    const summary = scoreRowSummary(row)
    const overlay = S.overlay('drawer', { title: row.group.fd.name + ' · ' + row.sku.code })
    overlay.panel.classList.add('forecast-score-drawer')
    const retailerRows = Array.from(row.retailers.values()).map(item => {
      const total = item.values.reduce((sum, value) => sum + value, 0)
      return { ka: item.ka, values: item.values, total }
    }).sort((a, b) => b.total - a.total)
    const retailerTotal = retailerRows.reduce((sum, item) => sum + item.total, 0)
    const note = st.scoreNotes[row.key] || { reason: '', action: '' }
    const reason = h('textarea', {
      rows: 3,
      placeholder: '记录预测与PO偏差原因…',
      value: note.reason || '',
      oninput: event => {
        st.scoreNotes[row.key] = Object.assign({}, st.scoreNotes[row.key], { reason: event.target.value })
        scheduleSave()
      },
    })
    const action = h('textarea', {
      rows: 3,
      placeholder: '记录下周期预测调整或客户跟进动作…',
      value: note.action || '',
      oninput: event => {
        st.scoreNotes[row.key] = Object.assign({}, st.scoreNotes[row.key], { action: event.target.value })
        scheduleSave()
      },
    })

    overlay.body.append(
      h('div.forecast-score-drawer-context', [
        h('div', [h('span', '市场'), h('strong', row.market.code + ' · ' + row.market.name_zh)]),
        h('div', [h('span', '三个月正式预测'), h('strong', S.fmtNum(row.forecast.reduce((sum, value) => sum + value, 0)))]),
        h('div', [h('span', '已纳入有效PO'), h('strong', S.fmtNum(summary.achieve))]),
        h('div', [h('span', '预测准确率'), h('strong', { class: scoreTone(summary.accuracy).className }, scoreAccuracyText(summary.accuracy))]),
      ]),
      h('div.forecast-score-retailer-note', 'Retailer仅用于解释预测构成；目前没有明确的Retailer实际数据，因此不计算Retailer达成率或准确率。'),
      h('section.forecast-score-drawer-section', [
        h('div.forecast-section-head', [h('h3', 'Retailer预测构成'), h('span', retailerRows.length + '个渠道')]),
        h('div.forecast-score-drawer-table-wrap', h('table.forecast-score-drawer-table', [
          h('thead', h('tr', [h('th', 'Retailer'), ...months().map(month => h('th.num', S.monthLabel(S.ym(month)))), h('th.num', '三个月'), h('th.num', '占比')])),
          h('tbody', retailerRows.length ? retailerRows.map(item => h('tr', [
            h('td', item.ka.name),
            ...item.values.map(value => h('td.num', S.fmtNum(value))),
            h('td.num.strong', S.fmtNum(item.total)),
            h('td.num', Math.round(item.total / Math.max(retailerTotal, 1) * 100) + '%'),
          ])) : h('tr', h('td', { colspan: 6 }, '该FD产品暂无Retailer预测构成'))),
        ])),
      ]),
      h('section.forecast-score-drawer-section', [
        h('div.forecast-section-head', [h('h3', '有效PO明细'), h('span', row.poLines.length + '条')]),
        h('div.forecast-score-drawer-table-wrap', h('table.forecast-score-drawer-table', [
          h('thead', h('tr', [h('th', 'PO'), h('th', 'PO日期'), h('th', '状态'), h('th.num', '有效数量')])),
          h('tbody', row.poLines.length ? row.poLines.map(line => h('tr', [
            h('td', line.po.po_number || '—'),
            h('td', line.po.po_date || '—'),
            h('td', line.po.po_status === 'partial' ? S.badge('amber', '部分履行') : S.badge('green', '有效')),
            h('td.num.strong', S.fmtNum(line.effectiveQty)),
          ])) : h('tr', h('td', { colspan: 4 }, '当前评估月份暂无有效PO'))),
        ])),
      ]),
      h('div.forecast-score-review-fields', [
        h('label', [h('span', '偏差原因'), reason]),
        h('label', [h('span', '下周期动作'), action]),
      ]),
    )
    overlay.foot.append(
      h('span.forecast-save-state', { dataset: { forecastSaveState: '1', state: 'saved' } }, st.lastSaved ? '已自动保存 ' + timeText(st.lastSaved) : '自动保存已开启'),
      h('span.grow'),
      h('button.btn.primary', { onclick: () => { persistDraft(); overlay.close(); S.toast('复盘记录已保存') } }, '保存复盘'),
    )
  }

  function reviewView() {
    const rows = scopeRows()
    const monthList = months()
    const total = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = monthList.reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
    const bp = before ? Math.round(before * 1.08) : Math.round(total * 1.06)
    const shortage = -Math.round(total * 0.11)
    const risks = buildRisks(rows)

    return h('div', [
      h('div.forecast-review-head', [
        h('div', [
          h('h2', marketLabel() + '预测评审'),
          h('p', months().map(month => S.ym(month)).join(' · ') + ' · 数据来源 v5销售草稿'),
        ]),
        h('span.grow'),
        h('span.forecast-review-keyhint', '← / → 或 PageUp / PageDown'),
        h('button.btn.sm', { onclick: previousReviewTab }, '上一页'),
        h('button.btn.sm', { onclick: nextReviewTab }, '下一页'),
        h('button.btn.sm', { onclick: requestReviewFullscreen }, '全屏评审'),
        h('button.btn.sm', { onclick: () => S.toast('评审纪要已导出') }, '导出评审纪要'),
      ]),
      h('div.forecast-review-tabs', REVIEW_TABS.map(tab => h('button', {
        type: 'button',
        class: st.reviewTab === tab.v ? 'active' : '',
        onclick: () => { st.reviewTab = tab.v; paint() },
      }, tab.v === 'matrix' && isAllMarkets() ? '国家×产品' : tab.label))),
      h('div.forecast-review-status', [
        h('span.green', '销售已提交'), h('span.amber', 'GTM待复核'),
        h('span', '最后更新 ' + (st.lastSaved ? timeText(st.lastSaved) : '10:24')),
        h('span', '同源于市场全景填报'),
      ]),
      h('div.forecast-review-kpis', [
        reviewKpi('三个月预测', S.fmtNum(total), '件'),
        reviewKpi('较上月', varianceText(percentage(total, before)), S.fmtNum(total - before) + ' 件', percentage(total, before) >= 0 ? 'positive' : 'negative'),
        reviewKpi('较BP参考', varianceText(percentage(total, bp)), S.fmtNum(total - bp) + ' 件', 'negative'),
        reviewKpi('供应缺口', S.fmtNum(shortage), '件', 'negative'),
        reviewKpi('重点异常', String(risks.length), '项', risks.length ? 'negative' : ''),
      ]),
      reviewContent(rows, risks),
      st.reviewTab === 'overview' ? reviewFooter() : null,
    ])
  }

  function reviewKpi(label, value, sub, tone) {
    return h('div.forecast-review-kpi' + (tone ? '.' + tone : ''), [h('span', label), h('strong', value), h('small', sub)])
  }

  function reviewContent(rows, risks) {
    if (st.reviewTab === 'matrix') return channelProductMatrixReview(rows)
    if (st.reviewTab === 'channel') return channelReview(rows)
    if (st.reviewTab === 'product') return productReview(rows)
    if (st.reviewTab === 'risk') return riskReview(risks)
    return overviewReview(rows, risks)
  }

  function overviewReview(rows, risks) {
    if (isAllMarkets()) return allMarketsReview(rows, risks)
    return h('div.forecast-review-overview', [
      h('section.card.forecast-review-chart', [
        h('div.forecast-section-head', [h('h3', '三个月预测对比'), h('span', '当前预测 / 上月版本 / BP参考')]),
        monthComparisonChart(rows),
      ]),
      h('section.card.forecast-review-chart', [
        h('div.forecast-section-head', [h('h3', '预测贡献结构'), h('span', '按FD与渠道')]),
        fdContributionChart(rows),
      ]),
      h('section.card.forecast-review-table', [
        h('div.forecast-section-head', [h('h3', '渠道贡献与变化'), h('button.btn.sm', { onclick: () => { st.reviewTab = 'channel'; paint() } }, '查看全部')]),
        compactChannelTable(rows),
      ]),
      h('section.card.forecast-review-table', [
        h('div.forecast-section-head', [h('h3', '产品增减 Top 5'), h('button.btn.sm', { onclick: () => { st.reviewTab = 'product'; paint() } }, '查看全部')]),
        compactProductTable(rows),
      ]),
      h('section.card.forecast-review-table', [
        h('div.forecast-section-head', [h('h3', '评审关注事项'), h('button.btn.sm', { onclick: () => { st.reviewTab = 'risk'; paint() } }, '处理异常')]),
        compactRiskTable(risks),
      ]),
    ])
  }

  function allMarketsReview(rows, risks) {
    const data = marketSummaryData()
    return h('div.forecast-review-overview.forecast-region-review', [
      h('section.card.forecast-review-chart', [
        h('div.forecast-section-head', [h('h3', '区域三个月预测'), h('span', '全部可见市场 / 上月版本 / BP参考')]),
        monthComparisonChart(rows),
      ]),
      h('section.card.forecast-review-chart', [
        h('div.forecast-section-head', [h('h3', '市场贡献结构'), h('span', data.length + '个可见市场')]),
        marketContributionChart(data),
      ]),
      h('section.card.forecast-review-table.forecast-region-market-table', [
        h('div.forecast-section-head', [h('h3', '市场表现与协调优先级'), h('span', '按三个月预测排序')]),
        simpleTable(['市场', '三个月预测', '占比', '较上版', '覆盖', '协调建议'], data.map(item => [
          item.country.code + ' · ' + item.country.name_zh,
          S.fmtNum(item.current),
          Math.round(item.current / Math.max(data.reduce((sum, row) => sum + row.current, 0), 1) * 100) + '%',
          varianceNode(item.variance),
          item.fdCount + ' FD / ' + item.channelCount + '渠道',
          Math.abs(item.variance) >= 10 ? '优先复核供应' : '正常跟进',
        ])),
      ]),
      h('section.card.forecast-review-table', [
        h('div.forecast-section-head', [h('h3', '跨市场产品变化'), h('span', 'Top 5')]),
        compactProductTable(rows),
      ]),
      h('section.card.forecast-review-table', [
        h('div.forecast-section-head', [h('h3', '区域评审关注事项'), h('span', risks.length + '项')]),
        compactRiskTable(risks),
      ]),
    ])
  }

  function marketContributionChart(data) {
    const total = data.reduce((sum, item) => sum + item.current, 0)
    return h('div.forecast-fd-chart', data.map(item => {
      const share = item.current / Math.max(total, 1) * 100
      return h('div.forecast-fd-block', [
        h('div.forecast-fd-label', [h('strong', item.country.code + ' · ' + item.country.name_zh), h('span', S.fmtNum(item.current) + ' · ' + Math.round(share) + '%')]),
        h('div.forecast-fd-track', h('span', { style: { width: Math.max(2, share) + '%' } })),
      ])
    }))
  }

  function monthComparisonChart(rows) {
    const list = months().map(month => ({
      month,
      current: rowsTotal(rows, month),
      before: rowsBaseline(rows, month),
    }))
    const max = Math.max(1, ...list.flatMap(item => [item.current, item.before, Math.round(item.before * 1.08)]))
    return h('div.forecast-month-chart', list.map(item => {
      const bp = item.before ? Math.round(item.before * 1.08) : Math.round(item.current * 1.06)
      return h('div.forecast-month-cluster', [
        h('div.forecast-bars', [
          chartBar(item.current, max, 'current', S.fmtNum(item.current)),
          chartBar(item.before, max, 'previous', S.fmtNum(item.before)),
          chartBar(bp, max, 'bp', S.fmtNum(bp)),
        ]),
        h('strong', S.monthLabel(S.ym(item.month)) + ' ' + item.month.slice(0, 4)),
      ])
    }))
  }
  function chartBar(value, max, className, label) {
    return h('div.forecast-chart-bar.' + className, {
      style: { height: Math.max(8, value / max * 72) + 'px' }, title: label,
    }, h('span', label))
  }

  function fdStats(rows) {
    const monthList = months()
    const total = monthList.reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    return hierarchy().map(group => {
      const subset = rows.filter(row => row.group.id === group.id)
      const current = monthList.reduce((sum, month) => sum + rowsTotal(subset, month), 0)
      const before = monthList.reduce((sum, month) => sum + rowsBaseline(subset, month), 0)
      return { group, rows: subset, current, before, share: total ? current / total * 100 : 0 }
    }).filter(item => item.rows.length).sort((a, b) => b.current - a.current)
  }
  function fdContributionChart(rows) {
    return h('div.forecast-fd-chart', fdStats(rows).map(item => h('div.forecast-fd-block', [
      h('div.forecast-fd-label', [h('strong', item.group.fd.name), h('span', S.fmtNum(item.current) + ' · ' + Math.round(item.share) + '%')]),
      h('div.forecast-fd-track', h('span', { style: { width: Math.max(2, item.share) + '%' } })),
      h('div.forecast-retailer-shares', item.group.channels.map(ka => {
        const subset = item.rows.filter(row => row.ka.id === ka.id)
        const value = months().reduce((sum, month) => sum + rowsTotal(subset, month), 0)
        return value ? h('span', ka.name + ' ' + Math.round(value / Math.max(item.current, 1) * 100) + '%') : null
      })),
    ])))
  }

  function channelRowsData(rows) {
    const data = []
    const scopes = isAllMarkets() ? st.countries : [country()]
    scopes.filter(Boolean).forEach(market => hierarchy(market.id).forEach(group => group.channels.forEach(ka => {
      const subset = rows.filter(row => row.ka.id === ka.id && (!row.country || row.country.id === market.id))
      if (!subset.length) return
      const current = months().reduce((sum, month) => sum + rowsTotal(subset, month), 0)
      const before = months().reduce((sum, month) => sum + rowsBaseline(subset, month), 0)
      data.push({ market: market.code, fd: group.fd.name, retailer: ka.name, current, before, variance: percentage(current, before) })
    })))
    return data.sort((a, b) => b.current - a.current)
  }
  function compactChannelTable(rows) {
    const data = channelRowsData(rows).slice(0, 4)
    return simpleTable(['FD / Retailer', '三个月预测', '占比', '较上月'], data.map(item => {
      const total = data.reduce((sum, row) => sum + row.current, 0)
      return [(isAllMarkets() ? item.market + ' · ' : '') + item.fd + ' / ' + item.retailer, S.fmtNum(item.current), Math.round(item.current / Math.max(total, 1) * 100) + '%', varianceNode(item.variance)]
    }))
  }

  function productStats(rows) {
    const map = new Map()
    rows.forEach(row => {
      const id = row.sku.id
      if (!map.has(id)) map.set(id, { sku: row.sku, current: 0, before: 0 })
      const item = map.get(id)
      months().forEach(month => {
        item.current += rowMonthTotal(row.sku.id, row.ka.id, month)
        item.before += baselineQty(row.sku.id, row.ka.id, month) || 0
      })
    })
    return Array.from(map.values()).map(item => Object.assign(item, {
      delta: item.current - item.before,
      variance: percentage(item.current, item.before),
    })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  }
  function compactProductTable(rows) {
    return simpleTable(['产品', '上月版本', '当前预测', '变化'], productStats(rows).slice(0, 4).map(item => [
      item.sku.code, S.fmtNum(item.before), S.fmtNum(item.current), varianceNode(item.variance),
    ]))
  }
  function varianceNode(value) { return h('span', { class: varianceClass(value) }, varianceText(value)) }

  function buildRisks(rows) {
    const risks = []
    productStats(rows).forEach(item => {
      if (Math.abs(item.variance) >= 10) risks.push({
        type: item.variance < 0 ? '预测下调' : '大幅增长',
        subject: item.sku.code + ' · ' + item.sku.name,
        impact: varianceText(item.variance),
        owner: 'Sales',
        action: item.variance < 0 ? '确认客户需求' : '复核供应能力',
        level: Math.abs(item.variance) >= 20 ? 'red' : 'amber',
      })
    })
    const missingRows = rows.filter(row => months().some(month => qty(row.sku.id, row.ka.id, month) == null))
    if (missingRows.length) risks.unshift({
      type: '数据缺失', subject: missingRows.length + '个渠道产品组合仍未填完整', impact: '待补充', owner: 'Sales', action: '返回全景填报', level: 'red',
    })
    if (!risks.length) risks.push({ type: '供应检查', subject: '重点SKU供应覆盖待确认', impact: '-11%', owner: 'Supply', action: '8月8日前反馈', level: 'amber' })
    return risks.slice(0, 7)
  }
  function compactRiskTable(risks) {
    return simpleTable(['类型', '事项', '影响', '下一步'], risks.slice(0, 4).map(item => [
      S.badge(item.level, item.type), item.subject, item.impact, item.action,
    ]))
  }

  function simpleTable(headers, rows) {
    return h('div.forecast-simple-table-wrap', h('table.forecast-simple-table', [
      h('thead', h('tr', headers.map(label => h('th', label)))),
      h('tbody', rows.map(row => h('tr', row.map(cell => h('td', cell))))),
    ]))
  }

  function matrixGroups(rows) {
    return hierarchy().map(group => {
      const channels = group.channels.map(ka => {
        const subset = rows.filter(row => row.ka.id === ka.id)
        const current = months().reduce((sum, month) => sum + rowsTotal(subset, month), 0)
        const before = months().reduce((sum, month) => sum + rowsBaseline(subset, month), 0)
        return { group, ka, rows: subset, current, before }
      }).filter(item => st.matrixShowEmptyChannels || item.current || item.before)
      return {
        group,
        channels,
        current: channels.reduce((sum, item) => sum + item.current, 0),
        before: channels.reduce((sum, item) => sum + item.before, 0),
      }
    }).filter(item => item.channels.length)
  }

  function matrixProducts(rows) {
    const products = st.matrixShowAllProducts
      ? activeSkus().filter(matrixProductMatchesFilters)
      : Array.from(rows.reduce((map, row) => {
        if (!map.has(row.sku.id)) map.set(row.sku.id, row.sku)
        return map
      }, new Map()).values())
    return products.filter(sku => {
      const productRows = rows.filter(row => row.sku.id === sku.id)
      const current = months().reduce((sum, month) => sum + rowsTotal(productRows, month), 0)
      const before = months().reduce((sum, month) => sum + rowsBaseline(productRows, month), 0)
      const variance = percentage(current, before)
      if (st.matrixOnlyChanged && current === before) return false
      if (st.matrixOnlyRisk && Math.abs(variance) < 10) return false
      return true
    }).sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
  }

  function matrixProductMatchesFilters(sku) {
    if (st.category !== 'all' && sku.category !== st.category) return false
    if (st.lifecycle !== 'all' && sku.lifecycle !== st.lifecycle) return false
    const needle = st.search.trim().toLowerCase()
    if (!needle) return true
    return [sku.code, sku.name, sku.category]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(needle))
  }

  function channelProductMatrixReview(rows) {
    if (isAllMarkets()) return countryProductMatrixReview(rows)

    const groups = matrixGroups(rows)
    const channels = groups.flatMap(item => item.channels)
    const products = matrixProducts(rows)
    const total = months().reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = months().reduce((sum, month) => sum + rowsBaseline(rows, month), 0)

    return h('div.forecast-matrix-review', [
      h('div.forecast-matrix-toolbar', [
        h('div', [
          h('strong', '渠道 × 产品预测全景'),
          h('span', (country() ? country().code + ' · ' + country().name_zh : '') + ' · ' + products.length + '个产品 · FD归属与三个月预测同屏评审'),
        ]),
        h('span.grow'),
        S.toggle(st.matrixMonthly, '显示月度明细', value => { st.matrixMonthly = value; paint() }),
        S.toggle(st.matrixShowAllProducts, '查看所有产品', value => { st.matrixShowAllProducts = value; paint() }),
        S.toggle(st.matrixOnlyChanged, '仅看变动产品', value => { st.matrixOnlyChanged = value; paint() }),
        S.toggle(st.matrixOnlyRisk, '仅看异常产品', value => { st.matrixOnlyRisk = value; paint() }),
        S.toggle(st.matrixShowEmptyChannels, '显示空渠道', value => { st.matrixShowEmptyChannels = value; paint() }),
      ]),
      h('section.card.forecast-matrix-card', [
        channelProductMatrix(groups, channels, products, rows),
      ]),
      matrixInsightRibbon(groups, products, rows, total, before),
    ])
  }

  function channelProductMatrix(groups, channels, products, rows) {
    const headTop = h('tr', [
      h('th.forecast-matrix-product', { rowspan: 2 }, '产品 / SKU'),
      h('th.forecast-matrix-lifecycle', { rowspan: 2 }, '生命周期'),
      ...groups.map(item => h('th.forecast-matrix-fd', { colspan: item.channels.length }, [
        h('strong', 'FD · ' + item.group.fd.name),
        h('small', S.fmtNum(item.current) + ' · ' + varianceText(percentage(item.current, item.before))),
      ])),
      h('th.forecast-matrix-total', { rowspan: 2 }, [h('span', '产品合计'), h('small', '较上版')]),
    ])
    const headChannels = h('tr', channels.map(item => h('th.forecast-matrix-channel', h('button.forecast-matrix-channel-button', {
      type: 'button',
      title: '查看' + item.ka.name + '预测明细',
      onclick: () => openChannelForecastDetail(item),
    }, [
      h('strong', item.ka.name),
      st.matrixMonthly ? h('small', months().map(month => S.monthLabel(S.ym(month))).join(' / ') + ' / 合计') : h('small', '三个月合计'),
      h('span', '查看明细'),
    ]))))

    const body = products.length
      ? h('tbody', products.map(sku => matrixProductRow(sku, channels, rows)))
      : h('tbody', h('tr', h('td.forecast-empty', { colspan: channels.length + 3 }, '当前筛选下没有产品。')))

    const marketTotalCells = channels.map(item => {
      const values = months().map(month => rowsTotal(item.rows, month))
      const current = values.reduce((sum, value) => sum + value, 0)
      return h('td.forecast-matrix-cell.total', matrixValueContent(values, current, percentage(current, item.before), true))
    })
    const foot = h('tfoot', h('tr', [
      h('td', { colspan: 2 }, [h('strong', '市场合计'), h('small', channels.length + ' 个渠道 · ' + products.length + ' 个SKU')]),
      ...marketTotalCells,
      h('td.forecast-matrix-grand-total', [h('strong', S.fmtNum(months().reduce((sum, month) => sum + rowsTotal(rows, month), 0))), h('small', varianceText(percentage(
        months().reduce((sum, month) => sum + rowsTotal(rows, month), 0),
        months().reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
      )))]),
    ]))

    return h('div.forecast-matrix-scroll', h('table.forecast-channel-product-matrix', {
      style: { minWidth: Math.max(960, 282 + channels.length * 101) + 'px' },
    }, [h('thead', [headTop, headChannels]), body, foot]))
  }

  function matrixProductRow(sku, channels, rows) {
    const productRows = rows.filter(row => row.sku.id === sku.id)
    const current = months().reduce((sum, month) => sum + rowsTotal(productRows, month), 0)
    const before = months().reduce((sum, month) => sum + rowsBaseline(productRows, month), 0)
    const variance = percentage(current, before)
    return h('tr', [
      h('td.forecast-matrix-product', [h('strong', sku.code), h('span', sku.name || '—'), h('small', sku.category || '—')]),
      h('td.forecast-matrix-lifecycle', S.badge(sku.lifecycle === 'npi' ? 'blue' : sku.lifecycle === 'eol' ? 'gray' : 'green', LIFECYCLE[sku.lifecycle] || sku.lifecycle || '—')),
      ...channels.map(item => matrixProductChannelCell(sku, item.ka)),
      h('td.forecast-matrix-grand-total', [h('strong', S.fmtNum(current)), h('small', { class: varianceClass(variance) }, varianceText(variance))]),
    ])
  }

  function matrixProductChannelCell(sku, ka) {
    const values = months().map(month => qty(sku.id, ka.id, month))
    const beforeValues = months().map(month => baselineQty(sku.id, ka.id, month))
    const hasData = values.some(value => value != null) || beforeValues.some(value => value != null)
    if (!hasData) return h('td.forecast-matrix-cell.empty', '—')
    const current = values.reduce((sum, value) => sum + (value || 0), 0)
    const before = beforeValues.reduce((sum, value) => sum + (value || 0), 0)
    const variance = percentage(current, before)
    const changed = values.some((value, index) => value !== beforeValues[index] && !(value == null && beforeValues[index] == null))
    const risk = Math.abs(variance) >= 10
    return h('td.forecast-matrix-cell' + (changed ? '.changed' : '') + (risk ? '.risk' : ''), matrixValueContent(values, current, variance, false))
  }

  function matrixValueContent(values, current, variance, isTotal) {
    return h('div.forecast-matrix-values', [
      st.matrixMonthly ? h('div.forecast-matrix-months', values.map(value => h('span', value == null ? '—' : S.fmtNum(value)))) : null,
      h('div.forecast-matrix-cell-total', [h('strong', S.fmtNum(current)), h('small', { class: varianceClass(variance) }, varianceText(variance))]),
      isTotal ? null : (Math.abs(variance) >= 10 ? h('span.forecast-matrix-alert', '▲') : null),
    ])
  }

  function matrixInsightRibbon(groups, products, rows, total, before) {
    const channels = groups.flatMap(group => group.channels).sort((a, b) => b.current - a.current)
    const topChannel = channels[0]
    const productData = productStats(rows)
    const topGrowth = productData.slice().sort((a, b) => b.variance - a.variance)[0]
    const topRisk = productData.slice().sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))[0]
    return h('div.forecast-matrix-insights', [
      h('div', [h('strong', topChannel ? topChannel.ka.name + '贡献' + Math.round(topChannel.current / Math.max(total, 1) * 100) + '%' : '暂无渠道数据'), h('span', '三个月预测渠道贡献最高')]),
      h('div', [h('strong', topGrowth ? topGrowth.sku.code + '较上版' + varianceText(topGrowth.variance) : '暂无产品变化'), h('span', '评审增长与活动支撑')]),
      h('div', [h('strong', topRisk ? topRisk.sku.code + '需要供应复核' : '供应覆盖正常'), h('span', '市场整体较上版 ' + varianceText(percentage(total, before)))]),
    ])
  }

  function countryProductMatrixReview(rows) {
    const markets = st.countries.map(market => {
      const marketRows = rows.filter(row => row.country && row.country.id === market.id)
      const current = months().reduce((sum, month) => sum + rowsTotal(marketRows, month), 0)
      const before = months().reduce((sum, month) => sum + rowsBaseline(marketRows, month), 0)
      return { market, rows: marketRows, current, before }
    })
    const products = matrixProducts(rows)
    const total = months().reduce((sum, month) => sum + rowsTotal(rows, month), 0)
    const before = months().reduce((sum, month) => sum + rowsBaseline(rows, month), 0)

    return h('div.forecast-matrix-review', [
      h('div.forecast-matrix-toolbar', [
        h('div', [
          h('strong', '国家 × 产品预测全景'),
          h('span', markets.length + '个市场 · ' + products.length + '个产品 · 三个月区域预测同屏评审'),
        ]),
        h('span.grow'),
        S.toggle(st.matrixMonthly, '显示月度明细', value => { st.matrixMonthly = value; paint() }),
        S.toggle(st.matrixShowAllProducts, '查看所有产品', value => { st.matrixShowAllProducts = value; paint() }),
        S.toggle(st.matrixOnlyChanged, '仅看变动产品', value => { st.matrixOnlyChanged = value; paint() }),
        S.toggle(st.matrixOnlyRisk, '仅看异常产品', value => { st.matrixOnlyRisk = value; paint() }),
      ]),
      h('section.card.forecast-matrix-card', countryProductMatrix(markets, products, rows)),
      countryMatrixInsightRibbon(markets, rows, total, before),
    ])
  }

  function countryProductMatrix(markets, products, rows) {
    const headTop = h('tr', [
      h('th.forecast-matrix-product', { rowspan: 2 }, '产品 / SKU'),
      h('th.forecast-matrix-lifecycle', { rowspan: 2 }, '生命周期'),
      ...markets.map(item => h('th.forecast-matrix-country-group', h('button.forecast-matrix-country-button', {
        type: 'button',
        title: '查看' + item.market.name_zh + '市场预测明细',
        onclick: () => openCountryForecastDetail(item, rows),
      }, [
        h('strong', item.market.code + ' · ' + item.market.name_zh),
        h('small', S.fmtNum(item.current) + ' · ' + varianceText(percentage(item.current, item.before))),
        h('span', '查看国家明细'),
      ]))),
      h('th.forecast-matrix-total', { rowspan: 2 }, [h('span', '产品合计'), h('small', '较上版')]),
    ])
    const headMarkets = h('tr', markets.map(item => h('th.forecast-matrix-country', [
      h('strong', item.market.code),
      st.matrixMonthly ? h('small', months().map(month => S.monthLabel(S.ym(month))).join(' / ') + ' / 合计') : h('small', '三个月合计'),
    ])))
    const body = products.length
      ? h('tbody', products.map(sku => countryMatrixProductRow(sku, markets, rows)))
      : h('tbody', h('tr', h('td.forecast-empty', { colspan: markets.length + 3 }, '当前筛选下没有产品。')))
    const marketTotalCells = markets.map(item => {
      const values = months().map(month => rowsTotal(item.rows, month))
      return h('td.forecast-matrix-cell.total', matrixValueContent(values, item.current, percentage(item.current, item.before), true))
    })
    const foot = h('tfoot', h('tr', [
      h('td', { colspan: 2 }, [h('strong', '区域合计'), h('small', markets.length + ' 个市场 · ' + products.length + ' 个SKU')]),
      ...marketTotalCells,
      h('td.forecast-matrix-grand-total', [h('strong', S.fmtNum(months().reduce((sum, month) => sum + rowsTotal(rows, month), 0))), h('small', varianceText(percentage(
        months().reduce((sum, month) => sum + rowsTotal(rows, month), 0),
        months().reduce((sum, month) => sum + rowsBaseline(rows, month), 0)
      )))]),
    ]))

    return h('div.forecast-matrix-scroll', h('table.forecast-channel-product-matrix.forecast-country-product-matrix', {
      style: { minWidth: Math.max(900, 282 + markets.length * 126) + 'px' },
    }, [h('thead', [headTop, headMarkets]), body, foot]))
  }

  function countryMatrixProductRow(sku, markets, rows) {
    const productRows = rows.filter(row => row.sku.id === sku.id)
    const current = months().reduce((sum, month) => sum + rowsTotal(productRows, month), 0)
    const before = months().reduce((sum, month) => sum + rowsBaseline(productRows, month), 0)
    const variance = percentage(current, before)
    return h('tr', [
      h('td.forecast-matrix-product', [h('strong', sku.code), h('span', sku.name || '—'), h('small', sku.category || '—')]),
      h('td.forecast-matrix-lifecycle', S.badge(sku.lifecycle === 'npi' ? 'blue' : sku.lifecycle === 'eol' ? 'gray' : 'green', LIFECYCLE[sku.lifecycle] || sku.lifecycle || '—')),
      ...markets.map(item => countryMatrixProductCell(sku, item, rows)),
      h('td.forecast-matrix-grand-total', [h('strong', S.fmtNum(current)), h('small', { class: varianceClass(variance) }, varianceText(variance))]),
    ])
  }

  function countryMatrixProductCell(sku, marketItem, rows) {
    const productRows = rows.filter(row => row.country && row.country.id === marketItem.market.id && row.sku.id === sku.id)
    const values = months().map(month => rowsTotal(productRows, month))
    const beforeValues = months().map(month => rowsBaseline(productRows, month))
    const hasData = productRows.length > 0
    if (!hasData) return h('td.forecast-matrix-cell.empty', '—')
    const current = values.reduce((sum, value) => sum + value, 0)
    const before = beforeValues.reduce((sum, value) => sum + value, 0)
    const variance = percentage(current, before)
    const changed = values.some((value, index) => value !== beforeValues[index])
    const risk = Math.abs(variance) >= 10
    return h('td.forecast-matrix-cell' + (changed ? '.changed' : '') + (risk ? '.risk' : ''), matrixValueContent(values, current, variance, false))
  }

  function countryMatrixInsightRibbon(markets, rows, total, before) {
    const topMarket = markets.slice().sort((a, b) => b.current - a.current)[0]
    const productData = productStats(rows)
    const topGrowth = productData.slice().sort((a, b) => b.variance - a.variance)[0]
    const topRisk = productData.slice().sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))[0]
    return h('div.forecast-matrix-insights', [
      h('div', [h('strong', topMarket ? topMarket.market.name_zh + '贡献' + Math.round(topMarket.current / Math.max(total, 1) * 100) + '%' : '暂无市场数据'), h('span', '三个月预测市场贡献最高')]),
      h('div', [h('strong', topGrowth ? topGrowth.sku.code + '较上版' + varianceText(topGrowth.variance) : '暂无产品变化'), h('span', '跨市场产品增长变化')]),
      h('div', [h('strong', topRisk ? topRisk.sku.code + '需要区域复核' : '区域预测稳定'), h('span', '全部市场较上版 ' + varianceText(percentage(total, before)))]),
    ])
  }

  function countryForecastRows(marketItem, rows, includeMissing) {
    return activeSkus().filter(matrixProductMatchesFilters).map(sku => {
      const productRows = rows.filter(row => row.country && row.country.id === marketItem.market.id && row.sku.id === sku.id)
      const values = months().map(month => rowsTotal(productRows, month))
      const beforeValues = months().map(month => rowsBaseline(productRows, month))
      const hasData = productRows.length > 0
      const current = values.reduce((sum, value) => sum + value, 0)
      const before = beforeValues.reduce((sum, value) => sum + value, 0)
      return { sku, values, hasData, current, before, variance: percentage(current, before) }
    }).filter(row => includeMissing || row.hasData)
  }

  function countryForecastStatus(row) {
    if (!row.hasData) return S.badge('gray', '未纳入预测')
    if (Math.abs(row.variance) >= 10) return S.badge('red', '重点复核')
    return S.badge('green', '有预测')
  }

  function openCountryForecastDetail(marketItem, rows) {
    const overlay = S.overlay('modal', { title: marketItem.market.code + ' · ' + marketItem.market.name_zh + '预测明细' })
    overlay.panel.classList.add('forecast-channel-detail-modal')
    let includeMissing = st.matrixShowAllProducts
    const marketRows = rows.filter(row => row.country && row.country.id === marketItem.market.id)
    const fdCount = new Set(marketRows.map(row => row.group.id)).size
    const channelCount = new Set(marketRows.map(row => row.ka.id)).size

    const renderDetail = () => {
      const detailRows = countryForecastRows(marketItem, rows, includeMissing)
      const allRows = countryForecastRows(marketItem, rows, true)
      const missingCount = allRows.filter(row => !row.hasData).length
      const current = detailRows.reduce((sum, row) => sum + row.current, 0)
      const before = detailRows.reduce((sum, row) => sum + row.before, 0)
      S.clear(overlay.body)
      overlay.body.append(
        h('div.forecast-channel-detail-context', [
          h('div', [h('span', '国家 / 市场'), h('strong', marketItem.market.code + ' · ' + marketItem.market.name_zh)]),
          h('div', [h('span', '渠道覆盖'), h('strong', fdCount + ' FD · ' + channelCount + ' Retailer')]),
          h('div', [h('span', '产品覆盖'), h('strong', (allRows.length - missingCount) + ' / ' + allRows.length + ' 个产品')]),
          h('div', [h('span', '三个月预测'), h('strong', S.fmtNum(current) + ' · ' + varianceText(percentage(current, before)))]),
        ]),
        h('div.forecast-channel-detail-tools', [
          h('span', detailRows.length + '个产品 · ' + missingCount + '个尚未纳入该市场预测'),
          h('button.btn.sm', { type: 'button', onclick: () => { includeMissing = !includeMissing; renderDetail() } }, includeMissing ? '仅看已有预测' : '显示全部产品'),
        ]),
        h('div.forecast-channel-detail-table-wrap', h('table.forecast-channel-detail-table', [
          h('thead', h('tr', [
            h('th', '产品 / SKU'),
            h('th', '生命周期'),
            ...months().map(month => h('th.num', S.monthLabel(S.ym(month)))),
            h('th.num', '三个月合计'),
            h('th.num', '较上版'),
            h('th', '状态'),
          ])),
          h('tbody', detailRows.map(row => h('tr' + (!row.hasData ? '.forecast-channel-missing-row' : ''), [
            h('td', [h('strong', row.sku.code), h('span', row.sku.name || '—')]),
            h('td', LIFECYCLE[row.sku.lifecycle] || row.sku.lifecycle || '—'),
            ...row.values.map(value => h('td.num', row.hasData ? S.fmtNum(value) : '—')),
            h('td.num.strong', row.hasData ? S.fmtNum(row.current) : '—'),
            h('td.num', h('span', { class: varianceClass(row.variance) }, row.hasData ? varianceText(row.variance) : '—')),
            h('td', countryForecastStatus(row)),
          ]))),
        ])),
      )
    }

    renderDetail()
    overlay.foot.append(
      h('button.btn', { onclick: () => S.toast(marketItem.market.name_zh + '市场明细已导出') }, '导出国家明细'),
      h('button.btn.primary', { onclick: overlay.close }, '完成'),
    )
  }

  function channelForecastRows(item, includeMissing) {
    return activeSkus().filter(matrixProductMatchesFilters).map(sku => {
      const values = months().map(month => qty(sku.id, item.ka.id, month))
      const beforeValues = months().map(month => baselineQty(sku.id, item.ka.id, month))
      const hasData = values.some(value => value != null) || beforeValues.some(value => value != null)
      const current = values.reduce((sum, value) => sum + (value || 0), 0)
      const before = beforeValues.reduce((sum, value) => sum + (value || 0), 0)
      return {
        sku,
        values,
        hasData,
        current,
        before,
        variance: percentage(current, before),
        missing: values.filter(value => value == null).length,
      }
    }).filter(row => includeMissing || row.hasData)
  }

  function channelForecastStatus(row) {
    if (!row.hasData) return S.badge('gray', '未纳入预测')
    if (row.missing) return S.badge('amber', '待补充 ' + row.missing)
    if (Math.abs(row.variance) >= 10) return S.badge('red', '重点复核')
    return S.badge('green', '完整')
  }

  function openChannelForecastDetail(item) {
    const overlay = S.overlay('modal', { title: item.ka.name + ' · 渠道预测明细' })
    overlay.panel.classList.add('forecast-channel-detail-modal')
    let includeMissing = st.matrixShowAllProducts

    const renderDetail = () => {
      const detailRows = channelForecastRows(item, includeMissing)
      const allRows = channelForecastRows(item, true)
      const missingCount = allRows.filter(row => !row.hasData).length
      const current = detailRows.reduce((sum, row) => sum + row.current, 0)
      const before = detailRows.reduce((sum, row) => sum + row.before, 0)
      S.clear(overlay.body)
      overlay.body.append(
        h('div.forecast-channel-detail-context', [
          h('div', [h('span', '市场'), h('strong', country() ? country().code + ' · ' + country().name_zh : '—')]),
          h('div', [h('span', '供货FD'), h('strong', item.group.fd.name)]),
          h('div', [h('span', '渠道 / Retailer'), h('strong', item.ka.name)]),
          h('div', [h('span', '三个月预测'), h('strong', S.fmtNum(current) + ' · ' + varianceText(percentage(current, before)))]),
        ]),
        h('div.forecast-channel-detail-tools', [
          h('span', detailRows.length + '个产品 · ' + missingCount + '个尚未纳入该渠道预测'),
          h('button.btn.sm', {
            type: 'button',
            onclick: () => { includeMissing = !includeMissing; renderDetail() },
          }, includeMissing ? '仅看已有预测' : '显示全部产品'),
        ]),
        h('div.forecast-channel-detail-table-wrap', h('table.forecast-channel-detail-table', [
          h('thead', h('tr', [
            h('th', '产品 / SKU'),
            h('th', '生命周期'),
            ...months().map(month => h('th.num', S.monthLabel(S.ym(month)))),
            h('th.num', '三个月合计'),
            h('th.num', '较上版'),
            h('th', '状态'),
          ])),
          h('tbody', detailRows.map(row => h('tr' + (!row.hasData ? '.forecast-channel-missing-row' : ''), [
            h('td', [h('strong', row.sku.code), h('span', row.sku.name || '—')]),
            h('td', LIFECYCLE[row.sku.lifecycle] || row.sku.lifecycle || '—'),
            ...row.values.map(value => h('td.num', value == null ? '—' : S.fmtNum(value))),
            h('td.num.strong', S.fmtNum(row.current)),
            h('td.num', h('span', { class: varianceClass(row.variance) }, row.hasData ? varianceText(row.variance) : '—')),
            h('td', channelForecastStatus(row)),
          ]))),
        ])),
      )
    }

    renderDetail()
    overlay.foot.append(
      h('button.btn', { onclick: () => S.toast(item.ka.name + '渠道明细已导出') }, '导出渠道明细'),
      h('button.btn.primary', { onclick: overlay.close }, '完成'),
    )
  }

  function channelReview(rows) {
    const data = channelRowsData(rows)
    return h('div.forecast-focus-grid', [
      h('section.card.forecast-focus-main', [
        h('div.forecast-section-head', [h('h3', 'FD与Retailer贡献明细'), h('span', '当前预测与上版同口径比较')]),
        simpleTable((isAllMarkets() ? ['市场'] : []).concat(['FD', 'Retailer', '三个月预测', '上月版本', '变化', '评审说明']), data.map(item => [
          ...(isAllMarkets() ? [item.market] : []), item.fd, item.retailer, S.fmtNum(item.current), S.fmtNum(item.before), varianceNode(item.variance),
          Math.abs(item.variance) >= 10 ? '需销售说明' : '正常波动',
        ])),
      ]),
      h('section.card.forecast-focus-side', [h('div.forecast-section-head', h('h3', isAllMarkets() ? '市场贡献结构' : 'FD贡献结构')), isAllMarkets() ? marketContributionChart(marketSummaryData()) : fdContributionChart(rows)]),
    ])
  }
  function productReview(rows) {
    const data = productStats(rows)
    return h('section.card.forecast-full-review-table', [
      h('div.forecast-section-head', [h('h3', '产品预测变化'), h('span', data.length + '个SKU')]),
      simpleTable(['型号', '产品', '生命周期', '当前预测', '上月版本', '变化量', '变化率', '销售说明'], data.map(item => [
        item.sku.code, item.sku.name, LIFECYCLE[item.sku.lifecycle] || item.sku.lifecycle || '—',
        S.fmtNum(item.current), S.fmtNum(item.before), S.fmtNum(item.delta), varianceNode(item.variance),
        findProductNote(item.sku.id) || (Math.abs(item.variance) >= 10 ? '待补充说明' : '正常滚动'),
      ])),
    ])
  }
  function findProductNote(skuId) {
    const match = Object.keys(st.notes).find(key => Number(key.split('|')[0]) === skuId && st.notes[key].note)
    return match ? st.notes[match].note : ''
  }
  function riskReview(risks) {
    return h('section.card.forecast-full-review-table', [
      h('div.forecast-section-head', [h('h3', '变动与风险清单'), h('span', risks.length + '项待处理')]),
      simpleTable(['级别', '类型', '事项', '影响', '责任人', '下一步'], risks.map(item => [
        S.badge(item.level, item.level === 'red' ? '高' : '中'), item.type, item.subject, item.impact, item.owner, item.action,
      ])),
    ])
  }

  function reviewFooter() {
    const comment = h('textarea', {
      rows: 2, placeholder: '输入整体评审结论、退回原因或后续协调事项…', value: st.reviewComment,
      oninput: event => { st.reviewComment = event.target.value; scheduleSave() },
    })
    return h('div.forecast-review-actions', [
      h('label', [h('span', '总体评审意见'), comment]),
      h('span.grow'),
      h('button.btn', { onclick: () => { st.view = 'entry'; paint(); S.toast('已退回销售修改') } }, '退回销售修改'),
      h('button.btn.primary', { onclick: () => S.toast('整体评审已通过 · 本地测试') }, '整体评审通过'),
    ])
  }

  function previousReviewTab() {
    const tabs = REVIEW_TABS
    const index = tabs.findIndex(tab => tab.v === st.reviewTab)
    st.reviewTab = tabs[Math.max(0, index - 1)].v
    paint()
  }
  function nextReviewTab() {
    const tabs = REVIEW_TABS
    const index = tabs.findIndex(tab => tab.v === st.reviewTab)
    st.reviewTab = tabs[Math.min(tabs.length - 1, index + 1)].v
    paint()
  }
  function requestReviewFullscreen() {
    const target = document.documentElement
    if (document.fullscreenElement) return
    if (target && target.requestFullscreen) target.requestFullscreen().catch(() => S.toast('浏览器未允许全屏'))
    else S.toast('当前浏览器不支持全屏评审')
  }

  function bindReviewKeyboard() {
    if (reviewKeyboardBound) return
    reviewKeyboardBound = true
    document.addEventListener('fullscreenchange', () => {
      document.documentElement.classList.toggle('forecast-review-fullscreen', Boolean(document.fullscreenElement))
    })
    document.addEventListener('keydown', event => {
      const fullscreenActive = Boolean(document.fullscreenElement) || document.documentElement.classList.contains('forecast-review-fullscreen')
      if (!fullscreenActive || !st || st.view !== 'review' || !ROOT || !ROOT.isConnected) return
      if (event.key === 'Escape') {
        setTimeout(() => {
          if (!document.fullscreenElement) document.documentElement.classList.remove('forecast-review-fullscreen')
        }, 0)
        return
      }
      if (event.target && event.target.closest && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp']
      const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown']
      if (!previousKeys.includes(event.key) && !nextKeys.includes(event.key)) return
      event.preventDefault()
      if (previousKeys.includes(event.key)) previousReviewTab()
      else nextReviewTab()
    })
  }

  function openCreateModal() {
    const overlay = S.overlay('modal', { title: '发起三个月滚动预测' })
    const start = h('input', { type: 'month', value: '2026-09' })
    overlay.body.append(
      h('p.muted', '新周期继承相同日历月份的上版预测作为参考，新增月份保持待填写。'),
      h('label.forecast-modal-field', [h('span', '起始月份'), start]),
      h('div.forecast-rollover-preview', '窗口：2026年9月–11月 · 基准：2026年8月发布版 · 默认3个月'),
    )
    overlay.foot.append(
      h('button.btn', { onclick: overlay.close }, '取消'),
      h('button.btn.primary', { onclick: () => { overlay.close(); S.toast('新周期草稿已创建 · 本地测试') } }, '创建草稿'),
    )
  }

  window.Modules = window.Modules || {}
  window.Modules.forecast = { render }
})()

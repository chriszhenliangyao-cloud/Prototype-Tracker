/* Prototype Management — local native integration test. */
(function () {
  'use strict'

  const h = S.h
  const STORAGE_KEY = 'erp-native-prototype-management.v1'
  const REFERENCE_DATE = '2026-08-08'
  let ROOT

  const stageLabels = { trial: '试产', dvt2: 'DVT2', dvt1: 'DVT1', kickoff: '项目立项' }
  const statusLabels = { delayed: '运输延误', testing: '测试中', received: '已签收', completed: '已完成', planned: '未开始', transit: '运输中', loaned: '借用中' }
  const statusTones = { delayed: 'red', testing: 'amber', received: 'blue', completed: 'green', planned: 'gray', transit: 'blue', loaned: 'amber' }

  function seedState() {
    const projects = [
      project('PX51', 'MagPro Neo 10K Qi2.0', 'trial', '2026-08-22', 'DVT2 工程样机', 'DVT2', 6, 3, 'delayed', '运输延误', '在库 1 · 运输中 2', '深圳 1 · 法国 2', 'CN → FR · DHL', 'ETA 8月12日 · 延误2天', '2026-08-10', 'Evan', 'red', 'DHL清关资料待补充，影响质量验证与拍摄排期。'),
      project('WAL101', 'Leopard Fold Charger 100W', 'dvt2', '2026-09-20', '认证 / 展示样机', '认证', 5, 3, 'testing', '测试中', '实验室 2 · 借出 1', 'Munich Lab · Nina', '送检 · EVT-2608-14', '预计8月16日完成', '2026-08-16', 'Nina', 'amber', '认证样机借用即将到期，归还后需转交销售团队。'),
      project('WM321', 'MagPro 3-in-1 Station', 'dvt2', '2026-10-16', '拍摄 / 渠道样机', '市场', 7, 5, 'received', '已签收', '法国办公室 5', '可用 2 · 已预约 3', 'FR仓 → Paris Office', '8月8日 · 已签收', '2026-08-14', 'Evan', 'green', ''),
      project('PM61-Black', 'MagPro Slim 10K Qi2.2', 'dvt1', '2026-11-05', '工程验证样机', '研发', 4, 4, 'completed', '已完成', '研发 2 · 质量 2', '状态良好', '样机归档', '8月5日 · Evan确认', '2026-08-05', 'Evan', 'green', ''),
      project('P51L-P2', 'Pocket 20K 45W Refresh', 'kickoff', '2026-12-03', '样机计划', '待确认', 4, 0, 'planned', '未开始', '尚未生成实物', '数量待锁定', '暂无流转', '下一步：确认需求', '2026-09-05', 'Evan', 'amber', '样机收件人与用途尚未确认。')
    ]

    return {
      tab: 'overview',
      filters: { search: '', stage: 'all', type: 'all', status: 'all', owner: 'all', riskOnly: false },
      projects,
      loans: [
        { id: 'LOAN-260801-03', projectId: 'WAL101', unitId: 'WAL101-CERT-003', holder: 'Nina', purpose: 'EU插头认证预检', checkout: '2026-08-01', due: '2026-08-13', returned: '', status: 'open' },
        { id: 'LOAN-260803-07', projectId: 'WM321', unitId: 'WM321-MKT-002', holder: 'Lena', purpose: '产品拍摄', checkout: '2026-08-03', due: '2026-08-16', returned: '', status: 'open' },
        { id: 'LOAN-260725-01', projectId: 'PM61-Black', unitId: 'PM61-DVT1-002', holder: 'Marta', purpose: '质量验证', checkout: '2026-07-25', due: '2026-08-04', returned: '2026-08-04', status: 'returned' }
      ],
      history: [
        history('2026-08-08 10:20', 'Evan', 'WM321', '登记签收', '5件样机已由Paris Office签收', 'MOVE-260808-04'),
        history('2026-08-07 16:42', 'Evan', 'PX51', '更新预计到达', 'DHL ETA由8月10日调整为8月12日；记录清关延误', 'MOVE-260806-02'),
        history('2026-08-05 14:18', 'Evan', 'PM61-Black', '完成样机任务', '4件工程验证样机完成并归档', 'REQ-260721-06'),
        history('2026-08-03 09:30', 'Lena', 'WM321', '登记借出', 'WM321-MKT-002借出用于产品拍摄', 'LOAN-260803-07')
      ]
    }
  }

  function project(id, name, stage, launch, requirement, type, demand, ready, status, node, quantity, location, movement, movementMeta, due, owner, health, blocker) {
    const units = Array.from({ length: ready }, (_, index) => ({ id: `${id}-${type.replace(/\W/g, '').slice(0, 5).toUpperCase()}-${String(index + 1).padStart(3, '0')}`, status: status === 'completed' ? '已归档' : status === 'transit' ? '运输中' : '可用', location: index % 2 ? '法国办公室' : '深圳样机库' }))
    return {
      id, name, stage, launch, requirement, type, demand, ready, status, node, quantity, location, movement, movementMeta, due, owner, health, blocker,
      requirements: [{ id: `REQ-${id}-01`, type, name: requirement, quantity: demand, purpose: type, due, owner, status: ready >= demand ? 'Completed' : 'In Progress' }],
      units,
      movements: [{ id: `MOVE-${id}-01`, date: due < REFERENCE_DATE ? due : '2026-08-08', action: movement, quantity: ready, from: movement.includes('→') ? movement.split('→')[0].trim() : '样机库', to: movement.includes('→') ? movement.split('→')[1].split('·')[0].trim() : location, owner, note: movementMeta }]
    }
  }

  function history(time, actor, projectId, action, detail, ref) { return { time, actor, projectId, action, detail, ref } }

  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
      return saved && Array.isArray(saved.projects) ? saved : seedState()
    } catch (error) {
      return seedState()
    }
  }

  let st = loadState()
  const projectById = id => st.projects.find(item => item.id === id)
  const todayLabel = iso => iso ? `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日` : '--'
  const pct = project => project.demand ? Math.min(100, Math.round(project.ready / project.demand * 100)) : 0
  const overdueDays = due => Math.max(0, Math.floor((new Date(`${REFERENCE_DATE}T00:00:00Z`) - new Date(`${due}T00:00:00Z`)) / 86400000))

  function save() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(st))
  }

  function addHistory(projectId, action, detail, ref) {
    st.history.unshift(history('2026-08-08 15:24', 'payton.ppc', projectId, action, detail, ref))
  }

  function render(root) {
    ROOT = root
    paint()
  }

  function paint() {
    S.clear(ROOT)
    const workspace = h('div.prototype-workspace')
    workspace.append(header(), viewTabs(), filterBar(), kpis())
    if (st.tab === 'overview') workspace.append(overview())
    else if (st.tab === 'movements') workspace.append(movementView())
    else if (st.tab === 'loans') workspace.append(loanView())
    else workspace.append(historyView())
    workspace.append(syncBand())
    ROOT.append(workspace)
  }

  function header() {
    return S.pageHeader({
      overline: '专业与管理 · PROTOTYPE OPERATIONS',
      title: '样机管理',
      pill: { text: '本地会话自动保存', color: 'var(--c-success)' },
      actions: [
        h('button.btn', { onclick: () => { window.location.hash = '#module=functions' } }, '返回职能工作台'),
        h('button.btn', { onclick: exportLedger }, '导出样机台账'),
        h('button.btn', { onclick: () => S.toast('项目跟进入口将在正式集成时连接') }, '打开项目跟进'),
        h('button.btn.primary', { onclick: openRequirementModal }, '＋ 新建样机需求')
      ]
    })
  }

  function viewTabs() {
    const tabs = [
      ['overview', '项目总览'],
      ['movements', '样机流转'],
      ['loans', '借用与归还'],
      ['history', '历史记录']
    ]
    return h('nav.prototype-view-tabs', { role: 'tablist', 'aria-label': '样机管理视图' }, tabs.map(([value, label]) => h('button', {
      class: st.tab === value ? 'active' : '', role: 'tab', 'aria-selected': String(st.tab === value), dataset: { prototypeTab: value }, onclick: () => { st.tab = value; save(); paint() }
    }, label)))
  }

  function filterBar() {
    const stages = ['all', ...new Set(st.projects.map(project => project.stage))]
    const types = ['all', ...new Set(st.projects.map(project => project.type))]
    const statuses = ['all', ...new Set(st.projects.map(project => project.status))]
    const owners = ['all', ...new Set(st.projects.map(project => project.owner))]
    const filters = st.filters
    const text = h('input', { value: filters.search, placeholder: '输入或选择项目 / 型号', list: 'prototypeProjectOptions', onchange: event => updateFilter('search', event.target.value) })
    const list = h('datalist', { id: 'prototypeProjectOptions' }, st.projects.map(project => h('option', { value: project.id }, project.name)))
    return h('section.prototype-filterbar', { 'aria-label': '样机管理筛选' }, [
      filterField('项目 / 型号', [text, list]),
      filterField('项目阶段', select(stages, filters.stage, value => updateFilter('stage', value), value => value === 'all' ? '全部阶段' : stageLabels[value])),
      filterField('样机类型', select(types, filters.type, value => updateFilter('type', value), value => value === 'all' ? '全部类型' : value)),
      filterField('流转状态', select(statuses, filters.status, value => updateFilter('status', value), value => value === 'all' ? '全部状态' : statusLabels[value])),
      filterField('负责人', select(owners, filters.owner, value => updateFilter('owner', value), value => value === 'all' ? '全部负责人' : value)),
      h('div.prototype-risk-toggle', S.toggle(filters.riskOnly, '仅看异常', value => updateFilter('riskOnly', value)))
    ])
  }

  function filterField(label, child) { return h('label.prototype-filter', [h('span', label), child]) }
  function select(values, selected, onChange, labelFor) {
    return h('select', { onchange: event => onChange(event.target.value) }, values.map(value => h('option', { value, selected: value === selected }, labelFor(value))))
  }
  function updateFilter(key, value) { st.filters[key] = value; save(); paint() }

  function filteredProjects() {
    const f = st.filters
    const keyword = String(f.search || '').trim().toLowerCase()
    return st.projects.filter(project => {
      if (keyword && !`${project.id} ${project.name} ${project.owner} ${project.requirement}`.toLowerCase().includes(keyword)) return false
      if (f.stage !== 'all' && project.stage !== f.stage) return false
      if (f.type !== 'all' && project.type !== f.type) return false
      if (f.status !== 'all' && project.status !== f.status) return false
      if (f.owner !== 'all' && project.owner !== f.owner) return false
      if (f.riskOnly && !['red', 'amber'].includes(project.health)) return false
      return true
    }).sort((a, b) => riskRank(a.health) - riskRank(b.health) || a.due.localeCompare(b.due))
  }

  const riskRank = value => value === 'red' ? 0 : value === 'amber' ? 1 : 2

  function kpis() {
    const projects = filteredProjects()
    const demand = projects.reduce((sum, project) => sum + project.demand, 0)
    const ready = projects.reduce((sum, project) => sum + project.ready, 0)
    const inTransit = projects.filter(project => ['transit', 'delayed'].includes(project.status)).reduce((sum, project) => sum + Math.max(1, project.ready - project.units.filter(unit => unit.status === '可用').length), 0)
    const openLoans = st.loans.filter(loan => loan.status === 'open' && projects.some(project => project.id === loan.projectId)).length
    const risks = projects.filter(project => ['red', 'amber'].includes(project.health)).length
    return h('section.prototype-kpis', { 'aria-label': '样机管理摘要' }, [
      kpi('样机项目', projects.length, '当前筛选范围'),
      kpi('需求 / 已备齐', `${demand} / ${ready}`, `整体准备度 ${demand ? Math.round(ready / demand * 100) : 0}%`),
      kpi('运输中', inTransit, '按最新流转状态'),
      kpi('待归还', openLoans, `${st.loans.filter(loan => loan.status === 'open' && loan.due <= '2026-08-15').length}件未来7天到期`),
      kpi('异常样机', risks, `阻塞 ${projects.filter(project => project.health === 'red').length} · 预警 ${projects.filter(project => project.health === 'amber').length}`, risks ? 'danger' : '')
    ])
  }

  function kpi(label, value, foot, tone) { return h('div.prototype-kpi', { class: tone || '' }, [h('span', label), h('strong', value), h('small', foot)]) }

  function overview() {
    const projects = filteredProjects()
    return h('div.prototype-overview-grid', [ledgerPanel(projects), exceptionPanel(projects)])
  }

  function ledgerPanel(projects) {
    const columns = [16, 12, 13, 12, 14, 15, 10, 8]
    const table = h('table.prototype-table', [
      h('colgroup', columns.map(width => h('col', { style: { width: `${width}%` } }))),
      h('thead', h('tr', ['项目 / 产品', '样机需求', '准备度', '当前节点', '数量 / 位置', '最近流转', 'DDL / 负责人', '操作'].map(label => h('th', label)))),
      h('tbody', projects.length ? projects.map(projectRow) : h('tr', h('td.prototype-empty', { colspan: 8 }, '没有符合筛选条件的样机项目。')))
    ])
    return panel('项目样机台账', `${projects.length}个项目 · 按风险与DDL排序`, h('div.prototype-table-scroll', table))
  }

  function projectRow(project) {
    const progress = pct(project)
    const rowClass = project.health === 'red' ? 'risk' : project.health === 'amber' ? 'watch' : ''
    const overdue = overdueDays(project.due)
    return h('tr', { class: rowClass, dataset: { prototypeProject: project.id } }, [
      h('td.prototype-project-cell', [h('strong.prototype-model', project.id), h('strong', project.name), h('small', `${stageLabels[project.stage]} · ${todayLabel(project.launch)}上市`)]),
      h('td', [h('strong', project.requirement), h('small', `需求 ${project.demand}件 · ${project.type}`)]),
      h('td', [h('div.prototype-readiness', [h('div.prototype-readiness-bar', h('span', { style: { width: `${progress}%` } })), h('strong', `${project.ready}/${project.demand}`)]), h('small', progress >= 100 ? '全部备齐' : `${project.demand - project.ready}件待准备`)]),
      h('td', [S.badge(statusTones[project.status] || 'gray', project.node), h('small', project.blocker || '按计划推进')]),
      h('td', [h('strong', project.quantity), h('small', project.location)]),
      h('td', h('div.prototype-movement-cell', [h('strong', project.movement), h('small', project.movementMeta)])),
      h('td', [h('strong', { class: overdue && project.status !== 'completed' ? 'neg' : '' }, project.status === 'completed' ? '已完成' : todayLabel(project.due)), h('small', project.owner)]),
      h('td', h('div.prototype-actions', h('button.btn.sm', { class: project.health === 'red' ? 'primary' : '', onclick: () => openProjectDrawer(project.id) }, project.health === 'red' ? '处理' : project.status === 'planned' ? '配置' : '查看')))
    ])
  }

  function exceptionPanel(projects) {
    const exceptions = projects.filter(project => ['red', 'amber'].includes(project.health))
    const body = h('div', [
      h('div.prototype-queue-tabs', [S.badge('red', `阻塞 ${exceptions.filter(item => item.health === 'red').length}`), S.badge('amber', `临期 ${exceptions.filter(item => item.health === 'amber').length}`), S.badge('gray', `全部 ${exceptions.length}`)]),
      ...(exceptions.length ? exceptions.map(project => h('article.prototype-queue-item', [
        h('div.prototype-queue-top', [S.badge(statusTones[project.status] || 'gray', project.node), h('strong', { class: project.health === 'red' ? 'neg' : '' }, overdueDays(project.due) ? `逾期${overdueDays(project.due)}天` : todayLabel(project.due))]),
        h('h3', `${project.id} · ${project.requirement}`),
        h('p', project.blocker || '存在待确认事项。'),
        h('div.prototype-queue-foot', [h('span', `${project.owner} · DDL ${todayLabel(project.due)}`), h('button.btn.sm', { class: project.health === 'red' ? 'primary' : '', onclick: () => openProjectDrawer(project.id) }, project.health === 'red' ? '处理' : '查看')])
      ])) : [h('div.prototype-empty', '当前筛选范围没有异常。')])
    ])
    return panel('异常与临期', `${exceptions.length}项`, body)
  }

  function movementView() {
    const rows = filteredProjects().flatMap(project => project.movements.map(movement => ({ ...movement, project }))).sort((a, b) => b.date.localeCompare(a.date))
    return dataTablePanel('样机流转记录', `${rows.length}条记录`, ['流转编号', '日期', '项目 / 型号', '动作', '数量', '起点', '终点', '负责人', '备注'], rows.map(row => [row.id, todayLabel(row.date), `${row.project.id} · ${row.project.name}`, row.action, `${row.quantity}件`, row.from, row.to, row.owner, row.note || '--']))
  }

  function loanView() {
    const visibleIds = new Set(filteredProjects().map(project => project.id))
    const rows = st.loans.filter(loan => visibleIds.has(loan.projectId)).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.due.localeCompare(b.due))
    return dataTablePanel('借用与归还台账', `${rows.filter(row => row.status === 'open').length}件待归还`, ['借用编号', '项目 / 样机编号', '持有人', '用途', '借出日期', '应归还', '实际归还', '状态', '操作'], rows.map(row => [
      row.id, `${row.projectId} · ${row.unitId}`, row.holder, row.purpose, todayLabel(row.checkout), todayLabel(row.due), row.returned ? todayLabel(row.returned) : '--', row.status === 'open' ? S.badge(row.due < REFERENCE_DATE ? 'red' : 'amber', '待归还') : S.badge('green', '已归还'), row.status === 'open' ? h('button.btn.sm', { onclick: () => quickReturn(row.id) }, '登记归还') : '--'
    ]))
  }

  function historyView() {
    const visibleIds = new Set(filteredProjects().map(project => project.id))
    const rows = st.history.filter(item => visibleIds.has(item.projectId))
    return dataTablePanel('不可覆盖的变更历史', `${rows.length}条记录 · 本地测试`, ['时间', '操作人', '项目 / 型号', '操作', '变更内容', '关联记录'], rows.map(row => [row.time, row.actor, row.projectId, row.action, row.detail, row.ref]))
  }

  function dataTablePanel(title, sub, headings, rows) {
    const table = h('table.prototype-table', [
      h('thead', h('tr', headings.map(label => h('th', label)))),
      h('tbody', rows.length ? rows.map(row => h('tr', row.map(cell => h('td', cell)))) : h('tr', h('td.prototype-empty', { colspan: headings.length }, '当前筛选范围没有记录。')))
    ])
    return h('div.prototype-data-table', panel(title, sub, h('div.prototype-table-scroll', table)))
  }

  function panel(title, sub, content) {
    return h('section.prototype-panel', [h('div.prototype-panel-head', [h('h2', title), h('span', sub)]), content])
  }

  function syncBand() {
    return h('section.prototype-sync-band', [
      syncNode('项目跟进', '项目、阶段、上市日期、样机准备度'), h('div.prototype-sync-arrow', '↔'),
      syncNode('样机管理 · 单一事实源', '需求、实物编号、寄送、签收、借用、归还与审计历史'), h('div.prototype-sync-arrow', '→'),
      syncNode('质量 / 研发 / 市场', '按用途接收任务与样机状态，不重复建账')
    ])
  }
  function syncNode(title, text) { return h('div', [h('strong', title), h('small', text)]) }

  function openRequirementModal() {
    const overlay = S.overlay('modal', { title: '新建样机需求' })
    const form = h('form.prototype-form-grid')
    const projectSelect = h('select', { name: 'projectId', required: true }, st.projects.map(project => h('option', { value: project.id }, `${project.id} · ${project.name}`)))
    form.append(
      formField('项目 / 型号', projectSelect),
      formField('样机类型', h('select', { name: 'type' }, ['DVT1', 'DVT2', '认证', '市场', '渠道', '质量'].map(value => h('option', { value }, value)))),
      formField('需求数量', h('input', { name: 'quantity', type: 'number', min: 1, value: 1, required: true })),
      formField('负责人', h('select', { name: 'owner' }, ['Evan', 'Nina', 'Leo', 'Marta', 'Lena'].map(value => h('option', { value }, value)))),
      formField('需求日期', h('input', { name: 'due', type: 'date', value: '2026-08-20', required: true })),
      formField('用途', h('input', { name: 'purpose', type: 'text', placeholder: '认证、拍摄、渠道演示或质量验证', required: true })),
      formField('需求说明', h('textarea', { name: 'note', placeholder: '收件人、版本、配件或特殊要求' }), true)
    )
    overlay.body.append(form)
    overlay.foot.append(h('span.prototype-autosave-note', '● 输入自动保留在当前会话'), h('button.btn', { onclick: overlay.close }, '取消'), h('button.btn.primary', { onclick: () => createRequirement(form, overlay) }, '创建需求'))
  }

  function formField(label, control, full) { return h('label.prototype-form-field', { class: full ? 'full' : '' }, [h('span', label), control]) }

  function createRequirement(form, overlay) {
    if (!form.reportValidity()) return
    const data = Object.fromEntries(new FormData(form).entries())
    const project = projectById(data.projectId)
    const quantity = Number(data.quantity) || 1
    const id = `REQ-${project.id}-${String(project.requirements.length + 1).padStart(2, '0')}`
    project.requirements.push({ id, type: data.type, name: `${data.type}样机`, quantity, purpose: data.purpose, due: data.due, owner: data.owner, status: 'Not Started', note: data.note })
    project.demand += quantity
    project.requirement = project.requirements.length > 1 ? `${project.requirements.length}类样机需求` : `${data.type}样机`
    project.type = data.type
    project.due = data.due
    project.owner = data.owner
    if (project.status === 'completed') project.status = 'planned'
    if (project.health === 'green') project.health = 'amber'
    project.node = '需求已创建'
    addHistory(project.id, '新建样机需求', `${data.type} ${quantity}件；用途：${data.purpose}`, id)
    save(); overlay.close(); paint(); S.toast('样机需求已创建并自动保存')
  }

  function openProjectDrawer(projectId) {
    const project = projectById(projectId)
    const overlay = S.overlay('drawer', { title: `${project.id} · 样机明细` })
    overlay.panel.classList.add('prototype-drawer')
    overlay.body.append(
      h('div.prototype-detail-grid', [detailTile('项目 / 产品', `${project.id} · ${project.name}`), detailTile('阶段 / 上市', `${stageLabels[project.stage]} · ${todayLabel(project.launch)}`), detailTile('样机准备度', `${project.ready}/${project.demand} · ${pct(project)}%`), detailTile('负责人 / DDL', `${project.owner} · ${todayLabel(project.due)}`)]),
      h('h4.prototype-section-title', '样机需求'),
      miniList(project.requirements.map(item => [item.name, `${item.quantity}件 · ${item.purpose || item.type} · ${item.owner} · ${todayLabel(item.due)}`, item.status])),
      h('h4.prototype-section-title', '实物样机'),
      miniList(project.units.length ? project.units.map(item => [item.id, item.location, item.status]) : [['尚未生成实物编号', '创建或签收样机后自动生成', '未开始']]),
      h('h4.prototype-section-title', '最近流转'),
      miniList(project.movements.slice(0, 5).map(item => [item.action, `${todayLabel(item.date)} · ${item.from} → ${item.to} · ${item.quantity}件`, item.owner]))
    )
    overlay.foot.append(h('span.prototype-autosave-note', '● 所有操作追加历史记录'), h('button.btn', { onclick: overlay.close }, '关闭'), h('button.btn.primary', { onclick: () => { overlay.close(); openMovementModal(project.id) } }, '记录样机操作'))
  }

  function detailTile(label, value) { return h('div.prototype-detail-tile', [h('span', label), h('strong', value)]) }
  function miniList(rows) { return h('div.prototype-mini-list', rows.map(row => h('div.prototype-mini-row', [h('div', [h('strong', row[0]), h('small', row[1])]), S.badge(row[2] === 'Completed' || row[2] === '已归档' || row[2] === '已归还' ? 'green' : row[2] === 'Blocked' ? 'red' : 'blue', row[2]) ]))) }

  function openMovementModal(projectId) {
    const project = projectById(projectId)
    const overlay = S.overlay('modal', { title: `记录样机操作 · ${project.id}` })
    const form = h('form.prototype-form-grid')
    form.append(
      formField('操作类型', h('select', { name: 'action' }, [['ship', '记录寄送'], ['receive', '登记签收'], ['loan', '登记借出'], ['return', '登记归还']].map(([value, label]) => h('option', { value }, label)))),
      formField('数量', h('input', { name: 'quantity', type: 'number', min: 1, value: 1, required: true })),
      formField('操作日期', h('input', { name: 'date', type: 'date', value: REFERENCE_DATE, required: true })),
      formField('负责人 / 持有人', h('input', { name: 'holder', type: 'text', value: project.owner, required: true })),
      formField('起点', h('input', { name: 'from', type: 'text', value: project.location.split('·')[0].trim() || '样机库', required: true })),
      formField('终点', h('input', { name: 'to', type: 'text', placeholder: '办公室、实验室、客户或持有人', required: true })),
      formField('物流 / 用途 / 备注', h('textarea', { name: 'note', placeholder: '承运商、追踪号、借用用途或归还状态' }), true)
    )
    overlay.body.append(form)
    overlay.foot.append(h('span.prototype-autosave-note', '● 保存后同步项目准备度'), h('button.btn', { onclick: overlay.close }, '取消'), h('button.btn.primary', { onclick: () => recordMovement(project, form, overlay) }, '保存操作'))
  }

  function recordMovement(project, form, overlay) {
    if (!form.reportValidity()) return
    const data = Object.fromEntries(new FormData(form).entries())
    const quantity = Number(data.quantity) || 1
    const actionLabels = { ship: '记录寄送', receive: '登记签收', loan: '登记借出', return: '登记归还' }
    const ref = `MOVE-${project.id}-${String(project.movements.length + 1).padStart(2, '0')}`
    project.movements.unshift({ id: ref, date: data.date, action: actionLabels[data.action], quantity, from: data.from, to: data.to, owner: data.holder, note: data.note })
    project.movement = `${data.from} → ${data.to}`
    project.movementMeta = `${todayLabel(data.date)} · ${data.note || actionLabels[data.action]}`
    project.location = data.to

    if (data.action === 'ship') {
      project.status = 'transit'; project.node = '运输中'; project.health = 'amber'
    } else if (data.action === 'receive') {
      project.ready = Math.min(project.demand, project.ready + quantity)
      for (let index = 0; index < quantity; index++) project.units.push({ id: `${project.id}-UNIT-${String(project.units.length + 1).padStart(3, '0')}`, status: '可用', location: data.to })
      project.status = project.ready >= project.demand ? 'completed' : 'received'
      project.node = project.ready >= project.demand ? '已完成' : '已签收'
      project.health = project.ready >= project.demand ? 'green' : 'amber'
    } else if (data.action === 'loan') {
      const unit = project.units.find(item => item.status === '可用') || { id: `${project.id}-UNIT-${String(project.units.length + 1).padStart(3, '0')}`, status: '借用中', location: data.to }
      if (!project.units.includes(unit)) project.units.push(unit)
      unit.status = '借用中'; unit.location = data.to
      const loanId = `LOAN-${project.id}-${String(st.loans.length + 1).padStart(2, '0')}`
      st.loans.unshift({ id: loanId, projectId: project.id, unitId: unit.id, holder: data.holder, purpose: data.note || '样机借用', checkout: data.date, due: project.due, returned: '', status: 'open' })
      project.status = 'loaned'; project.node = '借用中'
    } else {
      const loan = st.loans.find(item => item.projectId === project.id && item.status === 'open')
      if (loan) { loan.status = 'returned'; loan.returned = data.date }
      const unit = project.units.find(item => item.id === loan?.unitId)
      if (unit) { unit.status = '可用'; unit.location = data.to }
      project.status = project.ready >= project.demand ? 'completed' : 'received'
      project.node = project.ready >= project.demand ? '已完成' : '已签收'
    }
    addHistory(project.id, actionLabels[data.action], `${quantity}件 · ${data.from} → ${data.to}${data.note ? `；${data.note}` : ''}`, ref)
    save(); overlay.close(); paint(); S.toast(`${actionLabels[data.action]}已保存`)
  }

  function quickReturn(loanId) {
    const loan = st.loans.find(item => item.id === loanId)
    if (!loan || loan.status !== 'open') return
    loan.status = 'returned'; loan.returned = REFERENCE_DATE
    const project = projectById(loan.projectId)
    const unit = project.units.find(item => item.id === loan.unitId)
    if (unit) { unit.status = '可用'; unit.location = '样机库' }
    addHistory(project.id, '登记归还', `${loan.unitId}已由${loan.holder}归还`, loan.id)
    save(); paint(); S.toast('归还状态已更新')
  }

  function exportLedger() {
    const header = ['项目', '产品', '阶段', '上市日期', '样机需求', '需求数量', '已备齐', '状态', '位置', '负责人', 'DDL']
    const rows = filteredProjects().map(project => [project.id, project.name, stageLabels[project.stage], project.launch, project.requirement, project.demand, project.ready, statusLabels[project.status], project.location, project.owner, project.due])
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    link.download = '样机管理台账-本地测试.csv'
    link.click(); URL.revokeObjectURL(link.href)
    S.toast('样机台账已导出')
  }

  window.Modules = window.Modules || {}
  window.Modules.prototypeManagement = { render }
})()

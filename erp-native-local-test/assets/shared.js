/* Shared helpers for the demo modules. Vanilla, no deps. */
(function () {
  const S = {}

  // host system uses no emoji/flags — blank country flags so none render anywhere
  try { (window.DATA && window.DATA.country || []).forEach(c => { c.flag_emoji = '' }) } catch (e) { /* noop */ }

  // DOM builder: h('div.card', {onclick}, [children|string])
  S.h = function (tag, attrs, children) {
    let cls = ''
    const parts = tag.split('.')
    const name = parts[0] || 'div'
    if (parts.length > 1) cls = parts.slice(1).join(' ')
    const node = document.createElement(name)
    if (cls) node.className = cls
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs) && !(attrs instanceof Node)) {
      for (const k in attrs) {
        const v = attrs[k]
        if (v == null || v === false) continue
        if (k === 'class') node.className = (node.className ? node.className + ' ' : '') + v
        else if (k === 'html') node.innerHTML = v
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v)
        else if (k === 'dataset') Object.assign(node.dataset, v)
        else if (v === true) node.setAttribute(k, '')
        else node.setAttribute(k, v)
      }
    } else {
      children = attrs
    }
    S.append(node, children)
    return node
  }
  S.append = function (node, children) {
    if (children == null) return
    if (Array.isArray(children)) children.forEach(c => S.append(node, c))
    else if (children instanceof Node) node.appendChild(children)
    else node.appendChild(document.createTextNode(String(children)))
  }
  S.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild) }

  // number formats
  S.fmtNum = function (n) {
    if (n == null || isNaN(n)) return '0'
    return Math.round(n).toLocaleString('en-US')
  }
  S.fmtNumRaw = function (n) {
    if (n == null || isNaN(n)) return '–'
    return n.toLocaleString('en-US')
  }
  S.eur = function (v) { return '€' + S.fmtNum(v) }
  S.eur2 = function (v) { return '€' + (v == null || isNaN(v) ? '0.00' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) }
  S.pct = function (fc, ach) { if (fc > 0) return Math.round(ach / fc * 100); return ach > 0 ? null : 0 }
  S.pctText = function (p) { return p == null ? '∞' : p + '%' }
  S.money2 = function (v) { return v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

  // month helpers
  S.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  S.ym = function (dateStr) { return (dateStr || '').slice(0, 7) }
  S.addMonths = function (isoDate, n) {
    const d = new Date(isoDate + (isoDate.length === 7 ? '-01' : '').slice(0))
    const dt = new Date(isoDate.length === 7 ? isoDate + '-01' : isoDate)
    dt.setMonth(dt.getMonth() + n)
    const p = x => String(x).padStart(2, '0')
    return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-01'
  }
  S.monthLabel = function (ym) { const mo = parseInt((ym || '').slice(5, 7), 10); return S.MONTHS[mo - 1] || ym }

  // low-sat categorical palette (matches ERP _ops)
  S.PALETTE = ['#5b8def', '#52b788', '#9b8cce', '#e0a458', '#d98594', '#6cc3d5', '#c9a227', '#7aa095', '#b58db6', '#8a9bb0']

  // group + order by series (Other last, then desc size, then alpha) — matches ERP
  S.groupBySeries = function (skus) {
    const groups = {}
    for (const s of skus) { const k = (s.series || '').trim() || 'Other'; (groups[k] = groups[k] || []).push(s) }
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Other') return 1; if (b === 'Other') return -1
      const d = groups[b].length - groups[a].length; return d !== 0 ? d : a.localeCompare(b)
    })
    return keys.map(k => ({ series: k, items: groups[k] }))
  }

  // simple toast
  S.toast = function (msg) {
    const t = S.h('div.toast', msg); document.body.appendChild(t)
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300) }, 1800)
  }

  const NAVIGATION_CONTEXT_KEY = 'erp-native-module-navigation-context'
  S.navigate = function (moduleKey, context) {
    try {
      sessionStorage.setItem(NAVIGATION_CONTEXT_KEY, JSON.stringify({ moduleKey, context: context || {}, createdAt: Date.now() }))
    } catch (error) { /* session storage is optional in local file mode */ }
    const button = document.querySelector('[data-module="' + moduleKey + '"]')
    if (button) button.click()
  }
  S.consumeNavigationContext = function (moduleKey) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(NAVIGATION_CONTEXT_KEY) || 'null')
      if (!saved || saved.moduleKey !== moduleKey || Date.now() - saved.createdAt > 30000) return null
      sessionStorage.removeItem(NAVIGATION_CONTEXT_KEY)
      return saved.context || null
    } catch (error) { return null }
  }

  // modal/drawer scaffolding
  S.overlay = function (kind, opts) {
    const scrim = S.h('div.scrim')
    const panel = S.h('div.' + (kind === 'drawer' ? 'drawer' : 'modal'))
    const close = () => { scrim.remove(); panel.remove(); document.removeEventListener('keydown', onKey) }
    const onKey = e => { if (e.key === 'Escape') close() }
    scrim.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    const head = S.h('div.' + (kind === 'drawer' ? 'drawer-head' : 'modal-head'), [
      S.h('h3', opts.title || ''), S.h('button.x', { onclick: close }, '×'),
    ])
    const body = S.h('div.' + (kind === 'drawer' ? 'drawer-body' : 'modal-body'))
    const foot = S.h('div.' + (kind === 'drawer' ? 'drawer-foot' : 'modal-foot'))
    panel.append(head, body, foot)
    document.body.append(scrim, panel)
    return { scrim, panel, body, foot, close }
  }

  // segmented control: opts=[{v,label}], onChange(v)
  S.seg = function (value, opts, onChange, cls) {
    const wrap = S.h('div.' + (cls || 'tabs'))
    opts.forEach(o => {
      const b = S.h('button', { class: o.v === value ? 'active' : '', onclick: () => onChange(o.v) }, o.label)
      wrap.appendChild(b)
    })
    return wrap
  }

  // status badge (host template): kind = green|amber|red|blue|gray
  S.badge = function (kind, text) { return S.h('span.badge.' + kind, text) }

  // toggle switch (host template)
  S.toggle = function (on, label, onChange) {
    const wrap = S.h('div.toggle' + (on ? '.on' : ''), { onclick: () => onChange(!on) }, [S.h('span.track'), label ? S.h('span', label) : null])
    return wrap
  }

  // page header: {overline, title, pill:{dot,text}, banner:{text,action}, actions:[nodes]}
  S.pageHeader = function (o) {
    const main = S.h('div.ph-main', [
      o.overline ? S.h('div.overline', o.overline) : null,
      S.h('div.page-title', [S.h('h1', o.title),
        o.pill ? S.h('span.status-pill', [S.h('span.dot', { style: { background: o.pill.color || 'var(--c-success)' } }), o.pill.text]) : null]),
    ])
    const head = S.h('div.page-head', [main, o.actions && o.actions.length ? S.h('div.ph-actions', o.actions) : null])
    const frag = document.createDocumentFragment()
    frag.appendChild(head)
    if (o.banner) frag.appendChild(S.h('div.banner', [S.h('span', o.banner.text), o.banner.action ? S.h('button.btn.primary.sm', { onclick: o.banner.onClick || (() => S.toast('demo')) }, o.banner.action) : null]))
    return frag
  }

  window.S = S
})()

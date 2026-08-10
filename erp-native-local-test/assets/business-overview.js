(function () {
  "use strict";

  const h = window.S.h;
  const M = window.BusinessMetrics;
  const DATA = window.DATA || {};
  const projectStorageKey = "projectTrackingData.v1";
  const marketingStorageKey = "marketingAssets.v1";
  let root;
  let state;
  let listenersBound = false;

  function init() {
    const now = new Date();
    state = {
      year: 2026,
      quarter: now.getFullYear() === 2026 ? Math.ceil((now.getMonth() + 1) / 3) : 2,
      scope: "ALL",
      view: "annual",
      exceptionFilter: "all",
      exceptionSource: "all",
      exceptionSearch: ""
    };
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value) {
    const amount = number(value);
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    if (absolute >= 1000000) return `${sign}€${(absolute / 1000000).toFixed(2)}M`;
    if (absolute >= 1000) return `${sign}€${(absolute / 1000).toFixed(1)}K`;
    return `${sign}€${Math.round(absolute).toLocaleString("en-US")}`;
  }

  function pct(value) {
    return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}%`;
  }

  function yearMonths() { return M.monthsForYear(state.year); }
  function quarterMonths() { return M.monthsForQuarter(state.year, state.quarter); }
  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function contract(months, scope) {
    return M.confirmedResults(months || yearMonths(), scope == null ? state.scope : scope);
  }

  function forecastValue(month, scope) {
    const current = contract([month], scope);
    const forecastQuantity = current.forecast.result.forecast || 0;
    const bp = current.bp.result;
    const unitValue = bp.quantity > 0
      ? bp.value / bp.quantity
      : bp.actualQuantity > 0 ? bp.actualValue / bp.actualQuantity : 0;
    return forecastQuantity * unitValue;
  }

  function projection(scope) {
    const months = yearMonths();
    const current = currentMonthKey();
    const target = contract(months, scope).bp.result.value;
    let projected = 0;
    months.forEach((month) => {
      const actual = contract([month], scope).bp.result.actualValue;
      projected += month <= current ? actual : Math.max(actual, forecastValue(month, scope));
    });
    return {
      target,
      projected,
      gap: projected - target,
      rate: target > 0 ? projected / target * 100 : null
    };
  }

  function readStorage(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (error) { return null; }
  }

  function projectHealth() {
    const projects = readStorage(projectStorageKey);
    if (!Array.isArray(projects)) return { connected: false, projects: 0, risks: 0, top: null };
    const active = projects.filter((project) => !["archived", "cancelled"].includes(String(project.lifecycleStatus || "").toLowerCase()));
    const risks = [];
    active.forEach((project) => Object.values(project.workstreams || {}).forEach((stream) => {
      const health = String(stream.health || stream.status || "").toLowerCase();
      const blockers = (stream.tasks || []).filter((task) => String(task.status || "").toLowerCase() === "blocked");
      if (health === "red" || blockers.length) risks.push({ project, stream, blocker: blockers[0] || null });
    }));
    return { connected: true, projects: active.length, risks: risks.length, top: risks[0] || null };
  }

  function marketingHealth() {
    const stored = readStorage(marketingStorageKey);
    const projects = Array.isArray(stored) ? stored : stored && Array.isArray(stored.projects) ? stored.projects : null;
    if (!projects) return { connected: false, projects: 0, progress: null, risks: 0, top: null };
    let configured = 0;
    let complete = 0;
    const risks = [];
    projects.forEach((project) => {
      const entries = Object.entries({ ...(project.assets || {}), ...(project.special || {}) }).filter((entry) => entry[1]);
      entries.forEach(([key, item]) => {
        configured += 1;
        if (String(item.status || "").toLowerCase() === "done") complete += 1;
        if (["missing", "overdue"].includes(String(item.status || "").toLowerCase())) risks.push({ project, key, item });
      });
    });
    return {
      connected: true,
      projects: projects.length,
      progress: configured ? complete / configured * 100 : null,
      risks: risks.length,
      top: risks[0] || null
    };
  }

  function countryProjectionRows() {
    return M.activeCountries().map((country) => {
      const annual = contract(yearMonths(), country.code).business.result;
      const projected = projection(country.code);
      return { country, annual, ...projected };
    }).filter((row) => row.target || row.annual.revenue).sort((a, b) => a.gap - b.gap);
  }

  function sourceStatus() {
    const annual = contract(yearMonths());
    const projects = projectHealth();
    const marketing = marketingHealth();
    return [
      { label: "BP达成", meta: `${annual.bp.statusLabel} · ${annual.bp.version}`, tone: "green", module: "bp" },
      { label: "产销 / 预测", meta: `${annual.forecast.statusLabel} · ${annual.forecast.version}`, tone: "green", module: "forecast" },
      { label: "物流交付", meta: `${annual.logistics.statusLabel} · ${annual.logistics.version}`, tone: "blue", module: "shipmentSummary" },
      { label: "项目跟进", meta: projects.connected ? `团队文档 · ${projects.projects}个项目` : "等待团队文档同步", tone: projects.connected ? "green" : "amber", route: "/platform/planning/projects" },
      { label: "营销物料", meta: marketing.connected ? `团队文档 · ${pct(marketing.progress)}` : "等待团队文档同步", tone: marketing.connected ? "green" : "amber", route: "/platform/market/assets" },
      { label: "审批中心", meta: "按权限联动待办", tone: "green", route: "/platform/collaboration/tasks" },
      { label: "结算台账", meta: `${annual.settlement.statusLabel} · ${annual.settlement.version}`, tone: "blue", route: "/platform/business/settlements" }
    ];
  }

  function actionRows() {
    const annual = contract(yearMonths());
    const quarter = contract(quarterMonths());
    const markets = countryProjectionRows();
    const projects = projectHealth();
    const marketing = marketingHealth();
    const worstMarket = markets[0];
    const forecastExceptions = quarter.forecast.result.exceptions || [];
    const topForecast = forecastExceptions[0];
    const rows = [];

    if (worstMarket && worstMarket.gap < 0) rows.push({
      level: "major", title: `${worstMarket.country.code} 全年预计缺口 ${money(Math.abs(worstMarket.gap))}`,
      detail: "有效PO与已发布预测仍未覆盖年度BP目标，需确认渠道增量计划。",
      source: "BP达成", version: annual.bp.version, impact: `收入 ${money(worstMarket.gap)}`,
      impactMeta: `${worstMarket.country.code} · 全年`, owner: "Business Planning", due: "本周", status: "处理中", statusTone: "blue", module: "bp"
    });
    if (topForecast) rows.push({
      level: "major", title: `${topForecast.country} · ${topForecast.sku.code || "SKU"} 预测偏差 ${Math.abs(topForecast.variance).toFixed(0)}%`,
      detail: `预测 ${Math.round(topForecast.forecast).toLocaleString("en-US")}，有效PO ${Math.round(topForecast.po).toLocaleString("en-US")}，需要修订下一版共识预测。`,
      source: "预测管理", version: quarter.forecast.version, impact: "收入与库存节奏", impactMeta: topForecast.month,
      owner: "Sales / Supply", due: "2天内", status: "待确认", statusTone: "amber", module: "forecast"
    });
    if (annual.logistics.result.missingFreightPoCount > 0) rows.push({
      level: "major", title: `${annual.logistics.result.missingFreightPoCount} 个PO缺少物流费用`,
      detail: "缺失运费会影响毛利和净利润口径，需在经营复盘前完成补录。",
      source: "物流交付", version: annual.logistics.version, impact: "利润口径待补", impactMeta: `${annual.logistics.result.poCount}个有效PO`,
      owner: "Logistics", due: "今日", status: "待处理", statusTone: "gray", module: "shipmentSummary"
    });
    if (projects.top) rows.push({
      level: "attention", title: `${projects.top.project.model} 项目关键路径受阻`,
      detail: projects.top.stream.issue || projects.top.stream.note || projects.top.blocker?.name || "项目工作流存在阻塞任务。",
      source: "项目跟进", version: "团队共享文档", impact: "上市准备度", impactMeta: projects.top.project.launchDate || projects.top.project.stage || "当前项目",
      owner: projects.top.stream.owner || projects.top.project.owner || "PMO", due: projects.top.stream.dueDate || projects.top.stream.due || "待确认", status: "处理中", statusTone: "blue", route: "/platform/planning/projects"
    });
    if (marketing.top) rows.push({
      level: "attention", title: `${marketing.top.project.model} 营销物料${marketing.top.item.status === "overdue" ? "已逾期" : "缺失"}`,
      detail: marketing.top.item.note || `${marketing.top.key} 尚未形成可交付版本。`,
      source: "营销物料", version: "团队共享文档", impact: "上市物料齐套", impactMeta: marketing.top.project.launchDate,
      owner: marketing.top.item.owner || "Marketing", due: marketing.top.item.ddl || "待确认", status: "待处理", statusTone: "gray", route: "/platform/market/assets"
    });
    if (annual.settlement.result.creditNote > 0) rows.push({
      level: "attention", title: `年度CN费用 ${money(annual.settlement.result.creditNote)}`,
      detail: "CN费用已计入净利润口径，建议按市场与SKU检查费用集中度及后续抵扣。",
      source: "结算台账", version: annual.settlement.version, impact: `净利润 -${money(annual.settlement.result.creditNote)}`, impactMeta: "年度累计",
      owner: "Finance", due: "月度关账", status: "进行中", statusTone: "blue", route: "/platform/business/settlements"
    });
    return rows;
  }

  function navigate(target) {
    if (target.module && window.Modules && window.Modules[target.module]) {
      window.S.navigate(target.module, target.context || {});
      return;
    }
    if (!target.route) return;
    if (window.OPERATIONS_PLATFORM_EMBEDDED && window.parent !== window) {
      window.parent.postMessage({ type: "operations-platform:navigate", href: target.route }, window.location.origin);
      return;
    }
    window.location.assign(target.route);
  }

  function field(label, value, options, onChange) {
    return h("label.bo-field", [
      h("span", label),
      h("select", { onchange: (event) => onChange(event.target.value) }, options.map((option) => h("option", {
        value: option.value,
        selected: option.value === value
      }, option.label)))
    ]);
  }

  function controls() {
    const annual = contract(yearMonths());
    const markets = [{ value: "ALL", label: "全部欧洲市场" }].concat(M.activeCountries().map((country) => ({ value: country.code, label: `${country.code} · ${country.name_zh || country.name_en}` })));
    return h("section.bo-control", [
      h("div.bo-control-title", [h("small", "BUSINESS COMMAND CENTER"), h("strong", "经营总览")]),
      field("经营年度", String(state.year), [2026, 2025, 2024].map((year) => ({ value: String(year), label: String(year) })), (value) => { state.year = Number(value); paint(); }),
      field("观察口径", state.view, [{ value: "annual", label: "年度累计 + 全年预计" }, { value: "quarter", label: "选定季度" }], (value) => { state.view = value; paint(); }),
      field("季度", String(state.quarter), [1, 2, 3, 4].map((quarter) => ({ value: String(quarter), label: `Q${quarter}` })), (value) => { state.quarter = Number(value); paint(); }),
      field("市场", state.scope, markets, (value) => { state.scope = value; paint(); }),
      h("span.bo-control-grow"),
      h("span.bo-live", [h("i"), `数据已更新 · ${String(annual.business.confirmedAt).slice(5, 16).replace("-", "/")}`]),
      h("button.btn.sm", { type: "button", onclick: showSources }, "查看数据来源"),
      h("button.btn.primary.sm", { type: "button", onclick: () => navigate({ module: "performance" }) }, "发起经营复盘")
    ]);
  }

  function kpis() {
    const annual = contract(yearMonths()).business.result;
    const selected = contract(state.view === "quarter" ? quarterMonths() : yearMonths()).business.result;
    const projected = projection(state.scope);
    const actions = actionRows();
    const major = actions.filter((row) => row.level === "major").length;
    const rate = annual.bp > 0 ? annual.revenue / annual.bp * 100 : null;
    const gpTarget = 38;
    const values = [
      ["年度BP目标", money(annual.bp), `Q${state.quarter}目标 ${money(contract(quarterMonths()).business.result.bp)}`, ""],
      ["实际达成 · 有效PO", money(annual.revenue), `年度达成 ${pct(rate)}`, rate != null && rate < 70 ? "red" : ""],
      ["全年滚动预计", money(projected.projected), `预计差额 ${money(projected.gap)}`, projected.gap < 0 ? "red" : "green"],
      ["实际毛利率", pct(selected.gpRate), `经营目标 ${gpTarget.toFixed(1)}%`, selected.gpRate != null && selected.gpRate < gpTarget ? "amber" : "green"],
      ["CN费用", money(selected.cn), `已计入净利润 · ${state.view === "quarter" ? `Q${state.quarter}` : "年度"}`, selected.cn > 0 ? "amber" : ""],
      ["关键经营异常", String(actions.length), `重大 ${major} · 点击查看行动`, major ? "red" : "green"]
    ];
    return h("section.bo-kpis", values.map((item) => h("button.bo-kpi", { type: "button", onclick: item[0] === "关键经营异常" ? showActions : undefined }, [
      h("span", item[0]), h("strong", { class: item[3] ? `bo-${item[3]}` : "" }, item[1]), h("small", item[2])
    ])));
  }

  function monthlyChart() {
    const rows = yearMonths().map((month) => {
      const result = contract([month]).business.result;
      return { month, target: result.bp, actual: result.revenue, projected: month <= currentMonthKey() ? result.revenue : Math.max(result.revenue, forecastValue(month, state.scope)) };
    });
    const maximum = Math.max(1, ...rows.flatMap((row) => [row.target, row.projected]));
    return panel("BP、有效PO与滚动预测", "点击月份可切换到对应季度 · 单位 EUR", h("div.bo-chart", [
      h("div.bo-chart-legend", [h("span", [h("i.target"), "BP"]), h("span", [h("i.actual"), "有效PO / 预计"])]),
      h("div.bo-chart-columns", rows.map((row) => h("button.bo-chart-month", { type: "button", onclick: () => { state.quarter = Math.ceil(Number(row.month.slice(5, 7)) / 3); state.view = "quarter"; paint(); } }, [
        h("div.bo-chart-bars", [
          h("i.target", { style: { height: `${Math.max(2, row.target / maximum * 100)}%` }, title: `BP ${money(row.target)}` }),
          h("i.actual", { style: { height: `${Math.max(2, row.projected / maximum * 100)}%` }, title: `有效PO/预计 ${money(row.projected)}` })
        ]),
        h("span", `${Number(row.month.slice(5, 7))}月`)
      ])))
    ]));
  }

  function healthPanel() {
    const selected = contract(state.view === "quarter" ? quarterMonths() : yearMonths());
    const projects = projectHealth();
    const marketing = marketingHealth();
    const forecast = selected.forecast.result;
    const items = [
      ["预测准确率", forecast.accuracy, pct(forecast.accuracy), "forecast"],
      ["订单交付达成", selected.logistics.result.fulfilment, pct(selected.logistics.result.fulfilment), "shipmentSummary"],
      ["产销预测偏差", Math.max(0, 100 - Math.min(100, forecast.exceptions.length * 5)), `${forecast.exceptions.length}项`, "forecast"],
      ["项目关键路径", projects.connected ? Math.max(0, 100 - projects.risks * 10) : null, projects.connected ? `${projects.risks}风险` : "待同步", null, "/platform/planning/projects"],
      ["营销物料齐套", marketing.progress, marketing.connected ? pct(marketing.progress) : "待同步", null, "/platform/market/assets"],
      ["物流费用完整", selected.logistics.result.poCount ? (selected.logistics.result.poCount - selected.logistics.result.missingFreightPoCount) / selected.logistics.result.poCount * 100 : null, `${selected.logistics.result.missingFreightPoCount}缺失`, "shipmentSummary"]
    ];
    return panel("跨模块经营健康度", "点击进入责任模块", h("div.bo-health", items.map((item) => {
      const tone = item[1] == null ? "gray" : item[1] >= 90 ? "green" : item[1] >= 70 ? "amber" : "red";
      return h("button.bo-health-row", { type: "button", onclick: () => navigate({ module: item[3], route: item[4] }) }, [
        h("span", item[0]), h("div.bo-health-track", h("i", { class: tone, style: { width: `${item[1] == null ? 0 : Math.max(0, Math.min(100, item[1]))}%` } })), h("strong", { class: `bo-${tone}` }, item[2])
      ]);
    })));
  }

  function marketTable() {
    const rows = countryProjectionRows();
    return panel("市场经营矩阵", "统一口径贯通 BP、PO、利润、交付与CN", h("div.bo-table-wrap", h("table.bw-table.bo-market-table", [
      h("thead", h("tr", ["市场", "年度BP", "有效PO", "全年预计", "预计达成", "实际毛利率", "交付", "CN费用", "状态"].map((label) => h("th", label)))),
      h("tbody", rows.map((row) => {
        const status = row.rate >= 100 ? ["达成", "green"] : row.rate >= 90 ? ["关注", "amber"] : ["承压", "red"];
        return h("tr", { onclick: () => { state.scope = row.country.code; paint(); } }, [
          h("td", [h("strong", `${row.country.code} ${row.country.name_zh || row.country.name_en}`)]),
          h("td.num", money(row.target)), h("td.num", money(row.annual.revenue)), h("td.num", money(row.projected)),
          h("td.num", { class: row.rate >= 100 ? "bw-positive" : "bw-negative" }, pct(row.rate)),
          h("td.num", { class: row.annual.gpRate != null && row.annual.gpRate < 35 ? "bw-negative" : "" }, pct(row.annual.gpRate)),
          h("td.num", pct(row.annual.fulfilment)), h("td.num", money(row.annual.cn)), h("td", h(`span.bw-pill.${status[1]}`, status[0]))
        ]);
      }))
    ])), "bo-market-panel");
  }

  function exceptionPanel() {
    const rows = actionRows().slice(0, 3);
    return panel("关键异常与行动", `${actionRows().length}项 · 显示最高优先级`, h("div.bo-issues", [
      ...rows.map((row) => h("button.bo-issue", { type: "button", onclick: showActions }, [
        h("div.bo-issue-head", [h("strong", row.title), h(`span.bw-pill.${row.level === "major" ? "red" : "amber"}`, row.level === "major" ? "重大" : "关注")]),
        h("p", row.detail), h("div.bo-issue-foot", [h("span", `${row.owner} · ${row.due}`), h("b", `打开${row.source}`)])
      ])),
      h("button.btn.sm.bo-all-actions", { type: "button", onclick: showActions }, "查看全部异常与行动")
    ]), "bo-issue-panel");
  }

  function panel(title, meta, body, className) {
    return h(`section.bw-panel${className ? `.${className}` : ""}`, [h("header.bw-panel-head", [h("h2", title), h("span", meta)]), body]);
  }

  function showSources() {
    const overlay = window.S.overlay("modal", { title: "经营总览数据来源" });
    overlay.panel.classList.add("bo-source-modal");
    overlay.body.append(h("p.bo-modal-intro", "总览只读聚合已确认业务结果与当前账号已同步的团队共享文档，不在本页面修改来源数据。"));
    overlay.body.append(h("div.bo-source-list", sourceStatus().map((source) => h("button", { type: "button", onclick: () => { overlay.close(); navigate(source); } }, [
      h("div", [h("strong", source.label), h("small", source.meta)]), h(`span.bw-pill.${source.tone}`, source.tone === "amber" ? "待同步" : "已连接")
    ]))));
    overlay.foot.append(h("button.btn", { type: "button", onclick: overlay.close }, "关闭"));
  }

  function showActions() {
    const overlay = window.S.overlay("modal", { title: "关键异常与行动" });
    overlay.panel.classList.add("bo-action-modal");
    const renderBody = () => {
      const allRows = actionRows();
      const query = state.exceptionSearch.trim().toLowerCase();
      const rows = allRows.filter((row) => {
        if (state.exceptionFilter !== "all" && row.level !== state.exceptionFilter) return false;
        if (state.exceptionSource !== "all" && row.source !== state.exceptionSource) return false;
        return !query || `${row.title} ${row.detail} ${row.source} ${row.owner}`.toLowerCase().includes(query);
      });
      const major = allRows.filter((row) => row.level === "major").length;
      window.S.clear(overlay.body);
      overlay.body.append(
        h("p.bo-modal-intro", "聚合BP、预测、产销、项目、营销、审批与结算异常；查看来源可回到原始业务模块。"),
        h("section.bo-action-summary", [
          h("div", [h("span", "当前经营范围"), h("strong", `${state.year} · Q${state.quarter} · ${state.scope === "ALL" ? "全部欧洲市场" : state.scope}`), h("small", state.view === "annual" ? "年度累计 + 全年预计" : "选定季度")]),
          h("div", [h("span", "全部异常"), h("strong", String(allRows.length))]),
          h("div", [h("span", "重大"), h("strong.bo-red", String(major))]),
          h("div", [h("span", "关注"), h("strong.bo-amber", String(allRows.length - major))]),
          h("div", [h("span", "开放行动"), h("strong.bo-blue", String(allRows.length))])
        ]),
        h("div.bo-action-tools", [
          h("div.bo-action-tabs", [
            ["all", `全部 ${allRows.length}`], ["major", `重大 ${major}`], ["attention", `关注 ${allRows.length - major}`]
          ].map((item) => h("button", { type: "button", class: state.exceptionFilter === item[0] ? "active" : "", onclick: () => { state.exceptionFilter = item[0]; renderBody(); } }, item[1]))),
          h("select", { onchange: (event) => { state.exceptionSource = event.target.value; renderBody(); } }, [h("option", { value: "all", selected: state.exceptionSource === "all" }, "全部来源模块")].concat(Array.from(new Set(allRows.map((row) => row.source))).map((source) => h("option", { value: source, selected: state.exceptionSource === source }, source)))),
          h("span.bo-action-grow"),
          h("input", { type: "search", value: state.exceptionSearch, placeholder: "搜索市场、SKU、PO或CN", oninput: (event) => { state.exceptionSearch = event.target.value; } }),
          h("button.btn.sm", { type: "button", onclick: () => renderBody() }, "搜索")
        ]),
        h("div.bo-action-list", [
          h("div.bo-action-head", ["级别", "异常与判断", "来源模块", "经营影响", "责任人 / DDL", "行动状态", "操作"].map((label) => h("div", label))),
          ...rows.map((row) => h("div.bo-action-row", [
            h("div", h(`span.bo-level.${row.level}`, [h("i"), row.level === "major" ? "重大" : "关注"])),
            h("div.bo-action-main", [h("strong", row.title), h("p", row.detail)]),
            h("div.bo-action-source", [h("b", row.source), h("small", row.version)]),
            h("div.bo-action-impact", [h("b", row.impact), h("small", row.impactMeta)]),
            h("div.bo-action-owner", [h("b", row.owner), h("small", row.due)]),
            h("div", h(`span.bo-action-status.${row.statusTone}`, row.status)),
            h("div.bo-row-actions", [
              h("button.btn.sm", { type: "button", onclick: () => { overlay.close(); navigate(row); } }, "查看来源"),
              h("button.btn.primary.sm", { type: "button", onclick: () => {
                overlay.close();
                navigate({
                  module: "performance",
                  context: {
                    view: "actions",
                    draft: {
                      title: row.title,
                      source: row.source,
                      owner: row.owner,
                      due: row.due,
                      status: row.status === "处理中" ? "进行中" : row.status,
                      detail: row.detail,
                      evidence: `经营影响：${row.impact} · ${row.impactMeta}`
                    }
                  }
                });
              } }, "更新行动")
            ])
          ])),
          rows.length ? null : h("div.bo-action-empty", "当前筛选范围没有异常。")
        ])
      );
    };
    renderBody();
    overlay.foot.append(h("small.bo-action-footnote", "异常数据只读引用来源模块；行动更新进入经营分析复盘并保留变更记录。"));
    overlay.foot.append(h("button.btn", { type: "button", onclick: overlay.close }, "关闭"));
    overlay.foot.append(h("button.btn.primary", { type: "button", onclick: () => { overlay.close(); navigate({ module: "performance", context: { view: "actions", create: true } }); } }, "+ 新建经营行动"));
  }

  function sourceStrip() {
    return h("section.bo-source-strip", [
      h("div.bo-source-title", [h("strong", "数据源与时效"), h("small", "点击查看口径、版本与责任模块")]),
      ...sourceStatus().map((source) => h("button", { type: "button", onclick: () => navigate(source) }, [h("strong", source.label), h("small", { class: `bo-${source.tone}` }, source.meta)]))
    ]);
  }

  function paint() {
    if (!root) return;
    window.S.clear(root);
    root.append(h("div.business-workspace.business-overview-workspace", [
      controls(), kpis(),
      h("div.bo-primary-grid", [monthlyChart(), healthPanel()]),
      h("div.bo-secondary-grid", [marketTable(), exceptionPanel()]),
      sourceStrip(),
      h("p.bo-readonly-note", "经营总览为只读聚合视图；所有业务修改均回到对应来源模块完成。")
    ]));
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener("storage", (event) => {
      if ([projectStorageKey, marketingStorageKey].includes(event.key) && root && root.isConnected) paint();
    });
    window.addEventListener("operations:cloud-document-updated", (event) => {
      if ([projectStorageKey, marketingStorageKey].includes(event.detail && event.detail.documentKey) && root && root.isConnected) paint();
    });
  }

  function render(target) {
    root = target;
    if (!state) init();
    bindListeners();
    paint();
  }

  window.Modules = window.Modules || {};
  window.Modules.overview = { render };
})();

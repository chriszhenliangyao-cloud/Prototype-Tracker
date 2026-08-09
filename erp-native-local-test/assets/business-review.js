(function () {
  "use strict";

  const h = window.S.h;
  const M = window.BusinessMetrics;
  const REVIEW_KEY = "erp-native-business-review-state";
  const tabs = [
    { value: "overview", label: "复盘总览" },
    { value: "profit", label: "收入与利润" },
    { value: "forecast", label: "预测与交付" },
    { value: "project", label: "项目与市场" },
    { value: "action", label: "结论与行动" },
    { value: "history", label: "历史复盘" }
  ];
  const projectSamples = [
    { code: "PX51", name: "MagPro Neo 10K", launch: "8月22日", old: "原8月15日", stage: "试产 · 4/6", rd: "7/8", proto: "4/4", quality: "5/7", supply: "4/7", marketing: "5/6", status: "风险" },
    { code: "WAL101", name: "Fold Charger 100W", launch: "9月20日", old: "原9月14日", stage: "DVT2 · 3/6", rd: "6/7", proto: "2/4", quality: "3/5", supply: "3/6", marketing: "4/6", status: "风险" },
    { code: "WM321", name: "MagPro 3-in-1", launch: "10月16日", old: "未变化", stage: "DVT2 · 3/6", rd: "4/7", proto: "2/4", quality: "2/5", supply: "2/6", marketing: "4/6", status: "预警" },
    { code: "PM61-Black", name: "MagPro Slim 10K", launch: "11月5日", old: "未变化", stage: "DVT1 · 2/6", rd: "3/7", proto: "1/4", quality: "1/5", supply: "1/6", marketing: "2/6", status: "预警" },
    { code: "P51L-P2", name: "Pocket 20K Refresh", launch: "12月3日", old: "未变化", stage: "项目立项 · 1/6", rd: "1/6", proto: "0/4", quality: "0/5", supply: "1/5", marketing: "0/6", status: "正常" }
  ];
  let root;
  let state;

  function init() {
    const stored = readStored();
    state = {
      periodType: "quarter",
      period: "2026-Q2",
      scope: "ALL",
      compare: "prior",
      tab: "overview",
      categoryMetric: "revenue",
      categoryFocus: "",
      frozen: true,
      version: "v3",
      conclusions: defaultConclusions(),
      actions: [
        { title: "拆解ES收入与利润缺口", source: "经营分析复盘", owner: "María · 销售 / GTM", due: "7月12日", status: "进行中", evidence: "待上传", detail: "拆解渠道PO不足、物流费用和Credit Note对ES净利润的共同影响。" },
        { title: "核对ES Credit Note归属", source: "结算台账", owner: "Finance", due: "7月10日", status: "待确认", evidence: "CN明细表", detail: "确认未匹配SKU的Credit Note责任渠道、产品归属和处理口径。" },
        { title: "补录缺失PO物流费用", source: "物流交付", owner: "Owen", due: "7月11日", status: "待处理", evidence: "物流账单", detail: "补齐3个PO的物流费用；无法按期取得账单时记录暂估金额与依据。" },
        { title: "重提ES Q3渠道预测", source: "预测管理", owner: "María", due: "7月15日", status: "进行中", evidence: "待发布", detail: "根据有效PO和渠道库存重新提交Q3滚动预测，并说明主要变化。" },
        { title: "更新PX51上市时间线", source: "项目跟进", owner: "Ivy", due: "7月8日", status: "已完成", evidence: "变更记录", detail: "同步新的上市日期、延期原因及对首批供应和营销物料的影响。" }
      ],
      history: defaultHistory(),
      ...(stored || {})
    };
  }

  function readStored() {
    try { return JSON.parse(sessionStorage.getItem(REVIEW_KEY) || "null"); }
    catch (error) { return null; }
  }
  function persist() {
    sessionStorage.setItem(REVIEW_KEY, JSON.stringify({ frozen: state.frozen, version: state.version, conclusions: state.conclusions, actions: state.actions, history: state.history }));
  }

  function defaultConclusions() {
    return [
      { title: "ES收入与利润缺口需要专项修复", impact: "收入、物流费用、Credit Note", owner: "María", level: "重大", summary: "ES收入达成偏低，核心渠道PO不足，同时物流费用和价格保护抬升费用率。", decision: "重排渠道目标，按周检查PO转化并完成费用归因。" },
      { title: "Q3预测应下调高偏差SKU", impact: "预测准确率、供应计划", owner: "GTM", level: "重大", summary: "部分SKU预测偏差超过20%，现有预测无法充分支持供应排产。", decision: "销售重新确认渠道预测，由GTM统一冻结调整版本。" },
      { title: "PX51上市延期但首批供应不变", impact: "上市节奏、营销物料", owner: "Ivy", level: "关注", summary: "PX51上市日期已调整，首批供应数量仍按当前确认计划执行。", decision: "保留原日期与延期原因，营销与渠道动作按新日期顺延。" },
      { title: "物流费用缺失需在归档前补齐", impact: "净利润口径", owner: "Owen", level: "关注", summary: "3个PO缺少物流费用，当前净利润包含不完整费用口径。", decision: "归档前补齐实际费用或记录暂估依据，并生成调整版本。" }
    ];
  }

  function defaultHistory() {
    return [
      { period: "2026 Q2", type: "季度复盘", version: "正式 v3", status: "已发布", owner: "Julio", date: "7月8日", completion: "62%" },
      { period: "2026年6月", type: "月度复盘", version: "正式 v2", status: "已发布", owner: "Julio", date: "7月3日", completion: "80%" },
      { period: "2026年5月", type: "月度复盘", version: "调整 v2.1", status: "已发布", owner: "Finance", date: "6月8日", completion: "100%" },
      { period: "2026 Q1", type: "季度复盘", version: "正式 v2", status: "已发布", owner: "Julio", date: "4月6日", completion: "88%" },
      { period: "2025 H2", type: "半年度复盘", version: "正式 v2", status: "已发布", owner: "Owner", date: "1月12日", completion: "92%" },
      { period: "2025年度", type: "年度复盘", version: "正式 v4", status: "已发布", owner: "Owner", date: "1月12日", completion: "100%" }
    ];
  }

  function periodOptions(type) {
    if (type === "month") return ["2026-06", "2026-05", "2026-04"].map((value) => ({ value, label: M.periodLabel(type, value) }));
    if (type === "half") return ["2026-H1", "2025-H2", "2025-H1"].map((value) => ({ value, label: M.periodLabel(type, value) }));
    if (type === "year") return ["2026", "2025", "2024"].map((value) => ({ value, label: M.periodLabel(type, value) }));
    return ["2026-Q2", "2026-Q1", "2025-Q4", "2025-Q3"].map((value) => ({ value, label: M.periodLabel("quarter", value) }));
  }
  function reviewMonths() { return M.monthsForPeriod(state.periodType, state.period); }
  function confirmed(scope, selectedMonths) { return M.confirmedResults(selectedMonths || reviewMonths(), scope == null ? state.scope : scope); }
  function aggregate(scope) { return confirmed(scope).business.result; }
  function countryRowsForScope() {
    return confirmed().business.result.details.countries;
  }
  function priorMonths() {
    if (state.periodType === "month") {
      const date = new Date(`${state.period}-01T00:00:00`); date.setMonth(date.getMonth() - 1);
      return [`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`];
    }
    if (state.periodType === "quarter") {
      const match = /^(\d{4})-Q([1-4])$/.exec(state.period);
      if (!match) return [];
      const year = Number(match[1]); const quarter = Number(match[2]);
      return M.monthsForQuarter(quarter === 1 ? year - 1 : year, quarter === 1 ? 4 : quarter - 1);
    }
    if (state.periodType === "half") {
      const match = /^(\d{4})-H([12])$/.exec(state.period);
      if (!match) return [];
      return M.monthsForHalf(Number(match[2]) === 1 ? Number(match[1]) - 1 : Number(match[1]), Number(match[2]) === 1 ? 2 : 1);
    }
    return M.monthsForYear(Number(state.period) - 1);
  }
  function prior() { return M.confirmedResults(priorMonths(), state.scope).business.result; }

  function money(value) {
    const abs = Math.abs(Number(value) || 0); const sign = Number(value) < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}€${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(1)}K`;
    return `${sign}€${Math.round(abs).toLocaleString("en-US")}`;
  }
  function qty(value) { const abs = Math.abs(Number(value) || 0); return abs >= 1000 ? `${(abs / 1000).toFixed(1)}K` : Math.round(abs).toLocaleString("en-US"); }
  function pct(value) { return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}%`; }
  function change(now, before) { return before ? (now - before) / Math.abs(before) * 100 : null; }
  function changeText(value, suffix) { return value == null ? "无可比基准" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix || "%"}`; }
  function tone(value) { return value == null ? "" : value >= 0 ? "bw-positive" : "bw-negative"; }
  function pill(text, kind) { return h(`span.bw-pill.${kind || ""}`, text); }
  function selectedPeriodLabel() { return M.periodLabel(state.periodType, state.period); }

  function sourceButton(contract, label) {
    return h("button.bw-source", {
      type: "button",
      title: `查看${contract.source}的确认口径与来源版本`,
      dataset: { sourceModule: contract.module },
      onclick: () => openConfirmedSource(contract)
    }, `${label || contract.source} · ${contract.statusLabel}`);
  }

  function openConfirmedSource(contract) {
    const overlay = S.overlay("modal", { title: `${contract.source} · 已确认结果` });
    overlay.panel.classList.add("bw-source-modal");
    overlay.body.append(h("div.bw-source-contract", [
      h("div", [h("span", "来源模块"), h("b", contract.source)]),
      h("div", [h("span", "结果状态"), pill(contract.statusLabel, contract.status === "published" ? "blue" : "green")]),
      h("div", [h("span", "版本"), h("b", contract.version)]),
      h("div", [h("span", "确认时间"), h("b", String(contract.confirmedAt || "--").replace("T", " ").slice(0, 16))])
    ]), h("p.bw-contract-note", "经营分析复盘只读取该模块已确认或已发布的结果快照；返回源模块修改后，需要重新确认并生成新版本，当前复盘历史不会被覆盖。"));
    overlay.foot.append(
      h("button.btn", { onclick: overlay.close }, "关闭"),
      h("button.btn.primary", { onclick: () => { overlay.close(); openSourceModule(contract.module); } }, "进入源模块")
    );
  }

  function openSourceModule(module) {
    const nativeButton = document.querySelector(`[data-module="${module}"]`);
    const existingButton = document.querySelector(`[data-existing-module="${module}"]`);
    const target = nativeButton || existingButton;
    if (target) target.click();
    else S.toast("该来源模块暂未配置入口");
  }

  function selectField(label, value, options, onChange, compact) {
    return h(`label.bw-field${compact ? ".compact" : ""}`, [h("span", label), h("select", { onchange: (event) => onChange(event.target.value) }, options.map((option) => h("option", { value: option.value, selected: option.value === value }, option.label)))]);
  }

  function controlShell() {
    const countries = [{ value: "ALL", label: "全部可见市场" }].concat(M.activeCountries().map((country) => ({ value: country.code, label: `${country.code} · ${country.name_en}` })));
    const types = [
      { value: "month", label: "月度复盘" }, { value: "quarter", label: "季度复盘" },
      { value: "half", label: "半年度复盘" }, { value: "year", label: "年度复盘" }
    ];
    const contracts = confirmed();
    const sourceContracts = [contracts.bp, contracts.forecast, contracts.logistics, contracts.settlement];
    const readySources = sourceContracts.filter((contract) => contract.status === "confirmed" || contract.status === "published" || contract.status === "closed").length;
    return h("section.bw-review-control", [
      h("div.bw-review-control-main", [
        h("div.bw-title.compact", [h("small", "BUSINESS ANALYSIS REVIEW"), h("strong", "经营分析复盘")]),
        selectField("周期", state.periodType, types, (value) => { state.periodType = value; state.period = periodOptions(value)[0].value; paint(); }, true),
        selectField("期间", state.period, periodOptions(state.periodType), (value) => { state.period = value; paint(); }, true),
        selectField("市场", state.scope, countries, (value) => { state.scope = value; paint(); }, true),
        selectField("对比", state.compare, [{ value: "prior", label: "上一周期" }, { value: "bp", label: "当前BP" }], (value) => { state.compare = value; paint(); }, true),
        h("span.bw-control-grow"),
        h("button.bw-source-summary", { type: "button", onclick: () => openSourceOverview(sourceContracts), title: "查看复盘来源与冻结版本" }, `来源 ${readySources}/${sourceContracts.length}`),
        h("button.btn.sm", { onclick: enterMeetingMode }, "会议"),
        h("button.btn.sm", { onclick: () => { state.tab = "history"; paint(); } }, "历史"),
        h("button.btn.primary.sm.bw-freeze-button", { onclick: toggleFreeze }, state.frozen ? `已冻结 · ${state.version}` : "冻结数据")
      ]),
      tabBar()
    ]);
  }

  function openSourceOverview(contracts) {
    const overlay = S.overlay("modal", { title: `复盘来源 · ${selectedPeriodLabel()}` });
    overlay.panel.classList.add("bw-source-overview-modal");
    overlay.body.append(
      h("div.bw-source-overview-list", contracts.map((contract) => h("button", {
        type: "button",
        onclick: () => { overlay.close(); openConfirmedSource(contract); }
      }, [
        h("span", contract.source),
        h("b", contract.version),
        pill(contract.statusLabel, contract.status === "published" ? "blue" : "green"),
        h("small", String(contract.confirmedAt || "--").replace("T", " ").slice(0, 16))
      ]))),
      h("p.bw-contract-note", "经营分析复盘只读取已确认或已发布的结果快照；点击来源可查看口径、版本并进入责任模块。")
    );
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"));
  }

  function tabBar() {
    return h("div.bw-view-tabs", { role: "tablist", "aria-label": "经营分析复盘视图" }, tabs.map((tab) => h("button", {
      type: "button", role: "tab", class: state.tab === tab.value ? "active" : "", "aria-selected": state.tab === tab.value,
      dataset: { businessAnalysisReviewTab: tab.value }, onclick: () => { state.tab = tab.value; paint(); }
    }, tab.label)));
  }

  function kpis(items, six) {
    return h(`section.bw-kpis${six ? ".six" : ""}`, items.map((item) => h("div.bw-kpi", [h("span", item.label), h("strong", { class: item.tone || "" }, item.value), h("small", { class: item.subTone || "" }, item.sub)])));
  }
  function panel(title, hint, content) { return h("section.bw-panel", [h("header.bw-panel-head", [h("h2", title), h("span", hint || "")]), content]); }
  function table(columns, rows) {
    return h("div.bw-table-wrap", h("table.bw-table", [
      h("thead", h("tr", columns.map((column) => h("th", { class: column[1] || "" }, column[0])))),
      h("tbody", rows.length ? rows.map((row) => h("tr", { class: row.class || "", "data-open": row.onClick ? "true" : null, onclick: row.onClick }, row.cells.map((cell, index) => h("td", { class: columns[index] && columns[index][1] || "" }, cell)))) : h("tr", h("td", { colspan: columns.length }, h("div.bw-empty", "当前筛选范围暂无数据"))))
    ]));
  }

  function overview() {
    const contracts = confirmed(); const now = contracts.business.result; const forecast = contracts.forecast.result;
    const countries = countryRowsForScope();
    const issues = exceptionItems(now, forecast);
    const completed = state.actions.filter((row) => row.status === "已完成").length;
    return h("div", [
      h("section.bw-overview-primary", [profitBridge(now), marketSummary(countries)]),
      h("section.bw-overview-secondary", [
        h("div", [h("b", "次要事项"), h("small", "需要时打开，不占用主复盘区域")]),
        h("button", { type: "button", onclick: () => openOverviewSecondary("exception", now, forecast) }, [
          h("span", "关键异常"), h("strong", String(issues.length)), h("small", issues[0]?.[0] || "暂无异常")
        ]),
        h("button", { type: "button", onclick: () => openOverviewSecondary("action", now, forecast) }, [
          h("span", "行动摘要"), h("strong", `${completed}/${state.actions.length}`), h("small", state.actions.find((row) => row.status !== "已完成")?.title || "全部完成")
        ])
      ])
    ]);
  }

  function profitBridge(data) {
    const ratio = (value) => pct(data.revenue ? value / data.revenue * 100 : null);
    const steps = [
      ["收入", data.revenue, `BP达成 ${pct(data.bpAchievement)} · ${data.poCount}个PO`, ""],
      ["− BOM", data.bom, `占收入 ${ratio(data.bom)}`, "cost"],
      ["− 物流", data.freight, `占收入 ${ratio(data.freight)} · ${data.missingFreightPoCount}个PO待补`, "cost"],
      ["= 毛利润", data.gp, `毛利率 ${pct(data.gpRate)}`, "profit"],
      ["− Credit Note", data.cn, `占收入 ${ratio(data.cn)}`, "cost"],
      ["= 净利润", data.np, `净利率 ${pct(data.npRate)}`, "profit"]
    ];
    return panel(`${selectedPeriodLabel()}利润桥`, "冻结口径 · EUR", h("div.bw-bridge", steps.map((step) => h(`div.bw-bridge-step.${step[3]}`, [h("small", step[0]), h("strong", money(step[1])), h("em", step[2])]))));
  }

  function exceptionItems(data, forecast) {
    const issues = [];
    if (data.missingFreightPoCount) issues.push(["物流费用未完整", `${data.missingFreightPoCount}个PO缺少费用，影响净利润准确性。`, "补数据", false]);
    if (data.bpAchievement != null && data.bpAchievement < 80) issues.push(["BP收入达成偏低", `当前达成${pct(data.bpAchievement)}，需要市场与产品拆解。`, money(data.revenue - data.bp), true]);
    forecast.exceptions.slice(0, 2).forEach((row) => issues.push([`${row.country} · ${row.sku.code || "SKU"}预测偏差`, `${row.month}预测${qty(row.forecast)}，有效PO${qty(row.po)}。`, changeText(row.variance), Math.abs(row.variance) >= 40]));
    if (!issues.length) issues.push(["未发现重大异常", "核心经营、预测与交付指标处于可接受范围。", "正常", false]);
    return issues;
  }

  function exceptionPanel(data, forecast) {
    const issues = exceptionItems(data, forecast);
    return panel("本期关键异常", `${issues.length}项`, h("div.bw-issue-list", issues.map((issue) => h(`div.bw-issue${issue[3] ? ".danger" : ""}`, [h("i"), h("div", [h("b", issue[0]), h("small", issue[1])]), h("strong", { class: issue[3] ? "bw-negative" : "bw-warning" }, issue[2])]))));
  }

  function marketSummary(rows) {
    return panel("市场复盘摘要", "点击市场进入贡献明细", table([["市场", ""], ["收入", "num"], ["BP达成", "num"], ["GP率", "num"], ["NP率", "num"], ["PO履约", "num"], ["复盘状态", ""]], rows.map((row) => ({
      cells: [row.country.code, money(row.revenue), pct(row.bpAchievement), pct(row.gpRate), pct(row.npRate), pct(row.fulfilment), pill(row.bpAchievement != null && row.bpAchievement < 75 ? "需行动" : "已确认", row.bpAchievement != null && row.bpAchievement < 75 ? "red" : "green")], onClick: () => openMarket(row.country.code)
    }))));
  }

  function actionSummary() {
    return panel("会议行动摘要", "自动同步到我的待办", h("div.bw-action-list", state.actions.slice(0, 5).map((action, index) => h("div.bw-action-row", [h("span.bw-action-index", index + 1), h("div", [h("b", action.title), h("small", `${action.owner} · ${action.due}`)]), pill(action.status, action.status === "已完成" ? "green" : action.status === "进行中" ? "blue" : "amber")]))));
  }

  function openOverviewSecondary(kind, data, forecast) {
    const isException = kind === "exception";
    const overlay = S.overlay("modal", { title: isException ? "本期关键异常" : "会议行动摘要" });
    overlay.panel.classList.add("bw-overview-secondary-modal");
    const sourcePanel = isException ? exceptionPanel(data, forecast) : actionSummary();
    overlay.body.append(sourcePanel.querySelector(isException ? ".bw-issue-list" : ".bw-action-list"));
    overlay.foot.append(
      h("button.btn", { type: "button", onclick: overlay.close }, "关闭"),
      h("button.btn.primary", { type: "button", onclick: () => { overlay.close(); state.tab = isException ? "forecast" : "action"; paint(); } }, isException ? "进入预测与交付" : "进入结论与行动")
    );
  }

  function profitView() {
    const result = confirmed().business.result;
    const now = result; const categories = result.details.categories; const products = result.details.skus;
    return h("div", [
      profitBridge(now),
      marketProfitExpense(now),
      categoryContribution(categories),
      panel("产品盈利明细", "费用金额后括号显示占产品收入比例", table([["型号 / 产品", ""], ["品类", ""], ["收入", "num"], ["BOM", "num"], ["物流费用", "num"], ["Credit Note", "num"], ["GP率", "num"], ["NP率", "num"]], products.map((row) => ({ cells: [h("div", [h("b", row.model), h("small", row.product)]), row.category, money(row.revenue), money(row.bom), expenseText(row.freight, row.revenue), expenseText(row.cn, row.revenue), pct(row.gpRate), pct(row.npRate)] }))))
    ]);
  }

  function expenseText(value, revenue) {
    return `${money(value)} (${pct(revenue ? value / revenue * 100 : null)})`;
  }

  function categoryContribution(categories) {
    const metrics = [
      { value: "revenue", label: "收入", field: "revenue" },
      { value: "gp", label: "毛利润", field: "gp" },
      { value: "np", label: "净利润", field: "np" }
    ];
    const metric = metrics.find((item) => item.value === state.categoryMetric) || metrics[0];
    const colors = ["#2f67e8", "#15926a", "#d9820b", "#c64f66", "#7f8ba3", "#6c63b5"];
    const chartRows = categories.map((row, index) => ({ ...row, color: colors[index % colors.length], value: Number(row[metric.field]) || 0 }));
    const magnitude = chartRows.reduce((sum, row) => sum + Math.abs(row.value), 0);
    let cursor = 0;
    const stops = chartRows.filter((row) => Math.abs(row.value) > 0).map((row) => {
      const start = cursor;
      cursor += magnitude ? Math.abs(row.value) / magnitude * 100 : 0;
      return `${row.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    const focused = chartRows.find((row) => row.category === state.categoryFocus);
    const signedTotal = chartRows.reduce((sum, row) => sum + row.value, 0);
    const share = (value) => magnitude ? Math.abs(value) / magnitude * 100 : 0;
    const contributionTable = table([["品类", ""], ["收入", "num"], ["达成", "num"], ["GP率", "num"], ["NP率", "num"]], chartRows.map((row) => ({
      class: row.category === state.categoryFocus ? "active" : "",
      onClick: () => { state.categoryFocus = state.categoryFocus === row.category ? "" : row.category; paint(); },
      cells: [
        h("div.bw-category-name", [h("i", { style: { background: row.color } }), h("span", [h("b", row.category), h("small", `${metric.label}贡献 ${pct(share(row.value))}`)])]),
        money(row.revenue), pct(row.bpAchievement), pct(row.gpRate), pct(row.npRate)
      ]
    })));
    const body = h("div.bw-category-contribution", [
      h("div.bw-category-table", contributionTable),
      h("aside.bw-category-chart", [
        h("div.bw-category-metric-tabs", { role: "tablist", "aria-label": "品类贡献维度" }, metrics.map((item) => h("button", {
          type: "button", role: "tab", class: item.value === metric.value ? "active" : "", "aria-selected": String(item.value === metric.value),
          dataset: { categoryMetric: item.value }, onclick: () => { state.categoryMetric = item.value; state.categoryFocus = ""; paint(); }
        }, item.label))),
        h("div.bw-donut", {
          role: "img",
          "aria-label": `${metric.label}品类贡献图`,
          style: { background: stops.length ? `conic-gradient(${stops.join(",")})` : "#e7ebf2" }
        }, h("div.bw-donut-center", [h("span", focused ? focused.category : `${metric.label}合计`), h("strong", money(focused ? focused.value : signedTotal)), focused ? h("small", `贡献 ${pct(share(focused.value))}`) : h("small", chartRows.some((row) => row.value < 0) ? "负值按绝对影响绘图" : `${chartRows.length}个品类`)])),
        h("div.bw-category-legend", chartRows.map((row) => h("button", {
          type: "button", class: row.category === state.categoryFocus ? "active" : "", onclick: () => { state.categoryFocus = state.categoryFocus === row.category ? "" : row.category; paint(); }
        }, [h("i", { style: { background: row.color } }), h("span", row.category), h("b", pct(share(row.value)))])))
      ])
    ]);
    const categoryPanel = panel("品类贡献", "点击表格或图例聚焦品类", body);
    categoryPanel.classList.add("bw-category-panel");
    return categoryPanel;
  }

  function expenseLink(kind, value, revenue, scope, label) {
    return h("button.bw-expense-link", {
      type: "button",
      dataset: { expenseKind: kind, expenseScope: scope || state.scope },
      title: `打开${label || (kind === "logistics" ? "物流费用" : "Credit Note")}明细`,
      onclick: (event) => { event.stopPropagation(); openExpenseModal(kind, scope); }
    }, expenseText(value, revenue));
  }

  function marketProfitExpense(data) {
    const rows = countryRowsForScope();
    const displayRows = rows.map((row) => {
      const needsAction = row.bpAchievement != null && row.bpAchievement < 75;
      const pendingCost = row.missingFreightPoCount > 0;
      return {
        cells: [
          row.country.code,
          money(row.revenue),
          pct(row.bpAchievement),
          pct(row.gpRate),
          expenseLink("logistics", row.freight, row.revenue, row.country.code),
          expenseLink("credit", row.cn, row.revenue, row.country.code),
          expenseText(row.freight + row.cn, row.revenue),
          pct(row.npRate),
          pill(pendingCost ? `${row.missingFreightPoCount}个PO待补` : needsAction ? "需行动" : "已确认", pendingCost ? "amber" : needsAction ? "red" : "green")
        ]
      };
    });
    if (state.scope === "ALL" && rows.length > 1) {
      const pendingCost = data.missingFreightPoCount > 0;
      displayRows.push({
        class: "bw-total-row",
        cells: [
          h("div", [h("b", "合计"), h("small", `${rows.length}个市场`)]),
          money(data.revenue), pct(data.bpAchievement), pct(data.gpRate),
          expenseLink("logistics", data.freight, data.revenue, "ALL", "全部市场物流费用"),
          expenseLink("credit", data.cn, data.revenue, "ALL", "全部市场Credit Note"),
          expenseText(data.freight + data.cn, data.revenue), pct(data.npRate),
          pill(pendingCost ? `${data.missingFreightPoCount}个PO待补` : "汇总已确认", pendingCost ? "amber" : "green")
        ]
      });
    }
    const marketPanel = panel("市场收入、利润与费用", state.scope === "ALL" ? "全部可见市场 · 点击费用金额查看冻结明细" : `${state.scope} · 点击费用金额查看冻结明细`, h("div.bw-expense-section", [
      table([["市场", ""], ["收入", "num"], ["BP达成", "num"], ["GP率", "num"], ["物流费用（占比）", "num"], ["Credit Note（占比）", "num"], ["费用合计（占比）", "num"], ["NP率", "num"], ["复盘状态", ""]], displayRows)
    ]));
    marketPanel.classList.add("bw-market-finance-expense");
    marketPanel.dataset.totalFreight = String(data.freight);
    marketPanel.dataset.totalCredit = String(data.cn);
    return marketPanel;
  }

  function openExpenseModal(kind, scopeOverride) {
    const scope = scopeOverride || state.scope;
    const contracts = M.confirmedResults(reviewMonths(), scope);
    const contract = kind === "logistics" ? contracts.logistics : contracts.settlement;
    const title = kind === "logistics" ? "物流费用明细" : "Credit Note明细";
    const options = kind === "logistics"
      ? [{ value: "po", label: "按PO" }, { value: "sku", label: "按产品SKU" }]
      : [{ value: "credit", label: "按Credit Note号" }, { value: "sku", label: "按产品SKU" }];
    let dimension = options[0].value;
    const overlay = S.overlay("modal", { title: `${title} · ${scope === "ALL" ? "全部市场" : scope}` });
    overlay.panel.classList.add("bw-expense-modal");
    const tabsNode = h("div.bw-expense-tabs", { role: "tablist", "aria-label": `${title}查看维度` });
    const tableNode = h("div.bw-expense-table");
    const context = h("div.bw-expense-context", [
      h("div", [h("span", "复盘期间"), h("b", selectedPeriodLabel())]),
      h("div", [h("span", "来源模块"), h("b", contract.source)]),
      h("div", [h("span", "版本"), h("b", contract.version)]),
      h("div", [h("span", "状态"), pill(contract.statusLabel, "green")])
    ]);

    function renderDetails() {
      S.clear(tabsNode);
      options.forEach((option) => tabsNode.append(h("button", {
        type: "button",
        role: "tab",
        class: dimension === option.value ? "active" : "",
        "aria-selected": String(dimension === option.value),
        dataset: { expenseDimension: option.value },
        onclick: () => { dimension = option.value; renderDetails(); }
      }, option.label)));
      S.clear(tableNode);
      if (kind === "logistics" && dimension === "po") {
        tableNode.append(table([["PO", ""], ["市场", ""], ["下单日期", ""], ["数量", "num"], ["收入", "num"], ["物流费用", "num"], ["费用状态", ""], ["备注", ""]], contract.result.details.byPo.map((row) => ({ cells: [
          row.poNumber, row.country, row.orderDate, qty(row.units), money(row.revenue), row.fee == null ? "--" : expenseText(row.fee, row.revenue),
          pill(row.status === "confirmed" ? "已确认" : "待补录", row.status === "confirmed" ? "green" : "amber"), row.note || "--"
        ] }))));
      } else if (kind === "logistics") {
        tableNode.append(table([["产品SKU", ""], ["市场", ""], ["PO数", "num"], ["数量", "num"], ["收入", "num"], ["分摊物流费用", "num"], ["缺费用PO", "num"]], contract.result.details.bySku.map((row) => ({ cells: [
          h("div", [h("b", row.sku), h("small", row.product)]), row.countries, row.poCount, qty(row.units), money(row.revenue), expenseText(row.fee, row.revenue), row.missingPoCount
        ] }))));
      } else if (dimension === "credit") {
        tableNode.append(table([["Credit Note号", ""], ["日期", ""], ["市场", ""], ["客户", ""], ["SKU行", "num"], ["类型", ""], ["金额", "num"]], contract.result.details.byCredit.map((row) => ({ cells: [
          row.creditNumber, row.date, row.countries, row.customers, row.skuCount, row.types, money(row.amount)
        ] }))));
      } else {
        tableNode.append(table([["产品SKU", ""], ["市场", ""], ["Credit Note数", "num"], ["类型", ""], ["金额", "num"]], contract.result.details.bySku.map((row) => ({ cells: [
          h("div", [h("b", row.sku), h("small", row.product)]), row.countries, row.creditCount, row.types, row.feeRate == null ? money(row.amount) : expenseText(row.amount, row.revenue)
        ] }))));
      }
    }

    overlay.body.append(context, tabsNode, tableNode, h("p.bw-contract-note", kind === "logistics"
      ? "SKU维度物流费用按同一PO内各SKU收入占比分摊；PO维度保留原始费用币种与确认状态。"
      : "Credit Note号维度汇总同一单号下的全部产品行；SKU维度按基础型号汇总，不改变原始Credit Note记录。"));
    overlay.foot.append(
      h("button.btn", { onclick: overlay.close }, "关闭"),
      h("button.btn.primary", { onclick: () => { overlay.close(); openSourceModule(contract.module); } }, kind === "logistics" ? "进入物流交付" : "进入结算台账")
    );
    renderDetails();
  }

  function forecastView() {
    const contracts = confirmed();
    const forecast = contracts.forecast.result;
    const now = contracts.business.result;
    const countryRows = countryRowsForScope().map((row) => ({ country: row.country, actual: row, forecast: M.confirmedResults(reviewMonths(), row.country.code).forecast.result }));
    const monthlyRows = reviewMonths().map((month) => {
      const monthContracts = M.confirmedResults([month], state.scope);
      const actual = monthContracts.business.result;
      const monthForecast = monthContracts.forecast.result;
      return {
        month,
        bp: monthContracts.bp.result.quantity,
        forecast: monthForecast.forecast,
        accuracy: monthForecast.accuracy,
        po: monthForecast.po,
        delivered: actual.delivered,
        fulfilment: actual.fulfilment
      };
    });
    return h("div", [
      h("section.bw-delivery-flow", [
        h("div", [h("span", "1"), h("small", "BP计划"), h("strong", qty(contracts.bp.result.quantity)), h("em", contracts.bp.statusLabel)]),
        h("div", [h("span", "2"), h("small", "滚动预测"), h("strong", qty(forecast.forecast)), h("em", `准确率 ${pct(forecast.accuracy)}`)]),
        h("div", [h("span", "3"), h("small", "有效PO"), h("strong", qty(forecast.po)), h("em", `预测差 ${forecast.gap >= 0 ? "+" : ""}${qty(forecast.gap)}`)]),
        h("div", [h("span", "4"), h("small", "已发货"), h("strong", qty(now.delivered)), h("em", `PO履约 ${pct(now.fulfilment)}`)])
      ]),
      panel("月度预测准确率与发货交付", "BP、预测和物流仅使用来源模块已确认结果；取消PO不计入", table([
        ["月份", ""], ["BP计划", "num"], ["滚动预测", "num"], ["预测准确率", "num"], ["有效PO", "num"], ["已发货", "num"], ["PO履约", "num"], ["复盘状态", ""]
      ], monthlyRows.map((row) => ({ cells: [
        M.periodLabel("month", row.month), qty(row.bp), qty(row.forecast), pct(row.accuracy), qty(row.po), qty(row.delivered), pct(row.fulfilment),
        pill(row.accuracy != null && row.accuracy < 80 ? "待解释" : row.fulfilment != null && row.fulfilment < 90 ? "交付关注" : "已确认", row.accuracy != null && row.accuracy < 80 ? "amber" : row.fulfilment != null && row.fulfilment < 90 ? "amber" : "green")
      ] })))),
      h("div.bw-grid", [
        panel("市场预测与交付汇总", state.scope === "ALL" ? "全部可见市场 · 单位：件" : `${state.scope} · 当前筛选市场`, table([["市场", ""], ["预测准确率", "num"], ["预测", "num"], ["有效PO", "num"], ["已发货", "num"], ["PO履约", "num"], ["状态", ""]], countryRows.map((row) => ({ cells: [row.country.code, pct(row.forecast.accuracy), qty(row.forecast.forecast), qty(row.forecast.po), qty(row.actual.delivered), pct(row.actual.fulfilment), pill(row.forecast.accuracy != null && row.forecast.accuracy < 80 ? "待解释" : row.actual.fulfilment != null && row.actual.fulfilment < 90 ? "交付关注" : "已确认", row.forecast.accuracy != null && row.forecast.accuracy < 80 ? "amber" : row.actual.fulfilment != null && row.actual.fulfilment < 90 ? "amber" : "green")] })))),
        panel("来源结果与异常", `${forecast.exceptions.length}项预测偏差`, h("div", [
          h("div.bw-source-stack", [sourceButton(contracts.bp), sourceButton(contracts.forecast), sourceButton(contracts.logistics)]),
          exceptionPanel(now, forecast).querySelector(".bw-issue-list")
        ]))
      ])
    ]);
  }

  function readinessCell(value, status) { return h(`div.bw-readiness.${status === "风险" ? "red" : status === "预警" ? "amber" : ""}`, [value, h("small", status === "风险" ? "存在卡点" : status === "预警" ? "需关注" : "按计划")]); }
  function projectView() {
    const risk = projectSamples.filter((row) => row.status === "风险").length;
    const marketRows = [["FR", 5, "92%", "94%", pill("正常", "green"), "POSM待审1项"], ["ES", 4, "81%", "84%", pill("风险", "red"), "PX51首批不足"], ["PL", 3, "88%", "91%", pill("正常", "green"), "渠道培训待确认"], ["NL", 2, "76%", "83%", pill("关注", "amber"), "上市物料缺2项"]]
      .filter((row) => state.scope === "ALL" || row[0] === state.scope);
    return h("div", [
      kpis([
        { label: "复盘项目", value: String(projectSamples.length), sub: "协同示例数据" },
        { label: "延期项目", value: String(risk), sub: "均保留原始时间线", tone: "bw-negative" },
        { label: "跨职能准备度", value: "76%", sub: "较上期 +5pp" },
        { label: "营销物料准备", value: "89%", sub: "缺少3项交付" },
        { label: "首批供应风险", value: "2", sub: "PX51、WAL101", tone: "bw-warning" },
        { label: "上市日期变化", value: "2", sub: "已同步Roadmap" }
      ], true),
      panel("项目与上市准备矩阵", "协同示例：正式接入后读取项目跟进、样机、质量、供应和营销物料", table([["项目 / 产品", ""], ["上市", ""], ["阶段", ""], ["研发", ""], ["样机", ""], ["质量", ""], ["供应", ""], ["营销", ""], ["健康", ""]], projectSamples.map((row) => ({ cells: [h("div", [h("b", `${row.code} · ${row.name}`), h("small", row.status === "风险" ? "时间线已变更" : "按当前计划")]), h("div", [h("b", row.launch), h("small", row.old)]), row.stage, readinessCell(row.rd, row.status), readinessCell(row.proto, row.status === "风险" ? "预警" : row.status), readinessCell(row.quality, row.status), readinessCell(row.supply, row.status), readinessCell(row.marketing, row.status === "正常" ? "预警" : row.status), pill(row.status, row.status === "风险" ? "red" : row.status === "预警" ? "amber" : "green")] })))),
      h("div.bw-grid.equal", [
        panel("市场上市准备", state.scope === "ALL" ? "渠道、物料、首批与上市节奏" : `${state.scope} · 当前筛选市场`, table([["市场", ""], ["上市项目", "num"], ["渠道确认", "num"], ["物料准备", "num"], ["首批供应", ""], ["主要缺口", ""]], marketRows.map((cells) => ({ cells })))),
        panel("上市时间线变化", "原计划、原因与后续影响均保留", h("div.bw-issue-list", [["PX51：8月15日 → 8月22日", "质量跌落测试复验 · +7天", "6月18日"], ["WAL101：9月14日 → 9月20日", "欧规安全预检失败 · +6天", "6月24日"], ["后续流程自动顺延", "认证、首批和营销交付同步更新", "7月2日"], ["Roadmap同步完成", "影响市场FR、ES、PL", "7月5日"]].map((item) => h("div.bw-issue", [h("i"), h("div", [h("b", item[0]), h("small", item[1])]), h("strong", item[2])]))))
      ])
    ]);
  }

  function actionView() {
    const completed = state.actions.filter((row) => row.status === "已完成").length;
    const pending = state.actions.filter((row) => row.status === "待确认" || row.status === "待处理").length;
    return h("div", [
      h("section.bw-action-compact-head", [
        h("div", [h("b", "结论与行动"), h("small", "首页只显示摘要，原因、证据与协同记录进入明细")]),
        h("span.bw-action-stat", ["结论", h("strong", String(state.conclusions.length))]),
        h("span.bw-action-stat", ["行动", h("strong", String(state.actions.length))]),
        h("span.bw-action-stat.warning", ["待处理", h("strong", String(pending))]),
        h("span.bw-action-stat", ["已完成", h("strong", String(completed))]),
        h("span.bw-control-grow"),
        h("button.btn.primary.sm", { type: "button", onclick: () => openActionDetail(-1) }, "+ 新增行动")
      ]),
      h("div.bw-action-compact-grid", [
        panel("本期结论", "按影响优先级排序", h("div.bw-review-summary-list", state.conclusions.map((item, index) => h("div.bw-review-summary-row", [
          h("span.bw-action-index", index + 1),
          h("div", [h("b", item.title), h("small", `影响：${item.impact} · Owner ${item.owner}`)]),
          pill(item.level, item.level === "重大" ? "red" : "amber"),
          h("button.btn.sm", { type: "button", onclick: () => openConclusionDetail(index) }, "查看")
        ])))),
        panel("行动清单", "点击编辑明细", table([["行动", ""], ["来源", ""], ["负责人", ""], ["DDL", ""], ["状态", ""], ["操作", ""]], state.actions.map((action, index) => ({ cells: [action.title, action.source, action.owner, action.due, pill(action.status, action.status === "已完成" ? "green" : action.status === "进行中" ? "blue" : action.status === "待确认" ? "red" : "amber"), h("button.btn.sm", { type: "button", onclick: () => openActionDetail(index) }, "编辑")] }))))
      ]),
      h("p.bw-action-autosave", "● 结论与行动明细自动保存在当前浏览器会话；正式发布后生成不可覆盖版本。")
    ]);
  }

  function reviewFormField(label, control, full) {
    return h("label.bw-review-detail-field", { class: full ? "full" : "" }, [h("span", label), control]);
  }

  function openConclusionDetail(index) {
    const item = state.conclusions[index];
    const overlay = S.overlay("drawer", { title: "查看与编辑结论明细" });
    overlay.panel.classList.add("bw-review-detail-drawer");
    const form = h("form.bw-review-detail-form", { onsubmit: (event) => event.preventDefault() }, [
      h("div.bw-review-detail-context", [
        h("div", [h("span", "复盘期间"), h("b", `${selectedPeriodLabel()} · ${state.version}`)]),
        h("div", [h("span", "冻结状态"), h("b", state.frozen ? "已冻结" : "草稿")])
      ]),
      reviewFormField("结论标题", h("input", { name: "title", value: item.title, required: true }), true),
      reviewFormField("影响范围", h("input", { name: "impact", value: item.impact })),
      reviewFormField("负责人", h("input", { name: "owner", value: item.owner })),
      reviewFormField("优先级", h("select", { name: "level" }, ["重大", "关注", "一般"].map((value) => h("option", { value, selected: value === item.level }, value)))),
      reviewFormField("事实与原因", h("textarea", { name: "summary" }, item.summary), true),
      reviewFormField("会议决策 / 后续动作", h("textarea", { name: "decision" }, item.decision), true)
    ]);
    overlay.body.append(form);
    overlay.foot.append(
      h("span.bw-detail-autosave", "● 自动保存到当前会话"),
      h("button.btn", { type: "button", onclick: overlay.close }, "取消"),
      h("button.btn.primary", { type: "button", onclick: () => {
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        state.conclusions[index] = { ...item, ...data };
        persist(); overlay.close(); paint(); S.toast("结论明细已更新");
      } }, "保存更新")
    );
  }

  function openActionDetail(index) {
    const isNew = index < 0;
    const item = isNew ? { title: "", source: "经营分析复盘", owner: "待分配", due: "待确认", status: "待处理", evidence: "待补充", detail: "" } : state.actions[index];
    const overlay = S.overlay("drawer", { title: isNew ? "新增行动" : "编辑行动明细" });
    overlay.panel.classList.add("bw-review-detail-drawer");
    const form = h("form.bw-review-detail-form", { onsubmit: (event) => event.preventDefault() }, [
      h("div.bw-review-detail-context", [
        h("div", [h("span", "复盘期间"), h("b", `${selectedPeriodLabel()} · ${state.version}`)]),
        h("div", [h("span", "同步规则"), h("b", "保存后同步行动摘要")])
      ]),
      reviewFormField("行动标题", h("input", { name: "title", value: item.title, required: true }), true),
      reviewFormField("来源模块", h("select", { name: "source" }, ["经营分析复盘", "BP达成", "预测管理", "物流交付", "结算台账", "项目跟进"].map((value) => h("option", { value, selected: value === item.source }, value)))),
      reviewFormField("负责人", h("input", { name: "owner", value: item.owner })),
      reviewFormField("DDL", h("input", { name: "due", value: item.due })),
      reviewFormField("状态", h("select", { name: "status" }, ["待处理", "待确认", "进行中", "已完成"].map((value) => h("option", { value, selected: value === item.status }, value)))),
      reviewFormField("原因与执行说明", h("textarea", { name: "detail" }, item.detail || ""), true),
      reviewFormField("完成证据 / 后续安排", h("textarea", { name: "evidence" }, item.evidence || ""), true)
    ]);
    overlay.body.append(form);
    overlay.foot.append(
      h("span.bw-detail-autosave", "● 自动保存到当前会话"),
      h("button.btn", { type: "button", onclick: overlay.close }, "取消"),
      h("button.btn.primary", { type: "button", onclick: () => {
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        if (isNew) state.actions.unshift(data); else state.actions[index] = { ...item, ...data };
        persist(); overlay.close(); paint(); S.toast(isNew ? "行动已创建" : "行动明细已更新");
      } }, isNew ? "创建行动" : "保存更新")
    );
  }

  function historyView() {
    const now = aggregate(); const before = prior();
    const historyRows = state.history.map((item, index) => h(`div.bw-history-row${index === 0 ? ".active" : ""}`, [
      h("div", [h("b", item.period), h("small", item.type)]),
      h("div", [h("b", item.version), h("small", item.status)]),
      h("div", [
        h("b", index === 0 ? `${money(now.revenue)} · BP ${pct(now.bpAchievement)} · NP ${pct(now.npRate)}` : "冻结指标快照"),
        h("small", index === 0 ? `${state.actions.length}个行动 · 历史不可覆盖` : "查看完整会议包")
      ]),
      h("div", [h("b", item.owner), h("small", item.date)]),
      h("div", [h("b", item.completion), h("small", "行动完成")]),
      pill(index === 0 ? "当前" : "查看", index === 0 ? "green" : "")
    ]));
    return h("div", [
      kpis([
        { label: "已归档复盘", value: String(state.history.length), sub: "正式与调整版本" },
        { label: "覆盖期间", value: "12个月", sub: "2025 Q3至今" },
        { label: "月度复盘", value: "9", sub: "最近：2026年6月" },
        { label: "季度复盘", value: "4", sub: "最近：2026 Q2" },
        { label: "历史行动完成", value: "78%", sub: "历史平均" },
        { label: "调整版本", value: "3", sub: "原始版本均保留" }
      ], true),
      h("div.bw-grid", [
        panel("复盘档案", "按期间、类型、市场和状态筛选", h("div.bw-table-wrap", h("div.bw-history-list", historyRows))),
        panel("版本详情与对比", `${selectedPeriodLabel()} · ${state.version}`, h("div.bw-panel-body", [
          table([["指标", ""], ["上一周期", "num"], ["当前版本", "num"], ["变化", "num"]], [
            { cells: ["收入", money(before.revenue), money(now.revenue), changeText(change(now.revenue, before.revenue))] },
            { cells: ["BP达成", pct(before.bpAchievement), pct(now.bpAchievement), changeText((now.bpAchievement || 0) - (before.bpAchievement || 0), "pp")] },
            { cells: ["毛利率", pct(before.gpRate), pct(now.gpRate), changeText((now.gpRate || 0) - (before.gpRate || 0), "pp")] },
            { cells: ["净利率", pct(before.npRate), pct(now.npRate), changeText((now.npRate || 0) - (before.npRate || 0), "pp")] }
          ]),
          h("p.muted", "历史趋势从冻结版本读取，不受后续Master Data、项目或价格变化影响。")
        ]))
      ])
    ]);
  }

  function openMarket(code) {
    const overlay = S.overlay("drawer", { title: `${code} · 经营分析复盘明细` });
    const result = M.confirmedResults(reviewMonths(), code).business.result;
    const data = result; const channels = result.details.channels;
    overlay.body.append(kpis([{ label: "收入", value: money(data.revenue), sub: pct(data.bpAchievement) }, { label: "GP率", value: pct(data.gpRate), sub: money(data.gp) }, { label: "NP率", value: pct(data.npRate), sub: money(data.np) }, { label: "PO履约", value: pct(data.fulfilment), sub: `${data.poCount}个PO` }]));
    overlay.body.append(table([["FD", ""], ["渠道", ""], ["收入", "num"], ["数量", "num"], ["履约", "num"]], channels.map((row) => ({ cells: [row.fd, row.channel, money(row.revenue), qty(row.units), pct(row.fulfilment)] }))));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"));
  }

  function advanceAction(index) {
    const action = state.actions[index]; const order = ["待处理", "进行中", "已完成"];
    action.status = order[(order.indexOf(action.status) + 1) % order.length];
    if (action.status === "已完成" && action.evidence === "待上传") action.evidence = "待补充证据";
    persist(); paint(); S.toast(`行动状态已更新为${action.status}`);
  }

  function toggleFreeze() {
    if (state.frozen) {
      S.toast("正式冻结版本不可覆盖；如需更正，请在历史复盘创建调整版本");
      state.tab = "history"; paint(); return;
    }
    state.frozen = true; state.version = "v1"; persist(); paint(); S.toast("本期数据已冻结并生成只读版本");
  }

  function enterMeetingMode() {
    const content = document.querySelector(".content");
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (content && content.requestFullscreen) content.requestFullscreen().catch(() => S.toast("浏览器未允许全屏，请使用窗口全屏"));
    else S.toast("当前浏览器不支持会议全屏");
  }

  function paint() {
    S.clear(root);
    const workspace = h("div.business-workspace.business-analysis-review-workspace", [
      controlShell()
    ]);
    const views = { overview, profit: profitView, forecast: forecastView, project: projectView, action: actionView, history: historyView };
    workspace.append((views[state.tab] || overview)()); root.append(workspace);
  }

  function render(target) { root = target; if (!state) init(); paint(); }

  window.Modules = window.Modules || {};
  window.Modules.performance = { render };
})();

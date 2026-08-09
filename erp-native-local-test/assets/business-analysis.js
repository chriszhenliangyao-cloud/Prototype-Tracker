(function () {
  "use strict";

  const h = window.S.h;
  const M = window.BusinessMetrics;
  const STORAGE_KEY = "erp-native-business-analysis-actions";
  const tabs = [
    { value: "overview", label: "综合复盘" },
    { value: "market", label: "市场与渠道" },
    { value: "product", label: "产品与盈利" },
    { value: "action", label: "行动与复盘" }
  ];
  let root;
  let state;

  function init() {
    state = {
      year: 2026,
      quarter: 2,
      scope: "ALL",
      compare: "prior",
      tab: "overview",
      actions: readActions()
    };
  }

  function readActions() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(stored)) return stored;
    } catch (error) { /* local demo storage can be empty */ }
    return [
      { title: "拆解ES收入与利润缺口", owner: "María · 销售 / GTM", due: "8月12日", source: "经营分析", status: "进行中" },
      { title: "核对Credit Note归属", owner: "Finance · 结算", due: "8月10日", source: "结算台账", status: "待确认" },
      { title: "补录缺失PO物流费用", owner: "Owen · 物流", due: "8月11日", source: "物流交付", status: "待处理" },
      { title: "补齐缺失市场BP", owner: "Julio · 经营计划", due: "8月9日", source: "BP达成", status: "已完成" }
    ];
  }

  function saveActions() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.actions));
  }

  function months(quarter) { return M.monthsForQuarter(state.year, quarter == null ? state.quarter : quarter); }
  function contracts(selectedMonths) { return M.confirmedResults(selectedMonths || months(), state.scope); }
  function current() { return contracts().business.result; }
  function countryRowsForScope() {
    return contracts().business.result.details.countries;
  }
  function previous() {
    if (state.quarter > 1) return M.confirmedResults(M.monthsForQuarter(state.year, state.quarter - 1), state.scope).business.result;
    return M.confirmedResults(M.monthsForQuarter(state.year - 1, 4), state.scope).business.result;
  }
  function money(value) {
    const abs = Math.abs(Number(value) || 0);
    const sign = Number(value) < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}€${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(1)}K`;
    return `${sign}€${Math.round(abs).toLocaleString("en-US")}`;
  }
  function qty(value) {
    const abs = Math.abs(Number(value) || 0);
    if (abs >= 1000000) return `${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${(abs / 1000).toFixed(1)}K`;
    return Math.round(abs).toLocaleString("en-US");
  }
  function pct(value) { return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}%`; }
  function delta(now, before) {
    if (!before) return null;
    return (now - before) / Math.abs(before) * 100;
  }
  function pp(now, before) {
    if (now == null || before == null) return null;
    return now - before;
  }
  function deltaText(value, suffix) {
    if (value == null || !Number.isFinite(value)) return "无可比基准";
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix || "%"}`;
  }
  function tone(value, goodHigh) {
    if (value == null) return "";
    const good = goodHigh === false ? value <= 0 : value >= 0;
    return good ? "bw-positive" : "bw-negative";
  }
  function pill(text, kind) { return h(`span.bw-pill.${kind || ""}`, text); }

  function sourceButton(contract) {
    return h("button.bw-source", {
      type: "button",
      title: `查看${contract.source}确认版本`,
      dataset: { sourceModule: contract.module },
      onclick: () => openConfirmedSource(contract)
    }, `${contract.source} · ${contract.statusLabel}`);
  }

  function openConfirmedSource(contract) {
    const overlay = S.overlay("modal", { title: `${contract.source} · 已确认结果` });
    overlay.panel.classList.add("bw-source-modal");
    overlay.body.append(h("div.bw-source-contract", [
      h("div", [h("span", "来源模块"), h("b", contract.source)]),
      h("div", [h("span", "结果状态"), pill(contract.statusLabel, "green")]),
      h("div", [h("span", "版本"), h("b", contract.version)]),
      h("div", [h("span", "确认时间"), h("b", String(contract.confirmedAt || "--").replace("T", " ").slice(0, 16))])
    ]), h("p.bw-contract-note", "经营分析只读取来源模块已确认结果；源数据更新后需要生成新版本，已冻结业务复盘保持原快照。"));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"), h("button.btn.primary", { onclick: () => {
      overlay.close();
      const button = document.querySelector(`[data-module="${contract.module}"]`) || document.querySelector(`[data-existing-module="${contract.module}"]`);
      if (button) button.click(); else S.toast("该来源模块暂未配置入口");
    } }, "进入源模块"));
  }

  function selectField(label, value, options, onChange) {
    return h("label.bw-field", [
      h("span", label),
      h("select", { onchange: (event) => onChange(event.target.value) }, options.map((option) =>
        h("option", { value: option.value, selected: option.value === value }, option.label)))
    ]);
  }

  function pageHead() {
    return h("div.bw-page-head", [
      h("div.bw-title", [h("small", "BUSINESS ANALYSIS"), h("strong", "经营分析")]),
      h("div.bw-head-meta", "识别经营偏差、解释利润变化并推动行动闭环"),
      h("div.bw-actions", [
        h("button.btn", { onclick: showMethod }, "查看口径"),
        h("button.btn", { onclick: exportCurrent }, "导出分析明细"),
        h("button.btn.primary", { onclick: createAction }, "创建行动项")
      ])
    ]);
  }

  function filterBar() {
    const countries = [{ value: "ALL", label: "全部可见市场" }].concat(M.activeCountries().map((country) => ({ value: country.code, label: `${country.code} · ${country.name_en}` })));
    const sourceContracts = contracts();
    return h("div.bw-filter-bar", [
      selectField("年度", String(state.year), [2026, 2025, 2024].map((year) => ({ value: String(year), label: String(year) })), (value) => { state.year = Number(value); paint(); }),
      selectField("季度", String(state.quarter), [1, 2, 3, 4].map((quarter) => ({ value: String(quarter), label: `Q${quarter}` })), (value) => { state.quarter = Number(value); paint(); }),
      selectField("市场范围", state.scope, countries, (value) => { state.scope = value; paint(); }),
      selectField("对比基准", state.compare, [{ value: "prior", label: "上一季度" }, { value: "bp", label: "当前BP" }], (value) => { state.compare = value; paint(); }),
      h("div.bw-sources", [
        sourceButton(sourceContracts.bp), sourceButton(sourceContracts.logistics),
        sourceButton(sourceContracts.settlement),
        h("button.bw-source", { type: "button", onclick: () => document.querySelector('[data-existing-module="system"]')?.click() }, "Master Data · 已同步")
      ])
    ]);
  }

  function tabBar() {
    return h("div.bw-view-tabs", { role: "tablist", "aria-label": "经营分析视图" }, tabs.map((tab) =>
      h("button", {
        type: "button",
        role: "tab",
        class: state.tab === tab.value ? "active" : "",
        "aria-selected": state.tab === tab.value,
        dataset: { businessAnalysisTab: tab.value },
        onclick: () => { state.tab = tab.value; paint(); }
      }, tab.label)));
  }

  function kpiRow(items, six) {
    return h(`section.bw-kpis${six ? ".six" : ""}`, items.map((item) =>
      h("div.bw-kpi", [
        h("span", item.label), h("strong", { class: item.tone || "" }, item.value),
        h("small", { class: item.subTone || "" }, item.sub)
      ])));
  }

  function panel(title, hint, content, extraClass) {
    return h(`section.bw-panel${extraClass ? `.${extraClass}` : ""}`, [
      h("header.bw-panel-head", [h("h2", title), h("span", hint || "")]),
      content
    ]);
  }

  function overview() {
    const now = current();
    const prior = previous();
    const revenueDelta = delta(now.revenue, prior.revenue);
    const gpDelta = pp(now.gpRate, prior.gpRate);
    const npDelta = pp(now.npRate, prior.npRate);
    const countries = countryRowsForScope();
    const exceptions = buildIssues(now, countries);
    return h("div.business-workspace-view", [
      kpiRow([
        { label: "季度收入", value: money(now.revenue), sub: `较上季度 ${deltaText(revenueDelta)} · ${qty(now.units)}件`, subTone: tone(revenueDelta) },
        { label: "BP收入达成", value: pct(now.bpAchievement), sub: now.bp ? `距离目标 ${money(now.revenue - now.bp)}` : "当前范围未配置BP", tone: now.bpAchievement != null && now.bpAchievement < 90 ? "bw-negative" : "" },
        { label: "毛利润率", value: pct(now.gpRate), sub: `较上季度 ${deltaText(gpDelta, "pp")}`, subTone: tone(gpDelta) },
        { label: "净利润率", value: pct(now.npRate), sub: `较上季度 ${deltaText(npDelta, "pp")} · CN ${money(now.cn)}`, subTone: tone(npDelta) }
      ]),
      h("div.bw-grid", [profitBridge(now), issuePanel(exceptions)]),
      h("div.bw-grid", [marketDiagnosis(countries), actionPanel()])
    ]);
  }

  function profitBridge(data) {
    const steps = [
      ["收入 Revenue", data.revenue, `${data.poCount}个PO · ${qty(data.units)}件`, ""],
      ["− BOM", data.bom, `收入的 ${pct(data.revenue ? data.bom / data.revenue * 100 : null)}`, "cost"],
      ["− 物流费用", data.freight, `${data.freightPoCount}/${data.poCount} PO有费用`, "cost"],
      ["= 毛利润", data.gp, `GP ${pct(data.gpRate)}`, "profit"],
      ["− Credit Note", data.cn, `收入的 ${pct(data.revenue ? data.cn / data.revenue * 100 : null)}`, "cost"],
      ["= 净利润", data.np, `NP ${pct(data.npRate)}`, "profit"]
    ];
    return panel("季度利润桥", "实际收入 → 净利润 · EUR", h("div.bw-bridge", steps.map((step) =>
      h(`div.bw-bridge-step.${step[3]}`, [h("small", step[0]), h("strong", money(step[1])), h("em", step[2])]))));
  }

  function buildIssues(data, countries) {
    const issues = [];
    countries.filter((row) => row.bpAchievement != null && row.bpAchievement < 75).slice(0, 2).forEach((row) => {
      issues.push({ danger: true, title: `${row.country.code}收入达成仅${pct(row.bpAchievement)}`, detail: "销售规模低于BP，需要继续拆解渠道与产品贡献。", value: money(row.revenue - row.bp) });
    });
    if (data.missingFreightPoCount) issues.push({ danger: false, title: `${data.missingFreightPoCount}个PO缺少物流费用`, detail: "净利润当前按已录入物流费用计算，需在物流交付补录。", value: "补数据" });
    if (data.cn) issues.push({ danger: data.cn > data.revenue * .05, title: "Credit Note影响净利润", detail: "建议按市场、PO、SKU与扣款类型核对责任归属。", value: money(data.cn) });
    if (!issues.length) issues.push({ danger: false, title: "当前未识别重大偏差", detail: "继续关注BP达成、利润率及交付完整性。", value: "正常" });
    return issues.slice(0, 4);
  }

  function issuePanel(issues) {
    return panel("关键偏差", `${issues.length}项需要解释`, h("div.bw-issue-list", issues.map((issue) =>
      h(`div.bw-issue${issue.danger ? ".danger" : ""}`, [h("i"), h("div", [h("b", issue.title), h("small", issue.detail)]), h("strong", { class: issue.danger ? "bw-negative" : "bw-warning" }, issue.value)]))));
  }

  function marketDiagnosis(rows) {
    return panel("市场经营诊断", "点击市场查看渠道贡献", table([
      ["市场", ""], ["收入", "num"], ["BP达成", "num"], ["GP率", "num"], ["NP率", "num"], ["主要偏差", ""], ["行动状态", ""]
    ], rows.map((row) => ({
      cells: [
        h("div", [h("b", row.country.code), h("small", `${qty(row.units)}件`)]), money(row.revenue), pill(pct(row.bpAchievement), row.bpAchievement == null ? "amber" : row.bpAchievement < 75 ? "red" : "green"),
        pct(row.gpRate), pct(row.npRate), marketInsight(row), pill(row.bpAchievement == null ? "补数据" : row.bpAchievement < 75 ? "需行动" : "已确认", row.bpAchievement == null ? "amber" : row.bpAchievement < 75 ? "red" : "green")
      ],
      onClick: () => openMarket(row.country.code)
    }))));
  }

  function marketInsight(row) {
    if (row.bpAchievement == null) return "缺少BP，暂不判断达成";
    if (row.bpAchievement < 60) return "收入缺口较大，需渠道与产品拆解";
    if (row.npRate != null && row.npRate < 20) return "收入与扣款共同侵蚀利润";
    return "达成与盈利结构相对稳定";
  }

  function actionPanel() {
    return panel("行动闭环", "经营分析与异常转入", h("div.bw-action-list", state.actions.slice(0, 5).map((action, index) =>
      h("div.bw-action-row", [h("span.bw-action-index", index + 1), h("div", [h("b", action.title), h("small", `${action.owner} · ${action.due}`)]), h("button.btn.sm", { onclick: () => updateAction(index) }, action.status)]))));
  }

  function marketView() {
    const countryRows = countryRowsForScope();
    const channels = contracts().business.result.details.channels;
    const topMarket = countryRows[0];
    return h("div.business-workspace-view", [
      kpiRow([
        { label: "可见市场", value: String(countryRows.length), sub: state.scope === "ALL" ? "全部授权范围" : state.scope },
        { label: "市场收入", value: money(current().revenue), sub: `${qty(current().units)}件 · ${current().poCount}个PO` },
        { label: "最大收入市场", value: topMarket ? topMarket.country.code : "--", sub: topMarket ? money(topMarket.revenue) : "无数据" },
        { label: "渠道/客户", value: String(channels.length), sub: "点击明细查看FD归属" }
      ]),
      panel("市场经营表现", "所有市场口径", marketDiagnosis(countryRows).querySelector(".bw-table-wrap")),
      panel("渠道与FD贡献", "FD → Retailer归属及PO履约", table([
        ["市场", ""], ["FD", ""], ["渠道 / Retailer", ""], ["收入", "num"], ["数量", "num"], ["PO", "num"], ["履约率", "num"], ["状态", ""]
      ], channels.map((row) => ({
        cells: [row.country, row.fd, row.channel, money(row.revenue), qty(row.units), row.poCount, pct(row.fulfilment), pill(row.fulfilment != null && row.fulfilment < 90 ? "需跟进" : "正常", row.fulfilment != null && row.fulfilment < 90 ? "amber" : "green")],
        onClick: () => openChannel(row)
      }))))
    ]);
  }

  function productView() {
    const result = contracts().business.result;
    const categories = result.details.categories;
    const products = result.details.skus;
    const lowMargin = products.filter((row) => row.npRate != null && row.npRate < 20).length;
    return h("div.business-workspace-view", [
      kpiRow([
        { label: "有销量产品", value: String(products.length), sub: "按基础型号合并颜色" },
        { label: "品类数", value: String(categories.length), sub: "来自Master Data" },
        { label: "低净利产品", value: String(lowMargin), sub: "NP率低于20%", tone: lowMargin ? "bw-negative" : "" },
        { label: "产品收入", value: money(current().revenue), sub: `${qty(current().units)}件` }
      ]),
      panel("品类贡献", "收入、BP与利润结构", table([
        ["品类", ""], ["收入", "num"], ["BP", "num"], ["达成", "num"], ["GP率", "num"], ["NP率", "num"], ["数量", "num"]
      ], categories.map((row) => ({ cells: [row.category, money(row.revenue), money(row.bp), pct(row.bpAchievement), pct(row.gpRate), pct(row.npRate), qty(row.units)] })))),
      panel("产品盈利诊断", "点击产品查看成本与扣款构成", table([
        ["型号 / 产品", ""], ["品类", ""], ["收入", "num"], ["BOM", "num"], ["物流", "num"], ["CN", "num"], ["GP率", "num"], ["NP率", "num"], ["状态", ""]
      ], products.map((row) => ({
        cells: [h("div", [h("b", row.model), h("small", row.product)]), row.category, money(row.revenue), money(row.bom), money(row.freight), money(row.cn), pct(row.gpRate), pct(row.npRate), pill(row.npRate != null && row.npRate < 20 ? "低利润" : "正常", row.npRate != null && row.npRate < 20 ? "red" : "green")],
        onClick: () => openProduct(row)
      }))))
    ]);
  }

  function actionView() {
    const reviews = M.reviews(state.year, state.quarter, state.scope);
    return h("div.business-workspace-view", [
      kpiRow([
        { label: "渠道复盘记录", value: String(reviews.length), sub: "来自季度Review" },
        { label: "行动项", value: String(state.actions.length), sub: `${state.actions.filter((row) => row.status === "已完成").length}项已完成` },
        { label: "待处理", value: String(state.actions.filter((row) => row.status !== "已完成").length), sub: "同步我的待办" },
        { label: "完成率", value: pct(state.actions.length ? state.actions.filter((row) => row.status === "已完成").length / state.actions.length * 100 : 0), sub: "按完成证据确认" }
      ]),
      h("div.bw-grid", [
        panel("渠道复盘事实与动作", "来自市场季度复盘记录", table([
          ["市场", ""], ["渠道 / FD", ""], ["季度事实", ""], ["下一步", ""], ["目标", ""], ["所需支持", ""]
        ], reviews.slice(0, 12).map((row) => ({ cells: [
          (M.activeCountries().find((country) => country.id === row.country_id) || {}).code || "--",
          row.channel || row.ka_name || "渠道复盘", row.summary || row.performance_summary || "已完成复盘记录", row.next_move || "待补充", row.target || "待确认", row.support_needed || row.support || "无"
        ] })))),
        actionPanel()
      ]),
      panel("行动闭环清单", "修改状态后自动保存在当前浏览器会话", table([
        ["行动项", ""], ["来源模块", ""], ["责任人与职能", ""], ["截止日期", ""], ["状态", ""], ["操作", ""]
      ], state.actions.map((action, index) => ({ cells: [action.title, action.source, action.owner, action.due, pill(action.status, action.status === "已完成" ? "green" : action.status === "进行中" ? "blue" : "amber"), h("button.btn.sm", { onclick: () => updateAction(index) }, "更新")] }))))
    ]);
  }

  function table(columns, rows) {
    return h("div.bw-table-wrap", h("table.bw-table", [
      h("thead", h("tr", columns.map((column) => h("th", { class: column[1] || "" }, column[0])))),
      h("tbody", rows.length ? rows.map((row) => h("tr", { "data-open": row.onClick ? "true" : null, onclick: row.onClick }, row.cells.map((cell, index) => h("td", { class: columns[index] && columns[index][1] || "" }, cell)))) : h("tr", h("td", { colspan: columns.length }, h("div.bw-empty", "当前筛选范围暂无数据"))))
    ]));
  }

  function openMarket(code) {
    const channels = M.confirmedResults(months(), code).business.result.details.channels;
    const overlay = S.overlay("drawer", { title: `${code} 市场渠道贡献` });
    overlay.body.append(table([["FD", ""], ["渠道", ""], ["收入", "num"], ["数量", "num"], ["履约", "num"]], channels.map((row) => ({ cells: [row.fd, row.channel, money(row.revenue), qty(row.units), pct(row.fulfilment)] }))));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"));
  }

  function openChannel(row) {
    const overlay = S.overlay("drawer", { title: `${row.country} · ${row.channel}` });
    overlay.body.append(h("div.bw-panel-body", [
      h("p", [h("strong", "FD归属："), row.fd]), h("p", [h("strong", "季度收入："), money(row.revenue)]),
      h("p", [h("strong", "有效PO："), String(row.poCount)]), h("p", [h("strong", "履约率："), pct(row.fulfilment)]),
      h("p.muted", "渠道记录来自PO与Master Data关系，Retailer端没有确认数据时不计算Retailer达成率。")
    ]));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"));
  }

  function openProduct(row) {
    const overlay = S.overlay("drawer", { title: `${row.model} · 产品盈利构成` });
    overlay.body.append(profitBridge({ ...current(), revenue: row.revenue, units: row.units, poCount: "--", bom: row.bom, freight: row.freight, freightPoCount: "--", cn: row.cn, gp: row.gp, np: row.np, gpRate: row.gpRate, npRate: row.npRate }));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"));
  }

  function showMethod() {
    const overlay = S.overlay("modal", { title: "经营分析口径" });
    overlay.body.append(h("div", [
      h("p", "收入与Achieve按有效PO数量及金额计算；已取消PO不计入。"),
      h("p", "毛利润 = 收入 - BOM - 物流费用；净利润 = 毛利润 - Credit Note。"),
      h("p", "金额按版本化FX统一折算EUR；缺失物流费用会作为数据异常提示。"),
      h("p", "历史复盘不在本页覆盖，正式冻结版本统一进入业务复盘。")
    ]));
    overlay.foot.append(h("button.btn.primary", { onclick: overlay.close }, "知道了"));
  }

  function createAction() {
    const overlay = S.overlay("modal", { title: "创建经营行动项" });
    const title = h("input", { type: "text", placeholder: "行动项名称" });
    const owner = h("input", { type: "text", placeholder: "负责人 / 职能" });
    const due = h("input", { type: "date", value: "2026-08-15" });
    overlay.body.append(h("div", { style: { display: "grid", gap: "12px" } }, [title, owner, due]));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "取消"), h("button.btn.primary", { onclick: () => {
      if (!title.value.trim()) { S.toast("请填写行动项名称"); return; }
      state.actions.unshift({ title: title.value.trim(), owner: owner.value.trim() || "待分配", due: due.value || "待确认", source: "经营分析", status: "待处理" });
      saveActions(); overlay.close(); paint(); S.toast("行动项已创建并保存到当前会话");
    } }, "创建"));
  }

  function updateAction(index) {
    const action = state.actions[index];
    const order = ["待处理", "进行中", "已完成"];
    action.status = order[(order.indexOf(action.status) + 1) % order.length];
    saveActions(); paint(); S.toast(`行动状态已更新为${action.status}`);
  }

  function exportCurrent() {
    const rows = countryRowsForScope();
    const csv = [["Market", "Revenue EUR", "BP EUR", "BP Achievement", "GP Rate", "NP Rate"], ...rows.map((row) => [row.country.code, row.revenue, row.bp, row.bpAchievement || "", row.gpRate || "", row.npRate || ""])].map((row) => row.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `business-analysis-${state.year}-Q${state.quarter}.csv`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  function paint() {
    S.clear(root);
    const workspace = h("div.business-workspace.business-analysis-workspace", [
      pageHead(),
      h("div.bw-method-bar", [h("strong", "分析口径"), "有效PO为实际达成；取消PO不计入；金额统一换算EUR", h("span.grow"), `数据范围 ${state.year} Q${state.quarter}`]),
      filterBar(), tabBar()
    ]);
    const content = state.tab === "market" ? marketView() : state.tab === "product" ? productView() : state.tab === "action" ? actionView() : overview();
    workspace.append(content);
    root.append(workspace);
  }

  function render(target) {
    root = target;
    if (!state) init();
    paint();
  }

  window.Modules = window.Modules || {};
  window.Modules.performance = { render };
})();

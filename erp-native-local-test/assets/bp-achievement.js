(function () {
  "use strict";

  const h = window.S.h;
  const M = window.BusinessMetrics;
  const tabs = [
    { value: "overview", label: "综合达成" },
    { value: "market", label: "市场与品类" },
    { value: "product", label: "产品明细" },
    { value: "version", label: "版本记录" }
  ];
  const marketViews = [
    { value: "matrix", label: "达成矩阵" },
    { value: "trend", label: "趋势与预测" },
    { value: "structure", label: "结构与缺口" }
  ];
  const categoryOrder = ["Power bank", "Charger", "Wireless charger", "Cable", "Other"];
  const categoryNames = {
    "Power bank": "移动电源",
    Charger: "充头",
    "Wireless charger": "无线充",
    Cable: "充电线",
    Other: "其他"
  };
  let root;
  let state;

  function init() {
    state = {
      year: 2026,
      period: "year",
      scope: "ALL",
      metric: "value",
      tab: "overview",
      marketView: "matrix",
      selectedCell: null,
      selectedSku: null,
      gapDimension: "market",
      search: "",
      hideEmpty: true
    };
  }

  function months() {
    return state.period === "year"
      ? M.monthsForYear(state.year)
      : M.monthsForQuarter(state.year, Number(state.period.slice(1)));
  }
  function contract(selectedScope, selectedMonths) {
    return M.confirmedResults(selectedMonths || months(), selectedScope == null ? state.scope : selectedScope).bp;
  }
  function result(selectedScope, selectedMonths) { return contract(selectedScope, selectedMonths).result; }
  function periodLabel() { return state.period === "year" ? `${state.year}年度` : `${state.year} ${state.period}`; }
  function metricLabel() { return state.metric === "value" ? "金额" : "数量"; }
  function target(row) { return state.metric === "value" ? row.value : row.quantity; }
  function actual(row) { return state.metric === "value" ? row.actualValue : row.actualQuantity; }
  function gap(row) { return state.metric === "value" ? row.valueGap : row.quantityGap; }
  function achievement(row) { return state.metric === "value" ? row.achievement : row.quantityAchievement; }
  function detailTarget(row) { return state.metric === "value" ? row.bp : row.bpQuantity; }
  function detailActual(row) { return state.metric === "value" ? row.revenue : row.units; }
  function detailAchievement(row) { return state.metric === "value" ? row.bpAchievement : row.bpQuantityAchievement; }

  function money(value) {
    const number = Number(value) || 0;
    const abs = Math.abs(number);
    const sign = number < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}€${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(1)}K`;
    return `${sign}€${Math.round(abs).toLocaleString("en-US")}`;
  }
  function quantity(value) {
    const number = Number(value) || 0;
    const abs = Math.abs(number);
    const sign = number < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
    return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  }
  function format(value) { return state.metric === "value" ? money(value) : quantity(value); }
  function pct(value) { return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}%`; }
  function kind(value) {
    if (value == null) return "gray";
    if (value >= 90) return "green";
    if (value >= 70) return "amber";
    return "red";
  }
  function status(value) {
    if (value == null) return "未配置BP";
    if (value >= 100) return "已达成";
    if (value >= 90) return "接近目标";
    if (value >= 70) return "需关注";
    return "偏差较大";
  }
  function pill(text, tone) { return h(`span.bw-pill.${tone || ""}`, text); }
  function rateBar(value) {
    const rate = value == null ? 0 : Math.max(0, Math.min(100, value));
    return h("div.bp-rate", [
      h("div.bp-rate-track", h("span", { class: kind(value), style: { width: `${rate}%` } })),
      h("strong", { class: value != null && value < 70 ? "bw-negative" : value != null && value < 90 ? "bw-warning" : "bw-positive" }, pct(value))
    ]);
  }

  function selectField(label, value, options, onChange) {
    return h("label.bw-field", [
      h("span", label),
      h("select", { onchange: (event) => onChange(event.target.value) }, options.map((option) =>
        h("option", { value: option.value, selected: option.value === value }, option.label)))
    ]);
  }

  function controlShell() {
    const current = contract();
    const shortVersion = /-v\d+$/.exec(current.version)?.[0].slice(1) || current.version;
    const countryOptions = [{ value: "ALL", label: "全部可见市场" }].concat(M.activeCountries().map((country) => ({
      value: country.code,
      label: `${country.code} · ${country.name_en}`
    })));
    return h("section.bp-control", [
      h("div.bp-control-main", [
        h("div.bw-title.compact", [h("small", "BP ACHIEVEMENT"), h("strong", "BP达成")]),
        selectField("年度", String(state.year), [2026, 2025, 2024].map((year) => ({ value: String(year), label: String(year) })), (value) => { state.year = Number(value); paint(); }),
        selectField("周期", state.period, [
          { value: "year", label: "全年" }, { value: "Q1", label: "第一季度" }, { value: "Q2", label: "第二季度" }, { value: "Q3", label: "第三季度" }, { value: "Q4", label: "第四季度" }
        ], (value) => { state.period = value; paint(); }),
        selectField("市场", state.scope, countryOptions, (value) => { state.scope = value; paint(); }),
        selectField("口径", state.metric, [{ value: "value", label: "SI金额" }, { value: "quantity", label: "SI数量" }], (value) => { state.metric = value; paint(); }),
        h("span.bp-control-grow"),
        h("button.btn.sm", { onclick: showMethod }, "口径说明"),
        h("button.btn.sm", { onclick: exportDetails }, "导出"),
        h("button.btn.primary.sm.bp-version-button", { title: `${current.version} · ${String(current.confirmedAt).slice(0, 16)}`, onclick: () => { state.tab = "version"; paint(); } }, `${current.statusLabel} · ${shortVersion}`)
      ]),
      tabBar()
    ]);
  }

  function tabBar() {
    return h("div.bw-view-tabs", { role: "tablist", "aria-label": "BP达成视图" }, tabs.map((tab) => h("button", {
      type: "button",
      role: "tab",
      class: state.tab === tab.value ? "active" : "",
      "aria-selected": String(state.tab === tab.value),
      dataset: { bpView: tab.value },
      onclick: () => { state.tab = tab.value; paint(); }
    }, tab.label)));
  }

  function kpis(data) {
    const targetValue = target(data);
    const actualValue = actual(data);
    const gapValue = gap(data);
    const rate = achievement(data);
    return h("div.bw-kpis.bp-kpis", [
      h("div.bw-kpi", [h("span", `BP目标 · ${metricLabel()}`), h("strong", format(targetValue)), h("small", periodLabel())]),
      h("div.bw-kpi", [h("span", "实际达成 · 有效PO"), h("strong", format(actualValue)), h("small", "已取消PO不计入")]),
      h("div.bw-kpi", [h("span", "目标差额"), h("strong", { class: gapValue >= 0 ? "bw-positive" : "bw-negative" }, format(gapValue)), h("small", gapValue >= 0 ? "已超过当前目标" : "尚需补足")]),
      h("div.bw-kpi", [h("span", "BP达成率"), h("strong", { class: kind(rate) === "green" ? "bw-positive" : kind(rate) === "amber" ? "bw-warning" : "bw-negative" }, pct(rate)), h("small", status(rate))])
    ]);
  }

  function panel(title, meta, body, className) {
    return h(`section.bw-panel${className ? `.${className}` : ""}`, [
      h("header.bw-panel-head", [h("h2", title), meta ? h("span", meta) : null]),
      body
    ]);
  }

  function overview() {
    const data = result();
    return h("div.bp-view", [
      kpis(data),
      panel("季度达成", `点击季度切换明细 · 当前口径：${metricLabel()}`, h("div.bp-quarter-grid", [1, 2, 3, 4].map((quarter) => quarterCard(quarter)))),
      h("div.bw-grid", [
        panel("月度目标与实际", `${state.year}年 · ${state.scope === "ALL" ? "全部可见市场" : state.scope}`, monthlyTable()),
        panel("市场达成提醒", "按达成率从低到高", marketAlertTable())
      ])
    ]);
  }

  function quarterCard(quarter) {
    const row = result(state.scope, M.monthsForQuarter(state.year, quarter));
    const rate = achievement(row);
    return h("button.bp-quarter", {
      type: "button",
      class: state.period === `Q${quarter}` ? "active" : "",
      onclick: () => { state.period = `Q${quarter}`; paint(); }
    }, [
      h("header", [h("b", `${state.year} Q${quarter}`), pill(status(rate), kind(rate))]),
      h("div.bp-quarter-values", [
        h("span", [h("small", "BP"), h("strong", format(target(row)))]),
        h("span", [h("small", "实际"), h("strong", format(actual(row)))])
      ]),
      rateBar(rate)
    ]);
  }

  function monthlyRows() {
    return M.monthsForYear(state.year).map((month) => {
      const row = result(state.scope, [month]);
      return { month, row, rate: achievement(row) };
    });
  }

  function monthlyTable() {
    const visible = state.period === "year" ? monthlyRows() : monthlyRows().filter((item) => {
      const month = Number(item.month.slice(5, 7));
      const quarter = Number(state.period.slice(1));
      return Math.ceil(month / 3) === quarter;
    });
    return table([
      ["月份", ""], ["BP目标", "num"], ["实际", "num"], ["差额", "num"], ["达成率", ""]
    ], visible.map((item) => [
      `${Number(item.month.slice(5, 7))}月`, format(target(item.row)), format(actual(item.row)),
      h("span", { class: gap(item.row) >= 0 ? "bw-positive" : "bw-negative" }, format(gap(item.row))), rateBar(item.rate)
    ]), "bp-month-table");
  }

  function marketResults() {
    return M.activeCountries().filter((country) => state.scope === "ALL" || country.code === state.scope).map((country) => ({
      country,
      result: result(country.code)
    }));
  }

  function marketAlertTable() {
    const rows = marketResults().sort((a, b) => (achievement(a.result) == null ? -1 : achievement(a.result)) - (achievement(b.result) == null ? -1 : achievement(b.result)));
    return table([["市场", ""], ["差额", "num"], ["达成", ""]], rows.map((item) => [
      h("button.bp-text-link", { type: "button", onclick: () => { state.scope = item.country.code; state.tab = "market"; paint(); } }, item.country.code),
      h("span", { class: gap(item.result) >= 0 ? "bw-positive" : "bw-negative" }, format(gap(item.result))),
      pill(pct(achievement(item.result)), kind(achievement(item.result)))
    ]));
  }

  function marketView() {
    const data = result();
    return h("div.bp-view", [
      marketKpis(data),
      marketToolbar(),
      state.marketView === "trend" ? trendView() : state.marketView === "structure" ? structureView() : matrixView()
    ]);
  }

  function marketTable() {
    return table([["市场", ""], ["BP目标", "num"], ["实际", "num"], ["差额", "num"], ["达成", ""]], marketResults().map((item) => {
      const rate = achievement(item.result);
      return [
        h("button.bp-text-link", { type: "button", onclick: () => { state.scope = item.country.code; paint(); } }, [h("b", item.country.code), h("small", item.country.name_en)]),
        format(target(item.result)), format(actual(item.result)),
        h("span", { class: gap(item.result) >= 0 ? "bw-positive" : "bw-negative" }, format(gap(item.result))), rateBar(rate)
      ];
    }));
  }

  function categoryTable() {
    const rows = result().details.categories;
    return table([["品类", ""], ["BP目标", "num"], ["实际", "num"], ["差额", "num"], ["达成", ""]], rows.map((row) => {
      const goal = detailTarget(row); const done = detailActual(row); const rate = detailAchievement(row);
      return [row.category, format(goal), format(done), h("span", { class: done - goal >= 0 ? "bw-positive" : "bw-negative" }, format(done - goal)), rateBar(rate)];
    }));
  }

  function canonicalCategory(value) {
    const normalized = String(value || "Other").trim().toLowerCase();
    if (normalized.includes("power bank")) return "Power bank";
    if (normalized.includes("wireless")) return "Wireless charger";
    if (normalized.includes("charger")) return "Charger";
    if (normalized.includes("cable")) return "Cable";
    return "Other";
  }

  function categoryName(value) { return categoryNames[canonicalCategory(value)] || value || "其他"; }

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function projectionFor(selectedScope) {
    const selectedMonths = months();
    const current = currentMonthKey();
    let closed = selectedMonths.filter((month) => month <= current);
    let future = selectedMonths.filter((month) => month > current).slice(0, 3);
    if (!closed.length && !future.length) closed = selectedMonths.slice();
    const paceResult = closed.length ? result(selectedScope, closed) : null;
    const windowMonths = Array.from(new Set(closed.concat(future)));
    const windowTarget = windowMonths.length ? target(result(selectedScope, windowMonths)) : 0;
    let projected = paceResult ? actual(paceResult) : 0;
    let forecastTotal = 0;
    future.forEach((month) => {
      const monthResult = result(selectedScope, [month]);
      const forecastQty = M.confirmedResults([month], selectedScope).forecast.result.forecast || 0;
      const unitValue = monthResult.quantity > 0
        ? monthResult.value / monthResult.quantity
        : monthResult.actualQuantity > 0 ? monthResult.actualValue / monthResult.actualQuantity : 0;
      const forecastValue = state.metric === "value" ? forecastQty * unitValue : forecastQty;
      const bookedValue = actual(monthResult);
      forecastTotal += forecastValue;
      projected += Math.max(bookedValue, forecastValue);
    });
    return {
      closed,
      future,
      pace: paceResult ? achievement(paceResult) : null,
      forecastTotal,
      projected,
      projectedRate: windowTarget > 0 ? projected / windowTarget * 100 : null,
      projectedGap: projected - windowTarget
    };
  }

  function unconfiguredRows(data) {
    return data.details.skus.filter((row) => detailTarget(row) <= 0 && detailActual(row) > 0);
  }

  function marketKpis(data) {
    const projection = projectionFor(state.scope);
    const missing = unconfiguredRows(data);
    return h("div.bw-kpis.bp-kpis.bp-market-kpis", [
      h("div.bw-kpi", [h("span", "BP目标"), h("strong", format(target(data))), h("small", `${periodLabel()} · ${metricLabel()}`)]),
      h("div.bw-kpi", [h("span", "有效PO实际"), h("strong", format(actual(data))), h("small", "已取消PO不计入")]),
      h("div.bw-kpi", [h("span", "目标差额"), h("strong", { class: gap(data) >= 0 ? "bw-positive" : "bw-negative" }, format(gap(data))), h("small", gap(data) >= 0 ? "超过目标" : "尚需补足")]),
      h("div.bw-kpi", [h("span", "累计节奏达成"), h("strong", { class: kind(projection.pace) === "green" ? "bw-positive" : kind(projection.pace) === "amber" ? "bw-warning" : "bw-negative" }, pct(projection.pace)), h("small", "截至当前月份")]),
      h("div.bw-kpi", [h("span", "滚动窗口预计达成"), h("strong", { class: kind(projection.projectedRate) === "green" ? "bw-positive" : kind(projection.projectedRate) === "amber" ? "bw-warning" : "bw-negative" }, pct(projection.projectedRate)), h("small", "实际 + 已确认预测")]),
      h("div.bw-kpi", [h("span", "未配置BP"), h("strong", missing.length), h("small", "有实际但无目标的SKU")])
    ]);
  }

  function categoryRowsFor(selectedScope, selectedMonths) {
    const rows = result(selectedScope, selectedMonths || months()).details.categories;
    const map = {};
    rows.forEach((row) => {
      const key = canonicalCategory(row.category);
      const item = map[key] = map[key] || { category: key, bp: 0, bpQuantity: 0, revenue: 0, units: 0 };
      item.bp += row.bp || 0;
      item.bpQuantity += row.bpQuantity || 0;
      item.revenue += row.revenue || 0;
      item.units += row.units || 0;
    });
    return categoryOrder.map((category) => map[category] || { category, bp: 0, bpQuantity: 0, revenue: 0, units: 0 });
  }

  function categoryMeasure(row) {
    const goal = state.metric === "value" ? row.bp : row.bpQuantity;
    const done = state.metric === "value" ? row.revenue : row.units;
    return { goal, done, gap: done - goal, rate: goal > 0 ? done / goal * 100 : null };
  }

  function riskItems() {
    const items = marketResults().filter((item) => achievement(item.result) == null || achievement(item.result) < 90).map((item) => ({
      type: "市场节奏",
      label: `${item.country.code} · ${item.country.name_en}`,
      value: gap(item.result),
      status: status(achievement(item.result))
    }));
    const missing = unconfiguredRows(result());
    if (missing.length) items.push({ type: "目标配置", label: `${missing.length}个SKU未配置BP`, value: null, status: "需补充目标" });
    return items.sort((a, b) => (a.value == null ? 1 : 0) - (b.value == null ? 1 : 0) || (a.value || 0) - (b.value || 0));
  }

  function structureRows() {
    const rows = categoryRowsFor(state.scope);
    const totalGoal = rows.reduce((sum, row) => sum + categoryMeasure(row).goal, 0) || 1;
    const totalDone = rows.reduce((sum, row) => sum + categoryMeasure(row).done, 0) || 1;
    return rows.map((row) => {
      const measure = categoryMeasure(row);
      const bpShare = measure.goal / totalGoal * 100;
      const actualShare = measure.done / totalDone * 100;
      return { ...row, ...measure, bpShare, actualShare, variance: actualShare - bpShare };
    });
  }

  function marketToolbar() {
    const riskCount = riskItems().length;
    const structureCount = structureRows().filter((row) => Math.abs(row.variance) >= 2).length;
    return h("div.bp-market-toolbar", [
      h("div.bp-market-subviews", marketViews.map((view) => h("button", {
        type: "button",
        class: state.marketView === view.value ? "active" : "",
        dataset: { bpMarketView: view.value },
        onclick: () => { state.marketView = view.value; paint(); }
      }, view.label))),
      h("span.bp-market-toolbar-grow"),
      h("button.btn.sm.bp-monitor-button", { type: "button", onclick: openRiskModal }, ["风险摘要", h("span.red", riskCount)]),
      h("button.btn.sm.bp-monitor-button", { type: "button", onclick: openStructureModal }, ["结构异常", h("span.amber", structureCount)])
    ]);
  }

  function matrixCell(selectedScope, category, selectedMonths, label, totalCell) {
    const source = category
      ? categoryRowsFor(selectedScope, selectedMonths).find((row) => row.category === category)
      : result(selectedScope, selectedMonths);
    const measure = category ? categoryMeasure(source) : { goal: target(source), done: actual(source), gap: gap(source), rate: achievement(source) };
    const id = `${selectedScope}|${category || "ALL"}|${selectedMonths.join(",")}`;
    const selected = state.selectedCell && state.selectedCell.id === id;
    const tone = measure.rate == null ? "gray" : kind(measure.rate);
    return {
      id,
      selectedScope,
      category,
      selectedMonths,
      label,
      totalCell,
      ...measure,
      node: h("button.bp-matrix-cell", {
        type: "button",
        class: `${tone}${selected ? " selected" : ""}${totalCell ? " total" : ""}`,
        dataset: { bpMatrixCell: id },
        onclick: () => {
          state.selectedCell = { id, selectedScope, category, selectedMonths: selectedMonths.slice(), label };
          state.selectedSku = null;
          paint();
        }
      }, measure.goal <= 0 && measure.done <= 0 ? h("span.bp-matrix-empty", "--") : measure.goal <= 0 ? [h("strong", "未配置"), h("small", format(measure.done))] : [
        h("strong", pct(measure.rate)),
        h("small", { class: measure.gap >= 0 ? "bw-positive" : "bw-negative" }, `${measure.gap >= 0 ? "+" : ""}${format(measure.gap)}`)
      ])
    };
  }

  function matrixModel() {
    const cells = [];
    if (state.scope === "ALL") {
      const columns = categoryOrder;
      const rows = M.activeCountries().map((country) => ({ label: country.code, scope: country.code }));
      rows.push({ label: "合计", scope: "ALL", total: true });
      const body = rows.map((row) => {
        const rowCells = columns.map((category) => {
          const cell = matrixCell(row.scope, category, months(), `${row.label} × ${categoryName(category)}`, row.total);
          cells.push(cell);
          return cell.node;
        });
        const total = matrixCell(row.scope, null, months(), `${row.label} × 全部品类`, true);
        cells.push(total);
        return [h("strong", row.label)].concat(rowCells, total.node);
      });
      return { headers: [["市场 / 品类", ""]].concat(columns.map((category) => [categoryName(category), "num"]), [["合计", "num"]]), body, cells };
    }
    const buckets = state.period === "year"
      ? [1, 2, 3, 4].map((quarter) => ({ label: `Q${quarter}`, months: M.monthsForQuarter(state.year, quarter) }))
      : months().map((month) => ({ label: `${Number(month.slice(5, 7))}月`, months: [month] }));
    const rows = categoryOrder.map((category) => ({ label: categoryName(category), category }));
    rows.push({ label: "合计", category: null, total: true });
    const body = rows.map((row) => {
      const rowCells = buckets.map((bucket) => {
        const cell = matrixCell(state.scope, row.category, bucket.months, `${state.scope} · ${row.label} · ${bucket.label}`, row.total);
        cells.push(cell);
        return cell.node;
      });
      const total = matrixCell(state.scope, row.category, months(), `${state.scope} · ${row.label} · 合计`, true);
      cells.push(total);
      return [h("strong", row.label)].concat(rowCells, total.node);
    });
    return { headers: [["品类 / 周期", ""]].concat(buckets.map((bucket) => [bucket.label, "num"]), [["合计", "num"]]), body, cells };
  }

  function matrixView() {
    const model = matrixModel();
    if (!state.selectedCell || !model.cells.some((cell) => cell.id === state.selectedCell.id)) {
      const candidates = model.cells.filter((cell) => !cell.totalCell && cell.goal > 0);
      const selected = candidates.sort((a, b) => a.gap - b.gap)[0] || model.cells[0];
      if (selected) {
        state.selectedCell = { id: selected.id, selectedScope: selected.selectedScope, category: selected.category, selectedMonths: selected.selectedMonths.slice(), label: selected.label };
        state.selectedSku = null;
      }
      return matrixView();
    }
    return h("div.bp-market-content.bp-matrix-view", [
      panel("市场 × 品类达成矩阵", "点击单元格查看产品、有效PO与预测入口", table(model.headers, model.body, "bp-matrix-table")),
      selectedCellDetail()
    ]);
  }

  function selectedCellDetail() {
    const selected = state.selectedCell;
    const selectedResult = result(selected.selectedScope, selected.selectedMonths);
    const category = selected.category;
    const categoryRow = category ? categoryRowsFor(selected.selectedScope, selected.selectedMonths).find((row) => row.category === category) : null;
    const measure = category ? categoryMeasure(categoryRow) : { goal: target(selectedResult), done: actual(selectedResult), gap: gap(selectedResult), rate: achievement(selectedResult) };
    const rows = selectedResult.details.skus.filter((row) => !category || canonicalCategory(row.category) === category).map((row) => ({
      ...row,
      goal: detailTarget(row),
      done: detailActual(row),
      gap: detailActual(row) - detailTarget(row),
      rate: detailAchievement(row)
    })).filter((row) => row.goal || row.done).sort((a, b) => a.gap - b.gap).slice(0, 5);
    if (!rows.some((row) => row.model === state.selectedSku)) state.selectedSku = rows[0] ? rows[0].model : null;
    const selectedProduct = rows.find((row) => row.model === state.selectedSku) || rows[0] || null;
    const navigationContext = () => ({
      market: selected.selectedScope === "ALL" ? "ALL" : selected.selectedScope,
      category: category || (selectedProduct ? canonicalCategory(selectedProduct.category) : ""),
      sku: selectedProduct ? selectedProduct.model : "",
      product: selectedProduct ? selectedProduct.product : "",
      months: selected.selectedMonths.slice()
    });
    return panel(`当前选中：${selected.label}`, "最大缺口SKU优先", h("div.bp-cell-detail", [
      h("div.bp-cell-summary", [
        h("span", [h("small", "BP目标"), h("strong", format(measure.goal))]),
        h("span", [h("small", "有效PO"), h("strong", format(measure.done))]),
        h("span", [h("small", "差额"), h("strong", { class: measure.gap >= 0 ? "bw-positive" : "bw-negative" }, format(measure.gap))]),
        h("span", [h("small", "达成率"), h("strong", pct(measure.rate))])
      ]),
      table([["产品 / SKU", ""], ["BP目标", "num"], ["有效PO", "num"], ["差额", "num"], ["达成", "num"]], rows.map((row) => [
        h("button.bp-product-choice", { type: "button", class: state.selectedSku === row.model ? "active" : "" }, [h("b", row.model), h("small", row.product)]), format(row.goal), format(row.done), h("span", { class: row.gap >= 0 ? "bw-positive" : "bw-negative" }, format(row.gap)), pct(row.rate)
      ]), "bp-cell-sku-table", rows.map((row) => () => { state.selectedSku = row.model; paint(); })),
      h("div.bp-cell-actions", [
        h("button.btn.sm", { disabled: !selectedProduct, onclick: () => selectedProduct && openProduct(selectedProduct) }, "查看产品明细"),
        h("button.btn.sm", { disabled: !selectedProduct, onclick: () => selectedProduct && S.navigate("shipmentSummary", { ...navigationContext(), detail: "po" }) }, "查看有效PO"),
        h("button.btn.primary.sm", { disabled: !selectedProduct, onclick: () => selectedProduct && S.navigate("forecast", { ...navigationContext(), view: "entry" }) }, "进入预测管理")
      ])
    ]), "bp-cell-detail-panel");
  }

  function forecastMetricForMonth(selectedScope, month) {
    const monthResult = result(selectedScope, [month]);
    const forecastQty = M.confirmedResults([month], selectedScope).forecast.result.forecast || 0;
    if (state.metric === "quantity") return forecastQty;
    const unitValue = monthResult.quantity > 0
      ? monthResult.value / monthResult.quantity
      : monthResult.actualQuantity > 0 ? monthResult.actualValue / monthResult.actualQuantity : 0;
    return forecastQty * unitValue;
  }

  function trendRowsFor(selectedScope) {
    let cumulativeGoal = 0;
    let cumulativeDone = 0;
    return months().map((month) => {
      const row = result(selectedScope, [month]);
      const goal = target(row);
      const done = actual(row);
      const forecast = forecastMetricForMonth(selectedScope, month);
      cumulativeGoal += goal;
      cumulativeDone += done;
      return { month, goal, done, forecast, cumulativeRate: cumulativeGoal > 0 ? cumulativeDone / cumulativeGoal * 100 : null };
    });
  }

  function svgNode(name, attrs, children) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    (Array.isArray(children) ? children : children == null ? [] : [children]).forEach((child) => {
      if (child instanceof Node) node.appendChild(child);
      else node.appendChild(document.createTextNode(String(child)));
    });
    return node;
  }

  function trendSvg(rows) {
    const width = 1200;
    const height = 292;
    const left = 66;
    const right = 1138;
    const top = 38;
    const bottom = 246;
    const plotHeight = bottom - top;
    const step = (right - left) / Math.max(1, rows.length);
    const amountMax = Math.max(1, ...rows.flatMap((row) => [row.goal, row.done, row.forecast])) * 1.12;
    const amountY = (value) => bottom - Math.max(0, value) / amountMax * plotHeight;
    const rateY = (value) => bottom - Math.max(0, Math.min(100, value || 0)) / 100 * plotHeight;
    const svg = svgNode("svg", { class: "bp-trend-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "月度BP目标、有效PO、滚动预测与累计达成率组合图" });
    [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
      const y = bottom - ratio * plotHeight;
      svg.append(
        svgNode("line", { x1: left, x2: right, y1: y, y2: y, class: "bp-chart-grid" }),
        svgNode("text", { x: left - 10, y: y + 4, class: "bp-chart-axis left", "text-anchor": "end" }, format(amountMax * ratio)),
        svgNode("text", { x: right + 12, y: y + 4, class: "bp-chart-axis right" }, `${Math.round(ratio * 100)}%`)
      );
    });
    const current = currentMonthKey();
    const forecastPoints = [];
    const ratePoints = [];
    rows.forEach((row, index) => {
      const center = left + step * index + step / 2;
      const barWidth = Math.min(20, step * 0.24);
      if (row.month === current) svg.append(svgNode("rect", { x: left + step * index + 1, y: top, width: Math.max(1, step - 2), height: plotHeight, class: "bp-chart-current" }));
      const targetY = amountY(row.goal);
      const actualY = amountY(row.done);
      const targetBar = svgNode("rect", { x: center - barWidth - 2, y: targetY, width: barWidth, height: Math.max(1, bottom - targetY), rx: 2, class: "bp-chart-target" });
      targetBar.append(svgNode("title", {}, `BP目标 ${format(row.goal)}`));
      const actualBar = svgNode("rect", { x: center + 2, y: actualY, width: barWidth, height: Math.max(1, bottom - actualY), rx: 2, class: "bp-chart-actual" });
      actualBar.append(svgNode("title", {}, `有效PO ${format(row.done)}`));
      forecastPoints.push(`${center},${amountY(row.forecast)}`);
      ratePoints.push(`${center},${rateY(row.cumulativeRate)}`);
      const group = svgNode("g", { class: "bp-chart-month-group", "data-month": row.month }, [
        targetBar,
        actualBar,
        svgNode("text", { x: center, y: bottom + 22, class: "bp-chart-month", "text-anchor": "middle" }, `${Number(row.month.slice(5, 7))}月`)
      ]);
      svg.append(group);
    });
    svg.append(
      svgNode("polyline", { points: forecastPoints.join(" "), class: "bp-chart-forecast" }),
      svgNode("polyline", { points: ratePoints.join(" "), class: "bp-chart-rate" })
    );
    rows.forEach((row, index) => {
      const center = left + step * index + step / 2;
      const y = rateY(row.cumulativeRate);
      const circle = svgNode("circle", { cx: center, cy: y, r: 4, class: "bp-chart-rate-point" });
      circle.append(svgNode("title", {}, `累计达成率 ${pct(row.cumulativeRate)}`));
      svg.append(circle, svgNode("text", { x: center, y: Math.max(top + 10, y - 9), class: "bp-chart-rate-label", "text-anchor": "middle" }, pct(row.cumulativeRate)));
    });
    return h("div.bp-trend-svg-wrap", svg);
  }

  function trendChart() {
    const rows = trendRowsFor(state.scope);
    return panel("月度目标、有效PO与滚动预测", "预测不计入已实现达成", h("div.bp-trend-chart", [
      h("div.bp-trend-legend", [h("span.blue", "BP目标"), h("span.green", "有效PO"), h("span.orange", "已确认滚动预测"), h("span.line", "累计达成率")]),
      trendSvg(rows)
    ]), "bp-trend-panel");
  }

  function marketProgressTable() {
    const rows = M.activeCountries().filter((country) => state.scope === "ALL" || country.code === state.scope).map((country) => {
      const data = result(country.code);
      const projection = projectionFor(country.code);
      return [country.code, format(target(data)), format(actual(data)), rateBar(projection.pace), format(projection.forecastTotal), pill(pct(projection.projectedRate), kind(projection.projectedRate)), h("span", { class: projection.projectedGap >= 0 ? "bw-positive" : "bw-negative" }, format(projection.projectedGap))];
    });
    return table([["市场", ""], ["累计BP", "num"], ["有效PO", "num"], ["节奏达成", ""], ["三个月预测", "num"], ["窗口预计", ""], ["预计差额", "num"]], rows, "bp-progress-table");
  }

  function futurePlanTable() {
    const future = months().filter((month) => month > currentMonthKey()).slice(0, 3);
    const rows = future.map((month) => {
      const data = result(state.scope, [month]);
      const goal = target(data);
      const forecast = forecastMetricForMonth(state.scope, month);
      const gapValue = forecast - goal;
      return [`${Number(month.slice(5, 7))}月`, format(goal), format(forecast), h("span", { class: gapValue >= 0 ? "bw-positive" : "bw-negative" }, format(gapValue)), pill(gapValue >= 0 ? "可补足" : "仍有缺口", gapValue >= 0 ? "green" : "red")];
    });
    if (!rows.length) return h("div.bp-empty-state", [h("strong", "当前周期没有未来月份"), h("span", "请选择包含未来月份的周期查看补缺计划。")]);
    return table([["月份", ""], ["BP目标", "num"], ["确认预测", "num"], ["缺口", "num"], ["状态", ""]], rows, "bp-future-table");
  }

  function forecastAlerts() {
    const items = M.confirmedResults(months(), state.scope).forecast.result.exceptions.slice(0, 3);
    return h("div.bp-forecast-alerts", items.length ? items.map((item) => h("div", [
      h("b", `${item.country} · ${item.sku.code || item.sku.name || "SKU"}`),
      h("small", `${Number(item.month.slice(5, 7))}月 · 预测${quantity(item.forecast)} / PO${quantity(item.po)}`),
      h("strong", { class: item.variance >= 0 ? "bw-positive" : "bw-negative" }, `${item.variance >= 0 ? "+" : ""}${item.variance.toFixed(1)}%`)
    ])) : h("div.bp-no-alert", "当前范围暂无显著预测变化"));
  }

  function trendView() {
    return h("div.bp-market-content.bp-trend-view", [
      trendChart(),
      h("div.bp-trend-detail-grid", [
        panel("市场进度趋势", "按累计节奏监控", marketProgressTable()),
        panel("未来三个月补缺计划", "确认预测与同期BP", futurePlanTable())
      ]),
      panel("预测变化提醒", "来自最新已发布预测版本", forecastAlerts())
    ]);
  }

  function structureComparison() {
    const rows = structureRows();
    const max = Math.max(1, ...rows.flatMap((row) => [row.bpShare, row.actualShare]));
    return panel("BP结构与实际结构", "结构偏差 = 实际贡献占比 - BP贡献占比", h("div.bp-structure-list", rows.map((row) => h("button.bp-structure-row", {
      type: "button",
      onclick: () => { state.selectedCell = null; state.marketView = "matrix"; paint(); }
    }, [
      h("b", categoryName(row.category)),
      h("div.bp-structure-bars", [
        h("span", [h("small", "BP"), h("i.blue", { style: { width: `${row.bpShare / max * 100}%` } }), h("em", pct(row.bpShare))]),
        h("span", [h("small", "实际"), h("i.green", { style: { width: `${row.actualShare / max * 100}%` } }), h("em", pct(row.actualShare))])
      ]),
      h("strong", { class: row.variance >= 0 ? "bw-positive" : "bw-negative" }, `${row.variance >= 0 ? "+" : ""}${row.variance.toFixed(1)}pp`),
      h("span.bp-structure-values", `${format(row.goal)} / ${format(row.done)}`)
    ]))));
  }

  function gapRows() {
    if (state.gapDimension === "category") return structureRows().map((row) => ({ label: categoryName(row.category), goal: row.goal, done: row.done, gap: row.gap, rate: row.rate, reason: Math.abs(row.variance) >= 2 ? `结构偏差 ${row.variance >= 0 ? "+" : ""}${row.variance.toFixed(1)}pp` : "目标与结构基本一致", category: row.category }));
    if (state.gapDimension === "sku") return result().details.skus.map((row) => ({ label: row.model, sublabel: row.product, goal: detailTarget(row), done: detailActual(row), gap: detailActual(row) - detailTarget(row), rate: detailAchievement(row), reason: detailTarget(row) <= 0 && detailActual(row) > 0 ? "未配置BP" : detailAchievement(row) < 70 ? "有效PO明显低于目标" : "节奏偏差", row }));
    return marketResults().map((item) => ({ label: item.country.code, sublabel: item.country.name_en, goal: target(item.result), done: actual(item.result), gap: gap(item.result), rate: achievement(item.result), reason: achievement(item.result) == null ? "未配置BP" : achievement(item.result) < 70 ? "市场有效PO明显不足" : "部分品类节奏落后", scope: item.country.code }));
  }

  function gapRanking() {
    const raw = gapRows().filter((row) => row.goal || row.done).sort((a, b) => a.gap - b.gap);
    const totalNegative = raw.reduce((sum, row) => sum + Math.max(0, -row.gap), 0) || 1;
    const rows = raw.slice(0, 10);
    return panel("缺口排行", "点击查看对应市场、品类或产品明细", h("div.bp-gap-ranking", [
      h("div.bp-gap-dimensions", [
        h("button", { class: state.gapDimension === "market" ? "active" : "", onclick: () => { state.gapDimension = "market"; paint(); } }, "市场"),
        h("button", { class: state.gapDimension === "category" ? "active" : "", onclick: () => { state.gapDimension = "category"; paint(); } }, "品类"),
        h("button", { class: state.gapDimension === "sku" ? "active" : "", onclick: () => { state.gapDimension = "sku"; paint(); } }, "产品SKU")
      ]),
      table([["排名", "num"], ["对象", ""], ["BP目标", "num"], ["有效PO", "num"], ["差额", "num"], ["节奏达成", ""], ["缺口贡献", ""], ["主要原因", ""], ["操作", ""]], rows.map((row, index) => [
        index + 1,
        h("div", [h("b", row.label), row.sublabel ? h("small", row.sublabel) : null]),
        format(row.goal), format(row.done), h("span", { class: row.gap >= 0 ? "bw-positive" : "bw-negative" }, format(row.gap)), pill(pct(row.rate), kind(row.rate)),
        h("div.bp-gap-share", [h("i", { style: { width: `${Math.max(0, -row.gap) / totalNegative * 100}%` } }), h("span", pct(Math.max(0, -row.gap) / totalNegative * 100))]),
        row.reason,
        h("button.bp-text-link", { onclick: (event) => { event.stopPropagation(); openGapRow(row); } }, "查看明细")
      ]), "bp-gap-table", rows.map((row) => () => openGapRow(row)))
    ]));
  }

  function openGapRow(row) {
    if (row.row) { openProduct(row.row); return; }
    state.marketView = "matrix";
    if (row.scope) state.scope = row.scope;
    state.selectedCell = null;
    paint();
  }

  function structureActions() {
    const rows = structureRows().filter((row) => Math.abs(row.variance) >= 2).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, 3);
    const missing = unconfiguredRows(result());
    const items = rows.map((row) => ({ title: `${categoryName(row.category)}实际占比${row.variance < 0 ? "低于" : "高于"}BP ${Math.abs(row.variance).toFixed(1)}pp`, owner: "GTM / 市场负责人", detail: "需确认目标结构与重点SKU" }));
    if (missing.length) items.push({ title: `${missing.length}个SKU未配置BP`, owner: "经营计划", detail: "补充目标或确认不纳入BP" });
    return panel("结构异常与待处理项", "异常项通过弹窗统一查看和分派", h("div.bp-structure-actions", items.slice(0, 3).map((item) => h("div", [
      h("span.bp-action-mark", "!"),
      h("p", [h("b", item.title), h("small", `${item.owner} · ${item.detail}`)]),
      h("button.btn.sm", { onclick: openStructureModal }, "进入处理")
    ]))));
  }

  function structureView() {
    return h("div.bp-market-content.bp-structure-view", [
      structureComparison(),
      gapRanking(),
      structureActions()
    ]);
  }

  function openRiskModal() {
    const overlay = S.overlay("modal", { title: "BP风险摘要" });
    overlay.panel.classList.add("bp-monitor-modal");
    const rows = riskItems();
    overlay.body.append(table([["类型", ""], ["风险对象", ""], ["差额", "num"], ["状态", ""]], rows.map((row) => [row.type, row.label, row.value == null ? "--" : h("span", { class: row.value >= 0 ? "bw-positive" : "bw-negative" }, format(row.value)), pill(row.status, row.value == null ? "amber" : "red")])));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"), h("button.btn.primary", { onclick: () => { overlay.close(); state.marketView = "matrix"; paint(); } }, "返回达成矩阵"));
  }

  function openStructureModal() {
    const overlay = S.overlay("modal", { title: "结构异常" });
    overlay.panel.classList.add("bp-monitor-modal");
    const rows = structureRows().filter((row) => Math.abs(row.variance) >= 2).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    overlay.body.append(h("p.bp-modal-note", "仅显示实际贡献占比与BP贡献占比偏差达到2个百分点的品类。"), table([["品类", ""], ["BP占比", "num"], ["实际占比", "num"], ["结构偏差", "num"], ["建议", ""]], rows.map((row) => [categoryName(row.category), pct(row.bpShare), pct(row.actualShare), h("span", { class: row.variance >= 0 ? "bw-positive" : "bw-negative" }, `${row.variance >= 0 ? "+" : ""}${row.variance.toFixed(1)}pp`), row.variance < 0 ? "检查缺口SKU与渠道" : "确认超额贡献是否可持续"])));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"), h("button.btn.primary", { onclick: () => { overlay.close(); state.marketView = "structure"; paint(); } }, "进入结构与缺口"));
  }

  function productView() {
    const allRows = result().details.skus;
    const query = state.search.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      if (state.hideEmpty && !row.bp && !row.bpQuantity && !row.revenue && !row.units) return false;
      return !query || `${row.model} ${row.product} ${row.category}`.toLowerCase().includes(query);
    });
    return h("div.bp-view", [
      h("div.bp-product-toolbar", [
        h("label.bp-search", [h("span", "搜索产品"), h("input", { type: "search", value: state.search, placeholder: "型号或产品名称", oninput: (event) => { state.search = event.target.value; paintProductTable(); } })]),
        h("label.bp-check", [h("input", { type: "checkbox", checked: state.hideEmpty, onchange: (event) => { state.hideEmpty = event.target.checked; paint(); } }), "仅看有BP或实际的产品"]),
        h("span.bp-row-count", `${rows.length}个产品 · 点击查看月度明细`)
      ]),
      panel("产品BP达成明细", `${periodLabel()} · ${state.scope === "ALL" ? "全部可见市场" : state.scope}`, productTable(rows), "bp-product-panel")
    ]);
  }

  function paintProductTable() {
    const panelNode = root.querySelector(".bp-product-panel");
    if (!panelNode) { paint(); return; }
    const allRows = result().details.skus;
    const query = state.search.trim().toLowerCase();
    const rows = allRows.filter((row) => (!state.hideEmpty || row.bp || row.bpQuantity || row.revenue || row.units) && (!query || `${row.model} ${row.product} ${row.category}`.toLowerCase().includes(query)));
    panelNode.querySelector(".bw-panel-head span").textContent = `${periodLabel()} · ${state.scope === "ALL" ? "全部可见市场" : state.scope}`;
    panelNode.querySelector(".bw-table-wrap").replaceWith(productTable(rows));
    root.querySelector(".bp-row-count").textContent = `${rows.length}个产品 · 点击查看月度明细`;
    root.querySelector(".bp-search input")?.focus();
  }

  function productTable(rows) {
    return table([
      ["产品 / SKU", ""], ["品类", ""], ["BP数量", "num"], ["实际数量", "num"], ["数量达成", ""], ["BP金额", "num"], ["实际金额", "num"], ["金额达成", ""]
    ], rows.map((row) => [
      h("div", [h("b", row.model), h("small", row.product)]), row.category,
      quantity(row.bpQuantity), quantity(row.units), pill(pct(row.bpQuantityAchievement), kind(row.bpQuantityAchievement)),
      money(row.bp), money(row.revenue), rateBar(row.bpAchievement)
    ]), "bp-product-table", rows.map((row) => () => openProduct(row)));
  }

  function versionView() {
    const current = contract();
    const priorPeriod = state.period === "year" ? M.monthsForYear(state.year - 1) : M.monthsForQuarter(state.period === "Q1" ? state.year - 1 : state.year, state.period === "Q1" ? 4 : Number(state.period.slice(1)) - 1);
    const previous = M.confirmedResults(priorPeriod, state.scope).bp;
    const records = [
      { version: current.version, period: periodLabel(), status: "已确认", owner: "Julio · 经营计划", time: current.confirmedAt, note: "当前业务复盘引用版本" },
      { version: previous.version, period: "上一对比周期", status: "已归档", owner: "Julio · 经营计划", time: "2026-04-07 18:00", note: "只读历史快照" },
      { version: `BP-${state.year}-draft-v4`, period: `${state.year}滚动调整`, status: "草稿", owner: "Finance Planning", time: "2026-08-08 15:20", note: "尚未影响已确认结果" }
    ];
    return h("div.bp-view", [
      h("div.bp-version-summary", [
        h("div", [h("span", "当前确认版本"), h("strong", current.version), h("small", `${current.statusLabel} · ${current.confirmedAt}`)]),
        h("div", [h("span", "数据范围"), h("strong", periodLabel()), h("small", state.scope === "ALL" ? "全部可见市场" : state.scope)]),
        h("div", [h("span", "复盘引用"), h("strong", "不可覆盖"), h("small", "新确认生成新版本")]),
        h("div", [h("span", "目标明细"), h("strong", `${current.result.details.skus.length}个产品`), h("small", "来源：BP与Master Data")])
      ]),
      panel("BP版本记录", "确认后提供给经营分析与业务复盘", table([
        ["版本", ""], ["适用周期", ""], ["状态", ""], ["确认人", ""], ["更新时间", ""], ["说明", ""]
      ], records.map((row) => [row.version, row.period, pill(row.status, row.status === "草稿" ? "amber" : row.status === "已确认" ? "green" : "gray"), row.owner, String(row.time).slice(0, 16), row.note]))),
      h("div.bp-version-note", [
        h("strong", "版本规则"),
        h("p", "BP目标变更先形成草稿；确认后生成新版本，并更新经营分析和后续业务复盘可选来源。已经冻结的历史复盘继续保留原BP快照。")
      ])
    ]);
  }

  function table(headers, rows, className, rowActions) {
    return h(`div.bw-table-wrap${className ? `.${className}` : ""}`, h("table.bw-table", [
      h("thead", h("tr", headers.map((header) => h(`th${header[1] ? `.${header[1]}` : ""}`, header[0])))),
      h("tbody", rows.length ? rows.map((cells, index) => h("tr", rowActions && rowActions[index] ? {
        dataset: { open: "true" },
        tabindex: "0",
        onclick: rowActions[index],
        onkeydown: (event) => { if (event.key === "Enter" || event.key === " ") rowActions[index](); }
      } : {}, cells.map((cell, cellIndex) => h(`td${headers[cellIndex] && headers[cellIndex][1] ? `.${headers[cellIndex][1]}` : ""}`, cell)))) : h("tr", h("td", { colspan: headers.length }, h("div.bw-empty", "当前范围暂无数据"))))
    ]));
  }

  function openProduct(row) {
    const overlay = S.overlay("drawer", { title: `${row.model} · BP月度明细` });
    overlay.panel.classList.add("bp-product-drawer");
    const monthly = M.monthsForYear(state.year).map((month) => {
      const detail = M.confirmedResults([month], state.scope).bp.result.details.skus.find((item) => item.model === row.model) || { bp: 0, bpQuantity: 0, revenue: 0, units: 0, bpAchievement: null, bpQuantityAchievement: null };
      return [
        `${Number(month.slice(5, 7))}月`, quantity(detail.bpQuantity), quantity(detail.units), pct(detail.bpQuantityAchievement), money(detail.bp), money(detail.revenue), pct(detail.bpAchievement)
      ];
    });
    overlay.body.append(h("div.bp-drawer-context", [
      h("div", [h("span", "产品"), h("b", row.product)]),
      h("div", [h("span", "品类"), h("b", row.category)]),
      h("div", [h("span", "市场"), h("b", state.scope === "ALL" ? "全部可见市场" : state.scope)])
    ]), table([["月份", ""], ["BP数量", "num"], ["实际数量", "num"], ["数量达成", "num"], ["BP金额", "num"], ["实际金额", "num"], ["金额达成", "num"]], monthly));
    overlay.foot.append(h("button.btn", { onclick: overlay.close }, "关闭"), h("button.btn.primary", { onclick: () => { overlay.close(); state.search = row.model; state.tab = "product"; paint(); } }, "定位产品"));
  }

  function showMethod() {
    const overlay = S.overlay("modal", { title: "BP达成口径" });
    overlay.panel.classList.add("bw-source-modal");
    overlay.body.append(h("div.bp-method-list", [
      h("p", [h("strong", "BP目标："), "取已确认BP版本中的SI金额和SI数量。"]),
      h("p", [h("strong", "实际达成："), "取有效客户PO的金额和数量；取消PO不计入达成。"]),
      h("p", [h("strong", "达成率："), "实际 ÷ BP目标；金额统一按冻结FX折算EUR。"]),
      h("p", [h("strong", "版本保护："), "新BP确认后生成新版本，不覆盖历史业务复盘已经引用的快照。"])
    ]));
    overlay.foot.append(h("button.btn.primary", { onclick: overlay.close }, "知道了"));
  }

  function exportDetails() {
    const rows = result().details.skus;
    const csv = [["Model", "Product", "Category", "BP Qty", "Actual Qty", "Qty Achievement", "BP EUR", "Actual EUR", "Value Achievement"], ...rows.map((row) => [
      row.model, row.product, row.category, row.bpQuantity, row.units, row.bpQuantityAchievement || "", row.bp, row.revenue, row.bpAchievement || ""
    ])].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `bp-achievement-${state.year}-${state.period}-${state.scope}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function paint() {
    S.clear(root);
    const workspace = h("div.business-workspace.bp-achievement-workspace", [
      controlShell()
    ]);
    workspace.append(state.tab === "market" ? marketView() : state.tab === "product" ? productView() : state.tab === "version" ? versionView() : overview());
    root.append(workspace);
  }

  function render(target) {
    root = target;
    if (!state) init();
    paint();
  }

  window.Modules = window.Modules || {};
  window.Modules.bp = { render };
})();

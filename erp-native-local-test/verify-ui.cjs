const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = __dirname;
const entry = pathToFileURL(path.join(root, "index.html")).href;
const moduleCases = [
  { module: "forecast", selector: '[data-module="forecast"]', hash: "#module=forecast" },
  { module: "shipmentSummary", selector: '[data-module="shipmentSummary"]', hash: "#module=logistic&view=summary" },
  { module: "shipment", selector: '[data-logistics-view="shipment"]', hash: "#module=logistic&view=operation" },
  { module: "logistic", selector: '[data-logistics-view="logistic"]', hash: "#module=logistic&view=products" },
  { module: "functions", selector: '[data-module="functions"]', hash: "#module=functions" },
  { module: "bp", selector: '[data-module="bp"]', hash: "#module=bp" },
  { module: "performance", selector: '[data-module="performance"]', hash: "#module=performance" }
];

(async () => {
  const installedChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.PLAYWRIGHT_CHROME_PATH
    || (fs.existsSync(installedChrome) ? installedChrome : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  desktop.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  desktop.on("pageerror", (error) => errors.push(error.message));

  await desktop.goto(`${entry}#module=forecast`, { waitUntil: "load" });
  await desktop.waitForTimeout(400);
  const checks = [];

  await desktop.getByRole("tab", { name: "预测评分卡" }).click();
  await desktop.locator(".forecast-scorecard").waitFor();
  const scorecardState = await desktop.evaluate(() => ({
    visible: Boolean(document.querySelector(".forecast-scorecard")),
    scoreViews: document.querySelectorAll(".forecast-score-view-tabs button").length,
    activeScoreView: document.querySelector(".forecast-score-view-tabs button.active")?.textContent.trim(),
    topKpis: document.querySelectorAll(".forecast-score-kpis.overview .forecast-score-kpi").length,
    duplicateHorizonKpis: Array.from(document.querySelectorAll(".forecast-score-kpis.overview .forecast-score-kpi > span")).filter(node => /^H[123]/.test(node.textContent.trim())).length,
    quarterBars: document.querySelectorAll(".forecast-score-horizon-item").length,
    quarterSummaryRows: document.querySelectorAll(".forecast-score-quarter-table-card tbody tr").length,
    hasAccuracy: document.body.innerText.includes("预测准确率"),
    hasCompositeAccuracy: document.body.innerText.includes("季度综合准确率"),
    hasWape: document.body.innerText.includes("WAPE"),
    hasFdRanking: document.body.innerText.includes("FD评分排名"),
    pendingQuarterMonths: document.querySelectorAll(".forecast-score-quarter-table-card tbody .badge.gray").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".forecast-score-market-filter select").selectOption("all");
  await desktop.waitForTimeout(160);
  const allMarketScorecardState = await desktop.evaluate(() => ({
    marketColumn: document.querySelector(".forecast-score-quarter-drilldown thead")?.textContent.includes("市场"),
    rows: document.querySelectorAll(".forecast-score-quarter-drilldown tbody tr").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator('[data-score-view="current"]').click();
  await desktop.locator(".forecast-score-table").waitFor();
  const currentDetailState = await desktop.evaluate(() => ({
    active: document.querySelector(".forecast-score-view-tabs button.active")?.textContent.includes("当前滚动明细"),
    rows: document.querySelectorAll(".forecast-score-table tbody tr").length,
    pendingMonths: document.querySelectorAll(".forecast-score-month.pending").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".forecast-score-table tbody tr").first().click();
  await desktop.locator(".forecast-score-drawer").waitFor();
  const scorecardDrawerState = await desktop.evaluate(() => ({
    retailerNotScored: document.querySelector(".forecast-score-retailer-note")?.textContent.includes("不计算Retailer达成率或准确率"),
    poTableVisible: Boolean(document.querySelector(".forecast-score-drawer-table")),
    drawerOverflow: document.querySelector(".forecast-score-drawer")?.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".forecast-score-drawer .x").click();
  await desktop.locator('[data-score-view="quarter"]').click();
  await desktop.locator(".forecast-score-quarter-drilldown").waitFor();
  const quarterDetailState = await desktop.evaluate(() => ({
    active: document.querySelector(".forecast-score-view-tabs button.active")?.textContent.includes("季度复盘明细"),
    hasHorizonChart: document.querySelectorAll(".forecast-score-horizon-item").length === 4,
    summaryRows: document.querySelectorAll(".forecast-score-quarter-table-card tbody tr").length,
    sourceRowsExpected: document.querySelectorAll(".forecast-score-quarter-drilldown tbody tr").length > 0,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".forecast-score-quarter-drilldown tbody tr").first().click();
  await desktop.locator(".forecast-score-drawer").waitFor();
  const quarterDrawerState = await desktop.evaluate(() => ({
    hasSourceVersions: document.querySelectorAll(".forecast-quarter-source-table tbody tr").length === 9,
    hasPoTable: document.querySelectorAll(".forecast-score-drawer-table").length >= 2,
    hasReviewFields: document.querySelectorAll(".forecast-score-review-fields textarea").length === 2,
    drawerOverflow: document.querySelector(".forecast-score-drawer")?.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".forecast-score-drawer .x").click();
  await desktop.getByRole("button", { name: "查看评分规则" }).click();
  await desktop.locator(".forecast-score-rules-modal").waitFor();
  const scoreRulesState = await desktop.evaluate(() => ({
    formula: document.querySelector(".forecast-score-formula")?.textContent.includes("H1 × 50% + H2 × 30% + H3 × 20%"),
    mentionsCancelledPo: document.querySelector(".forecast-score-rules-content")?.textContent.includes("已取消PO")
  }));
  await desktop.getByRole("button", { name: "知道了" }).click();
  await desktop.locator('[data-score-view="overview"]').click();
  await desktop.screenshot({ path: path.join(root, "native-forecast-scorecard.png") });
  checks.push({ module: "forecast-scorecard", scorecardState, allMarketScorecardState, currentDetailState, scorecardDrawerState, quarterDetailState, quarterDrawerState, scoreRulesState });
  await desktop.goto(`${entry}#module=forecast`, { waitUntil: "load" });
  await desktop.waitForTimeout(300);

  for (const moduleCase of moduleCases) {
    const startedAt = Date.now();
    await desktop.locator(moduleCase.selector).click();
    await desktop.waitForFunction((hash) => window.location.hash === hash, moduleCase.hash);
    await desktop.waitForTimeout(120);
    const expectedNav = ["shipmentSummary", "shipment", "logistic"].includes(moduleCase.module) ? "shipmentSummary" : moduleCase.module;
    checks.push({
      module: moduleCase.module,
      switchMs: Date.now() - startedAt,
      tableRows: await desktop.locator("table tbody tr").count(),
      active: await desktop.locator(`[data-module="${expectedNav}"]`).evaluate((node) => node.classList.contains("active"))
    });
    await desktop.screenshot({ path: path.join(root, `native-${moduleCase.module}.png`) });
  }

  await desktop.locator('[data-module="bp"]').click();
  await desktop.locator(".bp-achievement-workspace").waitFor();
  const bpOverviewState = await desktop.evaluate(() => ({
    title: document.querySelector(".bp-achievement-workspace .bw-title strong")?.textContent.trim(),
    tabs: Array.from(document.querySelectorAll(".bp-achievement-workspace .bw-view-tabs > button")).map((node) => node.textContent.trim()),
    activeTab: document.querySelector(".bp-achievement-workspace .bw-view-tabs > button.active")?.textContent.trim(),
    compactControl: Boolean(document.querySelector(".bp-control")),
    legacyPageHead: Boolean(document.querySelector(".bp-achievement-workspace > .bw-page-head")),
    legacyMethodBar: Boolean(document.querySelector(".bp-achievement-workspace > .bw-method-bar")),
    legacyFilterBar: Boolean(document.querySelector(".bp-achievement-workspace > .bp-filter-bar")),
    controlHeight: Math.round(document.querySelector(".bp-control")?.getBoundingClientRect().height || 0),
    kpis: document.querySelectorAll(".bp-achievement-workspace .bp-kpis .bw-kpi").length,
    quarters: document.querySelectorAll(".bp-quarter").length,
    monthlyRows: document.querySelectorAll(".bp-month-table tbody tr").length,
    nativeEntry: document.querySelector('[data-module="bp"]')?.classList.contains("active"),
    oldPlaceholderEntry: document.querySelectorAll('[data-existing-module="bp"]').length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.getByRole("tab", { name: "市场与品类", exact: true }).click();
  await desktop.waitForTimeout(80);
  const bpMarketMatrixState = await desktop.evaluate(() => ({
    activeTab: document.querySelector(".bp-achievement-workspace .bw-view-tabs > button.active")?.textContent.trim(),
    subviews: Array.from(document.querySelectorAll(".bp-market-subviews button")).map((node) => node.textContent.trim()),
    activeSubview: document.querySelector(".bp-market-subviews button.active")?.textContent.trim(),
    kpis: document.querySelectorAll(".bp-market-kpis .bw-kpi").length,
    matrixRows: document.querySelectorAll(".bp-matrix-table tbody tr").length,
    matrixColumns: document.querySelectorAll(".bp-matrix-table thead th").length,
    selectedCells: document.querySelectorAll(".bp-matrix-cell.selected").length,
    selectedDetail: Boolean(document.querySelector(".bp-cell-detail-panel")),
    selectedDetailRows: document.querySelectorAll(".bp-cell-sku-table tbody tr").length,
    selectedDetailActions: document.querySelectorAll(".bp-cell-actions button").length,
    monitorButtons: document.querySelectorAll(".bp-monitor-button").length,
    trendPanels: document.querySelectorAll(".bp-trend-panel").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-bp-achievement-market.png"), fullPage: true });
  await desktop.locator(".bp-monitor-button").nth(0).click();
  await desktop.locator(".bp-monitor-modal").waitFor();
  const bpRiskModalState = await desktop.evaluate(() => ({
    visible: Boolean(document.querySelector(".bp-monitor-modal")),
    rows: document.querySelectorAll(".bp-monitor-modal tbody tr").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".bp-monitor-modal").getByRole("button", { name: "关闭", exact: true }).click();
  await desktop.locator(".bp-monitor-button").nth(1).click();
  await desktop.locator(".bp-monitor-modal").waitFor();
  const bpStructureModalState = await desktop.evaluate(() => ({
    visible: Boolean(document.querySelector(".bp-monitor-modal")),
    rows: document.querySelectorAll(".bp-monitor-modal tbody tr").length,
    hasThresholdRule: document.querySelector(".bp-monitor-modal")?.textContent.includes("2个百分点"),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".bp-monitor-modal").getByRole("button", { name: "关闭", exact: true }).click();
  await desktop.locator('[data-bp-market-view="trend"]').click();
  const bpMarketTrendState = await desktop.evaluate(() => ({
    activeSubview: document.querySelector(".bp-market-subviews button.active")?.textContent.trim(),
    charts: document.querySelectorAll(".bp-trend-panel").length,
    months: document.querySelectorAll(".bp-chart-month-group").length,
    targetBars: document.querySelectorAll(".bp-chart-target").length,
    actualBars: document.querySelectorAll(".bp-chart-actual").length,
    forecastLines: document.querySelectorAll(".bp-chart-forecast").length,
    rateLines: document.querySelectorAll(".bp-chart-rate").length,
    ratePoints: document.querySelectorAll(".bp-chart-rate-point").length,
    axisLabels: document.querySelectorAll(".bp-chart-axis").length,
    progressRows: document.querySelectorAll(".bp-progress-table tbody tr").length,
    futureRows: document.querySelectorAll(".bp-future-table tbody tr").length,
    matrixTables: document.querySelectorAll(".bp-matrix-table").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-bp-achievement-trend.png"), fullPage: true });
  await desktop.locator('[data-bp-market-view="structure"]').click();
  const bpMarketStructureState = await desktop.evaluate(() => ({
    activeSubview: document.querySelector(".bp-market-subviews button.active")?.textContent.trim(),
    structureRows: document.querySelectorAll(".bp-structure-row").length,
    dimensionButtons: document.querySelectorAll(".bp-gap-dimensions button").length,
    gapRows: document.querySelectorAll(".bp-gap-table tbody tr").length,
    actionRows: document.querySelectorAll(".bp-structure-actions > div").length,
    hasGapAttribution: document.querySelector(".bp-structure-view")?.textContent.includes("缺口归因"),
    trendPanels: document.querySelectorAll(".bp-trend-panel").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".bp-gap-dimensions button").nth(1).click();
  const bpCategoryGapRows = await desktop.locator(".bp-gap-table tbody tr").count();
  await desktop.locator(".bp-gap-dimensions button").nth(2).click();
  const bpSkuGapRows = await desktop.locator(".bp-gap-table tbody tr").count();
  await desktop.screenshot({ path: path.join(root, "native-bp-achievement-structure.png"), fullPage: true });
  await desktop.locator(".bp-control-main select").nth(2).selectOption("FR");
  await desktop.locator('[data-bp-market-view="matrix"]').click();
  const bpSingleMarketState = await desktop.evaluate(() => ({
    scope: document.querySelectorAll(".bp-control-main select")[2]?.value,
    matrixRows: document.querySelectorAll(".bp-matrix-table tbody tr").length,
    matrixColumns: document.querySelectorAll(".bp-matrix-table thead th").length,
    selectedCells: document.querySelectorAll(".bp-matrix-cell.selected").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  const bpSelectedSku = await desktop.locator(".bp-product-choice.active b").textContent();
  await desktop.getByRole("button", { name: "查看产品明细", exact: true }).click();
  await desktop.locator(".bp-product-drawer").waitFor();
  const bpSelectedProductDrawerState = await desktop.evaluate(() => ({
    title: document.querySelector(".bp-product-drawer .drawer-head h3")?.textContent.trim(),
    market: Array.from(document.querySelectorAll(".bp-product-drawer .bp-drawer-context b")).at(-1)?.textContent.trim(),
    rows: document.querySelectorAll(".bp-product-drawer tbody tr").length
  }));
  await desktop.locator(".bp-product-drawer .x").click();
  await desktop.getByRole("button", { name: "查看有效PO", exact: true }).click();
  await desktop.locator(".ss-navigation-context").waitFor();
  const bpPoDrilldownState = await desktop.evaluate(() => ({
    context: document.querySelector(".ss-navigation-context")?.textContent.trim(),
    matchStatus: document.querySelector(".ss-context-match-status")?.className,
    matchText: document.querySelector(".ss-context-match-status")?.textContent.trim(),
    market: document.querySelector('.ss-field select[aria-label="市场"]')?.value,
    query: document.querySelector('.ss-search')?.value,
    activeDetail: document.querySelector(".ss-detail-tabs button.active")?.textContent.trim(),
    rows: document.querySelectorAll(".ss-detail .ss-po-row").length,
    expandedRows: document.querySelectorAll(".ss-detail .ss-expanded").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-bp-achievement-po-drilldown.png"), fullPage: true });
  await desktop.locator('[data-module="bp"]').click();
  await desktop.locator(".bp-cell-detail-panel").waitFor();
  await desktop.getByRole("button", { name: "进入预测管理", exact: true }).click();
  await desktop.locator(".forecast-navigation-context").waitFor();
  const bpForecastDrilldownState = await desktop.evaluate(() => ({
    context: document.querySelector(".forecast-navigation-context")?.textContent.trim(),
    activeView: document.querySelector(".forecast-view-tabs button.active")?.textContent.trim(),
    market: document.querySelectorAll(".forecast-workspace-bar .forecast-compact-select")[1]?.value,
    marketLabel: document.querySelectorAll(".forecast-workspace-bar .forecast-compact-select")[1]?.selectedOptions[0]?.textContent.trim(),
    search: document.querySelector(".forecast-entry-toolbar input[type=search]")?.value,
    category: document.querySelector('.forecast-entry-toolbar select[arialabel="品类"]')?.value,
    productRows: document.querySelectorAll(".forecast-product-row").length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-bp-achievement-forecast-drilldown.png"), fullPage: true });
  await desktop.locator('[data-module="bp"]').click();
  await desktop.locator(".bp-achievement-workspace").waitFor();
  await desktop.getByRole("tab", { name: "产品明细", exact: true }).click();
  const bpProductState = await desktop.evaluate(() => ({
    rows: document.querySelectorAll(".bp-product-table tbody tr").length,
    hasQuantityColumns: document.querySelector(".bp-product-table thead")?.textContent.includes("BP数量") && document.querySelector(".bp-product-table thead")?.textContent.includes("数量达成"),
    hasValueColumns: document.querySelector(".bp-product-table thead")?.textContent.includes("BP金额") && document.querySelector(".bp-product-table thead")?.textContent.includes("金额达成"),
    hasBpOnlyRow: Array.from(document.querySelectorAll(".bp-product-table tbody tr")).some((row) => {
      const target = row.cells[2]?.textContent.trim();
      const actual = row.cells[3]?.textContent.trim();
      return target && target !== "0" && actual === "0";
    }),
    productTargetMatches: (() => {
      const contract = window.BusinessMetrics.confirmedResults(window.BusinessMetrics.monthsForYear(2026), "FR").bp.result;
      return Math.abs(contract.details.skus.reduce((sum, row) => sum + row.bp, 0) - contract.value) < 1;
    })(),
    productQuantityMatches: (() => {
      const contract = window.BusinessMetrics.confirmedResults(window.BusinessMetrics.monthsForYear(2026), "FR").bp.result;
      return Math.abs(contract.details.skus.reduce((sum, row) => sum + row.bpQuantity, 0) - contract.quantity) < 1;
    })(),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".bp-product-table tbody tr").first().click();
  await desktop.locator(".bp-product-drawer").waitFor();
  const bpProductDrawerState = await desktop.evaluate(() => ({
    rows: document.querySelectorAll(".bp-product-drawer tbody tr").length,
    hasContext: document.querySelectorAll(".bp-product-drawer .bp-drawer-context > div").length === 3,
    drawerOverflow: document.querySelector(".bp-product-drawer")?.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".bp-product-drawer .x").click();
  await desktop.getByRole("tab", { name: "版本记录", exact: true }).click();
  const bpVersionState = await desktop.evaluate(() => ({
    cards: document.querySelectorAll(".bp-version-summary > div").length,
    rows: document.querySelectorAll(".bp-view .bw-panel tbody tr").length,
    hasVersionRule: document.body.innerText.includes("新BP确认后生成新版本") || document.body.innerText.includes("确认后生成新版本"),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator(".bp-control-main select").nth(2).selectOption("ALL");
  await desktop.getByRole("tab", { name: "综合达成", exact: true }).click();
  await desktop.screenshot({ path: path.join(root, "native-bp-achievement.png"), fullPage: true });
  checks.push({ module: "bp-achievement", bpOverviewState, bpMarketMatrixState, bpRiskModalState, bpStructureModalState, bpMarketTrendState, bpMarketStructureState, bpCategoryGapRows, bpSkuGapRows, bpSingleMarketState, bpSelectedSku, bpSelectedProductDrawerState, bpPoDrilldownState, bpForecastDrilldownState, bpProductState, bpProductDrawerState, bpVersionState });

  await desktop.locator('[data-module="performance"]').click();
  await desktop.locator(".business-analysis-review-workspace").waitFor();
  const businessReviewState = await desktop.evaluate(() => ({
    title: document.querySelector(".business-analysis-review-workspace .bw-title strong")?.textContent.trim(),
    tabs: Array.from(document.querySelectorAll(".bw-view-tabs > button")).map((node) => node.textContent.trim()),
    activeTab: document.querySelector(".bw-view-tabs > button.active")?.textContent.trim(),
    workflowSteps: document.querySelectorAll(".bw-review-step").length,
    compactControl: Boolean(document.querySelector(".bw-review-control")),
    legacyPageHead: Boolean(document.querySelector(".business-analysis-review-workspace > .bw-page-head")),
    legacyMethodBand: Boolean(document.querySelector(".business-analysis-review-workspace > .bw-method-bar")),
    legacyFilterBar: Boolean(document.querySelector(".bw-filter-bar.review")),
    controlHeight: Math.round(document.querySelector(".bw-review-control")?.getBoundingClientRect().height || 0),
    overviewKpis: document.querySelectorAll(".bw-overview-primary .bw-kpis").length,
    overviewPrimaryTitles: Array.from(document.querySelectorAll(".bw-overview-primary > .bw-panel > .bw-panel-head h2")).map((node) => node.textContent.trim()),
    overviewSecondaryButtons: document.querySelectorAll(".bw-overview-secondary > button").length,
    frozen: document.querySelector(".bw-freeze-button")?.textContent.includes("已冻结"),
    singleNavigationEntry: document.querySelectorAll('[data-module="performance"]').length === 1,
    removedBusinessReviewNavigation: !document.querySelector('[data-module="businessReview"]') && !document.querySelector('[data-existing-module="businessReview"]'),
    navigationLabel: document.querySelector('[data-module="performance"] .lbl')?.textContent.trim(),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator('.bw-overview-secondary > button').first().click();
  await desktop.locator('.bw-overview-secondary-modal').waitFor();
  const overviewExceptionModalState = await desktop.evaluate(() => ({
    issues: document.querySelectorAll('.bw-overview-secondary-modal .bw-issue').length,
    hasPrimaryAction: Array.from(document.querySelectorAll('.bw-overview-secondary-modal button')).some((node) => node.textContent.trim() === '进入预测与交付')
  }));
  await desktop.locator('.bw-overview-secondary-modal .x').click();
  await desktop.locator('.bw-overview-secondary > button').nth(1).click();
  await desktop.locator('.bw-overview-secondary-modal').waitFor();
  const overviewActionModalState = await desktop.evaluate(() => ({
    actions: document.querySelectorAll('.bw-overview-secondary-modal .bw-action-row').length,
    hasPrimaryAction: Array.from(document.querySelectorAll('.bw-overview-secondary-modal button')).some((node) => node.textContent.trim() === '进入结论与行动')
  }));
  await desktop.locator('.bw-overview-secondary-modal .x').click();
  for (const tab of ["收入与利润", "预测与交付", "项目与市场", "结论与行动", "历史复盘"]) {
    await desktop.getByRole("tab", { name: tab, exact: true }).click();
    await desktop.waitForTimeout(80);
  }
  const businessReviewViewsState = await desktop.evaluate(() => ({
    activeTab: document.querySelector(".bw-view-tabs > button.active")?.textContent.trim(),
    hasArchive: document.body.innerText.includes("复盘档案"),
    hasSnapshotPromise: document.body.innerText.includes("历史趋势从冻结版本读取"),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator('.bw-review-control-main select').first().selectOption("month");
  await desktop.waitForTimeout(80);
  const businessReviewPeriodState = await desktop.evaluate(() => ({
    type: document.querySelector('.bw-review-control-main select')?.value,
    period: document.querySelectorAll('.bw-review-control-main select')[1]?.value,
    title: document.body.innerText.includes("经营分析复盘")
  }));
  await desktop.locator('.bw-review-control-main select').first().selectOption("quarter");

  await desktop.getByRole("tab", { name: "收入与利润", exact: true }).click();
  await desktop.locator('.bw-review-control-main select').nth(2).selectOption("FR");
  await desktop.waitForTimeout(100);
  const profitExpenseState = await desktop.evaluate(() => ({
    duplicateKpis: document.querySelectorAll('.business-analysis-review-workspace > div > .bw-kpis').length,
    bridgeSteps: document.querySelectorAll('.bw-bridge-step').length,
    bridgeHasInlineRatios: Array.from(document.querySelectorAll('.bw-bridge-step em')).filter((node) => node.textContent.includes('占收入')).length,
    expenseLinks: document.querySelectorAll('.bw-expense-link').length,
    expenseMarketRows: Array.from(document.querySelectorAll('.bw-market-finance-expense .bw-table tbody tr')).map((row) => row.cells[0]?.textContent.trim()),
    combinedTitle: document.querySelector('.bw-market-finance-expense .bw-panel-head h2')?.textContent.trim(),
    standaloneExpensePanels: Array.from(document.querySelectorAll('.bw-panel-head h2')).filter((node) => node.textContent.trim() === '费用分析').length,
    financeHeaders: Array.from(document.querySelectorAll('.bw-market-finance-expense th')).map((node) => node.textContent.trim()),
    expenseHasSeparateRatioHeader: Array.from(document.querySelectorAll('.bw-market-finance-expense th')).some((node) => node.textContent.trim() === '占比'),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));

  await desktop.locator('.bw-expense-link[data-expense-kind="logistics"]').first().click();
  await desktop.locator('.bw-expense-modal').waitFor();
  const logisticsPoState = await desktop.evaluate(() => ({
    title: document.querySelector('.bw-expense-modal .modal-head')?.textContent.includes('物流费用明细'),
    tabs: Array.from(document.querySelectorAll('.bw-expense-tabs button')).map((node) => node.textContent.trim()),
    rows: document.querySelectorAll('.bw-expense-table tbody tr').length,
    sourceVersion: document.querySelector('.bw-expense-context')?.textContent.includes('LOG-'),
    modalOverflow: document.querySelector('.bw-expense-modal')?.scrollWidth > window.innerWidth
  }));
  await desktop.locator('[data-expense-dimension="sku"]').click();
  const logisticsSkuState = await desktop.evaluate(() => ({
    active: document.querySelector('.bw-expense-tabs button.active')?.textContent.trim(),
    rows: document.querySelectorAll('.bw-expense-table tbody tr').length,
    allocationNote: document.querySelector('.bw-contract-note')?.textContent.includes('收入占比分摊')
  }));
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review-logistics-details.png") });
  await desktop.locator('.bw-expense-modal .x').click();

  await desktop.locator('.bw-expense-link[data-expense-kind="credit"]').first().click();
  await desktop.locator('.bw-expense-modal').waitFor();
  const creditNumberState = await desktop.evaluate(() => ({
    title: document.querySelector('.bw-expense-modal .modal-head')?.textContent.includes('Credit Note明细'),
    tabs: Array.from(document.querySelectorAll('.bw-expense-tabs button')).map((node) => node.textContent.trim()),
    rows: document.querySelectorAll('.bw-expense-table tbody tr').length,
    sourceVersion: document.querySelector('.bw-expense-context')?.textContent.includes('SET-')
  }));
  await desktop.locator('[data-expense-dimension="sku"]').click();
  const creditSkuState = await desktop.evaluate(() => ({
    active: document.querySelector('.bw-expense-tabs button.active')?.textContent.trim(),
    rows: document.querySelectorAll('.bw-expense-table tbody tr').length,
    aggregationNote: document.querySelector('.bw-contract-note')?.textContent.includes('基础型号汇总')
  }));
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review-credit-note-details.png") });
  await desktop.locator('.bw-expense-modal .x').click();
  await desktop.locator('.bw-review-control-main select').nth(2).selectOption("ALL");
  await desktop.waitForTimeout(100);
  const allMarketProfitState = await desktop.evaluate(() => ({
    totalRows: document.querySelectorAll('.bw-market-finance-expense .bw-total-row').length,
    totalLabel: document.querySelector('.bw-market-finance-expense .bw-total-row td:first-child')?.textContent.trim(),
    marketRows: document.querySelectorAll('.bw-market-finance-expense .bw-table tbody tr').length,
    categoryRows: document.querySelectorAll('.bw-category-table tbody tr').length,
    categoryMetricTabs: document.querySelectorAll('.bw-category-metric-tabs button').length,
    donutVisible: Boolean(document.querySelector('.bw-donut')),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator('[data-category-metric="gp"]').click();
  await desktop.locator('.bw-category-table tbody tr').first().click();
  const categoryContributionState = await desktop.evaluate(() => ({
    activeMetric: document.querySelector('.bw-category-metric-tabs button.active')?.textContent.trim(),
    activeRows: document.querySelectorAll('.bw-category-table tbody tr.active').length,
    activeLegend: document.querySelectorAll('.bw-category-legend button.active').length,
    centerLabel: document.querySelector('.bw-donut-center span')?.textContent.trim(),
    hasNegativeNote: document.querySelector('.bw-donut-center small')?.textContent.includes('负值按绝对影响绘图') || false
  }));
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review-expense.png"), fullPage: true });

  await desktop.getByRole("tab", { name: "预测与交付", exact: true }).click();
  const forecastDeliveryState = await desktop.evaluate(() => ({
    flowSteps: document.querySelectorAll('.bw-delivery-flow > div').length,
    monthlyRows: document.querySelectorAll('.bw-panel .bw-table tbody tr').length,
    sourceButtons: document.querySelectorAll('.bw-source-stack .bw-source').length,
    hasBp: document.body.innerText.includes('BP计划'),
    hasAccuracy: document.body.innerText.includes('预测准确率'),
    hasEffectivePo: document.body.innerText.includes('有效PO'),
    hasDelivered: document.body.innerText.includes('已发货'),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review-forecast-delivery.png"), fullPage: true });

  await desktop.getByRole("tab", { name: "结论与行动", exact: true }).click();
  const actionCompactState = await desktop.evaluate(() => ({
    legacyKpis: document.querySelectorAll('.business-analysis-review-workspace .bw-kpis').length,
    legacyConclusionCards: document.querySelectorAll('.bw-conclusion-grid').length,
    summaryRows: document.querySelectorAll('.bw-review-summary-row').length,
    actionRows: document.querySelectorAll('.bw-action-compact-grid .bw-table tbody tr').length,
    hasCompactHead: Boolean(document.querySelector('.bw-action-compact-head')),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator('.bw-review-summary-row').first().getByRole('button', { name: '查看', exact: true }).click();
  await desktop.locator('.bw-review-detail-drawer').waitFor();
  await desktop.locator('.bw-review-detail-drawer input[name="title"]').fill('ES收入与利润缺口需要专项修复（已复核）');
  const conclusionDrawerState = await desktop.evaluate(() => ({
    fields: document.querySelectorAll('.bw-review-detail-drawer .bw-review-detail-field').length,
    textareas: document.querySelectorAll('.bw-review-detail-drawer textarea').length,
    autosave: document.querySelector('.bw-detail-autosave')?.textContent.includes('自动保存'),
    drawerOverflow: document.querySelector('.bw-review-detail-drawer')?.scrollWidth > window.innerWidth
  }));
  await desktop.getByRole('button', { name: '保存更新', exact: true }).click();
  const conclusionSavedState = await desktop.evaluate(() => ({
    updated: document.querySelector('.bw-review-summary-row b')?.textContent.includes('已复核'),
    drawerClosed: !document.querySelector('.bw-review-detail-drawer')
  }));
  await desktop.locator('.bw-action-compact-grid .bw-table tbody tr').first().getByRole('button', { name: '编辑', exact: true }).click();
  await desktop.locator('.bw-review-detail-drawer').waitFor();
  await desktop.locator('.bw-review-detail-drawer textarea[name="detail"]').fill('复核渠道PO、物流费用和Credit Note后形成统一行动说明。');
  const actionDrawerState = await desktop.evaluate(() => ({
    fields: document.querySelectorAll('.bw-review-detail-drawer .bw-review-detail-field').length,
    sourceOptions: document.querySelectorAll('.bw-review-detail-drawer select[name="source"] option').length,
    hasEvidence: Boolean(document.querySelector('.bw-review-detail-drawer textarea[name="evidence"]')),
    drawerOverflow: document.querySelector('.bw-review-detail-drawer')?.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review-action-drawer.png") });
  await desktop.getByRole('button', { name: '保存更新', exact: true }).click();
  const actionSavedState = await desktop.evaluate(() => ({
    drawerClosed: !document.querySelector('.bw-review-detail-drawer'),
    actionRows: document.querySelectorAll('.bw-action-compact-grid .bw-table tbody tr').length,
    persistedDetail: JSON.parse(sessionStorage.getItem('erp-native-business-review-state') || '{}').actions?.[0]?.detail
  }));
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review-actions.png"), fullPage: true });

  await desktop.getByRole("tab", { name: "复盘总览", exact: true }).click();
  await desktop.screenshot({ path: path.join(root, "native-business-analysis-review.png"), fullPage: true });

  await desktop.goto(`${entry}#module=businessReview`, { waitUntil: "load" });
  await desktop.waitForFunction(() => window.location.hash === "#module=performance");
  await desktop.locator(".business-analysis-review-workspace").waitFor();
  const legacyBusinessReviewRouteState = await desktop.evaluate(() => ({
    redirectedHash: window.location.hash,
    title: document.querySelector(".business-analysis-review-workspace .bw-title strong")?.textContent.trim(),
    oldNavigationRemoved: !document.querySelector('[data-module="businessReview"]')
  }));
  checks.push({ module: "business-analysis-review", businessReviewState, overviewExceptionModalState, overviewActionModalState, businessReviewViewsState, businessReviewPeriodState, profitExpenseState, logisticsPoState, logisticsSkuState, creditNumberState, creditSkuState, allMarketProfitState, categoryContributionState, forecastDeliveryState, actionCompactState, conclusionDrawerState, conclusionSavedState, actionDrawerState, actionSavedState, legacyBusinessReviewRouteState });

  await desktop.locator('[data-module="functions"]').click();
  await desktop.waitForFunction(() => window.location.hash === "#module=functions");
  await desktop.locator(".functional-workspace").waitFor();
  const functionalWorkspaceState = await desktop.evaluate(() => ({
    active: document.querySelector('[data-module="functions"]')?.classList.contains("active"),
    workspaces: document.querySelectorAll(".functional-table tbody tr").length,
    prototypeEntries: document.querySelectorAll('[data-functional-entry="prototype"]').length,
    separatePrototypeNavigation: document.querySelectorAll('[data-module="prototypeManagement"]').length,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.locator('[data-functional-entry="prototype"]').click();
  await desktop.waitForFunction(() => window.location.hash === "#module=functions&workspace=prototype");
  await desktop.locator(".prototype-workspace").waitFor();
  const prototypeState = await desktop.evaluate(() => ({
    active: document.querySelector('[data-module="functions"]')?.classList.contains("active"),
    nestedPath: window.location.hash === "#module=functions&workspace=prototype",
    hasWorkspaceReturn: Array.from(document.querySelectorAll("button")).some((node) => node.textContent.trim() === "返回职能工作台"),
    tabs: document.querySelectorAll(".prototype-view-tabs button").length,
    activeTab: document.querySelector(".prototype-view-tabs button.active")?.textContent.trim(),
    kpis: document.querySelectorAll(".prototype-kpi").length,
    rows: document.querySelectorAll("[data-prototype-project]").length,
    hasSyncBand: Boolean(document.querySelector(".prototype-sync-band")),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));

  await desktop.getByRole("button", { name: /新建样机需求/ }).click();
  await desktop.locator(".modal").waitFor();
  await desktop.locator('.modal select[name="projectId"]').selectOption("P51L-P2");
  await desktop.locator('.modal select[name="type"]').selectOption("市场");
  await desktop.locator('.modal input[name="quantity"]').fill("2");
  await desktop.locator('.modal input[name="purpose"]').fill("渠道演示与上市评审");
  await desktop.locator('.modal input[name="due"]').fill("2026-08-28");
  await desktop.getByRole("button", { name: "创建需求", exact: true }).click();
  await desktop.locator(".modal").waitFor({ state: "detached" });
  const requirementState = await desktop.locator('[data-prototype-project="P51L-P2"]').evaluate((row) => ({
    hasUpdatedDemand: row.textContent.includes("需求 6件"),
    hasNewNode: row.textContent.includes("需求已创建")
  }));

  await desktop.locator('[data-prototype-project="WM321"] button').click();
  await desktop.locator(".prototype-drawer").waitFor();
  const drawerState = await desktop.evaluate(() => ({
    requirements: document.querySelectorAll(".prototype-drawer .prototype-section-title").length,
    hasAuditPromise: document.querySelector(".prototype-drawer")?.textContent.includes("所有操作追加历史记录"),
    horizontalOverflow: document.querySelector(".prototype-drawer")?.scrollWidth > window.innerWidth
  }));
  await desktop.getByRole("button", { name: "记录样机操作", exact: true }).click();
  await desktop.locator(".modal").waitFor();
  await desktop.locator('.modal select[name="action"]').selectOption("receive");
  await desktop.locator('.modal input[name="quantity"]').fill("1");
  await desktop.locator('.modal input[name="to"]').fill("Madrid Office");
  await desktop.locator('.modal textarea[name="note"]').fill("GTM评审样机已签收");
  await desktop.getByRole("button", { name: "保存操作", exact: true }).click();
  await desktop.locator(".modal").waitFor({ state: "detached" });
  const movementSavedState = await desktop.locator('[data-prototype-project="WM321"]').evaluate((row) => ({
    readinessUpdated: row.textContent.includes("6/7"),
    destinationUpdated: row.textContent.includes("Madrid Office")
  }));

  await desktop.locator('[data-prototype-tab="movements"]').click();
  const movementState = await desktop.evaluate(() => ({
    rows: document.querySelectorAll(".prototype-data-table tbody tr").length,
    hasNewMovement: document.body.innerText.includes("GTM评审样机已签收")
  }));
  await desktop.locator('[data-prototype-tab="loans"]').click();
  const loanState = await desktop.evaluate(() => ({
    rows: document.querySelectorAll(".prototype-data-table tbody tr").length,
    openReturns: Array.from(document.querySelectorAll(".prototype-data-table button")).filter((node) => node.textContent.includes("登记归还")).length
  }));
  await desktop.locator('[data-prototype-tab="history"]').click();
  const historyState = await desktop.evaluate(() => ({
    rows: document.querySelectorAll(".prototype-data-table tbody tr").length,
    hasRequirementHistory: document.body.innerText.includes("新建样机需求"),
    hasReceiptHistory: document.body.innerText.includes("登记签收"),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  checks.push({ module: "prototype-management", functionalWorkspaceState, prototypeState, requirementState, drawerState, movementSavedState, movementState, loanState, historyState });
  await desktop.locator('[data-prototype-tab="overview"]').click();
  await desktop.screenshot({ path: path.join(root, "native-prototype-management.png") });
  await desktop.getByRole("button", { name: "返回职能工作台", exact: true }).click();
  await desktop.waitForFunction(() => window.location.hash === "#module=functions");
  await desktop.locator(".functional-workspace").waitFor();
  const functionalReturnState = await desktop.evaluate(() => ({
    active: document.querySelector('[data-module="functions"]')?.classList.contains("active"),
    workspaceVisible: Boolean(document.querySelector(".functional-workspace")),
    prototypeEntryVisible: Boolean(document.querySelector('[data-functional-entry="prototype"]'))
  }));
  checks.push({ module: "functional-workspace-return", functionalReturnState });
  await desktop.screenshot({ path: path.join(root, "native-functional-workspace.png") });

  await desktop.locator('[data-module="shipmentSummary"]').click();
  await desktop.locator('[data-logistics-view="shipment"]').click();
  await desktop.reload({ waitUntil: "load" });
  await desktop.waitForTimeout(300);
  const desktopState = await desktop.evaluate(() => ({
    title: document.title,
    activeModule: document.querySelector(".nav-item.active")?.getAttribute("data-module"),
    activeLogisticsView: document.querySelector("[data-logistics-view].active")?.getAttribute("data-logistics-view"),
    hash: window.location.hash,
    iframes: document.querySelectorAll("iframe").length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-platform-desktop.png") });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileErrors = [];
  mobile.on("console", (message) => {
    if (message.type() === "error") mobileErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => mobileErrors.push(error.message));
  await mobile.goto(`${entry}#module=logistic&view=operation`, { waitUntil: "load" });
  await mobile.waitForTimeout(300);
  const mobileState = await mobile.evaluate(() => ({
    sidebarDisplay: getComputedStyle(document.querySelector(".platform-sidebar")).display,
    mobilePickerDisplay: getComputedStyle(document.querySelector(".mobile-module-picker")).display,
    logisticsSubnavDisplay: getComputedStyle(document.querySelector("#logisticsSubnav")).display,
    activeLogisticsView: document.querySelector("[data-logistics-view].active")?.getAttribute("data-logistics-view"),
    iframes: document.querySelectorAll("iframe").length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-platform-mobile.png") });

  await mobile.goto(`${entry}#module=forecast`, { waitUntil: "load" });
  await mobile.waitForTimeout(260);
  await mobile.getByRole("tab", { name: "预测评分卡" }).click();
  await mobile.locator(".forecast-scorecard").waitFor();
  await mobile.locator('[data-score-view="quarter"]').click();
  const mobileScorecardState = await mobile.evaluate(() => ({
    scoreViews: document.querySelectorAll(".forecast-score-view-tabs button").length,
    activeScoreView: document.querySelector(".forecast-score-view-tabs button.active")?.textContent.trim(),
    internalTableOverflow: document.querySelector(".forecast-score-quarter-table-scroll")?.scrollWidth > document.querySelector(".forecast-score-quarter-table-scroll")?.clientWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-forecast-scorecard-mobile.png"), fullPage: true });

  await mobile.goto(`${entry}#module=bp`, { waitUntil: "load" });
  await mobile.waitForTimeout(260);
  await mobile.locator(".bp-achievement-workspace").waitFor();
  await mobile.getByRole("tab", { name: "产品明细", exact: true }).click();
  const mobileBpState = await mobile.evaluate(() => ({
    tabs: document.querySelectorAll(".bp-achievement-workspace .bw-view-tabs > button").length,
    compactControl: Boolean(document.querySelector(".bp-control")),
    legacyPageHead: Boolean(document.querySelector(".bp-achievement-workspace > .bw-page-head")),
    rows: document.querySelectorAll(".bp-product-table tbody tr").length,
    internalTableOverflow: document.querySelector(".bp-product-table")?.scrollWidth > document.querySelector(".bp-product-table")?.clientWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.getByRole("tab", { name: "市场与品类", exact: true }).click();
  const mobileBpMarketState = await mobile.evaluate(() => ({
    subviews: document.querySelectorAll(".bp-market-subviews button").length,
    activeSubview: document.querySelector(".bp-market-subviews button.active")?.textContent.trim(),
    selectedDetail: Boolean(document.querySelector(".bp-cell-detail-panel")),
    internalMatrixOverflow: document.querySelector(".bp-matrix-table")?.scrollWidth > document.querySelector(".bp-matrix-table")?.clientWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-bp-achievement-market-mobile.png"), fullPage: true });
  await mobile.locator('[data-bp-market-view="trend"]').click();
  const mobileBpTrendState = await mobile.evaluate(() => ({
    activeSubview: document.querySelector(".bp-market-subviews button.active")?.textContent.trim(),
    months: document.querySelectorAll(".bp-chart-month-group").length,
    hasCombinationChart: document.querySelectorAll(".bp-chart-target").length === 12
      && document.querySelectorAll(".bp-chart-actual").length === 12
      && document.querySelectorAll(".bp-chart-forecast").length === 1
      && document.querySelectorAll(".bp-chart-rate").length === 1,
    internalTrendOverflow: document.querySelector(".bp-trend-chart")?.scrollWidth > document.querySelector(".bp-trend-chart")?.clientWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.getByRole("tab", { name: "综合达成", exact: true }).click();
  await mobile.screenshot({ path: path.join(root, "native-bp-achievement-mobile.png"), fullPage: true });

  await mobile.goto(`${entry}#module=performance`, { waitUntil: "load" });
  await mobile.waitForTimeout(260);
  await mobile.locator(".business-analysis-review-workspace").waitFor();
  const mobileBusinessAnalysisReviewState = await mobile.evaluate(() => ({
    title: document.querySelector(".business-analysis-review-workspace .bw-title strong")?.textContent.trim(),
    tabs: document.querySelectorAll(".business-analysis-review-workspace .bw-view-tabs > button").length,
    workflowSteps: document.querySelectorAll(".bw-review-step").length,
    compactControl: Boolean(document.querySelector(".bw-review-control")),
    legacyPageHead: Boolean(document.querySelector(".business-analysis-review-workspace > .bw-page-head")),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-business-analysis-review-mobile.png"), fullPage: true });
  await mobile.getByRole("tab", { name: "收入与利润", exact: true }).click();
  const mobileBusinessProfitState = await mobile.evaluate(() => ({
    totalRows: document.querySelectorAll('.bw-market-finance-expense .bw-total-row').length,
    categoryRows: document.querySelectorAll('.bw-category-table tbody tr').length,
    categoryMetricTabs: document.querySelectorAll('.bw-category-metric-tabs button').length,
    donutVisible: Boolean(document.querySelector('.bw-donut')),
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-business-analysis-review-profit-mobile.png"), fullPage: true });

  await mobile.goto(`${entry}#module=functions&workspace=prototype`, { waitUntil: "load" });
  await mobile.waitForTimeout(260);
  await mobile.locator(".prototype-workspace").waitFor();
  const mobilePrototypeState = await mobile.evaluate(() => ({
    tabs: document.querySelectorAll(".prototype-view-tabs button").length,
    rows: document.querySelectorAll("[data-prototype-project]").length,
    internalTableOverflow: document.querySelector(".prototype-table-scroll")?.scrollWidth > document.querySelector(".prototype-table-scroll")?.clientWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-prototype-management-mobile.png"), fullPage: true });

  await browser.close();

  const result = { checks, desktopState, mobileState, mobileScorecardState, mobileBpState, mobileBpMarketState, mobileBpTrendState, mobileBusinessAnalysisReviewState, mobileBusinessProfitState, mobilePrototypeState, errors: [...errors, ...mobileErrors] };
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length
    || checks.some((check) => check.active === false)
    || desktopState.iframes
    || mobileState.iframes
    || desktopState.horizontalBodyOverflow
    || mobileState.horizontalBodyOverflow
    || mobileScorecardState.scoreViews !== 3
    || mobileScorecardState.activeScoreView !== "季度复盘明细"
    || !mobileScorecardState.internalTableOverflow
    || mobileScorecardState.horizontalBodyOverflow
    || mobileBpState.tabs !== 4
    || !mobileBpState.compactControl
    || mobileBpState.legacyPageHead
    || !mobileBpState.rows
    || !mobileBpState.internalTableOverflow
    || mobileBpState.horizontalBodyOverflow
    || mobileBpMarketState.subviews !== 3
    || mobileBpMarketState.activeSubview !== "达成矩阵"
    || !mobileBpMarketState.selectedDetail
    || !mobileBpMarketState.internalMatrixOverflow
    || mobileBpMarketState.horizontalBodyOverflow
    || mobileBpTrendState.activeSubview !== "趋势与预测"
    || mobileBpTrendState.months !== 12
    || !mobileBpTrendState.hasCombinationChart
    || !mobileBpTrendState.internalTrendOverflow
    || mobileBpTrendState.horizontalBodyOverflow
    || mobileBusinessAnalysisReviewState.title !== "经营分析复盘"
    || mobileBusinessAnalysisReviewState.tabs !== 6
    || mobileBusinessAnalysisReviewState.workflowSteps !== 0
    || !mobileBusinessAnalysisReviewState.compactControl
    || mobileBusinessAnalysisReviewState.legacyPageHead
    || mobileBusinessAnalysisReviewState.horizontalBodyOverflow
    || mobileBusinessProfitState.totalRows !== 1
    || !mobileBusinessProfitState.categoryRows
    || mobileBusinessProfitState.categoryMetricTabs !== 3
    || !mobileBusinessProfitState.donutVisible
    || mobileBusinessProfitState.horizontalBodyOverflow
    || !functionalWorkspaceState.active
    || functionalWorkspaceState.workspaces !== 6
    || functionalWorkspaceState.prototypeEntries !== 1
    || functionalWorkspaceState.separatePrototypeNavigation !== 0
    || functionalWorkspaceState.horizontalBodyOverflow
    || !prototypeState.active
    || !prototypeState.nestedPath
    || !prototypeState.hasWorkspaceReturn
    || prototypeState.tabs !== 4
    || prototypeState.activeTab !== "项目总览"
    || prototypeState.kpis !== 5
    || prototypeState.rows !== 5
    || !prototypeState.hasSyncBand
    || prototypeState.horizontalBodyOverflow
    || !requirementState.hasUpdatedDemand
    || !requirementState.hasNewNode
    || drawerState.requirements !== 3
    || !drawerState.hasAuditPromise
    || drawerState.horizontalOverflow
    || !movementSavedState.readinessUpdated
    || !movementSavedState.destinationUpdated
    || !movementState.rows
    || !movementState.hasNewMovement
    || !loanState.rows
    || !loanState.openReturns
    || !historyState.rows
    || !historyState.hasRequirementHistory
    || !historyState.hasReceiptHistory
    || historyState.horizontalBodyOverflow
    || mobilePrototypeState.tabs !== 4
    || mobilePrototypeState.rows !== 5
    || !mobilePrototypeState.internalTableOverflow
    || mobilePrototypeState.horizontalBodyOverflow
    || !functionalReturnState.active
    || !functionalReturnState.workspaceVisible
    || !functionalReturnState.prototypeEntryVisible
    || bpOverviewState.title !== "BP达成"
    || bpOverviewState.tabs.join("|") !== "综合达成|市场与品类|产品明细|版本记录"
    || bpOverviewState.activeTab !== "综合达成"
    || !bpOverviewState.compactControl
    || bpOverviewState.legacyPageHead
    || bpOverviewState.legacyMethodBar
    || bpOverviewState.legacyFilterBar
    || bpOverviewState.controlHeight > 115
    || bpOverviewState.kpis !== 4
    || bpOverviewState.quarters !== 4
    || bpOverviewState.monthlyRows !== 12
    || !bpOverviewState.nativeEntry
    || bpOverviewState.oldPlaceholderEntry
    || bpOverviewState.horizontalBodyOverflow
    || bpMarketMatrixState.activeTab !== "市场与品类"
    || bpMarketMatrixState.subviews.join("|") !== "达成矩阵|趋势与预测|结构与缺口"
    || bpMarketMatrixState.activeSubview !== "达成矩阵"
    || bpMarketMatrixState.kpis !== 6
    || bpMarketMatrixState.matrixRows < 2
    || bpMarketMatrixState.matrixColumns !== 7
    || bpMarketMatrixState.selectedCells !== 1
    || !bpMarketMatrixState.selectedDetail
    || !bpMarketMatrixState.selectedDetailRows
    || bpMarketMatrixState.selectedDetailActions !== 3
    || bpMarketMatrixState.monitorButtons !== 2
    || bpMarketMatrixState.trendPanels
    || bpMarketMatrixState.horizontalBodyOverflow
    || !bpRiskModalState.visible
    || !bpRiskModalState.rows
    || bpRiskModalState.horizontalBodyOverflow
    || !bpStructureModalState.visible
    || !bpStructureModalState.rows
    || !bpStructureModalState.hasThresholdRule
    || bpStructureModalState.horizontalBodyOverflow
    || bpMarketTrendState.activeSubview !== "趋势与预测"
    || bpMarketTrendState.charts !== 1
    || bpMarketTrendState.months !== 12
    || bpMarketTrendState.targetBars !== 12
    || bpMarketTrendState.actualBars !== 12
    || bpMarketTrendState.forecastLines !== 1
    || bpMarketTrendState.rateLines !== 1
    || bpMarketTrendState.ratePoints !== 12
    || bpMarketTrendState.axisLabels !== 10
    || !bpMarketTrendState.progressRows
    || bpMarketTrendState.futureRows !== 3
    || bpMarketTrendState.matrixTables
    || bpMarketTrendState.horizontalBodyOverflow
    || bpMarketStructureState.activeSubview !== "结构与缺口"
    || bpMarketStructureState.structureRows !== 5
    || bpMarketStructureState.dimensionButtons !== 3
    || !bpMarketStructureState.gapRows
    || bpMarketStructureState.actionRows > 3
    || bpMarketStructureState.hasGapAttribution
    || bpMarketStructureState.trendPanels
    || bpMarketStructureState.horizontalBodyOverflow
    || !bpCategoryGapRows
    || !bpSkuGapRows
    || bpSingleMarketState.scope !== "FR"
    || bpSingleMarketState.matrixRows !== 6
    || bpSingleMarketState.matrixColumns !== 6
    || bpSingleMarketState.selectedCells !== 1
    || bpSingleMarketState.horizontalBodyOverflow
    || !bpSelectedSku
    || !bpSelectedProductDrawerState.title?.includes(bpSelectedSku.trim())
    || bpSelectedProductDrawerState.market !== "FR"
    || bpSelectedProductDrawerState.rows !== 12
    || !bpPoDrilldownState.context?.includes(bpSelectedSku.trim())
    || bpPoDrilldownState.market !== "FR"
    || bpPoDrilldownState.query !== bpSelectedSku.trim()
    || bpPoDrilldownState.activeDetail !== "PO履约"
    || (!bpPoDrilldownState.rows && !bpPoDrilldownState.matchStatus?.includes("mapping") && !bpPoDrilldownState.matchStatus?.includes("period"))
    || (bpPoDrilldownState.rows > 0 && !bpPoDrilldownState.expandedRows)
    || (bpPoDrilldownState.matchStatus?.includes("mapping") && !bpPoDrilldownState.matchText?.includes("未替换为其他产品"))
    || bpPoDrilldownState.horizontalBodyOverflow
    || !bpForecastDrilldownState.context?.includes(bpSelectedSku.trim())
    || bpForecastDrilldownState.activeView !== "市场全景填报"
    || !bpForecastDrilldownState.marketLabel?.startsWith("FR")
    || bpForecastDrilldownState.search !== bpSelectedSku.trim()
    || bpForecastDrilldownState.category !== "Power bank"
    || !bpForecastDrilldownState.productRows
    || bpForecastDrilldownState.horizontalBodyOverflow
    || !bpProductState.rows
    || !bpProductState.hasQuantityColumns
    || !bpProductState.hasValueColumns
    || !bpProductState.hasBpOnlyRow
    || !bpProductState.productTargetMatches
    || !bpProductState.productQuantityMatches
    || bpProductState.horizontalBodyOverflow
    || bpProductDrawerState.rows !== 12
    || !bpProductDrawerState.hasContext
    || bpProductDrawerState.drawerOverflow
    || bpVersionState.cards !== 4
    || bpVersionState.rows !== 3
    || !bpVersionState.hasVersionRule
    || bpVersionState.horizontalBodyOverflow
    || businessReviewState.title !== "经营分析复盘"
    || businessReviewState.tabs.length !== 6
    || businessReviewState.activeTab !== "复盘总览"
    || businessReviewState.workflowSteps !== 0
    || !businessReviewState.compactControl
    || businessReviewState.legacyPageHead
    || businessReviewState.legacyMethodBand
    || businessReviewState.legacyFilterBar
    || businessReviewState.controlHeight > 115
    || businessReviewState.overviewKpis
    || businessReviewState.overviewPrimaryTitles.length !== 2
    || !businessReviewState.overviewPrimaryTitles[0]?.includes("利润桥")
    || businessReviewState.overviewPrimaryTitles[1] !== "市场复盘摘要"
    || businessReviewState.overviewSecondaryButtons !== 2
    || !businessReviewState.frozen
    || !businessReviewState.singleNavigationEntry
    || !businessReviewState.removedBusinessReviewNavigation
    || businessReviewState.navigationLabel !== "经营分析复盘"
    || businessReviewState.horizontalBodyOverflow
    || overviewExceptionModalState.issues < 1
    || !overviewExceptionModalState.hasPrimaryAction
    || overviewActionModalState.actions !== 5
    || !overviewActionModalState.hasPrimaryAction
    || businessReviewViewsState.activeTab !== "历史复盘"
    || !businessReviewViewsState.hasArchive
    || !businessReviewViewsState.hasSnapshotPromise
    || businessReviewViewsState.horizontalBodyOverflow
    || businessReviewPeriodState.type !== "month"
    || businessReviewPeriodState.period !== "2026-06"
    || !businessReviewPeriodState.title
    || legacyBusinessReviewRouteState.redirectedHash !== "#module=performance"
    || legacyBusinessReviewRouteState.title !== "经营分析复盘"
    || !legacyBusinessReviewRouteState.oldNavigationRemoved
    || profitExpenseState.duplicateKpis
    || profitExpenseState.bridgeSteps !== 6
    || profitExpenseState.bridgeHasInlineRatios < 3
    || profitExpenseState.expenseLinks < 2
    || profitExpenseState.expenseMarketRows.length !== 1
    || profitExpenseState.expenseMarketRows[0] !== "FR"
    || profitExpenseState.combinedTitle !== "市场收入、利润与费用"
    || profitExpenseState.standaloneExpensePanels
    || !profitExpenseState.financeHeaders.includes("物流费用（占比）")
    || !profitExpenseState.financeHeaders.includes("Credit Note（占比）")
    || profitExpenseState.expenseHasSeparateRatioHeader
    || profitExpenseState.horizontalBodyOverflow
    || !logisticsPoState.title
    || logisticsPoState.tabs.join("|") !== "按PO|按产品SKU"
    || !logisticsPoState.rows
    || !logisticsPoState.sourceVersion
    || logisticsPoState.modalOverflow
    || logisticsSkuState.active !== "按产品SKU"
    || !logisticsSkuState.rows
    || !logisticsSkuState.allocationNote
    || !creditNumberState.title
    || creditNumberState.tabs.join("|") !== "按Credit Note号|按产品SKU"
    || !creditNumberState.rows
    || !creditNumberState.sourceVersion
    || creditSkuState.active !== "按产品SKU"
    || !creditSkuState.rows
    || !creditSkuState.aggregationNote
    || allMarketProfitState.totalRows !== 1
    || !allMarketProfitState.totalLabel?.startsWith("合计")
    || allMarketProfitState.marketRows < 2
    || !allMarketProfitState.categoryRows
    || allMarketProfitState.categoryMetricTabs !== 3
    || !allMarketProfitState.donutVisible
    || allMarketProfitState.horizontalBodyOverflow
    || categoryContributionState.activeMetric !== "毛利润"
    || categoryContributionState.activeRows !== 1
    || categoryContributionState.activeLegend !== 1
    || !categoryContributionState.centerLabel
    || forecastDeliveryState.flowSteps !== 4
    || forecastDeliveryState.monthlyRows < 3
    || forecastDeliveryState.sourceButtons !== 3
    || !forecastDeliveryState.hasBp
    || !forecastDeliveryState.hasAccuracy
    || !forecastDeliveryState.hasEffectivePo
    || !forecastDeliveryState.hasDelivered
    || forecastDeliveryState.horizontalBodyOverflow
    || actionCompactState.legacyKpis
    || actionCompactState.legacyConclusionCards
    || actionCompactState.summaryRows !== 4
    || actionCompactState.actionRows !== 5
    || !actionCompactState.hasCompactHead
    || actionCompactState.horizontalBodyOverflow
    || conclusionDrawerState.fields !== 6
    || conclusionDrawerState.textareas !== 2
    || !conclusionDrawerState.autosave
    || conclusionDrawerState.drawerOverflow
    || !conclusionSavedState.updated
    || !conclusionSavedState.drawerClosed
    || actionDrawerState.fields !== 7
    || actionDrawerState.sourceOptions !== 6
    || !actionDrawerState.hasEvidence
    || actionDrawerState.drawerOverflow
    || !actionSavedState.drawerClosed
    || actionSavedState.actionRows !== 5
    || !actionSavedState.persistedDetail?.includes("统一行动说明")
    || !scorecardState.visible
    || scorecardState.scoreViews !== 3
    || scorecardState.activeScoreView !== "综合总览"
    || scorecardState.topKpis !== 4
    || scorecardState.duplicateHorizonKpis
    || scorecardState.quarterBars !== 4
    || scorecardState.quarterSummaryRows !== 4
    || !scorecardState.hasAccuracy
    || !scorecardState.hasCompositeAccuracy
    || scorecardState.hasWape
    || scorecardState.hasFdRanking
    || scorecardState.horizontalBodyOverflow
    || !allMarketScorecardState.marketColumn
    || !allMarketScorecardState.rows
    || allMarketScorecardState.horizontalBodyOverflow
    || !currentDetailState.active
    || !currentDetailState.rows
    || currentDetailState.horizontalBodyOverflow
    || !scorecardDrawerState.retailerNotScored
    || !scorecardDrawerState.poTableVisible
    || scorecardDrawerState.drawerOverflow
    || !quarterDetailState.active
    || !quarterDetailState.hasHorizonChart
    || quarterDetailState.summaryRows !== 4
    || !quarterDetailState.sourceRowsExpected
    || quarterDetailState.horizontalBodyOverflow
    || !quarterDrawerState.hasSourceVersions
    || !quarterDrawerState.hasPoTable
    || !quarterDrawerState.hasReviewFields
    || quarterDrawerState.drawerOverflow
    || !scoreRulesState.formula
    || !scoreRulesState.mentionsCancelledPo) {
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

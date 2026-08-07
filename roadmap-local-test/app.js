(() => {
  "use strict";

  const QUERY = new URLSearchParams(window.location.search);
  const EMBEDDED_MODE = QUERY.get("embedded") === "1";
  const EMBEDDED_LANGUAGE = QUERY.get("lang");
  const ACCESS_LEVELS = ["view", "edit", "manage"];
  const ROADMAP_ACCESS = ACCESS_LEVELS.includes(QUERY.get("access"))
    ? QUERY.get("access")
    : EMBEDDED_MODE ? "view" : "manage";
  const SOURCE_URL = "data/roadmap-baseline.json";
  const MASTER_DATA_URL = "data/master-products.json";
  const STORAGE_KEY = "productRoadmap.v1";
  const PREFERENCES_KEY = "productRoadmapPreferences.v1";
  const LEGACY_STORAGE_KEY = "operationsPlanningRoadmapLocalTest.v1";
  const ROADMAP_SCHEMA_VERSION = 3;
  const PREFERENCE_FIELDS = [
    "language", "activeLineId", "statusFilter", "year", "view", "search",
    "selectedProductId", "selectedVersionId", "productTab", "cardScale",
    "verticalMode", "weeklyPanelHidden", "weeklyLanguage", "weeklyHistoryVisible"
  ];
  const STATUS_ORDER = ["all", "updated", "launched", "upgrade", "new", "eol"];
  const SOURCE_IMPORTED_AT = "2026-08-05T22:45:04+02:00";

  const COPY = {
    zh: {
      brand: "运营协同平台", region: "欧洲业务运营", planning: "计划与交付", roadmap: "产品路线图",
      projects: "项目跟进", sales: "产销管理", forecast: "预测管理", logistics: "物流交付", test: "测试",
      growth: "市场增长", launch: "新品上市", campaigns: "营销活动", assets: "营销物料", collaboration: "协同中心",
      promoApprovals: "月度促销审批", otherApprovals: "其他审批", tasks: "我的待办", exceptions: "异常中心",
      business: "经营管理", businessOverview: "经营总览", bp: "BP达成", analysis: "经营分析", valueChain: "价值链测算",
      settlement: "结算台账", admin: "专业与管理", workspace: "职能工作台", prototype: "样机管理", system: "系统管理",
      localTest: "本地 Roadmap 测试", contextSubtitle: "产品组合、目标上市时间与项目执行联动", account: "当前账号",
      language: "界面语言", reset: "恢复基准", localOnly: "云端同步", presentation: "演示模式", addProduct: "新增产品",
      portfolioItems: "产品节点", allLines: "全部产品线", newProducts: "新品", plannedLaunch: "规划上市", upgrades: "升级产品",
      transitionTrack: "替代与升级路径", eolProducts: "EOL", historyScope: "历史范围", weeklyUpdates: "本周更新",
      roadmapView: "路线图", updateLedger: "更新台账", versionHistory: "版本历史", projectSearch: "产品 / 型号", timeline: "时间线",
      sourceCopy: "团队 Roadmap 已同步", sourceCopyDetail: "业务修改自动保存到云端并生成版本；个人筛选和视图偏好仅保存在当前浏览器。",
      cardScale: "卡片大小", showWeekly: "显示本周更新", structureOverview: "结构总览", preciseLayout: "精确坐标",
      axisHint: "横轴为目标上市时间，纵轴为规划零售价。点击产品查看项目与历史。", updateLedgerSubtitle: "按产品集中查看和录入周度更新",
      editWeek: "编辑本周", week: "周次", status: "状态", historySubtitle: "Roadmap 版本与原始周度归档统一查看",
      immutable: "历史不可覆盖", sourceArchives: "源周度归档", sourceArchiveSubtitle: "由原 Roadmap 完整导入的中英文历史",
      openLedger: "打开台账", overview: "概览", projectExecution: "项目执行", changes: "变更历史", masterDataRule: "必须从 Master Data 选择，型号和名称不可自由创建。",
      masterProduct: "Master Data 产品", selectMasterData: "选择后自动带出型号、名称和品类", productLine: "产品线", lifecycle: "生命周期",
      targetLaunch: "目标上市", rrp: "规划 RRP (€)", cancel: "取消", saveDraft: "保存草稿", autosave: "输入自动保存为团队草稿",
      publishWeek: "保存并生成版本"
    },
    en: {
      brand: "Operations Hub", region: "Europe Business Operations", planning: "Planning & Delivery", roadmap: "Product Roadmap",
      projects: "Project Tracking", sales: "Sales & Inventory", forecast: "Forecast Management", logistics: "Logistics Delivery", test: "Test",
      growth: "Market Growth", launch: "New Product Launch", campaigns: "Campaigns", assets: "Marketing Assets", collaboration: "Collaboration Center",
      promoApprovals: "Monthly Promotion Approval", otherApprovals: "Other Approvals", tasks: "My Tasks", exceptions: "Exception Center",
      business: "Business Management", businessOverview: "Business Overview", bp: "BP Achievement", analysis: "Business Analysis", valueChain: "Value Chain Simulation",
      settlement: "Settlement Ledger", admin: "Professional & Admin", workspace: "Functional Workspace", prototype: "Prototype Management", system: "System Management",
      localTest: "Local Roadmap Test", contextSubtitle: "Product portfolio, target launch timing and project execution", account: "Current account",
      language: "Interface language", reset: "Restore baseline", localOnly: "Cloud synced", presentation: "Presentation", addProduct: "Add product",
      portfolioItems: "Portfolio items", allLines: "All product lines", newProducts: "New products", plannedLaunch: "Planned launches", upgrades: "Upgrades",
      transitionTrack: "Replacement and upgrade paths", eolProducts: "EOL", historyScope: "Historical scope", weeklyUpdates: "Weekly updates",
      roadmapView: "Roadmap", updateLedger: "Update ledger", versionHistory: "Version history", projectSearch: "Product / model", timeline: "Timeline",
      sourceCopy: "Team Roadmap synced", sourceCopyDetail: "Business changes save to the cloud with version history; personal filters and views stay in this browser.",
      cardScale: "Card size", showWeekly: "Show weekly update", structureOverview: "Structure", preciseLayout: "Precise",
      axisHint: "The horizontal axis is target launch timing and the vertical axis is planned retail price. Select a product for project and history details.", updateLedgerSubtitle: "Review and enter weekly updates by product",
      editWeek: "Edit this week", week: "Week", status: "Status", historySubtitle: "Review Roadmap versions and source weekly archives together",
      immutable: "Immutable history", sourceArchives: "Source weekly archives", sourceArchiveSubtitle: "Complete Chinese and English history imported from the source Roadmap",
      openLedger: "Open ledger", overview: "Overview", projectExecution: "Project execution", changes: "Change history", masterDataRule: "Select from Master Data; model and product name cannot be created as free text.",
      masterProduct: "Master Data product", selectMasterData: "Selection fills model, name and category automatically", productLine: "Product line", lifecycle: "Lifecycle",
      targetLaunch: "Target launch", rrp: "Planned RRP (€)", cancel: "Cancel", saveDraft: "Save draft", autosave: "Inputs autosave as a team draft",
      publishWeek: "Save and create version"
    }
  };

  const STATUS_COPY = {
    zh: { all: "全部", updated: "本周有更新", launched: "已上市", upgrade: "升级", new: "新品", eol: "已退市（EOL）" },
    en: { all: "All", updated: "Updated this week", launched: "Launched", upgrade: "Upgrade", new: "New", eol: "EOL" }
  };

  const PANEL_COPY = {
    zh: { title: "最新一周更新", edit: "编辑", history: "显示历史记录", focus: "本周产品更新", historyTitle: "历史周报", meta: "本周主题（可选）", save: "保存、翻译并归档", cancel: "取消", flipTitle: "Flip to English", flipText: "EN", autoDate: "记录日期", automatic: "自动", productForm: "按产品填写本周更新", placeholder: "填写该产品当天更新；无更新请留空", today: "今日", savedDay: "本周已保存", addPhoto: "添加图片", dropPhoto: "粘贴截图或拖入图片", filled: "项有更新", noUpdate: "本周暂无产品更新", noHistory: "暂无历史记录", archived: "已自动归档", deleteHistory: "删除该周历史", confirmDeleteHistory: "确认删除该周全部历史更新吗？删除后无法撤销：", historyDeleted: "历史周报已删除", translated: "英文版本已根据中文自动更新", unavailable: "英文自动翻译暂不可用，已保留上一版英文", hide: "隐藏本周更新" },
    en: { title: "Latest Weekly Update", edit: "Review", history: "Show history", focus: "Product Updates This Week", historyTitle: "Weekly Archive", meta: "Weekly topic (optional)", save: "Save revision", cancel: "Cancel", flipTitle: "切换到中文", flipText: "中", autoDate: "Record date", automatic: "Auto", productForm: "Review updates by product and date", placeholder: "Enter the update for this date; leave blank if unchanged", today: "Today", savedDay: "Saved this week", addPhoto: "Add image", dropPhoto: "Paste a screenshot or drop images", filled: "updated", noUpdate: "No product updates this week", noHistory: "No archived updates", archived: "Auto archived", deleteHistory: "Delete this archived week", confirmDeleteHistory: "Delete all updates in this archived week? This cannot be undone:", historyDeleted: "Archived week deleted", translated: "Auto-translated from the Chinese update", unavailable: "Automatic translation is unavailable; the previous English version is retained", hide: "Hide weekly update" }
  };

  const SOURCE_TIME_AXES = {
    2026: { "2024": 10.8, "2025": 27.4, "2026 Q1": 44, "2026 Q2": 60.7, "2026 Q3": 77.3, "2026 Q4": 93 },
    2027: { "2025": 10.8, "2026": 27.4, "2027 Q1": 44, "2027 Q2": 60.7, "2027 Q3": 77.3, "2027 Q4": 93 }
  };
  const TIMELINE_2027_OFFSET = 65.6;
  const TIMELINE_RAW_END = 181.5;
  const CONTINUOUS_TIMELINE = [
    ["2024", 10.8], ["2025", 27.4], ["2026 Q1", 44], ["2026 Q2", 60.7], ["2026 Q3", 77.3], ["2026 Q4", 93],
    ["2027 Q1", 109.6], ["2027 Q2", 126.3], ["2027 Q3", 142.9], ["2027 Q4", 158.6], ["TBD", 175.2]
  ];
  const STRUCTURE_PRICE_THRESHOLDS = {
    "pocket-leopard": [130, 100, 80, 50, 20],
    "magpro-pb": [100, 80, 60, 40, 20],
    wireless: [150, 100, 80, 60, 20],
    charger: [130, 100, 80, 50, 20],
    cable: [30, 20, 15, 10, 5]
  };

  const MASTER_DATA_FALLBACK = [
    { code: "P61L-P2", name: "Pocket 10K 45W", category: "移动电源", line: "pocket-leopard", image: "image2.png", project: "P61L-P2" },
    { code: "P51L-P2", name: "Pocket 20K 45W", category: "移动电源", line: "pocket-leopard", image: "image1.png", project: "P51L-P2" },
    { code: "PX51", name: "MagPro Neo 10K Qi2.0", category: "移动电源", line: "magpro-pb", image: "image15.png", project: "PX51" },
    { code: "PM61-Black", name: "MagPro Slim 10K Qi2.2 - Black", category: "移动电源", line: "magpro-pb", image: "image13.png", project: "PM61-Black" },
    { code: "WM321", name: "MagPro 3-in-1 Station", category: "无线充", line: "wireless", image: "image20.png", project: "WM321" },
    { code: "WAL101", name: "Leopard Fold Charger 100W - EU", category: "充头", line: "charger", image: "image23.png", project: "WAL101" },
    { code: "WM301", name: "MagPro 2-in-1", category: "无线充", line: "wireless", image: "image21.png", project: "WM301" },
    { code: "CBL-C2C-240W", name: "Leopard Cable 240W", category: "充电线", line: "cable", image: "image31.png", project: "" },
    { code: "CHG-70W-EU", name: "Leopard Fold Charger 70W", category: "充头", line: "charger", image: "image24.png", project: "" },
    { code: "PB-RUGGED-20K", name: "Rugged 20K", category: "移动电源", line: "pocket-leopard", image: "image12.png", project: "" },
    { code: "PB-LP-200W", name: "Leopard Power 200W", category: "移动电源", line: "pocket-leopard", image: "image11.png", project: "" },
    { code: "CHG-STATION-300W", name: "Charging Station 300W", category: "充头", line: "charger", image: "image28.png", project: "" },
    { code: "P76-P1-W", name: "MagPro Slim 10K-White", category: "移动电源", line: "magpro-pb", image: "image13.png", project: "P76-P1-W" }
  ];

  const LEGACY_MASTER_ALIASES = {
    "PM61-Black": "PM61-B",
    "CBL-C2C-240W": "C12-P1",
    "CHG-70W-EU": "WAL11",
    "PB-RUGGED-20K": "RG20000",
    "PB-LP-200W": "P200",
    "CHG-STATION-300W": "TAL11"
  };

  let masterData = [...MASTER_DATA_FALLBACK];

  const dom = {};
  let state = null;
  let sourceSlides = [];
  let toastTimer = 0;
  let weeklyEditing = false;
  let weeklyFlipping = false;
  let productEditing = false;
  let focusProductMaster = false;
  let productImageDraft = { productId: "", value: "" };
  let timelineInitialised = false;
  let panState = null;
  let lastSharedSnapshot = "";
  let sharedStateNeedsSeed = false;
  let sharedStateNeedsMigration = false;

  document.addEventListener("DOMContentLoaded", init);

  function canEditRoadmap() {
    return ROADMAP_ACCESS === "edit" || ROADMAP_ACCESS === "manage";
  }

  function canManageRoadmap() {
    return ROADMAP_ACCESS === "manage";
  }

  function showAccessDenied() {
    showToast(state?.language === "en"
      ? "Your Product Roadmap permission is view only."
      : "当前产品路线图权限为只读，无法执行此操作。");
  }

  async function init() {
    document.documentElement.classList.toggle("embedded", EMBEDDED_MODE);
    cacheDom();
    bindStaticEvents();
    try {
      const [response, masterResponse] = await Promise.all([
        fetch(SOURCE_URL, { cache: "no-store" }),
        fetch(MASTER_DATA_URL, { cache: "no-store" }).catch(() => null)
      ]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (masterResponse?.ok) {
        const catalog = await masterResponse.json();
        masterData = normaliseMasterCatalog(catalog?.products);
      }
      sourceSlides = await response.json();
      state = loadState(sourceSlides);
      normaliseState();
      if (EMBEDDED_MODE && ["zh", "en"].includes(EMBEDDED_LANGUAGE)) state.language = EMBEDDED_LANGUAGE;
      applyAccessMode();
      if ((sharedStateNeedsSeed || sharedStateNeedsMigration) && canEditRoadmap()) persistState({ forceShared: true });
      applyLanguage();
      renderAll();
    } catch (error) {
      dom.roadmapCanvas.innerHTML = `<div class="canvas-empty">${escapeHtml(error.message || String(error))}</div>`;
      showToast("Roadmap data could not be loaded. Start this test through a local HTTP server.");
    }
  }

  function cacheDom() {
    [
      "languageSelect", "resetTestButton", "presentButton", "addProductButton", "lineTabs", "statusFilters", "productSearch", "productOptions",
      "roadmapCanvas", "roadmapScroll", "roadmapLayout", "canvasTitle", "canvasMeta", "visibleCount", "cardScaleInput", "cardScaleValue", "verticalModeSwitch",
      "showWeeklyPanelButton", "weeklyPanel", "hideWeeklyPanelButton", "weeklyLanguageButton", "weeklyEditButton", "weeklyTitle", "weeklyScope", "weeklyPeriod", "weeklyMeta", "weeklyTranslationStatus", "weeklyHistoryLabel", "weeklyHistoryToggle", "weeklyUpdatesDisplay", "weeklyInlineForm", "weeklyAutoDateLabel", "weeklyAutoDateValue", "weeklyAutoDateTag", "weeklyMetaFieldLabel", "weeklyProductFormLabel", "weeklyProductCount", "weeklyProductFields", "weeklySaveButton", "weeklyCancelButton", "updatesView", "updatesTable", "ledgerWeek", "ledgerStatus", "ledgerResultCount",
      "editWeeklyButton", "historyView", "versionList", "versionDetail", "archiveTable", "updatesDrawer", "updatesDrawerContent", "drawerScope",
      "drawerEditButton", "openLedgerButton", "productDrawer", "productDrawerLine", "productDrawerTitle", "productDrawerSubtitle", "productDrawerContent",
      "drawerBackdrop", "productModal", "productForm", "masterProductInput", "masterProductResults", "masterProductToggle", "masterPreview", "productLineSelect", "newProductStatus",
      "weeklyModal", "weeklyForm", "weeklyFormScope", "weeklyEditor", "imageLightbox", "imageLightboxImage", "imageLightboxCaption", "imageLightboxClose", "toast"
    ].forEach(id => { dom[id] = document.getElementById(id); });
  }

  function bindStaticEvents() {
    dom.languageSelect.addEventListener("change", () => {
      state.language = dom.languageSelect.value;
      persistState();
      applyLanguage();
      renderAll();
    });

    dom.resetTestButton.addEventListener("click", () => {
      if (!canManageRoadmap()) return showAccessDenied();
      const message = state.language === "zh" ? "以源基准创建新的团队 Roadmap 版本？历史版本不会删除。" : "Create a new team Roadmap version from the source baseline? Existing history will remain.";
      if (!window.confirm(message)) return;
      const preferences = personalRoadmapState(state);
      const baseline = makeInitialState(sourceSlides);
      baseline.versions = [...state.versions, createVersionRecord(baseline, {
        titleZh: "管理员恢复 Roadmap 基准",
        titleEn: "Administrator restored Roadmap baseline",
        changes: [{ fieldZh: "团队 Roadmap", fieldEn: "Team Roadmap", detailZh: "从源基准创建新版本，历史记录保持不变", detailEn: "Created a new version from the source baseline; history remains intact" }]
      })];
      state = { ...baseline, ...preferences };
      normaliseState();
      persistState({ forceShared: true });
      applyLanguage();
      renderAll();
      showToast(state.language === "zh" ? "已从源基准创建新的团队版本" : "A new team version was created from the source baseline");
    });

    dom.presentButton.addEventListener("click", togglePresentation);
    document.addEventListener("fullscreenchange", () => document.body.classList.toggle("presentation", Boolean(document.fullscreenElement)));
    dom.addProductButton.addEventListener("click", openProductModal);

    document.querySelectorAll(".view-button").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
    dom.productSearch.addEventListener("input", () => {
      state.search = dom.productSearch.value.trim();
      if (findProductSearchResult(state.search, true)) {
        locateSearchResult();
        return;
      }
      renderRoadmap();
      renderCardScale();
    });
    dom.productSearch.addEventListener("change", () => locateSearchResult());
    dom.productSearch.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      locateSearchResult();
    });

    dom.cardScaleInput.addEventListener("input", () => {
      state.cardScale = clamp(dom.cardScaleInput.value, 80, Number(dom.cardScaleInput.max || 135));
      persistState();
      renderCardScale();
      requestAnimationFrame(layoutProductCards);
    });
    dom.verticalModeSwitch.querySelectorAll("[data-vertical-mode]").forEach(button => button.addEventListener("click", () => {
      state.verticalMode = ["structure", "precise"].includes(button.dataset.verticalMode) ? button.dataset.verticalMode : "structure";
      persistState();
      renderVerticalMode();
      renderRoadmap();
      renderCardScale();
    }));
    dom.hideWeeklyPanelButton.addEventListener("click", () => setWeeklyPanelHidden(true));
    dom.showWeeklyPanelButton.addEventListener("click", () => setWeeklyPanelHidden(false));
    dom.weeklyLanguageButton.addEventListener("click", flipWeeklyLanguage);
    dom.weeklyEditButton.addEventListener("click", () => { if (!canEditRoadmap()) return showAccessDenied(); weeklyEditing = true; renderWeeklyPanel(); });
    dom.weeklyCancelButton.addEventListener("click", () => { weeklyEditing = false; renderWeeklyPanel(); });
    dom.weeklyHistoryToggle.addEventListener("change", () => { state.weeklyHistoryVisible = dom.weeklyHistoryToggle.checked; persistState(); renderWeeklyPanel(); });
    dom.weeklyInlineForm.addEventListener("submit", saveInlineWeeklyUpdates);
    dom.weeklyInlineForm.addEventListener("input", updateInlineWeeklyCount);
    dom.weeklyInlineForm.addEventListener("change", handleInlineWeeklyChange);
    dom.weeklyInlineForm.addEventListener("click", handleInlineWeeklyClick);
    dom.weeklyInlineForm.addEventListener("paste", handleInlineWeeklyPaste);
    dom.weeklyInlineForm.addEventListener("dragover", event => { if (event.target.closest("[data-weekly-dropzone]")) event.preventDefault(); });
    dom.weeklyInlineForm.addEventListener("drop", handleInlineWeeklyDrop);
    dom.weeklyUpdatesDisplay.addEventListener("click", handleWeeklyDisplayClick);
    dom.weeklyUpdatesDisplay.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key) || !event.target.closest("[data-current-update-product]")) return;
      event.preventDefault();
      handleWeeklyDisplayClick(event);
    });
    dom.editWeeklyButton.addEventListener("click", () => { if (!canEditRoadmap()) return showAccessDenied(); setView("roadmap"); setWeeklyPanelHidden(false); weeklyEditing = true; renderWeeklyPanel(); });
    dom.openLedgerButton.addEventListener("click", () => { closeDrawers(); setView("updates"); });
    dom.drawerBackdrop.addEventListener("click", closeDrawers);
    dom.imageLightboxClose.addEventListener("click", () => dom.imageLightbox.close());
    dom.imageLightbox.addEventListener("click", event => { if (event.target === dom.imageLightbox) dom.imageLightbox.close(); });
    document.querySelectorAll("[data-close-drawer]").forEach(button => button.addEventListener("click", closeDrawers));
    document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", () => dom.productModal.close()));
    document.querySelectorAll("[data-close-weekly]").forEach(button => button.addEventListener("click", () => dom.weeklyModal.close()));

    document.querySelectorAll(".drawer-tab").forEach(button => button.addEventListener("click", () => {
      state.productTab = button.dataset.productTab;
      productEditing = false;
      focusProductMaster = false;
      renderProductDrawer();
    }));

    dom.ledgerWeek.addEventListener("change", renderUpdatesTable);
    dom.ledgerStatus.addEventListener("change", renderUpdatesTable);
    bindMasterCombobox(dom.masterProductInput, dom.masterProductResults, dom.masterProductToggle, renderMasterPreview);
    dom.productForm.addEventListener("submit", saveNewProduct);
    dom.weeklyForm.addEventListener("submit", saveWeeklyUpdates);
    dom.weeklyEditor.addEventListener("input", autosaveWeeklyDraft);

    bindTimelinePanning();
    window.addEventListener("resize", () => {
      renderCardScale();
      requestAnimationFrame(layoutProductCards);
    });

    document.querySelectorAll(".nav-item:not(.active)").forEach(button => button.addEventListener("click", () => {
      showToast(state.language === "zh" ? "本地测试页仅演示产品路线图模块" : "This local test demonstrates only the Product Roadmap module");
    }));

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeDrawers();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("input, textarea, select, button") || state.view !== "roadmap") return;
        switchLine(event.key === "ArrowRight" ? 1 : -1);
      }
    });

    window.addEventListener("storage", event => {
      if (event.storageArea !== localStorage || event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const remote = JSON.parse(event.newValue);
        if (!validSharedRoadmapState(remote)) return;
        state = { ...state, ...sharedRoadmapState(remote), ...personalRoadmapState(state) };
        normaliseState();
        lastSharedSnapshot = JSON.stringify(sharedRoadmapState(state));
        renderAll();
      } catch {}
    });
  }

  function makeInitialState(slides) {
    const cleanSlides = structuredCloneSafe(slides).map(slide => ({
      ...slide,
      products: (slide.products || []).map(product => ({
        ...product,
        roadmapYear: inferRoadmapYear(product),
        plannedPrice: inferProductPrice(slide, product),
        masterId: findMasterMatch(product)?.code || "",
        projectId: findMasterMatch(product)?.project || ""
      }))
    }));
    const initial = {
      schemaVersion: ROADMAP_SCHEMA_VERSION,
      masterCatalogVersion: 2,
      language: "zh",
      activeLineId: cleanSlides[0]?.id || "",
      statusFilter: "all",
      year: 2026,
      view: "roadmap",
      search: "",
      selectedProductId: "",
      selectedVersionId: "",
      productTab: "overview",
      slides: cleanSlides,
      weeklyDrafts: {},
      cardScale: 100,
      verticalMode: "structure",
      weeklyPanelHidden: false,
      weeklyLanguage: "zh",
      weeklyHistoryVisible: false,
      versions: []
    };
    initial.versions.push(createVersionRecord(initial, {
      id: "source-import-v1",
      createdAt: SOURCE_IMPORTED_AT,
      actor: "System Import",
      titleZh: "导入原 Roadmap 基准",
      titleEn: "Imported source Roadmap baseline",
      changes: [
        { fieldZh: "导入范围", fieldEn: "Import scope", detailZh: "5 条产品线、44 个产品节点、2 条关系线和全部双语周度历史", detailEn: "5 product lines, 44 portfolio items, 2 relations and complete bilingual weekly history" },
        { fieldZh: "源数据", fieldEn: "Source data", detailZh: "保留为只读副本，未修改源文件", detailEn: "Retained as a read-only copy; source files remain unchanged" }
      ]
    }));
    return initial;
  }

  function loadState(slides) {
    const initial = makeInitialState(slides);
    const shared = readStoredJson(STORAGE_KEY);
    const legacy = readStoredJson(LEGACY_STORAGE_KEY);
    const preferences = readStoredJson(PREFERENCES_KEY);
    const sharedSource = validSharedRoadmapState(shared)
      ? shared
      : validSharedRoadmapState(legacy) ? legacy : null;
    const preferenceSource = preferences && typeof preferences === "object"
      ? preferences
      : legacy && typeof legacy === "object" ? personalRoadmapState(legacy) : {};
    const loaded = {
      ...initial,
      ...(sharedSource ? sharedRoadmapState(sharedSource) : {}),
      ...preferenceSource
    };
    sharedStateNeedsSeed = !validSharedRoadmapState(shared);
    lastSharedSnapshot = sharedSource ? JSON.stringify(sharedRoadmapState(loaded)) : "";
    return loaded;
  }

  function readStoredJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  }

  function validSharedRoadmapState(value) {
    return Boolean(value && typeof value === "object" && Array.isArray(value.slides) && value.slides.length);
  }

  function sharedRoadmapState(value = state) {
    return {
      schemaVersion: ROADMAP_SCHEMA_VERSION,
      masterCatalogVersion: Number(value?.masterCatalogVersion || 2),
      slides: structuredCloneSafe(value?.slides || []),
      weeklyDrafts: structuredCloneSafe(value?.weeklyDrafts || {}),
      versions: structuredCloneSafe(value?.versions || [])
    };
  }

  function personalRoadmapState(value = state) {
    return Object.fromEntries(PREFERENCE_FIELDS.map(key => [key, structuredCloneSafe(value?.[key])]).filter(([, item]) => item !== undefined));
  }

  function normaliseState() {
    const previousMasterCatalogVersion = Number(state.masterCatalogVersion || 0);
    if (ensureUniqueProductIds()) sharedStateNeedsMigration = true;
    state.schemaVersion = ROADMAP_SCHEMA_VERSION;
    state.language = state.language === "en" ? "en" : "zh";
    state.view = ["roadmap", "updates", "history"].includes(state.view) ? state.view : "roadmap";
    state.statusFilter = STATUS_ORDER.includes(state.statusFilter) ? state.statusFilter : "all";
    state.year = [2026, 2027].includes(Number(state.year)) ? Number(state.year) : 2026;
    state.cardScale = clamp(Number(state.cardScale) || 100, 80, 135);
    state.verticalMode = ["structure", "precise"].includes(state.verticalMode) ? state.verticalMode : "structure";
    state.weeklyPanelHidden = Boolean(state.weeklyPanelHidden);
    state.weeklyLanguage = state.weeklyLanguage === "en" ? "en" : "zh";
    state.weeklyHistoryVisible = Boolean(state.weeklyHistoryVisible);
    state.productTab = ["overview", "project", "changes"].includes(state.productTab) ? state.productTab : "overview";
    state.weeklyDrafts ||= {};
    state.versions ||= [];
    state.slides.forEach(slide => (slide.products || []).forEach(product => {
      const aliasedMasterId = LEGACY_MASTER_ALIASES[product.masterId];
      if (aliasedMasterId && masterData.some(item => item.code === aliasedMasterId)) product.masterId = aliasedMasterId;
      if (previousMasterCatalogVersion < 2) {
        const exactMatch = findExactMasterMatch(product);
        if (exactMatch) product.masterId = exactMatch.code;
      }
      product.imageFit = ["contain", "cover", "scale-down"].includes(product.imageFit) ? product.imageFit : "contain";
      product.imagePosition = ["center", "top", "bottom", "left", "right"].includes(product.imagePosition) ? product.imagePosition : "center";
      product.imageScale = clamp(Number(product.imageScale) || 100, 70, 140);
    }));
    state.masterCatalogVersion = 2;
    if (!state.slides.some(slide => slide.id === state.activeLineId)) state.activeLineId = state.slides[0]?.id || "";
  }

  function ensureUniqueProductIds() {
    const usedIds = new Set();
    const renames = [];
    state.slides.forEach(slide => {
      (slide.products || []).forEach(product => {
        const originalId = String(product.id || "product");
        if (!usedIds.has(originalId)) {
          product.id = originalId;
          usedIds.add(originalId);
          return;
        }
        const base = `${slide.id || "line"}--${originalId}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
        let nextId = base;
        let suffix = 2;
        while (usedIds.has(nextId)) nextId = `${base}-${suffix++}`;
        product.id = nextId;
        usedIds.add(nextId);
        renames.push({ slideId: slide.id, originalId, nextId, productName: product.name || "" });
        migrateSlideProductReferences(slide, product, originalId, nextId);
        migrateWeeklyDraftReference(slide.id, originalId, nextId);
        if (state.activeLineId === slide.id && state.selectedProductId === originalId) state.selectedProductId = nextId;
      });
    });
    if (!renames.length) return false;
    migrateVersionSnapshotIds(renames);
    return true;
  }

  function migrateSlideProductReferences(slide, product, originalId, nextId) {
    (slide.connections || []).forEach(connection => {
      if (connection.fromId === originalId) connection.fromId = nextId;
      if (connection.toId === originalId) connection.toId = nextId;
    });
    ["zh", "en"].forEach(language => {
      const side = slide.updates?.[language];
      if (!side) return;
      const updateGroups = [side.productUpdates || [], ...(side.archives || []).map(record => record.productUpdates || [])];
      updateGroups.flat().forEach(update => {
        if (update.productId !== originalId) return;
        if (update.productName && product.name && update.productName !== product.name) return;
        update.productId = nextId;
      });
    });
  }

  function migrateWeeklyDraftReference(slideId, originalId, nextId) {
    Object.entries(state.weeklyDrafts || {}).forEach(([key, draft]) => {
      if (!key.startsWith(`${slideId}:`) || !draft || typeof draft !== "object" || !(originalId in draft)) return;
      if (!(nextId in draft)) draft[nextId] = draft[originalId];
      delete draft[originalId];
    });
  }

  function migrateVersionSnapshotIds(renames) {
    const grouped = renames.reduce((map, item) => {
      if (!map.has(item.originalId)) map.set(item.originalId, []);
      map.get(item.originalId).push(item);
      return map;
    }, new Map());
    (state.versions || []).forEach(version => {
      const occurrence = new Map();
      (version.snapshot?.items || []).forEach(item => {
        const candidates = grouped.get(item.id);
        if (!candidates?.length) return;
        const count = occurrence.get(item.id) || 0;
        if (count > 0) {
          const matchingName = candidates.find(candidate => candidate.productName && candidate.productName === item.name);
          if (matchingName) item.id = matchingName.nextId;
          else if (candidates[count - 1]) item.id = candidates[count - 1].nextId;
        }
        occurrence.set(candidates[0].originalId, count + 1);
      });
    });
  }

  function persistState(options = {}) {
    try {
      const preferences = JSON.stringify(personalRoadmapState(state));
      if (localStorage.getItem(PREFERENCES_KEY) !== preferences) localStorage.setItem(PREFERENCES_KEY, preferences);
      if (!canEditRoadmap()) return;
      const shared = JSON.stringify(sharedRoadmapState(state));
      if (options.forceShared || shared !== lastSharedSnapshot) {
        localStorage.setItem(STORAGE_KEY, shared);
        lastSharedSnapshot = shared;
        sharedStateNeedsSeed = false;
        sharedStateNeedsMigration = false;
      }
    } catch {
      showToast(state.language === "zh" ? "浏览器缓存空间不足，当前修改尚未同步" : "Browser storage is full; this change has not been synced");
    }
  }

  function applyAccessMode() {
    document.documentElement.dataset.roadmapAccess = ROADMAP_ACCESS;
    const editControls = [dom.weeklyEditButton, dom.editWeeklyButton, dom.drawerEditButton];
    const manageControls = [dom.addProductButton, dom.resetTestButton];
    editControls.forEach(control => { if (control) control.hidden = !canEditRoadmap(); });
    manageControls.forEach(control => { if (control) control.hidden = !canManageRoadmap(); });
  }

  function applyLanguage() {
    document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en-GB";
    dom.languageSelect.value = state.language;
    document.querySelectorAll("[data-copy]").forEach(element => {
      const value = COPY[state.language][element.dataset.copy];
      if (value) element.textContent = value;
    });
    document.querySelectorAll("[data-placeholder-zh]").forEach(element => {
      element.placeholder = state.language === "zh" ? element.dataset.placeholderZh : element.dataset.placeholderEn;
    });
  }

  function renderAll() {
    renderViewState();
    renderLineTabs();
    renderStatusFilters();
    renderProductOptions();
    renderVerticalMode();
    renderRoadmap();
    renderCardScale();
    renderWeeklyPanelState();
    renderWeeklyPanel();
    renderLedgerControls();
    renderUpdatesTable();
    renderVersions();
    renderArchiveTable();
    renderProductDrawer();
  }

  function renderViewState() {
    document.querySelectorAll(".view-button").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
    document.querySelectorAll(".view-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === state.view));
  }

  function setView(view) {
    if (!["roadmap", "updates", "history"].includes(view)) return;
    state.view = view;
    persistState();
    closeDrawers();
    renderAll();
  }

  function renderSummary() {
    const products = state.slides.flatMap(slide => slide.products || []);
    const updates = state.slides.flatMap(slide => currentSide(slide)?.productUpdates || []);
    dom.summaryTotal.textContent = String(products.length);
    dom.summaryNew.textContent = String(products.filter(product => product.status === "new").length);
    dom.summaryUpgrade.textContent = String(products.filter(product => product.status === "upgrade").length);
    dom.summaryEol.textContent = String(products.filter(product => product.status === "eol").length);
    dom.summaryUpdates.textContent = String(updates.length);
    const latest = state.slides.map(slide => currentSide(slide)?.weekKey).filter(Boolean).sort().at(-1) || "--";
    dom.summaryWeek.textContent = latest.replace("-", " ");
  }

  function renderLineTabs() {
    dom.lineTabs.innerHTML = state.slides.map(slide => `<button class="line-tab ${slide.id === state.activeLineId ? "active" : ""}" type="button" role="tab" data-line-id="${escapeAttr(slide.id)}">${escapeHtml(slide.label)}<b>${(slide.products || []).length}</b></button>`).join("");
    dom.lineTabs.querySelectorAll("[data-line-id]").forEach(button => button.addEventListener("click", () => {
      state.activeLineId = button.dataset.lineId;
      state.search = "";
      state.selectedProductId = "";
      dom.productSearch.value = "";
      persistState();
      renderAll();
    }));
  }

  function switchLine(offset) {
    const index = state.slides.findIndex(slide => slide.id === state.activeLineId);
    state.activeLineId = state.slides[(index + offset + state.slides.length) % state.slides.length].id;
    state.search = "";
    dom.productSearch.value = "";
    persistState();
    renderAll();
  }

  function renderStatusFilters() {
    dom.statusFilters.innerHTML = STATUS_ORDER.map(status => `<button class="filter-button ${state.statusFilter === status ? "active" : ""}" type="button" data-status="${status}">${STATUS_COPY[state.language][status]}</button>`).join("");
    dom.statusFilters.querySelectorAll("[data-status]").forEach(button => button.addEventListener("click", () => {
      state.statusFilter = button.dataset.status;
      persistState();
      renderRoadmap();
      renderCardScale();
    }));
  }

  function renderYears() {
    document.querySelectorAll(".year-button").forEach(button => button.classList.toggle("active", Number(button.dataset.year) === state.year));
  }

  function renderProductOptions() {
    const options = state.slides.flatMap(slide => (slide.products || []).map(product => ({ product, slide })));
    dom.productOptions.innerHTML = options.map(({ product }) => `<option value="${escapeAttr(productOptionValue(product))}"></option>`).join("");
  }

  function productOptionValue(product) {
    return product.masterId ? `${product.masterId} · ${product.name}` : product.name;
  }

  function productMatchesSearch(product, query) {
    const tokens = normaliseText(query).split(" ").filter(Boolean);
    if (!tokens.length) return true;
    const haystack = normaliseText([product.masterId, product.name, product.specs, product.ksp].join(" "));
    return tokens.every(token => haystack.includes(token));
  }

  function findProductSearchResult(query, exactOnly = false) {
    const normalisedQuery = normaliseText(query);
    if (!normalisedQuery) return null;
    const records = state.slides.flatMap(slide => (slide.products || []).map(product => ({ slide, product })));
    const exact = records.find(({ product }) => normaliseText(productOptionValue(product)) === normalisedQuery || normaliseText(product.masterId) === normalisedQuery);
    if (exact || exactOnly) return exact || null;
    return records.find(({ product }) => productMatchesSearch(product, query)) || null;
  }

  function renderRoadmap() {
    const slide = activeSlide();
    if (!slide) return;
    const previousScroll = dom.roadmapScroll.scrollLeft;
    const updatedIds = new Set((currentSide(slide)?.productUpdates || []).map(update => update.productId));
    const products = (slide.products || []).filter(product => {
      if (state.statusFilter === "updated" && !updatedIds.has(product.id)) return false;
      if (!["all", "updated"].includes(state.statusFilter) && product.status !== state.statusFilter) return false;
      if (!productMatchesSearch(product, state.search)) return false;
      return true;
    });

    const structureMode = state.verticalMode === "structure";
    dom.canvasTitle.textContent = structureMode
      ? `${slide.label} ${state.language === "zh" ? "产品结构" : "portfolio structure"}`
      : (slide.title || slide.label);
    const modeCopy = structureMode
      ? (state.language === "zh" ? "价格 × 时间结构矩阵" : "price × time structure matrix")
      : (state.language === "zh" ? "精确坐标" : "precise coordinates");
    dom.canvasMeta.textContent = state.language === "zh"
      ? `2024-2027 连续时间线 · ${products.length}/${(slide.products || []).length} 个节点 · ${modeCopy}`
      : `Continuous 2024-2027 timeline · ${products.length}/${(slide.products || []).length} items · ${modeCopy}`;
    dom.visibleCount.textContent = state.language === "zh" ? `当前显示 ${products.length} 个产品` : `${products.length} products visible`;
    const footerHint = document.querySelector(".canvas-footer span:first-child");
    if (footerHint) footerHint.textContent = structureMode
      ? (state.language === "zh" ? "横轴：目标上市时间　纵轴：价格层级　点击产品查看图片、参数、KSP与历史" : "X-axis: target launch · Y-axis: price tier · Select a product for images, specifications, KSP and history")
      : COPY[state.language].axisHint;

    if (structureMode) {
      dom.roadmapCanvas.style.minHeight = "0px";
      dom.roadmapCanvas.innerHTML = renderStructureMatrix(slide, products, updatedIds);
      bindRoadmapProductEvents();
      requestAnimationFrame(() => {
        dom.roadmapScroll.scrollLeft = 0;
        dom.roadmapScroll.scrollTop = 0;
      });
      return;
    }

    const bands = renderTimeBands();
    const grids = renderPriceGrid(slide);
    const relations = renderRelations(slide, products);
    const cards = products.map(product => renderProductCard(slide, product, updatedIds)).join("");
    dom.roadmapCanvas.innerHTML = `${bands}${grids}${relations}${cards || `<div class="canvas-empty">${state.language === "zh" ? "当前筛选没有产品" : "No products match the current filters"}</div>`}`;
    bindRoadmapProductEvents();
    requestAnimationFrame(() => {
      layoutProductCards();
      if (timelineInitialised) dom.roadmapScroll.scrollLeft = previousScroll;
      else {
        dom.roadmapScroll.scrollLeft = Math.max(0, dom.roadmapCanvas.scrollWidth * .43 - dom.roadmapScroll.clientWidth / 2);
        timelineInitialised = true;
      }
    });
  }

  function bindRoadmapProductEvents() {
    dom.roadmapCanvas.querySelectorAll("[data-product-id]").forEach(card => {
      card.addEventListener("click", event => {
        const imageButton = event.target.closest("[data-product-image]");
        if (imageButton) { openImageLightbox(imageButton.dataset.productImage, imageButton.dataset.imageCaption); return; }
        if (event.target.closest("[data-map-product]")) { openProductMapping(card.dataset.productId); return; }
        openProduct(card.dataset.productId);
      });
      card.addEventListener("keydown", event => {
        if (event.target !== card || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        openProduct(card.dataset.productId);
      });
    });
  }

  function renderStructureMatrix(slide, products, updatedIds) {
    if (!products.length) return `<div class="canvas-empty">${state.language === "zh" ? "当前筛选没有产品" : "No products match the current filters"}</div>`;
    const timeColumns = structureTimeColumns(products);
    const priceBands = structurePriceBands(slide, products);
    const currentKey = structureCurrentTimeKey();
    const marker = currentTimelineMarker().label;
    const relationIds = new Set((slide.connections || []).flatMap(relation => [relation.fromId, relation.toId]));
    const header = `<div class="structure-corner"><span>${state.language === "zh" ? "价格层级" : "Price tier"}</span><small>${state.language === "zh" ? "目标上市" : "Target launch"}</small></div>${timeColumns.map(key => `<div class="structure-time ${key === currentKey ? "current" : ""}"><strong>${escapeHtml(key === "TBD" ? (state.language === "zh" ? "日期待定" : "TBD") : key)}</strong>${key === currentKey ? `<span>${escapeHtml(marker)}</span>` : ""}</div>`).join("")}`;
    const rows = priceBands.map((band, bandIndex) => {
      const priceHeader = `<div class="structure-price"><strong>${escapeHtml(band.label)}</strong><span>${band.products.length}</span></div>`;
      const cells = timeColumns.map(timeKey => {
        const cellProducts = band.products
          .filter(product => structureProductTimeKey(product) === timeKey)
          .sort((a, b) => Number(b.plannedPrice || 0) - Number(a.plannedPrice || 0) || productTimeRaw(a) - productTimeRaw(b) || String(a.name).localeCompare(String(b.name)));
        const density = cellProducts.length >= 4 ? "very-dense" : cellProducts.length >= 3 ? "dense" : "";
        const nodes = cellProducts.map(product => renderStructureNode(product, updatedIds, relationIds)).join("");
        return `<div class="structure-cell ${timeKey === currentKey ? "current" : ""} ${density}" data-price-band="${bandIndex}" data-time-key="${escapeAttr(timeKey)}">${nodes}</div>`;
      }).join("");
      return `${priceHeader}${cells}`;
    }).join("");
    return `<div class="structure-matrix" style="--time-columns:${timeColumns.length};--price-rows:${priceBands.length}">${header}${rows}</div>`;
  }

  function renderStructureNode(product, updatedIds, relationIds) {
    const status = ["launched", "upgrade", "new", "eol"].includes(product.status) ? product.status : "new";
    const name = String(product.name || product.masterId || "--");
    const model = String(product.masterId || (state.language === "zh" ? "待映射" : "Unmapped"));
    const price = `€${formatPrice(product.plannedPrice)}`;
    const launch = String(product.launchDate || (state.language === "zh" ? "日期待定" : "Date TBD"));
    const relation = relationIds.has(product.id);
    const updated = updatedIds.has(product.id);
    const title = [name, model, price, launch, product.specs, product.ksp ? `KSP: ${product.ksp}` : ""].filter(Boolean).join(" · ");
    return `<button class="structure-node ${escapeAttr(status)} ${updated ? "is-updated" : ""} ${relation ? "has-relation" : ""}" type="button" data-product-id="${escapeAttr(product.id)}" title="${escapeAttr(title)}" aria-label="${escapeAttr(`${name} · ${model} · ${price} · ${launch}`)}"><strong>${escapeHtml(name)}</strong><span><b>${escapeHtml(model)}</b><em>${escapeHtml(price)}</em></span>${relation ? `<i aria-hidden="true">↗</i>` : ""}</button>`;
  }

  function structurePriceBands(slide, products) {
    const thresholds = STRUCTURE_PRICE_THRESHOLDS[slide.id] || [100, 80, 60, 40, 20];
    const rawBands = thresholds.map((lower, index) => ({ lower, upper: index === 0 ? Infinity : thresholds[index - 1], products: [] }));
    products.forEach(product => {
      const price = Number(product.plannedPrice || 0);
      const index = rawBands.findIndex((band, bandIndex) => price >= band.lower || bandIndex === rawBands.length - 1);
      rawBands[Math.max(0, index)].products.push(product);
    });
    return rawBands.filter(band => band.products.length).map((band, index, visibleBands) => {
      if (!Number.isFinite(band.upper)) return { ...band, label: `€${formatBandNumber(band.lower)}+` };
      const minimum = Math.min(...band.products.map(product => Number(product.plannedPrice || 0)));
      const lower = index === visibleBands.length - 1 && minimum < band.lower ? Math.floor(minimum) : band.lower;
      return { ...band, label: `€${formatBandNumber(lower)}–${formatBandNumber(Math.ceil(band.upper) - 1)}` };
    });
  }

  function formatBandNumber(value) {
    return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1);
  }

  function structureTimeColumns(products) {
    const labels = CONTINUOUS_TIMELINE.map(([label]) => label);
    const occupied = new Set(products.map(structureProductTimeKey));
    const currentIndex = Math.max(0, labels.indexOf(structureCurrentTimeKey()));
    const datedIndexes = [...occupied].filter(key => key !== "TBD").map(key => labels.indexOf(key)).filter(index => index >= 0);
    const endIndex = Math.max(labels.indexOf("2026 Q4"), currentIndex + 1, ...datedIndexes);
    const columns = labels.slice(0, Math.min(labels.indexOf("TBD"), endIndex) + 1);
    if (occupied.has("TBD")) columns.push("TBD");
    return columns;
  }

  function structureProductTimeKey(product) {
    const raw = productTimeRaw(product);
    return CONTINUOUS_TIMELINE.reduce((closest, entry) => Math.abs(entry[1] - raw) < Math.abs(closest[1] - raw) ? entry : closest, CONTINUOUS_TIMELINE[0])[0];
  }

  function structureCurrentTimeKey() {
    const today = new Date();
    const year = today.getFullYear();
    if (year < 2026) return String(year);
    if (year > 2027) return "2027 Q4";
    return `${year} Q${Math.floor(today.getMonth() / 3) + 1}`;
  }

  function renderTimeBands() {
    const leftEdge = 4.3;
    const marker = currentTimelineMarker();
    return CONTINUOUS_TIMELINE.map(([label, rawCenter], index) => {
      const rawLeft = index === 0 ? leftEdge : (CONTINUOUS_TIMELINE[index - 1][1] + rawCenter) / 2;
      const rawRight = index === CONTINUOUS_TIMELINE.length - 1 ? TIMELINE_RAW_END : (rawCenter + CONTINUOUS_TIMELINE[index + 1][1]) / 2;
      const current = label === "2026 Q3";
      const displayLabel = label === "TBD" ? (state.language === "zh" ? "日期待定" : "TBD") : label;
      return `<div class="time-band ${index % 2 ? "alternate" : ""} ${current ? "current" : ""} ${label === "TBD" ? "undated" : ""}" style="left:${timelineRawPercent(rawLeft)}%;width:${timelineRawPercent(rawRight - rawLeft)}%"></div><span class="axis-label time" style="left:${timelineRawPercent(rawCenter)}%">${displayLabel}</span>`;
    }).join("") + `<div class="axis-x"></div><div class="axis-y"></div><div class="now-marker" style="left:${timelineRawPercent(marker.raw)}%"><span>${escapeHtml(marker.label)}</span></div>`;
  }

  function renderPriceGrid(slide) {
    const labels = Array.isArray(slide.priceLabels) && slide.priceLabels.length ? slide.priceLabels : ["100+", "80", "60", "40", "20"];
    return `<span class="axis-unit">€</span>` + labels.map(label => {
      const top = Number(slide.priceY?.[label] ?? 20 + labels.indexOf(label) * 15);
      const price = Number(String(label).replace("+", ""));
      return `<span class="axis-label price" data-price-grid="${price}" style="top:${top}%">${escapeHtml(String(label))}</span><i class="horizontal-grid" data-price-grid="${price}" style="top:${top}%"></i>`;
    }).join("");
  }

  function renderRelations(slide, visibleProducts) {
    const ids = new Set(visibleProducts.map(product => product.id));
    const relations = (slide.connections || []).filter(relation => ids.has(relation.fromId) && ids.has(relation.toId));
    if (!relations.length) return "";
    const lines = relations.map(relation => {
      const from = productById(relation.fromId);
      const to = productById(relation.toId);
      const x1 = from ? timelineX(from) : timelineRawPercent(175.2);
      const x2 = to ? timelineX(to) : timelineRawPercent(175.2);
      const y1 = from ? priceToY(slide, from.plannedPrice) + 4 : 50;
      const y2 = to ? priceToY(slide, to.plannedPrice) + 4 : 50;
      return `<line data-relation-from="${escapeAttr(relation.fromId)}" data-relation-to="${escapeAttr(relation.toId)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeAttr(relation.color || "#8b98aa")}" stroke-width=".18" marker-end="url(#roadmapArrow)" />`;
    }).join("");
    return `<svg class="relations-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="roadmapArrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#8b98aa"></path></marker></defs>${lines}</svg>`;
  }

  function renderProductCard(slide, product, updatedIds) {
    const top = priceToY(slide, product.plannedPrice);
    const left = timelineX(product);
    const image = resolveImage(product.img);
    const mapped = product.masterId ? product.masterId : (state.language === "zh" ? "待映射" : "Unmapped");
    const searchMatch = state.search && normaliseText([product.name, product.masterId].join(" ")).includes(normaliseText(state.search));
    const specs = String(product.specs || "").replace(/\s*\n\s*/g, " · ");
    const ksp = String(product.ksp || "").replace(/\s*\n\s*/g, " · ");
    const mapLabel = product.masterId || (state.language === "zh" ? "映射 Master Data" : "Map Master Data");
    return `<article class="product-card ${escapeAttr(product.status || "new")} ${updatedIds.has(product.id) ? "is-updated" : ""} ${searchMatch ? "is-match" : ""}" role="button" tabindex="0" data-product-id="${escapeAttr(product.id)}" data-price="${Number(product.plannedPrice || 0)}" data-time-raw="${productTimeRaw(product)}" data-preferred-x="${left}" data-preferred-y="${top}" style="left:${left}%;top:${top}%" title="${escapeAttr(product.name)}"><button class="product-image" type="button" data-product-image="${escapeAttr(image)}" data-image-caption="${escapeAttr(product.name)}" aria-label="${escapeAttr(state.language === "zh" ? `查看 ${product.name} 大图` : `View ${product.name} image`)}">${image ? `<img src="${escapeAttr(image)}" alt="" style="${imageDisplayStyle(product)}">` : `<span>${escapeHtml(initials(product.name))}</span>`}</button><div class="product-copy"><strong>${escapeHtml(product.name)}</strong><small class="product-meta">${escapeHtml(product.launchDate || (state.language === "zh" ? "日期待定" : "Date TBD"))} · <em>€${formatPrice(product.plannedPrice)}</em></small><small class="product-specs" title="${escapeAttr(specs)}">${escapeHtml(specs || (state.language === "zh" ? "参数待补充" : "Specifications pending"))}</small><small class="product-ksp" title="${escapeAttr(ksp)}">KSP: ${escapeHtml(ksp || "--")}</small><button class="product-map-action ${product.masterId ? "mapped" : ""}" type="button" data-map-product title="${escapeAttr(state.language === "zh" ? "关联或更换 Master Data 产品" : "Link or change Master Data product")}">${escapeHtml(mapLabel)}</button></div></article>`;
  }

  function layoutProductCards() {
    if (state.view !== "roadmap") return;
    const canvas = dom.roadmapCanvas;
    const cards = [...canvas.querySelectorAll(".product-card")];
    if (!cards.length || !canvas.clientWidth || !dom.roadmapScroll.clientHeight) return;
    canvas.style.minHeight = "0px";
    const canvasWidth = canvas.clientWidth;
    const topBound = 25;
    const bottomPadding = 34;
    const leftBound = 52;
    const rightBound = canvasWidth - 12;
    const records = cards.map(card => ({
      card,
      width: card.offsetWidth,
      height: card.offsetHeight,
      price: Number(card.dataset.price || 0),
      time: Number(card.dataset.timeRaw || 0),
      anchorX: 0,
      centerX: 0,
      lane: 0
    }));
    records.forEach(record => {
      const rawCenter = canvasWidth * clamp(record.card.dataset.preferredX, 0, 100) / 100;
      record.anchorX = clamp(rawCenter, leftBound + record.width / 2, rightBound - record.width / 2);
      record.centerX = record.anchorX;
      record.left = record.centerX - record.width / 2;
      record.right = record.centerX + record.width / 2;
    });

    const grouped = new Map();
    records.forEach(record => {
      const key = record.price.toFixed(4);
      if (!grouped.has(key)) grouped.set(key, { price: record.price, records: [], laneCount: 0 });
      grouped.get(key).records.push(record);
    });
    const groups = [...grouped.values()].sort((a, b) => b.price - a.price);
    groups.forEach(group => {
      const laneRights = [];
      group.records.sort((a, b) => a.centerX - b.centerX || a.time - b.time).forEach(record => {
        let lane = laneRights.findIndex(right => record.left >= right + 4);
        if (lane < 0) lane = laneRights.length;
        laneRights[lane] = record.right;
        record.lane = lane;
      });
      group.laneCount = Math.max(1, laneRights.length);
    });

    const maxCardHeight = Math.max(...records.map(record => record.height));
    const laneStep = maxCardHeight + 5;
    const baseGap = 9;
    const groupsHeight = groups.reduce((sum, group) => sum + group.laneCount * laneStep, 0);
    const requiredHeight = topBound + bottomPadding + groupsHeight + Math.max(0, groups.length - 1) * baseGap;
    canvas.style.minHeight = `${Math.max(dom.roadmapScroll.clientHeight, requiredHeight)}px`;
    const canvasHeight = canvas.clientHeight;
    const availableExtra = Math.max(0, canvasHeight - requiredHeight);
    const totalPriceGap = groups.length > 1 ? groups[0].price - groups.at(-1).price : 0;
    const placements = new Map();
    const groupCenters = [];
    let cursor = topBound;
    groups.forEach((group, index) => {
      const groupHeight = group.laneCount * laneStep;
      group.records.forEach(record => {
        const top = cursor + record.lane * laneStep;
        record.card.style.left = `${record.centerX}px`;
        record.card.style.top = `${top}px`;
        placements.set(record.card.dataset.productId, { x: record.centerX, y: top + record.height / 2 });
      });
      groupCenters.push({ price: group.price, y: cursor + groupHeight / 2 });
      if (index < groups.length - 1) {
        const priceGap = Math.max(0, group.price - groups[index + 1].price);
        const weightedExtra = totalPriceGap > 0 ? availableExtra * priceGap / totalPriceGap : availableExtra / Math.max(1, groups.length - 1);
        cursor += groupHeight + baseGap + weightedExtra;
      }
    });
    updatePriceGrid(groupCenters);
    updateRelationLines(placements, canvasWidth, canvasHeight);
  }

  function updatePriceGrid(groupCenters) {
    if (!groupCenters.length) return;
    const sorted = [...groupCenters].sort((a, b) => b.price - a.price);
    const yForPrice = price => {
      if (price >= sorted[0].price) return sorted[0].y;
      if (price <= sorted.at(-1).price) return sorted.at(-1).y;
      for (let index = 0; index < sorted.length - 1; index += 1) {
        const upper = sorted[index];
        const lower = sorted[index + 1];
        if (price <= upper.price && price >= lower.price) {
          const progress = (upper.price - price) / Math.max(.01, upper.price - lower.price);
          return upper.y + (lower.y - upper.y) * progress;
        }
      }
      return sorted.at(-1).y;
    };
    dom.roadmapCanvas.querySelectorAll("[data-price-grid]").forEach(element => { element.style.top = `${yForPrice(Number(element.dataset.priceGrid))}px`; });
  }

  function updateRelationLines(placements, width, height) {
    dom.roadmapCanvas.querySelectorAll("[data-relation-from]").forEach(line => {
      const from = placements.get(line.dataset.relationFrom);
      const to = placements.get(line.dataset.relationTo);
      if (!from || !to) return;
      line.setAttribute("x1", from.x / width * 100);
      line.setAttribute("y1", from.y / height * 100);
      line.setAttribute("x2", to.x / width * 100);
      line.setAttribute("y2", to.y / height * 100);
    });
  }

  function timelineRawPercent(raw) {
    return clamp(Number(raw), 0, TIMELINE_RAW_END) / TIMELINE_RAW_END * 100;
  }

  function sourceTimelinePercent(value, year = 2026) {
    const raw = Number(value || 0) + (Number(year) === 2027 ? TIMELINE_2027_OFFSET : 0);
    return timelineRawPercent(raw);
  }

  function currentTimelineMarker() {
    const today = new Date();
    const year = today.getFullYear();
    if (year !== 2026 && year !== 2027) return { raw: SOURCE_TIME_AXES[2026]["2026 Q3"], label: "NOW" };
    const quarter = Math.floor(today.getMonth() / 3) + 1;
    const label = `${year} Q${quarter}`;
    const axis = SOURCE_TIME_AXES[year];
    const keys = Object.keys(axis);
    const entries = Object.values(axis);
    const index = Math.max(0, keys.indexOf(label));
    const center = entries[index];
    const left = index === 0 ? 4.3 : (entries[index - 1] + center) / 2;
    const right = index === entries.length - 1 ? 97.8 : (center + entries[index + 1]) / 2;
    const quarterStart = new Date(year, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(year, quarter * 3, 1);
    const progress = clamp((today - quarterStart) / Math.max(1, quarterEnd - quarterStart), 0, 1);
    const week = todayIsoWeek().key.split("-W").at(-1);
    return { raw: left + (right - left) * progress + (year === 2027 ? TIMELINE_2027_OFFSET : 0), label: `W${week} NOW` };
  }

  function timelineX(product) {
    return timelineRawPercent(productTimeRaw(product));
  }

  function productTimeRaw(product) {
    const text = String(product?.launchDate || product?.date || "").toUpperCase().replace(/\s+/g, " ");
    const yearFirstMatch = text.match(/(20(?:24|25|26|27))[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
    const monthFirstMatch = text.match(/(?:^|\D)(\d{1,2})[-/.](20(?:24|25|26|27))(?:\D|$)/);
    const yearMatch = text.match(/20(?:24|25|26|27)/);
    const year = Number(yearFirstMatch?.[1] || monthFirstMatch?.[2] || yearMatch?.[0]);
    if (!year) {
      const sourceX = Number(product?.x);
      if (Number.isFinite(sourceX)) return clamp(sourceX + (Number(product?.roadmapYear) === 2027 ? TIMELINE_2027_OFFSET : 0), 0, TIMELINE_RAW_END);
      return 175.2;
    }
    const month = Number(yearFirstMatch?.[2] || monthFirstMatch?.[1] || 0);
    const day = Number(yearFirstMatch?.[3] || 15);
    const quarter = month ? Math.floor((month - 1) / 3) + 1 : Number(text.match(/Q\s*([1-4])/)?.[1] || 0);
    if (year === 2024 || year === 2025) {
      const center = year === 2024 ? 10.8 : 27.4;
      const left = year === 2024 ? 4.3 : (10.8 + 27.4) / 2;
      const right = year === 2025 ? (27.4 + 44) / 2 : (10.8 + 27.4) / 2;
      if (month) {
        const start = Date.UTC(year, 0, 1);
        const end = Date.UTC(year + 1, 0, 1);
        const point = Date.UTC(year, clamp(month, 1, 12) - 1, clamp(day, 1, 31));
        return left + (right - left) * clamp((point - start) / (end - start), 0, 1);
      }
      if (quarter) return left + (right - left) * (quarter - .5) / 4;
      return center;
    }
    if (year === 2026 || year === 2027) {
      if (!quarter) return (SOURCE_TIME_AXES[year][`${year} Q2`] + SOURCE_TIME_AXES[year][`${year} Q3`]) / 2 + (year === 2027 ? TIMELINE_2027_OFFSET : 0);
      const resolvedQuarter = clamp(quarter, 1, 4);
      const axis = SOURCE_TIME_AXES[year];
      const offset = year === 2027 ? TIMELINE_2027_OFFSET : 0;
      const center = axis[`${year} Q${resolvedQuarter}`] + offset;
      if (!month) return center;
      const previousCenter = resolvedQuarter === 1
        ? (year === 2026 ? SOURCE_TIME_AXES[2026]["2025"] : SOURCE_TIME_AXES[2026]["2026 Q4"])
        : axis[`${year} Q${resolvedQuarter - 1}`] + offset;
      const nextCenter = resolvedQuarter === 4
        ? (year === 2027 ? 175.2 : SOURCE_TIME_AXES[2027]["2027 Q1"] + TIMELINE_2027_OFFSET)
        : axis[`${year} Q${resolvedQuarter + 1}`] + offset;
      const left = (previousCenter + center) / 2;
      const right = (center + nextCenter) / 2;
      const quarterStartMonth = (resolvedQuarter - 1) * 3;
      const start = Date.UTC(year, quarterStartMonth, 1);
      const end = Date.UTC(year, quarterStartMonth + 3, 1);
      const point = Date.UTC(year, clamp(month, 1, 12) - 1, clamp(day, 1, 31));
      return left + (right - left) * clamp((point - start) / (end - start), 0, 1);
    }
    return 175.2;
  }

  function locateSearchResult() {
    const query = dom.productSearch.value.trim();
    if (!query) return;
    const result = findProductSearchResult(query);
    if (!result) return;
    state.activeLineId = result.slide.id;
    state.view = "roadmap";
    state.statusFilter = "all";
    state.search = query;
    persistState();
    renderAll();
    requestAnimationFrame(() => {
      const card = dom.roadmapCanvas.querySelector(`[data-product-id="${cssEscape(result.product.id)}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      card?.focus({ preventScroll: true });
    });
  }

  function renderCardScale() {
    const percent = clamp(Number(state.cardScale) || 100, 80, 135);
    dom.cardScaleInput.max = "135";
    dom.cardScaleInput.value = String(percent);
    dom.cardScaleValue.value = `${percent}%`;
    dom.cardScaleValue.title = "";
    dom.roadmapCanvas.style.setProperty("--card-scale", String(percent / 100));
  }

  function renderVerticalMode() {
    const structure = state.verticalMode === "structure";
    dom.verticalModeSwitch.querySelectorAll("[data-vertical-mode]").forEach(button => {
      const active = button.dataset.verticalMode === state.verticalMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    dom.roadmapScroll.classList.toggle("structure-scroll", structure);
    dom.roadmapCanvas.classList.toggle("structure-mode", structure);
    dom.roadmapCanvas.classList.toggle("precise-mode", state.verticalMode === "precise");
    const scaleControl = dom.cardScaleInput.closest(".card-scale-control");
    if (scaleControl) scaleControl.hidden = structure;
    dom.roadmapScroll.title = structure
      ? (state.language === "zh" ? "价格 × 时间结构矩阵；点击产品查看完整详情" : "Price × time structure matrix; select a product for full details")
      : (state.language === "zh" ? "按精确价格和时间坐标显示；密集产品允许纵向滚动" : "Exact price and time coordinates; dense products may scroll vertically");
  }

  function setWeeklyPanelHidden(hidden) {
    state.weeklyPanelHidden = Boolean(hidden);
    if (hidden) weeklyEditing = false;
    persistState();
    renderWeeklyPanelState();
  }

  function renderWeeklyPanelState() {
    dom.roadmapLayout.classList.toggle("weekly-hidden", state.weeklyPanelHidden);
    dom.showWeeklyPanelButton.hidden = !state.weeklyPanelHidden;
    dom.hideWeeklyPanelButton.title = PANEL_COPY[state.weeklyLanguage].hide;
    dom.hideWeeklyPanelButton.setAttribute("aria-label", PANEL_COPY[state.weeklyLanguage].hide);
  }

  function bindTimelinePanning() {
    dom.roadmapScroll.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest(".product-card, button, input, textarea, select, a")) return;
      panState = { pointerId: event.pointerId, x: event.clientX, scrollLeft: dom.roadmapScroll.scrollLeft, moved: false };
      dom.roadmapScroll.setPointerCapture(event.pointerId);
      dom.roadmapScroll.classList.add("is-panning");
    });
    dom.roadmapScroll.addEventListener("pointermove", event => {
      if (!panState || panState.pointerId !== event.pointerId) return;
      const distance = event.clientX - panState.x;
      if (Math.abs(distance) > 3) panState.moved = true;
      dom.roadmapScroll.scrollLeft = panState.scrollLeft - distance;
    });
    const finish = event => {
      if (!panState || panState.pointerId !== event.pointerId) return;
      dom.roadmapScroll.classList.remove("is-panning");
      panState = null;
    };
    dom.roadmapScroll.addEventListener("pointerup", finish);
    dom.roadmapScroll.addEventListener("pointercancel", finish);
  }

  function flipWeeklyLanguage() {
    if (weeklyFlipping) return;
    weeklyFlipping = true;
    weeklyEditing = false;
    dom.weeklyPanel.classList.remove("flip-in");
    dom.weeklyPanel.classList.add("flip-out");
    window.setTimeout(() => {
      state.weeklyLanguage = state.weeklyLanguage === "zh" ? "en" : "zh";
      persistState();
      renderWeeklyPanel();
      dom.weeklyPanel.classList.remove("flip-out");
      dom.weeklyPanel.classList.add("flip-in");
      window.setTimeout(() => {
        dom.weeklyPanel.classList.remove("flip-in");
        weeklyFlipping = false;
      }, 210);
    }, 160);
  }

  function renderWeeklyPanel() {
    const slide = activeSlide();
    if (!slide) return;
    if (!canEditRoadmap()) weeklyEditing = false;
    const language = state.weeklyLanguage;
    const copy = PANEL_COPY[language];
    const side = slide.updates?.[language] || slide.updates?.zh || { productUpdates: [], archives: [] };
    const today = todayIsoWeek();
    dom.weeklyTitle.textContent = copy.title;
    dom.weeklyScope.textContent = slide.title || slide.label;
    dom.weeklyLanguageButton.textContent = copy.flipText;
    dom.weeklyLanguageButton.title = copy.flipTitle;
    dom.weeklyEditButton.textContent = copy.edit;
    dom.weeklyEditButton.hidden = !canEditRoadmap();
    dom.weeklyHistoryLabel.textContent = copy.history;
    dom.weeklyHistoryToggle.checked = state.weeklyHistoryVisible;
    dom.weeklyPeriod.textContent = formatWeeklyPeriod(side, language);
    dom.weeklyMeta.textContent = side.meta || "";
    dom.weeklyAutoDateLabel.textContent = copy.autoDate;
    dom.weeklyAutoDateValue.textContent = today.today;
    dom.weeklyAutoDateTag.textContent = copy.automatic;
    dom.weeklyMetaFieldLabel.textContent = copy.meta;
    dom.weeklyProductFormLabel.textContent = copy.productForm;
    dom.weeklySaveButton.textContent = copy.save;
    dom.weeklyCancelButton.textContent = copy.cancel;
    dom.weeklyTranslationStatus.hidden = true;
    if (language === "en" && side.autoTranslated) {
      dom.weeklyTranslationStatus.hidden = false;
      dom.weeklyTranslationStatus.dataset.state = "ready";
      dom.weeklyTranslationStatus.textContent = copy.translated;
    } else if (state.weeklyTranslationUnavailable && language === "zh") {
      dom.weeklyTranslationStatus.hidden = false;
      dom.weeklyTranslationStatus.dataset.state = "error";
      dom.weeklyTranslationStatus.textContent = copy.unavailable;
    }
    dom.weeklyUpdatesDisplay.hidden = weeklyEditing;
    dom.weeklyInlineForm.hidden = !weeklyEditing;
    if (weeklyEditing) renderWeeklyEditor(slide, side, copy, today);
    else renderWeeklyDisplay(slide, side, copy);
  }

  function renderWeeklyDisplay(slide, side, copy) {
    const currentGroups = [...groupWeeklyUpdates(side.productUpdates || []).values()];
    const archived = (side.archives || []).filter(record => record.weekKey !== side.weekKey);
    dom.weeklyUpdatesDisplay.innerHTML = `<p class="weekly-section-label">${escapeHtml(copy.focus)}</p>${currentGroups.length ? currentGroups.map(group => renderWeeklyGroup(group, true)).join("") : `<p class="weekly-empty">${escapeHtml(copy.noUpdate)}</p>`}<div class="weekly-history ${state.weeklyHistoryVisible ? "show" : ""}"><p class="weekly-section-label">${escapeHtml(copy.historyTitle)}</p>${archived.length ? archived.map(record => renderWeeklyArchive(record, copy)).join("") : `<p class="weekly-empty">${escapeHtml(copy.noHistory)}</p>`}</div>`;
  }

  function renderWeeklyEditor(slide, side, copy, today) {
    const sameWeek = side.weekKey === today.key;
    const archivedCurrent = (side.archives || []).find(record => record.weekKey === today.key);
    const sourceUpdates = sameWeek ? side.productUpdates || [] : archivedCurrent?.productUpdates || [];
    const byProduct = groupWeeklyUpdates(sourceUpdates);
    dom.weeklyInlineForm.elements.meta.value = sameWeek ? side.meta || "" : archivedCurrent?.meta || "";
    dom.weeklyProductFields.innerHTML = (slide.products || []).map(product => {
      const entries = [...(byProduct.get(product.id)?.entries || [])];
      if (!entries.some(entry => entry.date === today.today)) entries.push({ productId: product.id, productName: product.name, status: product.status, date: today.today, text: "", images: [] });
      return `<article class="weekly-product-editor" data-weekly-product-editor data-status="${escapeAttr(product.status)}"><strong>${escapeHtml(product.name)}</strong>${entries.sort((a, b) => String(a.date).localeCompare(String(b.date))).map(entry => renderWeeklyEditorEntry(product, entry, copy, today.today)).join("")}</article>`;
    }).join("");
    updateInlineWeeklyCount();
  }

  function renderWeeklyEditorEntry(product, entry, copy, today) {
    const date = String(entry.date || today);
    const images = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
    return `<div class="weekly-product-entry" data-weekly-entry><div class="weekly-entry-head"><strong>${escapeHtml(date)}</strong><span>${escapeHtml(date === today ? copy.today : copy.savedDay)}</span></div><textarea data-inline-weekly-product="${escapeAttr(product.id)}" data-update-date="${escapeAttr(date)}" placeholder="${escapeAttr(copy.placeholder)}">${escapeHtml(entry.text || "")}</textarea><div class="weekly-image-dropzone" data-weekly-dropzone><span>${escapeHtml(copy.dropPhoto)}</span><label class="weekly-image-add">+ ${escapeHtml(copy.addPhoto)}<input data-weekly-image-upload type="file" accept="image/*" multiple></label></div><div class="weekly-image-list" data-weekly-image-list>${images.map(image => renderWeeklyImageThumb(image)).join("")}</div></div>`;
  }

  function renderWeeklyImageThumb(image) {
    return `<div class="weekly-image-thumb" data-weekly-image-thumb><input data-weekly-image-value type="hidden" value="${escapeAttr(image)}"><img src="${escapeAttr(resolveImage(image))}" alt=""><button class="weekly-image-remove" data-remove-weekly-image type="button" aria-label="删除图片">×</button></div>`;
  }

  function renderWeeklyGroup(group, current) {
    const link = current ? ` data-current-update-product="${escapeAttr(group.productId)}" role="button" tabindex="0"` : "";
    return `<article class="weekly-product-update" data-status="${escapeAttr(group.status || "new")}"${link}><div class="weekly-product-name"><i aria-hidden="true"></i><strong>${escapeHtml(group.productName || group.productId)}</strong></div>${group.entries.map(entry => `<div class="weekly-update-entry"><time datetime="${escapeAttr(entry.date || "")}">${escapeHtml(entry.date || "")}</time>${entry.text ? `<p>${escapeHtml(entry.text)}</p>` : ""}${renderWeeklyImages(entry.images, group.productName)}</div>`).join("")}</article>`;
  }

  function renderWeeklyImages(images, productName) {
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    return list.length ? `<div class="weekly-update-images">${list.map((image, index) => `<button class="weekly-update-image" type="button" data-open-weekly-image="${escapeAttr(resolveImage(image))}" aria-label="${escapeAttr(`${productName} ${index + 1}`)}"><img src="${escapeAttr(resolveImage(image))}" alt=""></button>`).join("")}</div>` : "";
  }

  function openImageLightbox(source, caption = "") {
    const image = resolveImage(source);
    if (!image) return;
    dom.imageLightboxImage.src = image;
    dom.imageLightboxImage.alt = caption || (state.language === "zh" ? "产品大图" : "Product image");
    dom.imageLightboxCaption.textContent = caption || "";
    dom.imageLightbox.showModal();
  }

  function renderWeeklyArchive(record, copy) {
    const groups = [...groupWeeklyUpdates(record.productUpdates || []).values()];
    const deleteControl = canManageRoadmap() ? `<button class="weekly-history-delete" data-delete-weekly-history="${escapeAttr(record.weekKey || "")}" type="button" title="${escapeAttr(copy.deleteHistory)}">×</button>` : "";
    return `<section class="weekly-history-week"><div class="weekly-history-head"><strong>${escapeHtml(formatWeeklyPeriod(record, state.weeklyLanguage))}</strong><div class="weekly-history-actions"><span>${escapeHtml(record.meta || copy.archived)}</span>${deleteControl}</div></div>${groups.map(group => renderWeeklyGroup(group, false)).join("")}</section>`;
  }

  function groupWeeklyUpdates(updates) {
    const groups = new Map();
    (updates || []).forEach(update => {
      const key = update.productId || update.productName;
      if (!groups.has(key)) groups.set(key, { productId: update.productId, productName: update.productName, status: update.status, entries: [] });
      groups.get(key).entries.push(update);
    });
    groups.forEach(group => group.entries.sort((a, b) => String(a.date).localeCompare(String(b.date))));
    return groups;
  }

  function formatWeeklyPeriod(side, language) {
    const weekKey = String(side?.weekKey || "--").replace("-", " ");
    const range = side?.weekStart && side?.weekEnd ? `${side.weekStart} - ${side.weekEnd}` : side?.week || "";
    return language === "zh" ? `${weekKey}${range ? ` · ${range}` : ""}` : `${weekKey}${range ? ` · ${range}` : ""}`;
  }

  function handleWeeklyDisplayClick(event) {
    const imageButton = event.target.closest("[data-open-weekly-image]");
    if (imageButton) { openImageLightbox(imageButton.dataset.openWeeklyImage, imageButton.getAttribute("aria-label")); return; }
    const deleteButton = event.target.closest("[data-delete-weekly-history]");
    if (deleteButton) {
      if (!canManageRoadmap()) return showAccessDenied();
      const copy = PANEL_COPY[state.weeklyLanguage];
      const key = deleteButton.dataset.deleteWeeklyHistory;
      if (!window.confirm(`${copy.confirmDeleteHistory}\n${key.replace("-", " ")}`)) return;
      Object.values(activeSlide().updates || {}).forEach(side => { side.archives = (side.archives || []).filter(record => record.weekKey !== key); });
      persistState();
      renderWeeklyPanel();
      showToast(copy.historyDeleted);
      return;
    }
    const update = event.target.closest("[data-current-update-product]");
    if (!update) return;
    const card = dom.roadmapCanvas.querySelector(`[data-product-id="${cssEscape(update.dataset.currentUpdateProduct)}"]`);
    if (!card) return;
    dom.roadmapCanvas.querySelectorAll(".product-card").forEach(item => item.classList.toggle("is-match", item === card));
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    card.focus({ preventScroll: true });
  }

  function updateInlineWeeklyCount() {
    const editors = [...dom.weeklyProductFields.querySelectorAll("[data-weekly-product-editor]")];
    const filled = editors.filter(editor => [...editor.querySelectorAll("[data-weekly-entry]")].some(entry => entry.querySelector("textarea")?.value.trim() || entry.querySelector("[data-weekly-image-value]"))).length;
    const copy = PANEL_COPY[state.weeklyLanguage];
    dom.weeklyProductCount.textContent = state.weeklyLanguage === "zh" ? `${filled}/${editors.length}${copy.filled}` : `${filled}/${editors.length} ${copy.filled}`;
  }

  function handleInlineWeeklyClick(event) {
    const remove = event.target.closest("[data-remove-weekly-image]");
    if (!remove) return;
    remove.closest("[data-weekly-image-thumb]")?.remove();
    updateInlineWeeklyCount();
  }

  async function handleInlineWeeklyChange(event) {
    const input = event.target.closest("[data-weekly-image-upload]");
    if (!input?.files?.length) return;
    await appendWeeklyFiles(input.closest("[data-weekly-entry]"), [...input.files]);
    input.value = "";
  }

  async function handleInlineWeeklyPaste(event) {
    const entry = event.target.closest("[data-weekly-entry]");
    const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith("image/"));
    if (!entry || !files.length) return;
    event.preventDefault();
    await appendWeeklyFiles(entry, files);
  }

  async function handleInlineWeeklyDrop(event) {
    const entry = event.target.closest("[data-weekly-entry]");
    const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith("image/"));
    if (!entry || !files.length) return;
    event.preventDefault();
    await appendWeeklyFiles(entry, files);
  }

  async function appendWeeklyFiles(entry, files) {
    const list = entry?.querySelector("[data-weekly-image-list]");
    if (!list) return;
    try {
      const values = await Promise.all(files.map(optimiseProductImage));
      list.insertAdjacentHTML("beforeend", values.filter(Boolean).map(renderWeeklyImageThumb).join(""));
      updateInlineWeeklyCount();
    } catch (error) {
      showToast(error.message || String(error));
    }
  }

  function fileToDataUrl(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  async function saveInlineWeeklyUpdates(event) {
    event.preventDefault();
    if (!canEditRoadmap()) return showAccessDenied();
    const slide = activeSlide();
    const language = state.weeklyLanguage;
    const side = slide.updates[language];
    const week = todayIsoWeek();
    const updates = [...dom.weeklyProductFields.querySelectorAll("[data-weekly-entry]")].map(entry => {
      const field = entry.querySelector("[data-inline-weekly-product]");
      const product = productById(field?.dataset.inlineWeeklyProduct);
      const text = field?.value.trim() || "";
      const images = [...entry.querySelectorAll("[data-weekly-image-value]")].map(input => input.value).filter(Boolean);
      return product && (text || images.length) ? { productId: product.id, productName: product.name, status: product.status, date: field.dataset.updateDate || week.today, text, images } : null;
    }).filter(Boolean);
    if (!updates.length && side.weekKey !== week.key) {
      weeklyEditing = false;
      renderWeeklyPanel();
      showToast(language === "zh" ? "未填写本周产品更新，继续显示最近已保存周" : "No update entered; the latest saved week remains visible");
      return;
    }
    side.week = week.today;
    side.weekKey = week.key;
    side.weekStart = week.start;
    side.weekEnd = week.end;
    side.meta = String(dom.weeklyInlineForm.elements.meta.value || "").trim();
    side.productUpdates = updates.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    side.archives ||= [];
    const record = { week: week.today, date: week.today, weekKey: week.key, weekStart: week.start, weekEnd: week.end, meta: side.meta, productUpdates: structuredCloneSafe(side.productUpdates) };
    const existing = side.archives.findIndex(item => item.weekKey === week.key);
    if (existing >= 0) side.archives[existing] = record; else side.archives.unshift(record);
    weeklyEditing = false;
    addVersion({ titleZh: `保存 ${slide.label} ${week.key} 周更新`, titleEn: `Saved ${slide.label} ${week.key} weekly update`, changes: [{ fieldZh: "周度更新", fieldEn: "Weekly update", detailZh: `${updates.length} 个产品有更新并自动归档`, detailEn: `${updates.length} products updated and auto-archived` }] });
    persistState();
    renderAll();
    showToast(language === "zh" ? "中文周度更新已保存并自动归档" : "English revision saved and archived");
    if (language === "zh") await translateWeeklyToEnglish(slide);
  }

  async function translateWeeklyToEnglish(slide) {
    const source = slide.updates.zh;
    if (!source || !(source.meta || source.productUpdates?.some(update => update.text))) return;
    if (typeof window.Translator?.create !== "function") { state.weeklyTranslationUnavailable = true; persistState(); renderWeeklyPanel(); return; }
    try {
      const translator = await window.Translator.create({ sourceLanguage: "zh", targetLanguage: "en" });
      const target = slide.updates.en;
      target.week = source.week; target.weekKey = source.weekKey; target.weekStart = source.weekStart; target.weekEnd = source.weekEnd;
      target.meta = source.meta ? String(await translator.translate(source.meta)).trim() : "";
      target.productUpdates = [];
      for (const update of source.productUpdates || []) target.productUpdates.push({ ...update, text: update.text ? String(await translator.translate(update.text)).trim() : "", images: [...(update.images || [])] });
      target.autoTranslated = true;
      target.archives ||= [];
      const record = { week: target.week, date: target.week, weekKey: target.weekKey, weekStart: target.weekStart, weekEnd: target.weekEnd, meta: target.meta, productUpdates: structuredCloneSafe(target.productUpdates) };
      const index = target.archives.findIndex(item => item.weekKey === target.weekKey);
      if (index >= 0) target.archives[index] = record; else target.archives.unshift(record);
      state.weeklyTranslationUnavailable = false;
      persistState();
      renderWeeklyPanel();
    } catch {
      state.weeklyTranslationUnavailable = true;
      persistState();
      renderWeeklyPanel();
    }
  }

  function renderDrawerUpdates() {
    const slide = activeSlide();
    if (!slide) return;
    const side = currentSide(slide);
    const updates = side?.productUpdates || [];
    dom.drawerCount.textContent = String(updates.length);
    dom.drawerScope.textContent = `${slide.label} · ${(side?.weekKey || "--").replace("-", " ")}`;
    dom.updatesDrawerContent.innerHTML = updates.length ? updates.map(update => `<article class="update-item ${escapeAttr(update.status || "new")}"><div class="update-item-head"><strong>${escapeHtml(update.productName || productById(update.productId)?.name || "Product")}</strong><time>${escapeHtml(update.date || side.week || "")}</time></div><p>${escapeHtml(update.text || (state.language === "zh" ? "仅图片更新" : "Image-only update"))}</p></article>`).join("") : `<div class="drawer-empty">${state.language === "zh" ? "本周尚无产品更新" : "No product updates this week"}</div>`;
  }

  function renderLedgerControls() {
    const archives = flattenArchives(state.language);
    const weeks = [...new Set(archives.map(entry => entry.record.weekKey).filter(Boolean))].sort().reverse();
    const currentWeek = currentSide(activeSlide())?.weekKey;
    if (currentWeek && !weeks.includes(currentWeek)) weeks.unshift(currentWeek);
    const selectedWeek = dom.ledgerWeek.value;
    dom.ledgerWeek.innerHTML = `<option value="all">${state.language === "zh" ? "全部周次" : "All weeks"}</option>${weeks.map(week => `<option value="${escapeAttr(week)}">${escapeHtml(week.replace("-", " "))}</option>`).join("")}`;
    if (["all", ...weeks].includes(selectedWeek)) dom.ledgerWeek.value = selectedWeek;
    const selectedStatus = dom.ledgerStatus.value;
    dom.ledgerStatus.innerHTML = `<option value="all">${STATUS_COPY[state.language].all}</option>${["launched", "upgrade", "new", "eol"].map(status => `<option value="${status}">${STATUS_COPY[state.language][status]}</option>`).join("")}`;
    if (["all", "launched", "upgrade", "new", "eol"].includes(selectedStatus)) dom.ledgerStatus.value = selectedStatus;
  }

  function renderUpdatesTable() {
    if (!state) return;
    const week = dom.ledgerWeek.value || "all";
    const status = dom.ledgerStatus.value || "all";
    const rows = flattenArchives(state.language).flatMap(entry => (entry.record.productUpdates || []).map(update => ({ ...entry, update }))).filter(row => (week === "all" || row.record.weekKey === week) && (status === "all" || row.update.status === status));
    dom.ledgerResultCount.textContent = state.language === "zh" ? `${rows.length} 条更新` : `${rows.length} updates`;
    const heads = state.language === "zh" ? ["周次", "产品线", "产品 / 型号", "状态", "记录日期", "更新内容"] : ["Week", "Product line", "Product / model", "Status", "Record date", "Update"];
    dom.updatesTable.innerHTML = `<colgroup><col style="width:11%"><col style="width:15%"><col style="width:20%"><col style="width:11%"><col style="width:11%"><col></colgroup><thead><tr>${heads.map(head => `<th>${head}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => { const product = productById(row.update.productId); return `<tr><td><strong>${escapeHtml((row.record.weekKey || "--").replace("-", " "))}</strong></td><td>${escapeHtml(row.slide.label)}</td><td><strong>${escapeHtml(row.update.productName || product?.name || "Product")}</strong><span>${escapeHtml(product?.masterId || (state.language === "zh" ? "待映射" : "Unmapped"))}</span></td><td><span class="status-tag ${escapeAttr(row.update.status || "new")}">${STATUS_COPY[state.language][row.update.status] || row.update.status}</span></td><td>${escapeHtml(row.update.date || row.record.date || "--")}</td><td>${escapeHtml(row.update.text || "--")}</td></tr>`; }).join("") : `<tr><td class="table-empty" colspan="6">${state.language === "zh" ? "当前筛选没有历史更新" : "No historical updates match the filters"}</td></tr>`}</tbody>`;
  }

  function renderVersions() {
    const versions = [...state.versions].sort((a, b) => b.number - a.number);
    if (!state.selectedVersionId || !versions.some(version => version.id === state.selectedVersionId)) state.selectedVersionId = versions[0]?.id || "";
    dom.versionList.innerHTML = versions.map(version => `<button class="version-button ${version.id === state.selectedVersionId ? "active" : ""}" type="button" data-version-id="${escapeAttr(version.id)}"><strong>v${version.number} · ${escapeHtml(state.language === "zh" ? version.titleZh : version.titleEn)}</strong><span>${escapeHtml(formatDateTime(version.createdAt))}</span><small>${escapeHtml(version.actor || "System")}</small></button>`).join("");
    dom.versionList.querySelectorAll("[data-version-id]").forEach(button => button.addEventListener("click", () => { state.selectedVersionId = button.dataset.versionId; renderVersions(); }));
    const version = versions.find(item => item.id === state.selectedVersionId);
    renderVersionDetail(version);
  }

  function renderVersionDetail(version) {
    if (!version) { dom.versionDetail.innerHTML = ""; return; }
    const snapshot = version.snapshot || { total: 0, statuses: {}, mapped: 0, updates: 0 };
    const changes = version.changes || [];
    const canRestore = canManageRoadmap() && version.id !== state.versions.at(-1)?.id;
    dom.versionDetail.innerHTML = `<div class="section-heading compact-heading"><div><h3>v${version.number} · ${escapeHtml(state.language === "zh" ? version.titleZh : version.titleEn)}</h3><span>${escapeHtml(formatDateTime(version.createdAt))} · ${escapeHtml(version.actor || "System")}</span></div>${canRestore ? `<button class="button" type="button" data-restore-version="${escapeAttr(version.id)}">${state.language === "zh" ? "以此版本创建恢复草稿" : "Create restoration draft"}</button>` : ""}</div><div class="version-metrics"><div><span>${state.language === "zh" ? "产品节点" : "Items"}</span><strong>${snapshot.total || 0}</strong></div><div><span>${state.language === "zh" ? "新品 / 升级" : "New / upgrade"}</span><strong>${(snapshot.statuses?.new || 0) + (snapshot.statuses?.upgrade || 0)}</strong></div><div><span>${state.language === "zh" ? "已映射 Master Data" : "Master Data mapped"}</span><strong>${snapshot.mapped || 0}</strong></div><div><span>${state.language === "zh" ? "历史更新" : "Archived updates"}</span><strong>${snapshot.updates || 0}</strong></div></div><div class="change-list">${changes.length ? changes.map(change => `<div class="change-row"><span>${escapeHtml(state.language === "zh" ? change.fieldZh : change.fieldEn)}</span><strong>${escapeHtml(state.language === "zh" ? change.detailZh : change.detailEn)}</strong></div>`).join("") : `<div class="change-row"><span>${state.language === "zh" ? "版本说明" : "Version note"}</span><strong>${state.language === "zh" ? "没有字段级变化说明" : "No field-level change note"}</strong></div>`}</div>`;
    dom.versionDetail.querySelector("[data-restore-version]")?.addEventListener("click", event => restoreVersion(event.currentTarget.dataset.restoreVersion));
  }

  function restoreVersion(versionId) {
    if (!canManageRoadmap()) return showAccessDenied();
    const version = state.versions.find(item => item.id === versionId);
    if (!version?.snapshot?.items) return;
    const message = state.language === "zh" ? "恢复会生成一个新的团队版本，不会覆盖历史或源文件。继续？" : "Restoration creates a new team version and never overwrites history or the source. Continue?";
    if (!window.confirm(message)) return;
    const snapshotMap = new Map(version.snapshot.items.map(item => [item.id, item]));
    state.slides.forEach(slide => {
      slide.products = slide.products.map(product => snapshotMap.has(product.id) ? { ...product, ...snapshotMap.get(product.id) } : product);
    });
    addVersion({
      titleZh: `从 v${version.number} 创建恢复草稿`, titleEn: `Restoration draft from v${version.number}`,
      changes: [{ fieldZh: "恢复来源", fieldEn: "Restoration source", detailZh: `保留历史并以 v${version.number} 内容创建新版本`, detailEn: `Preserved history and created a new version from v${version.number}` }]
    });
    persistState();
    renderAll();
    showToast(state.language === "zh" ? "恢复草稿已生成，历史版本保持不变" : "Restoration draft created; history remains unchanged");
  }

  function renderArchiveTable() {
    const rows = ["zh", "en"].flatMap(language => flattenArchives(language).map(entry => ({ ...entry, language })));
    const heads = state.language === "zh" ? ["语言", "周次", "产品线", "记录日期", "产品更新", "来源"] : ["Language", "Week", "Product line", "Record date", "Product updates", "Source"];
    dom.archiveTable.innerHTML = `<colgroup><col style="width:10%"><col style="width:14%"><col style="width:23%"><col style="width:15%"><col style="width:16%"><col></colgroup><thead><tr>${heads.map(head => `<th>${head}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr><td><strong>${row.language === "zh" ? "中文" : "English"}</strong></td><td>${escapeHtml((row.record.weekKey || "--").replace("-", " "))}</td><td>${escapeHtml(row.slide.label)}</td><td>${escapeHtml(row.record.date || row.record.week || "--")}</td><td>${(row.record.productUpdates || []).length}</td><td><span>${state.language === "zh" ? "原 Roadmap 只读归档" : "Read-only source Roadmap archive"}</span></td></tr>`).join("")}</tbody>`;
  }

  function openDrawer(type) {
    closeDrawers();
    const drawer = type === "product" ? dom.productDrawer : dom.updatesDrawer;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    dom.drawerBackdrop.hidden = false;
  }

  function closeDrawers() {
    [dom.updatesDrawer, dom.productDrawer].forEach(drawer => { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); });
    dom.drawerBackdrop.hidden = true;
  }

  function openProduct(productId) {
    state.selectedProductId = productId;
    state.productTab = "overview";
    productEditing = false;
    focusProductMaster = false;
    renderProductDrawer();
    openDrawer("product");
  }

  function openProductMapping(productId) {
    if (!canEditRoadmap()) return showAccessDenied();
    state.selectedProductId = productId;
    state.productTab = "overview";
    productEditing = true;
    focusProductMaster = true;
    renderProductDrawer();
    openDrawer("product");
    requestAnimationFrame(() => {
      const input = dom.productDrawerContent.querySelector("[name='masterMapping']");
      input?.focus();
      input?.select();
    });
  }

  function renderProductDrawer() {
    document.querySelectorAll(".drawer-tab").forEach(button => button.classList.toggle("active", button.dataset.productTab === state.productTab));
    const product = productById(state.selectedProductId);
    if (!product) { dom.productDrawerContent.innerHTML = ""; return; }
    const slide = slideForProduct(product.id);
    dom.productDrawerLine.textContent = slide?.label || "PRODUCT";
    dom.productDrawerTitle.textContent = product.name;
    dom.productDrawerSubtitle.textContent = `${product.masterId || (state.language === "zh" ? "待映射 Master Data" : "Master Data mapping pending")} · ${STATUS_COPY[state.language][product.status] || product.status}`;
    if (state.productTab === "overview") renderProductOverview(product, slide);
    if (state.productTab === "project") renderProductProject(product);
    if (state.productTab === "changes") renderProductChanges(product);
  }

  function renderProductOverview(product, slide) {
    const image = resolveImage(product.img);
    const master = masterData.find(item => item.code === product.masterId);
    const masterValue = master ? `${master.code} · ${master.name}` : "";
    const mappingLabel = masterValue || (state.language === "zh" ? "未关联 Master Data" : "Not linked to Master Data");
    const heroImage = image
      ? `<button class="product-hero-image" type="button" data-open-product-image="${escapeAttr(image)}" aria-label="${escapeAttr(state.language === "zh" ? `查看 ${product.name} 大图` : `View ${product.name} image`)}"><img src="${escapeAttr(image)}" alt="" style="${imageDisplayStyle(product)}"></button>`
      : `<div class="product-hero-image product-hero-placeholder">${escapeHtml(initials(product.name))}</div>`;
    const overview = `<div class="product-overview-read"><div class="overview-facts"><div><span>${state.language === "zh" ? "产品线" : "Product line"}</span><strong>${escapeHtml(slide?.label || "--")}</strong></div><div><span>${state.language === "zh" ? "目标上市" : "Target launch"}</span><strong>${escapeHtml(product.launchDate || (state.language === "zh" ? "日期待定" : "Date TBD"))}</strong></div><div><span>${state.language === "zh" ? "规划 RRP" : "Planned RRP"}</span><strong>€${formatPrice(product.plannedPrice)}</strong></div><div><span>Master Data</span><strong>${escapeHtml(mappingLabel)}</strong></div></div><div class="overview-copy-grid"><section><span>${state.language === "zh" ? "产品参数" : "Specifications"}</span><p>${escapeHtml(product.specs || "--")}</p></section><section><span>KSP</span><p>${escapeHtml(product.ksp || "--")}</p></section></div></div>`;
    if (productEditing && productImageDraft.productId !== product.id) productImageDraft = { productId: product.id, value: product.img || "" };
    const fitOptions = [["contain", state.language === "zh" ? "完整显示" : "Fit"], ["cover", state.language === "zh" ? "填满裁切" : "Fill"], ["scale-down", state.language === "zh" ? "原始尺寸" : "Natural"]];
    const positionOptions = [["center", state.language === "zh" ? "居中" : "Centre"], ["top", state.language === "zh" ? "靠上" : "Top"], ["bottom", state.language === "zh" ? "靠下" : "Bottom"], ["left", state.language === "zh" ? "靠左" : "Left"], ["right", state.language === "zh" ? "靠右" : "Right"]];
    const editPreview = resolveImage(productImageDraft.value);
    const form = `<form class="detail-form compact" id="productEditForm"><label class="field full"><span>${state.language === "zh" ? "关联 Master Data 产品" : "Linked Master Data product"}</span><span class="master-combobox"><input name="masterMapping" value="${escapeAttr(masterValue)}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="productMasterResults" placeholder="${escapeAttr(state.language === "zh" ? `输入或展开选择，当前共 ${masterData.length} 个产品` : `Type or open the list of ${masterData.length} products`)}"><button class="master-combobox-toggle" type="button" data-product-master-toggle aria-label="${escapeAttr(state.language === "zh" ? "展开 Master Data 产品" : "Open Master Data products")}">⌄</button><span class="master-combobox-results" id="productMasterResults" role="listbox" hidden></span></span><small>${state.language === "zh" ? "点击输入框即可浏览完整目录；输入型号、名称或品类可筛选，留空可取消映射。" : "Select the field to browse the full catalog; filter by model, name or category, or clear to unlink."}</small></label><label class="field full"><span>${state.language === "zh" ? "Roadmap 产品名称" : "Roadmap product name"}</span><input name="name" value="${escapeAttr(product.name || "")}" required></label><label class="field"><span>${COPY[state.language].lifecycle}</span><select name="status">${["launched", "upgrade", "new", "eol"].map(status => `<option value="${status}" ${product.status === status ? "selected" : ""}>${STATUS_COPY[state.language][status]}</option>`).join("")}</select></label><label class="field"><span>${COPY[state.language].targetLaunch}</span><input name="launchDate" value="${escapeAttr(product.launchDate || "")}" placeholder="2027 Q1 / 2027-03-15"></label><label class="field"><span>${COPY[state.language].rrp}</span><input name="price" type="number" min="0" step="0.01" value="${Number(product.plannedPrice || 0)}"></label><label class="field span-3"><span>${state.language === "zh" ? "产品参数" : "Specifications"}</span><textarea name="specs" rows="3">${escapeHtml(product.specs || "")}</textarea></label><label class="field span-3"><span>KSP</span><textarea name="ksp" rows="3">${escapeHtml(product.ksp || "")}</textarea></label><section class="product-image-editor span-3"><div class="product-image-editor-head"><strong>${state.language === "zh" ? "产品图片" : "Product image"}</strong><span>${state.language === "zh" ? "支持上传替换并调整卡片内显示" : "Upload, replace and tune the card image"}</span></div><div class="product-image-editor-body"><button class="product-image-preview ${editPreview ? "" : "empty"}" type="button" data-edit-image-preview aria-label="${escapeAttr(state.language === "zh" ? "查看当前图片" : "View current image")}">${editPreview ? `<img src="${escapeAttr(editPreview)}" alt="" style="${imageDisplayStyle(product)}">` : `<span>${escapeHtml(initials(product.name))}</span>`}</button><div class="product-image-controls"><div class="product-image-actions"><button class="button" type="button" data-upload-product-image>${state.language === "zh" ? "上传 / 替换" : "Upload / replace"}</button><button class="icon-button subtle" type="button" data-remove-product-image aria-label="${escapeAttr(state.language === "zh" ? "移除图片" : "Remove image")}" title="${escapeAttr(state.language === "zh" ? "移除图片" : "Remove image")}">×</button><input type="file" data-product-image-file accept="image/png,image/jpeg,image/webp" hidden></div><label class="field compact-image-path"><span>${state.language === "zh" ? "图片地址或本地路径" : "Image URL or local path"}</span><input name="imagePath" value="${escapeAttr(/^data:/i.test(productImageDraft.value) ? "" : productImageDraft.value)}" placeholder="https://... / product-images/image1.png"></label><div class="image-display-controls"><label class="field"><span>${state.language === "zh" ? "适配方式" : "Fit"}</span><select name="imageFit">${fitOptions.map(([value, label]) => `<option value="${value}" ${product.imageFit === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="field"><span>${state.language === "zh" ? "焦点位置" : "Focus"}</span><select name="imagePosition">${positionOptions.map(([value, label]) => `<option value="${value}" ${product.imagePosition === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="field image-scale-field"><span>${state.language === "zh" ? "缩放" : "Scale"} <output data-image-scale-output>${product.imageScale}%</output></span><input name="imageScale" type="range" min="70" max="140" step="5" value="${product.imageScale}"></label></div><small>${state.language === "zh" ? "上传图片会压缩后保存到团队 Roadmap；推荐使用透明或白底产品图。" : "Uploads are compressed and saved to the team Roadmap; transparent or white-background product images work best."}</small></div></div></section><div class="drawer-edit-actions full"><button class="button" type="button" data-cancel-product-edit>${state.language === "zh" ? "取消" : "Cancel"}</button><button class="button primary" type="submit">${state.language === "zh" ? "保存并生成版本" : "Save and create version"}</button></div></form>`;
    const editActions = canEditRoadmap()
      ? `<div class="product-hero-actions"><button class="button" type="button" data-map-roadmap-product>${master ? (state.language === "zh" ? "更换映射" : "Change mapping") : (state.language === "zh" ? "关联 Master Data" : "Link Master Data")}</button><button class="button primary" type="button" data-edit-roadmap-product>${state.language === "zh" ? "编辑" : "Edit"}</button>${canManageRoadmap() ? `<button class="button danger" type="button" data-delete-roadmap-product>${state.language === "zh" ? "删除" : "Delete"}</button>` : ""}</div>`
      : `<span class="read-only-note">${state.language === "zh" ? "只读" : "View only"}</span>`;
    dom.productDrawerContent.innerHTML = `<div class="product-hero compact">${heroImage}<div class="product-hero-copy"><div class="product-hero-title"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(mappingLabel)}</span></div><span class="status-tag ${escapeAttr(product.status)}">${STATUS_COPY[state.language][product.status]}</span></div>${editActions}</div></div>${productEditing && canEditRoadmap() ? form : overview}`;
    dom.productDrawerContent.querySelector("[data-open-product-image]")?.addEventListener("click", event => openImageLightbox(event.currentTarget.dataset.openProductImage, product.name));
    dom.productDrawerContent.querySelector("[data-map-roadmap-product]")?.addEventListener("click", () => {
      productEditing = true;
      focusProductMaster = true;
      renderProductOverview(product, slide);
    });
    dom.productDrawerContent.querySelector("[data-edit-roadmap-product]")?.addEventListener("click", () => {
      productEditing = true;
      focusProductMaster = false;
      renderProductOverview(product, slide);
    });
    dom.productDrawerContent.querySelector("[data-delete-roadmap-product]")?.addEventListener("click", () => deleteRoadmapProduct(product.id));
    const editForm = dom.productDrawerContent.querySelector("#productEditForm");
    if (editForm) {
      editForm.addEventListener("submit", event => saveProductEdit(event, product));
      bindMasterCombobox(editForm.querySelector("[name='masterMapping']"), editForm.querySelector("#productMasterResults"), editForm.querySelector("[data-product-master-toggle]"));
      bindProductImageEditor(editForm, product);
      editForm.querySelector("[data-cancel-product-edit]").addEventListener("click", () => { productEditing = false; focusProductMaster = false; productImageDraft = { productId: "", value: "" }; renderProductOverview(product, slide); });
      requestAnimationFrame(() => {
        const input = editForm.querySelector(focusProductMaster ? "[name='masterMapping']" : "[name='name']");
        input?.focus();
        if (focusProductMaster) input?.select();
      });
    }
  }

  function deleteRoadmapProduct(productId) {
    if (!canManageRoadmap()) return showAccessDenied();
    const slide = slideForProduct(productId);
    const product = productById(productId);
    if (!slide || !product) return;
    const message = state.language === "zh"
      ? `确认从 Roadmap 删除“${product.name}”？\n\n该操作会生成新版本，但不会删除 Master Data、项目跟进数据或历史周报。`
      : `Remove “${product.name}” from the Roadmap?\n\nThis creates a new version and does not delete Master Data, Project Tracking data or archived weekly updates.`;
    if (!window.confirm(message)) return;

    slide.products = (slide.products || []).filter(item => item.id !== productId);
    slide.connections = (slide.connections || []).filter(connection => connection.fromId !== productId && connection.toId !== productId);
    Object.values(slide.updates || {}).forEach(side => {
      side.productUpdates = (side.productUpdates || []).filter(update => update.productId !== productId);
    });
    Object.values(state.weeklyDrafts || {}).forEach(draft => { delete draft[productId]; });
    state.selectedProductId = "";
    state.search = "";
    dom.productSearch.value = "";
    productEditing = false;
    focusProductMaster = false;
    productImageDraft = { productId: "", value: "" };
    addVersion({
      titleZh: `删除 ${product.name}`,
      titleEn: `Removed ${product.name}`,
      changes: [{
        fieldZh: "删除 Roadmap 产品",
        fieldEn: "Removed Roadmap product",
        detailZh: `${product.masterId || "未映射"} · 已从 ${slide.label} 移除；Master Data、项目跟进及历史周报保留`,
        detailEn: `${product.masterId || "Unmapped"} · Removed from ${slide.label}; Master Data, Project Tracking and archived weekly updates retained`,
        productId
      }]
    });
    persistState();
    closeDrawers();
    renderAll();
    showToast(state.language === "zh" ? "产品已从 Roadmap 删除并生成新版本" : "Product removed from the Roadmap and a new version was created");
  }

  function saveProductEdit(event, product) {
    event.preventDefault();
    if (!canEditRoadmap()) return showAccessDenied();
    const form = new FormData(event.currentTarget);
    const mappingText = String(form.get("masterMapping") || "").trim();
    const master = mappingText ? masterFromSelection(mappingText) : null;
    if (mappingText && !master) {
      showToast(state.language === "zh" ? "请从 Master Data 下拉选项中选择产品" : "Select a product from the Master Data options");
      event.currentTarget.querySelector("[name='masterMapping']")?.focus();
      return;
    }
    const conflict = master && state.slides.flatMap(item => item.products || []).find(item => item.id !== product.id && item.masterId === master.code);
    if (conflict) {
      showToast(state.language === "zh" ? `${master.code} 已关联到 ${conflict.name}` : `${master.code} is already linked to ${conflict.name}`);
      return;
    }
    const before = { name: product.name || "", status: product.status, launchDate: product.launchDate || "", price: Number(product.plannedPrice || 0), specs: product.specs || "", ksp: product.ksp || "", image: product.img || "", imageFit: product.imageFit, imagePosition: product.imagePosition, imageScale: product.imageScale, masterId: product.masterId || "", projectId: product.projectId || "" };
    product.name = String(form.get("name") || "").trim() || product.name;
    product.masterId = master?.code || "";
    product.projectId = master?.project || "";
    product.status = String(form.get("status"));
    product.launchDate = String(form.get("launchDate") || "").trim();
    product.plannedPrice = Math.max(0, Number(form.get("price") || 0));
    product.specs = String(form.get("specs") || "").trim();
    product.ksp = String(form.get("ksp") || "").trim();
    const imagePath = String(form.get("imagePath") || "").trim();
    if (imagePath) productImageDraft.value = imagePath;
    product.img = productImageDraft.productId === product.id ? productImageDraft.value : product.img;
    product.imageFit = ["contain", "cover", "scale-down"].includes(String(form.get("imageFit"))) ? String(form.get("imageFit")) : "contain";
    product.imagePosition = ["center", "top", "bottom", "left", "right"].includes(String(form.get("imagePosition"))) ? String(form.get("imagePosition")) : "center";
    product.imageScale = clamp(Number(form.get("imageScale")) || 100, 70, 140);
    product.roadmapYear = inferRoadmapYear(product);
    product.x = launchToX(product.launchDate, product.roadmapYear);
    product.y = priceToY(slideForProduct(product.id), product.plannedPrice);
    const details = [
      before.name !== product.name ? `${before.name} → ${product.name}` : "",
      before.status !== product.status ? `${STATUS_COPY[state.language][before.status]} → ${STATUS_COPY[state.language][product.status]}` : "",
      before.launchDate !== product.launchDate ? `${before.launchDate || "--"} → ${product.launchDate || "--"}` : "",
      before.price !== product.plannedPrice ? `€${formatPrice(before.price)} → €${formatPrice(product.plannedPrice)}` : "",
      before.specs !== product.specs ? (state.language === "zh" ? "产品信息已更新" : "Product information updated") : "",
      before.ksp !== product.ksp ? "KSP updated" : "",
      before.image !== product.img ? (state.language === "zh" ? "产品图片已更新" : "Product image updated") : "",
      before.imageFit !== product.imageFit || before.imagePosition !== product.imagePosition || before.imageScale !== product.imageScale ? (state.language === "zh" ? "图片显示效果已调整" : "Image display adjusted") : "",
      before.masterId !== product.masterId ? `${state.language === "zh" ? "Master Data 映射" : "Master Data mapping"}: ${before.masterId || "--"} → ${product.masterId || "--"}` : ""
    ].filter(Boolean).join(" · ") || (state.language === "zh" ? "更新产品说明" : "Updated product description");
    addVersion({
      titleZh: `更新 ${product.name}`, titleEn: `Updated ${product.name}`,
      changes: [{ fieldZh: "Roadmap 产品字段", fieldEn: "Roadmap product fields", detailZh: details, detailEn: details, productId: product.id }]
    });
    persistState();
    productEditing = false;
    focusProductMaster = false;
    productImageDraft = { productId: "", value: "" };
    renderAll();
    openDrawer("product");
    showToast(state.language === "zh" ? "产品更新已保存并同步团队版本" : "Product update saved and synced to the team version");
  }

  function renderProductProject(product) {
    const linked = Boolean(product.projectId);
    const stage = product.status === "eol" ? (state.language === "zh" ? "历史项目" : "Historical") : product.status === "launched" ? (state.language === "zh" ? "上市收尾" : "Launch closeout") : (state.language === "zh" ? "规划 / 项目准备" : "Planning / project setup");
    dom.productDrawerContent.innerHTML = `<div class="detail-grid"><div><span>${state.language === "zh" ? "项目编号" : "Project ID"}</span><strong>${escapeHtml(product.projectId || "--")}</strong></div><div><span>${state.language === "zh" ? "当前阶段" : "Current stage"}</span><strong>${stage}</strong></div><div><span>${state.language === "zh" ? "Roadmap 目标" : "Roadmap target"}</span><strong>${escapeHtml(product.launchDate || "--")}</strong></div><div><span>${state.language === "zh" ? "项目当前日期" : "Current project date"}</span><strong>${linked ? escapeHtml(product.launchDate || "--") : "--"}</strong></div></div><div class="detail-section"><h3>${state.language === "zh" ? "连接规则" : "Connection rule"}</h3><p>${state.language === "zh" ? "Roadmap 目标日期与项目执行日期分开保存。日期差异会提示复核，不会静默覆盖项目时间线。" : "Roadmap targets and project execution dates are stored separately. Variance prompts review and never silently overwrites the project timeline."}</p></div><div class="detail-actions"><button class="button ${linked ? "" : "primary"}" type="button" data-project-link>${linked ? (state.language === "zh" ? "查看项目跟进" : "Open Project Tracking") : (state.language === "zh" ? "创建关联项目草稿" : "Create linked project draft")}</button></div>`;
    dom.productDrawerContent.querySelector("[data-project-link]").addEventListener("click", () => showToast(linked ? (state.language === "zh" ? `将打开项目跟进并定位 ${product.projectId}` : `Would open Project Tracking at ${product.projectId}`) : (state.language === "zh" ? "关联项目草稿已创建，待进入项目跟进确认" : "Linked project draft created for confirmation in Project Tracking")));
  }

  function renderProductChanges(product) {
    const versionChanges = state.versions.flatMap(version => (version.changes || []).filter(change => change.productId === product.id).map(change => ({ date: version.createdAt, title: state.language === "zh" ? change.fieldZh : change.fieldEn, detail: state.language === "zh" ? change.detailZh : change.detailEn, version: version.number })));
    const archiveChanges = ["zh", "en"].flatMap(language => flattenArchives(language).flatMap(entry => (entry.record.productUpdates || []).filter(update => update.productId === product.id).map(update => ({ date: update.date || entry.record.date, title: `${language === "zh" ? "中文周报" : "English weekly"} · ${entry.record.weekKey}`, detail: update.text, version: "" }))));
    const rows = [...versionChanges, ...archiveChanges].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    dom.productDrawerContent.innerHTML = rows.length ? rows.map(row => `<article class="update-item ${escapeAttr(product.status)}"><div class="update-item-head"><strong>${escapeHtml(row.title)}</strong><time>${escapeHtml(formatDateTime(row.date))}${row.version ? ` · v${row.version}` : ""}</time></div><p>${escapeHtml(row.detail || "--")}</p></article>`).join("") : `<div class="drawer-empty">${state.language === "zh" ? "暂无产品变更记录" : "No product change records"}</div>`;
  }

  function openProductModal() {
    if (!canManageRoadmap()) return showAccessDenied();
    dom.productForm.reset();
    dom.productLineSelect.innerHTML = state.slides.map(slide => `<option value="${escapeAttr(slide.id)}" ${slide.id === state.activeLineId ? "selected" : ""}>${escapeHtml(slide.label)}</option>`).join("");
    dom.newProductStatus.innerHTML = ["new", "upgrade", "launched", "eol"].map(status => `<option value="${status}">${STATUS_COPY[state.language][status]}</option>`).join("");
    dom.masterProductInput.value = "";
    dom.masterProductResults.hidden = true;
    dom.masterProductInput.setAttribute("aria-expanded", "false");
    renderMasterPreview();
    dom.productModal.showModal();
  }

  function renderMasterPreview() {
    const master = selectedMasterRecord();
    dom.masterPreview.innerHTML = master ? `<div><strong>${escapeHtml(master.code)} · ${escapeHtml(master.name)}</strong><span>${escapeHtml(master.category)} · ${escapeHtml(state.slides.find(slide => slide.id === master.line)?.label || master.line)}</span></div>` : `<span>${COPY[state?.language || "zh"].selectMasterData}</span>`;
    if (master) dom.productLineSelect.value = master.line;
  }

  function saveNewProduct(event) {
    event.preventDefault();
    if (!canManageRoadmap()) return showAccessDenied();
    const master = selectedMasterRecord();
    if (!master) { showToast(state.language === "zh" ? "请从 Master Data 下拉选项中选择产品" : "Select a product from the Master Data options"); return; }
    if (state.slides.some(slide => slide.products.some(product => product.masterId === master.code))) { showToast(state.language === "zh" ? "该 Master Data 产品已存在于 Roadmap" : "This Master Data product already exists in the Roadmap"); return; }
    const form = new FormData(dom.productForm);
    const slide = state.slides.find(item => item.id === form.get("lineId")) || activeSlide();
    const status = String(form.get("status") || "new");
    const launchDate = String(form.get("launchDate") || "").trim();
    const price = Math.max(0, Number(form.get("price") || 0));
    const product = {
      id: uniqueProductId(master.code), type: "product", masterId: master.code, projectId: master.project, name: master.name,
      status, img: master.image, imageFit: "contain", imagePosition: "center", imageScale: 100, specs: master.category, ksp: String(form.get("ksp") || "").trim(), launchDate, date: launchDate,
      roadmapYear: /2027/.test(launchDate) ? 2027 : state.year, plannedPrice: price, x: launchToX(launchDate, state.year), y: priceToY(slide, price), w: 13, h: 9
    };
    slide.products.push(product);
    state.activeLineId = slide.id;
    state.year = product.roadmapYear;
    addVersion({
      titleZh: `新增 ${product.name}`, titleEn: `Added ${product.name}`,
      changes: [{ fieldZh: "新增 Roadmap 产品", fieldEn: "New Roadmap item", detailZh: `${master.code} · ${master.name} · ${STATUS_COPY.zh[status]}`, detailEn: `${master.code} · ${master.name} · ${STATUS_COPY.en[status]}`, productId: product.id }]
    });
    persistState();
    dom.productModal.close();
    renderAll();
    openProduct(product.id);
    showToast(state.language === "zh" ? "产品已加入团队 Roadmap" : "Product added to the team Roadmap");
  }

  function selectedMasterRecord() {
    return masterFromSelection(dom.masterProductInput.value);
  }

  function openWeeklyModal() {
    if (!canEditRoadmap()) return showAccessDenied();
    const slide = activeSlide();
    const side = currentSide(slide);
    const current = new Map((side?.productUpdates || []).map(update => [update.productId, update.text || ""]));
    const draftKey = weeklyDraftKey(slide.id);
    const draft = state.weeklyDrafts[draftKey] || {};
    dom.weeklyFormScope.textContent = `${slide.label} · ${todayIsoWeek().key.replace("-", " ")}`;
    dom.weeklyEditor.innerHTML = (slide.products || []).filter(product => inferRoadmapYear(product) === state.year).map(product => `<label class="weekly-entry"><span><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.masterId || (state.language === "zh" ? "待映射" : "Unmapped"))} · ${STATUS_COPY[state.language][product.status]}</span></span><textarea data-weekly-product="${escapeAttr(product.id)}" placeholder="${state.language === "zh" ? "本周变化、风险或下一步；无变化可留空" : "Change, risk or next step; leave blank when unchanged"}">${escapeHtml(draft[product.id] ?? current.get(product.id) ?? "")}</textarea></label>`).join("");
    dom.weeklyModal.showModal();
  }

  function autosaveWeeklyDraft() {
    if (!canEditRoadmap()) return;
    const key = weeklyDraftKey(activeSlide().id);
    state.weeklyDrafts[key] = Object.fromEntries([...dom.weeklyEditor.querySelectorAll("[data-weekly-product]")].map(field => [field.dataset.weeklyProduct, field.value]));
    persistState();
  }

  function saveWeeklyUpdates(event) {
    event.preventDefault();
    if (!canEditRoadmap()) return showAccessDenied();
    const slide = activeSlide();
    const side = currentSide(slide);
    const week = todayIsoWeek();
    const updates = [...dom.weeklyEditor.querySelectorAll("[data-weekly-product]")].map(field => {
      const product = productById(field.dataset.weeklyProduct);
      const text = field.value.trim();
      return product && text ? { productId: product.id, productName: product.name, status: product.status, date: week.today, text, images: [] } : null;
    }).filter(Boolean);
    side.week = week.today;
    side.weekKey = week.key;
    side.weekStart = week.start;
    side.weekEnd = week.end;
    side.productUpdates = updates;
    side.archives ||= [];
    const record = { week: week.today, date: week.today, weekKey: week.key, weekStart: week.start, weekEnd: week.end, meta: side.meta || "", productUpdates: structuredCloneSafe(updates) };
    const existing = side.archives.findIndex(item => item.weekKey === week.key);
    if (existing >= 0) side.archives[existing] = record; else side.archives.unshift(record);
    delete state.weeklyDrafts[weeklyDraftKey(slide.id)];
    addVersion({
      titleZh: `保存 ${slide.label} ${week.key} 周更新`, titleEn: `Saved ${slide.label} ${week.key} weekly update`,
      changes: [{ fieldZh: "周度更新", fieldEn: "Weekly update", detailZh: `${updates.length} 个产品有更新，已生成不可覆盖版本`, detailEn: `${updates.length} products updated; an immutable version was created` }]
    });
    persistState();
    dom.weeklyModal.close();
    renderAll();
    showToast(state.language === "zh" ? "周度更新已保存并生成团队版本" : "Weekly updates saved and a team version was created");
  }

  function addVersion(input) {
    state.versions.push(createVersionRecord(state, {
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      actor: "Ivy · Local Test",
      titleZh: input.titleZh,
      titleEn: input.titleEn,
      changes: input.changes || []
    }));
    state.selectedVersionId = state.versions.at(-1).id;
  }

  function createVersionRecord(sourceState, input) {
    const products = sourceState.slides.flatMap(slide => slide.products || []);
    const statuses = Object.fromEntries(["launched", "upgrade", "new", "eol"].map(status => [status, products.filter(product => product.status === status).length]));
    const archivedUpdates = ["zh", "en"].reduce((sum, language) => sum + sourceState.slides.reduce((lineSum, slide) => lineSum + ((slide.updates?.[language]?.archives || []).reduce((count, record) => count + (record.productUpdates || []).length, 0)), 0), 0);
    return {
      id: input.id,
      number: (sourceState.versions?.length || 0) + 1,
      createdAt: input.createdAt,
      actor: input.actor,
      titleZh: input.titleZh,
      titleEn: input.titleEn,
      changes: input.changes || [],
      snapshot: {
        total: products.length,
        statuses,
        mapped: products.filter(product => product.masterId).length,
        updates: archivedUpdates,
        items: sourceState.slides.flatMap(slide => (slide.products || []).map(product => ({ slideId: slide.id, id: product.id, name: product.name, status: product.status, launchDate: product.launchDate || "", plannedPrice: Number(product.plannedPrice || 0), ksp: product.ksp || "", masterId: product.masterId || "", projectId: product.projectId || "", roadmapYear: inferRoadmapYear(product), x: product.x, y: product.y })))
      }
    };
  }

  function activeSlide() { return state.slides.find(slide => slide.id === state.activeLineId) || state.slides[0]; }
  function currentSide(slide) { return slide?.updates?.[state.language] || slide?.updates?.zh || { productUpdates: [], archives: [] }; }
  function productById(productId) { return state.slides.flatMap(slide => slide.products || []).find(product => product.id === productId); }
  function slideForProduct(productId) { return state.slides.find(slide => (slide.products || []).some(product => product.id === productId)); }
  function weeklyDraftKey(slideId) { return `${slideId}:${state.language}:${state.year}`; }

  function flattenArchives(language) {
    return state.slides.flatMap(slide => (slide.updates?.[language]?.archives || []).map(record => ({ slide, record })));
  }

  function inferRoadmapYear(product) {
    if (/2027/i.test(String(product.launchDate || product.date || ""))) return 2027;
    return Number(product.roadmapYear) === 2027 ? 2027 : 2026;
  }

  function inferProductPrice(slide, product) {
    if (Number.isFinite(Number(product.plannedPrice))) return Number(product.plannedPrice);
    const pairs = Object.entries(slide.priceY || {}).map(([label, y]) => ({ label, y: Number(y) }));
    const nearest = pairs.sort((a, b) => Math.abs(a.y - Number(product.y || 50)) - Math.abs(b.y - Number(product.y || 50)))[0];
    const numeric = Number(String(nearest?.label || "").replace("+", ""));
    return Number.isFinite(numeric) ? numeric : 49.99;
  }

  function priceToY(slide, price) {
    const pairs = Object.entries(slide?.priceY || {}).map(([label, y]) => ({ price: Number(String(label).replace("+", "")), y: Number(y) })).filter(item => Number.isFinite(item.price) && Number.isFinite(item.y)).sort((a, b) => a.price - b.price);
    if (!pairs.length) return 50;
    const value = Number(price);
    if (!Number.isFinite(value)) return 50;
    const interpolate = (lower, upper) => lower.y + (upper.y - lower.y) * ((value - lower.price) / Math.max(.01, upper.price - lower.price));
    if (value < pairs[0].price) {
      const floorY = 92;
      const distance = pairs[0].price - value;
      return floorY - (floorY - pairs[0].y) / (1 + distance / 20);
    }
    if (value > pairs.at(-1).price) {
      const ceilingY = 4;
      const distance = value - pairs.at(-1).price;
      return ceilingY + (pairs.at(-1).y - ceilingY) / (1 + distance / 20);
    }
    for (let index = 0; index < pairs.length - 1; index += 1) {
      if (value >= pairs[index].price && value <= pairs[index + 1].price) return clamp(interpolate(pairs[index], pairs[index + 1]), 8, 88);
    }
    return 50;
  }

  function launchToX(value, year) {
    const text = String(value || "").toUpperCase();
    const quarter = Number(text.match(/Q([1-4])/)?.[1] || 3);
    const axis = SOURCE_TIME_AXES[Number(year) === 2027 ? 2027 : 2026];
    if (Number(year) === 2027) return axis[`2027 Q${quarter}`];
    if (/2024/.test(text)) return axis["2024"];
    if (/2025/.test(text)) return axis["2025"];
    return axis[`2026 Q${quarter}`];
  }

  function findMasterMatch(product) {
    const source = normaliseText(String(product.name || "").replace(/\(EOL\)/gi, ""));
    const exact = findExactMasterMatch(product);
    if (exact) return exact;
    return [...masterData].sort((a, b) => b.name.length - a.name.length).find(item => {
      const target = normaliseText(item.name);
      return source === target || source.includes(target) || target.includes(source) || (source.includes("magpro neo 10k") && item.code === "PX51") || (source.includes("magpro slim 10k q2.2") && item.code === "PM61-B") || (source.includes("magpro 3-in-1 station") && item.code === "WM321") || (source.includes("leopard fold charger 100w") && item.code === "WAL101");
    });
  }

  function findExactMasterMatch(product) {
    const source = normaliseText(String(product?.name || "").replace(/\(EOL\)/gi, ""));
    return masterData.find(item => normaliseText(item.name) === source) || null;
  }

  function masterFromSelection(value) {
    const query = normaliseText(value);
    return masterData.find(item => {
      const display = normaliseText(`${item.code} · ${item.name}`);
      return query === display || query === normaliseText(item.code) || query === normaliseText(item.name);
    }) || null;
  }

  function normaliseMasterCatalog(products) {
    if (!Array.isArray(products) || !products.length) return [...MASTER_DATA_FALLBACK];
    const fallbackByCode = new Map(MASTER_DATA_FALLBACK.map(item => [item.code, item]));
    return products.map(record => {
      const code = String(record.sku || record.code || record.id || "").trim();
      const name = String(record.name || code).trim();
      const category = normaliseMasterCategory(record.category);
      const legacyCode = Object.entries(LEGACY_MASTER_ALIASES).find(([, currentCode]) => currentCode === code)?.[0];
      const fallback = fallbackByCode.get(code) || fallbackByCode.get(legacyCode);
      return {
        code,
        name,
        category,
        lifecycleStatus: String(record.lifecycleStatus || "UNLAUNCHED"),
        line: fallback?.line || inferMasterLine(category, name),
        image: fallback?.image || "",
        project: fallback?.project || ""
      };
    }).filter(item => item.code && item.name).sort((a, b) => a.code.localeCompare(b.code));
  }

  function normaliseMasterCategory(value) {
    const category = normaliseText(value);
    if (["cable", "charging cable", "充电线"].includes(category)) return "充电线";
    if (["charger", "充头", "充电器"].includes(category)) return "充头";
    if (["wireless charger", "无线充", "无线充电器"].includes(category)) return "无线充";
    if (["power bank", "powerbank", "移动电源"].includes(category)) return "移动电源";
    return String(value || "未分类").trim();
  }

  function inferMasterLine(category, name) {
    if (category === "充电线") return "cable";
    if (category === "无线充") return "wireless";
    if (category === "充头") return "charger";
    return /magpro/i.test(name) ? "magpro-pb" : "pocket-leopard";
  }

  function bindMasterCombobox(input, results, toggle, onSelect) {
    if (!input || !results) return;
    const open = showAll => renderMasterComboboxResults(input, results, showAll, onSelect);
    input.addEventListener("focus", () => open(true));
    input.addEventListener("input", () => { input.dataset.masterCode = ""; open(false); onSelect?.(); });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") { results.hidden = true; input.setAttribute("aria-expanded", "false"); }
      if (event.key === "ArrowDown" && !results.hidden) { event.preventDefault(); results.querySelector("button")?.focus(); }
    });
    input.addEventListener("blur", () => window.setTimeout(() => {
      if (!results.contains(document.activeElement)) {
        results.hidden = true;
        input.setAttribute("aria-expanded", "false");
      }
    }, 100));
    toggle?.addEventListener("click", () => results.hidden ? open(true) : closeMasterCombobox(input, results));
  }

  function renderMasterComboboxResults(input, results, showAll, onSelect) {
    const query = showAll ? "" : normaliseText(input.value);
    const matches = masterData.filter(item => !query || normaliseText(`${item.code} ${item.name} ${item.category} ${item.lifecycleStatus}`).includes(query));
    const lifecycleCopy = { LAUNCHED: state?.language === "en" ? "Launched" : "已上市", UNLAUNCHED: state?.language === "en" ? "Unlaunched" : "未上市", EOL: "EOL" };
    results.innerHTML = `<span class="master-combobox-summary">${state?.language === "en" ? `${matches.length} of ${masterData.length} products` : `${matches.length} / ${masterData.length} 个产品`}</span>${matches.length ? matches.map(item => `<button type="button" role="option" data-master-option="${escapeAttr(item.code)}"><strong>${escapeHtml(item.code)} · ${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(lifecycleCopy[item.lifecycleStatus] || item.lifecycleStatus)}</small></button>`).join("") : `<span class="master-combobox-empty">${state?.language === "en" ? "No matching Master Data product" : "没有匹配的 Master Data 产品"}</span>`}`;
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    results.querySelectorAll("[data-master-option]").forEach(button => button.addEventListener("click", () => {
      const item = masterData.find(record => record.code === button.dataset.masterOption);
      if (!item) return;
      input.value = selectedMasterName(item);
      input.dataset.masterCode = item.code;
      closeMasterCombobox(input, results);
      onSelect?.(item);
      input.focus();
    }));
    results.querySelectorAll("button").forEach(button => button.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") { event.preventDefault(); (button.nextElementSibling?.matches("button") ? button.nextElementSibling : results.querySelector("button"))?.focus(); }
      if (event.key === "ArrowUp") { event.preventDefault(); (button.previousElementSibling?.matches("button") ? button.previousElementSibling : input)?.focus(); }
      if (event.key === "Escape") { event.preventDefault(); closeMasterCombobox(input, results); input.focus(); }
    }));
  }

  function closeMasterCombobox(input, results) {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  function imageDisplayStyle(product) {
    const fit = ["contain", "cover", "scale-down"].includes(product.imageFit) ? product.imageFit : "contain";
    const position = ["center", "top", "bottom", "left", "right"].includes(product.imagePosition) ? product.imagePosition : "center";
    const scale = clamp(Number(product.imageScale) || 100, 70, 140) / 100;
    return `object-fit:${fit};object-position:${position};transform-origin:${position};transform:scale(${scale})`;
  }

  function bindProductImageEditor(form, product) {
    const preview = form.querySelector("[data-edit-image-preview]");
    const fileInput = form.querySelector("[data-product-image-file]");
    const pathInput = form.querySelector("[name='imagePath']");
    const fitInput = form.querySelector("[name='imageFit']");
    const positionInput = form.querySelector("[name='imagePosition']");
    const scaleInput = form.querySelector("[name='imageScale']");
    const scaleOutput = form.querySelector("[data-image-scale-output]");
    const currentStyle = () => imageDisplayStyle({ imageFit: fitInput.value, imagePosition: positionInput.value, imageScale: scaleInput.value });
    const updatePreview = () => {
      const image = resolveImage(productImageDraft.value);
      preview.classList.toggle("empty", !image);
      preview.innerHTML = image ? `<img src="${escapeAttr(image)}" alt="" style="${currentStyle()}">` : `<span>${escapeHtml(initials(product.name))}</span>`;
      scaleOutput.textContent = `${scaleInput.value}%`;
    };

    form.querySelector("[data-upload-product-image]").addEventListener("click", () => fileInput.click());
    form.querySelector("[data-remove-product-image]").addEventListener("click", () => {
      productImageDraft.value = "";
      pathInput.value = "";
      fileInput.value = "";
      updatePreview();
    });
    preview.addEventListener("click", () => {
      const image = resolveImage(productImageDraft.value);
      if (image) openImageLightbox(image, product.name);
    });
    pathInput.addEventListener("input", () => { productImageDraft.value = pathInput.value.trim(); updatePreview(); });
    [fitInput, positionInput, scaleInput].forEach(input => input.addEventListener("input", updatePreview));
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const uploadButton = form.querySelector("[data-upload-product-image]");
      uploadButton.disabled = true;
      try {
        productImageDraft.value = await optimiseProductImage(file);
        pathInput.value = "";
        updatePreview();
        showToast(state.language === "zh" ? "图片已压缩并加入团队草稿" : "Image compressed and added to the team draft");
      } catch (error) {
        showToast(error.message || String(error));
      } finally {
        uploadButton.disabled = false;
      }
    });
  }

  async function optimiseProductImage(file) {
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error(state.language === "zh" ? "请选择 PNG、JPG 或 WebP 图片" : "Select a PNG, JPG or WebP image");
    if (file.size > 12 * 1024 * 1024) throw new Error(state.language === "zh" ? "原图不能超过 12 MB" : "The source image must be under 12 MB");
    const source = await fileToDataUrl(file);
    const image = await loadBrowserImage(source);
    const maxSide = 1400;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", .88);
    if (result.length > 3_200_000) throw new Error(state.language === "zh" ? "图片压缩后仍过大，请使用更小的图片" : "The compressed image is still too large; use a smaller image");
    return result;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(state.language === "zh" ? "图片读取失败" : "Image could not be read"));
      reader.readAsDataURL(file);
    });
  }

  function loadBrowserImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(state.language === "zh" ? "图片格式无法识别" : "The image format could not be read"));
      image.src = source;
    });
  }

  function resolveImage(value) {
    const source = String(value || "").trim();
    if (!source) return "";
    if (/^(data:|https?:|blob:)/i.test(source)) return source;
    return `product-images/${source.replace(/^.*[\\/]/, "")}`;
  }

  function selectedMasterName(item) { return `${item.code} · ${item.name}`; }
  function uniqueProductId(seed) { const base = normaliseText(seed).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"; let id = base; let index = 2; while (productById(id)) id = `${base}-${index++}`; return id; }
  function initials(value) { return String(value || "P").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
  function normaliseText(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " "); }
  function formatPrice(value) { return Number(value || 0).toLocaleString(state?.language === "en" ? "en-GB" : "zh-CN", { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function formatDateTime(value) { if (!value) return "--"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(state?.language === "en" ? "en-GB" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function structuredCloneSafe(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
  function escapeAttr(value) { return escapeHtml(value); }
  function cssEscape(value) { return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }

  function todayIsoWeek() {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = (date.getUTCDay() + 6) % 7;
    const startDate = new Date(date); startDate.setUTCDate(date.getUTCDate() - day);
    const endDate = new Date(startDate); endDate.setUTCDate(startDate.getUTCDate() + 6);
    const thursday = new Date(startDate); thursday.setUTCDate(startDate.getUTCDate() + 3);
    const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    const firstDay = (firstThursday.getUTCDay() + 6) % 7;
    const firstMonday = new Date(firstThursday); firstMonday.setUTCDate(firstThursday.getUTCDate() - firstDay);
    const number = Math.floor((startDate - firstMonday) / 604800000) + 1;
    const iso = dateValue => dateValue.toISOString().slice(0, 10);
    return { today, key: `${thursday.getUTCFullYear()}-W${String(number).padStart(2, "0")}`, start: iso(startDate), end: iso(endDate) };
  }

  async function togglePresentation() {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    try { await document.documentElement.requestFullscreen(); }
    catch { document.body.classList.toggle("presentation"); }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    toastTimer = window.setTimeout(() => dom.toast.classList.remove("show"), 2400);
  }
})();

(function () {
  "use strict";

  const modules = {
    forecast: {
      groupZh: "计划与交付",
      groupEn: "Planning & Delivery",
      titleZh: "预测管理",
      titleEn: "Forecast Management",
      descriptionZh: "销售预测输入、共识与版本管理",
      descriptionEn: "Forecast input, consensus and version management"
    },
    logistic: {
      groupZh: "计划与交付",
      groupEn: "Planning & Delivery",
      parentZh: "物流交付",
      parentEn: "Logistics Delivery",
      titleZh: "发货汇总",
      titleEn: "Shipment Summary",
      descriptionZh: "库存、规格与渠道定价汇总",
      descriptionEn: "Inventory, specifications and channel pricing summary"
    },
    shipment: {
      groupZh: "计划与交付",
      groupEn: "Planning & Delivery",
      parentZh: "物流交付",
      parentEn: "Logistics Delivery",
      titleZh: "发货操作",
      titleEn: "Shipment Operations",
      descriptionZh: "PO 状态、批次发货与交付记录",
      descriptionEn: "PO status, shipment batches and delivery records"
    },
    performance: {
      groupZh: "经营管理",
      groupEn: "Business Management",
      titleZh: "经营分析",
      titleEn: "Business Analysis",
      descriptionZh: "预测达成、销售复盘与盈利分析",
      descriptionEn: "Forecast attainment, sales review and profitability"
    }
  };

  const translations = {
    "zh-CN": {
      brand: "运营协同平台", business: "欧洲业务运营", workbench: "我的工作台",
      planning: "计划与交付", projects: "项目跟进", sales: "产销管理", forecast: "预测管理",
      logistic: "物流交付", shipment: "发货操作", logisticsWorkspace: "物流交付", shipmentSummary: "发货汇总", shipmentOperation: "发货操作", growth: "市场增长", launch: "新品上市",
      campaigns: "营销活动", assets: "营销物料", collaboration: "协同中心", monthly: "月度促销审批",
      other: "其他审批", tasks: "我的待办", exceptions: "异常中心", businessManagement: "经营管理",
      overview: "经营总览", bp: "BP达成", performance: "经营分析", valueChain: "价值链测算",
      settlement: "结算台账", management: "专业与管理", functional: "职能工作台", system: "系统管理",
      native: "原生", localTest: "本地原生整合测试", snapshot: "本地快照 · 15张表", testMode: "原生整合测试"
    },
    "en-GB": {
      brand: "Operations Hub", business: "Europe Business Operations", workbench: "My Workspace",
      planning: "Planning & Delivery", projects: "Project Tracking", sales: "Sales & Inventory", forecast: "Forecast Management",
      logistic: "Logistics Delivery", shipment: "Shipment Operations", logisticsWorkspace: "Logistics Delivery", shipmentSummary: "Shipment Summary", shipmentOperation: "Shipment Operations", growth: "Market Growth", launch: "New Product Launch",
      campaigns: "Marketing Campaigns", assets: "Marketing Assets", collaboration: "Collaboration", monthly: "Monthly Promotion Approval",
      other: "Other Approvals", tasks: "My Tasks", exceptions: "Exception Centre", businessManagement: "Business Management",
      overview: "Business Overview", bp: "BP Achievement", performance: "Business Analysis", valueChain: "Value Chain Simulation",
      settlement: "Settlement Ledger", management: "Professional & Admin", functional: "Functional Workspace", system: "System Management",
      native: "Native", localTest: "Local native integration", snapshot: "Local snapshot · 15 tables", testMode: "Native integration test"
    }
  };

  let activeModule = moduleFromHash();
  let locale = localStorage.getItem("erp-native-test-locale") || "zh-CN";

  function moduleFromHash() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const requested = params.get("module");
    if (requested === "logistic" && params.get("view") === "operation") return "shipment";
    return modules[requested] ? requested : "forecast";
  }

  function setHash(moduleKey, replace) {
    const nextHash = moduleKey === "logistic" || moduleKey === "shipment"
      ? `#module=logistic&view=${moduleKey === "shipment" ? "operation" : "summary"}`
      : `#module=${encodeURIComponent(moduleKey)}`;
    if (window.location.hash === nextHash) return;
    if (replace) window.history.replaceState(null, "", nextHash);
    else window.history.pushState(null, "", nextHash);
  }

  function clearTransientUi() {
    document.querySelectorAll(".scrim, .drawer, .modal, .toast, .status-pop").forEach((node) => node.remove());
  }

  function renderModule(moduleKey, options) {
    const config = modules[moduleKey] || modules.forecast;
    const renderer = window.Modules && window.Modules[moduleKey];
    if (!renderer || typeof renderer.render !== "function") return;

    activeModule = moduleKey;
    clearTransientUi();
    document.getElementById("renderStatus").textContent = locale === "en-GB" ? "Rendering..." : "正在呈现...";
    document.getElementById("view").replaceChildren();
    const isLogisticsModule = moduleKey === "logistic" || moduleKey === "shipment";
    document.querySelectorAll("[data-module]").forEach((button) => {
      const buttonModule = button.getAttribute("data-module");
      button.classList.toggle("active", buttonModule === moduleKey || (isLogisticsModule && buttonModule === "logistic"));
    });
    const subnav = document.getElementById("logisticsSubnav");
    subnav.hidden = !isLogisticsModule;
    subnav.querySelectorAll("[data-logistics-view]").forEach((button) => {
      const selected = button.getAttribute("data-logistics-view") === moduleKey;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    document.getElementById("mobileModuleSelect").value = isLogisticsModule ? "logistic" : moduleKey;
    updateContext(config);
    setHash(moduleKey, options && options.replace);

    window.requestAnimationFrame(() => {
      renderer.render(document.getElementById("view"));
      document.getElementById("renderStatus").textContent = locale === "en-GB" ? "Ready" : "已就绪";
      document.querySelector(".content").scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }

  function updateContext(config) {
    const english = locale === "en-GB";
    const group = english ? config.groupEn : config.groupZh;
    const parent = english ? config.parentEn : config.parentZh;
    const title = english ? config.titleEn : config.titleZh;
    const description = english ? config.descriptionEn : config.descriptionZh;
    document.getElementById("modulePath").innerHTML = parent
      ? `${escapeHtml(group)} <span class="sep">/</span> ${escapeHtml(parent)} <span class="sep">/</span> ${escapeHtml(title)}`
      : `${escapeHtml(group)} <span class="sep">/</span> ${escapeHtml(title)}`;
    document.getElementById("moduleDescription").textContent = description;
    document.getElementById("testModeDescription").textContent = english
      ? "Business data uses a read-only snapshot; edits remain in this browser session only."
      : "业务数据为只读快照；编辑操作仅保留在当前浏览器会话。";
    document.title = `${title} · ${english ? "Operations Hub" : "运营协同平台"}`;
  }

  function applyLocale(nextLocale) {
    locale = translations[nextLocale] ? nextLocale : "zh-CN";
    localStorage.setItem("erp-native-test-locale", locale);
    document.documentElement.lang = locale;
    document.getElementById("localeSelect").value = locale;
    const dictionary = translations[locale];
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (dictionary[key]) node.textContent = dictionary[key];
    });
    updateContext(modules[activeModule]);
    document.getElementById("renderStatus").textContent = locale === "en-GB" ? "Ready" : "已就绪";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  document.getElementById("platformNav").addEventListener("click", (event) => {
    const moduleButton = event.target.closest("[data-module]");
    if (moduleButton) {
      renderModule(moduleButton.getAttribute("data-module"));
      return;
    }
    const existingButton = event.target.closest("[data-existing-module]");
    if (existingButton) {
      window.S.toast(locale === "en-GB"
        ? "This entry remains in the existing platform and is outside this local integration test."
        : "该入口沿用现有平台，本地测试仅验证本次新增的四个原生模块。");
    }
  });

  document.getElementById("mobileModuleSelect").addEventListener("change", (event) => {
    renderModule(event.target.value);
  });

  document.getElementById("logisticsSubnav").addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-logistics-view]");
    if (viewButton) renderModule(viewButton.getAttribute("data-logistics-view"));
  });

  document.getElementById("localeSelect").addEventListener("change", (event) => {
    applyLocale(event.target.value);
  });

  window.addEventListener("popstate", () => {
    const requested = moduleFromHash();
    if (requested !== activeModule) renderModule(requested, { replace: true });
  });

  window.addEventListener("hashchange", () => {
    const requested = moduleFromHash();
    if (requested !== activeModule) renderModule(requested, { replace: true });
  });

  applyLocale(locale);
  renderModule(activeModule, { replace: true });
})();

(async function () {
  "use strict";

  await Promise.resolve(window.platformAuthReady);

  const modules = {
    overview: {
      groupZh: "经营管理",
      groupEn: "Business Management",
      titleZh: "经营总览",
      titleEn: "Business Overview",
      descriptionZh: "目标、执行、利润、现金与风险统一视图",
      descriptionEn: "Unified view of targets, execution, profit, cash and risk"
    },
    forecast: {
      groupZh: "计划与交付",
      groupEn: "Planning & Delivery",
      titleZh: "预测管理",
      titleEn: "Forecast Management",
      descriptionZh: "销售预测输入、共识与版本管理",
      descriptionEn: "Forecast input, consensus and version management"
    },
    shipmentSummary: {
      groupZh: "计划与交付",
      groupEn: "Planning & Delivery",
      parentZh: "物流交付",
      parentEn: "Logistics Delivery",
      titleZh: "发货汇总",
      titleEn: "Shipment Summary",
      descriptionZh: "市场发货、PO履约与批次跟踪",
      descriptionEn: "Market shipments, PO fulfilment and batch tracking"
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
    logistic: {
      groupZh: "计划与交付",
      groupEn: "Planning & Delivery",
      parentZh: "物流交付",
      parentEn: "Logistics Delivery",
      titleZh: "产品物流与价格",
      titleEn: "Product Logistics & Pricing",
      descriptionZh: "产品包装、库存、RRP与Invoice Price",
      descriptionEn: "Packaging, inventory, RRP and invoice price"
    },
    bp: {
      groupZh: "经营管理",
      groupEn: "Business Management",
      titleZh: "BP达成",
      titleEn: "BP Achievement",
      descriptionZh: "BP目标、实际达成与市场产品明细",
      descriptionEn: "BP targets, actual achievement and market-product detail"
    },
    performance: {
      groupZh: "经营管理",
      groupEn: "Business Management",
      titleZh: "经营分析复盘",
      titleEn: "Business Analysis Review",
      descriptionZh: "月度、季度、半年度与年度会议复盘",
      descriptionEn: "Monthly, quarterly, half-year and annual business reviews"
    },
    functions: {
      groupZh: "专业与管理",
      groupEn: "Professional & Admin",
      titleZh: "职能工作台",
      titleEn: "Functional Workspace",
      descriptionZh: "各职能专业数据的维护入口",
      descriptionEn: "Maintenance entry points for functional data"
    },
    prototypeManagement: {
      groupZh: "专业与管理",
      groupEn: "Professional & Admin",
      parentZh: "职能工作台",
      parentEn: "Functional Workspace",
      titleZh: "样机管理",
      titleEn: "Prototype Management",
      descriptionZh: "样机需求、实物流转、借用归还与项目准备度联动",
      descriptionEn: "Prototype requirements, movements, custody and project readiness"
    }
  };

  const translations = {
    "zh-CN": {
      brand: "运营协同平台", business: "欧洲业务运营", workbench: "我的工作台",
      planning: "计划与交付", projects: "项目跟进", sales: "产销管理", forecast: "预测管理",
      logistic: "物流交付", shipment: "发货操作", logisticsWorkspace: "物流交付", shipmentSummary: "发货汇总", shipmentOperation: "发货操作", productLogistics: "产品物流与价格", growth: "市场增长", launch: "新品上市",
      campaigns: "营销活动", assets: "营销物料", collaboration: "协同中心", monthly: "月度促销审批",
      other: "其他审批", tasks: "我的待办", exceptions: "异常中心", businessManagement: "经营管理",
      overview: "经营总览", bp: "BP达成", performance: "经营分析复盘", valueChain: "价值链测算",
      settlement: "结算台账", management: "专业与管理", functional: "职能工作台", prototypeManagement: "样机管理", system: "系统管理",
      native: "试运行", localTest: "业务分析试运行", snapshot: "业务快照 · 15张表", testMode: "业务分析试运行"
    },
    "en-GB": {
      brand: "Operations Hub", business: "Europe Business Operations", workbench: "My Workspace",
      planning: "Planning & Delivery", projects: "Project Tracking", sales: "Sales & Inventory", forecast: "Forecast Management",
      logistic: "Logistics Delivery", shipment: "Shipment Operations", logisticsWorkspace: "Logistics Delivery", shipmentSummary: "Shipment Summary", shipmentOperation: "Shipment Operations", productLogistics: "Product Logistics & Pricing", growth: "Market Growth", launch: "New Product Launch",
      campaigns: "Marketing Campaigns", assets: "Marketing Assets", collaboration: "Collaboration", monthly: "Monthly Promotion Approval",
      other: "Other Approvals", tasks: "My Tasks", exceptions: "Exception Centre", businessManagement: "Business Management",
      overview: "Business Overview", bp: "BP Achievement", performance: "Business Analysis Review", valueChain: "Value Chain Simulation",
      settlement: "Settlement Ledger", management: "Professional & Admin", functional: "Functional Workspace", prototypeManagement: "Prototype Management", system: "System Management",
      native: "Pilot", localTest: "Business analysis pilot", snapshot: "Business snapshot · 15 tables", testMode: "Business analysis pilot"
    }
  };

  let activeModule = moduleFromHash();
  let locale = localStorage.getItem("erp-native-test-locale") || "zh-CN";

  const existingPlatformRoutes = {
    home: "/platform/workbench",
    workbench: "/platform/workbench",
    projects: "/platform/planning/projects",
    sales: "/platform/planning/sales",
    launch: "/platform/market/launch",
    campaigns: "/platform/market/campaigns",
    assets: "/platform/market/assets",
    monthly: "/platform/collaboration/monthly-approvals",
    other: "/platform/collaboration/other-approvals",
    tasks: "/platform/collaboration/tasks",
    exceptions: "/platform/collaboration/exceptions",
    "value-chain": "/platform/business/value-chain/on-sale",
    settlement: "/platform/business/settlements",
    system: "/platform/system/master-data"
  };

  function moduleFromHash() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const requested = params.get("module");
    if (requested === "businessReview") return "performance";
    if (requested === "functions" && params.get("workspace") === "prototype") return "prototypeManagement";
    if (requested === "logistic") {
      const view = params.get("view");
      if (view === "operation") return "shipment";
      if (view === "products") return "logistic";
      return "shipmentSummary";
    }
    return modules[requested] ? requested : "forecast";
  }

  function setHash(moduleKey, replace) {
    const logisticsViews = { shipmentSummary: "summary", shipment: "operation", logistic: "products" };
    const nextHash = moduleKey === "prototypeManagement"
      ? "#module=functions&workspace=prototype"
      : logisticsViews[moduleKey]
      ? `#module=logistic&view=${logisticsViews[moduleKey]}`
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
    const isLogisticsModule = moduleKey === "shipmentSummary" || moduleKey === "logistic" || moduleKey === "shipment";
    const isFunctionalModule = moduleKey === "functions" || moduleKey === "prototypeManagement";
    document.querySelectorAll("[data-module]").forEach((button) => {
      const buttonModule = button.getAttribute("data-module");
      button.classList.toggle("active", buttonModule === moduleKey || (isLogisticsModule && buttonModule === "shipmentSummary") || (isFunctionalModule && buttonModule === "functions"));
    });
    const subnav = document.getElementById("logisticsSubnav");
    subnav.hidden = !isLogisticsModule;
    subnav.querySelectorAll("[data-logistics-view]").forEach((button) => {
      const selected = button.getAttribute("data-logistics-view") === moduleKey;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    document.getElementById("mobileModuleSelect").value = isLogisticsModule ? "shipmentSummary" : isFunctionalModule ? "functions" : moduleKey;
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
      ? "Business data uses a read-only snapshot and never overwrites formal cloud records."
      : "业务数据为只读快照；不会写入或覆盖云端正式记录。";
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
      const route = existingPlatformRoutes[existingButton.getAttribute("data-existing-module")];
      if (window.location.protocol === "https:" && route) {
        if (window.OPERATIONS_PLATFORM_EMBEDDED && window.parent !== window) {
          window.parent.postMessage({ type: "operations-platform:navigate", href: route }, window.location.origin);
        } else {
          window.location.assign(route);
        }
        return;
      }
      window.S.toast(locale === "en-GB"
        ? "This entry remains in the existing platform."
        : "该入口沿用现有平台。云端试运行环境可直接跳转。");
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
    else setHash(requested, true);
  });

  window.addEventListener("hashchange", () => {
    const requested = moduleFromHash();
    if (requested !== activeModule) renderModule(requested, { replace: true });
    else setHash(requested, true);
  });

  applyLocale(locale);
  if (window.cloudStore?.enabled) {
    document.getElementById("accountButton").hidden = true;
  }
  renderModule(activeModule, { replace: true });
})();

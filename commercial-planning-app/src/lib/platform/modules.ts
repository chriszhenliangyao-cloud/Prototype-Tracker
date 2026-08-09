export type PlatformLocale = "zh-CN" | "en-GB";

export type PlatformModuleStatus = "formal" | "pilot";

export type PlatformProtectedModule = "roadmap" | "master_data";

export type PlatformModuleDefinition = {
  key: string;
  group: string;
  zh: string;
  en: string;
  descriptionZh: string;
  descriptionEn: string;
  href: string;
  activePrefix?: string;
  status?: PlatformModuleStatus;
  embeddedSrc?: string;
  protectedModule?: PlatformProtectedModule;
  requiresMasterData?: boolean;
};

export type PlatformModuleGroup = {
  key: string;
  zh: string;
  en: string;
  items: PlatformModuleDefinition[];
};

const planning: PlatformModuleDefinition[] = [
  {
    key: "roadmap",
    group: "planning",
    zh: "产品路线图",
    en: "Product Roadmap",
    descriptionZh: "产品组合、目标上市时间与项目执行联动",
    descriptionEn: "Portfolio, target launches and project execution",
    href: "/platform/planning/roadmap",
    embeddedSrc: "/platform/index.html?embedded=1#module=roadmap",
    protectedModule: "roadmap"
  },
  {
    key: "projects",
    group: "planning",
    zh: "项目跟进",
    en: "Project Tracking",
    descriptionZh: "跨职能项目控制塔",
    descriptionEn: "Cross-functional project control tower",
    href: "/platform/planning/projects",
    embeddedSrc: "/platform/index.html?embedded=1#module=projects"
  },
  {
    key: "sales",
    group: "planning",
    zh: "产销管理",
    en: "Sales & Inventory",
    descriptionZh: "需求、供应与库存协同",
    descriptionEn: "Demand, supply and inventory collaboration",
    href: "/platform/planning/sales",
    embeddedSrc: "/platform/index.html?embedded=1#module=sales"
  },
  {
    key: "forecast",
    group: "planning",
    zh: "预测管理",
    en: "Forecast Management",
    descriptionZh: "销售预测输入、共识与版本管理",
    descriptionEn: "Forecast entry, consensus and version management",
    href: "/platform/planning/forecast",
    status: "pilot",
    embeddedSrc: "/platform-native/index.html?embedded=1#module=forecast"
  },
  {
    key: "logistics",
    group: "planning",
    zh: "物流交付",
    en: "Logistics Delivery",
    descriptionZh: "出运、在途、清关、到仓与履约跟进",
    descriptionEn: "Shipment, transit, customs, receipt and fulfilment",
    href: "/platform/planning/logistics",
    status: "pilot",
    embeddedSrc: "/platform-native/index.html?embedded=1#module=shipmentSummary"
  }
];

const market: PlatformModuleDefinition[] = [
  {
    key: "launch",
    group: "market",
    zh: "新品上市",
    en: "New Product Launch",
    descriptionZh: "新品上市计划与跨职能准备度",
    descriptionEn: "Launch planning and cross-functional readiness",
    href: "/platform/market/launch",
    embeddedSrc: "/platform/index.html?embedded=1#module=market-launch"
  },
  {
    key: "campaign",
    group: "market",
    zh: "营销活动",
    en: "Campaigns",
    descriptionZh: "营销活动计划、预算、执行与效果",
    descriptionEn: "Campaign planning, budget, execution and results",
    href: "/platform/market/campaigns",
    embeddedSrc: "/platform/index.html?embedded=1#module=market-campaign"
  },
  {
    key: "assets",
    group: "market",
    zh: "营销物料",
    en: "Marketing Assets",
    descriptionZh: "按项目跟进物料准备、交付与缺失",
    descriptionEn: "Project-based asset readiness, delivery and gaps",
    href: "/platform/market/assets",
    embeddedSrc: "/platform/index.html?embedded=1#module=market-assets"
  }
];

const collaboration: PlatformModuleDefinition[] = [
  {
    key: "monthly-approvals",
    group: "collaboration",
    zh: "月度促销审批",
    en: "Monthly Promotion Approval",
    descriptionZh: "促销计划、利润校验与分级审批",
    descriptionEn: "Promotion planning, margin validation and staged approval",
    href: "/platform/collaboration/monthly-approvals"
  },
  {
    key: "other-approvals",
    group: "collaboration",
    zh: "其他审批",
    en: "Other Approvals",
    descriptionZh: "非月促事项的申请、审批与交付通知",
    descriptionEn: "Requests, approvals and notices outside monthly promotion",
    href: "/platform/collaboration/other-approvals"
  },
  {
    key: "tasks",
    group: "collaboration",
    zh: "我的待办",
    en: "My Tasks",
    descriptionZh: "按责任人聚合跨模块执行事项",
    descriptionEn: "Cross-module actions grouped by owner",
    href: "/platform/collaboration/tasks",
    embeddedSrc: "/platform/index.html?embedded=1#module=tasks"
  },
  {
    key: "exceptions",
    group: "collaboration",
    zh: "异常中心",
    en: "Exception Centre",
    descriptionZh: "跨模块风险、阻塞与升级",
    descriptionEn: "Cross-module risks, blockers and escalation",
    href: "/platform/collaboration/exceptions",
    embeddedSrc: "/platform/index.html?embedded=1#module=exceptions"
  }
];

const business: PlatformModuleDefinition[] = [
  {
    key: "overview",
    group: "business",
    zh: "经营总览",
    en: "Business Overview",
    descriptionZh: "经营目标、收入、利润与关键风险",
    descriptionEn: "Targets, revenue, profit and key risks",
    href: "/platform/business/overview",
    embeddedSrc: "/platform/index.html?embedded=1#module=business-overview"
  },
  {
    key: "bp",
    group: "business",
    zh: "BP达成",
    en: "BP Achievement",
    descriptionZh: "年度目标、实际达成与滚动预测",
    descriptionEn: "Annual targets, actual achievement and rolling forecast",
    href: "/platform/business/bp",
    embeddedSrc: "/platform-native/index.html?embedded=1#module=bp"
  },
  {
    key: "analysis",
    group: "business",
    zh: "经营分析复盘",
    en: "Business Analysis Review",
    descriptionZh: "经营结果、利润桥、异常与行动复盘",
    descriptionEn: "Results, profit bridge, exceptions and actions",
    href: "/platform/business/analysis",
    status: "pilot",
    embeddedSrc: "/platform-native/index.html?embedded=1#module=performance"
  },
  {
    key: "value-chain",
    group: "business",
    zh: "价值链测算",
    en: "Value Chain Simulation",
    descriptionZh: "价格、渠道、成本与贡献利润情景模拟",
    descriptionEn: "Price, channel, cost and contribution-profit scenarios",
    href: "/platform/business/value-chain/on-sale",
    activePrefix: "/platform/business/value-chain"
  },
  {
    key: "settlements",
    group: "business",
    zh: "结算台账",
    en: "Settlement Ledger",
    descriptionZh: "客户对账、Claim、CN、回款核销与审计",
    descriptionEn: "Statements, claims, credit notes, allocation and audit",
    href: "/platform/business/settlements"
  }
];

const administration: PlatformModuleDefinition[] = [
  {
    key: "functions",
    group: "administration",
    zh: "职能工作台",
    en: "Function Workspaces",
    descriptionZh: "各职能专业数据的维护入口",
    descriptionEn: "Maintenance entry points for functional data",
    href: "/platform/admin/functions",
    status: "pilot",
    embeddedSrc: "/platform-native/index.html?embedded=1#module=functions"
  },
  {
    key: "system",
    group: "administration",
    zh: "系统管理",
    en: "System Management",
    descriptionZh: "权限、模块、主数据与审计",
    descriptionEn: "Permissions, modules, Master Data and audit",
    href: "/platform/system/master-data",
    protectedModule: "master_data",
    requiresMasterData: true
  }
];

export const platformModuleGroups: PlatformModuleGroup[] = [
  { key: "planning", zh: "计划与交付", en: "Planning & Delivery", items: planning },
  { key: "market", zh: "市场增长", en: "Market Growth", items: market },
  { key: "collaboration", zh: "协同中心", en: "Collaboration", items: collaboration },
  { key: "business", zh: "经营管理", en: "Business Management", items: business },
  { key: "administration", zh: "专业与管理", en: "Workspaces & Admin", items: administration }
];

export const platformModules = platformModuleGroups.flatMap((group) => group.items);

export const auxiliaryEmbeddedModules: PlatformModuleDefinition[] = [
  {
    key: "prototype-management",
    group: "administration",
    zh: "样机管理",
    en: "Prototype Management",
    descriptionZh: "样机需求、流转、借用归还与项目准备度联动",
    descriptionEn: "Prototype demand, custody, returns and project readiness",
    href: "/platform/admin/prototypes",
    status: "pilot",
    embeddedSrc: "/platform-native/index.html?embedded=1#module=prototypeManagement"
  }
];

export const embeddedPlatformModules = [...platformModules, ...auxiliaryEmbeddedModules]
  .filter((module) => Boolean(module.embeddedSrc));

export function findPlatformModule(pathname: string) {
  return [...platformModules, ...auxiliaryEmbeddedModules].find((module) => {
    const activePrefix = module.activePrefix || module.href;
    return pathname === module.href || pathname.startsWith(`${activePrefix}/`);
  });
}

export function findEmbeddedPlatformModule(pathname: string) {
  return embeddedPlatformModules.find((module) => module.href === pathname);
}

export function platformModuleLabel(module: PlatformModuleDefinition, locale: PlatformLocale) {
  return locale === "en-GB" ? module.en : module.zh;
}

export function platformModuleDescription(module: PlatformModuleDefinition, locale: PlatformLocale) {
  return locale === "en-GB" ? module.descriptionEn : module.descriptionZh;
}

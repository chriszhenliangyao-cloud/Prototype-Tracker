"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AppSession } from "@/lib/auth/types";
import { canEditMasterData } from "@/lib/auth/roles";

type Locale = "zh-CN" | "en-GB";

type NavItem = {
  key: string;
  zh: string;
  en: string;
  href: string;
  legacy?: boolean;
  badge?: string;
  requiresMasterData?: boolean;
  protectedModule?: "roadmap" | "master_data";
};

type NavGroup = {
  key: string;
  zh: string;
  en: string;
  items: NavItem[];
};

const localeStorageKey = "operationsPlanningLocale.v1";

const navGroups: NavGroup[] = [
  {
    key: "planning",
    zh: "计划与交付",
    en: "Planning & Delivery",
    items: [
      { key: "roadmap", zh: "产品路线图", en: "Product Roadmap", href: "/platform/index.html#module=roadmap", legacy: true, protectedModule: "roadmap" },
      { key: "projects", zh: "项目跟进", en: "Project Tracking", href: "/platform/index.html#module=projects", legacy: true },
      { key: "sales", zh: "产销管理", en: "Sales & Inventory", href: "/platform/index.html#module=sales", legacy: true },
      { key: "forecast", zh: "预测管理", en: "Forecast Management", href: "/platform/index.html#module=forecast", legacy: true, badge: "Beta" },
      { key: "logistics", zh: "物流交付", en: "Logistics Delivery", href: "/platform/index.html#module=logistics", legacy: true, badge: "Beta" }
    ]
  },
  {
    key: "market",
    zh: "市场增长",
    en: "Market Growth",
    items: [
      { key: "launch", zh: "新品上市", en: "New Product Launch", href: "/platform/index.html#module=market-launch", legacy: true },
      { key: "campaign", zh: "营销活动", en: "Campaigns", href: "/platform/index.html#module=market-campaign", legacy: true },
      { key: "assets", zh: "营销物料", en: "Marketing Assets", href: "/platform/index.html#module=market-assets", legacy: true }
    ]
  },
  {
    key: "collaboration",
    zh: "协同中心",
    en: "Collaboration",
    items: [
      { key: "monthly-approvals", zh: "月度促销审批", en: "Monthly Promotion Approval", href: "/platform/collaboration/monthly-approvals" },
      { key: "other-approvals", zh: "其他审批", en: "Other Approvals", href: "/platform/collaboration/other-approvals" },
      { key: "tasks", zh: "我的待办", en: "My Tasks", href: "/platform/index.html#module=tasks", legacy: true },
      { key: "exceptions", zh: "异常中心", en: "Exception Center", href: "/platform/index.html#module=exceptions", legacy: true }
    ]
  },
  {
    key: "business",
    zh: "经营管理",
    en: "Business Management",
    items: [
      { key: "overview", zh: "经营总览", en: "Business Overview", href: "/platform/index.html#module=business-overview", legacy: true },
      { key: "bp", zh: "BP达成", en: "BP Achievement", href: "/platform/business/bp" },
      { key: "analysis", zh: "经营分析", en: "Business Analysis", href: "/platform/index.html#module=business-analysis", legacy: true },
      { key: "value-chain", zh: "价值链测算", en: "Value Chain Simulation", href: "/platform/business/value-chain/on-sale" },
      { key: "settlements", zh: "结算台账", en: "Settlement Ledger", href: "/platform/index.html#module=settlements", legacy: true }
    ]
  },
  {
    key: "administration",
    zh: "专业与管理",
    en: "Workspaces & Admin",
    items: [
      { key: "functions", zh: "职能工作台", en: "Function Workspaces", href: "/platform/index.html#module=functions", legacy: true },
      { key: "system", zh: "系统管理", en: "System Management", href: "/platform/system/master-data", requiresMasterData: true, protectedModule: "master_data" }
    ]
  }
];

const routeContext: Array<{
  prefix: string;
  zh: [string, string];
  en: [string, string];
}> = [
  { prefix: "/platform/system", zh: ["专业与管理 / 系统管理", "权限、模块、主数据与审计"], en: ["Workspaces & Admin / System Management", "Permissions, modules, Master Data and audit"] },
  { prefix: "/platform/business/value-chain", zh: ["经营管理 / 价值链测算", "价格、渠道、成本与贡献利润情景模拟"], en: ["Business Management / Value Chain Simulation", "Price, channel, cost and contribution-profit scenarios"] },
  { prefix: "/platform/business/bp", zh: ["经营管理 / BP达成", "年度目标、实际达成与审批"], en: ["Business Management / BP Achievement", "Annual targets, actual achievement and approvals"] },
  { prefix: "/platform/collaboration/monthly-approvals", zh: ["协同中心 / 月度促销审批", "促销计划、利润校验与分级审批"], en: ["Collaboration / Monthly Promotion Approval", "Promotion planning, margin validation and staged approval"] },
  { prefix: "/platform/collaboration/other-approvals", zh: ["协同中心 / 其他审批", "非月促事项的申请、审批与交付通知"], en: ["Collaboration / Other Approvals", "Requests, approvals and delivery notices outside monthly promotion"] },
  { prefix: "/platform/workbench", zh: ["我的工作台", "跨模块待办与异常"], en: ["My Workspace", "Cross-module tasks and exceptions"] }
];

function isNativeActive(pathname: string, item: NavItem) {
  if (item.legacy) return false;
  if (item.key === "value-chain") {
    return pathname.startsWith("/platform/business/value-chain");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function roleLabel(role: AppSession["role"], locale: Locale) {
  if (locale === "en-GB") return role.replaceAll("_", " ");
  const labels: Partial<Record<AppSession["role"], string>> = {
    OWNER: "平台所有者",
    ADMIN: "超级管理员",
    GTM_LEADER: "GTM负责人",
    GM: "管理层",
    FINANCE: "财务",
    SALES_MANAGER: "销售经理",
    KA_OWNER: "客户负责人",
    VIEWER: "查看者"
  };
  return labels[role] || role;
}

export function PlatformShell({
  children,
  session,
  protectedModules = {}
}: {
  children: React.ReactNode;
  session: AppSession | null;
  protectedModules?: Partial<Record<"roadmap" | "master_data", "none" | "view" | "edit" | "manage">>;
}) {
  const pathname = usePathname() || "/platform/workbench";
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("zh-CN");

  useEffect(() => {
    const saved = window.localStorage.getItem(localeStorageKey);
    if (saved === "en-GB" || saved === "zh-CN") setLocale(saved);
  }, []);

  const context = useMemo(() => {
    const match = routeContext.find((entry) => pathname.startsWith(entry.prefix));
    return match ? match[locale === "en-GB" ? "en" : "zh"] : routeContext[5].zh;
  }, [locale, pathname]);

  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => {
        if (item.protectedModule && protectedModules[item.protectedModule] !== undefined) {
          return protectedModules[item.protectedModule] !== "none";
        }
        return !item.requiresMasterData || Boolean(session && canEditMasterData(session.role));
      }
    )
  }));

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    window.localStorage.setItem(localeStorageKey, nextLocale);
    document.documentElement.lang = nextLocale;
  }

  return (
    <div className="native-platform-shell" data-locale={locale}>
      <aside className="native-platform-sidebar" aria-label={locale === "en-GB" ? "Platform modules" : "平台模块导航"}>
        <Link
          className="native-platform-brand"
          href="/platform/workbench"
          prefetch={false}
          onMouseEnter={() => router.prefetch("/platform/workbench")}
          onFocus={() => router.prefetch("/platform/workbench")}
        >
          <span className="native-platform-brand-mark">OP</span>
          <span className="min-w-0">
            <strong>{locale === "en-GB" ? "Operations Hub" : "运营协同平台"}</strong>
            <small>{locale === "en-GB" ? "Europe Business Operations" : "欧洲业务运营"}</small>
          </span>
        </Link>

        <nav className="native-platform-nav">
          <Link
            className={`native-platform-nav-item ${pathname === "/platform/workbench" ? "active" : ""}`}
            href="/platform/workbench"
            prefetch={false}
            onMouseEnter={() => router.prefetch("/platform/workbench")}
            onFocus={() => router.prefetch("/platform/workbench")}
          >
            {locale === "en-GB" ? "My Workspace" : "我的工作台"}
          </Link>
          {visibleGroups.map((group) => (
            <section className="native-platform-nav-group" key={group.key}>
              <div className="native-platform-nav-label">
                {locale === "en-GB" ? group.en : group.zh}
              </div>
              {group.items.map((item) => {
                const label = locale === "en-GB" ? item.en : item.zh;
                const className = `native-platform-nav-item ${isNativeActive(pathname, item) ? "active" : ""}`;
                return item.legacy ? (
                  <a className={className} href={item.href} key={item.key}>
                    <span>{label}</span>
                    {item.badge ? <small>{item.badge}</small> : null}
                  </a>
                ) : (
                  <Link
                    className={className}
                    href={item.href}
                    key={item.key}
                    prefetch={false}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                  >
                    <span>{label}</span>
                    {item.badge ? <small>{item.badge}</small> : null}
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="native-platform-sidebar-foot">
          <span aria-hidden="true" />
          {locale === "en-GB" ? "Unified cloud workspace" : "统一云端工作区"}
        </div>
      </aside>

      <div className="native-platform-main">
        <header className="native-platform-header">
          <div className="native-platform-context">
            <strong>{context[0]}</strong>
            <span>{context[1]}</span>
          </div>
          <div className="native-platform-account">
            {session ? (
              <span className="native-platform-user" title={session.email}>
                {session.name || session.email.split("@")[0]}
                <small>{roleLabel(session.role, locale)}</small>
              </span>
            ) : null}
            <label className="sr-only" htmlFor="native-platform-locale">
              {locale === "en-GB" ? "Interface language" : "界面语言"}
            </label>
            <select
              id="native-platform-locale"
              aria-label={locale === "en-GB" ? "Interface language" : "界面语言"}
              onChange={(event) => changeLocale(event.target.value as Locale)}
              value={locale}
            >
              <option value="zh-CN">中文</option>
              <option value="en-GB">English</option>
            </select>
            {session ? (
              <a className="native-platform-signout" href="/auth/logout">
                {locale === "en-GB" ? "Sign out" : "退出"}
              </a>
            ) : null}
          </div>
        </header>
        <main className="native-platform-content">{children}</main>
      </div>
    </div>
  );
}

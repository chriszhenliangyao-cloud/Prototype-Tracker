"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AppSession } from "@/lib/auth/types";
import { canEditMasterData } from "@/lib/auth/roles";
import {
  findPlatformModule,
  platformModuleDescription,
  platformModuleGroups,
  platformModuleLabel,
  type PlatformLocale as Locale,
  type PlatformModuleDefinition
} from "@/lib/platform/modules";

const localeStorageKey = "operationsPlanningLocale.v1";

type NavigationSummary = {
  badges?: Record<string, number>;
};

function isModuleActive(pathname: string, item: PlatformModuleDefinition) {
  const prefix = item.activePrefix || item.href;
  return pathname === item.href || pathname.startsWith(`${prefix}/`);
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
  protectedModules = {},
  releaseId = "local"
}: {
  children: React.ReactNode;
  session: AppSession | null;
  protectedModules?: Partial<Record<"roadmap" | "master_data", "none" | "view" | "edit" | "manage">>;
  releaseId?: string;
}) {
  const pathname = usePathname() || "/platform/workbench";
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [navigationBadges, setNavigationBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    const saved = window.localStorage.getItem(localeStorageKey);
    if (saved === "en-GB" || saved === "zh-CN") setLocale(saved);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/platform/navigation-summary", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then((response) => response.ok ? response.json() as Promise<NavigationSummary> : null)
      .then((summary) => {
        if (summary?.badges) setNavigationBadges(summary.badges);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    function handleModuleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as { type?: string; href?: string } | null;
      if (payload?.type !== "operations-platform:navigate") return;
      if (!payload.href?.startsWith("/platform/")) return;
      router.push(payload.href);
    }
    window.addEventListener("message", handleModuleMessage);
    return () => window.removeEventListener("message", handleModuleMessage);
  }, [router]);

  const context = useMemo(() => {
    if (pathname === "/platform/workbench") {
      return locale === "en-GB"
        ? ["My Workspace", "Cross-module tasks and exceptions"]
        : ["我的工作台", "跨模块待办与异常"];
    }
    const module = findPlatformModule(pathname);
    if (!module) return locale === "en-GB" ? ["Operations Hub", "Unified workspace"] : ["运营协同平台", "统一工作区"];
    const group = platformModuleGroups.find((entry) => entry.key === module.group);
    const groupLabel = locale === "en-GB" ? group?.en : group?.zh;
    return [
      `${groupLabel || ""} / ${platformModuleLabel(module, locale)}`,
      platformModuleDescription(module, locale)
    ];
  }, [locale, pathname]);

  const visibleGroups = platformModuleGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => {
        if (item.protectedModule) {
          const access = protectedModules[item.protectedModule];
          return Boolean(access && access !== "none");
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

  function warmModule(item: PlatformModuleDefinition) {
    router.prefetch(item.href);
    if (!item.embeddedSrc) return;
    const href = item.embeddedSrc.split("#", 1)[0];
    if (document.head.querySelector(`link[data-platform-module-prefetch="${item.key}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.dataset.platformModulePrefetch = item.key;
    document.head.appendChild(link);
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
                const label = platformModuleLabel(item, locale);
                const className = `native-platform-nav-item ${isModuleActive(pathname, item) ? "active" : ""}`;
                const count = navigationBadges[item.key];
                return (
                  <Link
                    className={className}
                    href={item.href}
                    key={item.key}
                    onMouseEnter={() => warmModule(item)}
                    onFocus={() => warmModule(item)}
                  >
                    <span>{label}</span>
                    <span className="native-platform-nav-meta">
                      {typeof count === "number" ? (
                        <small className={count > 0 ? "count active" : "count"}>{count}</small>
                      ) : null}
                      {item.status === "pilot" ? (
                        <small className="pilot">{locale === "en-GB" ? "Pilot" : "试运行"}</small>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="native-platform-sidebar-foot">
          <span aria-hidden="true" />
          <span className="native-platform-release">
            {locale === "en-GB" ? "Unified cloud workspace" : "统一云端工作区"}
            <small title={releaseId}>{releaseId === "local" ? "local" : releaseId.slice(0, 7)}</small>
          </span>
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

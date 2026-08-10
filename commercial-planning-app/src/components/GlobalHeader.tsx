"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppSession } from "@/lib/auth/types";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import {
  formatRoleLabel,
  isNavigationItemActive,
  type ModuleItem
} from "@/lib/navigation";

export function GlobalHeader({
  navigationItems,
  session
}: {
  navigationItems: ModuleItem[];
  session: AppSession | null;
}) {
  const pathname = usePathname() || "/";
  const switchAccountHref = `/auth/login?switchAccount=1&returnTo=${encodeURIComponent(pathname)}`;
  const displayedRole = session?.governanceRole === "platform_owner"
    ? "Platform Owner"
    : session?.governanceRole === "super_admin"
      ? "Super Admin"
      : session
        ? formatRoleLabel(session.role)
        : "";

  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return null;
  }

  if (pathname.startsWith("/auth/")) {
    return (
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1800px] items-center gap-3 px-4 sm:px-5">
          <span className="grid size-9 place-items-center rounded-md bg-slate-900 text-sm font-extrabold text-white">
            OP
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-950">
              {APP_NAME}
            </p>
            <p className="truncate text-xs text-slate-500">
              {APP_DESCRIPTION}
            </p>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 2xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)_auto] 2xl:gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-950">
            {APP_NAME}
          </h1>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {APP_DESCRIPTION}
          </p>
        </div>

        <nav
          aria-label="Platform navigation"
          className="order-3 col-span-1 flex min-w-0 flex-nowrap gap-2 overflow-x-auto border-t border-slate-100 pt-3 sm:col-span-2 2xl:order-none 2xl:col-span-1 2xl:justify-center 2xl:overflow-visible 2xl:border-0 2xl:pt-0"
        >
          {navigationItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-600 sm:flex-nowrap sm:justify-end">
          {session ? (
            <>
              <div className="flex min-w-0 items-center gap-2 pr-1">
                <span
                  className="max-w-40 truncate whitespace-nowrap font-medium text-slate-800"
                  title={session.name}
                >
                  {session.email}
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {displayedRole}
                </span>
              </div>
              <a
                href={switchAccountHref}
                className="shrink-0 whitespace-nowrap rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                Switch account
              </a>
              <a
                href="/auth/logout"
                className="shrink-0 whitespace-nowrap rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                Sign out
              </a>
            </>
          ) : (
            <Link
              href="/auth/login?switchAccount=1&returnTo=%2Fplatform%2Fworkbench"
              prefetch={false}
              className="shrink-0 whitespace-nowrap rounded-md bg-slate-950 px-3 py-2 font-semibold text-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

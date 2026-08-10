import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const platformShell = readFileSync(
  new URL("../../../cloud-app/index.html", import.meta.url),
  "utf8"
);

describe("commercial planning platform shell performance", () => {
  it("serves the complete product roadmap through a same-origin platform module", () => {
    const roadmapIndex = readFileSync(
      new URL("../../public/roadmap/index.html", import.meta.url),
      "utf8"
    );
    const roadmapApp = readFileSync(
      new URL("../../public/roadmap/app.js", import.meta.url),
      "utf8"
    );

    expect(platformShell).toContain('data-module="roadmap"');
    expect(platformShell).toContain('const access = roadmapPermissionForUser()');
    expect(platformShell).toContain('?embedded=1&lang=${language}&access=${access}');
    expect(platformShell).toContain("roadmap: renderRoadmapWorkspace");
    expect(roadmapIndex).toContain('data-vertical-mode="structure"');
    expect(roadmapIndex).toContain('data-vertical-mode="precise"');
    expect(roadmapApp).toContain('const SOURCE_URL = "data/roadmap-baseline.json"');
    expect(roadmapApp).toContain('const MASTER_DATA_URL = "data/master-products.json"');
    expect(roadmapApp).toContain('const STORAGE_KEY = "productRoadmap.v1"');
    expect(roadmapApp).toContain('const PREFERENCES_KEY = "productRoadmapPreferences.v1"');
    expect(roadmapApp).toContain("const ROADMAP_SCHEMA_VERSION = 3");
    expect(roadmapApp).toContain('function sharedRoadmapState');
    expect(roadmapApp).toContain('function canManageRoadmap');
    expect(roadmapApp).toContain('function ensureUniqueProductIds()');
    expect(roadmapApp).toContain('function migrateSlideProductReferences');
    expect(roadmapApp).toContain('function migrateVersionSnapshotIds');
    expect(roadmapIndex).toContain('id="addProductButton"');
    expect(roadmapIndex).not.toContain('class="roadmap-sync-compact"');
    expect(roadmapIndex).not.toContain('id="roadmapSyncStatus"');
    expect(roadmapIndex).not.toContain('class="source-notice"');
    expect(roadmapApp).toContain('function productMatchesSearch');
    expect(roadmapApp).toContain('function deleteRoadmapProduct');
    expect(roadmapApp).toContain('data-delete-roadmap-product');
    expect(roadmapApp).toContain('["2024 H1", LEGACY_YEAR_TIMELINE[2024].h1]');
    expect(roadmapApp).toContain('["2024 H2", LEGACY_YEAR_TIMELINE[2024].h2]');
    expect(roadmapApp).toContain('["2025 H1", LEGACY_YEAR_TIMELINE[2025].h1]');
    expect(roadmapApp).toContain('["2025 H2", LEGACY_YEAR_TIMELINE[2025].h2]');
    expect(roadmapApp).toContain('return `${year} H${today.getMonth() < 6 ? 1 : 2}`');
    expect(roadmapApp).toContain("return range.h2");
    expect(roadmapApp).toContain('document.documentElement.classList.toggle("embedded", EMBEDDED_MODE)');
  });

  it("uses canonical routes and embedded content without exposing another shell", () => {
    const nativeShell = readFileSync(
      join(process.cwd(), "src/components/platform/PlatformShell.tsx"),
      "utf8"
    );
    const moduleRegistry = readFileSync(
      join(process.cwd(), "src/lib/platform/modules.ts"),
      "utf8"
    );
    const embeddedPage = readFileSync(
      join(process.cwd(), "src/app/platform/[...modulePath]/page.tsx"),
      "utf8"
    );

    expect(moduleRegistry).toContain('href: "/platform/planning/projects"');
    expect(moduleRegistry).toContain('href: "/platform/planning/forecast"');
    expect(moduleRegistry).toContain('?embedded=1#module=shipmentSummary');
    expect(moduleRegistry).toContain('href: "/platform/business/analysis"');
    expect(moduleRegistry).toContain('?embedded=1#module=bp');
    expect(moduleRegistry).toContain('?embedded=1#module=projects');
    expect(moduleRegistry).toContain('?embedded=1#module=forecast');
    expect(nativeShell).not.toContain('legacy?: boolean');
    expect(nativeShell).not.toContain('/platform/index.html#module=');
    expect(nativeShell).toContain('operations-platform:navigate');
    expect(nativeShell).toContain('operationsPlanningSidebarCollapsed.v1');
    expect(nativeShell).toContain('native-platform-sidebar-toggle');
    expect(embeddedPage).toContain('findEmbeddedPlatformModule');
    expect(embeddedPage).toContain('requireUser(pathname)');
  });

  it("enforces protected navigation and Master Data access outside role inheritance", () => {
    const nativeShell = readFileSync(
      join(process.cwd(), "src/components/platform/PlatformShell.tsx"),
      "utf8"
    );
    const moduleRegistry = readFileSync(
      join(process.cwd(), "src/lib/platform/modules.ts"),
      "utf8"
    );
    const authServer = readFileSync(
      join(process.cwd(), "src/lib/auth/server.ts"),
      "utf8"
    );

    expect(platformShell).toContain('protectedModulePermissionForUser("roadmap"');
    expect(platformShell).toContain('protectedModulePermissionForUser("master_data"');
    expect(moduleRegistry).toContain('protectedModule: "roadmap"');
    expect(moduleRegistry).toContain('protectedModule: "master_data"');
    expect(nativeShell).toContain('protectedModules[item.protectedModule]');
    expect(authServer).toContain("getCurrentProtectedModulePermissions");
    expect(authServer).toContain('getProtectedModulePermission("master_data")');
    expect(authServer).toContain('getProtectedModulePermission("master_data")) === "manage"');
  });

  it("prefetches canonical routes and same-origin module runtimes on intent", () => {
    expect(platformShell).toContain("scheduleCommercialPlanningIntentPreload");
    expect(platformShell).toContain('document.visibilityState !== "visible"');
    expect(platformShell).toContain('link.rel = "prefetch"');
    expect(platformShell).not.toContain("commercialPlanningFrames");
    expect(platformShell).not.toContain("ensureCommercialPlanningFrame");
    expect(platformShell).not.toContain('document.createElement("iframe")');
    expect(platformShell).not.toContain("activateCommercialPlanningWorkspace");
    const nativeShell = readFileSync(
      join(process.cwd(), "src/components/platform/PlatformShell.tsx"),
      "utf8"
    );
    expect(nativeShell).toContain("router.prefetch(item.href)");
    expect(nativeShell).toContain("if (session) router.prefetch(item.href)");
    expect(nativeShell).toContain("prefetch={false}");
    expect(nativeShell).toContain('link.rel = "prefetch"');
  });

  it("restores legacy module navigation and redirects native modules before rendering", () => {
    expect(platformShell).toContain("OPERATIONS_PLATFORM_CANONICAL_ROUTES");
    expect(platformShell).toContain('params.get("embedded") === "1"');
    expect(platformShell).toContain('window.location.replace(target)');
    expect(platformShell).toContain("platformNavigationFromHash");
    expect(platformShell).toContain("storedPlatformNavigation");
    expect(platformShell).toContain("persistPlatformNavigation");
    expect(platformShell).toContain("applyPlatformNavigation();\n    const initialNativeRoute = nativePlatformRouteFor(activeModule);");
    expect(platformShell).toContain("window.location.replace(initialNativeRoute)");
    expect(platformShell).toContain("persistPlatformNavigation({ replace: true });\n    renderApp();");
    expect(platformShell).toContain('get("permissions") === "1"');
    expect(platformShell).toContain("void loadMasterDataOptions().then(() => {");
  });

  it("leaves deep-link authentication to each native page", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/app/platform/layout.tsx"),
      "utf8"
    );

    expect(layout).toContain("getCurrentSession");
    expect(layout).not.toContain('requireUser("/platform/workbench")');
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const platformShell = readFileSync(
  new URL("../../public/platform/index.html", import.meta.url),
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
    expect(roadmapApp).toContain('document.documentElement.classList.toggle("embedded", EMBEDDED_MODE)');
  });

  it("opens copied commercial modules through native platform routes", () => {
    expect(platformShell).toContain("const nativePlatformModuleRoutes = {");
    expect(platformShell).toContain('"business-bp": "/platform/business/bp"');
    expect(platformShell).toContain('"promo-approvals": "/platform/collaboration/monthly-approvals"');
    expect(platformShell).toContain('"other-approvals": "/platform/collaboration/other-approvals"');
    expect(platformShell).toContain('system: "/platform/system/master-data"');
    expect(platformShell).toContain('window.location.assign(nativeRoute)');
  });

  it("prefetches native workspaces on intent without creating embedded documents", () => {
    expect(platformShell).toContain("scheduleCommercialPlanningIntentPreload");
    expect(platformShell).toContain('document.visibilityState !== "visible"');
    expect(platformShell).toContain('link.rel = "prefetch"');
    expect(platformShell).not.toContain("commercialPlanningFrames");
    expect(platformShell).not.toContain("ensureCommercialPlanningFrame");
    expect(platformShell).not.toContain('document.createElement("iframe")');
    expect(platformShell).not.toContain("activateCommercialPlanningWorkspace");
  });

  it("restores legacy module navigation and redirects native modules before rendering", () => {
    expect(platformShell).toContain("platformNavigationFromHash");
    expect(platformShell).toContain("storedPlatformNavigation");
    expect(platformShell).toContain("persistPlatformNavigation");
    expect(platformShell).toContain("applyPlatformNavigation();\n    const initialNativeRoute = nativePlatformRouteFor(activeModule);");
    expect(platformShell).toContain("window.location.replace(initialNativeRoute)");
    expect(platformShell).toContain("persistPlatformNavigation({ replace: true });\n    renderApp();\n    void loadMasterDataOptions()");
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

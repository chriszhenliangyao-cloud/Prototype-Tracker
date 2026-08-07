import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const platformShell = readFileSync(
  new URL("../../public/platform/index.html", import.meta.url),
  "utf8"
);

describe("commercial planning platform shell performance", () => {
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

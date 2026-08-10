import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overviewSource = readFileSync(
  new URL("../../../erp-native-local-test/assets/business-overview.js", import.meta.url),
  "utf8"
);
const nativeIndex = readFileSync(
  new URL("../../../erp-native-local-test/index.html", import.meta.url),
  "utf8"
);
const shellSource = readFileSync(
  new URL("../../../erp-native-local-test/assets/platform-shell.js", import.meta.url),
  "utf8"
);
const reviewSource = readFileSync(
  new URL("../../../erp-native-local-test/assets/business-review.js", import.meta.url),
  "utf8"
);
const workspaceStyles = readFileSync(
  new URL("../../../erp-native-local-test/assets/business-workspaces.css", import.meta.url),
  "utf8"
);
const platformRegistry = readFileSync(
  new URL("./platform/modules.ts", import.meta.url),
  "utf8"
);

describe("linked business overview", () => {
  it("registers the overview as a first-class native module", () => {
    expect(overviewSource).toContain("window.Modules.overview = { render }");
    expect(nativeIndex).toContain('data-module="overview"');
    expect(nativeIndex).toContain('"assets/business-overview.js?v=20260810-business-dashboard-1"');
    expect(shellSource).toContain("titleZh: \"经营总览\"");
    expect(platformRegistry).toContain('embeddedSrc: "/platform-native/index.html?embedded=1#module=overview"');
  });

  it("aggregates confirmed business contracts and current shared team documents", () => {
    expect(overviewSource).toContain("M.confirmedResults");
    expect(overviewSource).toContain('const projectStorageKey = "projectTrackingData.v1"');
    expect(overviewSource).toContain('const marketingStorageKey = "marketingAssets.v1"');
    expect(overviewSource).toContain("BP达成");
    expect(overviewSource).toContain("预测管理");
    expect(overviewSource).toContain("物流交付");
    expect(overviewSource).toContain("项目跟进");
    expect(overviewSource).toContain("营销物料");
    expect(overviewSource).toContain("结算台账");
  });

  it("exposes traceable exception actions without writing source data", () => {
    expect(overviewSource).toContain("function showActions()");
    expect(overviewSource).toContain("关键异常与行动");
    expect(overviewSource).toContain("查看来源");
    expect(overviewSource).toContain("更新行动");
    expect(overviewSource).toContain("draft: {");
    expect(reviewSource).toContain('S.consumeNavigationContext("performance")');
    expect(reviewSource).toContain('context.view === "actions"');
    expect(reviewSource).toContain('openActionDetail(-1, context.draft || null)');
    expect(overviewSource).toContain("经营总览为只读聚合视图");
    expect(overviewSource).not.toContain("localStorage.setItem");
    expect(overviewSource).not.toMatch(/fetch\([^)]*,\s*\{[^}]*method:\s*["'](?:POST|PUT|PATCH|DELETE)/s);
  });

  it("keeps the overview and action workspace responsive", () => {
    expect(workspaceStyles).toContain(".bo-primary-grid");
    expect(workspaceStyles).toContain(".bo-market-table");
    expect(workspaceStyles).toContain(".bo-action-modal");
    expect(workspaceStyles).toContain(".bo-action-row");
    expect(workspaceStyles).toContain("@media (max-width: 760px)");
  });
});

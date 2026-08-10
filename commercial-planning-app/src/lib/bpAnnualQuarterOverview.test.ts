import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../erp-native-local-test/assets/bp-achievement.js", import.meta.url),
  "utf8"
);
const sourceStyles = readFileSync(
  new URL("../../../erp-native-local-test/assets/business-workspaces.css", import.meta.url),
  "utf8"
);
const syncScript = readFileSync(
  new URL("../../scripts/sync-platform-shell.mjs", import.meta.url),
  "utf8"
);

describe("BP annual and quarterly integrated overview", () => {
  it("keeps the annual cockpit fixed while a quarter drives the detail view", () => {
    expect(source).toContain("function annualCockpit()");
    expect(source).toContain("result(state.scope, annualMonths())");
    expect(source).toContain("selectedQuarter ? quarterDetail(selectedQuarter) : null");
    expect(source).toContain("查看全年明细");
  });

  it("uses effective PO plus confirmed forecasts for annual and quarter projections", () => {
    expect(source).toContain("function projectionForMonths(selectedScope, selectedMonths)");
    expect(source).toContain("forecastMetricForMonth(selectedScope, month)");
    expect(source).toContain("projected += Math.max(booked, forecast)");
    expect(source).toContain("实际 + 确认预测");
  });

  it("treats future quarters as neutral and exposes the quarter-to-annual drilldown", () => {
    expect(source).toContain('if (timing === "future") return { label: "未开始", tone: "gray", barTone: "gray" }');
    expect(source).toContain("function quarterMonthlyChart(quarter)");
    expect(source).toContain("function quarterImpact(quarter)");
    expect(source).toContain("查看该季度市场与产品缺口");
  });

  it("defines responsive styles and keeps the native asset sync pipeline", () => {
    expect(sourceStyles).toContain(".bp-annual-cockpit");
    expect(sourceStyles).toContain(".bp-quarter-detail-grid");
    expect(syncScript).toContain('resolve(nativeWorkspaceSourceRoot, "assets")');
    expect(syncScript).toContain('resolve(nativeWorkspaceDestination, "assets")');
  });
});

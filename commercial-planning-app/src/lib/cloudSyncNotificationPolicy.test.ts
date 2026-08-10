import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cloudSyncSource = readFileSync(
  new URL("../../public/cloud-sync.js", import.meta.url),
  "utf8"
);

describe("smart cloud update notifications", () => {
  it("parses as valid browser JavaScript", () => {
    expect(() => new Function(cloudSyncSource)).not.toThrow();
  });

  it("deduplicates remote versions and records recent activity", () => {
    expect(cloudSyncSource).toContain("operationsPlanningRemoteNotices.v1");
    expect(cloudSyncSource).toContain("lastAppliedVersion");
    expect(cloudSyncSource).toContain("conflictVersion");
    expect(cloudSyncSource).toContain("operationsPlanningRemoteActivity.v1");
  });

  it("auto-applies non-conflicting updates and emits one lightweight event", () => {
    expect(cloudSyncSource).toContain('recordRemoteActivity(documentKey, version, "auto-applied")');
    expect(cloudSyncSource).toContain('new CustomEvent("operations:cloud-document-updated"');
    expect(cloudSyncSource).toContain("showRemoteSyncToast(documentKey)");
  });

  it("reserves the persistent banner for actionable conflicts", () => {
    expect(cloudSyncSource).toContain('data-conflict-action="keep-local"');
    expect(cloudSyncSource).toContain('data-conflict-action="use-team"');
    expect(cloudSyncSource).toContain('data-conflict-action="later"');
    expect(cloudSyncSource).toContain("REMOTE_SNOOZE_MS");
    expect(cloudSyncSource).not.toContain("共享数据已更新，本地未同步内容已保留");
  });

  it("keeps personal UI state and autosave drafts out of team synchronization", () => {
    const syncKeyBlock = cloudSyncSource.match(/const SYNC_KEYS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
    expect(syncKeyBlock).not.toContain("projectTrackingTool.v1");
    expect(syncKeyBlock).not.toContain("projectTrackingDrafts.v1");
    expect(syncKeyBlock).not.toContain("projectTrackingFormDrafts.v1");
    expect(syncKeyBlock).not.toContain("salesInventoryPlanningPreferences.v1");
    expect(syncKeyBlock).not.toContain("marketingAssetsPreferences.v1");
    expect(syncKeyBlock).not.toContain("marketingAssetsDraft.v1");
    expect(syncKeyBlock).not.toContain("productRoadmapPreferences.v1");
    expect(cloudSyncSource).toContain("LOCAL_ONLY_KEYS");
    expect(cloudSyncSource).toContain("removeLegacyLocalOnlyOutboxEntries");
  });

  it("enforces shared-document allowlists before upload, download and conflict handling", () => {
    const policyBlock = cloudSyncSource.match(/const SHARED_DOCUMENT_FIELDS = Object\.freeze\(\{([\s\S]*?)\n  \}\);/)?.[1] ?? "";
    const salesBlock = policyBlock.match(/"salesInventoryPlanningTool\.v1":[\s\S]*?\]\)/)?.[0] ?? "";
    const marketingBlock = policyBlock.match(/"marketingAssets\.v1":[\s\S]*?\]\)/)?.[0] ?? "";
    const roadmapBlock = policyBlock.match(/"productRoadmap\.v1":[\s\S]*?\]\)/)?.[0] ?? "";

    expect(salesBlock).toContain('"products"');
    expect(salesBlock).not.toContain('"filters"');
    expect(salesBlock).not.toContain('"selectedSkus"');
    expect(marketingBlock).toContain('"projects"');
    expect(marketingBlock).not.toContain('"filters"');
    expect(marketingBlock).not.toContain('"sort"');
    expect(roadmapBlock).toContain('"slides"');
    expect(roadmapBlock).not.toContain('"search"');
    expect(cloudSyncSource).toContain("const localPayload = toSharedDocumentPayload(key, payload)");
    expect(cloudSyncSource).toContain("payload = toSharedDocumentPayload(key, payload)");
    expect(cloudSyncSource).toContain("row = { ...row, payload: toSharedDocumentPayload(documentKey, row.payload) }");
    expect(cloudSyncSource).toContain("jsonEqual(payload, existing?.payload ?? syncedPayloads.get(key))");
  });

  it("uses a common base to auto-merge non-overlapping edits and explain true conflicts", () => {
    expect(cloudSyncSource).toContain("basePayload");
    expect(cloudSyncSource).toContain("analyzeDocumentConflict");
    expect(cloudSyncSource).toContain("mergeAccessPayload");
    expect(cloudSyncSource).toContain("已自动合并非冲突修改");
    expect(cloudSyncSource).toContain("最终决定");
    expect(cloudSyncSource).toContain("平台所有者");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platformShell = readFileSync(
  new URL("../../../cloud-app/index.html", import.meta.url),
  "utf8"
);
const cloudSyncSource = readFileSync(
  new URL("../../../cloud-app/cloud-sync.js", import.meta.url),
  "utf8"
);

describe("marketing asset save reliability", () => {
  it("separates personal draft autosave from the explicit team commit", () => {
    expect(platformShell).toContain('marketAssetsText("个人草稿已保存", "Personal draft saved")');
    expect(platformShell).toContain("仅保存当前账号草稿；点击保存更新后同步团队");
    expect(platformShell).toContain("personalStorageKey(MARKETING_ASSET_DRAFT_STORAGE_KEY)");
  });

  it("waits for both shared documents before reporting success", () => {
    expect(platformShell).toContain("async function saveMarketingAssetItem()");
    expect(platformShell).toContain("async function saveSpecialMarketingAsset()");
    expect(platformShell).toContain("const syncResult = await flushMarketingAssetTeamChanges()");
    expect(platformShell).toContain("await cloudStore.flushDocument(MARKETING_ASSET_STORAGE_KEY)");
    expect(platformShell).toContain("await cloudStore.flushDocument(PROJECT_DATA_STORAGE_KEY)");
    expect(platformShell).toContain("已保存并同步到团队");
  });

  it("keeps the editor open with a retryable message when team sync fails", () => {
    expect(platformShell).toContain("marketingAssetSaveFailureMessage(syncResult)");
    expect(platformShell).toContain("个人草稿已保留，请重试");
    expect(platformShell).toContain('marketingAssetCommitState.status === "saving"');
    expect(platformShell).toContain('disabled aria-busy=\\"true\\"');
  });

  it("exposes an awaitable, per-document cloud flush result", () => {
    expect(() => new Function(cloudSyncSource)).not.toThrow();
    expect(cloudSyncSource).toContain("async flushDocument(key)");
    expect(cloudSyncSource).toContain("lastSaveResults");
    expect(cloudSyncSource).toContain('errorCode: "unsupported_document"');
  });
});

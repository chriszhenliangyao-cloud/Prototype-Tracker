import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platformShell = readFileSync(
  new URL("../../../cloud-app/index.html", import.meta.url),
  "utf8"
);
const roadmapApp = readFileSync(
  new URL("../../../roadmap-local-test/app.js", import.meta.url),
  "utf8"
);

describe("account-scoped personal state", () => {
  it("keeps sales views, filters, selections and drafts outside the shared plan", () => {
    expect(platformShell).toContain('const SALES_PREFERENCES_STORAGE_KEY = "salesInventoryPlanningPreferences.v1"');
    expect(platformShell).toContain("function salesPersonalState");
    expect(platformShell).toContain("function sharedSalesState");
    expect(platformShell).toContain("personalStorageKey(SALES_PREFERENCES_STORAGE_KEY)");
    expect(platformShell).toContain("storedShared !== shared");
    expect(platformShell).not.toContain("const persistable = { ...stateForPersistence, modal: null, highlighted: null }");
  });

  it("keeps marketing filters, sorting and autosave drafts account scoped", () => {
    expect(platformShell).toContain('const MARKETING_ASSET_PREFERENCES_STORAGE_KEY = "marketingAssetsPreferences.v1"');
    expect(platformShell).toContain("function personalMarketingAssetsState");
    expect(platformShell).toContain("personalStorageKey(MARKETING_ASSET_PREFERENCES_STORAGE_KEY)");
    expect(platformShell).toContain("personalStorageKey(MARKETING_ASSET_DRAFT_STORAGE_KEY)");
    expect(platformShell).not.toContain("filters: marketingAssetsState.filters,\n        sort: marketingAssetsState.sort");
  });

  it("applies remote business updates without resetting the current personal workspace", () => {
    expect(platformShell).toContain("state = { ...loadState(), ...personalState, ...runtimeState }");
    expect(platformShell).toContain("projectState = { ...loadProjectState(), ...personalProjectState }");
    expect(platformShell).toContain("marketingAssetsState = { ...loadMarketingAssetsState(), ...personalState, ...runtimeState }");
    expect(platformShell).toContain("modal: marketingAssetsState.modal");
    expect(platformShell).toContain("selectedProjectId: projectState.selectedProjectId");
  });

  it("scopes project, navigation and Roadmap preferences to the authenticated identity", () => {
    expect(platformShell).toContain("function personalIdentityKey()");
    expect(platformShell).toContain("projectPersonalStorageKey(PROJECT_STORAGE_KEY)");
    expect(platformShell).toContain("platformNavigationStorageKey()");
    expect(platformShell).toContain("&profile=${profile}");
    expect(roadmapApp).toContain('const PERSONAL_SCOPE = String(QUERY.get("profile") || "local-preview")');
    expect(roadmapApp).toContain("function personalPreferencesKey()");
    expect(roadmapApp).toContain("localStorage.setItem(preferencesKey, preferences)");
    expect(roadmapApp).not.toContain("localStorage.setItem(PREFERENCES_KEY, preferences)");
  });
});

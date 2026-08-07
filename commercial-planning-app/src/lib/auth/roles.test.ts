import { describe, expect, it } from "vitest";
import {
  canAddQuickSimulationToFormalList,
  canAssignUserRole,
  canBypassPromotionPlanLocks,
  canEditMasterData,
  canManageUserCountryAccess,
  canManagePromotionPlanApprovalHistory,
  canViewAllCountries,
  canSaveScenario,
  mapCognitoGroupsToRole
} from "./roles";

describe("auth roles", () => {
  it("maps Cognito groups to the strongest matching app role", () => {
    expect(mapCognitoGroupsToRole(["VIEWER"])).toBe("VIEWER");
    expect(mapCognitoGroupsToRole(["KA_OWNER", "VIEWER"])).toBe("KA_OWNER");
    expect(mapCognitoGroupsToRole(["FINANCE", "VIEWER"])).toBe("FINANCE");
    expect(mapCognitoGroupsToRole(["SALES_MANAGER", "ADMIN"])).toBe("ADMIN");
    expect(mapCognitoGroupsToRole(["SALES_MANAGER", "GM"])).toBe("GM");
    expect(mapCognitoGroupsToRole(["GTM_LEADER", "GM"])).toBe("GTM_LEADER");
    expect(mapCognitoGroupsToRole(["OWNER", "GTM_LEADER"])).toBe("OWNER");
  });

  it("defaults unknown or empty groups to VIEWER", () => {
    expect(mapCognitoGroupsToRole([])).toBe("VIEWER");
    expect(mapCognitoGroupsToRole(["commercial-team"])).toBe("VIEWER");
  });

  it("allows only platform administrators to edit full master data", () => {
    expect(canEditMasterData("OWNER")).toBe(true);
    expect(canEditMasterData("GTM_LEADER")).toBe(true);
    expect(canEditMasterData("ADMIN")).toBe(true);
    expect(canEditMasterData("GM")).toBe(false);
    expect(canEditMasterData("FINANCE")).toBe(false);
    expect(canEditMasterData("SALES_MANAGER")).toBe(false);
    expect(canEditMasterData("KA_OWNER")).toBe(false);
    expect(canEditMasterData("VIEWER")).toBe(false);
  });

  it("allows commercial owners to save scenarios", () => {
    expect(canSaveScenario("OWNER")).toBe(true);
    expect(canSaveScenario("GTM_LEADER")).toBe(true);
    expect(canSaveScenario("GM")).toBe(true);
    expect(canSaveScenario("ADMIN")).toBe(true);
    expect(canSaveScenario("FINANCE")).toBe(true);
    expect(canSaveScenario("SALES_MANAGER")).toBe(true);
    expect(canSaveScenario("KA_OWNER")).toBe(true);
    expect(canSaveScenario("VIEWER")).toBe(false);
  });

  it("allows only platform administrators to add quick simulations to the formal list", () => {
    expect(canAddQuickSimulationToFormalList("OWNER")).toBe(true);
    expect(canAddQuickSimulationToFormalList("GTM_LEADER")).toBe(true);
    expect(canAddQuickSimulationToFormalList("ADMIN")).toBe(true);
    expect(canAddQuickSimulationToFormalList("GM")).toBe(false);
    expect(canAddQuickSimulationToFormalList("FINANCE")).toBe(false);
    expect(canAddQuickSimulationToFormalList("SALES_MANAGER")).toBe(false);
    expect(canAddQuickSimulationToFormalList("KA_OWNER")).toBe(false);
    expect(canAddQuickSimulationToFormalList("VIEWER")).toBe(false);
  });

  it("separates all-country visibility from module operation rights", () => {
    expect(canViewAllCountries("OWNER")).toBe(true);
    expect(canViewAllCountries("GTM_LEADER")).toBe(true);
    expect(canViewAllCountries("GM")).toBe(true);
    expect(canViewAllCountries("ADMIN")).toBe(true);
    expect(canViewAllCountries("FINANCE")).toBe(false);
    expect(canViewAllCountries("SALES_MANAGER")).toBe(false);
    expect(canViewAllCountries("KA_OWNER")).toBe(false);
    expect(canViewAllCountries("VIEWER")).toBe(false);
  });

  it("keeps historical approval status management owner-only", () => {
    expect(canManagePromotionPlanApprovalHistory("OWNER")).toBe(true);
    expect(canManagePromotionPlanApprovalHistory("GTM_LEADER")).toBe(false);
    expect(canManagePromotionPlanApprovalHistory("ADMIN")).toBe(false);
    expect(canManagePromotionPlanApprovalHistory("GM")).toBe(false);
    expect(canManagePromotionPlanApprovalHistory("SALES_MANAGER")).toBe(false);
    expect(canManagePromotionPlanApprovalHistory("KA_OWNER")).toBe(false);
  });

  it("protects the owner role from non-owner administrators", () => {
    expect(canAssignUserRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignUserRole("OWNER", "GTM_LEADER")).toBe(true);
    expect(canAssignUserRole("GTM_LEADER", "GM")).toBe(true);
    expect(canAssignUserRole("GTM_LEADER", "OWNER")).toBe(false);
    expect(canAssignUserRole("ADMIN", "FINANCE")).toBe(true);
    expect(canAssignUserRole("ADMIN", "OWNER")).toBe(false);
  });

  it.each([
    ["OWNER", true, true, true, true, true],
    ["GTM_LEADER", true, true, true, true, true],
    ["GM", true, true, false, false, false],
    ["ADMIN", true, true, true, true, true],
    ["FINANCE", false, true, false, false, false],
    ["SALES_MANAGER", false, true, false, false, false],
    ["KA_OWNER", false, true, false, false, false],
    ["VIEWER", false, false, false, false, false]
  ] as const)(
    "keeps the complete base permission profile stable for %s",
    (
      role,
      allCountries,
      saveWorkspace,
      masterData,
      userAccessAdmin,
      bypassLocks
    ) => {
      expect(canViewAllCountries(role)).toBe(allCountries);
      expect(canSaveScenario(role)).toBe(saveWorkspace);
      expect(canEditMasterData(role)).toBe(masterData);
      expect(canManageUserCountryAccess(role)).toBe(userAccessAdmin);
      expect(canBypassPromotionPlanLocks(role)).toBe(bypassLocks);
    }
  );
});

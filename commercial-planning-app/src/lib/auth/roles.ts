import type { UserCountryAccessOption, UserRole } from "@/lib/types";
import {
  canApprovePromotionPlanWithCapabilities,
  getPromotionPlanApproverCapabilities
} from "../promotionPlanApprovalWorkflow";

const roleStrength: UserRole[] = [
  "VIEWER",
  "KA_OWNER",
  "SALES_MANAGER",
  "FINANCE",
  "GM",
  "ADMIN",
  "GTM_LEADER",
  "OWNER"
];

const allCountryRoles = new Set<UserRole>([
  "OWNER",
  "GTM_LEADER",
  "GM",
  "ADMIN"
]);
const masterDataRoles = new Set<UserRole>(["OWNER", "GTM_LEADER", "ADMIN"]);
const scenarioSaveRoles = new Set<UserRole>([
  "OWNER",
  "GTM_LEADER",
  "GM",
  "ADMIN",
  "FINANCE",
  "SALES_MANAGER",
  "KA_OWNER"
]);
export function mapCognitoGroupsToRole(groups: string[]): UserRole {
  const normalizedGroups = new Set(groups.map((group) => group.toUpperCase()));

  for (const role of [...roleStrength].reverse()) {
    if (normalizedGroups.has(role)) {
      return role;
    }
  }

  return "VIEWER";
}

export function canEditMasterData(role: UserRole) {
  return masterDataRoles.has(role);
}

export function canViewAllCountries(role: UserRole) {
  return allCountryRoles.has(role);
}

export function canSaveScenario(role: UserRole) {
  return scenarioSaveRoles.has(role);
}

export function canApprovePromotionPlan(
  role: UserRole,
  email?: string | null,
  accessRows?: UserCountryAccessOption[]
) {
  return canApprovePromotionPlanWithCapabilities(
    getPromotionPlanApproverCapabilities({ role, email, accessRows })
  );
}

export function canManageUserCountryAccess(role: UserRole) {
  return role === "OWNER" || role === "GTM_LEADER" || role === "ADMIN";
}

export function canAddQuickSimulationToFormalList(role: UserRole) {
  return canEditMasterData(role);
}

export function canBypassPromotionPlanLocks(role: UserRole) {
  return role === "OWNER" || role === "GTM_LEADER" || role === "ADMIN";
}

export function canManagePromotionPlanApprovalHistory(role: UserRole) {
  return role === "OWNER";
}

export function canAssignUserRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "OWNER") {
    return true;
  }
  if (!canManageUserCountryAccess(actorRole)) {
    return false;
  }
  return targetRole !== "OWNER";
}

export function isUserRole(value: string): value is UserRole {
  return roleStrength.includes(value as UserRole);
}

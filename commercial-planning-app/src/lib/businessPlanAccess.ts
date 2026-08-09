import type { PromotionPlanStatus } from "./types";

export type BusinessPlanLockReason =
  | "submitted"
  | "first approved"
  | "approved"
  | "no country access";

export type BusinessPlanEditState = {
  editable: boolean;
  reason: BusinessPlanLockReason | null;
};

export function getBusinessPlanEditState({
  hasCountryAccess,
  status = "DRAFT"
}: {
  hasCountryAccess: boolean;
  status?: PromotionPlanStatus | null;
}): BusinessPlanEditState {
  if (!hasCountryAccess) {
    return { editable: false, reason: "no country access" };
  }

  if (status === "SUBMITTED") {
    return { editable: false, reason: "submitted" };
  }

  if (status === "FIRST_APPROVED") {
    return { editable: false, reason: "first approved" };
  }

  if (status === "APPROVED") {
    return { editable: false, reason: "approved" };
  }

  return { editable: true, reason: null };
}

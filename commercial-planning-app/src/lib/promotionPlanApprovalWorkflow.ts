import type {
  PromotionPlanStatus,
  UserCountryAccessOption,
  UserRole
} from "./types";

export type PromotionPlanApproverCapabilities = {
  canFirstApprove: boolean;
  canFinalApprove: boolean;
};

type ApproverEnv = {
  [key: string]: string | undefined;
  PROMOTION_PLAN_FIRST_APPROVER_EMAILS?: string;
  PROMOTION_PLAN_FINAL_APPROVER_EMAILS?: string;
};

export function getPromotionPlanApproverCapabilities({
  role,
  email,
  accessRows = [],
  env = process.env
}: {
  role: UserRole;
  email: string | null | undefined;
  accessRows?: UserCountryAccessOption[];
  env?: ApproverEnv;
}): PromotionPlanApproverCapabilities {
  const normalizedEmail = normalizeEmail(email);
  // Owner authority is a platform invariant and cannot be narrowed by an
  // incidental country-level approval assignment.
  if (role === "OWNER") {
    return { canFirstApprove: true, canFinalApprove: true };
  }

  const configuredAccess = accessRows.filter(
    (row) =>
      row.status === "ACTIVE" && normalizeEmail(row.email) === normalizedEmail
  );
  const databaseCapabilities = {
    canFirstApprove: configuredAccess.some(
      (row) => row.approvalRole === "FIRST_APPROVER"
    ),
    canFinalApprove: configuredAccess.some(
      (row) => row.approvalRole === "FINAL_APPROVER"
    )
  };

  if (
    databaseCapabilities.canFirstApprove ||
    databaseCapabilities.canFinalApprove
  ) {
    return databaseCapabilities;
  }

  const firstApproverEmails = parseEmailList(
    env.PROMOTION_PLAN_FIRST_APPROVER_EMAILS
  );
  const finalApproverEmails = parseEmailList(
    env.PROMOTION_PLAN_FINAL_APPROVER_EMAILS
  );
  const hasConfiguredApprovers =
    firstApproverEmails.size > 0 || finalApproverEmails.size > 0;

  if (role === "GTM_LEADER") {
    return { canFirstApprove: true, canFinalApprove: false };
  }

  if (role === "GM") {
    return { canFirstApprove: false, canFinalApprove: true };
  }

  if (role !== "ADMIN") {
    return { canFirstApprove: false, canFinalApprove: false };
  }

  if (!hasConfiguredApprovers) {
    return { canFirstApprove: true, canFinalApprove: true };
  }

  return {
    canFirstApprove: firstApproverEmails.has(normalizedEmail),
    canFinalApprove: finalApproverEmails.has(normalizedEmail)
  };
}

export function canApprovePromotionPlanWithCapabilities(
  capabilities: PromotionPlanApproverCapabilities
) {
  return capabilities.canFirstApprove || capabilities.canFinalApprove;
}

export function resolvePromotionPlanApprovalTransition({
  currentStatus,
  capabilities
}: {
  currentStatus: PromotionPlanStatus | null | undefined;
  capabilities: PromotionPlanApproverCapabilities;
}):
  | { allowed: true; nextStatus: PromotionPlanStatus; stage: "first" | "final" }
  | { allowed: false; message: string } {
  if (currentStatus === "SUBMITTED") {
    if (!capabilities.canFirstApprove) {
      return {
        allowed: false,
        message: capabilities.canFinalApprove
          ? "Final approval requires first approval."
          : "First approval requires the first approver."
      };
    }

    return {
      allowed: true,
      nextStatus: "FIRST_APPROVED",
      stage: "first"
    };
  }

  if (currentStatus === "FIRST_APPROVED") {
    if (!capabilities.canFinalApprove) {
      return {
        allowed: false,
        message: "Final approval requires the second approver."
      };
    }

    return {
      allowed: true,
      nextStatus: "APPROVED",
      stage: "final"
    };
  }

  if (currentStatus === "APPROVED") {
    return { allowed: false, message: "Plan is already approved." };
  }

  if (currentStatus === "REJECTED") {
    return { allowed: false, message: "Plan is rejected." };
  }

  return { allowed: false, message: "Plan must be submitted first." };
}

export function canRejectPromotionPlanWithCapabilities(
  capabilities: PromotionPlanApproverCapabilities
) {
  return capabilities.canFirstApprove || capabilities.canFinalApprove;
}

function parseEmailList(value: string | undefined) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

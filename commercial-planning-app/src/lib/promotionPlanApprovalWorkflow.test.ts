import { describe, expect, test } from "vitest";
import {
  getPromotionPlanApproverCapabilities,
  resolvePromotionPlanApprovalTransition
} from "./promotionPlanApprovalWorkflow";

const reviewerEnv = {
  PROMOTION_PLAN_FIRST_APPROVER_EMAILS: "promo.reviewer1@example.test",
  PROMOTION_PLAN_FINAL_APPROVER_EMAILS: "promo.reviewer2@example.test"
};

describe("promotion plan two-step approval workflow", () => {
  test("first reviewer can only move submitted plans to first approved", () => {
    const capabilities = getPromotionPlanApproverCapabilities({
      role: "ADMIN",
      email: "promo.reviewer1@example.test",
      env: reviewerEnv
    });

    expect(capabilities).toEqual({
      canFirstApprove: true,
      canFinalApprove: false
    });
    expect(
      resolvePromotionPlanApprovalTransition({
        currentStatus: "SUBMITTED",
        capabilities
      })
    ).toEqual({
      allowed: true,
      nextStatus: "FIRST_APPROVED",
      stage: "first"
    });
    expect(
      resolvePromotionPlanApprovalTransition({
        currentStatus: "FIRST_APPROVED",
        capabilities
      })
    ).toEqual({
      allowed: false,
      message: "Final approval requires the second approver."
    });
  });

  test("second reviewer cannot skip first approval and final approval locks the plan", () => {
    const capabilities = getPromotionPlanApproverCapabilities({
      role: "ADMIN",
      email: "promo.reviewer2@example.test",
      env: reviewerEnv
    });

    expect(capabilities).toEqual({
      canFirstApprove: false,
      canFinalApprove: true
    });
    expect(
      resolvePromotionPlanApprovalTransition({
        currentStatus: "SUBMITTED",
        capabilities
      })
    ).toEqual({
      allowed: false,
      message: "Final approval requires first approval."
    });
    expect(
      resolvePromotionPlanApprovalTransition({
        currentStatus: "FIRST_APPROVED",
        capabilities
      })
    ).toEqual({
      allowed: true,
      nextStatus: "APPROVED",
      stage: "final"
    });
  });

  test("database user permissions can assign approvers without admin role", () => {
    expect(
      getPromotionPlanApproverCapabilities({
        role: "VIEWER",
        email: "first.configured@example.test",
        accessRows: [
          userAccess("first.configured@example.test", "GLOBAL", "FIRST_APPROVER")
        ],
        env: {}
      })
    ).toEqual({ canFirstApprove: true, canFinalApprove: false });

    expect(
      getPromotionPlanApproverCapabilities({
        role: "VIEWER",
        email: "final.configured@example.test",
        accessRows: [
          userAccess("final.configured@example.test", "GLOBAL", "FINAL_APPROVER")
        ],
        env: {}
      })
    ).toEqual({ canFirstApprove: false, canFinalApprove: true });
  });

  test("business roles provide default approval stages", () => {
    expect(
      getPromotionPlanApproverCapabilities({
        role: "OWNER",
        email: "owner@example.test",
        env: {}
      })
    ).toEqual({ canFirstApprove: true, canFinalApprove: true });

    expect(
      getPromotionPlanApproverCapabilities({
        role: "GTM_LEADER",
        email: "gtm.leader@example.test",
        env: {}
      })
    ).toEqual({ canFirstApprove: true, canFinalApprove: false });

    expect(
      getPromotionPlanApproverCapabilities({
        role: "GM",
        email: "gm@example.test",
        env: {}
      })
    ).toEqual({ canFirstApprove: false, canFinalApprove: true });
  });

  test("owner keeps both approval stages even when a narrower access row exists", () => {
    expect(
      getPromotionPlanApproverCapabilities({
        role: "OWNER",
        email: "owner@example.test",
        accessRows: [
          userAccess("owner@example.test", "ES", "FIRST_APPROVER")
        ],
        env: {}
      })
    ).toEqual({ canFirstApprove: true, canFinalApprove: true });
  });

  test("country submitter roles do not receive approval capabilities by role", () => {
    for (const role of ["SALES_MANAGER", "KA_OWNER"] as const) {
      expect(
        getPromotionPlanApproverCapabilities({
          role,
          email: `${role.toLowerCase()}@example.test`,
          env: {}
        })
      ).toEqual({ canFirstApprove: false, canFinalApprove: false });
    }
  });
});

function userAccess(
  email: string,
  countryCode: string,
  approvalRole: "FIRST_APPROVER" | "FINAL_APPROVER"
) {
  return {
    id: `${email}-${countryCode}`,
    email,
    label: null,
    countryCode,
    role: "VIEWER" as const,
    approvalRole,
    receivesPromotionPlanEmail: false,
    status: "ACTIVE" as const,
    createdByEmail: "admin@example.test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

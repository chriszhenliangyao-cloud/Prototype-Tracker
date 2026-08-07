import { describe, expect, test } from "vitest";
import {
  buildOtherApprovalEditPlan,
  canManageOtherApprovalRequest,
  canViewOtherApprovalInInbox,
  isPotentialOtherApprovalDuplicate,
  normalizeOtherApprovalWorkflowState,
  resolveOtherApprovalRejectionTransition
} from "./otherApprovalWorkflow";

const firstOnly = { canFirstApprove: true, canFinalApprove: false };
const finalOnly = { canFirstApprove: false, canFinalApprove: true };

describe("other approval workflow", () => {
  test("shows submitted requests to both approvers while preserving sequence", () => {
    expect(
      canViewOtherApprovalInInbox({ status: "SUBMITTED", capabilities: firstOnly })
    ).toBe(true);
    expect(
      canViewOtherApprovalInInbox({ status: "SUBMITTED", capabilities: finalOnly })
    ).toBe(true);
    expect(
      resolveOtherApprovalRejectionTransition({
        currentStatus: "SUBMITTED",
        capabilities: finalOnly
      })
    ).toEqual({
      allowed: false,
      message: "Final review can begin after first approval."
    });
  });

  test("allows rejection only at the approver's current workflow stage", () => {
    expect(
      resolveOtherApprovalRejectionTransition({
        currentStatus: "SUBMITTED",
        capabilities: firstOnly
      })
    ).toEqual({ allowed: true });
    expect(
      resolveOtherApprovalRejectionTransition({
        currentStatus: "FIRST_APPROVED",
        capabilities: finalOnly
      })
    ).toEqual({ allowed: true });
  });

  test("requires re-approval for material corrections and records minor changes", () => {
    const current = {
      title: "Summer offer",
      channelName: "Retail",
      description: "Original description",
      tableData: "Product | Price"
    };

    expect(
      buildOtherApprovalEditPlan({
        current,
        next: { ...current, description: "Corrected description" }
      })
    ).toMatchObject({
      changedFields: ["description"],
      isMaterial: false
    });
    expect(
      buildOtherApprovalEditPlan({
        current,
        next: { ...current, channelName: "Key retail" }
      })
    ).toMatchObject({
      changedFields: ["channelName"],
      isMaterial: true
    });
  });

  test("keeps closed and returned requests out of active approval queues", () => {
    expect(
      normalizeOtherApprovalWorkflowState({ status: "REJECTED", workflowState: null })
    ).toBe("RETURNED_FOR_REVISION");
    expect(
      canViewOtherApprovalInInbox({
        status: "REJECTED",
        workflowState: "REJECTED_CLOSED",
        capabilities: firstOnly
      })
    ).toBe(false);
    expect(
      resolveOtherApprovalRejectionTransition({
        currentStatus: "REJECTED",
        workflowState: "WITHDRAWN",
        capabilities: firstOnly
      })
    ).toEqual({ allowed: false, message: "This request is already closed." });
  });

  test("only treats the same business request as a duplicate", () => {
    const request = {
      countryCode: "ES",
      channelName: "Retail",
      feeType: "Special offer",
      title: "Autumn launch"
    };
    expect(isPotentialOtherApprovalDuplicate({ current: request, candidate: request })).toBe(true);
    expect(
      isPotentialOtherApprovalDuplicate({
        current: request,
        candidate: { ...request, channelName: "Direct" }
      })
    ).toBe(false);
    expect(
      canManageOtherApprovalRequest({
        createdByEmail: "planner@example.test",
        submittedByEmail: null,
        roleCanManageAll: false,
        userEmail: "PLANNER@example.test"
      })
    ).toBe(true);
  });
});

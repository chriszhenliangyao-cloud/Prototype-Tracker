import { describe, expect, test } from "vitest";
import { buildPlatformApprovalTaskInbox } from "./platformApprovalTasks";
import type {
  OtherApprovalRequestOption,
  PromotionPlanApprovalQueueItem
} from "./types";

describe("buildPlatformApprovalTaskInbox", () => {
  test("combines monthly and other approvals with stage-aware email status", () => {
    const monthlyItems: PromotionPlanApprovalQueueItem[] = [
      {
        id: "monthly-1",
        planYear: 2026,
        planMonth: 8,
        countryCode: "DE",
        status: "SUBMITTED",
        submittedByEmail: "sales@example.test",
        submittedAt: "2026-08-04T08:00:00.000Z",
        entryCount: 12,
        stage: "first",
        canApprove: false,
        canReturnForRevision: false,
        updatedAt: "2026-08-04T08:00:00.000Z"
      }
    ];
    const otherItems = [
      otherApproval({
        id: "other-1",
        status: "FIRST_APPROVED",
        title: "Temporary logistics cost approval"
      })
    ];

    const inbox = buildPlatformApprovalTaskInbox({
      monthlyItems,
      otherItems,
      notifications: [
        {
          id: "notification-1",
          requestType: "PROMOTION_PLAN",
          requestId: null,
          planYear: 2026,
          planMonth: 8,
          countryCodes: "DE,FR",
          stage: "FIRST_APPROVAL",
          status: "SENT",
          toEmails: "first@example.test",
          ccEmails: "",
          attemptCount: 1,
          errorMessage: null,
          createdAt: "2026-08-04T08:01:00.000Z",
          updatedAt: "2026-08-04T08:01:00.000Z"
        },
        {
          id: "notification-2",
          requestType: "OTHER_APPROVAL",
          requestId: "other-1",
          planYear: null,
          planMonth: null,
          countryCodes: "DE",
          stage: "FINAL_APPROVAL",
          status: "FAILED",
          toEmails: "final@example.test",
          ccEmails: "",
          attemptCount: 3,
          errorMessage: "SES rejected the message",
          createdAt: "2026-08-05T08:00:00.000Z",
          updatedAt: "2026-08-05T08:05:00.000Z"
        }
      ],
      deliveryStatuses: ["SENT", "FAILED", "PENDING"],
      now: new Date("2026-08-06T08:00:00.000Z")
    });

    expect(inbox.summary).toEqual({
      visibleApprovals: 2,
      actionableApprovals: 1,
      waitingForPreviousStage: 1,
      monthlyPending: 1,
      otherPending: 1,
      emailSent: 1,
      emailPending: 0,
      emailIssues: 1,
      deliveryRecent: 3,
      deliverySent: 1,
      deliveryPending: 1,
      deliveryIssues: 1
    });
    expect(inbox.tasks[0]).toEqual(
      expect.objectContaining({
        id: "other:other-1",
        responsibility: "最终审批",
        statusLabel: "待我最终审批",
        targetRoute: "/platform/collaboration/other-approvals?workspace=other-approvals&requestId=other-1",
        email: expect.objectContaining({
          state: "FAILED",
          label: "发送失败"
        })
      })
    );
    expect(inbox.tasks[1]).toEqual(
      expect.objectContaining({
        id: "monthly:monthly-1",
        statusLabel: "等待一级审批",
        actionable: false,
        targetRoute: "/platform/collaboration/monthly-approvals?year=2026&month=8&country=DE",
        email: expect.objectContaining({ state: "SENT", label: "已发送" })
      })
    );
  });
});

function otherApproval(
  overrides: Partial<OtherApprovalRequestOption>
): OtherApprovalRequestOption {
  return {
    id: "other-1",
    title: "Other approval",
    countryCode: "DE",
    channelName: "Amazon",
    feeType: "Logistics",
    description: "",
    tableData: "",
    status: "SUBMITTED",
    workflowState: "ACTIVE",
    duplicateOfRequestId: null,
    submittedByEmail: "requester@example.test",
    firstApprovedByEmail: null,
    approvedByEmail: null,
    rejectedByEmail: null,
    submittedAt: "2026-08-05T08:00:00.000Z",
    firstApprovedAt: null,
    approvedAt: null,
    rejectedAt: null,
    notes: null,
    createdByEmail: "requester@example.test",
    updatedByEmail: "requester@example.test",
    createdAt: "2026-08-05T08:00:00.000Z",
    updatedAt: "2026-08-05T08:00:00.000Z",
    attachments: [],
    revision: 1,
    audits: [],
    ...overrides
  };
}

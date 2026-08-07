import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type {
  CountryOption,
  OtherApprovalRequestOption,
  PromotionPlanApprovalQueueItem
} from "@/lib/types";
import {
  OtherApprovalsPanel,
  PromotionApprovalPageShell
} from "./PromotionApprovalPageShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/promotion",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

describe("OtherApprovalsPanel", () => {
  test("opens on a blank new request instead of selecting approved history", () => {
    const html = renderToStaticMarkup(
      <OtherApprovalsPanel
        countries={[country()]}
        canManageAllOtherApprovals={false}
        canFinalApprove={false}
        canFirstApprove={false}
        canSaveOtherApprovals={true}
        initialRequests={[approvedRequest()]}
        userEmail="planner@example.test"
      />
    );

    expect(html).toContain("New request");
    expect(html).toContain("My request history");
    expect(html).toContain("Create a new approval request.");
    expect(html).toContain("Approved Sample Request");
    expect(html).not.toContain('value="Approved Sample Request"');
    expect(html).not.toContain("Approved request · Read-only");
  });
});

describe("PromotionApprovalPageShell", () => {
  test("shows the shared approval queue before the module selector", () => {
    const html = renderToStaticMarkup(
      <PromotionApprovalPageShell
        canApproveMonthlyPlan={true}
        canFinalApprove={true}
        canFirstApprove={false}
        canManageApprovalHistory={false}
        canManagePromotionBackfill={false}
        canManageAllOtherApprovals={false}
        canSaveOtherApprovals={true}
        canSeeAllCountries={true}
        countries={[country()]}
        monthlyApprovalQueue={[monthlyQueueItem()]}
        monthlyDeliveryArchives={[]}
        monthlyDeliveryNotifications={[]}
        otherApprovals={[approvedRequest({ status: "SUBMITTED" })]}
        userEmail="planner@example.test"
      >
        <div>Monthly body</div>
      </PromotionApprovalPageShell>
    );

    expect(html.indexOf("Approval queue")).toBeLessThan(
      html.indexOf("Approval workspace")
    );
    expect(html).toContain("Other approvals 1");
    expect(html).toContain("Delivery status");
  });

  test("can open directly on the other approvals workspace", () => {
    const html = renderToStaticMarkup(
      <PromotionApprovalPageShell
        canApproveMonthlyPlan={false}
        canFinalApprove={false}
        canFirstApprove={false}
        canManageApprovalHistory={false}
        canManagePromotionBackfill={false}
        canManageAllOtherApprovals={false}
        canSaveOtherApprovals={true}
        canSeeAllCountries={true}
        countries={[country()]}
        initialModule="other-approvals"
        monthlyApprovalQueue={[]}
        monthlyDeliveryArchives={[]}
        monthlyDeliveryNotifications={[]}
        otherApprovals={[approvedRequest()]}
        userEmail="planner@example.test"
      >
        <div>Monthly body</div>
      </PromotionApprovalPageShell>
    );

    expect(html).toContain("Create a new approval request.");
    expect(html).not.toContain("Monthly body");
  });
});

function country(overrides: Partial<CountryOption> = {}): CountryOption {
  return {
    id: "country-es",
    name: "Spain",
    code: "ES",
    vatRate: 0.21,
    currency: "EUR",
    status: "ACTIVE",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function approvedRequest(
  overrides: Partial<OtherApprovalRequestOption> = {}
): OtherApprovalRequestOption {
  return {
    id: "other-approved-1",
    title: "Approved Sample Request",
    countryCode: "ES",
    channelName: "General",
    feeType: "Special offer",
    description: "Already approved content",
    tableData: "Approved table content",
    status: "APPROVED",
    workflowState: "ACTIVE",
    duplicateOfRequestId: null,
    submittedByEmail: "requester@example.test",
    firstApprovedByEmail: "first@example.test",
    approvedByEmail: "final@example.test",
    rejectedByEmail: null,
    submittedAt: "2026-07-03T09:00:00.000Z",
    firstApprovedAt: "2026-07-03T10:00:00.000Z",
    approvedAt: "2026-07-03T11:00:00.000Z",
    rejectedAt: null,
    notes: "Approved",
    createdByEmail: "requester@example.test",
    updatedByEmail: "final@example.test",
    createdAt: "2026-07-03T09:00:00.000Z",
    updatedAt: "2026-07-03T11:00:00.000Z",
    attachments: [],
    revision: 1,
    audits: [],
    ...overrides
  };
}

function monthlyQueueItem(
  overrides: Partial<PromotionPlanApprovalQueueItem> = {}
): PromotionPlanApprovalQueueItem {
  return {
    id: "monthly-queue-1",
    planYear: 2026,
    planMonth: 7,
    countryCode: "ES",
    status: "SUBMITTED",
    submittedByEmail: "requester@example.test",
    submittedAt: "2026-07-03T09:00:00.000Z",
    entryCount: 12,
    stage: "first",
    canApprove: true,
    canReturnForRevision: true,
    updatedAt: "2026-07-03T09:00:00.000Z",
    ...overrides
  };
}

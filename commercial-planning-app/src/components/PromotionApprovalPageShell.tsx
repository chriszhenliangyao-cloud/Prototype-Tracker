"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatEuropeanDateTime } from "@/lib/format";
import {
  displayOtherApprovalFeeType,
  OTHER_APPROVAL_FEE_TYPES
} from "@/lib/otherApprovalLabels";
import {
  canManageOtherApprovalRequest,
  canEditSubmittedOtherApproval,
  canViewOtherApprovalInInbox,
  isOtherApprovalActive,
  isPotentialOtherApprovalDuplicate,
  normalizeOtherApprovalWorkflowState,
  otherApprovalWorkflowStateLabel
} from "@/lib/otherApprovalWorkflow";
import { promotionPlanMonthKey } from "@/lib/promotionPlanShared";
import { AutosaveStatus } from "./AutosaveStatus";
import { useAutosaveDraft } from "./useAutosaveDraft";
import type {
  CountryOption,
  OtherApprovalAttachmentOption,
  OtherApprovalRequestOption,
  PromotionPlanApprovalQueueItem,
  PromotionPlanArchiveOption,
  PromotionPlanEmailNotificationOption,
  PromotionPlanStatus
} from "@/lib/types";

type OtherApprovalActionResponse = {
  ok?: boolean;
  request?: OtherApprovalRequestOption | null;
  emailDelivery?: { status: string; messageId?: string | null; errorMessage?: string };
  deletedId?: string;
  message?: string;
};

type PendingAttachment = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  base64: string;
};

type OtherApprovalForm = {
  id: string | null;
  title: string;
  countryCode: string;
  channelName: string;
  feeType: string;
  description: string;
  tableData: string;
  note: string;
};

type OtherApprovalView = "new" | "my" | "inbox";
type OtherApprovalStatusFilter = "ALL" | PromotionPlanStatus;

type ApiResult = {
  status?: string;
  message?: string;
  archive?: {
    id: string;
    driveStatus?: string;
    driveUrl?: string | null;
  } | null;
  emailNotification?: {
    status?: string;
    toEmails?: string[];
    ccEmails?: string[];
    errorMessage?: string | null;
  } | null;
};

type OtherFocusRequest = {
  id: string;
  nonce: number;
} | null;

type SpreadsheetPreviewRow = {
  rowNumber: number;
  cells: string[];
};

type SpreadsheetPreviewSheet = {
  name: string;
  rows: SpreadsheetPreviewRow[];
  maxColumnCount: number;
  truncatedRows?: boolean;
  truncatedCells?: boolean;
};

type AttachmentPreview =
  | {
      kind: "binary";
      binaryKind: "image" | "pdf";
      fileName: string;
      contentType: string;
      sizeBytes: number;
      inlineUrl: string;
      downloadUrl: string;
    }
  | {
      kind: "spreadsheet";
      fileName: string;
      contentType: string;
      sizeBytes: number;
      sheets: SpreadsheetPreviewSheet[];
      downloadUrl: string;
    }
  | {
      kind: "text";
      fileName: string;
      contentType: string;
      sizeBytes: number;
      text: string;
      downloadUrl: string;
    }
  | {
      kind: "unsupported";
      fileName: string;
      contentType: string;
      sizeBytes: number;
      message: string;
      downloadUrl: string;
    };

const statusFilterOptions: Array<{
  value: OtherApprovalStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "FIRST_APPROVED", label: "First approved" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" }
];

const correctionNoteRequiredMessage = "Add a correction note before saving.";

export function PromotionApprovalPageShell({
  children,
  countries,
  canSaveOtherApprovals,
  canFirstApprove,
  canFinalApprove,
  canApproveMonthlyPlan,
  canManageApprovalHistory,
  canManagePromotionBackfill,
  canManageAllOtherApprovals,
  canSeeAllCountries,
  monthlyApprovalQueue,
  monthlyDeliveryArchives,
  monthlyDeliveryNotifications,
  otherApprovals,
  initialModule = "monthly",
  initialOtherApprovalId = null,
  initialDeliveryDialogOpen = false,
  userEmail
}: {
  children: ReactNode;
  countries: CountryOption[];
  canSaveOtherApprovals: boolean;
  canFirstApprove: boolean;
  canFinalApprove: boolean;
  canApproveMonthlyPlan: boolean;
  canManageApprovalHistory: boolean;
  canManagePromotionBackfill: boolean;
  canManageAllOtherApprovals: boolean;
  canSeeAllCountries: boolean;
  monthlyApprovalQueue: PromotionPlanApprovalQueueItem[];
  monthlyDeliveryArchives: PromotionPlanArchiveOption[];
  monthlyDeliveryNotifications: PromotionPlanEmailNotificationOption[];
  otherApprovals: OtherApprovalRequestOption[];
  initialModule?: "monthly" | "other-approvals";
  initialOtherApprovalId?: string | null;
  initialDeliveryDialogOpen?: boolean;
  userEmail: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const monthlyApprovalHref = pathname.startsWith("/platform/")
    ? "/platform/collaboration/monthly-approvals"
    : "/promotion";
  const [activeModule, setActiveModule] = useState<
    "monthly" | "other-approvals"
  >(initialModule);
  const [otherFocusRequest, setOtherFocusRequest] =
    useState<OtherFocusRequest>(
      initialOtherApprovalId ? { id: initialOtherApprovalId, nonce: 0 } : null
    );
  const [globalStatus, setGlobalStatus] = useState<ApiResult | null>(null);
  const [isUpdatingMonthlyStatus, setIsUpdatingMonthlyStatus] = useState(false);
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(
    initialDeliveryDialogOpen
  );
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [retryingArchiveId, setRetryingArchiveId] = useState<string | null>(
    null
  );
  const [historyAdminActionKey, setHistoryAdminActionKey] = useState<
    string | null
  >(null);
  const otherApprovalQueue = useMemo(
    () =>
      otherApprovals.filter(
        (request) =>
          canViewOtherApprovalInInbox({
            status: request.status,
            workflowState: request.workflowState,
            capabilities: { canFirstApprove, canFinalApprove }
          })
      ),
    [canFinalApprove, canFirstApprove, otherApprovals]
  );

  function openMonthlyReview(item: PromotionPlanApprovalQueueItem) {
    setActiveModule("monthly");
    const params = new URLSearchParams({
      year: String(item.planYear),
      month: String(item.planMonth),
      country: item.countryCode
    });
    router.push(`${monthlyApprovalHref}?${params.toString()}`);
  }

  function openOtherApprovalReview(request: OtherApprovalRequestOption) {
    setActiveModule("other-approvals");
    setOtherFocusRequest({
      id: request.id,
      nonce: Date.now()
    });
  }

  async function updateMonthlyPlanStatus(
    action: "approve" | "reject",
    item: PromotionPlanApprovalQueueItem
  ) {
    if (isUpdatingMonthlyStatus) {
      return;
    }

    const revisionNote =
      action === "reject"
        ? window.prompt(
            "Return this plan for revision. Describe the required changes:"
          )
        : null;

    if (action === "reject" && !revisionNote?.trim()) {
      setGlobalStatus({
        status: "error",
        message: "A return reason is required before sending a plan back for revision."
      });
      return;
    }

    setIsUpdatingMonthlyStatus(true);
    setGlobalStatus(null);
    try {
      const response = await fetch(`/api/promotion-plan/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planYear: item.planYear,
          planMonth: item.planMonth,
          countryCodes: [item.countryCode],
          notes: revisionNote?.trim() ?? null
        })
      });
      const result = (await response.json()) as ApiResult;
      setGlobalStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setGlobalStatus({
        status: "error",
        message: "Status update failed. Please try again."
      });
    } finally {
      setIsUpdatingMonthlyStatus(false);
    }
  }

  async function retryApprovalEmail(notificationId: string) {
    if (retryingEmailId) {
      return;
    }

    setRetryingEmailId(notificationId);
    setGlobalStatus(null);
    try {
      const response = await fetch(
        `/api/promotion-plan/email-notifications/${notificationId}/retry`,
        { method: "POST" }
      );
      const result = (await response.json()) as ApiResult;
      setGlobalStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setGlobalStatus({
        status: "error",
        message: "Approval email retry failed. Please try again."
      });
    } finally {
      setRetryingEmailId(null);
    }
  }

  async function retryArchiveDelivery(archiveId: string) {
    if (retryingArchiveId) {
      return;
    }

    setRetryingArchiveId(archiveId);
    setGlobalStatus(null);
    try {
      const response = await fetch(
        `/api/promotion-plan/archives/${archiveId}/retry-drive`,
        { method: "POST" }
      );
      const result = (await response.json()) as ApiResult;
      setGlobalStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setGlobalStatus({
        status: "error",
        message: "Archive retry failed. Please try again."
      });
    } finally {
      setRetryingArchiveId(null);
    }
  }

  async function manageApprovalHistory({
    action,
    countryCodes,
    notificationId,
    planMonth,
    planYear,
    targetStatus
  }: {
    action: "set-status" | "delete-status";
    countryCodes: string[];
    notificationId: string;
    planMonth: number;
    planYear: number;
    targetStatus?: PromotionPlanStatus;
  }) {
    if (!canManageApprovalHistory || historyAdminActionKey) {
      return;
    }

    const confirmationPhrase =
      action === "delete-status" ? "DELETE APPROVAL" : "CHANGE APPROVAL";
    const confirmation = window.prompt(
      action === "delete-status"
        ? `Owner warning: this deletes the approval record for ${planYear}-${String(
            planMonth
          ).padStart(2, "0")} ${countryCodes.join(
            ", "
          )}. Saved plan rows, delivery records, and orphan archived workbooks will be cleared so the month can be re-imported. Type ${confirmationPhrase} to confirm.`
        : `Owner warning: this changes historical approval status to ${targetStatus}. No approval email will be sent. Type ${confirmationPhrase} to confirm.`
    );

    if (confirmation !== confirmationPhrase) {
      setGlobalStatus({
        status: "error",
        message: `Operation cancelled. Exact confirmation required: ${confirmationPhrase}.`
      });
      return;
    }

    const actionKey = `${notificationId}:${action}`;
    setHistoryAdminActionKey(actionKey);
    setGlobalStatus(null);
    try {
      const response = await fetch("/api/promotion-plan/admin-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          confirmation,
          countryCodes,
          notificationId,
          planMonth,
          planYear,
          targetStatus
        })
      });
      const result = (await response.json()) as ApiResult;
      setGlobalStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setGlobalStatus({
        status: "error",
        message: "Owner approval history update failed. Please try again."
      });
    } finally {
      setHistoryAdminActionKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="approval-workspace-queue">
        <ApprovalWorkspaceQueuePanel
          isUpdatingMonthlyStatus={isUpdatingMonthlyStatus}
          monthlyItems={canApproveMonthlyPlan ? monthlyApprovalQueue : []}
          monthlyNotifications={monthlyDeliveryNotifications}
          otherApprovalItems={otherApprovalQueue}
          onMonthlyApprove={(item) => updateMonthlyPlanStatus("approve", item)}
          onMonthlyReject={(item) => updateMonthlyPlanStatus("reject", item)}
          onOpenDeliveryStatus={() => setIsDeliveryDialogOpen(true)}
          onOpenMonthlyReview={openMonthlyReview}
          onOpenOtherApprovalReview={openOtherApprovalReview}
        />
      </div>

      {globalStatus ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            globalStatus.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {globalStatus.message ?? globalStatus.status ?? "Done."}
        </div>
      ) : null}

      <section className="approval-module-switcher rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`rounded-md border px-4 py-2 text-sm font-semibold ${
              activeModule === "monthly"
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setActiveModule("monthly")}
          >
            Monthly Promotion Plan
          </button>
          <button
            type="button"
            className={`rounded-md border px-4 py-2 text-sm font-semibold ${
              activeModule === "other-approvals"
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setActiveModule("other-approvals")}
          >
            Other Approvals
          </button>
          <span className="ml-auto text-sm font-semibold text-slate-500">
            Approval workspace
          </span>
        </div>
      </section>

      {activeModule === "monthly" ? (
        children
      ) : (
        <OtherApprovalsPanel
          canFinalApprove={canFinalApprove}
          canFirstApprove={canFirstApprove}
          canManageAllOtherApprovals={canManageAllOtherApprovals}
          canSaveOtherApprovals={canSaveOtherApprovals}
          countries={countries}
          focusRequest={otherFocusRequest}
          initialRequests={otherApprovals}
          userEmail={userEmail}
        />
      )}
      {isDeliveryDialogOpen ? (
        <ApprovalDeliveryStatusDialog
          archives={monthlyDeliveryArchives}
          notifications={monthlyDeliveryNotifications}
          retryingArchiveId={retryingArchiveId}
          retryingEmailId={retryingEmailId}
          historyAdminActionKey={historyAdminActionKey}
          showArchiveLinks={canSeeAllCountries}
          showRetryActions={canApproveMonthlyPlan || canManagePromotionBackfill}
          showHistoryAdminActions={canManageApprovalHistory}
          onClose={() => setIsDeliveryDialogOpen(false)}
          onManageApprovalHistory={manageApprovalHistory}
          onRetryArchive={retryArchiveDelivery}
          onRetryEmail={retryApprovalEmail}
        />
      ) : null}
    </div>
  );
}

function ApprovalWorkspaceQueuePanel({
  isUpdatingMonthlyStatus,
  monthlyItems,
  monthlyNotifications,
  otherApprovalItems,
  onMonthlyApprove,
  onMonthlyReject,
  onOpenDeliveryStatus,
  onOpenMonthlyReview,
  onOpenOtherApprovalReview
}: {
  isUpdatingMonthlyStatus: boolean;
  monthlyItems: PromotionPlanApprovalQueueItem[];
  monthlyNotifications: PromotionPlanEmailNotificationOption[];
  otherApprovalItems: OtherApprovalRequestOption[];
  onMonthlyApprove: (item: PromotionPlanApprovalQueueItem) => void;
  onMonthlyReject: (item: PromotionPlanApprovalQueueItem) => void;
  onOpenDeliveryStatus: () => void;
  onOpenMonthlyReview: (item: PromotionPlanApprovalQueueItem) => void;
  onOpenOtherApprovalReview: (item: OtherApprovalRequestOption) => void;
}) {
  const pendingCount = monthlyItems.length + otherApprovalItems.length;
  const recentNotificationCount = monthlyNotifications.slice(0, 5).length;
  const failedNotificationCount = monthlyNotifications.filter(
    (notification) => notification.status === "FAILED"
  ).length;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950">
            Approval queue
          </h3>
          <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white">
            {pendingCount} pending
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Monthly {monthlyItems.length}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Other approvals {otherApprovalItems.length}
          </span>
        </div>
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-amber-50"
          type="button"
          onClick={onOpenDeliveryStatus}
        >
          Delivery status
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            {recentNotificationCount} recent
            {failedNotificationCount > 0 ? ` · ${failedNotificationCount} failed` : ""}
          </span>
        </button>
      </div>

      {pendingCount === 0 ? (
        <div className="rounded-md border border-dashed border-amber-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500">
          No monthly plans or other approval requests are waiting for your approval.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-md border border-amber-200 bg-white">
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-100/60 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Monthly Promotion Plan
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {monthlyItems.length} waiting
              </span>
            </div>
            {monthlyItems.length === 0 ? (
              <div className="px-3 py-3 text-xs font-semibold text-slate-500">
                No monthly plans are waiting for your approval.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {monthlyItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 px-3 py-2 text-xs md:grid-cols-[82px_56px_110px_minmax(0,1fr)_300px] md:items-center"
                  >
                    <span className="font-semibold text-slate-950">
                      {approvalQueueMonthLabel(item)}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {item.countryCode}
                    </span>
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.stage === "final"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {approvalStageLabel(item.stage)}
                    </span>
                    <span className="min-w-0 text-slate-600">
                      <span className="block truncate font-semibold text-slate-800">
                        {item.submittedByEmail ?? "Unknown submitter"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {item.entryCount} rows · {formatSubmittedAt(item.submittedAt)}
                      </span>
                    </span>
                    <span className="flex flex-wrap justify-start gap-1.5 md:justify-end">
                      <button
                        className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        type="button"
                        onClick={() => onOpenMonthlyReview(item)}
                      >
                        Open review
                      </button>
                      {item.canApprove ? (
                        <>
                          <button
                            className="h-7 rounded-md border border-emerald-200 bg-white px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            type="button"
                            disabled={isUpdatingMonthlyStatus}
                            onClick={() => onMonthlyApprove(item)}
                          >
                            {item.stage === "final" ? "Final approve" : "First approve"}
                          </button>
                          <button
                            className="h-7 rounded-md border border-rose-200 bg-white px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            type="button"
                            disabled={isUpdatingMonthlyStatus || !item.canReturnForRevision}
                            onClick={() => onMonthlyReject(item)}
                          >
                            Return for revision
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex h-7 items-center rounded-md bg-slate-100 px-2 text-[11px] font-semibold text-slate-500">
                          {item.stage === "first"
                            ? "Preview · awaiting first approval"
                            : "Preview · awaiting final approval"}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-amber-200 bg-white">
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-100/60 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Other Approvals
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {otherApprovalItems.length} waiting
              </span>
            </div>
            {otherApprovalItems.length === 0 ? (
              <div className="px-3 py-3 text-xs font-semibold text-slate-500">
                No other approval requests are waiting for your approval.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {otherApprovalItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 px-3 py-2 text-xs md:grid-cols-[64px_112px_minmax(0,1fr)_116px] md:items-center"
                  >
                    <span className="font-semibold text-slate-700">
                      {item.countryCode}
                    </span>
                    <StatusPill
                      status={item.status}
                      workflowState={item.workflowState}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-950">
                        {item.title}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {item.channelName} · {displayOtherApprovalFeeType(item.feeType)}
                      </span>
                    </span>
                    <span className="flex justify-start md:justify-end">
                      <button
                        className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        type="button"
                        onClick={() => onOpenOtherApprovalReview(item)}
                      >
                        Open review
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ApprovalDeliveryStatusDialog({
  archives,
  historyAdminActionKey,
  notifications,
  retryingArchiveId,
  retryingEmailId,
  showArchiveLinks,
  showHistoryAdminActions,
  showRetryActions,
  onClose,
  onManageApprovalHistory,
  onRetryArchive,
  onRetryEmail
}: {
  archives: PromotionPlanArchiveOption[];
  historyAdminActionKey: string | null;
  notifications: PromotionPlanEmailNotificationOption[];
  retryingArchiveId: string | null;
  retryingEmailId: string | null;
  showArchiveLinks: boolean;
  showHistoryAdminActions: boolean;
  showRetryActions: boolean;
  onClose: () => void;
  onManageApprovalHistory: (payload: {
    action: "set-status" | "delete-status";
    countryCodes: string[];
    notificationId: string;
    planMonth: number;
    planYear: number;
    targetStatus?: PromotionPlanStatus;
  }) => void;
  onRetryArchive: (archiveId: string) => void;
  onRetryEmail: (notificationId: string) => void;
}) {
  const archiveById = new Map(archives.map((archive) => [archive.id, archive]));
  const visibleNotifications = showHistoryAdminActions
    ? notifications
    : notifications.slice(0, 5);
  const [targetStatusByNotificationId, setTargetStatusByNotificationId] =
    useState<Record<string, PromotionPlanStatus>>({});

  return (
    <div className="fixed inset-0 z-[500] grid place-items-center bg-slate-950/30 px-4 py-6">
      <section className="max-h-[86vh] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">
              Approval delivery status
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {showHistoryAdminActions
                ? `${visibleNotifications.length} records`
                : `${visibleNotifications.length} recent`}
            </span>
          </div>
          <button
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(86vh-58px)] overflow-auto p-4">
          {visibleNotifications.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              No final approval email records yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[88px_112px_1.05fr_1.1fr_132px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Month</span>
                  <span>Countries</span>
                  <span>Archive</span>
                  <span>Email</span>
                  <span>Updated</span>
                </div>
                {visibleNotifications.map((notification) => {
                  const archive = notification.archiveId
                    ? archiveById.get(notification.archiveId) ?? null
                    : null;
                  const isBusinessPlanDelivery =
                    notification.planMonth === 0 ||
                    archive?.source.startsWith("BUSINESS_PLAN");
                  const canRetryArchive =
                    showRetryActions && archive?.driveStatus === "FAILED";
                  const canRetryEmail =
                    showRetryActions &&
                    ["FAILED", "PENDING", "NOT_CONFIGURED"].includes(
                      notification.status
                    );
                  return (
                    <div
                      key={notification.id}
                      className="grid grid-cols-[88px_112px_1.05fr_1.1fr_132px] items-start gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="font-semibold text-slate-950">
                        {deliveryPeriodLabel(notification, archive)}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {notification.countryCodes.join(", ") || "-"}
                      </span>
                      <div className="min-w-0 text-slate-600">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${archiveStatusClass(
                            archive?.driveStatus
                          )}`}
                        >
                          {archive ? archiveStatusLabel(archive.driveStatus) : "No archive"}
                        </span>
                        {canRetryArchive && archive ? (
                          <button
                            className="ml-2 h-6 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            type="button"
                            disabled={retryingArchiveId === archive.id}
                            onClick={() => onRetryArchive(archive.id)}
                          >
                            {retryingArchiveId === archive.id
                              ? "Retrying..."
                              : "Retry archive"}
                          </button>
                        ) : null}
                        <div className="mt-1 truncate font-semibold text-slate-800">
                          {archive?.workbookFileName ?? "Archive was not created"}
                        </div>
                        {showArchiveLinks && archive ? (
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                            <a
                              className="text-slate-700 underline"
                              href={`/api/promotion-plan/archives/${archive.id}/download`}
                            >
                              Download archive
                            </a>
                            {archive.driveUrl ? (
                              <a
                                className="text-slate-700 underline"
                                href={archive.driveUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Open Drive
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${emailStatusClass(
                              notification.status
                            )}`}
                          >
                            {emailNotificationLabel(notification.status)}
                          </span>
                          {canRetryEmail ? (
                            <button
                              className="h-6 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              type="button"
                              disabled={retryingEmailId === notification.id}
                              onClick={() => onRetryEmail(notification.id)}
                            >
                              {retryingEmailId === notification.id
                                ? "Retrying..."
                                : "Retry email"}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-1 truncate text-slate-700">
                          To: {notification.toEmails.join(", ") || "-"}
                        </div>
                        {notification.ccEmails.length > 0 ? (
                          <div className="mt-1 truncate text-slate-500">
                            Cc: {notification.ccEmails.join(", ")}
                          </div>
                        ) : null}
                        {notification.messageId ? (
                          <div className="mt-1 truncate text-slate-500">
                            SES: {notification.messageId}
                          </div>
                        ) : null}
                        {notification.errorMessage ? (
                          <div className="mt-1 font-semibold text-rose-700">
                            {notification.errorMessage}
                          </div>
                        ) : null}
                        {showHistoryAdminActions && !isBusinessPlanDelivery ? (
                          <ApprovalHistoryControls
                            actionKey={historyAdminActionKey}
                            countryCodes={notification.countryCodes}
                            notificationId={notification.id}
                            planMonth={notification.planMonth}
                            planYear={notification.planYear}
                            targetStatus={
                              targetStatusByNotificationId[notification.id] ??
                              "SUBMITTED"
                            }
                            onChangeTargetStatus={(targetStatus) =>
                              setTargetStatusByNotificationId((current) => ({
                                ...current,
                                [notification.id]: targetStatus
                              }))
                            }
                            onManageApprovalHistory={onManageApprovalHistory}
                          />
                        ) : null}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {formatSubmittedAt(
                          notification.lastAttemptAt ??
                            notification.sentAt ??
                            notification.createdAt
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ApprovalHistoryControls({
  actionKey,
  countryCodes,
  notificationId,
  planMonth,
  planYear,
  targetStatus,
  onChangeTargetStatus,
  onManageApprovalHistory
}: {
  actionKey: string | null;
  countryCodes: string[];
  notificationId: string;
  planMonth: number;
  planYear: number;
  targetStatus: PromotionPlanStatus;
  onChangeTargetStatus: (status: PromotionPlanStatus) => void;
  onManageApprovalHistory: (payload: {
    action: "set-status" | "delete-status";
    countryCodes: string[];
    notificationId: string;
    planMonth: number;
    planYear: number;
    targetStatus?: PromotionPlanStatus;
  }) => void;
}) {
  const changeActionKey = `${notificationId}:set-status`;
  const deleteActionKey = `${notificationId}:delete-status`;
  const isChanging = actionKey === changeActionKey;
  const isDeleting = actionKey === deleteActionKey;
  const isBusy = actionKey !== null;

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
          Owner controls
        </span>
        <span className="text-[11px] font-medium text-amber-900/80">
          Type exact confirmation phrase before saving.
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="h-7 rounded-md border border-amber-200 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none focus:border-amber-500"
          value={targetStatus}
          onChange={(event) =>
            onChangeTargetStatus(event.currentTarget.value as PromotionPlanStatus)
          }
        >
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="FIRST_APPROVED">First approved</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button
          className="h-7 rounded-md border border-amber-300 bg-white px-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          type="button"
          disabled={isBusy}
          onClick={() =>
            onManageApprovalHistory({
              action: "set-status",
              countryCodes,
              notificationId,
              planMonth,
              planYear,
              targetStatus
            })
          }
        >
          {isChanging ? "Changing..." : "Change status"}
        </button>
        <button
          className="h-7 rounded-md border border-rose-200 bg-white px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          type="button"
          disabled={isBusy}
          onClick={() =>
            onManageApprovalHistory({
              action: "delete-status",
              countryCodes,
              notificationId,
              planMonth,
              planYear
            })
          }
        >
          {isDeleting ? "Deleting..." : "Delete status"}
        </button>
      </div>
      <div className="mt-1 text-[11px] font-medium text-amber-900/80">
        Delete clears saved plan rows, delivery records, and orphan archived workbooks for re-import.
      </div>
    </div>
  );
}

export function OtherApprovalsPanel({
  countries,
  canManageAllOtherApprovals,
  canSaveOtherApprovals,
  canFirstApprove,
  canFinalApprove,
  focusRequest,
  initialRequests,
  userEmail
}: {
  countries: CountryOption[];
  canManageAllOtherApprovals: boolean;
  canSaveOtherApprovals: boolean;
  canFirstApprove: boolean;
  canFinalApprove: boolean;
  focusRequest?: OtherFocusRequest;
  initialRequests: OtherApprovalRequestOption[];
  userEmail: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const correctionNoteInputRef = useRef<HTMLInputElement | null>(null);
  const countryOptions = useMemo(
    () => countries.filter((country) => country.status === "ACTIVE"),
    [countries]
  );
  const defaultCountryCode = countryOptions[0]?.code ?? "";
  const [requests, setRequests] = useState(initialRequests);
  const [activeView, setActiveView] = useState<OtherApprovalView>("new");
  const [statusFilter, setStatusFilter] =
    useState<OtherApprovalStatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState("new");
  const selectedRequest = requests.find((request) => request.id === selectedId);
  const [form, setForm] = useState<OtherApprovalForm>(
    formFromRequest(null, defaultCountryCode)
  );
  const [newDraftId, setNewDraftId] = useState(() => loadOtherApprovalDraftId());
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [attachmentPreview, setAttachmentPreview] =
    useState<AttachmentPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isApproverEditing, setIsApproverEditing] = useState(false);
  const [isRequesterRevision, setIsRequesterRevision] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [duplicateOfRequestId, setDuplicateOfRequestId] = useState("");
  const hasApprovalInbox = canFirstApprove || canFinalApprove;
  const myRequestHistory = useMemo(
    () =>
      requests.filter(
        (request) => statusFilter === "ALL" || request.status === statusFilter
      ),
    [requests, statusFilter]
  );
  const approvalInbox = useMemo(
    () =>
      requests.filter(
        (request) =>
          canViewOtherApprovalInInbox({
            status: request.status,
            workflowState: request.workflowState,
            capabilities: { canFirstApprove, canFinalApprove }
          })
      ),
    [canFinalApprove, canFirstApprove, requests]
  );
  const visibleRequests =
    activeView === "inbox" ? approvalInbox : myRequestHistory;

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const request = requests.find((item) => item.id === focusRequest.id);
    if (!request) {
      return;
    }
    selectRequest(request, "inbox");
  }, [focusRequest?.id, focusRequest?.nonce, requests]);

  function selectRequest(
    request: OtherApprovalRequestOption | null,
    nextView: OtherApprovalView = request ? activeView : "new"
  ) {
    setActiveView(nextView);
    setSelectedId(request?.id ?? "new");
    setForm(formFromRequest(request, defaultCountryCode));
    setPendingAttachments([]);
    setIsApproverEditing(false);
    setIsRequesterRevision(false);
    setEditNote("");
    setDuplicateOfRequestId("");
    setMessage(null);
  }

  function startNewRequest() {
    if (form.id) {
      setNewDraftId(loadOtherApprovalDraftId(true));
    }
    selectRequest(null, "new");
  }

  function openMyRequests() {
    setActiveView("my");
    setMessage(null);
    const firstRequest = myRequestHistory[0];
    if (firstRequest) {
      setSelectedId(firstRequest.id);
      setForm(formFromRequest(firstRequest, defaultCountryCode));
    } else {
      setSelectedId("new");
      setForm(formFromRequest(null, defaultCountryCode));
    }
    setPendingAttachments([]);
    setIsApproverEditing(false);
    setIsRequesterRevision(false);
    setEditNote("");
  }

  function openApprovalInbox() {
    setActiveView("inbox");
    setMessage(null);
    const firstRequest = approvalInbox[0];
    if (firstRequest) {
      setSelectedId(firstRequest.id);
      setForm(formFromRequest(firstRequest, defaultCountryCode));
    } else {
      setSelectedId("new");
      setForm(formFromRequest(null, defaultCountryCode));
    }
    setPendingAttachments([]);
    setIsApproverEditing(false);
    setIsRequesterRevision(false);
    setEditNote("");
  }

  function duplicateRequest(request: OtherApprovalRequestOption) {
    setNewDraftId(loadOtherApprovalDraftId(true));
    setActiveView("new");
    setSelectedId("new");
    setForm({
      ...formFromRequest(request, defaultCountryCode),
      id: null,
      note: ""
    });
    setPendingAttachments([]);
    setIsApproverEditing(false);
    setIsRequesterRevision(false);
    setEditNote("");
    setMessage("Copied into a new request draft. Attach files again if needed.");
  }

  function startApproverEdit() {
    if (!selectedRequest) return;
    setForm(formFromRequest(selectedRequest, defaultCountryCode));
    setPendingAttachments([]);
    setEditNote("");
    setIsApproverEditing(true);
    setMessage(
      "Correction mode: country and fee type remain fixed. Add a correction note before saving."
    );
  }

  function startRequesterRevision() {
    if (!selectedRequest) return;
    setForm(formFromRequest(selectedRequest, defaultCountryCode));
    setPendingAttachments([]);
    setIsRequesterRevision(true);
    setMessage(
      "Revision mode: update the request, save the revised draft, then submit it for a new approval cycle."
    );
  }

  function cancelApproverEdit() {
    if (selectedRequest) {
      setForm(formFromRequest(selectedRequest, defaultCountryCode));
    }
    setPendingAttachments([]);
    setEditNote("");
    setIsApproverEditing(false);
    setMessage(null);
  }

  function saveApproverCorrection() {
    if (!editNote.trim()) {
      setMessage(correctionNoteRequiredMessage);
      correctionNoteInputRef.current?.focus();
      return;
    }
    void runAction("edit", {
      ...form,
      editNote,
      attachments: pendingAttachments
    });
  }

  function updateRequest(request: OtherApprovalRequestOption | null | undefined) {
    if (!request) return;
    setRequests((current) => {
      const without = current.filter((item) => item.id !== request.id);
      return [request, ...without].sort(compareRequests);
    });
    selectRequest(request);
  }

  async function runAction(
    endpoint:
      | "save"
      | "submit"
      | "approve"
      | "return-for-revision"
      | "reject-close"
      | "withdraw"
      | "cancel-duplicate"
      | "discard-returned"
      | "delete"
      | "edit",
    body: Record<string, unknown>
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/other-approvals/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as OtherApprovalActionResponse;
      if (!response.ok || !payload.ok) {
        setMessage(payload.message || "Action failed.");
        return;
      }
      if (endpoint === "save" || endpoint === "submit" || endpoint === "edit") {
        void autosave.clearAutosaveDraft();
      }
      if (payload.deletedId) {
        setRequests((current) => current.filter((item) => item.id !== payload.deletedId));
        startNewRequest();
      } else if (endpoint === "discard-returned") {
        const discardedRequest = payload.request;
        if (discardedRequest) {
          setRequests((current) => {
            const without = current.filter((item) => item.id !== discardedRequest.id);
            return [discardedRequest, ...without].sort(compareRequests);
          });
        }
        startNewRequest();
      } else {
        updateRequest(payload.request);
      }
      const emailHint = payload.emailDelivery
        ? ` Email: ${payload.emailDelivery.status}${
            payload.emailDelivery.errorMessage
              ? ` (${payload.emailDelivery.errorMessage})`
              : ""
          }.`
        : "";
      setMessage(`${payload.message || "Done."}${emailHint}`);
      if (endpoint === "save" || endpoint === "edit") {
        setPendingAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      if (endpoint === "edit") {
        setEditNote("");
        setIsApproverEditing(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openAttachmentPreview(attachment: OtherApprovalAttachmentOption) {
    const downloadUrl = `/api/other-approvals/attachments/${attachment.id}`;
    const inlineUrl = `${downloadUrl}/preview?inline=1`;
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      if (isImageAttachment(attachment)) {
        setAttachmentPreview({
          kind: "binary",
          binaryKind: "image",
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          inlineUrl,
          downloadUrl
        });
        return;
      }
      if (isPdfAttachment(attachment)) {
        setAttachmentPreview({
          kind: "binary",
          binaryKind: "pdf",
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          inlineUrl,
          downloadUrl
        });
        return;
      }

      const response = await fetch(`${downloadUrl}/preview`);
      const payload = (await response.json()) as Omit<
        AttachmentPreview,
        "downloadUrl"
      > & { message?: string };
      if (!response.ok) {
        setPreviewError(payload.message || "Attachment preview failed.");
        return;
      }
      setAttachmentPreview({
        ...payload,
        message: payload.message || "Preview is not available for this file type.",
        downloadUrl
      } as AttachmentPreview);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Attachment preview failed."
      );
    } finally {
      setPreviewBusy(false);
    }
  }

  const canEditSubmittedCurrent = Boolean(selectedRequest) &&
    canEditSubmittedOtherApproval({
      status: selectedRequest?.status ?? "DRAFT",
      workflowState: selectedRequest?.workflowState,
      capabilities: { canFirstApprove, canFinalApprove }
    });
  const canManageCurrent = Boolean(selectedRequest) &&
    canManageOtherApprovalRequest({
      createdByEmail: selectedRequest?.createdByEmail ?? null,
      submittedByEmail: selectedRequest?.submittedByEmail ?? null,
      roleCanManageAll: canManageAllOtherApprovals,
      userEmail
    });
  const isReturnedForRevision =
    normalizeOtherApprovalWorkflowState({
      status: selectedRequest?.status ?? "DRAFT",
      workflowState: selectedRequest?.workflowState
    }) === "RETURNED_FOR_REVISION";
  const canEditCurrent =
    (canSaveOtherApprovals &&
      (!selectedRequest || selectedRequest.status === "DRAFT" || isRequesterRevision) &&
      (!selectedRequest || canManageCurrent || !selectedRequest.id)) ||
    (isApproverEditing && canEditSubmittedCurrent);
  const canSubmitCurrent =
    canSaveOtherApprovals &&
    Boolean(form.id) &&
    selectedRequest?.status === "DRAFT" &&
    Boolean(canManageCurrent);
  const canApproveCurrent =
    Boolean(form.id) &&
    ((selectedRequest?.status === "SUBMITTED" && canFirstApprove) ||
      (selectedRequest?.status === "FIRST_APPROVED" && canFinalApprove));
  const canRejectCurrent =
    Boolean(form.id) &&
    ((selectedRequest?.status === "SUBMITTED" && canFirstApprove) ||
      (selectedRequest?.status === "FIRST_APPROVED" && canFinalApprove));
  const canWithdrawCurrent =
    Boolean(canManageCurrent) &&
    (selectedRequest?.status === "SUBMITTED" || selectedRequest?.status === "FIRST_APPROVED") &&
    isOtherApprovalActive({
      status: selectedRequest?.status ?? "DRAFT",
      workflowState: selectedRequest?.workflowState
    });
  const duplicateCandidates = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.id !== selectedRequest?.id &&
          isOtherApprovalActive({
            status: request.status,
            workflowState: request.workflowState
          }) &&
          isPotentialOtherApprovalDuplicate({
            current: form,
            candidate: request
          })
      ),
    [form, requests, selectedRequest?.id]
  );
  const isReadonlyDetails = Boolean(selectedRequest) && !canEditCurrent;
  const autosave = useAutosaveDraft({
    workspace: "OTHER_APPROVALS",
    scope: form.id ? `request-${form.id}` : `new-${newDraftId}`,
    userEmail,
    enabled: canEditCurrent,
    value: { form, editNote },
    onRestore: (snapshot) => {
      if (snapshot.form && typeof snapshot.form === "object") {
        setForm(snapshot.form as OtherApprovalForm);
      }
      if (typeof snapshot.editNote === "string") {
        setEditNote(snapshot.editNote);
      }
    }
  });

  return (
    <>
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Other Approvals</h2>
          <p className="text-sm font-medium text-slate-500">
            FD sample stock, special offers, co-marketing, retail activity, or other approvals.
          </p>
          <div className="mt-2">
            <AutosaveStatus
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
              hasConflict={Boolean(autosave.conflictDraft)}
              onLoadNewest={autosave.loadNewestSavedDraft}
              onKeepMyChanges={autosave.keepMyChanges}
            />
          </div>
        </div>
        <div className="ml-auto inline-flex rounded-md border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
          <button
            type="button"
            className={viewButtonClass(activeView === "new")}
            onClick={startNewRequest}
          >
            New request
          </button>
          <button
            type="button"
            className={viewButtonClass(activeView === "my")}
            onClick={openMyRequests}
          >
            My requests
          </button>
          {hasApprovalInbox ? (
            <button
              type="button"
              className={viewButtonClass(activeView === "inbox")}
              onClick={openApprovalInbox}
            >
              Approval inbox
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {activeView === "inbox" ? "Approval inbox" : "My request history"}
            </div>
            {activeView !== "inbox" ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      statusFilter === option.value
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {visibleRequests.length === 0 ? (
              <div className="p-4 text-sm font-medium text-slate-500">
                {activeView === "inbox"
                  ? "No requests are waiting for your approval."
                  : "No other approval requests yet."}
              </div>
            ) : (
              visibleRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left ${
                    request.id === selectedId ? "bg-slate-50" : "bg-white"
                  }`}
                  onClick={() =>
                    selectRequest(request, activeView === "inbox" ? "inbox" : "my")
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-950">
                        {request.title}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {request.countryCode} · {request.channelName} ·{" "}
                        {displayOtherApprovalFeeType(request.feeType)}
                      </div>
                    </div>
                    <StatusPill
                      status={request.status}
                      workflowState={request.workflowState}
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div
            className={`mb-4 rounded-md border px-3 py-2 text-sm font-semibold ${
              isReadonlyDetails
                ? "border-slate-200 bg-slate-50 text-slate-700"
                : "border-sky-100 bg-sky-50 text-sky-900"
            }`}
          >
            {isApproverEditing
              ? "Correction mode. Country and fee type stay unchanged; the correction is recorded with your note."
              : isReadonlyDetails && selectedRequest
                ? `${otherApprovalStatusLabel(selectedRequest)} request · Read-only`
                : "Create a new approval request. Save as draft or submit for approval."}
          </div>
          {isReadonlyDetails && selectedRequest ? (
            <RequestDetails
              busy={busy}
              canApproveCurrent={canApproveCurrent}
              canEditSubmittedCurrent={canEditSubmittedCurrent}
              canManageCurrent={canManageCurrent}
              canRejectCurrent={canRejectCurrent}
              canWithdrawCurrent={canWithdrawCurrent}
              duplicateCandidates={duplicateCandidates}
              duplicateOfRequestId={duplicateOfRequestId}
              form={form}
              isFinalPreview={
                selectedRequest.status === "SUBMITTED" &&
                canFinalApprove &&
                !canFirstApprove
              }
              message={message}
              onBackToNew={startNewRequest}
              onDuplicate={() => duplicateRequest(selectedRequest)}
              onEdit={startApproverEdit}
              onDuplicateTargetChange={setDuplicateOfRequestId}
              onDiscardReturned={() =>
                runAction("discard-returned", { id: form.id })
              }
              onStartRevision={startRequesterRevision}
              onNoteChange={(note) =>
                setForm((current) => ({
                  ...current,
                  note
                }))
              }
              onPreviewAttachment={openAttachmentPreview}
              onRunAction={runAction}
              request={selectedRequest}
            />
          ) : (
            <>
          {duplicateCandidates.length > 0 ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              A similar active request already exists: {duplicateCandidates
                .slice(0, 2)
                .map((request) => request.title)
                .join(", ")}. Review it before submitting to avoid a duplicate.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_240px]">
            <LabeledField label="Title">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                disabled={!canEditCurrent || busy}
                placeholder="New request title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField label="Country">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                disabled={!canEditCurrent || busy || isApproverEditing}
                value={form.countryCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    countryCode: event.target.value
                  }))
                }
              >
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code} - {country.name}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Fee type">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                disabled={!canEditCurrent || busy || isApproverEditing}
                value={form.feeType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, feeType: event.target.value }))
                }
              >
                {OTHER_APPROVAL_FEE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Channel">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                disabled={!canEditCurrent || busy}
                value={form.channelName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    channelName: event.target.value
                  }))
                }
              />
            </LabeledField>
            <LabeledField
              label={isApproverEditing ? "Correction note (required)" : "Approval note"}
            >
              <input
                ref={correctionNoteInputRef}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                disabled={busy || (!canEditCurrent && !canApproveCurrent && !canRejectCurrent)}
                placeholder={isApproverEditing ? "Explain the correction" : undefined}
                aria-invalid={
                  isApproverEditing && message === correctionNoteRequiredMessage
                }
                value={isApproverEditing ? editNote : form.note}
                onChange={(event) => {
                  if (isApproverEditing) {
                    setEditNote(event.target.value);
                    if (message === correctionNoteRequiredMessage) {
                      setMessage(null);
                    }
                    return;
                  }
                  setForm((current) => ({ ...current, note: event.target.value }));
                }}
              />
            </LabeledField>
            <div className="flex items-end">
              <StatusPill
                status={selectedRequest?.status ?? "DRAFT"}
                workflowState={selectedRequest?.workflowState}
                large
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <LabeledField label="Description">
              <textarea
                className="min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                disabled={!canEditCurrent || busy}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
              />
            </LabeledField>
            <LabeledField label="Table / details">
              <textarea
                className="min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                disabled={!canEditCurrent || busy}
                placeholder={"Product | Channel | Price | Rebate | Notes"}
                value={form.tableData}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tableData: event.target.value
                  }))
                }
              />
            </LabeledField>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Attachments
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                disabled={!canEditCurrent || busy}
                onChange={async (event) =>
                  setPendingAttachments(await readAttachments(event.target.files))
                }
              />
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                disabled={!canEditCurrent || busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose files
              </button>
              <span className="text-sm font-medium text-slate-500">
                {pendingAttachments.length > 0
                  ? `${pendingAttachments.length} new file(s) selected`
                  : "No new file selected"}
              </span>
            </div>
            {selectedRequest && selectedRequest.attachments.length > 0 ? (
              <AttachmentList
                attachments={selectedRequest.attachments}
                onPreviewAttachment={openAttachmentPreview}
              />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            {isApproverEditing ? (
              <>
                <button
                  type="button"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                  disabled={busy}
                  onClick={saveApproverCorrection}
                >
                  Save correction
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={cancelApproverEdit}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                  disabled={!canEditCurrent || busy}
                  onClick={() =>
                    runAction("save", {
                      ...form,
                      attachments: pendingAttachments
                    })
                  }
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  disabled={!canSubmitCurrent || busy}
                  onClick={() => runAction("submit", { id: form.id, note: form.note })}
                >
                  Submit
                </button>
                {canApproveCurrent ? (
                  <button
                    type="button"
                    className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={() =>
                      runAction("approve", { id: form.id, note: form.note })
                    }
                  >
                    {selectedRequest?.status === "FIRST_APPROVED"
                      ? "Final approve"
                      : "First approve"}
                  </button>
                ) : null}
                {canRejectCurrent ? (
                  <button
                    type="button"
                    className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
                    disabled={busy || !form.note.trim()}
                    onClick={() =>
                      runAction("return-for-revision", { id: form.id, note: form.note })
                    }
                  >
                    Return for revision
                  </button>
                ) : null}
                {selectedRequest?.status === "DRAFT" && canManageCurrent ? (
                  <button
                    type="button"
                    className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => runAction("delete", { id: selectedRequest.id })}
                  >
                    Delete draft
                  </button>
                ) : null}
              </>
            )}
            {message ? (
              <span className="text-sm font-semibold text-slate-600">{message}</span>
            ) : null}
          </div>
            </>
          )}
        </div>
      </div>
    </section>
    <AttachmentPreviewDialog
      busy={previewBusy}
      error={previewError}
      preview={attachmentPreview}
      onClose={() => {
        setAttachmentPreview(null);
        setPreviewError(null);
      }}
    />
    </>
  );
}

function RequestDetails({
  busy,
  canApproveCurrent,
  canEditSubmittedCurrent,
  canManageCurrent,
  canRejectCurrent,
  canWithdrawCurrent,
  duplicateCandidates,
  duplicateOfRequestId,
  form,
  isFinalPreview,
  message,
  onBackToNew,
  onDuplicate,
  onDuplicateTargetChange,
  onDiscardReturned,
  onEdit,
  onNoteChange,
  onPreviewAttachment,
  onRunAction,
  onStartRevision,
  request
}: {
  busy: boolean;
  canApproveCurrent: boolean;
  canEditSubmittedCurrent: boolean;
  canManageCurrent: boolean;
  canRejectCurrent: boolean;
  canWithdrawCurrent: boolean;
  duplicateCandidates: OtherApprovalRequestOption[];
  duplicateOfRequestId: string;
  form: OtherApprovalForm;
  isFinalPreview: boolean;
  message: string | null;
  onBackToNew: () => void;
  onDuplicate: () => void;
  onDuplicateTargetChange: (value: string) => void;
  onDiscardReturned: () => void;
  onEdit: () => void;
  onNoteChange: (note: string) => void;
  onPreviewAttachment: (attachment: OtherApprovalAttachmentOption) => void;
  onRunAction: (
    endpoint:
      | "save"
      | "submit"
      | "approve"
      | "return-for-revision"
      | "reject-close"
      | "withdraw"
      | "cancel-duplicate"
      | "discard-returned"
      | "delete"
      | "edit",
    body: Record<string, unknown>
  ) => void;
  onStartRevision: () => void;
  request: OtherApprovalRequestOption;
}) {
  const canReview = canApproveCurrent || canRejectCurrent;
  const workflowState = normalizeOtherApprovalWorkflowState({
    status: request.status,
    workflowState: request.workflowState
  });
  const canRevise = canManageCurrent && workflowState === "RETURNED_FOR_REVISION";
  const canCancelAsDuplicate =
    canManageCurrent &&
    (request.status === "SUBMITTED" || request.status === "FIRST_APPROVED") &&
    workflowState === "ACTIVE";

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_240px]">
        <ReadonlyField label="Title" value={request.title} />
        <ReadonlyField label="Country" value={request.countryCode} />
        <ReadonlyField
          label="Fee type"
          value={displayOtherApprovalFeeType(request.feeType)}
        />
        <ReadonlyField label="Channel" value={request.channelName} />
        <ReadonlyField label="Status" value={otherApprovalStatusLabel(request)} />
        <ReadonlyField label="Updated" value={formatDateTime(request.updatedAt)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReadonlyField large label="Description" value={request.description || "-"} />
        <ReadonlyField large label="Table / details" value={request.tableData || "-"} />
      </div>
      {isFinalPreview ? (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
          Preview available. Final approval unlocks after first approval.
        </div>
      ) : null}
      {workflowState === "RETURNED_FOR_REVISION" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Returned for revision. Update this request and submit the next version, or cancel it and create a new request.
        </div>
      ) : null}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Attachments
        </div>
        {request.attachments.length > 0 ? (
          <AttachmentList
            attachments={request.attachments}
            onPreviewAttachment={onPreviewAttachment}
          />
        ) : (
          <div className="mt-2 text-sm font-medium text-slate-500">
            No attachments.
          </div>
        )}
      </div>
      {request.audits.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Request history
          </div>
          <div className="mt-3 space-y-2">
            {request.audits.slice(0, 8).map((audit) => (
              <div key={audit.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                <div className="font-semibold text-slate-800">
                  {otherApprovalAuditEventLabel(audit.event)} · Version {audit.revision}
                </div>
                <div className="mt-0.5 text-xs font-medium text-slate-500">
                  {formatDateTime(audit.createdAt)} · {audit.actorEmail ?? "System"}
                </div>
                {audit.changedFields.length > 0 ? (
                  <div className="mt-1 text-xs font-medium text-slate-600">
                    Changed: {audit.changedFields.join(", ")}
                  </div>
                ) : null}
                {audit.note ? (
                  <div className="mt-1 text-sm text-slate-700">{audit.note}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {canReview ? (
        <div className="mt-4">
          <LabeledField label="Approval note">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
              disabled={busy}
              value={form.note}
              onChange={(event) => onNoteChange(event.target.value)}
            />
          </LabeledField>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={onDuplicate}
        >
          Duplicate as new request
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={onBackToNew}
        >
          Back to new request
        </button>
        {canEditSubmittedCurrent ? (
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
            disabled={busy}
            onClick={onEdit}
          >
            Edit request
          </button>
        ) : null}
        {canRevise ? (
          <>
            <button
              type="button"
              className="rounded-md border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50"
              disabled={busy}
              onClick={onStartRevision}
            >
              Edit & resubmit
            </button>
            <button
              type="button"
              className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
              disabled={busy}
              onClick={onDiscardReturned}
            >
              Discard & start new
            </button>
          </>
        ) : null}
        {canWithdrawCurrent ? (
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
            disabled={busy}
            onClick={() => onRunAction("withdraw", { id: form.id, note: form.note })}
          >
            Withdraw request
          </button>
        ) : null}
        {canApproveCurrent ? (
          <button
            type="button"
            className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => onRunAction("approve", { id: form.id, note: form.note })}
          >
            {request.status === "FIRST_APPROVED" ? "Final approve" : "First approve"}
          </button>
        ) : null}
        {canRejectCurrent ? (
          <>
            <button
              type="button"
              className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
              disabled={busy || !form.note.trim()}
              onClick={() =>
                onRunAction("return-for-revision", { id: form.id, note: form.note })
              }
            >
              Return for revision
            </button>
            <button
              type="button"
              className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
              disabled={busy || !form.note.trim()}
              onClick={() => onRunAction("reject-close", { id: form.id, note: form.note })}
            >
              Reject & close
            </button>
          </>
        ) : null}
        {canCancelAsDuplicate ? (
          <span className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
            <select
              className="max-w-[220px] rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              value={duplicateOfRequestId}
              onChange={(event) => onDuplicateTargetChange(event.target.value)}
            >
              <option value="">Cancel as duplicate</option>
              {duplicateCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.countryCode} · {candidate.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
              disabled={busy || !duplicateOfRequestId}
              onClick={() =>
                onRunAction("cancel-duplicate", {
                  id: form.id,
                  duplicateOfRequestId,
                  note: form.note
                })
              }
            >
              Confirm
            </button>
          </span>
        ) : null}
        {message ? (
          <span className="text-sm font-semibold text-slate-600">{message}</span>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentList({
  attachments,
  onPreviewAttachment
}: {
  attachments: OtherApprovalAttachmentOption[];
  onPreviewAttachment: (attachment: OtherApprovalAttachmentOption) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
        >
          <span className="max-w-[220px] truncate" title={attachment.fileName}>
            {attachment.fileName}
          </span>
          <span className="text-slate-400">{formatBytes(attachment.sizeBytes)}</span>
          <button
            type="button"
            className="font-bold text-sky-700 underline"
            onClick={() => onPreviewAttachment(attachment)}
          >
            Browse source
          </button>
          <a
            className="font-bold text-slate-700 underline"
            href={`/api/other-approvals/attachments/${attachment.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>
        </div>
      ))}
    </div>
  );
}

function AttachmentPreviewDialog({
  busy,
  error,
  onClose,
  preview
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  preview: AttachmentPreview | null;
}) {
  if (!preview && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-[94vw] flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-slate-950">
              {preview?.fileName ?? "Attachment preview"}
            </div>
            {preview ? (
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {preview.contentType || "application/octet-stream"} ·{" "}
                {formatBytes(preview.sizeBytes)}
              </div>
            ) : null}
          </div>
          {preview ? (
            <a
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              href={preview.downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {busy ? (
            <div className="rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Loading preview...
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : preview ? (
            <AttachmentPreviewContent preview={preview} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreviewContent({ preview }: { preview: AttachmentPreview }) {
  if (preview.kind === "binary" && preview.binaryKind === "image") {
    return (
      <img
        src={preview.inlineUrl}
        alt={preview.fileName}
        className="mx-auto max-h-[70vh] max-w-full rounded border border-slate-200 object-contain"
      />
    );
  }

  if (preview.kind === "binary" && preview.binaryKind === "pdf") {
    return (
      <iframe
        title={preview.fileName}
        src={preview.inlineUrl}
        className="h-[70vh] w-full rounded border border-slate-200"
      />
    );
  }

  if (preview.kind === "spreadsheet") {
    return <WorkbookSourcePreview preview={preview} />;
  }

  if (preview.kind === "text") {
    return (
      <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800">
        {preview.text || "-"}
      </pre>
    );
  }

  if (preview.kind === "unsupported") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        {preview.message}
      </div>
    );
  }

  return null;
}

function WorkbookSourcePreview({
  preview
}: {
  preview: Extract<AttachmentPreview, { kind: "spreadsheet" }>;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
        Source workbook view. Cells are shown directly from the uploaded file; use Download for native Excel formatting.
      </div>
      {preview.sheets.map((sheet) => (
        <div key={sheet.name} className="rounded-md border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-sm font-bold text-slate-800">{sheet.name}</div>
            <div className="text-[11px] font-semibold text-slate-500">
              {sheet.rows.length} rows · {sheet.maxColumnCount} columns
              {sheet.truncatedRows || sheet.truncatedCells ? " · preview limited" : ""}
            </div>
          </div>
          <div className="max-h-[68vh] overflow-auto">
            <table className="border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 min-w-12 border border-slate-200 bg-slate-100 px-2 py-1 text-center font-bold text-slate-500">
                    #
                  </th>
                  {Array.from({ length: sheet.maxColumnCount }, (_item, index) => (
                    <th
                      key={`${sheet.name}-col-${index}`}
                      className="min-w-[128px] border border-slate-200 bg-slate-100 px-2 py-1 text-center font-bold text-slate-600"
                    >
                      {columnLabel(index)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row) => (
                  <tr key={`${sheet.name}-row-${row.rowNumber}`}>
                    <th className="sticky left-0 z-10 min-w-12 border border-slate-200 bg-slate-50 px-2 py-1 text-right font-bold text-slate-500">
                      {row.rowNumber}
                    </th>
                    {Array.from({ length: sheet.maxColumnCount }, (_item, index) => (
                      <td
                        key={`${sheet.name}-${row.rowNumber}-${index}`}
                        className="max-w-[280px] border border-slate-200 px-2 py-1 align-top text-slate-800"
                      >
                        <span className="block min-h-4 whitespace-pre-wrap break-words">
                          {formatPreviewCellValue(row.cells[index] ?? "")}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadonlyField({
  label,
  large = false,
  value
}: {
  label: string;
  large?: boolean;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ${
          large ? "min-h-40 whitespace-pre-wrap font-medium" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function viewButtonClass(active: boolean) {
  return `rounded px-3 py-1.5 transition ${
    active
      ? "bg-slate-950 text-white shadow-sm"
      : "text-slate-600 hover:bg-white"
  }`;
}

function LabeledField({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusPill({
  status,
  workflowState,
  large = false
}: {
  status: PromotionPlanStatus;
  workflowState?: OtherApprovalRequestOption["workflowState"];
  large?: boolean;
}) {
  const normalizedWorkflowState = normalizeOtherApprovalWorkflowState({
    status,
    workflowState
  });
  const workflowLabel = otherApprovalWorkflowStateLabel(normalizedWorkflowState);
  const tone =
    normalizedWorkflowState === "RETURNED_FOR_REVISION"
      ? "bg-amber-50 text-amber-800"
      : normalizedWorkflowState === "WITHDRAWN" ||
          normalizedWorkflowState === "CANCELLED_DUPLICATE" ||
          normalizedWorkflowState === "REJECTED_CLOSED"
        ? "bg-rose-50 text-rose-700"
      : status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "bg-rose-50 text-rose-700"
        : status === "FIRST_APPROVED"
          ? "bg-sky-50 text-sky-700"
          : status === "SUBMITTED"
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 font-bold ${tone} ${
        large ? "text-sm" : "text-xs"
      }`}
    >
      {workflowLabel ?? statusLabel(status)}
    </span>
  );
}

function otherApprovalStatusLabel(
  request: Pick<OtherApprovalRequestOption, "status" | "workflowState">
) {
  const workflowLabel = otherApprovalWorkflowStateLabel(
    normalizeOtherApprovalWorkflowState({
      status: request.status,
      workflowState: request.workflowState
    })
  );
  return workflowLabel ?? statusLabel(request.status);
}

function loadOtherApprovalDraftId(replace = false) {
  const storageKey = "iniu-other-approval-active-draft";
  if (typeof window === "undefined") {
    return "browser-draft";
  }
  try {
    // Keep the new-request key beyond one browser tab so an unfinished form
    // remains recoverable after the user closes and later reopens the page.
    if (!replace) {
      const existing = window.localStorage.getItem(storageKey);
      if (existing) return existing;
    }
    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function formFromRequest(
  request: OtherApprovalRequestOption | undefined | null,
  defaultCountryCode: string
): OtherApprovalForm {
  return {
    id: request?.id ?? null,
    title: request?.title ?? "",
    countryCode: request?.countryCode ?? defaultCountryCode,
    channelName: request?.channelName ?? "General",
    feeType: request?.feeType ?? "Special offer",
    description: request?.description ?? "",
    tableData: request?.tableData ?? "",
    note: request?.notes ?? ""
  };
}

function compareRequests(
  left: OtherApprovalRequestOption,
  right: OtherApprovalRequestOption
) {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
    right.title.localeCompare(left.title)
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

async function readAttachments(files: FileList | null) {
  const selected = [...(files ?? [])].slice(0, 8);
  return Promise.all(
    selected.map(async (file) => ({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      base64: await fileToBase64(file)
    }))
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
    };
    reader.readAsDataURL(file);
  });
}

function isImageAttachment(attachment: OtherApprovalAttachmentOption) {
  return (
    attachment.contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(attachment.fileName)
  );
}

function isPdfAttachment(attachment: OtherApprovalAttachmentOption) {
  return (
    attachment.contentType.includes("application/pdf") ||
    /\.pdf$/i.test(attachment.fileName)
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 KB";
  }
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: PromotionPlanStatus) {
  return status
    .replace("FIRST_APPROVED", "First approved")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function otherApprovalAuditEventLabel(event: string) {
  return event
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function columnLabel(index: number) {
  let value = "";
  let cursor = index + 1;
  while (cursor > 0) {
    const remainder = (cursor - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    cursor = Math.floor((cursor - 1) / 26);
  }
  return value;
}

function formatPreviewCellValue(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue || !isPlainDecimalNumber(trimmedValue)) {
    return value;
  }

  const integerPart = trimmedValue
    .replace(/^-/, "")
    .split(".")[0]
    .replace(/,/g, "");
  if (integerPart.length > 12) {
    return value;
  }

  const numericValue = Number(trimmedValue.replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function isPlainDecimalNumber(value: string) {
  return /^-?(?:\d+|\d{1,3}(?:,\d{3})+)\.\d+$/.test(value);
}

function emailNotificationLabel(
  status: PromotionPlanEmailNotificationOption["status"]
) {
  if (status === "SENT") {
    return "sent";
  }

  if (status === "FAILED") {
    return "failed";
  }

  if (status === "PENDING") {
    return "pending";
  }

  return "not configured";
}

function emailStatusClass(
  status: PromotionPlanEmailNotificationOption["status"]
) {
  if (status === "SENT") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "PENDING") {
    return "bg-sky-50 text-sky-700";
  }

  return "bg-amber-50 text-amber-800";
}

function archiveStatusLabel(
  status: PromotionPlanArchiveOption["driveStatus"] | undefined
) {
  if (status === "UPLOADED") {
    return "Drive archived";
  }

  if (status === "FAILED") {
    return "Drive failed";
  }

  return "Drive not configured";
}

function archiveStatusClass(
  status: PromotionPlanArchiveOption["driveStatus"] | undefined
) {
  if (status === "UPLOADED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-800";
}

function approvalQueueMonthLabel(item: PromotionPlanApprovalQueueItem) {
  return `${item.planYear}-${String(item.planMonth).padStart(2, "0")}`;
}

function deliveryPeriodLabel(
  notification: PromotionPlanEmailNotificationOption,
  archive: PromotionPlanArchiveOption | null
) {
  if (
    notification.planMonth === 0 ||
    archive?.source.startsWith("BUSINESS_PLAN")
  ) {
    return `${notification.planYear} BP`;
  }

  return promotionPlanMonthKey({
    year: notification.planYear,
    month: notification.planMonth
  });
}

function approvalStageLabel(stage: PromotionPlanApprovalQueueItem["stage"]) {
  return stage === "final" ? "Final approval" : "First approval";
}

function formatSubmittedAt(value: string | null) {
  if (!value) {
    return "No submit time";
  }

  return formatEuropeanDateTime(value);
}

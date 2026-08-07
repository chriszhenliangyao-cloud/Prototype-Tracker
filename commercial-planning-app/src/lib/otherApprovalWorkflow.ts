import type {
  OtherApprovalWorkflowState,
  PromotionPlanStatus
} from "./types";
import type { PromotionPlanApproverCapabilities } from "./promotionPlanApprovalWorkflow";

export type OtherApprovalEditableFields = {
  title: string;
  channelName: string;
  description: string;
  tableData: string;
};

export type OtherApprovalEditPlan = {
  changedFields: string[];
  previousValues: Record<string, string>;
  nextValues: Record<string, string>;
  isMaterial: boolean;
};

const materialEditFields = new Set<keyof OtherApprovalEditableFields>([
  "channelName",
  "tableData"
]);

const workflowStates = new Set<OtherApprovalWorkflowState>([
  "ACTIVE",
  "RETURNED_FOR_REVISION",
  "WITHDRAWN",
  "CANCELLED_DUPLICATE",
  "REJECTED_CLOSED"
]);

export function normalizeOtherApprovalWorkflowState({
  status,
  workflowState
}: {
  status: PromotionPlanStatus;
  workflowState?: string | null;
}): OtherApprovalWorkflowState {
  if (workflowState && workflowStates.has(workflowState as OtherApprovalWorkflowState)) {
    return workflowState as OtherApprovalWorkflowState;
  }

  // Existing rejected requests predate explicit rework states. Preserve their
  // established behavior by treating them as requests returned to the sender.
  return status === "REJECTED" ? "RETURNED_FOR_REVISION" : "ACTIVE";
}

export function otherApprovalWorkflowStateLabel(
  workflowState: OtherApprovalWorkflowState
) {
  switch (workflowState) {
    case "RETURNED_FOR_REVISION":
      return "Needs revision";
    case "WITHDRAWN":
      return "Withdrawn";
    case "CANCELLED_DUPLICATE":
      return "Cancelled as duplicate";
    case "REJECTED_CLOSED":
      return "Rejected and closed";
    default:
      return null;
  }
}

export function isOtherApprovalActive({
  status,
  workflowState
}: {
  status: PromotionPlanStatus;
  workflowState?: string | null;
}) {
  return normalizeOtherApprovalWorkflowState({ status, workflowState }) === "ACTIVE";
}

export function canManageOtherApprovalRequest({
  createdByEmail,
  submittedByEmail,
  roleCanManageAll,
  userEmail
}: {
  createdByEmail: string | null;
  submittedByEmail: string | null;
  roleCanManageAll: boolean;
  userEmail: string | null;
}) {
  if (roleCanManageAll) return true;
  const current = normalizeEmail(userEmail);
  return Boolean(
    current &&
      [createdByEmail, submittedByEmail].some(
        (email) => normalizeEmail(email) === current
      )
  );
}

export function isPotentialOtherApprovalDuplicate({
  current,
  candidate
}: {
  current: {
    countryCode: string;
    channelName: string;
    feeType: string;
    title: string;
  };
  candidate: {
    countryCode: string;
    channelName: string;
    feeType: string;
    title: string;
  };
}) {
  return (
    normalizeValue(current.countryCode) === normalizeValue(candidate.countryCode) &&
    normalizeValue(current.channelName) === normalizeValue(candidate.channelName) &&
    normalizeValue(current.feeType) === normalizeValue(candidate.feeType) &&
    normalizeValue(current.title) === normalizeValue(candidate.title)
  );
}

export function canViewOtherApprovalInInbox({
  status,
  workflowState,
  capabilities
}: {
  status: PromotionPlanStatus;
  workflowState?: string | null;
  capabilities: PromotionPlanApproverCapabilities;
}) {
  if (!isOtherApprovalActive({ status, workflowState })) return false;
  return (
    (status === "SUBMITTED" &&
      (capabilities.canFirstApprove || capabilities.canFinalApprove)) ||
    (status === "FIRST_APPROVED" && capabilities.canFinalApprove)
  );
}

export function canEditSubmittedOtherApproval({
  status,
  workflowState,
  capabilities
}: {
  status: PromotionPlanStatus;
  workflowState?: string | null;
  capabilities: PromotionPlanApproverCapabilities;
}) {
  if (!isOtherApprovalActive({ status, workflowState })) return false;
  return (
    (status === "SUBMITTED" || status === "FIRST_APPROVED") &&
    (capabilities.canFirstApprove || capabilities.canFinalApprove)
  );
}

export function resolveOtherApprovalRejectionTransition({
  currentStatus,
  workflowState,
  capabilities
}: {
  currentStatus: PromotionPlanStatus;
  workflowState?: string | null;
  capabilities: PromotionPlanApproverCapabilities;
}): { allowed: true } | { allowed: false; message: string } {
  if (!isOtherApprovalActive({ status: currentStatus, workflowState })) {
    return { allowed: false, message: "This request is already closed." };
  }
  if (currentStatus === "SUBMITTED") {
    return capabilities.canFirstApprove
      ? { allowed: true }
      : {
          allowed: false,
          message: capabilities.canFinalApprove
            ? "Final review can begin after first approval."
            : "First approval requires the first approver."
        };
  }

  if (currentStatus === "FIRST_APPROVED") {
    return capabilities.canFinalApprove
      ? { allowed: true }
      : {
          allowed: false,
          message: "Final rejection requires the final approver."
        };
  }

  if (currentStatus === "APPROVED") {
    return { allowed: false, message: "Approved requests cannot be rejected." };
  }

  return { allowed: false, message: "Request must be in approval first." };
}

function normalizeValue(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

function normalizeEmail(value: string | null | undefined) {
  return normalizeValue(value);
}

export function buildOtherApprovalEditPlan({
  current,
  next,
  hasNewAttachments = false
}: {
  current: OtherApprovalEditableFields;
  next: OtherApprovalEditableFields;
  hasNewAttachments?: boolean;
}): OtherApprovalEditPlan {
  const changedEditableFields = (
    Object.keys(current) as Array<keyof OtherApprovalEditableFields>
  ).filter((field) => current[field] !== next[field]);
  const changedFields: string[] = [...changedEditableFields];
  const previousValues = Object.fromEntries(
    changedEditableFields.map((field) => [field, current[field]])
  );
  const nextValues = Object.fromEntries(
    changedEditableFields.map((field) => [field, next[field]])
  );

  if (hasNewAttachments) {
    changedFields.push("attachments");
    previousValues.attachments = "No new attachments";
    nextValues.attachments = "New attachment(s) added";
  }

  return {
    changedFields,
    previousValues,
    nextValues,
    isMaterial:
      hasNewAttachments ||
      changedFields.some((field) => materialEditFields.has(field as keyof OtherApprovalEditableFields))
  };
}

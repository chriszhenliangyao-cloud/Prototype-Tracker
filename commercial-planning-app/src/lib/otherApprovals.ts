import {
  canBypassPromotionPlanLocks,
  canSaveScenario,
  canViewAllCountries
} from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  resolvePromotionPlanApprovalTransition,
  type PromotionPlanApproverCapabilities
} from "@/lib/promotionPlanApprovalWorkflow";
import {
  sendOtherApprovalApprovedEmail,
  sendOtherApprovalWorkflowEmail,
  type OtherApprovalEmailDelivery
} from "./otherApprovalEmail";
import {
  approvalSystemUrl,
  sendApprovalRequiredNotification
} from "./approvalNotifications";
import { displayOtherApprovalFeeType } from "./otherApprovalLabels";
import {
  buildOtherApprovalEditPlan,
  canManageOtherApprovalRequest,
  canEditSubmittedOtherApproval,
  isPotentialOtherApprovalDuplicate,
  isOtherApprovalActive,
  normalizeOtherApprovalWorkflowState,
  resolveOtherApprovalRejectionTransition,
  type OtherApprovalEditableFields
} from "./otherApprovalWorkflow";
import type {
  OtherApprovalRequestOption,
  PromotionPlanStatus,
  UserRole
} from "@/lib/types";

export type OtherApprovalAttachmentInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  base64: string;
};

export type OtherApprovalSaveInput = {
  id?: string | null;
  title: string;
  countryCode: string;
  channelName?: string | null;
  feeType: string;
  description?: string | null;
  tableData?: string | null;
  attachments?: OtherApprovalAttachmentInput[];
};

export type OtherApprovalEditInput = OtherApprovalSaveInput & {
  id: string;
  editNote: string;
};

const otherApprovalInclude = {
  attachments: { orderBy: { createdAt: "asc" } },
  audits: { orderBy: { createdAt: "desc" } }
} as const;

export async function getOtherApprovalRequests({
  countryCodes,
  limit = 80
}: {
  countryCodes?: string[];
  limit?: number;
} = {}): Promise<OtherApprovalRequestOption[]> {
  if (countryCodes && countryCodes.length === 0) {
    return [];
  }

  const requests = await prisma.otherApprovalRequest.findMany({
    where:
      countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : undefined,
    include: otherApprovalInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit
  });

  return requests.map(serializeOtherApprovalRequest);
}

export async function saveOtherApprovalRequest({
  accessibleCountryCodes,
  input,
  role,
  userEmail
}: {
  accessibleCountryCodes: string[];
  input: OtherApprovalSaveInput;
  role: UserRole;
  userEmail: string | null;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!canSaveScenario(role)) {
    return { ok: false as const, error: "You do not have approval request access." };
  }
  if (!hasCountryAccess(role, countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this country." };
  }

  const title = input.title.trim();
  const feeType = input.feeType.trim();
  if (!title || !countryCode || !feeType) {
    return { ok: false as const, error: "Title, country, and fee type are required." };
  }

  const now = new Date();
  const existing = input.id
    ? await prisma.otherApprovalRequest.findUnique({ where: { id: input.id } })
    : null;
  if (input.id && !existing) {
    return { ok: false as const, error: "Approval request not found." };
  }
  if (existing) {
    if (
      !canManageOtherApprovalRequest({
        createdByEmail: existing.createdByEmail,
        submittedByEmail: existing.submittedByEmail,
        roleCanManageAll: canBypassPromotionPlanLocks(role),
        userEmail
      })
    ) {
      return { ok: false as const, error: "Only the requester can edit this draft." };
    }
    const workflowState = normalizeOtherApprovalWorkflowState({
      status: otherApprovalStatus(existing.status),
      workflowState: existing.workflowState
    });
    if (
      existing.status !== "DRAFT" &&
      !(existing.status === "REJECTED" && workflowState === "RETURNED_FOR_REVISION")
    ) {
      return {
        ok: false as const,
        error: "This request is closed or already in approval. Use the available workflow action instead."
      };
    }
  }

  const data = {
    title,
    countryCode,
    channelName: input.channelName?.trim() || "General",
    feeType,
    description: input.description?.trim() || "",
    tableData: input.tableData?.trim() || "",
    updatedByEmail: userEmail
  };

  const request = existing
    ? await prisma.otherApprovalRequest.update({
        where: { id: existing.id },
        data: {
          ...data,
          updatedAt: now,
          ...(existing.status === "REJECTED"
            ? {
                status: "DRAFT" as const,
                workflowState: "ACTIVE",
                revision: existing.revision + 1,
                rejectedByEmail: null,
                rejectedAt: null,
                audits: {
                  create: {
                    event: "REVISION_DRAFT_CREATED",
                    revision: existing.revision + 1,
                    note: "Returned request reopened as a new revision draft.",
                    actorEmail: userEmail
                  }
                }
              }
            : {})
        }
      })
    : await prisma.otherApprovalRequest.create({
        data: {
          ...data,
          status: "DRAFT",
          createdByEmail: userEmail,
          updatedByEmail: userEmail,
          audits: {
            create: {
              event: "CREATED",
              revision: 1,
              actorEmail: userEmail
            }
          }
        }
      });

  const attachments = normalizeAttachments(input.attachments);
  if (attachments.length > 0) {
    await prisma.otherApprovalAttachment.createMany({
      data: attachments.map((attachment) => ({
        requestId: request.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        fileBytes: Buffer.from(attachment.base64, "base64"),
        uploadedByEmail: userEmail
      }))
    });
  }

  const updated = await prisma.otherApprovalRequest.findUnique({
    where: { id: request.id },
    include: otherApprovalInclude
  });
  return { ok: true as const, request: updated ? serializeOtherApprovalRequest(updated) : null };
}

export async function submitOtherApprovalRequest({
  accessibleCountryCodes,
  id,
  note,
  role,
  userEmail
}: {
  accessibleCountryCodes: string[];
  id: string;
  note?: string | null;
  role: UserRole;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) {
    return { ok: false as const, error: "Approval request not found." };
  }
  if (!canSaveScenario(role)) {
    return { ok: false as const, error: "You do not have approval request access." };
  }
  if (!hasCountryAccess(role, request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this country." };
  }
  if (!canManageOtherApprovalRequest({
    createdByEmail: request.createdByEmail,
    submittedByEmail: request.submittedByEmail,
    roleCanManageAll: canBypassPromotionPlanLocks(role),
    userEmail
  })) {
    return { ok: false as const, error: "Only the requester can submit this request." };
  }
  if (request.status !== "DRAFT") {
    return { ok: false as const, error: "Save a returned request as a draft before resubmitting." };
  }

  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      workflowState: "ACTIVE",
      submittedByEmail: userEmail,
      submittedAt: new Date(),
      notes: note?.trim() || request.notes,
      updatedByEmail: userEmail,
      audits: {
        create: {
          event: request.revision > 1 ? "RESUBMITTED" : "SUBMITTED",
          revision: request.revision,
          note: note?.trim() || null,
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });
  const serialized = serializeOtherApprovalRequest(updated);
  const feeTypeLabel = displayOtherApprovalFeeType(updated.feeType);
  await Promise.all([
    sendApprovalRequiredNotification({
      requestType: "OTHER_APPROVAL",
      requestId: updated.id,
      countryCodes: [updated.countryCode],
      stage: "FIRST_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl("/platform/collaboration/other-approvals"),
      subject: `Approval required · Other Approval · ${updated.countryCode} · ${updated.title}`,
      summaryLines: otherApprovalSummaryLines(updated, feeTypeLabel, userEmail)
    }),
    sendApprovalRequiredNotification({
      requestType: "OTHER_APPROVAL",
      requestId: updated.id,
      countryCodes: [updated.countryCode],
      stage: "FINAL_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl("/platform/collaboration/other-approvals"),
      event: "PREVIEW_AVAILABLE",
      messageTitle:
        "Other Approval submitted. Preview is available; final approval unlocks after first approval.",
      subject: `Preview available · Other Approval · ${updated.countryCode} · ${updated.title}`,
      summaryLines: otherApprovalSummaryLines(updated, feeTypeLabel, userEmail)
    })
  ]);
  return { ok: true as const, request: serialized };
}

export async function approveOtherApprovalRequest({
  accessibleCountryCodes,
  capabilities,
  id,
  note,
  userEmail
}: {
  accessibleCountryCodes: string[];
  capabilities: PromotionPlanApproverCapabilities;
  id: string;
  note?: string | null;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) {
    return { ok: false as const, error: "Approval request not found." };
  }
  if (!hasCountryAccess("VIEWER", request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this country." };
  }

  const transition = resolvePromotionPlanApprovalTransition({
    currentStatus: request.status as PromotionPlanStatus,
    capabilities
  });
  if (!transition.allowed) {
    return { ok: false as const, error: transition.message };
  }

  const now = new Date();
  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data:
      transition.stage === "first"
        ? {
            status: transition.nextStatus,
            firstApprovedByEmail: userEmail,
            firstApprovedAt: now,
            notes: note?.trim() || request.notes,
            updatedByEmail: userEmail,
            audits: {
              create: {
                event: "FIRST_APPROVED",
                revision: request.revision,
                note: note?.trim() || null,
                actorEmail: userEmail
              }
            }
          }
        : {
            status: transition.nextStatus,
            approvedByEmail: userEmail,
            approvedAt: now,
            notes: note?.trim() || request.notes,
            updatedByEmail: userEmail,
            audits: {
              create: {
                event: "FINAL_APPROVED",
                revision: request.revision,
                note: note?.trim() || null,
                actorEmail: userEmail
              }
            }
          },
    include: otherApprovalInclude
  });
  const serialized = serializeOtherApprovalRequest(updated);
  const feeTypeLabel = displayOtherApprovalFeeType(updated.feeType);
  let emailDelivery: OtherApprovalEmailDelivery | null = null;
  if (transition.stage === "final") {
    emailDelivery = await sendOtherApprovalApprovedEmail({
      request: serialized
    });
  } else {
    await sendApprovalRequiredNotification({
      requestType: "OTHER_APPROVAL",
      requestId: updated.id,
      countryCodes: [updated.countryCode],
      stage: "FINAL_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl("/platform/collaboration/other-approvals"),
      subject: `Final approval required · Other Approval · ${updated.countryCode} · ${updated.title}`,
      summaryLines: [
        `Title: ${updated.title}`,
        `Country: ${updated.countryCode}`,
        `Channel: ${updated.channelName || "-"}`,
        `Fee type: ${feeTypeLabel}`,
        `First approved by: ${userEmail ?? "-"}`
      ]
    });
  }

  return { ok: true as const, request: serialized, emailDelivery };
}

export async function rejectOtherApprovalRequest({
  accessibleCountryCodes,
  capabilities,
  id,
  note,
  userEmail
}: {
  accessibleCountryCodes: string[];
  capabilities: PromotionPlanApproverCapabilities;
  id: string;
  note?: string | null;
  userEmail: string | null;
}) {
  return returnOtherApprovalForRevision({
    accessibleCountryCodes,
    capabilities,
    id,
    note,
    userEmail
  });
}

export async function returnOtherApprovalForRevision({
  accessibleCountryCodes,
  capabilities,
  id,
  note,
  userEmail
}: {
  accessibleCountryCodes: string[];
  capabilities: PromotionPlanApproverCapabilities;
  id: string;
  note?: string | null;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) {
    return { ok: false as const, error: "Approval request not found." };
  }
  if (!hasCountryAccess("VIEWER", request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this country." };
  }
  const transition = resolveOtherApprovalRejectionTransition({
    currentStatus: otherApprovalStatus(request.status),
    workflowState: request.workflowState,
    capabilities
  });
  if (!transition.allowed) {
    return { ok: false as const, error: transition.message };
  }

  const returnNote = note?.trim();
  if (!returnNote) {
    return { ok: false as const, error: "Add a revision note before returning the request." };
  }

  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      workflowState: "RETURNED_FOR_REVISION",
      rejectedByEmail: userEmail,
      rejectedAt: new Date(),
      notes: returnNote,
      updatedByEmail: userEmail,
      audits: {
        create: {
          event: "RETURNED_FOR_REVISION",
          revision: request.revision,
          note: returnNote,
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });
  const serialized = serializeOtherApprovalRequest(updated);
  const emailDelivery = await sendOtherApprovalWorkflowEmail({
    actorEmail: userEmail,
    eventLabel: "Returned for revision",
    note: returnNote,
    request: serialized
  });
  return { ok: true as const, request: serialized, emailDelivery };
}

export async function closeOtherApprovalRequest({
  accessibleCountryCodes,
  capabilities,
  id,
  note,
  userEmail
}: {
  accessibleCountryCodes: string[];
  capabilities: PromotionPlanApproverCapabilities;
  id: string;
  note?: string | null;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) return { ok: false as const, error: "Approval request not found." };
  if (!hasCountryAccess("VIEWER", request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this country." };
  }
  const transition = resolveOtherApprovalRejectionTransition({
    currentStatus: otherApprovalStatus(request.status),
    workflowState: request.workflowState,
    capabilities
  });
  if (!transition.allowed) return { ok: false as const, error: transition.message };
  const closeNote = note?.trim();
  if (!closeNote) {
    return { ok: false as const, error: "Add a closing reason before rejecting the request." };
  }

  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      workflowState: "REJECTED_CLOSED",
      rejectedByEmail: userEmail,
      rejectedAt: new Date(),
      notes: closeNote,
      updatedByEmail: userEmail,
      audits: {
        create: {
          event: "REJECTED_CLOSED",
          revision: request.revision,
          note: closeNote,
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });
  const serialized = serializeOtherApprovalRequest(updated);
  const emailDelivery = await sendOtherApprovalWorkflowEmail({
    actorEmail: userEmail,
    eventLabel: "Rejected and closed",
    note: closeNote,
    request: serialized
  });
  return { ok: true as const, request: serialized, emailDelivery };
}

export async function withdrawOtherApprovalRequest({
  accessibleCountryCodes,
  id,
  note,
  role,
  userEmail
}: {
  accessibleCountryCodes: string[];
  id: string;
  note?: string | null;
  role: UserRole;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) return { ok: false as const, error: "Approval request not found." };
  if (!canSaveScenario(role) || !hasCountryAccess(role, request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this request." };
  }
  if (!canManageOtherApprovalRequest({
    createdByEmail: request.createdByEmail,
    submittedByEmail: request.submittedByEmail,
    roleCanManageAll: canBypassPromotionPlanLocks(role),
    userEmail
  })) {
    return { ok: false as const, error: "Only the requester can withdraw this request." };
  }
  if (!isOtherApprovalActive({ status: otherApprovalStatus(request.status), workflowState: request.workflowState }) ||
    (request.status !== "SUBMITTED" && request.status !== "FIRST_APPROVED")) {
    return { ok: false as const, error: "Only active approval requests can be withdrawn." };
  }
  const withdrawNote = note?.trim() || "Withdrawn by requester.";
  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      workflowState: "WITHDRAWN",
      rejectedByEmail: userEmail,
      rejectedAt: new Date(),
      notes: withdrawNote,
      updatedByEmail: userEmail,
      audits: {
        create: {
          event: "WITHDRAWN",
          revision: request.revision,
          note: withdrawNote,
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });
  const serialized = serializeOtherApprovalRequest(updated);
  const emailDelivery = await sendOtherApprovalWorkflowEmail({
    actorEmail: userEmail,
    eventLabel: "Withdrawn",
    note: withdrawNote,
    request: serialized
  });
  await notifyOtherApprovalWorkflowChange({
    event: "REQUEST_WITHDRAWN",
    messageTitle: "Other Approval was withdrawn. No action is needed.",
    request: updated,
    subjectPrefix: "Withdrawn",
    userEmail
  });
  return { ok: true as const, request: serialized, emailDelivery };
}

export async function cancelOtherApprovalAsDuplicate({
  accessibleCountryCodes,
  duplicateOfRequestId,
  id,
  note,
  role,
  userEmail
}: {
  accessibleCountryCodes: string[];
  duplicateOfRequestId?: string | null;
  id: string;
  note?: string | null;
  role: UserRole;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) return { ok: false as const, error: "Approval request not found." };
  if (!canSaveScenario(role) || !hasCountryAccess(role, request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this request." };
  }
  if (!canManageOtherApprovalRequest({
    createdByEmail: request.createdByEmail,
    submittedByEmail: request.submittedByEmail,
    roleCanManageAll: canBypassPromotionPlanLocks(role),
    userEmail
  })) {
    return { ok: false as const, error: "Only the requester can cancel a duplicate request." };
  }
  if (request.status === "APPROVED") {
    return { ok: false as const, error: "Approved requests cannot be cancelled as duplicates." };
  }
  if (
    !isOtherApprovalActive({
      status: otherApprovalStatus(request.status),
      workflowState: request.workflowState
    }) ||
    (request.status !== "SUBMITTED" && request.status !== "FIRST_APPROVED")
  ) {
    return {
      ok: false as const,
      error: "Only active requests in approval can be cancelled as duplicates."
    };
  }

  const duplicateTargetId = duplicateOfRequestId?.trim() || null;
  if (!duplicateTargetId) {
    return { ok: false as const, error: "Choose the request this item duplicates." };
  }
  const target = await prisma.otherApprovalRequest.findUnique({
    where: { id: duplicateTargetId }
  });
  if (
    !target ||
    target.id === request.id ||
    target.status === "DRAFT" ||
    !isOtherApprovalActive({
      status: otherApprovalStatus(target.status),
      workflowState: target.workflowState
    }) ||
    !isPotentialOtherApprovalDuplicate({ current: request, candidate: target })
  ) {
    return {
      ok: false as const,
      error: "Choose an active request with the same market, channel, fee type, and title."
    };
  }

  const duplicateNote = note?.trim() || "Cancelled as a duplicate request.";
  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      workflowState: "CANCELLED_DUPLICATE",
      duplicateOfRequestId: duplicateTargetId,
      rejectedByEmail: userEmail,
      rejectedAt: new Date(),
      notes: duplicateNote,
      updatedByEmail: userEmail,
      audits: {
        create: {
          event: "CANCELLED_DUPLICATE",
          revision: request.revision,
          note: duplicateNote,
          nextValues: duplicateTargetId
            ? JSON.stringify({ duplicateOfRequestId: duplicateTargetId })
            : null,
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });
  const serialized = serializeOtherApprovalRequest(updated);
  const emailDelivery = await sendOtherApprovalWorkflowEmail({
    actorEmail: userEmail,
    eventLabel: "Cancelled as duplicate",
    note: duplicateNote,
    request: serialized
  });
  await notifyOtherApprovalWorkflowChange({
    event: "REQUEST_CANCELLED_DUPLICATE",
    messageTitle: "Other Approval was cancelled as a duplicate. No action is needed.",
    request: updated,
    subjectPrefix: "Cancelled as duplicate",
    userEmail
  });
  return { ok: true as const, request: serialized, emailDelivery };
}

export async function deleteOtherApprovalDraft({
  accessibleCountryCodes,
  id,
  role,
  userEmail
}: {
  accessibleCountryCodes: string[];
  id: string;
  role: UserRole;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) return { ok: false as const, error: "Approval request not found." };
  if (!canSaveScenario(role) || !hasCountryAccess(role, request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this request." };
  }
  if (!canManageOtherApprovalRequest({
    createdByEmail: request.createdByEmail,
    submittedByEmail: request.submittedByEmail,
    roleCanManageAll: canBypassPromotionPlanLocks(role),
    userEmail
  })) {
    return { ok: false as const, error: "Only the requester can delete this draft." };
  }
  if (request.status !== "DRAFT") {
    return {
      ok: false as const,
      error: "Only unsubmitted drafts can be deleted. Use Withdraw or Cancel as duplicate to preserve submitted history."
    };
  }
  await prisma.otherApprovalRequest.delete({ where: { id } });
  return { ok: true as const, deletedId: id, message: "Draft deleted." };
}

export async function discardReturnedOtherApprovalRequest({
  accessibleCountryCodes,
  id,
  role,
  userEmail
}: {
  accessibleCountryCodes: string[];
  id: string;
  role: UserRole;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({ where: { id } });
  if (!request) return { ok: false as const, error: "Approval request not found." };
  if (!canSaveScenario(role) || !hasCountryAccess(role, request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this request." };
  }
  if (!canManageOtherApprovalRequest({
    createdByEmail: request.createdByEmail,
    submittedByEmail: request.submittedByEmail,
    roleCanManageAll: canBypassPromotionPlanLocks(role),
    userEmail
  })) {
    return { ok: false as const, error: "Only the requester can discard this returned request." };
  }
  if (
    request.status !== "REJECTED" ||
    normalizeOtherApprovalWorkflowState({
      status: otherApprovalStatus(request.status),
      workflowState: request.workflowState
    }) !== "RETURNED_FOR_REVISION"
  ) {
    return { ok: false as const, error: "Only returned requests can be discarded." };
  }

  const updated = await prisma.otherApprovalRequest.update({
    where: { id },
    data: {
      workflowState: "WITHDRAWN",
      notes: "Returned request discarded by requester.",
      updatedByEmail: userEmail,
      audits: {
        create: {
          event: "RETURNED_REQUEST_DISCARDED",
          revision: request.revision,
          note: "Returned request discarded. A replacement can now be created.",
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });

  return {
    ok: true as const,
    request: serializeOtherApprovalRequest(updated),
    message: "Returned request discarded. You can now create a new request."
  };
}

export async function editSubmittedOtherApprovalRequest({
  accessibleCountryCodes,
  capabilities,
  input,
  userEmail
}: {
  accessibleCountryCodes: string[];
  capabilities: PromotionPlanApproverCapabilities;
  input: OtherApprovalEditInput;
  userEmail: string | null;
}) {
  const request = await prisma.otherApprovalRequest.findUnique({
    where: { id: input.id }
  });
  if (!request) {
    return { ok: false as const, error: "Approval request not found." };
  }
  if (!hasCountryAccess("VIEWER", request.countryCode, accessibleCountryCodes)) {
    return { ok: false as const, error: "You do not have access to this country." };
  }
  if (
    !canEditSubmittedOtherApproval({
      status: otherApprovalStatus(request.status),
      workflowState: request.workflowState,
      capabilities
    })
  ) {
    return {
      ok: false as const,
      error: "Only an assigned approver can correct an active approval request."
    };
  }

  const editNote = input.editNote.trim();
  if (!editNote) {
    return { ok: false as const, error: "Add a correction note before saving." };
  }
  if (input.countryCode.trim().toUpperCase() !== request.countryCode) {
    return { ok: false as const, error: "Country cannot change after submission." };
  }
  if (input.feeType.trim() !== request.feeType) {
    return { ok: false as const, error: "Fee type cannot change after submission." };
  }

  const current: OtherApprovalEditableFields = {
    title: request.title,
    channelName: request.channelName,
    description: request.description,
    tableData: request.tableData
  };
  const next: OtherApprovalEditableFields = {
    title: input.title.trim(),
    channelName: input.channelName?.trim() || "General",
    description: input.description?.trim() || "",
    tableData: input.tableData?.trim() || ""
  };
  if (!next.title) {
    return { ok: false as const, error: "Title is required." };
  }

  const attachments = normalizeAttachments(input.attachments);
  const plan = buildOtherApprovalEditPlan({
    current,
    next,
    hasNewAttachments: attachments.length > 0
  });
  if (plan.changedFields.length === 0) {
    return { ok: false as const, error: "No changes were detected." };
  }

  const nextStatus = plan.isMaterial ? "SUBMITTED" : otherApprovalStatus(request.status);
  const nextRevision = request.revision + 1;
  const updated = await prisma.otherApprovalRequest.update({
    where: { id: request.id },
    data: {
      ...next,
      revision: nextRevision,
      status: nextStatus,
      workflowState: "ACTIVE",
      updatedByEmail: userEmail,
      ...(plan.isMaterial
        ? {
            firstApprovedByEmail: null,
            firstApprovedAt: null,
            approvedByEmail: null,
            approvedAt: null
          }
        : {}),
      ...(attachments.length > 0
        ? {
            attachments: {
              create: attachments.map((attachment) => ({
                fileName: attachment.fileName,
                contentType: attachment.contentType,
                sizeBytes: attachment.sizeBytes,
                fileBytes: Buffer.from(attachment.base64, "base64"),
                uploadedByEmail: userEmail
              }))
            }
          }
        : {}),
      audits: {
        create: {
          event: plan.isMaterial ? "EDITED_REAPPROVAL_REQUIRED" : "EDITED",
          revision: nextRevision,
          note: editNote,
          changedFields: JSON.stringify(plan.changedFields),
          previousValues: JSON.stringify(plan.previousValues),
          nextValues: JSON.stringify(plan.nextValues),
          actorEmail: userEmail
        }
      }
    },
    include: otherApprovalInclude
  });

  const feeTypeLabel = displayOtherApprovalFeeType(updated.feeType);
  const summaryLines = [
    ...otherApprovalSummaryLines(updated, feeTypeLabel, updated.submittedByEmail),
    `Correction by: ${userEmail ?? "-"}`,
    `Changed: ${plan.changedFields.join(", ")}`,
    `Correction note: ${editNote}`
  ];
  await Promise.all([
    sendApprovalRequiredNotification({
      requestType: "OTHER_APPROVAL",
      requestId: updated.id,
      countryCodes: [updated.countryCode],
      stage: "FIRST_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl("/platform/collaboration/other-approvals"),
      event: "REQUEST_UPDATED",
      messageTitle: plan.isMaterial
        ? "Other Approval was updated and requires first re-approval."
        : "Other Approval was updated. The approval workflow remains in progress.",
      subject: `Updated · Other Approval · ${updated.countryCode} · ${updated.title}`,
      summaryLines
    }),
    sendApprovalRequiredNotification({
      requestType: "OTHER_APPROVAL",
      requestId: updated.id,
      countryCodes: [updated.countryCode],
      stage: "FINAL_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl("/platform/collaboration/other-approvals"),
      event: "REQUEST_UPDATED",
      messageTitle: plan.isMaterial
        ? "Other Approval was updated. Preview is available; final approval unlocks after first re-approval."
        : nextStatus === "FIRST_APPROVED"
          ? "Other Approval was updated. Final approval remains pending."
          : "Other Approval was updated. Preview is available; final approval unlocks after first approval.",
      subject: `Updated · Other Approval · ${updated.countryCode} · ${updated.title}`,
      summaryLines
    })
  ]);

  return {
    ok: true as const,
    request: serializeOtherApprovalRequest(updated),
    message: plan.isMaterial
      ? "Correction saved. First approval has been requested again."
      : "Correction saved and recorded in the request history."
  };
}

function hasCountryAccess(
  role: UserRole,
  countryCode: string,
  accessibleCountryCodes: string[]
) {
  return (
    canViewAllCountries(role) ||
    accessibleCountryCodes.includes(countryCode.toUpperCase())
  );
}

function normalizeAttachments(attachments: OtherApprovalAttachmentInput[] | undefined) {
  return (attachments ?? [])
    .filter(
      (attachment) =>
        attachment.fileName.trim() &&
        attachment.base64.trim() &&
        Number.isFinite(attachment.sizeBytes)
    )
    .slice(0, 8)
    .map((attachment) => ({
      fileName: attachment.fileName.trim(),
      contentType: attachment.contentType.trim() || "application/octet-stream",
      sizeBytes: Math.max(0, Math.round(attachment.sizeBytes)),
      base64: attachment.base64.trim()
    }));
}

function otherApprovalSummaryLines(
  request: {
    title: string;
    countryCode: string;
    channelName: string;
  },
  feeTypeLabel: string,
  submittedByEmail: string | null
) {
  return [
    `Title: ${request.title}`,
    `Country: ${request.countryCode}`,
    `Channel: ${request.channelName || "-"}`,
    `Fee type: ${feeTypeLabel}`,
    `Submitted by: ${submittedByEmail ?? "-"}`
  ];
}

async function notifyOtherApprovalWorkflowChange({
  event,
  messageTitle,
  request,
  subjectPrefix,
  userEmail
}: {
  event: string;
  messageTitle: string;
  request: {
    id: string;
    title: string;
    countryCode: string;
    channelName: string;
    feeType: string;
  };
  subjectPrefix: string;
  userEmail: string | null;
}) {
  const feeTypeLabel = displayOtherApprovalFeeType(request.feeType);
  const summaryLines = [
    ...otherApprovalSummaryLines(request, feeTypeLabel, userEmail),
    "No approval action is required."
  ];
  await Promise.all(
    (["FIRST_APPROVAL", "FINAL_APPROVAL"] as const).map((stage) =>
      sendApprovalRequiredNotification({
        requestType: "OTHER_APPROVAL",
        requestId: request.id,
        countryCodes: [request.countryCode],
        stage,
        createdByEmail: userEmail,
        actionUrl: approvalSystemUrl("/platform/collaboration/other-approvals"),
        event,
        messageTitle,
        subject: `${subjectPrefix} · Other Approval · ${request.countryCode} · ${request.title}`,
        summaryLines
      })
    )
  );
}

function serializeOtherApprovalRequest(request: {
  id: string;
  title: string;
  countryCode: string;
  channelName: string;
  feeType: string;
  description: string;
  tableData: string;
  status: string;
  workflowState: string;
  duplicateOfRequestId: string | null;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: Date | null;
  firstApprovedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  notes: string | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  attachments: Array<{
    id: string;
    requestId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    uploadedByEmail: string | null;
    createdAt: Date;
  }>;
  audits: Array<{
    id: string;
    requestId: string;
    event: string;
    revision: number;
    note: string | null;
    changedFields: string | null;
    previousValues: string | null;
    nextValues: string | null;
    actorEmail: string | null;
    createdAt: Date;
  }>;
}): OtherApprovalRequestOption {
  return {
    id: request.id,
    title: request.title,
    countryCode: request.countryCode,
    channelName: request.channelName,
    feeType: request.feeType,
    description: request.description,
    tableData: request.tableData,
    status: otherApprovalStatus(request.status),
    workflowState: normalizeOtherApprovalWorkflowState({
      status: otherApprovalStatus(request.status),
      workflowState: request.workflowState
    }),
    duplicateOfRequestId: request.duplicateOfRequestId,
    submittedByEmail: request.submittedByEmail,
    firstApprovedByEmail: request.firstApprovedByEmail,
    approvedByEmail: request.approvedByEmail,
    rejectedByEmail: request.rejectedByEmail,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    firstApprovedAt: request.firstApprovedAt?.toISOString() ?? null,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    rejectedAt: request.rejectedAt?.toISOString() ?? null,
    notes: request.notes,
    createdByEmail: request.createdByEmail,
    updatedByEmail: request.updatedByEmail,
    revision: request.revision,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      requestId: attachment.requestId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      uploadedByEmail: attachment.uploadedByEmail,
      createdAt: attachment.createdAt.toISOString()
    })),
    audits: request.audits.map((audit) => ({
      id: audit.id,
      requestId: audit.requestId,
      event: audit.event,
      revision: audit.revision,
      note: audit.note,
      changedFields: parseAuditStringList(audit.changedFields),
      previousValues: parseAuditValues(audit.previousValues),
      nextValues: parseAuditValues(audit.nextValues),
      actorEmail: audit.actorEmail,
      createdAt: audit.createdAt.toISOString()
    }))
  };
}

function parseAuditStringList(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseAuditValues(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string"
      )
    );
  } catch {
    return null;
  }
}

function otherApprovalStatus(status: string): PromotionPlanStatus {
  return ["DRAFT", "SUBMITTED", "FIRST_APPROVED", "APPROVED", "REJECTED"].includes(
    status
  )
    ? (status as PromotionPlanStatus)
    : "DRAFT";
}

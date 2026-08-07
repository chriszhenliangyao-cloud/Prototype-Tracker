import { canSaveScenario, canViewAllCountries } from "./auth/roles";
import type { AppSession } from "./auth/types";
import {
  getPromotionPlanEntries,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "./data";
import { prisma } from "./prisma";
import {
  buildPromotionPlanWorkbookBuffer,
  promotionPlanMonthKey,
  type PromotionPlanMonth
} from "./promotionPlan";
import { createPromotionPlanArchive } from "./promotionPlanArchive";
import { sendPromotionPlanApprovalEmail } from "./promotionPlanApprovalEmail";
import {
  canApprovePromotionPlanWithCapabilities,
  canRejectPromotionPlanWithCapabilities,
  getPromotionPlanApproverCapabilities,
  resolvePromotionPlanApprovalTransition
} from "./promotionPlanApprovalWorkflow";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  getPromotionPlanEditState,
  isPromotionPlanDeadlineLocked
} from "./promotionPlanAccess";
import { buildPromotionPlanPromotionRows } from "./promotionPlanShared";
import type { PromotionPlanStatus } from "./types";
import {
  approvalSystemUrl,
  sendApprovalRequiredNotification
} from "./approvalNotifications";

export type PromotionPlanStatusAction = "submit" | "approve" | "reject";

export type PromotionPlanStatusActionResult = {
  status: "success" | "error";
  message: string;
  updated: number;
  skipped: number;
  errors: Array<{ message: string }>;
  archive: Awaited<ReturnType<typeof createPromotionPlanArchive>> | null;
  emailNotification: Awaited<ReturnType<typeof sendPromotionPlanApprovalEmail>> | null;
};

export async function applyPromotionPlanStatusAction({
  action,
  session,
  month,
  countryCodes,
  notes
}: {
  action: PromotionPlanStatusAction;
  session: AppSession;
  month: PromotionPlanMonth;
  countryCodes?: string[];
  notes?: string | null;
}): Promise<{ statusCode: number; result: PromotionPlanStatusActionResult }> {
  const data = await getReferenceData();
  const countryAccesses = await getUserCountryAccesses();
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );

  if (action === "submit" && !canSaveScenario(effectiveRole)) {
    return forbidden("You do not have Promotion Plan access.");
  }

  const approvalCapabilities = getPromotionPlanApproverCapabilities({
    role: effectiveRole,
    email: session.email,
    accessRows: countryAccesses
  });

  if (
    action === "approve" &&
    !canApprovePromotionPlanWithCapabilities(approvalCapabilities)
  ) {
    return forbidden("Only configured Promotion Plan approvers can approve months.");
  }

  if (
    action === "reject" &&
    !canRejectPromotionPlanWithCapabilities(approvalCapabilities)
  ) {
    return forbidden("Only configured Promotion Plan approvers can reject months.");
  }

  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    countryAccesses,
    data.countries
  );
  const canSeeAllCountries = canViewAllCountries(effectiveRole);
  const validCountryCodes = new Set(data.countries.map((country) => country.code));
  const requestedCountryCodes =
    countryCodes && countryCodes.length > 0
      ? countryCodes.map((code) => code.toUpperCase()).filter((code) => validCountryCodes.has(code))
      : canSeeAllCountries
        ? [...validCountryCodes].sort()
        : accessibleCountryCodes;
  const targetCountryCodes =
    canSeeAllCountries
      ? requestedCountryCodes
      : requestedCountryCodes.filter((code) => accessibleCountryCodes.includes(code));

  if (targetCountryCodes.length === 0) {
    return forbidden("No accessible country was selected.");
  }

  const currentStatuses = await getPromotionPlanMonthStatuses({
    planYear: month.year,
    planMonth: month.month,
    countryCodes: targetCountryCodes
  });
  const currentStatusByCountry = new Map(
    currentStatuses.map((status) => [status.countryCode, status.status])
  );
  const now = new Date();
  const errors: Array<{ message: string }> = [];
  let updated = 0;
  let skipped = 0;
  const updatedCountryCodes: string[] = [];
  const firstApprovedCountryCodes: string[] = [];
  const finalApprovedCountryCodes: string[] = [];
  let firstApprovedCount = 0;

  for (const countryCode of targetCountryCodes) {
    const currentStatus = currentStatusByCountry.get(countryCode) ?? "DRAFT";

    if (action === "submit") {
      const editState = getPromotionPlanEditState({
        role: effectiveRole,
        hasCountryAccess: true,
        planYear: month.year,
        planMonth: month.month,
        status: currentStatus,
        now
      });
      if (!editState.editable) {
        skipped += 1;
        errors.push({ message: `${countryCode} skipped: ${editState.reason}.` });
        continue;
      }
    }

    const statusUpdate = resolveStatusUpdate({
      action,
      currentStatus,
      approvalCapabilities,
      email: session.email,
      notes,
      now
    });
    if (!statusUpdate.allowed) {
      skipped += 1;
      errors.push({ message: `${countryCode} skipped: ${statusUpdate.message}` });
      continue;
    }

    await prisma.promotionPlanMonthStatus.upsert({
      where: {
        planYear_planMonth_countryCode: {
          planYear: month.year,
          planMonth: month.month,
          countryCode
        }
      },
      update: statusUpdate.data,
      create: {
        planYear: month.year,
        planMonth: month.month,
        countryCode,
        ...statusUpdate.data
      }
    });
    updated += 1;
    updatedCountryCodes.push(countryCode);
    if (statusUpdate.stage === "first") {
      firstApprovedCount += 1;
      firstApprovedCountryCodes.push(countryCode);
    } else if (statusUpdate.stage === "final") {
      finalApprovedCountryCodes.push(countryCode);
    }
  }

  if (updated === 0) {
    return {
      statusCode: 400,
      result: {
        status: "error",
        message: "No Promotion Plan status was updated.",
        updated,
        skipped,
        errors,
        archive: null,
        emailNotification: null
      }
    };
  }

  const archiveCountryCodes =
    action === "approve" ? finalApprovedCountryCodes : updatedCountryCodes;
  const isFirstApprovalOnly =
    action === "approve" && archiveCountryCodes.length === 0 && firstApprovedCount > 0;
  const resultVerb = isFirstApprovalOnly ? "First-approved" : archiveVerbForAction(action);

  await notifyPromotionPlanNextApprovers({
    action,
    firstApprovedCountryCodes,
    month,
    submittedCountryCodes: updatedCountryCodes,
    userEmail: session.email
  });

  if (archiveCountryCodes.length === 0) {
    return {
      statusCode: 200,
      result: {
        status: "success",
        message: `${resultVerb} ${updated} country plan(s).`,
        updated,
        skipped,
        errors,
        archive: null,
        emailNotification: null
      }
    };
  }

  const archiveData = filterReferenceDataByCountryCodes(data, archiveCountryCodes);
  const entries = await getPromotionPlanEntries(
    month.year,
    month.month,
    archiveCountryCodes
  );
  const monthKey = promotionPlanMonthKey(month);
  const lockedCountryCodes = getLockedArchiveCountryCodes({
    action,
    month,
    countryCodes: archiveCountryCodes,
    statusByCountry: currentStatusByCountry,
    now
  });
  const promotionRows = buildPromotionPlanPromotionRows({
    data: archiveData,
    entries,
    lockedCountryCodes
  });
  const workbook = buildPromotionPlanWorkbookBuffer({
    data: archiveData,
    entries,
    months: [month],
    lockedCountryCodesByMonth: {
      [monthKey]: lockedCountryCodes
    }
  });
  const archive = await createPromotionPlanArchive({
    source: archiveSourceForAction(action),
    sourceReference: archiveSourceReferenceForAction({
      action,
      monthKey,
      countryCodes: archiveCountryCodes,
      now
    }),
    title: archiveTitleForAction({
      action,
      monthKey,
      countryCodes: archiveCountryCodes,
      now
    }),
    message: archiveMessageForAction({
      action,
      updated,
      countryCodes: archiveCountryCodes,
      now
    }),
    workbook,
    month,
    createdByEmail: session.email,
    createdAt: now
  });
  const emailNotification =
    action === "approve"
      ? await sendPromotionPlanApprovalEmail({
          archive,
          workbook,
          month,
          countryCodes: archiveCountryCodes,
          approvedByEmail: session.email,
          statuses: await getPromotionPlanMonthStatuses({
            planYear: month.year,
            planMonth: month.month,
            countryCodes: archiveCountryCodes
          }),
          entries,
          promotionRows
        })
      : null;

  return {
    statusCode: 200,
    result: {
      status: "success",
      message: statusActionResultMessage({
        resultVerb,
        updated,
        emailNotification
      }),
      updated,
      skipped,
      errors,
      archive,
      emailNotification
    }
  };
}

async function notifyPromotionPlanNextApprovers({
  action,
  firstApprovedCountryCodes,
  month,
  submittedCountryCodes,
  userEmail
}: {
  action: PromotionPlanStatusAction;
  firstApprovedCountryCodes: string[];
  month: PromotionPlanMonth;
  submittedCountryCodes: string[];
  userEmail: string | null;
}) {
  const monthKey = promotionPlanMonthKey(month);
  if (action === "submit" && submittedCountryCodes.length > 0) {
    await sendApprovalRequiredNotification({
      requestType: "PROMOTION_PLAN",
      planYear: month.year,
      planMonth: month.month,
      countryCodes: submittedCountryCodes,
      stage: "FIRST_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl(
        `/platform/collaboration/monthly-approvals?year=${month.year}&month=${month.month}`
      ),
      subject: `Approval required · Monthly Promotion Plan · ${monthKey} · ${submittedCountryCodes.join(", ")}`,
      summaryLines: [
        `Plan month: ${monthKey}`,
        `Country: ${submittedCountryCodes.join(", ")}`,
        `Submitted by: ${userEmail ?? "-"}`
      ]
    });
  }

  if (action === "approve" && firstApprovedCountryCodes.length > 0) {
    await sendApprovalRequiredNotification({
      requestType: "PROMOTION_PLAN",
      planYear: month.year,
      planMonth: month.month,
      countryCodes: firstApprovedCountryCodes,
      stage: "FINAL_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl(
        `/platform/collaboration/monthly-approvals?year=${month.year}&month=${month.month}`
      ),
      subject: `Final approval required · Monthly Promotion Plan · ${monthKey} · ${firstApprovedCountryCodes.join(", ")}`,
      summaryLines: [
        `Plan month: ${monthKey}`,
        `Country: ${firstApprovedCountryCodes.join(", ")}`,
        `First approved by: ${userEmail ?? "-"}`
      ]
    });
  }
}

function getLockedArchiveCountryCodes({
  action,
  month,
  countryCodes,
  statusByCountry,
  now
}: {
  action: PromotionPlanStatusAction;
  month: PromotionPlanMonth;
  countryCodes: string[];
  statusByCountry: Map<string, PromotionPlanStatus>;
  now: Date;
}) {
  const deadlineLocked = isPromotionPlanDeadlineLocked({
    planYear: month.year,
    planMonth: month.month,
    now
  });

  return countryCodes.filter(
    (countryCode) =>
      deadlineLocked ||
      action === "approve" ||
      statusByCountry.get(countryCode) === "FIRST_APPROVED" ||
      statusByCountry.get(countryCode) === "APPROVED"
  );
}

type StatusUpdateResult =
  | {
      allowed: true;
      data: Record<string, string | Date | null>;
      stage: "submit" | "first" | "final" | "reject";
    }
  | { allowed: false; message: string };

function resolveStatusUpdate({
  action,
  currentStatus,
  approvalCapabilities,
  email,
  notes,
  now
}: {
  action: PromotionPlanStatusAction;
  currentStatus: PromotionPlanStatus;
  approvalCapabilities: ReturnType<typeof getPromotionPlanApproverCapabilities>;
  email: string | null;
  notes: string | null | undefined;
  now: Date;
}): StatusUpdateResult {
  if (action === "approve") {
    const transition = resolvePromotionPlanApprovalTransition({
      currentStatus,
      capabilities: approvalCapabilities
    });
    if (!transition.allowed) {
      return transition;
    }

    return {
      allowed: true,
      stage: transition.stage,
      data:
        transition.stage === "first"
          ? {
              status: "FIRST_APPROVED",
              firstApprovedByEmail: email,
              firstApprovedAt: now,
              approvedByEmail: null,
              approvedAt: null,
              rejectedByEmail: null,
              rejectedAt: null,
              notes: notes ?? null
            }
          : {
              status: "APPROVED",
              approvedByEmail: email,
              approvedAt: now,
              rejectedByEmail: null,
              rejectedAt: null,
              notes: notes ?? null
            }
    };
  }

  if (action === "reject") {
    if (currentStatus !== "SUBMITTED" && currentStatus !== "FIRST_APPROVED") {
      return {
        allowed: false,
        message: "Plan must be submitted before it can be returned for revision."
      };
    }
    if (currentStatus === "SUBMITTED" && !approvalCapabilities.canFirstApprove) {
      return {
        allowed: false,
        message: "First approval is required before this plan can be returned for revision."
      };
    }
    if (currentStatus === "FIRST_APPROVED" && !approvalCapabilities.canFinalApprove) {
      return {
        allowed: false,
        message: "Final approval is required before this plan can be returned for revision."
      };
    }

    const revisionNote = notes?.trim();
    if (!revisionNote) {
      return {
        allowed: false,
        message: "A return reason is required before sending a plan back for revision."
      };
    }

    return {
      allowed: true,
      stage: "reject",
      data: {
        status: "REJECTED",
        rejectedByEmail: email,
        rejectedAt: now,
        approvedByEmail: null,
        approvedAt: null,
        notes: revisionNote
      }
    };
  }

  return {
    allowed: true,
    stage: "submit",
    data: {
      status: "SUBMITTED",
      submittedByEmail: email,
      submittedAt: now,
      firstApprovedByEmail: null,
      firstApprovedAt: null,
      approvedByEmail: null,
      approvedAt: null,
      rejectedByEmail: null,
      rejectedAt: null,
      notes: notes ?? null
    }
  };
}

function archiveSourceForAction(action: PromotionPlanStatusAction) {
  if (action === "approve") {
    return "PROMOTION_PLAN_APPROVE";
  }

  if (action === "reject") {
    return "PROMOTION_PLAN_REJECT";
  }

  return "PROMOTION_PLAN_SUBMIT";
}

function archiveSourceReferenceForAction({
  action,
  monthKey,
  countryCodes,
  now
}: {
  action: PromotionPlanStatusAction;
  monthKey: string;
  countryCodes: string[];
  now: Date;
}) {
  return [
    monthKey,
    archiveFileStatusForAction(action),
    countryCodes.join("-"),
    formatMadridTimestampForFile(now),
    "madrid"
  ].join("-");
}

function archiveTitleForAction({
  action,
  monthKey,
  countryCodes,
  now
}: {
  action: PromotionPlanStatusAction;
  monthKey: string;
  countryCodes: string[];
  now: Date;
}) {
  if (action === "approve") {
    return `Promotion Plan approved · ${monthKey} · ${countryCodes.join(", ")} · ${formatMadridTimestampForDisplay(now)}`;
  }

  if (action === "reject") {
    return `Promotion Plan returned for revision · ${monthKey} · ${countryCodes.join(", ")} · ${formatMadridTimestampForDisplay(now)}`;
  }

  return `Promotion Plan submitted · ${monthKey} · ${countryCodes.join(", ")} · ${formatMadridTimestampForDisplay(now)}`;
}

function archiveMessageForAction({
  action,
  updated,
  countryCodes,
  now
}: {
  action: PromotionPlanStatusAction;
  updated: number;
  countryCodes: string[];
  now: Date;
}) {
  const verb = archiveVerbForAction(action);
  return `${verb} ${updated} country plan(s): ${countryCodes.join(", ")}. ${verb} time: ${formatMadridTimestampForDisplay(now)}.`;
}

function archiveVerbForAction(action: PromotionPlanStatusAction) {
  if (action === "approve") {
    return "Approved";
  }

  if (action === "reject") {
    return "Returned for revision";
  }

  return "Submitted";
}

function archiveFileStatusForAction(action: PromotionPlanStatusAction) {
  if (action === "approve") {
    return "approved";
  }

  if (action === "reject") {
    return "rejected";
  }

  return "submitted";
}

function statusActionResultMessage({
  resultVerb,
  updated,
  emailNotification
}: {
  resultVerb: string;
  updated: number;
  emailNotification: PromotionPlanStatusActionResult["emailNotification"];
}) {
  const emailSuffix =
    emailNotification && emailNotification.status !== "SENT"
      ? ` Approval email ${emailNotification.status === "NOT_CONFIGURED" ? "not configured" : "failed"}.`
      : "";

  return `${resultVerb} ${updated} country plan(s).${emailSuffix}`;
}

function formatMadridTimestampForFile(date: Date) {
  const parts = madridDateTimeParts(date);
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function formatMadridTimestampForDisplay(date: Date) {
  const parts = madridDateTimeParts(date);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute} Europe/Madrid`;
}

function madridDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value.padStart(2, "0") ?? "00";

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute")
  };
}

function forbidden(message: string) {
  return {
    statusCode: 403,
    result: {
      status: "error" as const,
      message,
      updated: 0,
      skipped: 0,
      errors: [],
      archive: null,
      emailNotification: null
    }
  };
}

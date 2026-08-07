import { canSaveScenario, canViewAllCountries } from "./auth/roles";
import type { AppSession } from "./auth/types";
import {
  getBusinessPlanChannelProfiles,
  getBusinessPlanEntries,
  getBusinessPlanYearStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "./data";
import { prisma } from "./prisma";
import { buildBusinessPlanSavedWorkbookBuffer } from "./businessPlanWorkbook";
import { createPromotionPlanArchive } from "./promotionPlanArchive";
import { sendBusinessPlanApprovalEmail } from "./businessPlanApprovalEmail";
import {
  canApprovePromotionPlanWithCapabilities,
  canRejectPromotionPlanWithCapabilities,
  getPromotionPlanApproverCapabilities,
  resolvePromotionPlanApprovalTransition
} from "./promotionPlanApprovalWorkflow";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "./promotionPlanAccess";
import type { PromotionPlanStatus } from "./types";
import {
  approvalSystemUrl,
  sendApprovalRequiredNotification
} from "./approvalNotifications";

export type BusinessPlanStatusAction = "submit" | "approve" | "reject";

export type BusinessPlanStatusActionResult = {
  status: "success" | "error";
  message: string;
  updated: number;
  skipped: number;
  errors: Array<{ message: string }>;
  archive: Awaited<ReturnType<typeof createPromotionPlanArchive>> | null;
  emailNotification: Awaited<ReturnType<typeof sendBusinessPlanApprovalEmail>> | null;
};

export async function applyBusinessPlanStatusAction({
  action,
  session,
  planYear,
  countryCodes,
  notes
}: {
  action: BusinessPlanStatusAction;
  session: AppSession;
  planYear: number;
  countryCodes?: string[];
  notes?: string | null;
}): Promise<{ statusCode: number; result: BusinessPlanStatusActionResult }> {
  const data = await getReferenceData();
  const countryAccesses = await getUserCountryAccesses();
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );

  if (action === "submit" && !canSaveScenario(effectiveRole)) {
    return forbidden("You do not have BP access.");
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
    return forbidden("Only configured BP approvers can approve plans.");
  }
  if (
    action === "reject" &&
    !canRejectPromotionPlanWithCapabilities(approvalCapabilities)
  ) {
    return forbidden("Only configured BP approvers can reject plans.");
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

  const [currentStatuses, entries] = await Promise.all([
    getBusinessPlanYearStatuses({
      planYear,
      countryCodes: targetCountryCodes
    }),
    action === "submit"
      ? getBusinessPlanEntries(planYear, targetCountryCodes)
      : Promise.resolve([])
  ]);
  const currentStatusByCountry = new Map(
    currentStatuses.map((status) => [status.countryCode, status.status])
  );
  const entryCountByCountry = new Map<string, number>();
  for (const entry of entries) {
    entryCountByCountry.set(
      entry.countryCode,
      (entryCountByCountry.get(entry.countryCode) ?? 0) + 1
    );
  }

  const errors: Array<{ message: string }> = [];
  let updated = 0;
  let skipped = 0;
  const submittedCountryCodes: string[] = [];
  const firstApprovedCountryCodes: string[] = [];
  const finalApprovedCountryCodes: string[] = [];
  const now = new Date();

  for (const countryCode of targetCountryCodes) {
    const currentStatus = currentStatusByCountry.get(countryCode) ?? "DRAFT";

    if (action === "submit" && (entryCountByCountry.get(countryCode) ?? 0) === 0) {
      skipped += 1;
      errors.push({ message: `${countryCode} skipped: no saved BP rows.` });
      continue;
    }

    const statusUpdate = resolveStatusUpdate({
      action,
      currentStatus,
      directApproveOnSubmit: effectiveRole === "OWNER",
      email: session.email,
      approvalCapabilities,
      notes,
      now
    });
    if (!statusUpdate.allowed) {
      skipped += 1;
      errors.push({ message: `${countryCode} skipped: ${statusUpdate.message}` });
      continue;
    }

    await prisma.businessPlanYearStatus.upsert({
      where: {
        planYear_countryCode: {
          planYear,
          countryCode
        }
      },
      update: statusUpdate.data,
      create: {
        planYear,
        countryCode,
        ...statusUpdate.data
      }
    });
    updated += 1;
    if (statusUpdate.stage === "submit") {
      submittedCountryCodes.push(countryCode);
    } else if (statusUpdate.stage === "first") {
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
        message: "No BP status was updated.",
        updated,
        skipped,
        errors,
        archive: null,
        emailNotification: null
      }
    };
  }

  await notifyBusinessPlanNextApprovers({
    action,
    firstApprovedCountryCodes,
    planYear,
    submittedCountryCodes,
    userEmail: session.email
  });

  if (finalApprovedCountryCodes.length === 0) {
    return {
      statusCode: 200,
      result: {
        status: "success",
        message: `Updated ${updated} BP country plan(s).`,
        updated,
        skipped,
        errors,
        archive: null,
        emailNotification: null
      }
    };
  }

  const archiveData = filterReferenceDataByCountryCodes(
    data,
    finalApprovedCountryCodes
  );
  const [finalApprovedEntries, finalApprovedProfiles] = await Promise.all([
    getBusinessPlanEntries(planYear, finalApprovedCountryCodes),
    getBusinessPlanChannelProfiles(planYear, finalApprovedCountryCodes)
  ]);
  const workbook = buildBusinessPlanSavedWorkbookBuffer({
    channelProfiles: finalApprovedProfiles,
    data: archiveData,
    entries: finalApprovedEntries,
    year: planYear
  });
  const archive = await createPromotionPlanArchive({
    source: "BUSINESS_PLAN_APPROVE",
    sourceReference: archiveSourceReferenceForFinalApproval({
      countryCodes: finalApprovedCountryCodes,
      now,
      planYear
    }),
    title: `BP approved · ${planYear} · ${finalApprovedCountryCodes.join(", ")} · ${formatMadridTimestampForDisplay(now)}`,
    message: `Approved ${finalApprovedCountryCodes.length} BP country plan(s): ${finalApprovedCountryCodes.join(", ")}. Approval time: ${formatMadridTimestampForDisplay(now)}.`,
    workbook,
    planYear,
    createdByEmail: session.email,
    createdAt: now
  });
  const emailNotification = await sendBusinessPlanApprovalEmail({
    archive,
    workbook,
    planYear,
    countryCodes: finalApprovedCountryCodes,
    approvedByEmail: session.email,
    statuses: await getBusinessPlanYearStatuses({
      planYear,
      countryCodes: finalApprovedCountryCodes
    }),
    entries: finalApprovedEntries
  });

  return {
    statusCode: 200,
    result: {
      status: "success",
      message: statusActionResultMessage({
        emailNotification,
        updated
      }),
      updated,
      skipped,
      errors,
      archive,
      emailNotification
    }
  };
}

async function notifyBusinessPlanNextApprovers({
  action,
  firstApprovedCountryCodes,
  planYear,
  submittedCountryCodes,
  userEmail
}: {
  action: BusinessPlanStatusAction;
  firstApprovedCountryCodes: string[];
  planYear: number;
  submittedCountryCodes: string[];
  userEmail: string | null;
}) {
  if (action === "submit" && submittedCountryCodes.length > 0) {
    await sendApprovalRequiredNotification({
      requestType: "BUSINESS_PLAN",
      planYear,
      countryCodes: submittedCountryCodes,
      stage: "FIRST_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl(`/platform/business/bp?year=${planYear}`),
      subject: `Approval required · BP · ${planYear} · ${submittedCountryCodes.join(", ")}`,
      summaryLines: [
        `BP year: ${planYear}`,
        `Country: ${submittedCountryCodes.join(", ")}`,
        `Submitted by: ${userEmail ?? "-"}`
      ]
    });
  }

  if (action === "approve" && firstApprovedCountryCodes.length > 0) {
    await sendApprovalRequiredNotification({
      requestType: "BUSINESS_PLAN",
      planYear,
      countryCodes: firstApprovedCountryCodes,
      stage: "FINAL_APPROVAL",
      createdByEmail: userEmail,
      actionUrl: approvalSystemUrl(`/platform/business/bp?year=${planYear}`),
      subject: `Final approval required · BP · ${planYear} · ${firstApprovedCountryCodes.join(", ")}`,
      summaryLines: [
        `BP year: ${planYear}`,
        `Country: ${firstApprovedCountryCodes.join(", ")}`,
        `First approved by: ${userEmail ?? "-"}`
      ]
    });
  }
}

function resolveStatusUpdate({
  action,
  approvalCapabilities,
  currentStatus,
  directApproveOnSubmit,
  email,
  notes,
  now
}: {
  action: BusinessPlanStatusAction;
  approvalCapabilities: ReturnType<typeof getPromotionPlanApproverCapabilities>;
  currentStatus: PromotionPlanStatus;
  directApproveOnSubmit: boolean;
  email: string | null;
  notes?: string | null;
  now: Date;
}):
  | {
      allowed: true;
      stage: "submit" | "first" | "final" | "reject";
      data: {
        status: PromotionPlanStatus;
        submittedByEmail?: string | null;
        firstApprovedByEmail?: string | null;
        approvedByEmail?: string | null;
        rejectedByEmail?: string | null;
        submittedAt?: Date | null;
        firstApprovedAt?: Date | null;
        approvedAt?: Date | null;
        rejectedAt?: Date | null;
        notes?: string | null;
      };
    }
  | { allowed: false; message: string } {
  if (action === "submit") {
    if (currentStatus !== "DRAFT" && currentStatus !== "REJECTED") {
      return {
        allowed: false,
        message: "Only draft or rejected BP plans can be submitted."
      };
    }

    if (directApproveOnSubmit) {
      return {
        allowed: true,
        stage: "final",
        data: {
          status: "APPROVED",
          submittedByEmail: email,
          firstApprovedByEmail: email,
          approvedByEmail: email,
          rejectedByEmail: null,
          submittedAt: now,
          firstApprovedAt: now,
          approvedAt: now,
          rejectedAt: null,
          notes: notes ?? null
        }
      };
    }

    return {
      allowed: true,
      stage: "submit",
      data: {
        status: "SUBMITTED",
        submittedByEmail: email,
        firstApprovedByEmail: null,
        approvedByEmail: null,
        rejectedByEmail: null,
        submittedAt: now,
        firstApprovedAt: null,
        approvedAt: null,
        rejectedAt: null,
        notes: notes ?? null
      }
    };
  }

  if (action === "reject") {
    if (currentStatus !== "SUBMITTED" && currentStatus !== "FIRST_APPROVED") {
      return {
        allowed: false,
        message: "Only submitted BP plans can be rejected."
      };
    }
    return {
      allowed: true,
      stage: "reject",
      data: {
        status: "REJECTED",
        rejectedByEmail: email,
        rejectedAt: now,
        notes: notes ?? null
      }
    };
  }

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
            status: transition.nextStatus,
            firstApprovedByEmail: email,
            firstApprovedAt: now,
            approvedByEmail: null,
            approvedAt: null,
            rejectedByEmail: null,
            rejectedAt: null,
            notes: notes ?? null
          }
        : {
            status: transition.nextStatus,
            approvedByEmail: email,
            approvedAt: now,
            rejectedByEmail: null,
            rejectedAt: null,
            notes: notes ?? null
          }
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
      errors: [{ message }],
      archive: null,
      emailNotification: null
    }
  };
}

function archiveSourceReferenceForFinalApproval({
  countryCodes,
  now,
  planYear
}: {
  countryCodes: string[];
  now: Date;
  planYear: number;
}) {
  return [
    String(planYear),
    "approved",
    countryCodes.join("-"),
    formatMadridTimestampForFile(now),
    "madrid"
  ].join("-");
}

function statusActionResultMessage({
  emailNotification,
  updated
}: {
  emailNotification: BusinessPlanStatusActionResult["emailNotification"];
  updated: number;
}) {
  const emailSuffix =
    emailNotification && emailNotification.status !== "SENT"
      ? ` Approval email ${emailNotification.status === "NOT_CONFIGURED" ? "not configured" : "failed"}.`
      : "";

  return `Updated ${updated} BP country plan(s).${emailSuffix}`;
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

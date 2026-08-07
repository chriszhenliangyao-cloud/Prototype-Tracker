import { canManagePromotionPlanApprovalHistory } from "./auth/roles";
import type { AppSession } from "./auth/types";
import { prisma } from "./prisma";
import { promotionPlanMonthKey, type PromotionPlanMonth } from "./promotionPlan";
import type { PromotionPlanStatus } from "./types";

export type PromotionPlanHistoryAdminAction =
  | "set-status"
  | "delete-status";

export type PromotionPlanHistoryAdminActionResult = {
  status: "success" | "error";
  message: string;
  updated: number;
  deleted: number;
  errors: Array<{ message: string }>;
};

type ExistingMonthStatus = {
  countryCode: string;
  status: PromotionPlanStatus;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: Date | null;
  firstApprovedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  notes: string | null;
};

type PromotionPlanMonthStatusOwnerData = {
  status: PromotionPlanStatus;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: Date | null;
  firstApprovedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  notes: string | null;
};

type ExistingApprovalNotification = {
  id: string;
  archiveId: string | null;
  countryCodes: string;
};

const CHANGE_CONFIRMATION = "CHANGE APPROVAL";
const DELETE_CONFIRMATION = "DELETE APPROVAL";
const VALID_TARGET_STATUSES = new Set<PromotionPlanStatus>([
  "DRAFT",
  "SUBMITTED",
  "FIRST_APPROVED",
  "APPROVED",
  "REJECTED"
]);

export async function applyPromotionPlanHistoryAdminAction({
  action,
  confirmation,
  countryCodes,
  month,
  notificationId,
  notes,
  session,
  targetStatus
}: {
  action: PromotionPlanHistoryAdminAction;
  confirmation: string | null | undefined;
  countryCodes: string[];
  month: PromotionPlanMonth;
  notificationId?: string | null;
  notes?: string | null;
  session: AppSession;
  targetStatus?: PromotionPlanStatus | null;
}): Promise<{
  statusCode: number;
  result: PromotionPlanHistoryAdminActionResult;
}> {
  if (!canManagePromotionPlanApprovalHistory(session.role)) {
    return response(403, {
      status: "error",
      message: "Only the owner can manage historical approval status.",
      updated: 0,
      deleted: 0,
      errors: []
    });
  }

  const normalizedCountryCodes = [
    ...new Set(
      countryCodes
        .map((countryCode) => countryCode.trim().toUpperCase())
        .filter(Boolean)
    )
  ];
  if (normalizedCountryCodes.length === 0) {
    return response(400, {
      status: "error",
      message: "Choose at least one country.",
      updated: 0,
      deleted: 0,
      errors: []
    });
  }

  const expectedConfirmation =
    action === "delete-status" ? DELETE_CONFIRMATION : CHANGE_CONFIRMATION;
  if ((confirmation ?? "").trim() !== expectedConfirmation) {
    return response(400, {
      status: "error",
      message: `Type ${expectedConfirmation} to confirm this owner-only operation.`,
      updated: 0,
      deleted: 0,
      errors: []
    });
  }

  if (action === "set-status") {
    if (!targetStatus || !VALID_TARGET_STATUSES.has(targetStatus)) {
      return response(400, {
        status: "error",
        message: "Choose a valid target approval status.",
        updated: 0,
        deleted: 0,
        errors: []
      });
    }
  }

  const existingRows = await prisma.promotionPlanMonthStatus.findMany({
    where: {
      planYear: month.year,
      planMonth: month.month,
      countryCode: { in: normalizedCountryCodes }
    }
  });
  const existingByCountry = new Map(
    existingRows.map((row) => [row.countryCode, row as ExistingMonthStatus])
  );
  const auditUser = await prisma.user.upsert({
    where: { email: session.email ?? "unknown-owner@local" },
    update: {
      name: session.name,
      role: session.role
    },
    create: {
      name: session.name,
      email: session.email ?? "unknown-owner@local",
      role: session.role
    }
  });

  if (action === "delete-status") {
    const matchingNotifications = (
      await prisma.promotionPlanEmailNotification.findMany({
        where: {
          planYear: month.year,
          planMonth: month.month
        }
      })
    ).filter((notification) =>
      matchesApprovalNotification({
        countryCodes: normalizedCountryCodes,
        notification,
        notificationId
      })
    );
    const notificationIds = matchingNotifications.map((notification) => notification.id);
    const archiveIds = [
      ...new Set(
        matchingNotifications
          .map((notification) => notification.archiveId)
          .filter((archiveId): archiveId is string => Boolean(archiveId))
      )
    ];

    const deleteSummary = await prisma.$transaction(async (tx) => {
      const deletedStatuses = await tx.promotionPlanMonthStatus.deleteMany({
        where: {
          planYear: month.year,
          planMonth: month.month,
          countryCode: { in: normalizedCountryCodes }
        }
      });
      const deletedEntries = await tx.promotionPlanEntry.deleteMany({
        where: {
          planYear: month.year,
          planMonth: month.month,
          countryCode: { in: normalizedCountryCodes }
        }
      });
      const deletedNotifications =
        notificationIds.length > 0
          ? await tx.promotionPlanEmailNotification.deleteMany({
              where: {
                id: { in: notificationIds }
              }
            })
          : { count: 0 };
      let deletedArchives = 0;
      for (const archiveId of archiveIds) {
        const remainingReferences = await tx.promotionPlanEmailNotification.count({
          where: { archiveId }
        });
        if (remainingReferences === 0) {
          const archiveDeleteResult = await tx.promotionPlanArchive.deleteMany({
            where: {
              id: { in: [archiveId] }
            }
          });
          deletedArchives += archiveDeleteResult.count;
        }
      }

      return {
        deletedStatuses: deletedStatuses.count,
        deletedEntries: deletedEntries.count,
        deletedNotifications: deletedNotifications.count,
        deletedArchives
      };
    });

    for (const countryCode of normalizedCountryCodes) {
      const existing = existingByCountry.get(countryCode);
      await writeAudit({
        userId: auditUser.id,
        month,
        countryCode,
        oldValue: existing?.status ?? null,
        newValue: "DELETED",
        reason:
          notes ||
          "Owner deleted historical approval record. Promotion plan rows, delivery records, and archived workbook records were cleared for re-import."
      });
    }

    return response(200, {
      status: "success",
      message: `${deleteSummary.deletedStatuses} approval status record(s), ${deleteSummary.deletedEntries} promotion row(s), ${deleteSummary.deletedNotifications} delivery record(s), and ${deleteSummary.deletedArchives} archived workbook record(s) deleted.`,
      updated: 0,
      deleted: deleteSummary.deletedStatuses,
      errors: []
    });
  }

  const now = new Date();
  let updated = 0;
  for (const countryCode of normalizedCountryCodes) {
    const existing = existingByCountry.get(countryCode);
    const data = statusDataForOwnerOverride({
      existing,
      email: session.email,
      notes,
      now,
      targetStatus: targetStatus as PromotionPlanStatus
    });
    await prisma.promotionPlanMonthStatus.upsert({
      where: {
        planYear_planMonth_countryCode: {
          planYear: month.year,
          planMonth: month.month,
          countryCode
        }
      },
      update: data,
      create: {
        planYear: month.year,
        planMonth: month.month,
        countryCode,
        ...data
      }
    });
    await writeAudit({
      userId: auditUser.id,
      month,
      countryCode,
      oldValue: existing?.status ?? null,
      newValue: targetStatus as PromotionPlanStatus,
      reason:
        notes ||
        "Owner changed historical approval status. No approval email was sent."
    });
    updated += 1;
  }

  return response(200, {
    status: "success",
    message: `${updated} approval status record(s) changed to ${targetStatus}. No approval email was sent.`,
    updated,
    deleted: 0,
    errors: []
  });
}

function statusDataForOwnerOverride({
  existing,
  email,
  notes,
  now,
  targetStatus
}: {
  existing: ExistingMonthStatus | undefined;
  email: string | null;
  notes: string | null | undefined;
  now: Date;
  targetStatus: PromotionPlanStatus;
}): PromotionPlanMonthStatusOwnerData {
  const submittedByEmail = existing?.submittedByEmail ?? email;
  const submittedAt = existing?.submittedAt ?? now;

  if (targetStatus === "DRAFT") {
    return {
      status: "DRAFT",
      submittedByEmail: null,
      firstApprovedByEmail: null,
      approvedByEmail: null,
      rejectedByEmail: null,
      submittedAt: null,
      firstApprovedAt: null,
      approvedAt: null,
      rejectedAt: null,
      notes: notes ?? null
    };
  }

  if (targetStatus === "SUBMITTED") {
    return {
      status: "SUBMITTED",
      submittedByEmail,
      firstApprovedByEmail: null,
      approvedByEmail: null,
      rejectedByEmail: null,
      submittedAt,
      firstApprovedAt: null,
      approvedAt: null,
      rejectedAt: null,
      notes: notes ?? null
    };
  }

  if (targetStatus === "FIRST_APPROVED") {
    return {
      status: "FIRST_APPROVED",
      submittedByEmail,
      firstApprovedByEmail: email,
      approvedByEmail: null,
      rejectedByEmail: null,
      submittedAt,
      firstApprovedAt: now,
      approvedAt: null,
      rejectedAt: null,
      notes: notes ?? null
    };
  }

  if (targetStatus === "APPROVED") {
    return {
      status: "APPROVED",
      submittedByEmail,
      firstApprovedByEmail: existing?.firstApprovedByEmail ?? email,
      approvedByEmail: email,
      rejectedByEmail: null,
      submittedAt,
      firstApprovedAt: existing?.firstApprovedAt ?? now,
      approvedAt: now,
      rejectedAt: null,
      notes: notes ?? null
    };
  }

  return {
    status: "REJECTED",
    submittedByEmail,
    firstApprovedByEmail: null,
    approvedByEmail: null,
    rejectedByEmail: email,
    submittedAt,
    firstApprovedAt: null,
    approvedAt: null,
    rejectedAt: now,
    notes: notes ?? null
  };
}

function matchesApprovalNotification({
  countryCodes,
  notification,
  notificationId
}: {
  countryCodes: string[];
  notification: ExistingApprovalNotification;
  notificationId: string | null | undefined;
}) {
  if (notificationId && notification.id !== notificationId) {
    return false;
  }

  return sameCountryCodeSet(
    countryCodes,
    parseNotificationCountryCodes(notification.countryCodes)
  );
}

function parseNotificationCountryCodes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .map((countryCode) => countryCode.trim().toUpperCase())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function sameCountryCodeSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((countryCode) => rightSet.has(countryCode));
}

async function writeAudit({
  userId,
  month,
  countryCode,
  oldValue,
  newValue,
  reason
}: {
  userId: string;
  month: PromotionPlanMonth;
  countryCode: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      entityType: "promotion_plan_month_status",
      entityId: `${promotionPlanMonthKey(month)}-${countryCode}`,
      fieldName: "status",
      oldValue,
      newValue,
      reason
    }
  });
}

function response(
  statusCode: number,
  result: PromotionPlanHistoryAdminActionResult
) {
  return { statusCode, result };
}

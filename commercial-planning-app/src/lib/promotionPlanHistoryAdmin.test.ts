import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppSession } from "./auth/types";

const prismaMocks = vi.hoisted(() => ({
  findMonthStatuses: vi.fn(),
  upsertStatus: vi.fn(),
  deleteStatuses: vi.fn(),
  deleteEntries: vi.fn(),
  findNotifications: vi.fn(),
  deleteNotifications: vi.fn(),
  countNotifications: vi.fn(),
  deleteArchives: vi.fn(),
  upsertUser: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("./prisma", () => ({
  prisma: {
    promotionPlanMonthStatus: {
      findMany: prismaMocks.findMonthStatuses,
      upsert: prismaMocks.upsertStatus,
      deleteMany: prismaMocks.deleteStatuses
    },
    promotionPlanEntry: {
      deleteMany: prismaMocks.deleteEntries
    },
    promotionPlanEmailNotification: {
      findMany: prismaMocks.findNotifications,
      deleteMany: prismaMocks.deleteNotifications,
      count: prismaMocks.countNotifications
    },
    promotionPlanArchive: {
      deleteMany: prismaMocks.deleteArchives
    },
    user: {
      upsert: prismaMocks.upsertUser
    },
    auditLog: {
      create: prismaMocks.createAudit
    },
    $transaction: prismaMocks.transaction
  }
}));

const { applyPromotionPlanHistoryAdminAction } = await import(
  "./promotionPlanHistoryAdmin"
);

describe("promotion plan history admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.findMonthStatuses.mockResolvedValue([
      {
        countryCode: "ES",
        status: "APPROVED",
        submittedByEmail: "submitter@example.test",
        submittedAt: new Date("2026-06-01T00:00:00.000Z"),
        firstApprovedByEmail: "first@example.test",
        firstApprovedAt: new Date("2026-06-02T00:00:00.000Z"),
        approvedByEmail: "final@example.test",
        approvedAt: new Date("2026-06-03T00:00:00.000Z"),
        rejectedByEmail: null,
        rejectedAt: null,
        notes: null
      }
    ]);
    prismaMocks.upsertStatus.mockResolvedValue({});
    prismaMocks.deleteStatuses.mockResolvedValue({ count: 1 });
    prismaMocks.deleteEntries.mockResolvedValue({ count: 236 });
    prismaMocks.findNotifications.mockResolvedValue([
      {
        id: "notification-1",
        archiveId: "archive-1",
        planYear: 2026,
        planMonth: 6,
        countryCodes: JSON.stringify(["ES"])
      }
    ]);
    prismaMocks.deleteNotifications.mockResolvedValue({ count: 1 });
    prismaMocks.countNotifications.mockResolvedValue(0);
    prismaMocks.deleteArchives.mockResolvedValue({ count: 1 });
    prismaMocks.upsertUser.mockResolvedValue({ id: "user-owner" });
    prismaMocks.createAudit.mockResolvedValue({});
    prismaMocks.transaction.mockImplementation(async (callback) =>
      callback({
        promotionPlanMonthStatus: {
          deleteMany: prismaMocks.deleteStatuses
        },
        promotionPlanEntry: {
          deleteMany: prismaMocks.deleteEntries
        },
        promotionPlanEmailNotification: {
          deleteMany: prismaMocks.deleteNotifications,
          count: prismaMocks.countNotifications
        },
        promotionPlanArchive: {
          deleteMany: prismaMocks.deleteArchives
        }
      })
    );
  });

  test("lets only owner change an approved history status after confirmation", async () => {
    const { statusCode, result } = await applyPromotionPlanHistoryAdminAction({
      action: "set-status",
      confirmation: "CHANGE APPROVAL",
      countryCodes: ["ES"],
      month: { year: 2026, month: 6 },
      notes: "Imported historical plan should be reviewed again.",
      session: session("julio.pu@iniushop.com", "OWNER"),
      targetStatus: "SUBMITTED"
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      updated: 1,
      deleted: 0
    });
    expect(prismaMocks.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "SUBMITTED",
          submittedByEmail: "submitter@example.test",
          approvedByEmail: null,
          approvedAt: null,
          notes: "Imported historical plan should be reviewed again."
        })
      })
    );
    expect(prismaMocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "promotion_plan_month_status",
          entityId: "2026-06-ES",
          oldValue: "APPROVED",
          newValue: "SUBMITTED"
        })
      })
    );
  });

  test("blocks non-owner history status management", async () => {
    const { statusCode, result } = await applyPromotionPlanHistoryAdminAction({
      action: "set-status",
      confirmation: "CHANGE APPROVAL",
      countryCodes: ["ES"],
      month: { year: 2026, month: 6 },
      session: session("leader@example.test", "ADMIN"),
      targetStatus: "SUBMITTED"
    });

    expect(statusCode).toBe(403);
    expect(result.status).toBe("error");
    expect(prismaMocks.upsertStatus).not.toHaveBeenCalled();
  });

  test("requires explicit confirmation before changing approval history", async () => {
    const { statusCode, result } = await applyPromotionPlanHistoryAdminAction({
      action: "set-status",
      confirmation: "change",
      countryCodes: ["ES"],
      month: { year: 2026, month: 6 },
      session: session("julio.pu@iniushop.com", "OWNER"),
      targetStatus: "SUBMITTED"
    });

    expect(statusCode).toBe(400);
    expect(result.message).toContain("CHANGE APPROVAL");
    expect(prismaMocks.upsertStatus).not.toHaveBeenCalled();
  });

  test("lets owner delete the approval record, month rows, notification, and orphan archive after confirmation", async () => {
    const { statusCode, result } = await applyPromotionPlanHistoryAdminAction({
      action: "delete-status",
      confirmation: "DELETE APPROVAL",
      countryCodes: ["ES"],
      month: { year: 2026, month: 6 },
      notes: "Remove wrong imported approval status.",
      session: session("julio.pu@iniushop.com", "OWNER")
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      updated: 0,
      deleted: 1
    });
    expect(result.message).toContain("promotion row(s)");
    expect(result.message).toContain("archived workbook record(s)");
    expect(prismaMocks.deleteStatuses).toHaveBeenCalledWith({
      where: {
        planYear: 2026,
        planMonth: 6,
        countryCode: { in: ["ES"] }
      }
    });
    expect(prismaMocks.deleteEntries).toHaveBeenCalledWith({
      where: {
        planYear: 2026,
        planMonth: 6,
        countryCode: { in: ["ES"] }
      }
    });
    expect(prismaMocks.findNotifications).toHaveBeenCalled();
    expect(prismaMocks.deleteNotifications).toHaveBeenCalledWith({
      where: {
        id: { in: ["notification-1"] }
      }
    });
    expect(prismaMocks.countNotifications).toHaveBeenCalledWith({
      where: { archiveId: "archive-1" }
    });
    expect(prismaMocks.deleteArchives).toHaveBeenCalledWith({
      where: {
        id: { in: ["archive-1"] }
      }
    });
    expect(prismaMocks.upsertStatus).not.toHaveBeenCalled();
    expect(prismaMocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldValue: "APPROVED",
          newValue: "DELETED",
          reason: "Remove wrong imported approval status."
        })
      })
    );
  });

  test("keeps the archive record when another notification still points to it", async () => {
    prismaMocks.countNotifications.mockResolvedValue(1);

    await applyPromotionPlanHistoryAdminAction({
      action: "delete-status",
      confirmation: "DELETE APPROVAL",
      countryCodes: ["ES"],
      month: { year: 2026, month: 6 },
      session: session("julio.pu@iniushop.com", "OWNER")
    });

    expect(prismaMocks.deleteArchives).not.toHaveBeenCalled();
  });
});

function session(email: string, role: AppSession["role"]): AppSession {
  return {
    email,
    name: email,
    role,
    groups: [role],
    expiresAt: 1800000000
  };
}

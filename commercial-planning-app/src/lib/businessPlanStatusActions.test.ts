import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppSession } from "./auth/types";
import type { ReferenceData } from "./types";

const dataMocks = vi.hoisted(() => ({
  getBusinessPlanChannelProfiles: vi.fn(),
  getBusinessPlanEntries: vi.fn(),
  getBusinessPlanYearStatuses: vi.fn(),
  getReferenceData: vi.fn(),
  getUserCountryAccesses: vi.fn()
}));

const prismaMocks = vi.hoisted(() => ({
  upsert: vi.fn()
}));

const archiveMocks = vi.hoisted(() => ({
  createPromotionPlanArchive: vi.fn()
}));

const emailMocks = vi.hoisted(() => ({
  sendBusinessPlanApprovalEmail: vi.fn()
}));

const approvalNotificationMocks = vi.hoisted(() => ({
  approvalSystemUrl: vi.fn((path: string) => `https://value-chain.example.test${path}`),
  sendApprovalRequiredNotification: vi.fn()
}));

vi.mock("./data", () => dataMocks);
vi.mock("./prisma", () => ({
  prisma: {
    businessPlanYearStatus: {
      upsert: prismaMocks.upsert
    }
  }
}));
vi.mock("./promotionPlanArchive", () => archiveMocks);
vi.mock("./businessPlanApprovalEmail", () => emailMocks);
vi.mock("./approvalNotifications", () => approvalNotificationMocks);

const { applyBusinessPlanStatusAction } = await import(
  "./businessPlanStatusActions"
);

describe("business plan status actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROMOTION_PLAN_FIRST_APPROVER_EMAILS =
      "bp.reviewer1@example.test";
    process.env.PROMOTION_PLAN_FINAL_APPROVER_EMAILS =
      "bp.reviewer2@example.test";
    dataMocks.getReferenceData.mockResolvedValue(referenceData());
    dataMocks.getUserCountryAccesses.mockResolvedValue([]);
    dataMocks.getBusinessPlanChannelProfiles.mockResolvedValue([]);
    dataMocks.getBusinessPlanEntries.mockResolvedValue([{ countryCode: "ES" }]);
    archiveMocks.createPromotionPlanArchive.mockResolvedValue({
      id: "bp-archive-1",
      planYear: 2026,
      planMonth: null,
      source: "BUSINESS_PLAN_APPROVE",
      sourceReference: "2026-approved-ES",
      title: "BP approved",
      message: "Approved BP",
      workbookFileName: "bp-approved.xlsx",
      driveStatus: "NOT_CONFIGURED",
      driveFileId: null,
      driveUrl: null,
      createdByEmail: "bp.reviewer2@example.test",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    });
    emailMocks.sendBusinessPlanApprovalEmail.mockResolvedValue({
      id: "bp-email-1",
      archiveId: "bp-archive-1",
      planYear: 2026,
      planMonth: 0,
      countryCodes: ["ES"],
      toEmails: ["ka.es@example.test", "bp.reviewer2@example.test"],
      ccEmails: [],
      status: "NOT_CONFIGURED",
      provider: "SES",
      attemptCount: 0,
      lastAttemptAt: "2026-07-01T00:00:00.000Z",
      messageId: null,
      errorMessage: "Approval email sender is not configured.",
      sentAt: null,
      createdByEmail: "bp.reviewer2@example.test",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    });
    approvalNotificationMocks.sendApprovalRequiredNotification.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      messageId: "ses-1",
      toEmails: ["approver@example.test"],
      ccEmails: []
    });
  });

  test("submit moves a draft country-year BP to submitted", async () => {
    dataMocks.getBusinessPlanYearStatuses.mockResolvedValue([]);
    dataMocks.getUserCountryAccesses.mockResolvedValue([
      userAccess("ka.es@example.test", "ES", "KA_OWNER")
    ]);

    const { statusCode, result } = await applyBusinessPlanStatusAction({
      action: "submit",
      session: session("ka.es@example.test", "KA_OWNER"),
      planYear: 2026,
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      updated: 1,
      skipped: 0
    });
    expect(prismaMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "SUBMITTED",
          submittedByEmail: "ka.es@example.test"
        })
      })
    );
  });

  test("owner submit directly approves BP and creates archive plus approval email record", async () => {
    dataMocks.getBusinessPlanYearStatuses.mockResolvedValue([]);
    dataMocks.getBusinessPlanEntries.mockResolvedValue([savedEntry()]);

    const { statusCode, result } = await applyBusinessPlanStatusAction({
      action: "submit",
      session: session("owner@example.test", "OWNER"),
      planYear: 2026,
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result.updated).toBe(1);
    expect(result.archive).toMatchObject({
      planYear: 2026,
      source: "BUSINESS_PLAN_APPROVE"
    });
    expect(result.emailNotification).toMatchObject({
      planYear: 2026,
      countryCodes: ["ES"]
    });
    expect(prismaMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "APPROVED",
          submittedByEmail: "owner@example.test",
          approvedByEmail: "owner@example.test"
        })
      })
    );
  });

  test("first reviewer moves submitted BP to first approved", async () => {
    dataMocks.getBusinessPlanYearStatuses.mockResolvedValue([
      yearStatus({ status: "SUBMITTED" })
    ]);

    const { statusCode, result } = await applyBusinessPlanStatusAction({
      action: "approve",
      session: session("bp.reviewer1@example.test"),
      planYear: 2026,
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result.updated).toBe(1);
    expect(prismaMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "FIRST_APPROVED",
          firstApprovedByEmail: "bp.reviewer1@example.test"
        })
      })
    );
  });

  test("final reviewer approves BP and creates archive plus approval email record", async () => {
    dataMocks.getBusinessPlanYearStatuses.mockResolvedValue([
      yearStatus({
        status: "FIRST_APPROVED",
        firstApprovedByEmail: "bp.reviewer1@example.test"
      })
    ]);
    dataMocks.getBusinessPlanEntries.mockResolvedValue([
      {
        id: "entry-es",
        planYear: 2026,
        planMonth: 1,
        countryCode: "ES",
        retailerName: "MediaMarkt ES",
        fdName: "FD ES",
        incoterms: "DDP",
        category: "Charger",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        promoPriceLocal: 99,
        promoDiscountPercent: 0.1,
        siUnits: 100,
        soUnits: 80,
        createdByEmail: "ka.es@example.test",
        updatedByEmail: "ka.es@example.test",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z"
      }
    ]);

    const { statusCode, result } = await applyBusinessPlanStatusAction({
      action: "approve",
      session: session("bp.reviewer2@example.test"),
      planYear: 2026,
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result.updated).toBe(1);
    expect(result.archive).toMatchObject({
      planYear: 2026,
      source: "BUSINESS_PLAN_APPROVE"
    });
    expect(result.emailNotification).toMatchObject({
      planYear: 2026,
      countryCodes: ["ES"],
      createdByEmail: "bp.reviewer2@example.test"
    });
  });
});

function session(email: string, role: AppSession["role"] = "ADMIN"): AppSession {
  return {
    email,
    name: email,
    role,
    groups: [role],
    expiresAt: 4102444800
  };
}

function yearStatus(overrides: Partial<{
  status: "DRAFT" | "SUBMITTED" | "FIRST_APPROVED" | "APPROVED" | "REJECTED";
  firstApprovedByEmail: string | null;
}> = {}) {
  return {
    id: "status-es-2026",
    planYear: 2026,
    countryCode: "ES",
    status: overrides.status ?? "DRAFT",
    submittedByEmail: "ka.es@example.test",
    firstApprovedByEmail: overrides.firstApprovedByEmail ?? null,
    approvedByEmail: null,
    rejectedByEmail: null,
    submittedAt: "2026-07-01T00:00:00.000Z",
    firstApprovedAt: null,
    approvedAt: null,
    rejectedAt: null,
    notes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
}

function userAccess(
  email: string,
  countryCode: string,
  role: AppSession["role"],
  approvalRole: "NONE" | "FIRST_APPROVER" | "FINAL_APPROVER" = "NONE"
) {
  return {
    id: `access-${email}-${countryCode}`,
    email,
    label: null,
    countryCode,
    role,
    approvalRole,
    receivesPromotionPlanEmail: false,
    status: "ACTIVE",
    createdByEmail: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function savedEntry() {
  return {
    id: "entry-es",
    planYear: 2026,
    planMonth: 1,
    countryCode: "ES",
    retailerName: "MediaMarkt ES",
    fdName: "FD ES",
    incoterms: "DDP",
    category: "Charger",
    productSku: "CHG-65W-EU",
    productName: "65W Charger",
    promoPriceLocal: 99,
    promoDiscountPercent: 0.1,
    siUnits: 100,
    soUnits: 80,
    createdByEmail: "ka.es@example.test",
    updatedByEmail: "ka.es@example.test",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
}

function referenceData(): ReferenceData {
  return {
    countries: [
      {
        id: "country-es",
        name: "Spain",
        code: "ES",
        vatRate: 0.21,
        currency: "EUR",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    exchangeRates: [],
    products: [],
    bomCosts: [],
    logisticsCosts: [],
    productCountryRrps: [],
    operationalMargins: [],
    channelMargins: [],
    fdMargins: []
  };
}

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppSession } from "./auth/types";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  PromotionPlanMonthStatusOption,
  ReferenceData
} from "./types";

const dataMocks = vi.hoisted(() => ({
  getReferenceData: vi.fn(),
  getUserCountryAccesses: vi.fn(),
  getPromotionPlanMonthStatuses: vi.fn(),
  getPromotionPlanEntries: vi.fn()
}));

const prismaMocks = vi.hoisted(() => ({
  upsert: vi.fn()
}));

const archiveMocks = vi.hoisted(() => ({
  createPromotionPlanArchive: vi.fn()
}));

const emailMocks = vi.hoisted(() => ({
  sendPromotionPlanApprovalEmail: vi.fn()
}));

const approvalNotificationMocks = vi.hoisted(() => ({
  approvalSystemUrl: vi.fn((path: string) => `https://value-chain.example.test${path}`),
  sendApprovalRequiredNotification: vi.fn()
}));

vi.mock("./data", () => dataMocks);
vi.mock("./prisma", () => ({
  prisma: {
    promotionPlanMonthStatus: {
      upsert: prismaMocks.upsert
    }
  }
}));
vi.mock("./promotionPlanArchive", () => archiveMocks);
vi.mock("./promotionPlanApprovalEmail", () => emailMocks);
vi.mock("./approvalNotifications", () => approvalNotificationMocks);

const { applyPromotionPlanStatusAction } = await import(
  "./promotionPlanStatusActions"
);

describe("promotion plan status actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROMOTION_PLAN_FIRST_APPROVER_EMAILS =
      "promo.reviewer1@example.test";
    process.env.PROMOTION_PLAN_FINAL_APPROVER_EMAILS =
      "promo.reviewer2@example.test";
    dataMocks.getReferenceData.mockResolvedValue(referenceData());
    dataMocks.getUserCountryAccesses.mockResolvedValue([]);
    dataMocks.getPromotionPlanEntries.mockResolvedValue([]);
    archiveMocks.createPromotionPlanArchive.mockResolvedValue({
      id: "archive-1",
      workbookFileName: "promotion-plan-2026-06.xlsx"
    });
    emailMocks.sendPromotionPlanApprovalEmail.mockResolvedValue({
      id: "email-1",
      status: "SENT"
    });
    approvalNotificationMocks.sendApprovalRequiredNotification.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      messageId: "ses-1",
      toEmails: ["approver@example.test"],
      ccEmails: []
    });
  });

  test("first reviewer moves submitted countries to first approved without final archive email", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({
        status: "SUBMITTED",
        submittedByEmail: "ka.es@example.test"
      })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "approve",
      session: session("promo.reviewer1@example.test"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      updated: 1,
      skipped: 0,
      archive: null,
      emailNotification: null
    });
    expect(prismaMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "FIRST_APPROVED",
          firstApprovedByEmail: "promo.reviewer1@example.test",
          approvedByEmail: null
        })
      })
    );
    expect(archiveMocks.createPromotionPlanArchive).not.toHaveBeenCalled();
    expect(emailMocks.sendPromotionPlanApprovalEmail).not.toHaveBeenCalled();
  });

  test("configured non-admin first reviewer can approve from unified user permissions", async () => {
    process.env.PROMOTION_PLAN_FIRST_APPROVER_EMAILS = "";
    process.env.PROMOTION_PLAN_FINAL_APPROVER_EMAILS = "";
    dataMocks.getUserCountryAccesses.mockResolvedValue([
      userAccess("first.configured@example.test", "GLOBAL", "FIRST_APPROVER")
    ]);
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({
        status: "SUBMITTED",
        submittedByEmail: "ka.es@example.test"
      })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "approve",
      session: session("first.configured@example.test", "VIEWER"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result.updated).toBe(1);
    expect(prismaMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "FIRST_APPROVED",
          firstApprovedByEmail: "first.configured@example.test"
        })
      })
    );
  });

  test("second reviewer cannot approve before first approval", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({
        status: "SUBMITTED",
        submittedByEmail: "ka.es@example.test"
      })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "approve",
      session: session("promo.reviewer2@example.test"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(400);
    expect(result.updated).toBe(0);
    expect(result.errors[0]?.message).toContain(
      "Final approval requires first approval"
    );
    expect(prismaMocks.upsert).not.toHaveBeenCalled();
  });

  test("requires a reason when an approver returns a plan for revision", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({ status: "SUBMITTED" })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "reject",
      session: session("promo.reviewer1@example.test"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(400);
    expect(result.errors[0]?.message).toContain("return reason is required");
    expect(prismaMocks.upsert).not.toHaveBeenCalled();
  });

  test("returns submitted plans for revision and lets the applicant resubmit the same plan", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({ status: "SUBMITTED" })
    ]);

    const returned = await applyPromotionPlanStatusAction({
      action: "reject",
      session: session("promo.reviewer1@example.test"),
      month: { year: 2099, month: 6 },
      countryCodes: ["ES"],
      notes: "Please correct the promotion dates."
    });

    expect(returned.statusCode).toBe(200);
    expect(returned.result.message).toContain("Returned for revision");
    expect(prismaMocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "REJECTED",
          notes: "Please correct the promotion dates."
        })
      })
    );

    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({ status: "REJECTED", notes: "Please correct the promotion dates." })
    ]);
    dataMocks.getUserCountryAccesses.mockResolvedValue([
      userCountryAccess("ka.es@example.test", "ES", "SALES_MANAGER")
    ]);
    const resubmitted = await applyPromotionPlanStatusAction({
      action: "submit",
      session: session("ka.es@example.test", "SALES_MANAGER"),
      month: { year: 2099, month: 6 },
      countryCodes: ["ES"]
    });

    expect(resubmitted.statusCode).toBe(200);
    expect(prismaMocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "SUBMITTED",
          rejectedByEmail: null,
          rejectedAt: null
        })
      })
    );
  });

  test("final reviewer can preview but cannot return a plan before first approval", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({ status: "SUBMITTED" })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "reject",
      session: session("promo.reviewer2@example.test"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"],
      notes: "Needs an update."
    });

    expect(statusCode).toBe(400);
    expect(result.errors[0]?.message).toContain("First approval is required");
    expect(prismaMocks.upsert).not.toHaveBeenCalled();
  });

  test("first reviewer cannot perform final approval", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({
        status: "FIRST_APPROVED",
        submittedByEmail: "ka.es@example.test",
        firstApprovedByEmail: "promo.reviewer1@example.test"
      })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "approve",
      session: session("promo.reviewer1@example.test"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(400);
    expect(result.updated).toBe(0);
    expect(result.errors[0]?.message).toContain(
      "Final approval requires the second approver"
    );
    expect(prismaMocks.upsert).not.toHaveBeenCalled();
  });

  test("second reviewer gives final approval and sends evidence email", async () => {
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({
        status: "FIRST_APPROVED",
        submittedByEmail: "ka.es@example.test",
        firstApprovedByEmail: "promo.reviewer1@example.test"
      })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "approve",
      session: session("promo.reviewer2@example.test"),
      month: { year: 2026, month: 6 },
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
          status: "APPROVED",
          approvedByEmail: "promo.reviewer2@example.test"
        })
      })
    );
    expect(archiveMocks.createPromotionPlanArchive).toHaveBeenCalledOnce();
    expect(archiveMocks.createPromotionPlanArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceReference: expect.stringMatching(
          /^2026-06-approved-ES-\d{8}-\d{4}-madrid$/
        ),
        title: expect.stringContaining("Promotion Plan approved · 2026-06 · ES"),
        message: expect.stringContaining("Approved time: "),
        createdAt: expect.any(Date)
      })
    );
    expect(emailMocks.sendPromotionPlanApprovalEmail).toHaveBeenCalledOnce();
  });

  test("final approval result calls out missing approval email configuration", async () => {
    emailMocks.sendPromotionPlanApprovalEmail.mockResolvedValue({
      id: "email-1",
      status: "NOT_CONFIGURED",
      errorMessage: "Approval email sender is not configured."
    });
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([
      monthStatus({
        status: "FIRST_APPROVED",
        submittedByEmail: "ka.es@example.test",
        firstApprovedByEmail: "promo.reviewer1@example.test"
      })
    ]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "approve",
      session: session("promo.reviewer2@example.test"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"]
    });

    expect(statusCode).toBe(200);
    expect(result.message).toContain("Approval email not configured.");
    expect(result.emailNotification).toMatchObject({
      status: "NOT_CONFIGURED",
      errorMessage: "Approval email sender is not configured."
    });
  });

  test("submit allows a completed plan when a new launched product is not included", async () => {
    dataMocks.getReferenceData.mockResolvedValue(referenceDataWithNewLaunch());
    dataMocks.getUserCountryAccesses.mockResolvedValue([
      userCountryAccess("ka.es@example.test", "ES", "SALES_MANAGER")
    ]);
    dataMocks.getPromotionPlanMonthStatuses.mockResolvedValue([]);
    dataMocks.getPromotionPlanEntries.mockResolvedValue([]);

    const { statusCode, result } = await applyPromotionPlanStatusAction({
      action: "submit",
      session: session("ka.es@example.test", "SALES_MANAGER"),
      month: { year: 2099, month: 7 },
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
});

function session(email: string, role: AppSession["role"] = "ADMIN"): AppSession {
  return {
    email,
    name: email,
    role,
    groups: [role],
    expiresAt: 1800000000
  };
}

function referenceData(): ReferenceData {
  return {
    countries: [country("ES", "Spain")],
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

function country(code: string, name: string): CountryOption {
  return {
    id: `country-${code.toLowerCase()}`,
    code,
    name,
    currency: "EUR",
    vatRate: 0.21,
    status: "ACTIVE",
    effectiveDate: "2026-01-01T00:00:00.000Z"
  };
}

function referenceDataWithNewLaunch(): ReferenceData {
  const es = country("ES", "Spain");
  const productRow = product();
  return {
    countries: [es],
    exchangeRates: [],
    products: [productRow],
    bomCosts: [bomCost(productRow)],
    logisticsCosts: [logisticsCost(es)],
    productCountryRrps: [productCountryRrp(productRow, es)],
    operationalMargins: [operationalMargin(es)],
    channelMargins: [],
    fdMargins: []
  };
}

function product(): ProductOption {
  return {
    id: "product-new-1",
    sku: "NEW-1",
    name: "New Launch",
    category: "Power bank",
    capacity: "Standard",
    lifecycleStatus: "LAUNCHED",
    launchedAt: "2099-06-12T10:00:00.000Z",
    status: "ACTIVE"
  };
}

function bomCost(productRow: ProductOption): BomCostOption {
  return {
    id: "bom-new-1",
    productId: productRow.id,
    productSku: productRow.sku,
    productName: productRow.name,
    bomCost: 18,
    bomCostRmb: null,
    currency: "EUR",
    effectiveDate: "2099-01-01T00:00:00.000Z",
    status: "ACTIVE"
  };
}

function productCountryRrp(
  productRow: ProductOption,
  countryRow: CountryOption
): ProductCountryRrpOption {
  return {
    id: "rrp-new-1-es",
    productId: productRow.id,
    productSku: productRow.sku,
    productName: productRow.name,
    countryId: countryRow.id,
    countryCode: countryRow.code,
    rrpLocal: 49.99,
    rrpEur: 49.99,
    currency: "EUR",
    effectiveDate: "2099-01-01T00:00:00.000Z",
    status: "ACTIVE"
  };
}

function logisticsCost(countryRow: CountryOption): LogisticsCostOption {
  return {
    id: "logistics-new-es",
    countryId: countryRow.id,
    countryCode: countryRow.code,
    category: "Power bank",
    productSize: "Standard",
    logisticsCost: 0.9,
    currency: "EUR",
    effectiveDate: "2099-01-01T00:00:00.000Z",
    status: "ACTIVE"
  };
}

function operationalMargin(countryRow: CountryOption): OperationalMarginOption {
  return {
    id: "margin-new-es",
    countryId: countryRow.id,
    countryCode: countryRow.code,
    retailerName: "BG",
    fdName: "Linku",
    incoterms: "DDP",
    category: "Power bank",
    kaBuyingMargin: 0.37,
    kaFrontMargin: 0.37,
    kaBackMargin: 0.08,
    fdMargin: 0.12,
    effectiveDate: "2099-01-01T00:00:00.000Z",
    status: "ACTIVE"
  };
}

function monthStatus(
  overrides: Partial<PromotionPlanMonthStatusOption> = {}
): PromotionPlanMonthStatusOption {
  return {
    id: "status-es",
    planYear: 2026,
    planMonth: 6,
    countryCode: "ES",
    status: "DRAFT",
    submittedByEmail: null,
    firstApprovedByEmail: null,
    approvedByEmail: null,
    rejectedByEmail: null,
    submittedAt: null,
    firstApprovedAt: null,
    approvedAt: null,
    rejectedAt: null,
    notes: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides
  };
}

function userAccess(
  email: string,
  countryCode: string,
  approvalRole: "FIRST_APPROVER" | "FINAL_APPROVER"
) {
  return userCountryAccess(email, countryCode, "VIEWER", approvalRole);
}

function userCountryAccess(
  email: string,
  countryCode: string,
  role: "VIEWER" | "SALES_MANAGER",
  approvalRole: "NONE" | "FIRST_APPROVER" | "FINAL_APPROVER" = "NONE"
) {
  return {
    id: `${email}-${countryCode}`,
    email,
    label: null,
    countryCode,
    role,
    approvalRole,
    receivesPromotionPlanEmail: false,
    status: "ACTIVE" as const,
    createdByEmail: "admin@example.test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

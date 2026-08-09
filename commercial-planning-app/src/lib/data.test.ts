import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const testDirectory = await mkdtemp(join(tmpdir(), "value-chain-data-test-"));
const databaseUrl = `file:${join(testDirectory, "test.db")}`;

process.env.DATABASE_URL = databaseUrl;

await execFileAsync(process.execPath, ["scripts/init-local-db.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl
  }
});

const {
  getBusinessPlanApprovalQueue,
  getBusinessPlanEntries,
  getBusinessPlanYearStatuses,
  getPromotionPlanApprovalQueue,
  getPromotionPlanMonthStatuses,
  getReferenceData
} = await import("./data");
const { prisma } = await import("./prisma");

await seedReferenceFixture();

describe("getReferenceData", () => {
  afterAll(async () => {
    await prisma.$disconnect();
    await rm(testDirectory, { recursive: true, force: true });
  });

  test("returns product-country RRP, operational margin, and RMB BOM master data from an isolated database", async () => {
    const data = await getReferenceData();

    expect(data.products).toEqual([
      expect.objectContaining({
        sku: "TMP-CHG-TEST",
        capacity: null
      })
    ]);
    expect(data.productCountryRrps).toEqual([
      expect.objectContaining({
        productSku: "TMP-CHG-TEST",
        countryCode: "TC",
        rrpLocal: 88.88,
        rrpEur: 77.77,
        currency: "EUR"
      })
    ]);
    expect(data.operationalMargins).toEqual([
      expect.objectContaining({
        countryCode: "TC",
        retailerName: "Temp Retailer",
        fdName: "Temp Distributor",
        incoterms: "DDP",
        category: "Test Charger",
        kaBuyingMargin: 0.31,
        kaFrontMargin: 0.21,
        kaBackMargin: 0.09,
        fdMargin: 0.08
      })
    ]);
    expect(data.bomCosts).toEqual([
      expect.objectContaining({
        productSku: "TMP-CHG-TEST",
        bomCost: 12.34,
        bomCostRmb: 99.99
      })
    ]);
    expect(data.exchangeRates).toEqual([
      expect.objectContaining({
        currency: "EUR",
        exchangeRateToEur: 1
      })
    ]);
  });

  test("preserves first-approved promotion plan month status", async () => {
    const status = await prisma.promotionPlanMonthStatus.create({
      data: {
        planYear: 2026,
        planMonth: 6,
        countryCode: "TC",
        status: "FIRST_APPROVED",
        submittedByEmail: "ka.tc@example.test",
        firstApprovedByEmail: "promo.reviewer1@example.test",
        submittedAt: new Date("2026-05-10T10:00:00.000Z"),
        firstApprovedAt: new Date("2026-05-11T10:00:00.000Z")
      }
    });

    await expect(
      getPromotionPlanMonthStatuses({
        planYear: status.planYear,
        planMonth: status.planMonth,
        countryCodes: [status.countryCode]
      })
    ).resolves.toEqual([
      expect.objectContaining({
        status: "FIRST_APPROVED",
        submittedByEmail: "ka.tc@example.test",
        firstApprovedByEmail: "promo.reviewer1@example.test",
        approvedByEmail: null
      })
    ]);
  });

  test("shows active plans to both approvers while limiting actions to the current stage", async () => {
    await prisma.promotionPlanMonthStatus.createMany({
      data: [
        {
          planYear: 2026,
          planMonth: 8,
          countryCode: "TC",
          status: "SUBMITTED",
          submittedByEmail: "ka.tc@example.test",
          submittedAt: new Date("2026-07-10T10:00:00.000Z")
        },
        {
          planYear: 2026,
          planMonth: 8,
          countryCode: "FC",
          status: "SUBMITTED",
          submittedByEmail: "ka.fc@example.test",
          submittedAt: new Date("2026-07-11T10:00:00.000Z")
        },
        {
          planYear: 2026,
          planMonth: 9,
          countryCode: "TC",
          status: "FIRST_APPROVED",
          submittedByEmail: "ka.tc@example.test",
          firstApprovedByEmail: "promo.reviewer1@example.test",
          submittedAt: new Date("2026-08-10T10:00:00.000Z"),
          firstApprovedAt: new Date("2026-08-11T10:00:00.000Z")
        }
      ]
    });
    await prisma.promotionPlanEntry.createMany({
      data: [
        promotionEntryFixture({
          planYear: 2026,
          planMonth: 8,
          countryCode: "TC",
          productSku: "SKU-1"
        }),
        promotionEntryFixture({
          planYear: 2026,
          planMonth: 8,
          countryCode: "TC",
          productSku: "SKU-2"
        }),
        promotionEntryFixture({
          planYear: 2026,
          planMonth: 9,
          countryCode: "TC",
          productSku: "SKU-3"
        })
      ]
    });

    const firstApprovalQueue = await getPromotionPlanApprovalQueue({
      countryCodes: ["TC"],
      canFirstApprove: true,
      canFinalApprove: false
    });
    expect(firstApprovalQueue).toContainEqual(
      expect.objectContaining({
        planYear: 2026,
        planMonth: 8,
        countryCode: "TC",
        status: "SUBMITTED",
        stage: "first",
        submittedByEmail: "ka.tc@example.test",
        entryCount: 2,
        canApprove: true,
        canReturnForRevision: true
      })
    );
    expect(firstApprovalQueue).not.toContainEqual(
      expect.objectContaining({ countryCode: "FC" })
    );
    expect(firstApprovalQueue).not.toContainEqual(
      expect.objectContaining({ status: "FIRST_APPROVED" })
    );

    const finalApprovalQueue = await getPromotionPlanApprovalQueue({
      countryCodes: ["TC"],
      canFirstApprove: false,
      canFinalApprove: true
    });
    expect(finalApprovalQueue).toContainEqual(
      expect.objectContaining({
        planYear: 2026,
        planMonth: 9,
        countryCode: "TC",
        status: "FIRST_APPROVED",
        stage: "final",
        canApprove: true,
        entryCount: 1
      })
    );
    expect(finalApprovalQueue).toContainEqual(
      expect.objectContaining({
        status: "SUBMITTED",
        stage: "first",
        canApprove: false,
        canReturnForRevision: false
      })
    );
  });

  test("returns saved BP entries and country-year approval queue items", async () => {
    await prisma.businessPlanEntry.createMany({
      data: [
        businessPlanEntryFixture({
          planYear: 2026,
          planMonth: 1,
          countryCode: "TC",
          productSku: "TMP-CHG-TEST"
        }),
        businessPlanEntryFixture({
          planYear: 2026,
          planMonth: 2,
          countryCode: "FC",
          productSku: "SKU-FC"
        })
      ]
    });
    await prisma.businessPlanYearStatus.createMany({
      data: [
        {
          planYear: 2026,
          countryCode: "TC",
          status: "SUBMITTED",
          submittedByEmail: "ka.tc@example.test",
          submittedAt: new Date("2026-07-10T10:00:00.000Z")
        },
        {
          planYear: 2026,
          countryCode: "FC",
          status: "SUBMITTED",
          submittedByEmail: "ka.fc@example.test",
          submittedAt: new Date("2026-07-11T10:00:00.000Z")
        }
      ]
    });

    await expect(getBusinessPlanEntries(2026, ["TC"])).resolves.toEqual([
      expect.objectContaining({
        planYear: 2026,
        planMonth: 1,
        countryCode: "TC",
        productSku: "TMP-CHG-TEST",
        siUnits: 100,
        soUnits: 80
      })
    ]);
    await expect(
      getBusinessPlanYearStatuses({ planYear: 2026, countryCodes: ["TC"] })
    ).resolves.toEqual([
      expect.objectContaining({
        planYear: 2026,
        countryCode: "TC",
        status: "SUBMITTED"
      })
    ]);

    const queue = await getBusinessPlanApprovalQueue({
      countryCodes: ["TC"],
      canFirstApprove: true,
      canFinalApprove: false
    });
    expect(queue).toEqual([
      expect.objectContaining({
        planYear: 2026,
        countryCode: "TC",
        status: "SUBMITTED",
        stage: "first",
        entryCount: 1
      })
    ]);
  });
});

async function seedReferenceFixture() {
  const effectiveDate = new Date("2026-02-03T00:00:00.000Z");
  const country = await prisma.country.create({
    data: {
      name: "Test Country",
      code: "TC",
      vatRate: "0.20",
      currency: "EUR",
      effectiveDate
    }
  });
  const product = await prisma.product.create({
    data: {
      sku: "TMP-CHG-TEST",
      name: "Temp Charger",
      category: "Test Charger",
      capacity: null
    }
  });
  await prisma.currencyExchangeRate.create({
    data: {
      currency: "EUR",
      exchangeRateToEur: "1",
      effectiveDate
    }
  });

  await prisma.bomCost.create({
    data: {
      productId: product.id,
      bomCost: "12.34",
      bomCostRmb: "99.99",
      currency: "EUR",
      effectiveDate
    }
  });
  await prisma.productCountryRrp.create({
    data: {
      productId: product.id,
      countryId: country.id,
      rrpLocal: "88.88",
      rrpEur: "77.77",
      currency: "EUR",
      effectiveDate
    }
  });
  await prisma.operationalMargin.create({
    data: {
      countryId: country.id,
      retailerName: "Temp Retailer",
      fdName: "Temp Distributor",
      incoterms: "DDP",
      category: "Test Charger",
      kaBuyingMargin: "0.31",
      kaFrontMargin: "0.21",
      kaBackMargin: "0.09",
      fdMargin: "0.08",
      effectiveDate
    }
  });
}

function promotionEntryFixture({
  planYear,
  planMonth,
  countryCode,
  productSku
}: {
  planYear: number;
  planMonth: number;
  countryCode: string;
  productSku: string;
}) {
  return {
    planYear,
    planMonth,
    countryCode,
    retailerName: "Temp Retailer",
    fdName: "Temp Distributor",
    incoterms: "DDP",
    category: "Test Charger",
    productSku,
    productName: productSku,
    promoRrpLocal: "88.88",
    promoRrpEur: "77.77",
    promoFrontMargin: "0.21",
    promoVolume: 100
  };
}

function businessPlanEntryFixture({
  planYear,
  planMonth,
  countryCode,
  productSku
}: {
  planYear: number;
  planMonth: number;
  countryCode: string;
  productSku: string;
}) {
  return {
    planYear,
    planMonth,
    countryCode,
    retailerName: "Temp Retailer",
    fdName: "Temp Distributor",
    incoterms: "DDP",
    category: "Test Charger",
    productSku,
    productName: "Temp Charger",
    promoPriceLocal: "79.99",
    promoDiscountPercent: "0.1",
    siUnits: 100,
    soUnits: 80,
    createdByEmail: "ka.tc@example.test",
    updatedByEmail: "ka.tc@example.test"
  };
}

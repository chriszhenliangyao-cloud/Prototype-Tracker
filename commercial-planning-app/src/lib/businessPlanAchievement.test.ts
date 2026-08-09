import { describe, expect, it } from "vitest";
import {
  achievementRate,
  buildBusinessPlanAchievement,
  sortBusinessPlanAchievementProducts
} from "./businessPlanAchievement";
import type { BusinessPlanLine } from "./calculations/businessPlan";
import type { BusinessPlanActualEntryOption } from "./types";

describe("business plan achievement", () => {
  it("compares PO actuals to BP targets by month and SKU, not PO KA", () => {
    const achievement = buildBusinessPlanAchievement({
      lines: [
        line({ month: 2, model: "CHG-65W-EU" }),
        line({ month: 3, countryCode: "PL", model: "P75-P1" })
      ],
      actuals: [
        actual({ planMonth: 2, customerName: "FD A", productModel: "chg-65w-eu" }),
        actual({
          planMonth: 3,
          countryCode: "PL",
          customerName: "Komsa",
          productModel: "P75-P1",
          siUnits: 20,
          siValueEur: 600
        }),
        actual({
          planMonth: 3,
          countryCode: "PL",
          customerName: "MEX",
          productModel: "UNKNOWN-SKU",
          siUnits: 10,
          siValueEur: 300
        })
      ]
    });

    expect(achievement.summary).toEqual({
      targetSiUnits: 200,
      actualSiUnits: 130,
      targetSiValueEur: 6000,
      actualSiValueEur: 3900
    });
    expect(achievement.byMonth[1]).toMatchObject({
      month: 2,
      targetSiUnits: 100,
      actualSiUnits: 100,
      targetSiValueEur: 3000,
      actualSiValueEur: 3000
    });
    expect(achievement.byProduct).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          countryCode: "ES",
          productModel: "CHG-65W-EU",
          hasBpProductMatch: true,
          actualSiUnits: 100
        }),
        expect.objectContaining({
          countryCode: "PL",
          productModel: "UNKNOWN-SKU",
          hasBpProductMatch: false,
          actualSiUnits: 10
        })
      ])
    );
    expect(achievementRate(100, 100)).toBe(1);
    expect(achievementRate(20, 0)).toBeNull();
  });

  it("applies product and month filters to both BP targets and PO actuals", () => {
    const achievement = buildBusinessPlanAchievement({
      lines: [
        line({ month: 2, model: "CHG-65W-EU" }),
        line({ month: 2, model: "P75-P1" }),
        line({ month: 3, model: "P75-P1" })
      ],
      actuals: [
        actual({ planMonth: 2, productModel: "CHG-65W-EU" }),
        actual({ planMonth: 2, productModel: "P75-P1" }),
        actual({ planMonth: 3, productModel: "P75-P1", siUnits: 40, siValueEur: 1200 })
      ],
      period: "MONTH_3",
      productFilter: "P75-P1"
    });

    expect(achievement.summary).toEqual({
      targetSiUnits: 100,
      actualSiUnits: 40,
      targetSiValueEur: 3000,
      actualSiValueEur: 1200
    });
    expect(achievement.annualSummary).toEqual({
      targetSiUnits: 200,
      actualSiUnits: 140,
      targetSiValueEur: 6000,
      actualSiValueEur: 4200
    });
  });

  it("aggregates the same SKU across markets in the all-markets product view", () => {
    const franceLine = line({ countryCode: "FR", model: "CHG-65W-EU" });
    franceLine.siUnits = 250;
    franceLine.siValueEur = 7_500;
    const achievement = buildBusinessPlanAchievement({
      aggregateProductsAcrossMarkets: true,
      lines: [line({ countryCode: "ES", model: "CHG-65W-EU" }), franceLine],
      actuals: [
        actual({ countryCode: "ES", productModel: "CHG-65W-EU", siUnits: 80, siValueEur: 2400 }),
        actual({ countryCode: "FR", productModel: "CHG-65W-EU", siUnits: 180, siValueEur: 5400 })
      ]
    });

    expect(achievement.byProduct).toEqual([
      expect.objectContaining({
        countryCode: "All markets",
        productModel: "CHG-65W-EU",
        targetSiUnits: 350,
        actualSiUnits: 260,
        targetSiValueEur: 10_500,
        actualSiValueEur: 7800,
        hasBpProductMatch: true
      })
    ]);
  });

  it("normalizes standard source colour SKU aliases only when BP has a matching model", () => {
    const achievement = buildBusinessPlanAchievement({
      lines: [line({ model: "P75-P1-BU" }), line({ model: "PPT01" })],
      actuals: [
        actual({ productModel: "P75-P1-Blue", siUnits: 20, siValueEur: 600 }),
        actual({ productModel: "PPT01-Black", siUnits: 30, siValueEur: 900 })
      ]
    });

    expect(achievement.byProduct).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productModel: "P75-P1-BU",
          actualSiUnits: 20,
          hasBpProductMatch: true
        }),
        expect.objectContaining({
          productModel: "PPT01",
          actualSiUnits: 30,
          hasBpProductMatch: true
        })
      ])
    );
  });

  it("sorts product achievement by the selected top-product metric", () => {
    const highBp = line({ model: "HIGH-BP", month: 2 });
    highBp.siUnits = 300;
    highBp.siValueEur = 9_000;
    const achievement = buildBusinessPlanAchievement({
      lines: [
        highBp,
        line({ model: "HIGH-RATE", month: 2 })
      ],
      actuals: [
        actual({ productModel: "HIGH-BP", siUnits: 50, siValueEur: 1_500 }),
        actual({ productModel: "HIGH-RATE", siUnits: 150, siValueEur: 4_500 })
      ]
    });

    const byBpSi = sortBusinessPlanAchievementProducts(
      achievement.byProduct,
      "TARGET_SI_DESC"
    );
    const bySiAchievement = sortBusinessPlanAchievementProducts(
      achievement.byProduct,
      "SI_ACHIEVEMENT_DESC"
    );

    expect(byBpSi.map((product) => product.productModel)).toEqual([
      "HIGH-BP",
      "HIGH-RATE"
    ]);
    expect(bySiAchievement.map((product) => product.productModel)).toEqual([
      "HIGH-RATE",
      "HIGH-BP"
    ]);
  });
});

function line({
  countryCode = "ES",
  model = "CHG-65W-EU",
  month = 2
}: {
  countryCode?: string;
  model?: string;
  month?: number;
} = {}) {
  return {
    countryCode,
    model,
    productName: "Test product",
    month,
    siUnits: 100,
    siValueEur: 3000
  } as BusinessPlanLine;
}

function actual({
  countryCode = "ES",
  customerName = "FD A",
  planMonth = 2,
  productModel = "CHG-65W-EU",
  productName = "Test product",
  siUnits = 100,
  siValueEur = 3000
}: {
  countryCode?: string;
  customerName?: string;
  planMonth?: number;
  productModel?: string;
  productName?: string;
  siUnits?: number;
  siValueEur?: number;
} = {}): BusinessPlanActualEntryOption {
  return {
    id: `${countryCode}-${productModel}-${planMonth}`,
    planYear: 2026,
    planMonth,
    countryCode,
    customerName,
    poNumber: `PO-${planMonth}`,
    poDate: `2026-${String(planMonth).padStart(2, "0")}-10T12:00:00.000Z`,
    productModel,
    productName,
    sourceLineKey: `PO-${planMonth}|${productModel}|2`,
    siUnits,
    siValueEur,
    sourceFileName: "po.xls",
    importedByEmail: "owner@example.test",
    importedAt: "2026-07-20T08:00:00.000Z",
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z"
  };
}

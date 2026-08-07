import { describe, expect, it } from "vitest";
import type { BusinessPlanEntryOption, ReferenceData } from "./types";
import { businessPlanDraftLinesFromEntries } from "./businessPlanPersistence";

describe("business plan persistence", () => {
  it("restores BP-only channel assumptions from saved entry snapshots", () => {
    const drafts = businessPlanDraftLinesFromEntries(
      [
        {
          id: "entry-new-channel",
          planYear: 2026,
          planMonth: 2,
          countryCode: "ES",
          retailerName: "New Retail ES",
          fdName: "Breakthrough FD",
          incoterms: "DDP",
          category: "Charger",
          productSku: "CHG-65W-EU",
          productName: "65W Charger",
          promoPriceLocal: 100,
          promoDiscountPercent: 0.1,
          siUnits: 25,
          soUnits: 20,
          source: "BP_ASSUMPTION",
          snapshotCurrency: "EUR",
          snapshotRrpLocal: 120,
          snapshotRrpEur: 120,
          snapshotKaBuyingMargin: 0.38,
          snapshotKaFrontMargin: 0.35,
          snapshotKaBackMargin: 0.03,
          snapshotFdMargin: 0.08,
          snapshotBomCost: 20,
          snapshotLogisticsCost: 2,
          createdByEmail: "ka@example.test",
          updatedByEmail: "ka@example.test",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ],
      referenceData()
    );

    expect(drafts).toEqual([
      expect.objectContaining({
        rowKey:
          "bp-assumption:es|new retail es|breakthrough fd|ddp|chg-65w-eu",
        assumption: expect.objectContaining({
          retailerName: "New Retail ES",
          fdName: "Breakthrough FD",
          kaBuyingMargin: 0.38,
          logisticsCostEur: 2
        })
      })
    ]);
  });
});

function referenceData(): ReferenceData {
  return {
    countries: [
      {
        id: "country-es",
        name: "Spain",
        code: "ES",
        vatRate: 0.2,
        currency: "EUR",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    exchangeRates: [],
    products: [
      {
        id: "product-65w",
        sku: "CHG-65W-EU",
        name: "65W Charger",
        category: "Charger",
        capacity: "Small",
        lifecycleStatus: "LAUNCHED",
        launchedAt: "2025-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    bomCosts: [],
    logisticsCosts: [],
    productCountryRrps: [],
    operationalMargins: [],
    channelMargins: [],
    fdMargins: []
  };
}

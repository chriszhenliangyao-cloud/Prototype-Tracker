import { describe, expect, it } from "vitest";
import type { ReferenceData } from "../types";
import {
  buildBusinessPlanLines,
  summarizeBusinessPlan,
  type BusinessPlanDraftLine
} from "./businessPlan";

describe("business plan calculations", () => {
  it("builds monthly BP lines from existing value-chain master data", () => {
    const draft: BusinessPlanDraftLine = {
      id: "line-1",
      rowKey: "margin-es|product-65w",
      year: 2026,
      month: 1,
      siUnits: 100,
      soUnits: 80,
      promoDiscountPercent: 0.2
    };

    const [line] = buildBusinessPlanLines(referenceData(), [draft]);

    expect(line).toMatchObject({
      countryCode: "ES",
      channelName: "MediaMarkt ES",
      quarter: "Q1",
      model: "CHG-65W-EU",
      promoPriceLocal: 96,
      promoPriceEur: 96
    });
    expect(line?.fdBuyingPriceEur).toBeCloseTo(54, 5);
    expect(line?.siValueEur).toBeCloseTo(5400, 5);
    expect(line?.kaSiValueEur).toBeCloseTo(6000, 5);
    expect(line?.gpEur).toBeCloseTo(3200, 5);
    expect(line?.promoRebatePerUnitEur).toBeCloseTo(12, 5);
    expect(line?.promoRebateEur).toBeCloseTo(960, 5);
    expect(line?.netProfitEur).toBeCloseTo(2240, 5);
  });

  it("accepts local-currency promo price and converts it to EUR", () => {
    const draft: BusinessPlanDraftLine = {
      id: "line-1",
      rowKey: "margin-es|product-65w",
      year: 2026,
      month: 1,
      promoPriceLocal: 400,
      siUnits: 100,
      soUnits: 80,
      promoDiscountPercent: 0
    };
    const data = referenceData();
    data.countries[0] = {
      ...data.countries[0]!,
      currency: "PLN",
      code: "PL"
    };
    data.productCountryRrps[0] = {
      ...data.productCountryRrps[0]!,
      countryCode: "PL",
      rrpLocal: 500,
      rrpEur: 100,
      currency: "PLN"
    };
    data.operationalMargins[0] = {
      ...data.operationalMargins[0]!,
      countryCode: "PL"
    };
    data.logisticsCosts[0] = {
      ...data.logisticsCosts[0]!,
      countryCode: "PL"
    };

    const [line] = buildBusinessPlanLines(data, [draft]);

    expect(line?.currency).toBe("PLN");
    expect(line?.rrpLocal).toBe(500);
    expect(line?.rrpEur).toBe(100);
    expect(line?.promoPriceLocal).toBe(400);
    expect(line?.promoPriceEur).toBe(80);
    expect(line?.promoDiscountPercent).toBeCloseTo(0.2, 5);
    expect(line?.siValueEur).toBeGreaterThan(0);
  });

  it("builds BP lines from temporary channel assumptions without mutating master data", () => {
    const draft: BusinessPlanDraftLine = {
      id: "line-new-channel",
      rowKey:
        "bp-assumption:es|new retail es|breakthrough fd|ddp|chg-65w-eu",
      year: 2026,
      month: 2,
      promoPriceLocal: 100,
      siUnits: 25,
      soUnits: 20,
      promoDiscountPercent: 0,
      assumption: {
        countryCode: "ES",
        retailerName: "New Retail ES",
        fdName: "Breakthrough FD",
        incoterms: "DDP",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        category: "Charger",
        currency: "EUR",
        rrpLocal: 120,
        rrpEur: 120,
        kaBuyingMargin: 0.38,
        kaFrontMargin: 0.35,
        kaBackMargin: 0.03,
        fdMargin: 0.08
      }
    };

    const lines = buildBusinessPlanLines(referenceData(), [draft]);
    const summary = summarizeBusinessPlan(lines);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      source: "BP_ASSUMPTION",
      countryCode: "ES",
      channelName: "New Retail ES",
      fdName: "Breakthrough FD",
      model: "CHG-65W-EU",
      productName: "65W Charger",
      category: "Charger",
      currency: "EUR",
      rrpLocal: 120,
      rrpEur: 120,
      promoPriceLocal: 100,
      promoPriceEur: 100,
      missingFields: []
    });
    expect(lines[0]?.fdBuyingPriceEur).toBeCloseTo(57.04, 5);
    expect(lines[0]?.siValueEur).toBeCloseTo(1426, 5);
    expect(summary.annual.siUnits).toBe(25);
    expect(summary.byChannelMonth[0]?.label).toBe(
      "ES · New Retail ES · February"
    );
  });

  it("summarizes BP lines by annual, quarter, month, category, and product", () => {
    const lines = buildBusinessPlanLines(referenceData(), [
      {
        id: "line-1",
        rowKey: "margin-es|product-65w",
        year: 2026,
        month: 1,
        siUnits: 100,
        soUnits: 80,
        promoDiscountPercent: 0.2
      },
      {
        id: "line-2",
        rowKey: "margin-es|product-65w",
        year: 2026,
        month: 4,
        siUnits: 50,
        soUnits: 40,
        promoDiscountPercent: 0.1
      }
    ]);

    const summary = summarizeBusinessPlan(lines);

    expect(summary.annual.siUnits).toBe(150);
    expect(summary.annual.siValueEur).toBeCloseTo(8100, 5);
    expect(summary.byQuarter.map((item) => item.label)).toEqual(["Q1", "Q2"]);
    expect(summary.byMonth.map((item) => item.label)).toEqual([
      "January",
      "April"
    ]);
    expect(summary.byCategory).toHaveLength(1);
    expect(summary.byCategory[0]?.label).toBe("Charger");
    expect(summary.byProduct[0]?.label).toBe("CHG-65W-EU · 65W Charger");
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
    exchangeRates: [
      {
        id: "eur-rate",
        currency: "EUR",
        exchangeRateToEur: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
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
    bomCosts: [
      {
        id: "bom-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        bomCost: 20,
        bomCostRmb: 156,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    logisticsCosts: [
      {
        id: "logistics-es-charger",
        countryId: "country-es",
        countryCode: "ES",
        category: "Charger",
        productSize: "Small",
        logisticsCost: 2,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        id: "rrp-es-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        countryId: "country-es",
        countryCode: "ES",
        rrpLocal: 120,
        rrpEur: 120,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      {
        id: "margin-es",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "MediaMarkt ES",
        fdName: "FD ES",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.4,
        kaFrontMargin: 0.4,
        kaBackMargin: 0,
        fdMargin: 0.1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

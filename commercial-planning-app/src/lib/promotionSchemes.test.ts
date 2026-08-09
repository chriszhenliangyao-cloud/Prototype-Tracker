import { describe, expect, test } from "vitest";
import {
  buildPromotionInputsForScheme,
  summarizePromotionScheme,
  type PromotionPriceScheme
} from "./promotionSchemes";
import { buildNormalRows, buildPromotionRows } from "./calculatorRows";
import type { ReferenceData } from "./types";

describe("promotion price scheme comparison", () => {
  test("builds comparable promotion inputs from shared master rows", () => {
    const data = referenceData();
    const normalRows = buildNormalRows(data);
    const conservativePlan: PromotionPriceScheme = {
      id: "scheme-conservative",
      name: "Conservative RRPP",
      rrpDiscountPercent: 0.1,
      promoVolume: 500
    };
    const aggressivePlan: PromotionPriceScheme = {
      id: "scheme-aggressive",
      name: "Aggressive RRPP",
      rrpDiscountPercent: 0.25,
      promoVolume: 1200
    };

    const conservativeRows = buildPromotionRows(
      data,
      buildPromotionInputsForScheme(normalRows, conservativePlan)
    );
    const aggressiveRows = buildPromotionRows(
      data,
      buildPromotionInputsForScheme(normalRows, aggressivePlan)
    );
    const conservativeSummary = summarizePromotionScheme(
      conservativePlan,
      conservativeRows
    );
    const aggressiveSummary = summarizePromotionScheme(
      aggressivePlan,
      aggressiveRows
    );

    expect(conservativeRows[0]).toMatchObject({
      promoRrpLocal: 40.49,
      promoRrpEur: 40.49,
      promoVolume: 500,
      settlementMode: "INVOICE_DISCOUNT"
    });
    expect(aggressiveRows[0]).toMatchObject({
      promoRrpLocal: 33.74,
      promoRrpEur: 33.74,
      promoVolume: 1200,
      settlementMode: "INVOICE_DISCOUNT"
    });
    expect(conservativeSummary.completeRows).toBe(1);
    expect(aggressiveSummary.completeRows).toBe(1);
    expect(aggressiveSummary.totalRebate).toBeGreaterThan(
      conservativeSummary.totalRebate
    );
    expect(aggressiveSummary.averageNpPercent).toBeLessThan(
      conservativeSummary.averageNpPercent
    );
  });
});

function referenceData(): ReferenceData {
  return {
    countries: [
      {
        id: "country-fr",
        name: "France",
        code: "FR",
        vatRate: 0.2,
        currency: "EUR",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    products: [
      {
        id: "product-powerpaw",
        sku: "P41L-P1",
        name: "PowerPaw 10K",
        category: "Power bank",
        capacity: "Standard",
        lifecycleStatus: "LAUNCHED",
        status: "ACTIVE"
      }
    ],
    bomCosts: [
      {
        id: "bom-powerpaw",
        productId: "product-powerpaw",
        productSku: "P41L-P1",
        productName: "PowerPaw 10K",
        bomCost: 18.08,
        bomCostRmb: null,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    logisticsCosts: [
      {
        id: "logistics-fr",
        countryId: "country-fr",
        countryCode: "FR",
        category: "Power bank",
        productSize: "Standard",
        logisticsCost: 0.9,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        id: "rrp-fr-powerpaw",
        productId: "product-powerpaw",
        productSku: "P41L-P1",
        productName: "PowerPaw 10K",
        countryId: "country-fr",
        countryCode: "FR",
        rrpLocal: 44.99,
        rrpEur: 44.99,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      {
        id: "margin-fr-boulanger",
        countryId: "country-fr",
        countryCode: "FR",
        retailerName: "Boulanger",
        fdName: "BBC",
        incoterms: "DDP",
        category: "Power bank",
        kaBuyingMargin: 0.42,
        kaFrontMargin: 0.42,
        kaBackMargin: 0,
        fdMargin: 0.2,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

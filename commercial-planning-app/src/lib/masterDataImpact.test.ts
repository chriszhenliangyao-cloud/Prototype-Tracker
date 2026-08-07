import { describe, expect, test } from "vitest";
import type { MasterDataWorkbookImportResult } from "./imports/masterDataImport";
import { buildMasterDataImpactPreview } from "./masterDataImpact";
import type { ReferenceData } from "./types";

describe("Master Data import impact", () => {
  test("identifies additions, changed defaults, inactivations and dependent modules", () => {
    const preview = buildMasterDataImpactPreview(incomingWorkbook(), currentData());

    expect(preview.groups).toEqual([
      expect.objectContaining({ key: "markets", added: 0, changed: 0, inactivated: 0 }),
      expect.objectContaining({ key: "products", added: 1, changed: 1, inactivated: 1 }),
      expect.objectContaining({ key: "bom", added: 1, changed: 1, inactivated: 1 }),
      expect.objectContaining({ key: "rrp", added: 1, changed: 1, inactivated: 1 }),
      expect.objectContaining({ key: "logistics", added: 0, changed: 1, inactivated: 0 }),
      expect.objectContaining({ key: "margins", added: 0, changed: 1, inactivated: 0 })
    ]);
    expect(preview.totalChanges).toBe(11);
    expect(preview.affectedModules).toContain("Project Tracking");
    expect(preview.affectedModules).toContain("Monthly Promotion Approval");
  });
});

function incomingWorkbook(): MasterDataWorkbookImportResult {
  return {
    countries: [
      {
        rowNumber: 2,
        countryCode: "ES",
        currency: "EUR",
        exchangeRateToEur: 1,
        vatRate: 0.21
      }
    ],
    bomProducts: [
      {
        rowNumber: 2,
        model: "P1",
        name: "Pocket Updated",
        category: "Power Bank",
        lifecycleStatus: "LAUNCHED",
        bomRmb: 80,
        bomEur: 10
      },
      {
        rowNumber: 3,
        model: "P3",
        name: "New Cable",
        category: "Charging Cable",
        lifecycleStatus: "UNLAUNCHED",
        bomRmb: 20,
        bomEur: 2.5
      }
    ],
    productCountryRrps: [
      {
        rowNumber: 2,
        countryCode: "ES",
        model: "P1",
        rrpLocal: 39.99,
        rrpEur: 39.99,
        currency: "EUR"
      },
      {
        rowNumber: 3,
        countryCode: "ES",
        model: "P3",
        rrpLocal: 19.99,
        rrpEur: 19.99,
        currency: "EUR"
      }
    ],
    logisticsCosts: [
      {
        rowNumber: 2,
        incoterms: "DDP",
        category: "Power Bank",
        logisticsCostRmb: 9,
        logisticsCostEur: 1.2
      }
    ],
    operationalMargins: [
      {
        rowNumber: 2,
        countryCode: "ES",
        retailerName: "Amazon",
        fdName: "EU FD",
        incoterms: "DDP",
        category: "Power Bank",
        kaBuyingMargin: 0.4,
        kaFrontMargin: 0.2,
        kaBackMargin: 0.05,
        fdMargin: 0.1
      }
    ],
    errors: [],
    duplicateKeys: []
  };
}

function currentData(): ReferenceData {
  return {
    countries: [
      {
        id: "country-es",
        code: "ES",
        name: "Spain",
        currency: "EUR",
        vatRate: 0.21,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    exchangeRates: [
      {
        id: "fx-eur",
        currency: "EUR",
        exchangeRateToEur: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    products: [
      {
        id: "product-p1",
        sku: "P1",
        name: "Pocket",
        category: "Power Bank",
        capacity: null,
        lifecycleStatus: "LAUNCHED",
        plannedLaunchAt: null,
        status: "ACTIVE"
      },
      {
        id: "product-p2",
        sku: "P2",
        name: "Old Cable",
        category: "Charging Cable",
        capacity: null,
        lifecycleStatus: "LAUNCHED",
        plannedLaunchAt: null,
        status: "ACTIVE"
      }
    ],
    bomCosts: [
      bom("bom-p1", "product-p1", "P1", "Pocket", 9, 70),
      bom("bom-p2", "product-p2", "P2", "Old Cable", 1.5, 12)
    ],
    productCountryRrps: [
      rrp("rrp-p1", "product-p1", "P1", "Pocket", 29.99),
      rrp("rrp-p2", "product-p2", "P2", "Old Cable", 14.99)
    ],
    logisticsCosts: [
      {
        id: "logistics",
        countryId: "country-es",
        countryCode: "ES",
        category: "Power Bank",
        productSize: "DDP",
        logisticsCost: 1,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      {
        id: "margin",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "Amazon",
        fdName: "EU FD",
        incoterms: "DDP",
        category: "Power Bank",
        kaBuyingMargin: 0.35,
        kaFrontMargin: 0.2,
        kaBackMargin: 0.05,
        fdMargin: 0.1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

function bom(
  id: string,
  productId: string,
  productSku: string,
  productName: string,
  bomCost: number,
  bomCostRmb: number
) {
  return {
    id,
    productId,
    productSku,
    productName,
    bomCost,
    bomCostRmb,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE" as const
  };
}

function rrp(
  id: string,
  productId: string,
  productSku: string,
  productName: string,
  value: number
) {
  return {
    id,
    productId,
    productSku,
    productName,
    countryId: "country-es",
    countryCode: "ES",
    rrpLocal: value,
    rrpEur: value,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE" as const
  };
}

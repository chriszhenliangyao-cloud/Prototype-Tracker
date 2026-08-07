import { describe, expect, test } from "vitest";
import { readWorkbookSheetNames, readWorksheetRows } from "../imports/xlsxLite";
import type { ReferenceData } from "../types";
import { buildMasterDataWorkbookBuffer } from "./masterDataWorkbook";

describe("masterDataWorkbook export", () => {
  test("creates a five-sheet workbook matching the import contract", () => {
    const workbook = buildMasterDataWorkbookBuffer(referenceData());

    expect(readWorkbookSheetNames(workbook)).toEqual([
      "EXR",
      "Bom cost",
      "RRP",
      "Logistic cost",
      "Margin data"
    ]);
    expect(readWorksheetRows(workbook, "EXR")[1]?.cells).toEqual([
      "ES",
      "EUR",
      "1",
      "0.21"
    ]);
    expect(readWorksheetRows(workbook, "Bom cost")[0]?.cells).toEqual([
      "Lifecycle Status",
      "Planned Launch Date",
      "Model",
      "Name",
      "Category",
      "Bom (RMB)",
      "Bom (EUR)"
    ]);
    const bomRow = readWorksheetRows(workbook, "Bom cost")[1]?.cells;
    expect(bomRow?.[0]).toBe("Unlaunched");
    expect(bomRow?.[1] ?? "").toBe("");
    expect(bomRow?.[2]).toBe("NP-70W");
    expect(bomRow?.[3]).toBe("New Charger");
    expect(bomRow?.[4]).toBe("Charger");
    expect(bomRow?.[5] ?? "").toBe("");
    expect(bomRow?.[6]).toBe("12.5");
    expect(readWorksheetRows(workbook, "RRP")[1]?.cells).toEqual([
      "ES",
      "NP-70W",
      "New Charger",
      "39.99",
      "EUR"
    ]);
    expect(readWorksheetRows(workbook, "Margin data")[1]?.cells).toEqual([
      "ES",
      "MediaMarkt",
      "Iberia Distributor",
      "DDP",
      "Charger",
      "0.3",
      "0.1",
      "0.25",
      "0.08"
    ]);
  });

  test("exports the planned launch date as part of product master data", () => {
    const data = referenceData();
    data.products[0] = {
      ...data.products[0],
      plannedLaunchAt: "2026-08-15T00:00:00.000Z"
    };

    const workbook = buildMasterDataWorkbookBuffer(data);

    expect(readWorksheetRows(workbook, "Bom cost")[1]?.cells[1]).toBe(
      "2026-08-15"
    );
  });
});

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
    exchangeRates: [
      {
        id: "rate-eur",
        currency: "EUR",
        exchangeRateToEur: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    products: [
      {
        id: "product-new",
        sku: "NP-70W",
        name: "New Charger",
        category: "Charger",
        capacity: null,
        lifecycleStatus: "UNLAUNCHED",
        status: "ACTIVE"
      }
    ],
    bomCosts: [
      {
        id: "bom-new",
        productId: "product-new",
        productSku: "NP-70W",
        productName: "New Charger",
        bomCost: 12.5,
        bomCostRmb: null,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    logisticsCosts: [
      {
        id: "logistics-es",
        countryId: "country-es",
        countryCode: "ES",
        category: "Charger",
        productSize: "DDP",
        logisticsCost: 0.38,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        id: "rrp-new",
        productId: "product-new",
        productSku: "NP-70W",
        productName: "New Charger",
        countryId: "country-es",
        countryCode: "ES",
        rrpLocal: 39.99,
        rrpEur: 39.99,
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
        retailerName: "MediaMarkt",
        fdName: "Iberia Distributor",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.3,
        kaFrontMargin: 0.1,
        kaBackMargin: 0.25,
        fdMargin: 0.08,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

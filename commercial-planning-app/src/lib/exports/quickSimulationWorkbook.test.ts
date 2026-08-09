import { describe, expect, test } from "vitest";
import { buildRrppSimulationRows } from "../calculatorRows";
import { readWorkbookSheetNames, readWorksheetRows } from "../imports/xlsxLite";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  ReferenceData
} from "../types";
import { buildQuickSimulationWorkbookBuffer } from "./quickSimulationWorkbook";

describe("quickSimulationWorkbook export", () => {
  test("exports temporary simulation rows with formulas", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-es-bg|product-draft": {
        rrppLocal: 34.99,
        promoFrontMargin: 0.31
      }
    });

    const workbook = buildQuickSimulationWorkbookBuffer(rows);
    const worksheetRows = readWorksheetRows(workbook, "Quick Simulation");
    const workbookXml = workbook.toString("utf8");

    expect(readWorkbookSheetNames(workbook)).toEqual(["Quick Simulation"]);
    expect(worksheetRows[0]?.cells.slice(0, 8)).toEqual([
      "Country",
      "Channel / Retailer",
      "FD",
      "Incoterms",
      "Model",
      "Category",
      "Product",
      "Lifecycle"
    ]);
    expect(worksheetRows[1]?.cells.slice(0, 8)).toEqual([
      "ES",
      "BG",
      "Linku",
      "DDP",
      "NP-1",
      "Charger",
      "New Charger",
      "Unlaunched"
    ]);
	    expect(worksheetRows[1]?.cells[21]).toBe("34.99");
	    expect(worksheetRows[1]?.cells[23]).toBe("0.31");
	    expect(worksheetRows[0]?.cells).toContain("Deal Type");
	    expect(worksheetRows[0]?.cells).toContain("Promo FD Margin");
	    expect(worksheetRows[0]?.cells).toContain("Promo Rebate");
    expect(worksheetRows[0]?.cells).toContain("Margin Rebate");
    expect(worksheetRows[0]?.cells).toContain("Total Rebate");
    expect(worksheetRows[0]?.cells.indexOf("Promo Rebate")).toBeLessThan(
      worksheetRows[0]?.cells.indexOf("Margin Rebate") ?? -1
    );
    expect(worksheetRows[0]?.cells.indexOf("Margin Rebate")).toBeLessThan(
      worksheetRows[0]?.cells.indexOf("Total Rebate") ?? -1
    );
    expect(workbookXml).toContain(
      "<f>IFERROR(IF(OR(V2=\"\",I2=\"\",J2=\"\"),\"\",V2*(J2/I2)),\"\")</f>"
    );
	    expect(workbookXml).toContain("<f>IFERROR(N2-AI2,\"\")</f>");
	    expect(workbookXml).toContain("<f>IFERROR(AA2+AB2,\"\")</f>");
	    expect(workbookXml).toContain(
	      "<f>IFERROR((N2*(1-IF(OR(Y2=\"\",Y2=\"Normal\"),O2,Z2))-Q2)-AC2-S2,\"\")</f>"
	    );
	    expect(workbookXml).toContain(
	      "<f>IFERROR(AD2/((N2*(1-IF(OR(Y2=\"\",Y2=\"Normal\"),O2,Z2))-Q2)-AC2),\"\")</f>"
	    );
	  });
});

function referenceData(): ReferenceData {
  return {
    countries: [country()],
    exchangeRates: [],
    products: [product()],
    bomCosts: [bomCost()],
    logisticsCosts: [logisticsCost()],
    productCountryRrps: [productCountryRrp()],
    operationalMargins: [operationalMargin()],
    channelMargins: [],
    fdMargins: []
  };
}

function country(overrides: Partial<CountryOption> = {}): CountryOption {
  return {
    id: "country-es",
    name: "Spain",
    code: "ES",
    vatRate: 0.21,
    currency: "EUR",
    status: "ACTIVE",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function product(overrides: Partial<ProductOption> = {}): ProductOption {
  return {
    id: "product-draft",
    sku: "NP-1",
    name: "New Charger",
    category: "Charger",
    capacity: "Standard",
    lifecycleStatus: "UNLAUNCHED",
    status: "ACTIVE",
    ...overrides
  };
}

function bomCost(overrides: Partial<BomCostOption> = {}): BomCostOption {
  return {
    id: "bom-draft",
    productId: "product-draft",
    productSku: "NP-1",
    productName: "New Charger",
    bomCost: 12,
    bomCostRmb: null,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ...overrides
  };
}

function logisticsCost(
  overrides: Partial<LogisticsCostOption> = {}
): LogisticsCostOption {
  return {
    id: "logistics-es",
    countryId: "country-es",
    countryCode: "ES",
    category: "Charger",
    productSize: "Standard",
    logisticsCost: 0.9,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ...overrides
  };
}

function productCountryRrp(
  overrides: Partial<ProductCountryRrpOption> = {}
): ProductCountryRrpOption {
  return {
    id: "rrp-es-draft",
    productId: "product-draft",
    productSku: "NP-1",
    productName: "New Charger",
    countryId: "country-es",
    countryCode: "ES",
    rrpLocal: 39.99,
    rrpEur: 39.99,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ...overrides
  };
}

function operationalMargin(
  overrides: Partial<OperationalMarginOption> = {}
): OperationalMarginOption {
  return {
    id: "margin-es-bg",
    countryId: "country-es",
    countryCode: "ES",
    retailerName: "BG",
    fdName: "Linku",
    incoterms: "DDP",
    category: "Charger",
    kaBuyingMargin: 0.35,
    kaFrontMargin: 0.37,
    kaBackMargin: 0,
    fdMargin: 0.15,
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ...overrides
  };
}

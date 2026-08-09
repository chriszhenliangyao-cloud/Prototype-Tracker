import { describe, expect, test } from "vitest";
import { buildRrppSimulationRows } from "../calculatorRows";
import { readWorksheetRows } from "../imports/xlsxLite";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  ReferenceData
} from "../types";
import { buildValueChainWorkbookBuffer } from "./valueChainWorkbook";

describe("valueChainWorkbook export", () => {
  test("exports value-chain rows with editable inputs and Excel formulas", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 39.99,
        promoFrontMargin: 0.35
      }
    });

    const workbook = buildValueChainWorkbookBuffer(rows);
    const worksheetRows = readWorksheetRows(workbook, "Value Chain");
    const workbookXml = workbook.toString("utf8");

    expect(worksheetRows[0]?.cells).toEqual([
      "Country",
      "Channel / Retailer",
      "FD",
      "Incoterms",
      "Model",
      "Category",
      "Product",
      "Lifecycle",
      "RRP Local",
      "RRP EUR",
      "VAT",
      "After VAT",
      "KA Buying Margin",
      "Landing Price",
      "FD Margin",
      "Net Price",
      "Transport",
      "Shipping Price",
      "BOM",
      "GP",
      "GP%",
      "Sim RRPP Local",
	      "Sim RRPP EUR",
	      "Promo Front Margin",
	      "Deal Type",
	      "Promo FD Margin",
	      "Promo Rebate",
	      "Margin Rebate",
	      "Total Rebate",
      "Sim NP",
      "Sim NP%",
      "KA Front Margin",
      "After Front Margin",
      "KA Back Margin",
      "Actual Net Landing"
    ]);
    expect(worksheetRows[1]?.cells.slice(0, 11)).toEqual([
      "FR",
      "Boulanger",
      "BBC",
      "DDP",
      "P41L-P1",
      "Power bank",
      "PowerPaw 10K",
      "Launched",
      "44.99",
      "44.99",
      "0.2"
	    ]);
	    expect(worksheetRows[1]?.cells[21]).toBe("39.99");
	    expect(worksheetRows[1]?.cells[23]).toBe("0.35");
	    expect(worksheetRows[1]?.cells[24]).toBe("Normal");
	    expect(worksheetRows[1]?.cells[25]).toBe("0.2");
	    expect(workbookXml).toContain("<f>IFERROR(J2/(1+K2),\"\")</f>");
    expect(workbookXml).toContain("<f>IFERROR(L2*(1-M2),\"\")</f>");
    expect(workbookXml).toContain("<f>IFERROR(N2*(1-O2),\"\")</f>");
    expect(workbookXml).toContain("<f>IFERROR(P2-Q2,\"\")</f>");
    expect(workbookXml).toContain("<f>IFERROR(T2/R2,\"\")</f>");
	    expect(workbookXml).toContain("<f>IFERROR(IF(OR(V2=\"\",I2=\"\",J2=\"\"),\"\",V2*(J2/I2)),\"\")</f>");
	    expect(workbookXml).toContain(
	      "<f>IFERROR(MAX(0,L2*(1-AF2)-W2/(1+K2)*(1-X2)),\"\")</f>"
	    );
	    expect(workbookXml).toContain("<f>IFERROR(N2-AI2,\"\")</f>");
	    expect(workbookXml).toContain("<f>IFERROR(AA2+AB2,\"\")</f>");
	    expect(workbookXml).toContain(
	      "<f>IFERROR((N2*(1-IF(OR(Y2=\"\",Y2=\"Normal\"),O2,Z2))-Q2)-AC2-S2,\"\")</f>"
	    );
	    expect(workbookXml).toContain(
	      "<f>IFERROR(AD2/((N2*(1-IF(OR(Y2=\"\",Y2=\"Normal\"),O2,Z2))-Q2)-AC2),\"\")</f>"
	    );
	    expect(workbookXml).toContain("<f>IFERROR(L2*(1-AF2),\"\")</f>");
	    expect(workbookXml).toContain("<f>IFERROR(AG2*(1-AH2),\"\")</f>");
	    expect(workbookXml).toContain('<c r="A1" s="1"');
	    expect(workbookXml).toContain('<c r="I1" s="2"');
	    expect(workbookXml).toContain('<c r="V1" s="3"');
	    expect(workbookXml).toContain('<c r="AF1" s="4"');
	    expect(workbookXml).toContain('<c r="I2" s="19"><v>44.99</v></c>');
	    expect(workbookXml).toContain('<c r="M2" s="20"><v>0.42</v></c>');
	    expect(workbookXml).toContain('<c r="V2" s="12"><v>39.99</v></c>');
	    expect(workbookXml).toContain('<c r="X2" s="13"><v>0.35</v></c>');
	    expect(workbookXml).toContain('<c r="Z2" s="13"><v>0.2</v></c>');
	    expect(workbookXml).toContain('<c r="AF2" s="16"><v>0.42</v></c>');
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
    id: "country-fr",
    name: "France",
    code: "FR",
    vatRate: 0.2,
    currency: "EUR",
    status: "ACTIVE",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function product(overrides: Partial<ProductOption> = {}): ProductOption {
  return {
    id: "product-powerpaw",
    sku: "P41L-P1",
    name: "PowerPaw 10K",
    category: "Power bank",
    capacity: "10000mAh",
    lifecycleStatus: "LAUNCHED",
    status: "ACTIVE",
    ...overrides
  };
}

function bomCost(overrides: Partial<BomCostOption> = {}): BomCostOption {
  return {
    id: "bom-powerpaw",
    productId: "product-powerpaw",
    productSku: "P41L-P1",
    productName: "PowerPaw 10K",
    bomCost: 18.08,
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
    id: "logistics-fr",
    countryId: "country-fr",
    countryCode: "FR",
    category: "Power bank",
    productSize: "10000mAh",
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
    status: "ACTIVE",
    ...overrides
  };
}

function operationalMargin(
  overrides: Partial<OperationalMarginOption> = {}
): OperationalMarginOption {
  return {
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
    status: "ACTIVE",
    ...overrides
  };
}

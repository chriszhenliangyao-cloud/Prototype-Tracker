import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  ReferenceData
} from "@/lib/types";
import { NormalCalculator } from "./NormalCalculator";

vi.mock("next/navigation", () => ({
  usePathname: () => "/commercial/value-chain"
}));

describe("NormalCalculator", () => {
  test("renders an Excel export action for the current value-chain view", () => {
    const html = renderToStaticMarkup(
      <NormalCalculator data={referenceData()} userEmail="planner@example.test" />
    );

    expect(html).toContain("Export Excel");
    expect(html).toContain("Download the current rows with Excel formulas");
  });
});

function referenceData(): ReferenceData {
  return {
    countries: [country()],
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
    bomCost: 8.85,
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
    id: "rrp-es-powerpaw",
    productId: "product-powerpaw",
    productSku: "P41L-P1",
    productName: "PowerPaw 10K",
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
    category: "Power bank",
    kaBuyingMargin: 0.32,
    kaFrontMargin: 0.37,
    kaBackMargin: 0,
    fdMargin: 0.15,
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ...overrides
  };
}

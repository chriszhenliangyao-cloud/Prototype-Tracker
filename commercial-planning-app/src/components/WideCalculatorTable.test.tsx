import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { buildPromotionRows, buildRrppSimulationRows } from "@/lib/calculatorRows";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  ReferenceData
} from "@/lib/types";
import { NormalWideTable, PromotionWideTable } from "./WideCalculatorTable";

describe("NormalWideTable simulation mode", () => {
  test("renders simplified unified flow with standard KA front margin only", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-es-bg|product-new": {
        rrppLocal: 39.99,
        rrppEur: 39.99,
        actualFrontMargin: 0.31
      } as Record<string, number>
    });

    const html = renderToStaticMarkup(
      <NormalWideTable
        mode="simulation"
        rows={rows}
        onRrppInputChange={() => undefined}
      />
    );

    expect(html).not.toContain("KA Buying Margin");
    expect(html).not.toContain(">Landing<");
    expect(html).toContain("KA Front Margin");
    expect(html).toContain("standard KA");
    expect(html).not.toContain("actual front margin");
    expect(html).not.toContain('aria-label="V111 BG actual front margin percent"');
    expect(html).not.toContain('value="31"');
    expect(html).toContain("base 37.00%");
    expect(html).toContain("standard FD");
    expect(html).toContain("RRPP floor simulation");
  });

  test("renders B2B and EOL FD margin controls in simulation rows", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-es-bg|product-new": {
        rrppLocal: 39.99,
        rrppEur: 39.99,
        dealType: "B2B_DEAL",
        promoFdMargin: 0.08
      }
    });

    const html = renderToStaticMarkup(
      <NormalWideTable
        mode="simulation"
        rows={rows}
        onRrppInputChange={() => undefined}
      />
    );

    expect(html).toContain("Deal / FD");
    expect(html).toContain('aria-label="V111 BG simulation deal type"');
    expect(html).toContain('<option value="B2B_DEAL" selected="">B2B</option>');
    expect(html).toContain('<option value="EOL_DEAL">EOL</option>');
    expect(html).toContain('aria-label="V111 BG simulation FD margin percent"');
    expect(html).toContain('value="8"');
    expect(html).toContain("Promo FD");
    expect(html).toContain("base FD 15.00%");
  });

  test("renders one total rebate column with promo and margin details", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-es-bg|product-new": {
        rrppLocal: 39.99,
        rrppEur: 39.99
      } as Record<string, number>
    });

    const html = renderToStaticMarkup(
      <NormalWideTable
        mode="simulation"
        rows={rows}
        onRrppInputChange={() => undefined}
      />
    );

    expect(html).not.toMatch(/<th[^>]*>Promo Rebate<\/th>/);
    expect(html).not.toMatch(/<th[^>]*>Margin Rebate<\/th>/);
    expect(html).toContain("Margin Rebate");
    expect(html).toContain("Total Rebate");
    expect(html).toContain("Promo Rebate");
    expect(html).toMatch(/Total Rebate[\s\S]*Sim NP/);
  });

  test("renders optional manual order controls as the first simulation column", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-es-bg|product-new": {
        rrppLocal: 39.99,
        rrppEur: 39.99
      } as Record<string, number>
    });

    const html = renderToStaticMarkup(
      <NormalWideTable
        mode="simulation"
        rows={rows}
        onRrppInputChange={() => undefined}
        renderSimulationOrderControls={() => <span>Move controls</span>}
      />
    );

    expect(html).toMatch(/Order[\s\S]*Scope[\s\S]*Unified preset/);
    expect(html).toContain("Move controls");
  });

  test("applies optional manual ordering drag attributes to simulation rows", () => {
    const rows = buildRrppSimulationRows(referenceData(), {
      "margin-es-bg|product-new": {
        rrppLocal: 39.99,
        rrppEur: 39.99
      } as Record<string, number>
    });

    const html = renderToStaticMarkup(
      <NormalWideTable
        mode="simulation"
        rows={rows}
        onRrppInputChange={() => undefined}
        renderSimulationOrderControls={() => <span>Move controls</span>}
        getSimulationRowAttributes={() => ({
          className: "drag-preview-row",
          draggable: true
        })}
      />
    );

    expect(html).toContain('<tr class="drag-preview-row" draggable="true">');
  });
});

describe("PromotionWideTable planning mode", () => {
  test("renders Promotion Name as an editable scope input", () => {
    const rows = buildPromotionRows(referenceData(), {
      "margin-es-bg|product-new": {
        promoRrpLocal: 39.99,
        promoRrpEur: 39.99,
        promotionName: "Summer push"
      } as Record<string, string | number>
    });

    const html = renderToStaticMarkup(
      <PromotionWideTable
        rows={rows}
        onPromoInputChange={() => undefined}
      />
    );

    expect(html).toContain("Promotion Name");
    expect(html).toContain('placeholder="Promotion name"');
    expect(html).toContain('value="Summer push"');
    expect(html).toContain('aria-label="V111 BG promo front margin percent"');
    expect(html).toContain('value="37"');
    expect(html).toContain('data-margin-input="percent"');
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
    id: "product-new",
    sku: "V111",
    name: "Magnetic Car charger",
    category: "Charger",
    capacity: "Standard",
    lifecycleStatus: "UNLAUNCHED",
    status: "ACTIVE",
    ...overrides
  };
}

function bomCost(overrides: Partial<BomCostOption> = {}): BomCostOption {
  return {
    id: "bom-new",
    productId: "product-new",
    productSku: "V111",
    productName: "Magnetic Car charger",
    bomCost: 10.99,
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
    id: "rrp-es-new",
    productId: "product-new",
    productSku: "V111",
    productName: "Magnetic Car charger",
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

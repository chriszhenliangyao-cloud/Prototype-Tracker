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
import { ManualOrderControls } from "./QuickNewProductSimulation";
import { SimulationCalculator } from "./SimulationCalculator";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

describe("SimulationCalculator", () => {
  test("keeps the formal unlaunched product list hidden by default", () => {
    const html = renderToStaticMarkup(
      <SimulationCalculator
        data={referenceData()}
        canAddQuickSimulationToFormalList={true}
        userEmail="planner@example.test"
      />
    );

    expect(html).toContain("Quick New Product Simulation");
    expect(html).toContain("Single product");
    expect(html).toContain("Product set");
    expect(html).toContain("Channel / Retailer");
    expect(html).toContain("Export Excel");
    expect(html).toContain('data-layout="quick-single-compact"');
    expect(html).toContain("Preview status");
    expect(html).toContain("Waiting for required inputs");
    expect(html).toContain("Show unreleased product list");
    expect(html).not.toContain("Unified preset KA buying margin flow");
    expect(html).not.toContain("RRPP floor simulation");
  });

  test("uses compact arrow controls for product set order fine tuning", () => {
    const html = renderToStaticMarkup(
      <ManualOrderControls
        isDragging={false}
        isDropTarget={false}
        nudgeFeedbackDirection="up"
        rowCount={3}
        rowIndex={1}
        rowLabel="ES BG Product"
        onDragEnd={() => undefined}
        onDragStart={() => undefined}
        onMoveDown={() => undefined}
        onMoveUp={() => undefined}
      />
    );

    expect(html).toContain("Move ES BG Product up");
    expect(html).toContain("Move ES BG Product down");
    expect(html).toContain('data-order-arrow="up"');
    expect(html).toContain('data-order-arrow="down"');
    expect(html).toContain("h-3 w-3");
    expect(html).toContain('data-nudge-feedback="up"');
    expect(html).not.toContain(">Up<");
    expect(html).not.toContain(">Down<");
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

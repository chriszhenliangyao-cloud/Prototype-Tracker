import { describe, expect, test } from "vitest";
import {
  buildCalculatorFilterOptions,
  normalizeCalculatorFilters,
  setCalculatorFilterValue,
  synchronizeProductIdentityFilters
} from "./calculatorFilterOptions";
import type { CalculatorFilters, NormalTableRow } from "./calculatorRows";

describe("calculator filter options", () => {
  test("limits channels and FDs to the selected country", () => {
    const filters: CalculatorFilters = { countryCode: "FR" };
    const options = buildCalculatorFilterOptions(rows(), filters);

    expect(options.channelName).toEqual(["Boulanger", "Fnac Darty"]);
    expect(options.fdName).toEqual(["BBC", "France Distributor"]);
    expect(options.channelName).not.toContain("MediaMarkt");
    expect(options.fdName).not.toContain("Iberia Distributor");
  });

  test("limits products and models to the selected category", () => {
    const filters: CalculatorFilters = { category: "Power Bank" };
    const options = buildCalculatorFilterOptions(rows(), filters);

    expect(options.productName).toEqual(["MagPro Slim 5K", "PowerPaw 20K"]);
    expect(options.model).toEqual(["P72-P1", "P75-P1"]);
    expect(options.productName).not.toContain("Cable Pro");
  });

  test("combines country and category ownership for product options", () => {
    const filters: CalculatorFilters = {
      countryCode: "FR",
      category: "Cable"
    };
    const options = buildCalculatorFilterOptions(rows(), filters);

    expect(options.productName).toEqual(["Cable Pro"]);
    expect(options.channelName).toEqual(["Boulanger"]);
    expect(options.fdName).toEqual(["BBC"]);
  });

  test("clears stale child filters while preserving country and category", () => {
    const normalized = normalizeCalculatorFilters(rows(), {
      countryCode: "FR",
      category: "Cable",
      channelName: "MediaMarkt",
      fdName: "Iberia Distributor",
      productName: "Charger Max",
      kaBuyingMargin: 0.4
    });

    expect(normalized).toEqual({
      countryCode: ["FR"],
      category: ["Cable"]
    });
  });

  test("keeps a newly selected country and drops incompatible remembered values", () => {
    const updatedFilters = setCalculatorFilterValue(
      rows(),
      {
        countryCode: "ES",
        channelName: "MediaMarkt",
        fdName: "Iberia Distributor",
        category: "Charger",
        productName: "Charger Max"
      },
      "countryCode",
      "FR"
    );

    expect(updatedFilters).toEqual({ countryCode: ["FR"] });
  });

  test("supports multi-select parent filters", () => {
    const options = buildCalculatorFilterOptions(rows(), {
      countryCode: ["FR", "ES"]
    });

    expect(options.channelName).toEqual([
      "Boulanger",
      "Fnac Darty",
      "MediaMarkt"
    ]);
    expect(options.fdName).toEqual([
      "BBC",
      "France Distributor",
      "Iberia Distributor"
    ]);
  });

  test("normalizes multi-select values and drops invalid selections", () => {
    const normalized = normalizeCalculatorFilters(rows(), {
      countryCode: ["FR", "DE"],
      category: ["Cable", "Unknown"],
      channelName: ["Boulanger", "MediaMarkt"],
      fdName: ["BBC", "Iberia Distributor"]
    });

    expect(normalized).toEqual({
      countryCode: ["FR"],
      category: ["Cable"],
      channelName: ["Boulanger"],
      fdName: ["BBC"]
    });
  });

  test("matches Product Name when Model is selected", () => {
    expect(
      synchronizeProductIdentityFilters(
        rows(),
        { model: ["P75-P1"] },
        "model"
      )
    ).toEqual({
      model: ["P75-P1"],
      productName: ["MagPro Slim 5K"]
    });
  });

  test("matches Model when Product Name is selected", () => {
    expect(
      synchronizeProductIdentityFilters(
        rows(),
        { productName: ["MagPro Slim 5K"] },
        "productName"
      )
    ).toEqual({
      productName: ["MagPro Slim 5K"],
      model: ["P75-P1"]
    });
  });
});

function rows(): NormalTableRow[] {
  return [
    row({
      key: "fr-boulanger-cable",
      countryCode: "FR",
      channelName: "Boulanger",
      retailerName: "Boulanger",
      fdName: "BBC",
      model: "C12-P1",
      category: "Cable",
      productName: "Cable Pro",
      kaBuyingMargin: 0.3
    }),
    row({
      key: "fr-fnac-power-bank",
      countryCode: "FR",
      channelName: "Fnac Darty",
      retailerName: "Fnac Darty",
      fdName: "France Distributor",
      model: "P72-P1",
      category: "Power Bank",
      productName: "PowerPaw 20K",
      kaBuyingMargin: 0.32
    }),
    row({
      key: "es-mediamarkt-charger",
      countryCode: "ES",
      channelName: "MediaMarkt",
      retailerName: "MediaMarkt",
      fdName: "Iberia Distributor",
      model: "C65-P1",
      category: "Charger",
      productName: "Charger Max",
      kaBuyingMargin: 0.4
    }),
    row({
      key: "fr-boulanger-magpro",
      countryCode: "FR",
      channelName: "Boulanger",
      retailerName: "Boulanger",
      fdName: "BBC",
      model: "P75-P1",
      category: "Power Bank",
      productName: "MagPro Slim 5K",
      kaBuyingMargin: 0.3
    })
  ];
}

function row(overrides: Partial<NormalTableRow>): NormalTableRow {
  return {
    key: "row",
    countryCode: "FR",
    channelName: "Boulanger",
    retailerName: "Boulanger",
    fdName: "BBC",
    incoterms: "DDP",
    model: "P72-P1",
    category: "Power Bank",
    productName: "PowerPaw 20K",
    productLifecycleStatus: "LAUNCHED",
    plannedLaunchAt: null,
    rrpLocal: 59.99,
    rrpEur: 59.99,
    currency: "EUR",
    vatRate: 0.2,
    kaBuyingMargin: 0.3,
    kaFrontMargin: 0.25,
    kaBackMargin: 0.08,
    fdMargin: 0.1,
    logisticsCost: 1.2,
    bomCost: 20,
    missingFields: [],
    calculation: null,
    ...overrides
  };
}

import { describe, expect, test } from "vitest";
import {
  buildQuickProductSetSimulationPreview,
  buildQuickSimulationPreview,
  buildSuggestedSku,
  convertEurToLocalCurrency,
  inferCurrencyExchangeRateToEur,
  inferExchangeRateToEur,
  applyManualPreviewRowOrder,
  dropManualPreviewRowOrder,
  mergeQuickSimulationInputsByRow,
  moveManualPreviewRowOrder,
  uniqueSuggestedSku
} from "./quickSimulation";
import { buildRrppSimulationRows } from "./calculatorRows";
import type { ReferenceData } from "./types";

describe("quickSimulation", () => {
  test("keeps manual preview row order while appending new rows", () => {
    const rows = [
      previewRow("row-a"),
      previewRow("row-b"),
      previewRow("row-c"),
      previewRow("row-d")
    ];

    const ordered = applyManualPreviewRowOrder(rows, [
      "row-c",
      "missing-row",
      "row-a"
    ]);

    expect(ordered.map((row) => row.key)).toEqual([
      "row-c",
      "row-a",
      "row-b",
      "row-d"
    ]);
  });

  test("moves manual preview rows up and down from current display order", () => {
    const rows = [previewRow("row-a"), previewRow("row-b"), previewRow("row-c")];

    expect(
      moveManualPreviewRowOrder(rows, [], "row-c", "up")
    ).toEqual(["row-a", "row-c", "row-b"]);
    expect(
      moveManualPreviewRowOrder(rows, ["row-c", "row-a", "row-b"], "row-c", "down")
    ).toEqual(["row-a", "row-c", "row-b"]);
  });

  test("drops a dragged preview row before the target row", () => {
    const rows = [
      previewRow("row-a"),
      previewRow("row-b"),
      previewRow("row-c"),
      previewRow("row-d")
    ];

    expect(
      dropManualPreviewRowOrder(rows, [], "row-d", "row-b")
    ).toEqual(["row-a", "row-d", "row-b", "row-c"]);
  });

  test("builds a temporary unlaunched product preview without mutating master data", () => {
    const data = referenceData();
    const preview = buildQuickSimulationPreview(data, {
      countryCodes: ["PL"],
      category: "Charger",
      productName: "New Charger 70W",
      rrpEur: 39.8,
      bomRmb: 97.5
    });

    expect(preview?.sku).toBe("NP-NEW-CHARGER-70W");
    expect(preview?.rrpEur).toBe(39.8);
    expect(preview?.bomEur).toBe(12.5);
    expect(preview?.data.products).toEqual([
      expect.objectContaining({
        name: "New Charger 70W",
        lifecycleStatus: "UNLAUNCHED"
      })
    ]);
    expect(preview?.data.productCountryRrps[0]).toEqual(
      expect.objectContaining({
        countryCode: "PL",
        rrpLocal: 199,
        rrpEur: 39.8,
        currency: "PLN"
      })
    );
    expect(preview?.data.operationalMargins).toHaveLength(2);
    expect(data.products).toHaveLength(1);
  });

  test("builds quick preview for multiple selected countries", () => {
    const preview = buildQuickSimulationPreview(referenceData(), {
      countryCodes: ["ES", "PL"],
      category: "Charger",
      productName: "New Charger 70W",
      rrpEur: 29.99,
      bomEur: 10
    });

    expect(preview?.data.productCountryRrps).toEqual([
      expect.objectContaining({
        countryCode: "ES",
        rrpLocal: 29.99,
        rrpEur: 29.99
      }),
      expect.objectContaining({
        countryCode: "PL",
        rrpLocal: 149.95,
        rrpEur: 29.99
      })
    ]);
  });

  test("builds product set previews across selected countries and all channels by default", () => {
    const preview = buildQuickProductSetSimulationPreview(referenceData(), {
      countryCodes: ["ES", "PL"],
      products: [
        {
          id: "draft-1",
          category: "Charger",
          productName: "New Charger 70W",
          rrpEur: 39.99,
          bomEur: 10
        },
        {
          id: "draft-2",
          category: "Charger",
          productName: "New Charger 140W",
          rrpEur: 59.99,
          bomEur: 14
        }
      ]
    });

    expect(preview?.data.products).toHaveLength(2);
    expect(preview?.data.productCountryRrps).toHaveLength(4);
    expect(preview?.data.operationalMargins.map((margin) => margin.id)).toEqual([
      "margin-es",
      "margin-es-direct",
      "margin-pl",
      "margin-pl-direct"
    ]);
  });

  test("filters product set previews to selected country-channel keys", () => {
    const preview = buildQuickProductSetSimulationPreview(referenceData(), {
      countryCodes: ["ES", "PL"],
      channelKeys: ["PL||MEX(Direct)"],
      products: [
        {
          id: "draft-1",
          category: "Charger",
          productName: "New Charger 70W",
          rrpEur: 39.99,
          bomEur: 10
        },
        {
          id: "draft-2",
          category: "Charger",
          productName: "New Charger 140W",
          rrpEur: 59.99,
          bomEur: 14
        }
      ]
    });

    expect(preview?.data.operationalMargins).toEqual([
      expect.objectContaining({
        countryCode: "PL",
        retailerName: "MEX(Direct)"
      })
    ]);

    const rows = buildRrppSimulationRows(
      preview!.data,
      preview!.inputsByRow,
      { countryCode: ["ES", "PL"] },
      { lifecycle: "UNLAUNCHED" }
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.countryCode))).toEqual(new Set(["PL"]));
    expect(new Set(rows.map((row) => row.channelName))).toEqual(
      new Set(["MEX(Direct)"])
    );
    expect(new Set(rows.map((row) => row.productName))).toEqual(
      new Set(["New Charger 70W", "New Charger 140W"])
    );
  });

  test("seeds product set rows from product-level simulation RRPP targets", () => {
    const preview = buildQuickProductSetSimulationPreview(referenceData(), {
      countryCodes: ["PL"],
      products: [
        {
          id: "draft-1",
          category: "Charger",
          productName: "New Charger 70W",
          rrpEur: 39.99,
          simRrppEur: 34.99,
          bomEur: 10
        },
        {
          id: "draft-2",
          category: "Charger",
          productName: "New Charger 140W",
          rrpEur: 59.99,
          bomEur: 14
        }
      ]
    });

    expect(
      preview?.inputsByRow["margin-pl|quick-simulation-product-set-1"]
    ).toMatchObject({
      rrppLocal: 174.95,
      rrppEur: 34.99
    });
    expect(
      preview?.inputsByRow["margin-pl|quick-simulation-product-set-2"]
    ).toMatchObject({
      rrppLocal: 299.95,
      rrppEur: 59.99
    });
  });

  test("does not apply a pending product-set bulk RRPP before Apply is clicked", () => {
    const preview = buildQuickProductSetSimulationPreview(referenceData(), {
      countryCodes: ["PL"],
      products: [
        {
          id: "draft-1",
          category: "Charger",
          productName: "New Charger 70W",
          rrpEur: 39.99,
          bomEur: 10
        },
        {
          id: "draft-2",
          category: "Charger",
          productName: "New Charger 140W",
          rrpEur: 59.99,
          bomEur: 14
        }
      ]
    });

    const inputs = mergeQuickSimulationInputsByRow({
      data: preview!.data,
      baseInputsByRow: preview!.inputsByRow,
      manualInputsByRow: {},
      bulkRrppEur: 34.99,
      applyBulkRrppEur: false
    });

    expect(inputs["margin-pl|quick-simulation-product-set-1"]).toMatchObject({
      rrppLocal: 199.95,
      rrppEur: 39.99
    });
    expect(inputs["margin-pl|quick-simulation-product-set-2"]).toMatchObject({
      rrppLocal: 299.95,
      rrppEur: 59.99
    });
  });

  test("applies bulk RRPP to every preview row when bulk application is enabled", () => {
    const preview = buildQuickProductSetSimulationPreview(referenceData(), {
      countryCodes: ["PL"],
      products: [
        {
          id: "draft-1",
          category: "Charger",
          productName: "New Charger 70W",
          rrpEur: 39.99,
          bomEur: 10
        },
        {
          id: "draft-2",
          category: "Charger",
          productName: "New Charger 140W",
          rrpEur: 59.99,
          bomEur: 14
        }
      ]
    });

    const inputs = mergeQuickSimulationInputsByRow({
      data: preview!.data,
      baseInputsByRow: preview!.inputsByRow,
      manualInputsByRow: {},
      bulkRrppEur: 34.99,
      applyBulkRrppEur: true
    });

    expect(inputs["margin-pl|quick-simulation-product-set-1"]).toMatchObject({
      rrppLocal: 174.95,
      rrppEur: undefined
    });
    expect(inputs["margin-pl|quick-simulation-product-set-2"]).toMatchObject({
      rrppLocal: 174.95,
      rrppEur: undefined
    });
  });

  test("seeds each quick simulation row with the default KA buying margin", () => {
    const preview = buildQuickSimulationPreview(referenceData(), {
      countryCodes: ["ES"],
      category: "Charger",
      productName: "New Charger 70W",
      rrpEur: 29.99,
      bomEur: 10
    });

    expect(preview?.inputsByRow["margin-es|quick-simulation-product"]).toMatchObject({
      kaBuyingMargin: 0.35,
      rrppLocal: 29.99,
      rrppEur: 29.99
    });
  });

  test("suggests unique SKU values for generated model codes", () => {
    expect(buildSuggestedSku("Desktop Station 300W")).toBe(
      "NP-DESKTOP-STATION-300W"
    );
    expect(uniqueSuggestedSku("NP-DESKTOP", ["np-desktop", "NP-DESKTOP-2"])).toBe(
      "NP-DESKTOP-3"
    );
  });

  test("infers non-EUR exchange rate from existing country RRP rows", () => {
    expect(inferExchangeRateToEur(referenceData(), "PL")).toBe(5);
    expect(inferExchangeRateToEur(referenceData(), "ES")).toBe(1);
    expect(inferCurrencyExchangeRateToEur(referenceData(), "RMB")).toBe(7.8);
  });

  test("converts a EUR quick simulation RRPP target to each country's local currency", () => {
    const baseData = referenceData();
    const data = {
      ...baseData,
      exchangeRates: [
        ...(baseData.exchangeRates ?? []),
        {
          id: "rate-pln",
          currency: "PLN",
          exchangeRateToEur: 4.3,
          effectiveDate: "2026-01-01T00:00:00.000Z",
          status: "ACTIVE" as const
        }
      ]
    };

    expect(convertEurToLocalCurrency(data, "ES", 64.99)).toBe(64.99);
    expect(convertEurToLocalCurrency(data, "PL", 64.99)).toBe(279.46);
  });
});

function previewRow(key: string) {
  return { key };
}

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
      },
      {
        id: "country-pl",
        name: "Poland",
        code: "PL",
        vatRate: 0.23,
        currency: "PLN",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    exchangeRates: [
      {
        id: "rate-rmb",
        currency: "RMB",
        exchangeRateToEur: 7.8,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    products: [
      {
        id: "product-existing",
        sku: "EXISTING",
        name: "Existing Charger",
        category: "Charger",
        capacity: null,
        lifecycleStatus: "LAUNCHED",
        status: "ACTIVE"
      }
    ],
    bomCosts: [],
    logisticsCosts: [
      {
        id: "logistics-pl",
        countryId: "country-pl",
        countryCode: "PL",
        category: "Charger",
        productSize: "DDP",
        logisticsCost: 0.3,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        id: "rrp-existing",
        productId: "product-existing",
        productSku: "EXISTING",
        productName: "Existing Charger",
        countryId: "country-pl",
        countryCode: "PL",
        rrpLocal: 100,
        rrpEur: 20,
        currency: "PLN",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      {
        id: "margin-es",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "BG",
        fdName: "Distributor",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.35,
        kaFrontMargin: 0.1,
        kaBackMargin: 0.2,
        fdMargin: 0.08,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "margin-es-direct",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "BG(Direct)",
        fdName: "Distributor",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.35,
        kaFrontMargin: 0.1,
        kaBackMargin: 0.2,
        fdMargin: 0.08,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "margin-pl",
        countryId: "country-pl",
        countryCode: "PL",
        retailerName: "MEX",
        fdName: "Distributor",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.35,
        kaFrontMargin: 0.1,
        kaBackMargin: 0.2,
        fdMargin: 0.08,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "margin-pl-direct",
        countryId: "country-pl",
        countryCode: "PL",
        retailerName: "MEX(Direct)",
        fdName: "Distributor",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.35,
        kaFrontMargin: 0.1,
        kaBackMargin: 0.2,
        fdMargin: 0.08,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

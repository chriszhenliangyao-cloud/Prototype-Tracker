import { describe, expect, test } from "vitest";
import {
  buildNormalRows,
  buildPromotionRows,
  buildRrppSimulationRows
} from "./calculatorRows";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  ReferenceData
} from "./types";

describe("calculator row assembly", () => {
  test("builds one normal row from complete fixture", () => {
    const rows = buildNormalRows(referenceData());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "margin-fr-boulanger|product-powerpaw",
      countryCode: "FR",
      channelName: "Boulanger",
      retailerName: "Boulanger",
      fdName: "BBC",
      incoterms: "DDP",
      model: "P41L-P1",
      category: "Power bank",
      productName: "PowerPaw 10K",
      rrpLocal: 44.99,
      rrpEur: 44.99,
      currency: "EUR",
      vatRate: 0.2,
      kaBuyingMargin: 0.42,
      kaFrontMargin: 0.42,
      kaBackMargin: 0,
      fdMargin: 0.2,
      logisticsCost: 0.9,
      bomCost: 18.08,
      missingFields: []
    });
    expect(rows[0]?.calculation?.landingPrice).toBeCloseTo(21.75, 2);
  });

  test("selects latest active RRP, BOM, and logistics records from shuffled matches", () => {
    const rows = buildNormalRows(
      referenceData({
        productCountryRrps: [
          productCountryRrp({
            id: "rrp-2026-01",
            rrpLocal: 30,
            rrpEur: 30,
            effectiveDate: "2026-01-01T00:00:00.000Z"
          }),
          productCountryRrp({
            id: "rrp-2026-02",
            rrpLocal: 55,
            rrpEur: 55,
            effectiveDate: "2026-02-01T00:00:00.000Z"
          }),
          productCountryRrp({
            id: "rrp-2026-03-inactive",
            rrpLocal: 75,
            rrpEur: 75,
            effectiveDate: "2026-03-01T00:00:00.000Z",
            status: "INACTIVE"
          })
        ],
        bomCosts: [
          bomCost({
            id: "bom-2026-01",
            bomCost: 11,
            effectiveDate: "2026-01-01T00:00:00.000Z"
          }),
          bomCost({
            id: "bom-2026-02",
            bomCost: 22,
            effectiveDate: "2026-02-01T00:00:00.000Z"
          })
        ],
        logisticsCosts: [
          logisticsCost({
            id: "logistics-2026-01",
            logisticsCost: 1.1,
            effectiveDate: "2026-01-01T00:00:00.000Z"
          }),
          logisticsCost({
            id: "logistics-2026-02",
            logisticsCost: 2.2,
            effectiveDate: "2026-02-01T00:00:00.000Z"
          })
        ]
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rrpLocal: 55,
      rrpEur: 55,
      bomCost: 22,
      logisticsCost: 2.2,
      missingFields: []
    });
    expect(rows[0]?.calculation?.rrp).toBe(55);
    expect(rows[0]?.calculation?.bomCost).toBe(22);
    expect(rows[0]?.calculation?.logisticsCost).toBe(2.2);
  });

  test("uses id as a stable tie-breaker when active records share an effective date", () => {
    const rows = buildNormalRows(
      referenceData({
        productCountryRrps: [
          productCountryRrp({
            id: "rrp-b",
            rrpLocal: 60,
            rrpEur: 60
          }),
          productCountryRrp({
            id: "rrp-a",
            rrpLocal: 50,
            rrpEur: 50
          })
        ],
        bomCosts: [
          bomCost({ id: "bom-b", bomCost: 24 }),
          bomCost({ id: "bom-a", bomCost: 18 })
        ],
        logisticsCosts: [
          logisticsCost({ id: "logistics-b", logisticsCost: 2.4 }),
          logisticsCost({ id: "logistics-a", logisticsCost: 1.8 })
        ]
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rrpEur: 50,
      bomCost: 18,
      logisticsCost: 1.8
    });
  });

  test("keeps row visible and calculation null when RRP is missing", () => {
    const rows = buildNormalRows(referenceData({ productCountryRrps: [] }));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.missingFields).toEqual(["RRP"]);
    expect(rows[0]?.rrpLocal).toBeNull();
    expect(rows[0]?.rrpEur).toBeNull();
    expect(rows[0]?.calculation).toBeNull();
  });

  test("splits rows by product lifecycle status", () => {
    const launchedRows = buildNormalRows(referenceData(), {}, {
      lifecycle: "VALUE_CHAIN"
    });
    const eolRows = buildNormalRows(
      referenceData({
        products: [product({ lifecycleStatus: "EOL" })]
      }),
      {},
      { lifecycle: "VALUE_CHAIN" }
    );
    const unlaunchedRows = buildNormalRows(
      referenceData({
        products: [product({ lifecycleStatus: "UNLAUNCHED" })]
      }),
      {},
      { lifecycle: "UNLAUNCHED" }
    );

    expect(launchedRows).toHaveLength(1);
    expect(launchedRows[0]?.productLifecycleStatus).toBe("LAUNCHED");
    expect(eolRows).toHaveLength(1);
    expect(eolRows[0]?.productLifecycleStatus).toBe("EOL");
    expect(unlaunchedRows).toHaveLength(1);
    expect(unlaunchedRows[0]?.productLifecycleStatus).toBe("UNLAUNCHED");
    expect(
      buildNormalRows(
        referenceData({
          products: [product({ lifecycleStatus: "UNLAUNCHED" })]
        }),
        {},
        { lifecycle: "VALUE_CHAIN" }
      )
    ).toHaveLength(0);
    expect(buildNormalRows(referenceData(), {}, { lifecycle: "UNLAUNCHED" }))
      .toHaveLength(0);
  });

  test("sets calculation null and marks LOGISTICS missing when logistics is missing", () => {
    const rows = buildNormalRows(referenceData({ logisticsCosts: [] }));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.missingFields).toEqual(["LOGISTICS"]);
    expect(rows[0]?.logisticsCost).toBeNull();
    expect(rows[0]?.calculation).toBeNull();
  });

  test("matches capacity-null product when exactly one country/category logistics row exists", () => {
    const rows = buildNormalRows(
      referenceData({
        products: [product({ capacity: null })]
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.missingFields).toEqual([]);
    expect(rows[0]?.logisticsCost).toBe(0.9);
    expect(rows[0]?.calculation?.landingPrice).toBeCloseTo(21.75, 2);
  });

  test("matches capacity-null product to latest duplicate logistics history for one size", () => {
    const rows = buildNormalRows(
      referenceData({
        products: [product({ capacity: null })],
        logisticsCosts: [
          logisticsCost({
            id: "logistics-standard-2026-01",
            productSize: "Standard",
            logisticsCost: 0.7,
            effectiveDate: "2026-01-01T00:00:00.000Z"
          }),
          logisticsCost({
            id: "logistics-standard-2026-02",
            productSize: "Standard",
            logisticsCost: 1.3,
            effectiveDate: "2026-02-01T00:00:00.000Z"
          })
        ]
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.missingFields).toEqual([]);
    expect(rows[0]?.logisticsCost).toBe(1.3);
    expect(rows[0]?.calculation?.logisticsCost).toBe(1.3);
  });

  test("marks capacity-null product with multiple country/category logistics rows as ambiguous", () => {
    const rows = buildNormalRows(
      referenceData({
        products: [product({ capacity: null })],
        logisticsCosts: [
          logisticsCost({ id: "logistics-fr-standard", productSize: "Standard" }),
          logisticsCost({
            id: "logistics-fr-large",
            productSize: "Large",
            logisticsCost: 1.4
          })
        ]
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.missingFields).toEqual(["LOGISTICS"]);
    expect(rows[0]?.logisticsCost).toBeNull();
    expect(rows[0]?.calculation).toBeNull();
  });

  test("filters by exact country, channel, FD, model, category, product, and KA buying margin", () => {
    const data = referenceData();

    expect(
      buildNormalRows(data, {
        countryCode: "FR",
        channelName: "Boulanger",
        fdName: "BBC",
        model: "P41L-P1",
        category: "Power bank",
        productName: "PowerPaw 10K",
        kaBuyingMargin: 0.42
      })
    ).toHaveLength(1);
    expect(buildNormalRows(data, { countryCode: "" })).toHaveLength(1);
    expect(buildNormalRows(data, { countryCode: "ES" })).toHaveLength(0);
    expect(buildNormalRows(data, { channelName: "MediaMarkt" })).toHaveLength(
      0
    );
    expect(buildNormalRows(data, { fdName: "Another FD" })).toHaveLength(0);
    expect(buildNormalRows(data, { model: "OTHER" })).toHaveLength(0);
    expect(buildNormalRows(data, { category: "Cable" })).toHaveLength(0);
    expect(buildNormalRows(data, { productName: "Other Product" })).toHaveLength(
      0
    );
    expect(buildNormalRows(data, { kaBuyingMargin: 0.4 })).toHaveLength(0);
  });

  test("promotion rows default manual inputs and compute", () => {
    const rows = buildPromotionRows(referenceData(), {});

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      promoRrpLocal: 44.99,
      promoRrpEur: 44.99,
      promoVolume: 1000,
      settlementMode: "INVOICE_DISCOUNT"
    });
    expect(rows[0]?.promotionCalculation?.promoRrp).toBe(44.99);
    expect(rows[0]?.promotionCalculation?.totalRebate).toBe(0);
  });

  test("promotion rows use provided inputs by row key", () => {
    const rows = buildPromotionRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        promoRrpLocal: 39.99,
        promoRrpEur: 39.99,
        promoVolume: 250,
        settlementMode: "REBATE_CLAIM"
      }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      promoRrpLocal: 39.99,
      promoRrpEur: 39.99,
      promoVolume: 250,
      settlementMode: "INVOICE_DISCOUNT"
    });
    expect(rows[0]?.promotionCalculation?.promoRrp).toBe(39.99);
    expect(rows[0]?.promotionCalculation?.totalRebate).toBeCloseTo(604.17, 2);
  });

  test("promotion rows use promo front margin for rebate planning", () => {
    const rows = buildPromotionRows(
      referenceData({
        operationalMargins: [
          operationalMargin({
            kaBuyingMargin: 0.6,
            kaFrontMargin: 0.42
          })
        ]
      }),
      {
        "margin-fr-boulanger|product-powerpaw": {
          promoRrpLocal: 29.99,
          promoRrpEur: 29.99,
          promoFrontMargin: 0.3,
          settlementMode: "INVOICE_DISCOUNT"
        }
      }
    );

    const normalRrpExVat = 44.99 / 1.2;
    const promoRrpExVat = 29.99 / 1.2;
    const expectedPromoRebate =
      normalRrpExVat * (1 - 0.42) - promoRrpExVat * (1 - 0.3);
    const expectedMarginRebate =
      normalRrpExVat * (1 - 0.6) - normalRrpExVat * (1 - 0.42);

    expect(rows[0]).toMatchObject({
      promoFrontMargin: 0.3
    });
    expect(rows[0]?.promotionCalculation?.promoRebatePerUnit).toBeCloseTo(
      expectedPromoRebate,
      2
    );
    expect(rows[0]?.promotionCalculation?.marginRebatePerUnit).toBeCloseTo(
      expectedMarginRebate,
      2
    );
    expect(rows[0]?.promotionCalculation?.rebatePerUnit).toBeCloseTo(
      expectedPromoRebate + expectedMarginRebate,
      2
    );
  });

  test("promotion rows derive EUR from provided local promo RRP when EUR is omitted", () => {
    const rows = buildPromotionRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        promoRrpLocal: 39.99
      }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      promoRrpLocal: 39.99,
      promoRrpEur: 39.99
    });
    expect(rows[0]?.promotionCalculation?.promoRrp).toBe(39.99);
  });

  test("promotion rows derive missing EUR input from local-to-EUR master RRP ratio", () => {
    const rows = buildPromotionRows(
      referenceData({
        productCountryRrps: [
          productCountryRrp({
            rrpLocal: 159.99,
            rrpEur: 37.21,
            currency: "PLN"
          })
        ]
      }),
      {
        "margin-fr-boulanger|product-powerpaw": {
          promoRrpLocal: "99.99"
        }
      }
    );

    const expectedPromoRrpEur = (99.99 * 37.21) / 159.99;

    expect(rows[0]).toMatchObject({
      promoRrpLocal: "99.99",
      promoRrpEur: expectedPromoRrpEur
    });
    expect(rows[0]?.promotionCalculation?.promoRrp).toBeCloseTo(
      expectedPromoRrpEur,
      6
    );
  });

  test("promotion rows let local promo RRP override stale EUR input", () => {
    const rows = buildPromotionRows(
      referenceData({
        productCountryRrps: [
          productCountryRrp({
            rrpLocal: 159.99,
            rrpEur: 37.21,
            currency: "PLN"
          })
        ]
      }),
      {
        "margin-fr-boulanger|product-powerpaw": {
          promoRrpLocal: 99.99,
          promoRrpEur: 999
        }
      }
    );

    const expectedPromoRrpEur = (99.99 * 37.21) / 159.99;

    expect(rows[0]?.promoRrpEur).toBeCloseTo(expectedPromoRrpEur, 6);
    expect(rows[0]?.promotionCalculation?.promoRrp).toBeCloseTo(
      expectedPromoRrpEur,
      6
    );
  });

  test("RRPP simulation rows compute NP for unlaunched rows with manual RRPP", () => {
    const rows = buildRrppSimulationRows(
      referenceData({
        products: [product({ lifecycleStatus: "UNLAUNCHED" })],
        productCountryRrps: []
      }),
      {
        "margin-fr-boulanger|product-powerpaw": {
          rrppLocal: 59.99,
          rrppEur: 59.99
        }
      },
      {},
      { lifecycle: "UNLAUNCHED" }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      simulationRrppLocal: 59.99,
      simulationRrppEur: 59.99
    });
    expect(rows[0]?.rrppSimulationCalculation?.np).toBeGreaterThan(0);
    expect(rows[0]?.rrppSimulationCalculation?.npPercent).toBeGreaterThan(0);
  });

  test("RRPP simulation rows let local RRPP override stale EUR input", () => {
    const rows = buildRrppSimulationRows(
      referenceData({
        productCountryRrps: [
          productCountryRrp({
            rrpLocal: 159.99,
            rrpEur: 37.21,
            currency: "PLN"
          })
        ]
      }),
      {
        "margin-fr-boulanger|product-powerpaw": {
          rrppLocal: 99.99,
          rrppEur: 999
        }
      }
    );

    const expectedSimulationRrppEur = (99.99 * 37.21) / 159.99;

    expect(rows[0]?.simulationRrppEur).toBeCloseTo(
      expectedSimulationRrppEur,
      6
    );
    expect(rows[0]?.rrppSimulationCalculation?.promoRrp).toBeCloseTo(
      expectedSimulationRrppEur,
      6
    );
  });

  test("RRPP simulation promo rebate uses the real channel front margin", () => {
    const rows = buildRrppSimulationRows(
      referenceData({
        operationalMargins: [
          operationalMargin({
            kaBuyingMargin: 0.6,
            kaFrontMargin: 0.42
          })
        ]
      }),
      {
        "margin-fr-boulanger|product-powerpaw": {
          rrppLocal: 29.99,
          rrppEur: 29.99
        }
      }
    );

    const normalRrpExVat = 44.99 / 1.2;
    const promoRrpExVat = 29.99 / 1.2;
    const expectedPromoRebate =
      normalRrpExVat * (1 - 0.42) - promoRrpExVat * (1 - 0.42);
    const expectedMarginRebate =
      normalRrpExVat * (1 - 0.6) - normalRrpExVat * (1 - 0.42);

    expect(rows[0]?.rrppSimulationCalculation?.promoRebatePerUnit).toBeCloseTo(
      expectedPromoRebate,
      2
    );
    expect(rows[0]?.rrppSimulationCalculation?.marginRebatePerUnit).toBeCloseTo(
      expectedMarginRebate,
      2
    );
  });

  test("RRPP simulation uses manual promo front margin when channels lower points", () => {
    const data = referenceData({
      operationalMargins: [
        operationalMargin({
          kaBuyingMargin: 0.6,
          kaFrontMargin: 0.42
        })
      ]
    });
    const rows = buildRrppSimulationRows(
      data,
      {
        "margin-fr-boulanger|product-powerpaw": {
          rrppLocal: 29.99,
          rrppEur: 29.99,
          promoFrontMargin: 0.3
        }
      }
    );
    const defaultRows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 29.99,
        rrppEur: 29.99
      }
    });

    const normalRrpExVat = 44.99 / 1.2;
    const promoRrpExVat = 29.99 / 1.2;
    const expectedPromoRebate =
      normalRrpExVat * (1 - 0.42) - promoRrpExVat * (1 - 0.3);

    expect(rows[0]).toMatchObject({
      simulationPromoFrontMargin: 0.3
    });
    expect(rows[0]?.rrppSimulationCalculation?.promoRebatePerUnit).toBeCloseTo(
      expectedPromoRebate,
      2
    );
    expect(rows[0]?.rrppSimulationCalculation?.promoRebatePerUnit).toBeLessThan(
      defaultRows[0]?.rrppSimulationCalculation?.promoRebatePerUnit ?? 0
    );
    expect(rows[0]?.rrppSimulationCalculation?.npPercent).toBeGreaterThan(
      defaultRows[0]?.rrppSimulationCalculation?.npPercent ?? 1
    );
  });

  test("RRPP simulation lets launch KA buying margin update unified flow and floor results", () => {
    const data = referenceData({
      operationalMargins: [
        operationalMargin({
          kaBuyingMargin: 0.42,
          kaFrontMargin: 0.42
        })
      ]
    });
    const defaultRows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 44.99,
        rrppEur: 44.99
      }
    });
    const rows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 44.99,
        rrppEur: 44.99,
        kaBuyingMargin: 0.35
      }
    });

    expect(rows[0]).toMatchObject({
      kaBuyingMargin: 0.35,
      simulationKaBuyingMargin: 0.35
    });
    expect(rows[0]?.calculation?.kaBuyingMargin).toBe(0.35);
    expect(rows[0]?.calculation?.landingPrice).toBeGreaterThan(
      defaultRows[0]?.calculation?.landingPrice ?? Number.POSITIVE_INFINITY
    );
    expect(rows[0]?.rrppSimulationCalculation?.normalLandingPrice).toBeCloseTo(
      rows[0]?.calculation?.landingPrice ?? 0,
      6
    );
    expect(rows[0]?.rrppSimulationCalculation?.np).not.toBeCloseTo(
      defaultRows[0]?.rrppSimulationCalculation?.np ?? 0,
      6
    );
  });

  test("RRPP simulation ignores legacy actual front margin inputs and uses standard KA front margin", () => {
    const data = referenceData({
      operationalMargins: [
        operationalMargin({
          kaBuyingMargin: 0.42,
          kaFrontMargin: 0.42,
          kaBackMargin: 0.1
        })
      ]
    });
    const defaultRows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 29.99,
        rrppEur: 29.99
      }
    });
    const rows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 29.99,
        rrppEur: 29.99,
        actualFrontMargin: 0.3
      } as Record<string, number>
    });

    const normalRrpExVat = 44.99 / 1.2;
    const promoRrpExVat = 29.99 / 1.2;
    const expectedPromoRebate =
      normalRrpExVat * (1 - 0.42) - promoRrpExVat * (1 - 0.42);

    expect(rows[0]).toMatchObject({
      simulationActualFrontMargin: 0.42
    });
    expect(rows[0]?.calculation?.actualFrontMargin).toBe(0.42);
    expect(rows[0]?.rrppSimulationCalculation?.promoRebatePerUnit).toBeCloseTo(
      expectedPromoRebate,
      2
    );
    expect(rows[0]?.rrppSimulationCalculation?.np).toBeCloseTo(
      defaultRows[0]?.rrppSimulationCalculation?.np ?? 0,
      6
    );
  });

  test("RRPP simulation lets B2B or EOL deal rows override FD margin", () => {
    const data = referenceData({
      operationalMargins: [
        operationalMargin({
          fdMargin: 0.2,
          kaBuyingMargin: 0.42,
          kaFrontMargin: 0.42
        })
      ]
    });
    const defaultRows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 29.99,
        rrppEur: 29.99
      }
    });
    const rows = buildRrppSimulationRows(data, {
      "margin-fr-boulanger|product-powerpaw": {
        rrppLocal: 29.99,
        rrppEur: 29.99,
        dealType: "B2B_DEAL",
        promoFdMargin: 0.1
      }
    });

    expect(rows[0]).toMatchObject({
      dealType: "B2B_DEAL",
      promoFdMargin: 0.1
    });
    expect(rows[0]?.rrppSimulationCalculation).toMatchObject({
      dealType: "B2B_DEAL",
      promoFdMargin: 0.1
    });
    expect(rows[0]?.rrppSimulationCalculation?.fdMarginImpact).toBeGreaterThan(0);
    expect(rows[0]?.rrppSimulationCalculation?.np).toBeGreaterThan(
      defaultRows[0]?.rrppSimulationCalculation?.np ?? Number.POSITIVE_INFINITY
    );
  });

  test("promotion rows keep blank and partial EUR inputs visible without calculating", () => {
    const rows = buildPromotionRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        promoRrpEur: ".",
        promoVolume: ""
      }
    });

    expect(rows[0]).toMatchObject({
      promoRrpEur: ".",
      promoVolume: ""
    });
    expect(rows[0]?.promotionCalculation).toBeNull();
  });

  test("promotion rows keep zero and negative promo RRP visible without calculating", () => {
    const rows = buildPromotionRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        promoRrpLocal: -1,
        promoRrpEur: 0
      }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      promoRrpLocal: -1,
      promoRrpEur: -1
    });
    expect(rows[0]?.promotionCalculation).toBeNull();
  });

  test("promotion rows keep zero and negative promo volume visible without calculating", () => {
    const zeroVolumeRows = buildPromotionRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        promoVolume: 0
      }
    });
    const negativeVolumeRows = buildPromotionRows(referenceData(), {
      "margin-fr-boulanger|product-powerpaw": {
        promoVolume: -10
      }
    });

    expect(zeroVolumeRows[0]?.promoVolume).toBe(0);
    expect(zeroVolumeRows[0]?.promotionCalculation).toBeNull();
    expect(negativeVolumeRows[0]?.promoVolume).toBe(-10);
    expect(negativeVolumeRows[0]?.promotionCalculation).toBeNull();
  });
});

function referenceData(overrides: Partial<ReferenceData> = {}): ReferenceData {
  return {
    countries: [country()],
    products: [product()],
    bomCosts: [bomCost()],
    logisticsCosts: [logisticsCost()],
    productCountryRrps: [productCountryRrp()],
    operationalMargins: [operationalMargin()],
    channelMargins: [],
    fdMargins: [],
    ...overrides
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
    capacity: "Standard",
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

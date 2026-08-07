import { describe, expect, test } from "vitest";
import { createXlsxWorkbook } from "./exports/xlsxWorkbook";
import { readWorkbookSheetNames, readWorksheetRows } from "./imports/xlsxLite";
import {
  buildPromotionPlanWorkbookBuffer,
  parsePromotionPlanWorkbook,
  promotionPlanBusinessKeyForParts,
  promotionPlanWorkbookTargetMonthMessage
} from "./promotionPlan";
import {
  buildPromotionPlanEligibleRows,
  promotionPlanAutosaveBaseline
} from "./promotionPlanShared";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  PromotionPlanEntryOption,
  ReferenceData
} from "./types";

describe("promotion plan workbooks", () => {
  test("explains when a single uploaded worksheet does not match the active page month", () => {
    expect(
      promotionPlanWorkbookTargetMonthMessage({
        workbookMonths: [{ year: 2026, month: 7 }],
        targetMonth: { year: 2026, month: 8 }
      })
    ).toContain("month worksheet 2026-07");
    expect(
      promotionPlanWorkbookTargetMonthMessage({
        workbookMonths: [{ year: 2026, month: 7 }],
        targetMonth: { year: 2026, month: 8 }
      })
    ).toContain("Promotion periods may cross into later months");

    expect(
      promotionPlanWorkbookTargetMonthMessage({
        workbookMonths: [{ year: 2026, month: 8 }],
        targetMonth: { year: 2026, month: 8 }
      })
    ).toBeNull();

    expect(
      promotionPlanWorkbookTargetMonthMessage({
        workbookMonths: [
          { year: 2026, month: 7 },
          { year: 2026, month: 8 }
        ],
        targetMonth: { year: 2026, month: 8 }
      })
    ).toBeNull();
  });

  test("changes the autosave baseline when the shared country-month plan changes", () => {
    const entry = promotionPlanEntry({
      countryCode: "ES",
      updatedAt: "2026-07-21T15:35:09.345Z"
    });
    const status = {
      countryCode: "ES",
      updatedAt: "2026-07-21T15:35:09.345Z"
    };
    const initialBaseline = promotionPlanAutosaveBaseline(
      [entry],
      [status],
      ["ES"]
    );

    expect(
      promotionPlanAutosaveBaseline(
        [{ ...entry, updatedAt: "2026-07-22T09:00:00.000Z" }],
        [status],
        ["ES"]
      )
    ).not.toBe(initialBaseline);
    expect(
      promotionPlanAutosaveBaseline(
        [entry],
        [{ ...status, updatedAt: "2026-07-22T09:00:00.000Z" }],
        ["ES"]
      )
    ).not.toBe(initialBaseline);
  });

  test("keeps the autosave baseline stable when shared plan rows are reordered", () => {
    const esEntry = promotionPlanEntry({
      id: "entry-es",
      countryCode: "ES",
      updatedAt: "2026-07-21T15:35:09.345Z"
    });
    const frEntry = promotionPlanEntry({
      id: "entry-fr",
      countryCode: "FR",
      updatedAt: "2026-07-21T15:35:09.345Z"
    });
    const statuses = [
      { countryCode: "FR", updatedAt: "2026-07-21T15:35:09.345Z" },
      { countryCode: "ES", updatedAt: "2026-07-21T15:35:09.345Z" }
    ];

    expect(
      promotionPlanAutosaveBaseline([esEntry, frEntry], statuses, ["ES", "FR"])
    ).toBe(
      promotionPlanAutosaveBaseline([frEntry, esEntry], [...statuses].reverse(), [
        "FR",
        "ES"
      ])
    );
  });

  test("allows a fully configured unlaunched product only in its pre-launch planning window", () => {
    const preLaunchProduct = product({
      id: "product-pre-launch",
      sku: "PRE-100W",
      name: "Future 100W Charger",
      category: "Power bank",
      lifecycleStatus: "UNLAUNCHED",
      plannedLaunchAt: "2026-08-15T00:00:00.000Z"
    });
    const data = referenceData({
      products: [product(), preLaunchProduct],
      bomCosts: [
        bomCost(),
        bomCost({
          id: "bom-pre-launch",
          productId: preLaunchProduct.id,
          productSku: preLaunchProduct.sku,
          productName: preLaunchProduct.name
        })
      ],
      productCountryRrps: [
        productCountryRrp(),
        productCountryRrp({
          id: "rrp-pre-launch",
          productId: preLaunchProduct.id,
          productSku: preLaunchProduct.sku,
          productName: preLaunchProduct.name
        })
      ]
    });

    for (const month of [6, 7, 8]) {
      expect(
        buildPromotionPlanEligibleRows({
          data,
          targetMonth: { year: 2026, month }
        }).some((row) => row.model === preLaunchProduct.sku)
      ).toBe(true);
    }
    for (const month of [5, 9]) {
      expect(
        buildPromotionPlanEligibleRows({
          data,
          targetMonth: { year: 2026, month }
        }).some((row) => row.model === preLaunchProduct.sku)
      ).toBe(false);
    }
  });

  test("imports an eligible pre-launch row and rejects it outside its planning window", () => {
    const preLaunchProduct = product({
      id: "product-pre-launch-import",
      sku: "PRE-100W",
      name: "Future 100W Charger",
      category: "Power bank",
      lifecycleStatus: "UNLAUNCHED",
      plannedLaunchAt: "2026-08-15T00:00:00.000Z"
    });
    const data = referenceData({
      products: [product(), preLaunchProduct],
      bomCosts: [
        bomCost(),
        bomCost({
          id: "bom-pre-launch-import",
          productId: preLaunchProduct.id,
          productSku: preLaunchProduct.sku,
          productName: preLaunchProduct.name
        })
      ],
      productCountryRrps: [
        productCountryRrp(),
        productCountryRrp({
          id: "rrp-pre-launch-import",
          productId: preLaunchProduct.id,
          productSku: preLaunchProduct.sku,
          productName: preLaunchProduct.name
        })
      ]
    });
    const row = [
      "FR",
      "Boulanger",
      "BBC",
      "DDP",
      preLaunchProduct.sku,
      49.99,
      49.99,
      0.42,
      500,
      "2026-06-01",
      "2026-06-30"
    ];

    const allowed = parsePromotionPlanWorkbook(
      createXlsxWorkbook([{ name: "2026-06", rows: [importHeader(), row] }]),
      data
    );
    const outsideWindow = parsePromotionPlanWorkbook(
      createXlsxWorkbook([{ name: "2026-09", rows: [importHeader(), row] }]),
      data
    );

    expect(allowed.errors).toEqual([]);
    expect(allowed.rows[0]).toMatchObject({
      productSku: preLaunchProduct.sku,
      productName: preLaunchProduct.name
    });
    expect(outsideWindow.rows).toEqual([]);
    expect(outsideWindow.errors[0]?.message).toContain("not eligible");
  });

  test("exports a month sheet that can be imported back to the same month row", () => {
    const data = referenceData();
    const workbook = buildPromotionPlanWorkbookBuffer({
      data,
      entries: [
        promotionPlanEntry({
          promotionName: "Summer hero",
          promoRrpLocal: 39.99,
          promoRrpEur: 39.99,
          promoFrontMargin: 0.38,
          promoVolume: 1200
        })
      ],
      months: [{ year: 2026, month: 6 }]
    });

    expect(readWorkbookSheetNames(workbook)).toEqual([
      "2026-06",
      "Settlement Evidence",
      "New Launched Products",
      "Period Rules",
      "Promotion Options",
      "Date Options"
    ]);
    expect(readWorksheetRows(workbook, "2026-06")[0]?.cells).toContain(
      "Promotion Name"
    );

    const parsed = parsePromotionPlanWorkbook(workbook, data);

    expect(parsed.errors).toEqual([]);
    expect(parsed.monthKeys).toEqual(["2026-06"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      year: 2026,
      month: 6,
      key: promotionPlanBusinessKeyForParts({
        countryCode: "FR",
        retailerName: "Boulanger",
        fdName: "BBC",
        incoterms: "DDP",
        productSku: "P41L-P1"
      }),
      promotionName: "Summer hero",
      promoRrpLocal: 39.99,
      promoRrpEur: 39.99,
      promoFrontMargin: 0.38,
      promoVolume: 1200,
      promoStartDate: "2026-06-03",
      promoEndDate: "2026-06-16"
    });
  });

  test("exports calculated columns as Excel formulas", () => {
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData(),
      entries: [promotionPlanEntry({ promoRrpEur: 39.99 })],
      months: [{ year: 2026, month: 6 }]
    });
    const workbookXml = workbook.toString("utf8");

    expect(workbookXml).toContain("<f>IFERROR(K2/(1+L2),\"\")</f>");
    expect(workbookXml).toContain(
      "<f>IFERROR(MAX(0,K2/(1+L2)*(1-M2)-T2/(1+L2)*(1-U2)),\"\")</f>"
    );
    expect(workbookXml).toContain("<f>IFERROR(Z2+AA2,\"\")</f>");
    expect(workbookXml).toContain(
      "<f>IFERROR(K2/(1+L2)*(1-N2)*(1-IF(AG2=\"\",P2,AG2))-Q2-AC2,\"\")</f>"
    );
    expect(workbookXml).toContain("<f>IFERROR(AC2+AH2-AB2-R2,\"\")</f>");
    expect(workbookXml).toContain("<f>IFERROR(AD2/(AC2+AH2-AB2),\"\")</f>");
  });

  test("exports a settlement evidence sheet for approval email matching", () => {
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData(),
      entries: [
        promotionPlanEntry({
          promoRrpLocal: 39.99,
          promoRrpEur: 39.99,
          promoFrontMargin: 0.38,
          promoVolume: 1200
        })
      ],
      months: [{ year: 2026, month: 6 }]
    });
    const rows = readWorksheetRows(workbook, "Settlement Evidence");

    expect(rows[0]?.cells).toEqual([
      "Reference",
      "Month",
      "Country",
      "Channel / Retailer",
      "FD",
      "Model",
      "Product",
      "Category",
      "Deal Type",
      "Promo Start Date",
      "Promo End Date",
      "RRPP Local",
      "RRPP EUR",
      "Promo Rebate",
      "Margin Rebate",
      "Total Rebate",
      "Promo Volume",
      "Updated By"
    ]);
    expect(rows[1]?.cells).toEqual(
      expect.arrayContaining([
        "PP-2026-06-FR",
        "2026-06",
        "FR",
        "Boulanger",
        "BBC",
        "P41L-P1",
        "PowerPaw 10K",
        "Power bank",
        "Normal"
      ])
    );
  });

  test("exports current-month launched products for next-month planning", () => {
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData({
        products: [
          product({
            sku: "NEW-1",
            name: "New Launch",
            launchedAt: "2026-06-12T10:00:00.000Z"
          })
        ],
        productCountryRrps: [
          productCountryRrp({ productSku: "NEW-1", productName: "New Launch" })
        ],
        bomCosts: [bomCost({ productSku: "NEW-1", productName: "New Launch" })]
      }),
      entries: [],
      months: [{ year: 2026, month: 7 }]
    });
    const rows = readWorksheetRows(workbook, "New Launched Products");

    expect(rows[0]?.cells).toEqual([
      "Launch Month",
      "SKU",
      "Product",
      "Category",
      "Launched At",
      "Included in Plan",
      "Available Countries"
    ]);
    expect(rows[1]?.cells[0]).toBe("2026-06");
    expect(rows[1]?.cells[1]).toBe("NEW-1");
    expect(rows[1]?.cells[2]).toBe("New Launch");
    expect(rows[1]?.cells[5]).toBe("Missing from plan");
    expect(rows[1]?.cells[6]).toBe("FR");
  });

  test("exports promo dates as date-formatted cells with workbook date options", () => {
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData(),
      entries: [promotionPlanEntry()],
      months: [{ year: 2026, month: 6 }]
    });
    const workbookXml = workbook.toString("utf8");

    expect(workbookXml).toContain('name="Period Rules"');
    expect(workbookXml).toContain('name="Promotion Options"');
    expect(workbookXml).toContain('name="Date Options"');
    expect(workbookXml).toContain('state="hidden"');
    expect(workbookXml).toContain('formatCode="dd/mm/yyyy"');
    expect(workbookXml).toContain('<dataValidation type="list"');
    expect(workbookXml).toContain("Promo Start Date");
    expect(workbookXml).toContain("Promo End Date");
  });

  test("exports product-led selectors and retailer / FD-driven baseline formulas", () => {
    const secondMargin = operationalMargin({
      id: "margin-fr-fnac",
      retailerName: "Fnac",
      fdName: "Esprinet",
      kaBuyingMargin: 0.37,
      kaFrontMargin: 0.35,
      kaBackMargin: 0.04,
      fdMargin: 0.12
    });
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData({ operationalMargins: [operationalMargin(), secondMargin] }),
      entries: [promotionPlanEntry()],
      months: [{ year: 2026, month: 6 }]
    });
    const workbookXml = workbook.toString("utf8");

    expect(workbookXml).toContain('name="PP_CHANNEL_FR" hidden="1"');
    expect(workbookXml).toContain(
      "'Promotion Options'!$U$2:$U$3"
    );
    expect(workbookXml).toContain('name="PP_FD_2" hidden="1"');
    expect(workbookXml).toContain("'Promotion Options'!$W$2:$W$2");
    expect(workbookXml).toContain('name="PP_FD_3" hidden="1"');
    expect(workbookXml).toContain("'Promotion Options'!$W$3:$W$3");
    expect(workbookXml).toContain('name="PP_INCOTERM_2" hidden="1"');
    expect(workbookXml).toContain("'Promotion Options'!$Y$2:$Y$2");
    expect(workbookXml).toContain(
      'INDIRECT("PP_CHANNEL_"&amp;UPPER($A2))'
    );
    expect(workbookXml).toContain("sqref=\"B2:B301\"");
    expect(workbookXml).toContain("sqref=\"D2:D301\"");
    expect(workbookXml).toContain("sqref=\"E2:E301\"");
    expect(workbookXml).toContain("sqref=\"H2:H301\"");
    expect(workbookXml).not.toContain("sqref=\"F2:F301\"");
    expect(workbookXml).not.toContain("sqref=\"G2:G301\"");
    expect(workbookXml).toContain(
      "MATCH(H2,'Promotion Options'!$D:$D,0)"
    );
    expect(workbookXml).toContain(
      "MATCH($A2&amp;\"|\"&amp;$B2&amp;\"|\"&amp;$D2&amp;\"|\"&amp;$E2&amp;\"|\"&amp;$G2,'Promotion Options'!$O:$O,0)"
    );
    expect(workbookXml).toContain(
      "MATCH($A2&amp;\"|\"&amp;$H2&amp;\"|\"&amp;$E2,'Promotion Options'!$K:$K,0)"
    );
    expect(workbookXml).toContain("FR|Boulanger|BBC|DDP|Power bank");
    expect(workbookXml).toContain("FR|Fnac|Esprinet|DDP|Power bank");
  });

  test("uses the selected product to resolve its matching model and category on import", () => {
    const alternateProduct = product({
      id: "product-magpro-slim",
      sku: "P75-P1",
      name: "MagPro Slim 5K"
    });
    const data = referenceData({
      products: [product(), alternateProduct],
      bomCosts: [
        bomCost(),
        bomCost({
          id: "bom-magpro-slim",
          productId: alternateProduct.id,
          productSku: alternateProduct.sku,
          productName: alternateProduct.name
        })
      ],
      productCountryRrps: [
        productCountryRrp(),
        productCountryRrp({
          id: "rrp-fr-magpro-slim",
          productId: alternateProduct.id,
          productSku: alternateProduct.sku,
          productName: alternateProduct.name
        })
      ]
    });
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          [
            "Country",
            "Channel / Retailer",
            "FD",
            "Incoterms",
            "Model",
            "Category",
            "Product",
            "RRPP Local",
            "RRPP EUR",
            "Promo Front Margin",
            "Promo Volume",
            "Promo Start Date",
            "Promo End Date"
          ],
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            "Power bank",
            "MagPro Slim 5K",
            34.99,
            34.99,
            0.36,
            900,
            "2026-06-03",
            "2026-06-16"
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, data);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      productSku: "P75-P1",
      category: "Power bank",
      productName: "MagPro Slim 5K"
    });
  });

  test("exports locked country rows from saved snapshots instead of current master data", () => {
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData(),
      entries: [
        promotionPlanEntry({
          snapshotRrpLocal: 35.99,
          snapshotRrpEur: 31.99,
          snapshotVatRate: 0.19,
          snapshotBaseFrontMargin: 0.33,
          snapshotKaBuyingMargin: 0.27,
          snapshotKaBackMargin: 0.08,
          snapshotFdMargin: 0.07,
          snapshotTransportCost: 0.7,
          snapshotBomCost: 15.5,
          snapshotCurrency: "EUR",
          snapshotLifecycleStatus: "EOL"
        })
      ],
      months: [{ year: 2026, month: 6 }],
      lockedCountryCodesByMonth: { "2026-06": ["FR"] }
    });
    const exportedRow = readWorksheetRows(workbook, "2026-06")[1]?.cells;

    expect(exportedRow?.slice(8, 18)).toEqual([
      "EOL",
      "35.99",
      "31.99",
      "0.19",
      "0.33",
      "0.27",
      "0.08",
      "0.07",
      "0.7",
      "15.5"
    ]);
  });

  test("imports separate month sheets from one workbook", () => {
    const data = referenceData();
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "",
            ""
          ]
        ]
      },
      {
        name: "2026-07",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            32.99,
            32.99,
            0.35,
            1100,
            "05/07/2026",
            "20/07/2026"
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, data);

    expect(parsed.errors).toEqual([]);
    expect(parsed.monthKeys).toEqual(["2026-06", "2026-07"]);
    expect(parsed.rows.map((row) => `${row.year}-${row.month}`)).toEqual([
      "2026-6",
      "2026-7"
    ]);
    expect(parsed.rows[1]?.promoVolume).toBe(1100);
    expect(parsed.rows[1]?.promoStartDate).toBe("2026-07-05");
    expect(parsed.rows[1]?.promoEndDate).toBe("2026-07-20");
  });

  test("imports Promotion Name when the workbook provides the explicit column", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          [
            "Country",
            "Channel / Retailer",
            "Promotion Name",
            "FD",
            "Incoterms",
            "Model",
            "RRPP Local",
            "RRPP EUR",
            "Promo Front Margin",
            "Promo Volume",
            "Promo Start Date",
            "Promo End Date"
          ],
          [
            "FR",
            "Boulanger",
            "Summer hero",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "2026-06-01",
            "2026-06-12"
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]?.promotionName).toBe("Summer hero");
  });

  test("imports Period Rules dates across matching country and channel rows", () => {
    const data = referenceData();
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "",
            ""
          ]
        ]
      },
      {
        name: "Period Rules",
        rows: [
          [
            "Month",
            "Country",
            "Channel / Retailer",
            "Promo Start Date",
            "Promo End Date"
          ],
          ["2026-06", "FR", "Boulanger", "2026-06-10", "2026-06-20"]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, data);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      promoStartDate: "2026-06-10",
      promoEndDate: "2026-06-20"
    });
  });

  test("imports visible month-sheet promo dates before stale Period Rules dates", () => {
    const data = referenceData();
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "2026-06-04",
            "2026-06-18"
          ]
        ]
      },
      {
        name: "Period Rules",
        rows: [
          [
            "Month",
            "Country",
            "Channel / Retailer",
            "Promo Start Date",
            "Promo End Date"
          ],
          ["2026-06", "FR", "Boulanger", "2026-06-10", "2026-06-20"]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, data);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      promoStartDate: "2026-06-04",
      promoEndDate: "2026-06-18"
    });
  });

  test("allows a promotion period to continue into the month after its plan sheet", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-08",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "2026-08-20",
            "2026-09-28"
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      year: 2026,
      month: 8,
      promoStartDate: "2026-08-20",
      promoEndDate: "2026-09-28"
    });
  });

  test("reports promo periods where the end date is earlier than the start date", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "2026-06-20",
            "2026-06-10"
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]?.message).toContain("Promo End Date");
  });

  test("imports blank promo dates as the full promotion month", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-07",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "",
            ""
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      promoStartDate: "2026-07-01",
      promoEndDate: "2026-07-31"
    });
  });

  test("imports partial promo dates by filling the missing month boundary", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-07",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "2026-07-08",
            ""
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      promoStartDate: "2026-07-08",
      promoEndDate: "2026-07-31"
    });
  });

  test("treats 1900 placeholder promo dates as missing dates", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-07",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "1900/01/23",
            "2026-07-20"
          ]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      promoStartDate: "2026-07-01",
      promoEndDate: "2026-07-20"
    });
  });

  test("imports partial Period Rules dates by filling month boundaries", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-07",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "",
            ""
          ]
        ]
      },
      {
        name: "Period Rules",
        rows: [
          [
            "Month",
            "Country",
            "Channel / Retailer",
            "Promo Start Date",
            "Promo End Date"
          ],
          ["2026-07", "FR", "Boulanger", "", "2026-07-18"]
        ]
      }
    ]);

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      promoStartDate: "2026-07-01",
      promoEndDate: "2026-07-18"
    });
  });

  test("exports only formal promotion plan entries", () => {
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: referenceData(),
      entries: [],
      months: [{ year: 2026, month: 7 }]
    });

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([]);
    expect(parsed.monthKeys).toEqual(["2026-07"]);
  });

  test("imports locked snapshot rows that no longer exist in current master data", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        rows: [
          importHeader(),
          [
            "FR",
            "Boulanger",
            "BBC",
            "DDP",
            "P41L-P1",
            34.99,
            34.99,
            0.36,
            900,
            "2026-06-01",
            "2026-06-30"
          ]
        ]
      }
    ]);
    const parsed = parsePromotionPlanWorkbook(
      workbook,
      referenceData({ products: [], productCountryRrps: [], bomCosts: [] }),
      [promotionPlanEntry()]
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      countryCode: "FR",
      retailerName: "Boulanger",
      fdName: "BBC",
      productSku: "P41L-P1",
      promoRrpEur: 34.99,
      promoVolume: 900,
      promoStartDate: "2026-06-01",
      promoEndDate: "2026-06-30"
    });
  });

  test("reports workbooks without month sheets", () => {
    const parsed = parsePromotionPlanWorkbook(
      createXlsxWorkbook([{ name: "Notes", rows: [["Hello"]] }]),
      referenceData()
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]?.message).toContain("No month sheets");
  });
});

function importHeader() {
  return [
    "Country",
    "Channel / Retailer",
    "FD",
    "Incoterms",
    "Model",
    "RRPP Local",
    "RRPP EUR",
    "Promo Front Margin",
    "Promo Volume",
    "Promo Start Date",
    "Promo End Date"
  ];
}

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

function promotionPlanEntry(
  overrides: Partial<PromotionPlanEntryOption> = {}
): PromotionPlanEntryOption {
  return {
    id: "entry-2026-06-fr-boulanger-powerpaw",
    planYear: 2026,
    planMonth: 6,
    countryCode: "FR",
    retailerName: "Boulanger",
    promotionName: null,
    fdName: "BBC",
    incoterms: "DDP",
    category: "Power bank",
    productSku: "P41L-P1",
    productName: "PowerPaw 10K",
    promoRrpLocal: 39.99,
    promoRrpEur: 39.99,
    promoFrontMargin: 0.38,
    dealType: "NORMAL",
    promoFdMargin: null,
    dealNote: null,
    promoVolume: 1200,
    promoStartDate: "2026-06-03",
    promoEndDate: "2026-06-16",
    snapshotCurrency: null,
    snapshotLifecycleStatus: null,
    snapshotRrpLocal: null,
    snapshotRrpEur: null,
    snapshotVatRate: null,
    snapshotBaseFrontMargin: null,
    snapshotKaBuyingMargin: null,
    snapshotKaBackMargin: null,
    snapshotFdMargin: null,
    snapshotTransportCost: null,
    snapshotBomCost: null,
    createdByEmail: "finance.admin@example.com",
    updatedByEmail: "finance.admin@example.com",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
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
    launchedAt: null,
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

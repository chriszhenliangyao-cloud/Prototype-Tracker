import { deflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import {
  parseBomProductWorkbook,
  parseMasterDataWorkbook,
  parseMarginWorkbook,
  parseRrpWorkbook
} from "./masterDataImport";

type XlsxCell = number | string | null | undefined;
type StringCellMode = "shared" | "inline";
type ZipCompression = "store" | "deflate";

describe("master data Excel imports", () => {
  test("parses BOM product rows matching screenshot headers from shared-string cells", () => {
    const workbook = createWorkbook(
      [
        ["Model", "Name", "Category", "Bom (RMB)", "Bom  (EUR)"],
        ["M3-TEST", " Hub M3 ", "Hub", null, 28.5],
        ["FP2-TEST", "Presence Sensor FP2", "Sensor", "112.50", "14.25"]
      ],
      "shared"
    );

    const result = parseBomProductWorkbook(workbook);

    expect(result).toEqual({
      rows: [
        {
          rowNumber: 2,
          model: "M3-TEST",
          name: "Hub M3",
          category: "Hub",
          bomRmb: null,
          bomEur: 28.5
        },
        {
          rowNumber: 3,
          model: "FP2-TEST",
          name: "Presence Sensor FP2",
          category: "Sensor",
          bomRmb: 112.5,
          bomEur: 14.25
        }
      ],
      errors: [],
      duplicateKeys: []
    });
  });

  test("parses optional BOM lifecycle status from English and Chinese values", () => {
    const workbook = createWorkbook(
      [
        ["进度", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
        ["已上市", "P62-P1", "Leopard Power 65W", "Power bank", 141.04, 18.08],
        ["未上市", "P99-P1", "Future Charger", "Charger", 120, 15.38],
        ["EOL", "P41L-P1", "PowerPaw 10K", "Power bank", 69.07, 8.85]
      ],
      "shared"
    );

    const result = parseBomProductWorkbook(workbook);

    expect(result.rows).toMatchObject([
      {
        model: "P62-P1",
        lifecycleStatus: "LAUNCHED"
      },
      {
        model: "P99-P1",
        lifecycleStatus: "UNLAUNCHED"
      },
      {
        model: "P41L-P1",
        lifecycleStatus: "EOL"
      }
    ]);
    expect(result.errors).toEqual([]);
  });

  test("parses planned launch dates for unlaunched products", () => {
    const workbook = createWorkbook(
      [
        [
          "Lifecycle Status",
          "Planned Launch Date",
          "Model",
          "Name",
          "Category",
          "Bom (EUR)"
        ],
        [
          "Unlaunched",
          "15/08/2026",
          "PRE-100W",
          "Future Charger",
          "Charger",
          19.5
        ]
      ],
      "shared"
    );

    const result = parseBomProductWorkbook(workbook);

    expect(result.errors).toEqual([]);
    expect(result.rows).toMatchObject([
      {
        model: "PRE-100W",
        lifecycleStatus: "UNLAUNCHED",
        plannedLaunchDate: "2026-08-15"
      }
    ]);
  });

  test("reports invalid BOM lifecycle status values", () => {
    const workbook = createWorkbook(
      [
        ["Lifecycle Status", "Model", "Name", "Category", "Bom (EUR)"],
        ["Maybe", "P62-P1", "Leopard Power 65W", "Power bank", 18.08]
      ],
      "inline"
    );

    const result = parseBomProductWorkbook(workbook);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      {
        rowNumber: 2,
        field: "Lifecycle Status",
        message: "Invalid lifecycle status; use Launched, Unlaunched, or EOL"
      }
    ]);
  });

  test("parses RRP rows from inline string and numeric cells", () => {
    const workbook = createWorkbook(
      [
        ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
        [" de ", "M3-TEST", 129.99, "119.50", " eur "]
      ],
      "inline"
    );

    const result = parseRrpWorkbook(workbook);

    expect(result).toEqual({
      rows: [
        {
          rowNumber: 2,
          countryCode: "DE",
          model: "M3-TEST",
          rrpLocal: 129.99,
          rrpEur: 119.5,
          currency: "EUR"
        }
      ],
      errors: [],
      duplicateKeys: []
    });
  });

  test("recognizes historical aliases and Chinese headers for master uploads", () => {
    const bomResult = parseBomProductWorkbook(
      createWorkbook(
        [
          ["SKU", "Product Name", "品类", "BOM RMB", "BOM EUR"],
          ["VC-65W", "65W GaN Charger", "Charger", "120,50", "18,75"]
        ],
        "shared"
      )
    );
    const rrpResult = parseRrpWorkbook(
      createWorkbook(
        [
          ["国家", "型号", "RRP 本币", "RRP (EUR)", "币种"],
          ["es", "VC-65W", 39.99, 36.5, "eur"]
        ],
        "inline"
      )
    );
    const marginResult = parseMarginWorkbook(
      createWorkbook(
        [
          [
            "国家代码",
            "KA/Retailer",
            "Distributor",
            "Trade Terms",
            "品类",
            "KA Margin %",
            "KA Front %",
            "KA Back %",
            "FD Margin %"
          ],
          ["ES", "Amazon", "EU FD", "DAP", "Charger", 42, 18, 6, 12]
        ],
        "inline"
      )
    );

    expect(bomResult).toEqual({
      rows: [
        {
          rowNumber: 2,
          model: "VC-65W",
          name: "65W GaN Charger",
          category: "Charger",
          bomRmb: 120.5,
          bomEur: 18.75
        }
      ],
      errors: [],
      duplicateKeys: []
    });
    expect(rrpResult).toEqual({
      rows: [
        {
          rowNumber: 2,
          countryCode: "ES",
          model: "VC-65W",
          rrpLocal: 39.99,
          rrpEur: 36.5,
          currency: "EUR"
        }
      ],
      errors: [],
      duplicateKeys: []
    });
    expect(marginResult).toEqual({
      rows: [
        {
          rowNumber: 2,
          countryCode: "ES",
          retailerName: "Amazon",
          fdName: "EU FD",
          incoterms: "DAP",
          category: "Charger",
          kaBuyingMargin: 0.42,
          kaFrontMargin: 0.18,
          kaBackMargin: 0.06,
          fdMargin: 0.12
        }
      ],
      errors: [],
      duplicateKeys: []
    });
  });

  test("rejects invalid RRP currency codes", () => {
    const workbook = createWorkbook(
      [
        ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
        ["DE", "M3-TEST", 129.99, 119.5, "EURO"]
      ],
      "inline"
    );

    const result = parseRrpWorkbook(workbook);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      {
        rowNumber: 2,
        field: "Currency",
        message: "Invalid currency code"
      }
    ]);
  });

  test("parses margin rows with percentage strings", () => {
    const workbook = createWorkbook(
      [
        [
          "Country",
          "Retailer",
          "FD",
          "Incoterms",
          "Category",
          "KA buying margin",
          "KA front margin",
          "KA back margin",
          "FD Margin"
        ],
        [
          "fr",
          " Retail Partner ",
          "Main Distributor",
          " ddp ",
          "Hub",
          "42%",
          "21%",
          "7.5%",
          "13%"
        ]
      ],
      "shared"
    );

    const result = parseMarginWorkbook(workbook);

    expect(result).toEqual({
      rows: [
        {
          rowNumber: 2,
          countryCode: "FR",
          retailerName: "Retail Partner",
          fdName: "Main Distributor",
          incoterms: "DDP",
          category: "Hub",
          kaBuyingMargin: 0.42,
          kaFrontMargin: 0.21,
          kaBackMargin: 0.075,
          fdMargin: 0.13
        }
      ],
      errors: [],
      duplicateKeys: []
    });
  });

  test("parses deflated workbooks with absolute worksheet relationships and numeric fraction margins", () => {
    const workbook = createWorkbook(
      [
        [
          "Country",
          "Retailer",
          "FD",
          "Incoterms",
          "Category",
          "KA buying margin",
          "KA front margin",
          "KA back margin",
          "FD Margin"
        ],
        ["ES", "Iberia Retail", "FD West", "FCA", "Hub", 0.42, 0.21, 0.075, 0.13]
      ],
      "inline",
      {
        absoluteSheetTarget: true,
        compression: "deflate"
      }
    );

    const result = parseMarginWorkbook(workbook);

    expect(result).toEqual({
      rows: [
        {
          rowNumber: 2,
          countryCode: "ES",
          retailerName: "Iberia Retail",
          fdName: "FD West",
          incoterms: "FCA",
          category: "Hub",
          kaBuyingMargin: 0.42,
          kaFrontMargin: 0.21,
          kaBackMargin: 0.075,
          fdMargin: 0.13
        }
      ],
      errors: [],
      duplicateKeys: []
    });
  });

  test("reports missing required headers", () => {
    const workbook = createWorkbook(
      [
        ["Model", "Bom (EUR)"],
        ["M3-TEST", 28.5]
      ],
      "inline"
    );

    const result = parseBomProductWorkbook(workbook);

    expect(result.rows).toEqual([]);
    expect(result.duplicateKeys).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rowNumber).toBe(1);
    expect(result.errors[0].message).toContain("Missing required columns");
    expect(result.errors[0].message).toContain("Name");
    expect(result.errors[0].message).toContain("Category");
  });

  test("reports invalid numbers and skips the invalid row", () => {
    const workbook = createWorkbook(
      [
        ["Model", "Name", "Category", "Bom (EUR)"],
        ["M3-TEST", "Hub M3", "Hub", "not available"],
        ["FP2-TEST", "Presence Sensor FP2", "Sensor", 14.25]
      ],
      "shared"
    );

    const result = parseBomProductWorkbook(workbook);

    expect(result.rows).toEqual([
      {
        rowNumber: 3,
        model: "FP2-TEST",
        name: "Presence Sensor FP2",
        category: "Sensor",
        bomRmb: null,
        bomEur: 14.25
      }
    ]);
    expect(result.errors).toEqual([
      {
        rowNumber: 2,
        field: "Bom (EUR)",
        message: "Invalid number"
      }
    ]);
  });

  test("reports blank required text fields and skips bad rows", () => {
    const bomResult = parseBomProductWorkbook(
      createWorkbook(
        [
          ["Model", "Name", "Category", "Bom (EUR)"],
          [" ", "Hub M3", "Hub", 28.5]
        ],
        "inline"
      )
    );
    const rrpResult = parseRrpWorkbook(
      createWorkbook(
        [
          ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
          [" ", "M3-TEST", 129.99, 119.5, " "]
        ],
        "shared"
      )
    );
    const marginResult = parseMarginWorkbook(
      createWorkbook(
        [
          [
            "Country",
            "Retailer",
            "FD",
            "Incoterms",
            "Category",
            "KA buying margin",
            "KA front margin",
            "KA back margin",
            "FD Margin"
          ],
          [" ", " ", " ", " ", " ", "42%", "21%", "7.5%", "13%"]
        ],
        "inline"
      )
    );

    expect(bomResult.rows).toEqual([]);
    expect(bomResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Model",
      message: "Required value"
    });
    expect(rrpResult.rows).toEqual([]);
    expect(rrpResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Country",
      message: "Required value"
    });
    expect(rrpResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Currency",
      message: "Required value"
    });
    expect(marginResult.rows).toEqual([]);
    expect(marginResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Country",
      message: "Required value"
    });
    expect(marginResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Retailer",
      message: "Required value"
    });
    expect(marginResult.errors).toContainEqual({
      rowNumber: 2,
      field: "FD",
      message: "Required value"
    });
    expect(marginResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Incoterms",
      message: "Required value"
    });
    expect(marginResult.errors).toContainEqual({
      rowNumber: 2,
      field: "Category",
      message: "Required value"
    });
  });

  test("normalizes bare whole-number margin percentages", () => {
    const workbook = createWorkbook(
      [
        [
          "Country",
          "Retailer",
          "FD",
          "Incoterms",
          "Category",
          "KA buying margin",
          "KA front margin",
          "KA back margin",
          "FD Margin"
        ],
        ["FR", "Retail Partner", "Main Distributor", "DDP", "Hub", 42, 0.21, 0.075, 0.13]
      ],
      "inline"
    );

    const result = parseMarginWorkbook(workbook);

    expect(result.rows[0]).toMatchObject({
      kaBuyingMargin: 0.42,
      kaFrontMargin: 0.21,
      kaBackMargin: 0.075,
      fdMargin: 0.13
    });
    expect(result.errors).toEqual([]);
  });

  test("rejects percentage string margins outside zero to one range", () => {
    const workbook = createWorkbook(
      [
        [
          "Country",
          "Retailer",
          "FD",
          "Incoterms",
          "Category",
          "KA buying margin",
          "KA front margin",
          "KA back margin",
          "FD Margin"
        ],
        ["FR", "Retail Partner", "Main Distributor", "DDP", "Hub", "150%", "21%", "7.5%", "13%"],
        ["FR", "Retail Partner", "Main Distributor", "DDP", "Cable", "42%", "-5%", "7.5%", "13%"]
      ],
      "inline"
    );

    const result = parseMarginWorkbook(workbook);

    expect(result.rows).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "KA buying margin",
      message: "Invalid number"
    });
    expect(result.errors).toContainEqual({
      rowNumber: 3,
      field: "KA front margin",
      message: "Invalid number"
    });
  });

  test("returns an import error instead of throwing for invalid XLSX buffers", () => {
    const result = parseBomProductWorkbook(Buffer.from("not an xlsx file"));

    expect(result.rows).toEqual([]);
    expect(result.duplicateKeys).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rowNumber).toBe(1);
    expect(result.errors[0].message).toContain("Invalid XLSX file");
  });

  test("reports duplicate keys and keeps the latest row", () => {
    const workbook = createWorkbook(
      [
        ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
        ["DE", "M3-TEST", 129.99, 119.5, "EUR"],
        ["DE", "M3-TEST", 109.99, 99.5, "EUR"]
      ],
      "inline"
    );

    const result = parseRrpWorkbook(workbook);

    expect(result.rows).toEqual([
      {
        rowNumber: 3,
        countryCode: "DE",
        model: "M3-TEST",
        rrpLocal: 109.99,
        rrpEur: 99.5,
        currency: "EUR"
      }
    ]);
    expect(result.errors).toEqual([]);
    expect(result.duplicateKeys).toEqual(["DE|M3-TEST"]);
  });

  test("parses the combined master data workbook contract across named sheets", () => {
    const workbook = createWorkbookWithSheets(
      [
        {
          name: "EXR",
          rows: [
            [null, "Currency", "EXR", "VAT"],
            ["PL", "PLN/EUR", 4.3, 0.23],
            ["FR", "EUR/EUR", 1, 0.2]
          ]
        },
        {
          name: "Bom cost",
          rows: [
            ["Lifecycle Status", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
            ["Launched", "P72-P1", "Power Bank 10K", "Power bank", 70, 8.97]
          ]
        },
        {
          name: "RRP",
          rows: [
            [null, null, null, null, null],
            ["Country", "Model", "Product", "RRP", "Currency"],
            ["PL", "P72-P1", "Power Bank 10K", 199.99, "PLN"],
            ["UK", "P72-P1", "Power Bank 10K", 49.99, "GBP"]
          ]
        },
        {
          name: "Logistic cost",
          rows: [
            ["Incoterms", "Category", "RMB", "EUR"],
            ["DDP", "Power bank", 7, 0.9]
          ]
        },
        {
          name: "Margin data",
          rows: [
            [
              "Country",
              "Retailer",
              "FD",
              "Incoterms",
              "Category",
              "KA buying margin",
              "KA front margin",
              "KA back margin",
              "FD Margin"
            ],
            ["PL", "", "Westech", "DDP", "Power bank", 0.45, 0.2, 0.04, 0.08]
          ]
        }
      ],
      "inline"
    );

    const result = parseMasterDataWorkbook(workbook);

    expect(result.countries).toEqual([
      {
        rowNumber: 2,
        countryCode: "PL",
        currency: "PLN",
        exchangeRateToEur: 4.3,
        vatRate: 0.23
      },
      {
        rowNumber: 3,
        countryCode: "FR",
        currency: "EUR",
        exchangeRateToEur: 1,
        vatRate: 0.2
      }
    ]);
    expect(result.bomProducts).toEqual([
      {
        rowNumber: 2,
        model: "P72-P1",
        name: "Power Bank 10K",
        category: "Power bank",
        lifecycleStatus: "LAUNCHED",
        bomRmb: 70,
        bomEur: 8.97
      }
    ]);
    expect(result.productCountryRrps).toEqual([
      {
        rowNumber: 3,
        countryCode: "PL",
        model: "P72-P1",
        productName: "Power Bank 10K",
        rrpLocal: 199.99,
        rrpEur: 46.5093,
        currency: "PLN"
      }
    ]);
    expect(result.logisticsCosts).toEqual([
      {
        rowNumber: 2,
        incoterms: "DDP",
        category: "Power bank",
        logisticsCostRmb: 7,
        logisticsCostEur: 0.9
      }
    ]);
    expect(result.operationalMargins).toEqual([
      {
        rowNumber: 2,
        countryCode: "PL",
        retailerName: "Westech",
        fdName: "Westech",
        incoterms: "DDP",
        category: "Power bank",
        kaBuyingMargin: 0.45,
        kaFrontMargin: 0.2,
        kaBackMargin: 0.04,
        fdMargin: 0.08
      }
    ]);
    expect(result.errors).toEqual([
      {
        sheet: "RRP",
        rowNumber: 4,
        field: "Country",
        message: "Missing EXR row for UK"
      }
    ]);
    expect(result.duplicateKeys).toEqual([]);
  });

  test("finds real headers after title rows and accepts sheet name variants", () => {
    const workbook = createWorkbookWithSheets(
      [
        {
          name: "Exchange rates",
          rows: [
            ["Reference", null, null, null],
            ["Market", "Pair", "FX", "VAT Rate"],
            ["PL", "PLN/EUR", 4.3, 0.23]
          ]
        },
        {
          name: "BOM",
          rows: [
            ["Internal export", null, null, null, null],
            ["SKU", "Product Name", "Product Category", "BOM RMB", "BOM EUR"],
            ["P72-P1", "Power Bank 10K", "Power bank", 70, 8.97]
          ]
        },
        {
          name: "RRP data",
          rows: [
            ["Country pricing table", null, null, null, null],
            ["Country", "Model", "Product", "RRP", "Currency"],
            ["PL", "P72-P1", "Power Bank 10K", 199.99, "PLN"]
          ]
        },
        {
          name: "Logistics cost",
          rows: [
            ["Transport assumptions", null, null, null],
            ["Incoterm", "Product Category", "RMB Cost", "EUR Cost"],
            ["DDP", "Power bank", 7, 0.9]
          ]
        },
        {
          name: "Margins",
          rows: [
            ["Channel settlement assumptions", null, null, null, null, null, null, null, null],
            [
              "Market",
              "Customer",
              "Distributor",
              "Trade Terms",
              "Product Category",
              "KA Margin %",
              "KA Front %",
              "KA Back %",
              "FD Margin %"
            ],
            ["PL", "X-Kom", "Komsa", "DDP", "Power bank", 0.42, 0.42, 0, 0]
          ]
        }
      ],
      "inline"
    );

    const result = parseMasterDataWorkbook(workbook);

    expect(result.countries).toHaveLength(1);
    expect(result.bomProducts).toHaveLength(1);
    expect(result.productCountryRrps).toHaveLength(1);
    expect(result.logisticsCosts).toHaveLength(1);
    expect(result.operationalMargins).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});

function createWorkbook(
  rows: XlsxCell[][],
  stringMode: StringCellMode,
  options: {
    absoluteSheetTarget?: boolean;
    compression?: ZipCompression;
  } = {}
): Buffer {
  const sharedStrings: string[] = [];
  const sharedStringIndexes = new Map<string, number>();
  const sheetXml = createSheetXml(
    rows,
    stringMode,
    sharedStrings,
    sharedStringIndexes
  );
  const files = new Map<string, string>([
    [
      "[Content_Types].xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`
    ],
    [
      "_rels/.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    ],
    [
      "xl/workbook.xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    ],
    [
      "xl/_rels/workbook.xml.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${options.absoluteSheetTarget ? "/xl/worksheets/sheet1.xml" : "worksheets/sheet1.xml"}"/>
</Relationships>`
    ],
    ["xl/worksheets/sheet1.xml", sheetXml]
  ]);

  if (stringMode === "shared") {
    files.set("xl/sharedStrings.xml", createSharedStringsXml(sharedStrings));
  }

  return createZip(files, options.compression ?? "store");
}

function createWorkbookWithSheets(
  sheets: Array<{ name: string; rows: XlsxCell[][] }>,
  stringMode: StringCellMode
): Buffer {
  const sharedStrings: string[] = [];
  const sharedStringIndexes = new Map<string, number>();
  const files = new Map<string, string>([
    [
      "[Content_Types].xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("")}
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`
    ],
    [
      "_rels/.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    ],
    [
      "xl/workbook.xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (sheet, index) =>
          `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
      )
      .join("")}
  </sheets>
</workbook>`
    ],
    [
      "xl/_rels/workbook.xml.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("")}
</Relationships>`
    ]
  ]);

  sheets.forEach((sheet, index) => {
    files.set(
      `xl/worksheets/sheet${index + 1}.xml`,
      createSheetXml(sheet.rows, stringMode, sharedStrings, sharedStringIndexes)
    );
  });

  if (stringMode === "shared") {
    files.set("xl/sharedStrings.xml", createSharedStringsXml(sharedStrings));
  }

  return createZip(files, "store");
}

function createSheetXml(
  rows: XlsxCell[][],
  stringMode: StringCellMode,
  sharedStrings: string[],
  sharedStringIndexes: Map<string, number>
): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          if (cell === null || cell === undefined || cell === "") {
            return "";
          }

          const reference = `${columnName(columnIndex)}${rowNumber}`;
          if (typeof cell === "number") {
            return `<c r="${reference}"><v>${cell}</v></c>`;
          }

          if (stringMode === "inline") {
            return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(
              cell
            )}</t></is></c>`;
          }

          const sharedStringIndex = getSharedStringIndex(
            cell,
            sharedStrings,
            sharedStringIndexes
          );
          return `<c r="${reference}" t="s"><v>${sharedStringIndex}</v></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createSharedStringsXml(strings: string[]): string {
  const items = strings
    .map((value) => `<si><t>${escapeXml(value)}</t></si>`)
    .join("");

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
  ${items}
</sst>`;
}

function getSharedStringIndex(
  value: string,
  sharedStrings: string[],
  sharedStringIndexes: Map<string, number>
): number {
  const existingIndex = sharedStringIndexes.get(value);
  if (existingIndex !== undefined) {
    return existingIndex;
  }

  const nextIndex = sharedStrings.length;
  sharedStrings.push(value);
  sharedStringIndexes.set(value, nextIndex);
  return nextIndex;
}

function createZip(files: Map<string, string>, compression: ZipCompression): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [path, contents] of files) {
    const name = Buffer.from(path);
    const data = Buffer.from(contents);
    const compressedData =
      compression === "deflate" ? deflateRawSync(data) : data;
    const compressionMethod = compression === "deflate" ? 8 : 0;
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, compressedData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + compressedData.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.size, 8);
  endOfCentralDirectory.writeUInt16LE(files.size, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localFiles.length, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, endOfCentralDirectory]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function columnName(index: number): string {
  let name = "";
  let value = index;
  do {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return name;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xml(
  strings: TemplateStringsArray,
  ...values: Array<number | string>
): string {
  return strings.reduce((result, segment, index) => {
    return `${result}${segment}${String(values[index] ?? "")}`;
  }, "");
}

import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { ReferenceData } from "./types";
import { createXlsxWorkbook } from "./exports/xlsxWorkbook";
import { readWorkbookSheetNames, readWorksheetRows } from "./imports/xlsxLite";
import {
  buildBusinessPlanSavedWorkbookBuffer,
  buildBusinessPlanTemplateWorkbookBuffer,
  buildBusinessPlanTemplateWorkbookSheets,
  parseBusinessPlanWorkbook
} from "./businessPlanWorkbook";

describe("business plan workbook", () => {
  it("exports a BP input template with formula-backed value columns", () => {
    const workbook = buildBusinessPlanTemplateWorkbookBuffer({
      data: referenceData(),
      year: 2026
    });
    const sheetNames = readWorkbookSheetNames(workbook);
    const rows = readWorksheetRows(workbook, "BP Input");

    expect(sheetNames.slice(0, 5)).toEqual([
      "Overview",
      "BP Master Data",
      "BP Input",
      "BP Options",
      "Guide"
    ]);
    expect(rows[0]?.cells.slice(0, 6)).toEqual([
      "Year",
      "Month",
      "Quarter",
      "Country",
      "Channel / KA",
      "FD"
    ]);
    expect(rows[1]?.cells[0]).toBe("2026");
    expect(rows[1]?.cells[1]).toBe("January");
    expect(rows[1]?.cells[2]).toBe("Q1");
    expect(rows[1]?.cells[3]).toBe("ES");
    expect(rows[1]?.cells[7]).toBe("CHG-65W-EU");
    expect(rows[0]?.cells[24]).toBe("Promo Discount % (Edit)");
    expect(rows[0]?.cells[25]).toBe("Promo Price Local (Edit)");
    expect(rows[0]?.cells[26]).toBe("Promo Price EUR");
    expect(rows[0]?.cells[27]).toBe("SI Units (Edit)");
    expect(rows[0]?.cells[28]).toBe("SO Units (Edit)");
    expect(rows[1]?.cells[29]).toBe("0");
    expect(rows).toHaveLength(513);
  });

  it("adds dropdown selections for offline BP input fields", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const masterDataSheet = sheets.find((sheet) => sheet.name === "BP Master Data");
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    const optionsSheet = sheets.find((sheet) => sheet.name === "BP Options");

    expect(masterDataSheet?.rows[0]).toEqual([
      "Month",
      "Country",
      "Channel / KA",
      "FD",
      "Incoterms",
      "Power bank KA Buy",
      "Power bank Front",
      "Power bank Back",
      "Power bank FD",
      "Charger KA Buy",
      "Charger Front",
      "Charger Back",
      "Charger FD",
      "Cable KA Buy",
      "Cable Front",
      "Cable Back",
      "Cable FD",
      "Wireless KA Buy",
      "Wireless Front",
      "Wireless Back",
      "Wireless FD",
      "Model code",
      "Currency",
      "Product name",
      "Category",
      "RRP Local",
      "RRP EUR",
      "VAT",
      "Logistics EUR",
      "BOM EUR",
      "",
      "Currency",
      "FX rate to EUR"
    ]);
    expect(masterDataSheet?.tables).toEqual([
      expect.objectContaining({
        name: "BPMasterDataTable",
        ref: "A1:AD502"
      })
    ]);
    expect(inputSheet?.tables).toEqual([
      expect.objectContaining({
        name: "BPInputTable",
        ref: "A1:AI513"
      })
    ]);
    expect(optionsSheet?.hidden).toBe(true);
    expect(optionsSheet?.rows[0]?.slice(0, 10)).toEqual([
      "Month",
      "Country",
      "Channel / KA",
      "FD",
      "Incoterms",
      "Model code",
      "Currency",
      "Product name",
      "Category",
      "Channel Profile"
    ]);
    expect(optionsSheet?.rows.slice(1, 13).map((row) => row[0])).toEqual([
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ]);
    expect(inputSheet?.dataValidations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          formula1: "'BP Options'!$A$2:$A$13",
          ranges: ["B2:B513"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$B$2:$B$4802",
          ranges: ["D2:D513"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$C$2:$C$4802",
          ranges: ["E2:E513"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$D$2:$D$4802",
          ranges: ["F2:F513"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$E$2:$E$4802",
          ranges: ["G2:G513"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$F$2:$F$4802",
          ranges: ["H2:H513"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$G$2:$G$4802",
          ranges: ["K2:K513"],
          type: "list"
        })
      ])
    );
    expect(masterDataSheet?.dataValidations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          formula1: "'BP Options'!$B$2:$B$4802",
          ranges: ["B2:B502"],
          type: "list"
        }),
        expect.objectContaining({
          formula1: "'BP Options'!$F$2:$F$4802",
          ranges: ["V2:V502"],
          type: "list"
        })
      ])
    );
    expect(optionsSheet?.rows.length).toBeGreaterThanOrEqual(1201);
    expect(optionsSheet?.rows[2]?.[2]).toEqual(
      expect.objectContaining({
        formula: expect.stringContaining("BP Master Data")
      })
    );
    expect(sheets.some((sheet) => sheet.name === "BP Quick Add")).toBe(false);
  });

  it("exports a BP Master Data workbook without profile-governed entry sheets", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const masterDataSheet = sheets.find((sheet) => sheet.name === "BP Master Data");
    const dataInputSheet = sheets.find((sheet) => sheet.name === "BP Data Input");
    const setupSheet = sheets.find((sheet) => sheet.name === "BP Channel Setup");
    const overrideSheet = sheets.find(
      (sheet) => sheet.name === "BP Channel Product Overrides"
    );
    const targetSheet = sheets.find(
      (sheet) => sheet.name === "BP New Channel Targets"
    );
    const quickAddSheet = sheets.find((sheet) => sheet.name === "BP Quick Add");

    expect(masterDataSheet?.rows[0]).toEqual([
      "Month",
      "Country",
      "Channel / KA",
      "FD",
      "Incoterms",
      "Power bank KA Buy",
      "Power bank Front",
      "Power bank Back",
      "Power bank FD",
      "Charger KA Buy",
      "Charger Front",
      "Charger Back",
      "Charger FD",
      "Cable KA Buy",
      "Cable Front",
      "Cable Back",
      "Cable FD",
      "Wireless KA Buy",
      "Wireless Front",
      "Wireless Back",
      "Wireless FD",
      "Model code",
      "Currency",
      "Product name",
      "Category",
      "RRP Local",
      "RRP EUR",
      "VAT",
      "Logistics EUR",
      "BOM EUR",
      "",
      "Currency",
      "FX rate to EUR"
    ]);
    expect(dataInputSheet).toBeUndefined();
    expect(setupSheet).toBeUndefined();
    expect(overrideSheet).toBeUndefined();
    expect(targetSheet).toBeUndefined();
    expect(quickAddSheet).toBeUndefined();
  });

  it("imports BP-only rows from BP Master Data margins and BP Input targets", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const masterDataSheet = sheets.find((sheet) => sheet.name === "BP Master Data");
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    const masterDataRow = masterDataSheet?.rows[2];
    const targetRow = inputSheet?.rows[13];

    if (!masterDataRow || !targetRow) {
      throw new Error("Missing BP Master Data or BP Input row");
    }

    masterDataRow[1] = "ES";
    masterDataRow[2] = "New Retail ES";
    masterDataRow[3] = "Breakthrough FD";
    masterDataRow[4] = "DDP";
    masterDataRow[9] = 0.38;
    masterDataRow[10] = 0.35;
    masterDataRow[11] = 0.03;
    masterDataRow[12] = 0.08;

    targetRow[0] = 2026;
    targetRow[1] = "January";
    targetRow[3] = "ES";
    targetRow[4] = "New Retail ES";
    targetRow[5] = "Breakthrough FD";
    targetRow[6] = "DDP";
    targetRow[7] = "CHG-65W-EU";
    targetRow[8] = "65W Charger";
    targetRow[9] = "Charger";
    targetRow[10] = "EUR";
    targetRow[11] = 120;
    targetRow[12] = 120;
    targetRow[14] = 0.38;
    targetRow[15] = 0.35;
    targetRow[16] = 0.03;
    targetRow[17] = 0.08;
    targetRow[18] = 1.5;
    targetRow[19] = 30;
    targetRow[24] = 0.1;
    targetRow[27] = 25;
    targetRow[28] = 20;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        rowKey:
          "bp-assumption:es|new retail es|breakthrough fd|ddp|chg-65w-eu",
        siUnits: 25,
        soUnits: 20,
        promoDiscountPercent: 0.1,
        assumption: expect.objectContaining({
          retailerName: "New Retail ES",
          fdName: "Breakthrough FD",
          kaBuyingMargin: 0.38,
          fdMargin: 0.08
        })
      })
    ]);
    expect(result.channelProfiles).toEqual([]);
  });

  it("imports one market-level Product Price edit across BP input rows", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const masterDataSheet = sheets.find((sheet) => sheet.name === "BP Master Data");
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");

    if (!masterDataSheet || !inputSheet) {
      throw new Error("Missing BP workbook sheets");
    }

    masterDataSheet.rows[1]![25] = 150;
    masterDataSheet.rows[1]![26] = 150;
    inputSheet.rows[1]![11] = 150;
    inputSheet.rows[1]![12] = 150;
    inputSheet.rows[1]![27] = 100;
    inputSheet.rows[1]![28] = 80;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowKey: "bp-assumption:es|mediamarkt es|fd es|ddp|chg-65w-eu",
      siUnits: 100,
      soUnits: 80,
      assumption: expect.objectContaining({
        rrpLocal: 150,
        rrpEur: 150,
        kaBuyingMargin: 0.4
      })
    });
  });

  it("parses edited BP input rows from the template", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    if (!inputSheet) {
      throw new Error("Missing BP Input sheet");
    }

    inputSheet.rows[1]![24] = 0.15;
    inputSheet.rows[1]![27] = 100;
    inputSheet.rows[1]![28] = 80;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: "bp-import-2026-1-bp-assumption:es|mediamarkt es|fd es|ddp|chg-65w-eu",
        rowKey: "bp-assumption:es|mediamarkt es|fd es|ddp|chg-65w-eu",
        year: 2026,
        month: 1,
        promoPriceLocal: null,
        siUnits: 100,
        soUnits: 80,
        promoDiscountPercent: 0.15,
        assumption: expect.objectContaining({
          productSku: "CHG-65W-EU",
          productName: "65W Charger",
          category: "Charger",
          rrpLocal: 120,
          rrpEur: 120,
          bomCostEur: 20,
          logisticsCostEur: 2
        })
      })
    ]);
  });

  it("preserves decimal BP input unit allocations from uploaded workbooks", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    if (!inputSheet) {
      throw new Error("Missing BP Input sheet");
    }

    inputSheet.rows[1]![24] = 0.15;
    inputSheet.rows[1]![27] = 100.3333333333;
    inputSheet.rows[1]![28] = 80.6666666667;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      siUnits: 100.3333333333,
      soUnits: 80.6666666667
    });
  });

  it("imports local-currency promo price from BP input rows", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    if (!inputSheet) {
      throw new Error("Missing BP Input sheet");
    }

    inputSheet.rows[1]![25] = 90;
    inputSheet.rows[1]![27] = 100;
    inputSheet.rows[1]![28] = 80;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowKey: "bp-assumption:es|mediamarkt es|fd es|ddp|chg-65w-eu",
      promoPriceLocal: 90,
      siUnits: 100,
      soUnits: 80
    });
  });

  it("matches edited visible Channel and FD before falling back to hidden Row Key", () => {
    const data = referenceDataWithAlternateFd();
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data,
      year: 2026
    });
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    const januaryOriginalFdRow = inputSheet?.rows.find(
      (row, index) =>
        index > 0 &&
        row[1] === "January" &&
        row[5] === "FD ES" &&
        row[7] === "CHG-65W-EU"
    );
    if (!januaryOriginalFdRow) {
      throw new Error("Missing source FD row");
    }

    januaryOriginalFdRow[5] = "Komsa";
    januaryOriginalFdRow[27] = 100;
    januaryOriginalFdRow[28] = 80;

    const result = parseBusinessPlanWorkbook(createXlsxWorkbook(sheets), data);

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowKey: "bp-assumption:es|mediamarkt es|komsa|ddp|chg-65w-eu",
      siUnits: 100,
      soUnits: 80
    });
  });

  it("imports BP input snapshot rows for products outside formal master data", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    if (!inputSheet) {
      throw new Error("Missing BP Input sheet");
    }

    inputSheet.rows[1]![7] = "NEW-SKU-1";
    inputSheet.rows[1]![8] = "New BP Product";
    inputSheet.rows[1]![9] = "Power bank";
    inputSheet.rows[1]![11] = 199;
    inputSheet.rows[1]![12] = 199;
    inputSheet.rows[1]![19] = 42;
    inputSheet.rows[1]![27] = 100;
    inputSheet.rows[1]![28] = 80;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowKey: "bp-assumption:es|mediamarkt es|fd es|ddp|new-sku-1",
      siUnits: 100,
      soUnits: 80,
      assumption: expect.objectContaining({
        productSku: "NEW-SKU-1",
        productName: "New BP Product",
        category: "Power bank",
        rrpLocal: 199,
        rrpEur: 199,
        bomCostEur: 42
      })
    });
  });

  it("imports BP input snapshot rows when Excel provides zero BOM cost", () => {
    const sheets = buildBusinessPlanTemplateWorkbookSheets({
      data: referenceData(),
      year: 2026
    });
    const inputSheet = sheets.find((sheet) => sheet.name === "BP Input");
    if (!inputSheet) {
      throw new Error("Missing BP Input sheet");
    }

    inputSheet.rows[1]![7] = "NEW-ZERO-BOM";
    inputSheet.rows[1]![8] = "Zero BOM BP Product";
    inputSheet.rows[1]![9] = "Power bank";
    inputSheet.rows[1]![11] = 39.99;
    inputSheet.rows[1]![12] = 39.99;
    inputSheet.rows[1]![18] = 0.9;
    inputSheet.rows[1]![19] = 0;
    inputSheet.rows[1]![27] = 12;
    inputSheet.rows[1]![28] = 10;

    const result = parseBusinessPlanWorkbook(
      createXlsxWorkbook(sheets),
      referenceData()
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowKey: "bp-assumption:es|mediamarkt es|fd es|ddp|new-zero-bom",
      siUnits: 12,
      soUnits: 10,
      assumption: expect.objectContaining({
        productSku: "NEW-ZERO-BOM",
        productName: "Zero BOM BP Product",
        bomCostEur: 0,
        logisticsCostEur: 0.9
      })
    });
  });

  it("exports the latest saved BP state into the input workbook", () => {
    const workbook = buildBusinessPlanSavedWorkbookBuffer({
      data: referenceData(),
      entries: [
        {
          id: "bp-entry-1",
          planYear: 2026,
          planMonth: 3,
          countryCode: "ES",
          retailerName: "MediaMarkt ES",
          fdName: "FD ES",
          incoterms: "DDP",
          category: "Charger",
          productSku: "CHG-65W-EU",
          productName: "65W Charger",
          promoPriceLocal: 99,
          promoDiscountPercent: 0.175,
          siUnits: 120,
          soUnits: 90,
          createdByEmail: "ka@example.test",
          updatedByEmail: "ka@example.test",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ],
      year: 2026
    });
    const sheetNames = readWorkbookSheetNames(workbook);
    const overviewRows = readWorksheetRows(workbook, "Overview");
    const masterDataRows = readWorksheetRows(workbook, "BP Master Data");
    const inputRows = readWorksheetRows(workbook, "BP Input");
    const marchRow = inputRows.find(
      (row) =>
        row.cells[1] === "March" &&
        row.cells[7] === "CHG-65W-EU" &&
        row.cells[27] === "120"
    );

    expect(sheetNames.slice(0, 3)).toEqual([
      "Overview",
      "BP Master Data",
      "BP Input"
    ]);
    expect(overviewRows[0]?.cells[0]).toBe("BP Offline Overview");
    expect(overviewRows.find((row) => row.cells[0] === "Annual SI")?.cells).toEqual([
      "Annual SI",
      "Annual SO",
      "SI Value EUR",
      "SO Value EUR",
      "GP EUR",
      "NP EUR",
      ""
    ]);
    expect(
      overviewRows.find((row) => row.cells[0] === "Monthly SI Trend")
    ).toBeDefined();
    expect(overviewRows.find((row) => row.cells[0] === "Category Mix")).toBeDefined();
    expect(
      overviewRows.find((row) => row.cells[0] === "Monthly Targets")
    ).toBeDefined();
    expect(
      overviewRows.find(
        (row) => row.cells[0] === "Target Analysis - Channel Top 10"
      )
    ).toBeDefined();
    expect(
      overviewRows.find(
        (row) => row.cells[0] === "Target Analysis - Product Top 10"
      )
    ).toBeDefined();
    expect(overviewRows[4]?.cells[0]).toBe("120");
    expect(overviewRows[4]?.cells[1]).toBe("90");
    expect(masterDataRows[0]?.cells[0]).toBe("Month");
    expect(masterDataRows[1]?.cells.slice(0, 5)).toEqual([
      "January",
      "ES",
      "MediaMarkt ES",
      "FD ES",
      "DDP"
    ]);
    expect(masterDataRows[1]?.cells[21]).toBe("CHG-65W-EU");
    expect(marchRow?.cells[24]).toBe("0.175");
    expect(marchRow?.cells[25]).toBe("99");
    expect(marchRow?.cells[27]).toBe("120");
    expect(marchRow?.cells[28]).toBe("90");

    const files = readZipFiles(workbook);
    const overviewXml = requiredText(files, "xl/worksheets/sheet1.xml");
    expect(overviewXml).toContain("SUM(BPInputTable[SI Units (Edit)])");
    expect(overviewXml).toContain(
      "SUMIFS(BPInputTable[SI Value EUR],BPInputTable[Month]"
    );
    expect(overviewXml).toContain(
      "SUMIFS(BPInputTable[SI Units (Edit)],BPInputTable[Channel / KA]"
    );
    expect(overviewXml).toContain(
      "SUMIFS(BPInputTable[SI Units (Edit)],BPInputTable[Model code]"
    );
  });

  it("exports saved BP-only channel assumptions back into the workbook", () => {
    const workbook = buildBusinessPlanSavedWorkbookBuffer({
      data: referenceData(),
      entries: [
        {
          id: "bp-entry-new-channel",
          planYear: 2026,
          planMonth: 2,
          countryCode: "ES",
          retailerName: "New Retail ES",
          fdName: "Breakthrough FD",
          incoterms: "DDP",
          category: "Charger",
          productSku: "CHG-65W-EU",
          productName: "65W Charger",
          promoPriceLocal: 100,
          promoDiscountPercent: 0.1,
          siUnits: 25,
          soUnits: 20,
          source: "BP_ASSUMPTION",
          snapshotCurrency: "EUR",
          snapshotRrpLocal: 120,
          snapshotRrpEur: 120,
          snapshotKaBuyingMargin: 0.38,
          snapshotKaFrontMargin: 0.35,
          snapshotKaBackMargin: 0.03,
          snapshotFdMargin: 0.08,
          snapshotBomCost: 20,
          snapshotLogisticsCost: 2,
          createdByEmail: "ka@example.test",
          updatedByEmail: "ka@example.test",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ],
      year: 2026
    });
    const masterDataRows = readWorksheetRows(workbook, "BP Master Data");
    const inputRows = readWorksheetRows(workbook, "BP Input");
    const februaryMasterDataRow = masterDataRows.find(
      (row) =>
        row.cells[2] === "New Retail ES" &&
        row.cells[3] === "Breakthrough FD"
    );
    const februaryRow = inputRows.find(
      (row) =>
        row.cells[1] === "February" &&
        row.cells[4] === "New Retail ES" &&
        row.cells[5] === "Breakthrough FD"
    );

    expect(februaryMasterDataRow?.cells.slice(0, 5)).toEqual([
      "February",
      "ES",
      "New Retail ES",
      "Breakthrough FD",
      "DDP"
    ]);
    expect(februaryMasterDataRow?.cells[9]).toBe("0.38");
    expect(februaryMasterDataRow?.cells[12]).toBe("0.08");
    expect(februaryRow?.cells[24]).toBe("0.1");
    expect(februaryRow?.cells[25]).toBe("100");
    expect(februaryRow?.cells[27]).toBe("25");
    expect(februaryRow?.cells[28]).toBe("20");
  });

  it("exports BP workbooks with currency number formats and valid style parts", () => {
    const workbook = buildBusinessPlanTemplateWorkbookBuffer({
      data: plReferenceData(),
      year: 2026
    });
    const files = readZipFiles(workbook);
    const contentTypesXml = requiredText(files, "[Content_Types].xml");
    const stylesXml = requiredText(files, "xl/styles.xml");
    const sheetXml = requiredText(files, "xl/worksheets/sheet3.xml");
    const sheetRelsXml = requiredText(files, "xl/worksheets/_rels/sheet3.xml.rels");
    const tableXml = requiredText(files, "xl/tables/table2.xml");

    expect(contentTypesXml).toContain('PartName="/xl/styles.xml"');
    expect(contentTypesXml).toContain('PartName="/xl/tables/table1.xml"');
    expect(contentTypesXml).toContain('PartName="/xl/tables/table2.xml"');
    expect(stylesXml).toContain('formatCode="&quot;PLN&quot; #,##0.00"');
    expect(stylesXml).toContain('formatCode="€#,##0.00"');
    expect(sheetXml).toContain('r="L2" s="');
    expect(sheetXml).toContain('r="M2" s="');
    expect(sheetXml).toContain('r="Z2" s="');
    expect(sheetXml).toContain('r="AD2" s="');
    expect(sheetXml).toContain("<tableParts count=\"1\"");
    expect(sheetRelsXml).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table"');
    expect(tableXml).toContain('name="BPInputTable"');
    expect(tableXml).toContain('ref="A1:AI513"');
  });
});

function readZipFiles(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const files = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX central directory");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = buffer.toString("utf8", nameStart, nameStart + nameLength);
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    files.set(
      name,
      compressionMethod === 8 ? inflateRawSync(data) : Buffer.from(data)
    );
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return files;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Invalid XLSX file");
}

function requiredText(files: Map<string, Buffer>, path: string) {
  const file = files.get(path);
  if (!file) {
    throw new Error(`Missing XLSX part: ${path}`);
  }

  return file.toString("utf8");
}

function plReferenceData(): ReferenceData {
  const data = referenceData();

  return {
    ...data,
    countries: [
      {
        ...data.countries[0]!,
        id: "country-pl",
        name: "Poland",
        code: "PL",
        currency: "PLN"
      }
    ],
    exchangeRates: [
      {
        id: "pln-rate",
        currency: "PLN",
        exchangeRateToEur: 4.3,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        ...data.productCountryRrps[0]!,
        id: "rrp-pl-65w",
        countryId: "country-pl",
        countryCode: "PL",
        rrpLocal: 349.99,
        rrpEur: 81.39,
        currency: "PLN"
      }
    ],
    logisticsCosts: [
      {
        ...data.logisticsCosts[0]!,
        id: "logistics-pl-charger",
        countryId: "country-pl",
        countryCode: "PL"
      }
    ],
    operationalMargins: [
      {
        ...data.operationalMargins[0]!,
        id: "margin-pl",
        countryId: "country-pl",
        countryCode: "PL",
        retailerName: "MEX",
        fdName: "PL Distributor"
      }
    ]
  };
}

function referenceDataWithAlternateFd(): ReferenceData {
  const data = referenceData();

  return {
    ...data,
    operationalMargins: [
      ...data.operationalMargins,
      {
        ...data.operationalMargins[0]!,
        id: "margin-es-komsa",
        fdName: "Komsa"
      }
    ]
  };
}

function referenceData(): ReferenceData {
  return {
    countries: [
      {
        id: "country-es",
        name: "Spain",
        code: "ES",
        vatRate: 0.2,
        currency: "EUR",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    exchangeRates: [
      {
        id: "eur-rate",
        currency: "EUR",
        exchangeRateToEur: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    products: [
      {
        id: "product-65w",
        sku: "CHG-65W-EU",
        name: "65W Charger",
        category: "Charger",
        capacity: "Small",
        lifecycleStatus: "LAUNCHED",
        launchedAt: "2025-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    bomCosts: [
      {
        id: "bom-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        bomCost: 20,
        bomCostRmb: 156,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    logisticsCosts: [
      {
        id: "logistics-es-charger",
        countryId: "country-es",
        countryCode: "ES",
        category: "Charger",
        productSize: "Small",
        logisticsCost: 2,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        id: "rrp-es-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        countryId: "country-es",
        countryCode: "ES",
        rrpLocal: 120,
        rrpEur: 120,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      {
        id: "margin-es",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "MediaMarkt ES",
        fdName: "FD ES",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.4,
        kaFrontMargin: 0.4,
        kaBackMargin: 0,
        fdMargin: 0.1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

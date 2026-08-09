import { inflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import {
  buildPromotionPlanCopyRows,
  buildPromotionPlanCopyTemplateWorkbookBuffer
} from "./promotionPlanCopy";
import { readWorkbookSheetNames, readWorksheetRows } from "./imports/xlsxLite";
import {
  parsePromotionPlanWorkbook,
  promotionPlanBusinessKeyForParts
} from "./promotionPlan";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  ProductOption,
  PromotionPlanEntryOption,
  PromotionPlanMonthStatusOption,
  ReferenceData
} from "./types";

describe("promotion plan month copy", () => {
  test("copies previous-month editable inputs into the target month", () => {
    const result = buildPromotionPlanCopyRows({
      data: referenceData(),
      sourceEntries: [
        promotionPlanEntry({
          planYear: 2026,
          planMonth: 5,
          promoRrpLocal: 29.99,
          promoRrpEur: 29.99,
          promoFrontMargin: 0.35,
          promoVolume: 800
        })
      ],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-05-10T10:00:00.000Z")
    });

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      year: 2026,
      month: 6,
      key: promotionPlanBusinessKeyForParts({
        countryCode: "FR",
        retailerName: "Boulanger",
        fdName: "BBC",
        incoterms: "DDP",
        productSku: "P41L-P1"
      }),
      promoRrpLocal: 29.99,
      promoRrpEur: 29.99,
      promoFrontMargin: 0.35,
      promoVolume: 800,
      promoStartDate: "2026-06-04",
      promoEndDate: "2026-06-18"
    });
  });

  test("clamps copied promo dates to the target month length", () => {
    const result = buildPromotionPlanCopyRows({
      data: referenceData(),
      sourceEntries: [
        promotionPlanEntry({
          planYear: 2026,
          planMonth: 1,
          promoStartDate: "2026-01-30",
          promoEndDate: "2026-01-31"
        })
      ],
      targetMonth: { year: 2026, month: 2 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-01-10T10:00:00.000Z")
    });

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      promoStartDate: "2026-02-28",
      promoEndDate: "2026-02-28"
    });
  });

  test("keeps multiple non-overlapping periods for the same country, channel, and product", () => {
    const result = buildPromotionPlanCopyRows({
      data: referenceData(),
      sourceEntries: [
        promotionPlanEntry({
          id: "period-1",
          promoStartDate: "2026-05-01",
          promoEndDate: "2026-05-10",
          promoRrpLocal: 99
        }),
        promotionPlanEntry({
          id: "period-2",
          promoStartDate: "2026-05-15",
          promoEndDate: "2026-05-25",
          promoRrpLocal: 89
        }),
        promotionPlanEntry({
          id: "period-3",
          promoStartDate: "2026-05-26",
          promoEndDate: "2026-05-30",
          promoRrpLocal: 79
        })
      ],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-05-10T10:00:00.000Z")
    });

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.promoRrpLocal)).toEqual([99, 89, 79]);
    expect(result.rows.map((row) => [row.promoStartDate, row.promoEndDate])).toEqual([
      ["2026-06-01", "2026-06-10"],
      ["2026-06-15", "2026-06-25"],
      ["2026-06-26", "2026-06-30"]
    ]);
  });

  test("does not copy into an approved target month even for admin", () => {
    const result = buildPromotionPlanCopyRows({
      data: referenceData(),
      sourceEntries: [promotionPlanEntry({ planYear: 2026, planMonth: 5 })],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [
        monthStatus({ countryCode: "FR", status: "APPROVED" })
      ],
      accessibleCountryCodes: ["FR"],
      role: "ADMIN",
      now: new Date("2026-05-10T10:00:00.000Z")
    });

    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toContain("approved");
  });

  test("does not copy into a first-approved target month", () => {
    const result = buildPromotionPlanCopyRows({
      data: referenceData(),
      sourceEntries: [promotionPlanEntry({ planYear: 2026, planMonth: 5 })],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [
        monthStatus({ countryCode: "FR", status: "FIRST_APPROVED" })
      ],
      accessibleCountryCodes: ["FR"],
      role: "ADMIN",
      now: new Date("2026-05-10T10:00:00.000Z")
    });

    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toContain("first approved");
  });

  test("does not copy into a deadline-locked target month", () => {
    const result = buildPromotionPlanCopyRows({
      data: referenceData(),
      sourceEntries: [promotionPlanEntry({ planYear: 2026, planMonth: 5 })],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-05-31T22:00:00.000Z")
    });

    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toContain("deadline passed");
  });

  test("exports copied history in the editable target-month template", () => {
    const workbook = buildPromotionPlanCopyTemplateWorkbookBuffer({
      data: referenceData(),
      sourceEntries: [
        promotionPlanEntry({
          planYear: 2026,
          planMonth: 5,
          promotionName: "Summer campaign",
          promoRrpLocal: 34.99,
          promoRrpEur: 34.99,
          promoFrontMargin: 0.35,
          promoVolume: 860
        })
      ],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-05-10T10:00:00.000Z")
    });

    expect(readWorkbookSheetNames(workbook)).toEqual([
      "2026-06",
      "Settlement Evidence",
      "New Launched Products",
      "Period Rules",
      "Promotion Options",
      "Date Options"
    ]);
    expect(parsePromotionPlanWorkbook(workbook, referenceData()).errors).toEqual([]);
    const copiedRow = readWorksheetRows(workbook, "2026-06")[1]?.cells;
    expect(copiedRow?.slice(0, 3)).toEqual([
      "FR",
      "Boulanger",
      "Summer campaign"
    ]);
    expect(copiedRow?.slice(18, 22)).toEqual(["34.99", "34.99", "0.35", "860"]);
    expect(copiedRow?.slice(22, 24)).toEqual([
      "46177",
      "46191"
    ]);
    expect(readWorksheetRows(workbook, "Period Rules")[1]?.cells.slice(3, 5)).toEqual([
      "46177",
      "46191"
    ]);
  });

  test("round-trips multiple periods for one promotion scope through the Excel template", () => {
    const workbook = buildPromotionPlanCopyTemplateWorkbookBuffer({
      data: referenceData(),
      sourceEntries: [
        promotionPlanEntry({
          id: "roundtrip-1",
          promoStartDate: "2026-05-01",
          promoEndDate: "2026-05-10",
          promoRrpLocal: 99
        }),
        promotionPlanEntry({
          id: "roundtrip-2",
          promoStartDate: "2026-05-15",
          promoEndDate: "2026-05-25",
          promoRrpLocal: 89
        }),
        promotionPlanEntry({
          id: "roundtrip-3",
          promoStartDate: "2026-05-26",
          promoEndDate: "2026-05-30",
          promoRrpLocal: 79
        })
      ],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-05-10T10:00:00.000Z")
    });

    const parsed = parsePromotionPlanWorkbook(workbook, referenceData());
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((row) => row.promoRrpLocal)).toEqual([99, 89, 79]);
    expect(parsed.rows.map((row) => [row.promoStartDate, row.promoEndDate])).toEqual([
      ["2026-06-01", "2026-06-10"],
      ["2026-06-15", "2026-06-25"],
      ["2026-06-26", "2026-06-30"]
    ]);
  });

  test("exports source history for an approved or deadline-locked target month", () => {
    const workbook = buildPromotionPlanCopyTemplateWorkbookBuffer({
      data: referenceData(),
      sourceEntries: [
        promotionPlanEntry({
          planYear: 2026,
          planMonth: 8,
          promotionName: "September history copy"
        })
      ],
      targetMonth: { year: 2026, month: 9 },
      targetStatuses: [
        monthStatus({ countryCode: "FR", status: "APPROVED" })
      ],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-09-30T22:00:00.000Z")
    });

    const copiedRow = readWorksheetRows(workbook, "2026-09")[1]?.cells;
    expect(copiedRow?.slice(0, 3)).toEqual([
      "FR",
      "Boulanger",
      "September history copy"
    ]);
  });

  test("exports copy template formulas with Excel recalculation and editing styles", () => {
    const workbook = buildPromotionPlanCopyTemplateWorkbookBuffer({
      data: referenceData(),
      sourceEntries: [promotionPlanEntry({ planYear: 2026, planMonth: 5 })],
      targetMonth: { year: 2026, month: 6 },
      targetStatuses: [],
      accessibleCountryCodes: ["FR"],
      role: "SALES_MANAGER",
      now: new Date("2026-05-10T10:00:00.000Z")
    });
    const files = readZipFiles(workbook);
    const workbookXml = requiredText(files, "xl/workbook.xml");
    const sheetXml = requiredText(files, "xl/worksheets/sheet1.xml");
    const stylesXml = requiredText(files, "xl/styles.xml");
    const workbookRelationshipsXml = requiredText(
      files,
      "xl/_rels/workbook.xml.rels"
    );

    expect(workbookXml).toContain('calcMode="auto"');
    expect(workbookXml).toContain('fullCalcOnLoad="1"');
    expect(workbookRelationshipsXml).toContain("/styles");
    expect(sheetXml).toContain("<sheetViews>");
    expect(sheetXml).toContain('state="frozen"');
    expect(sheetXml).toContain('<autoFilter ref="A1:AK301"/>');
    expect(sheetXml).toContain("<cols>");
    expect(sheetXml).toContain(
      '<col min="11" max="11" width="12" customWidth="1" hidden="1"/>'
    );
    expect(sheetXml).toContain(
      '<col min="18" max="18" width="12" customWidth="1" hidden="1"/>'
    );
    expect(sheetXml).toContain('r="R2" s=');
    expect(sheetXml).toContain('r="S2" s=');
    expect(sheetXml).toContain('r="T2" s=');
    expect(sheetXml).toContain('r="T2" s="12"');
    expect(sheetXml).toContain('r="U2" s="13"');
    expect(sheetXml).toContain('r="V2" s="14"');
    expect(sheetXml).toContain('r="W2" s="17"');
    expect(sheetXml).toContain('r="X2" s="17"');
    expect(sheetXml).toContain("<f>IFERROR(S2*K2/J2,\"\")</f>");
    expect(sheetXml).toContain("<f>IFERROR(K2/(1+L2),\"\")</f>");
    expect(sheetXml).toContain(
      "<f>IFERROR(MAX(0,K2/(1+L2)*(1-M2)-T2/(1+L2)*(1-U2)),\"\")</f>"
    );
    expect(stylesXml).toContain("<numFmt");
    expect(stylesXml).toContain('formatCode="0.00%"');
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
    id: "entry-2026-05-fr-boulanger-powerpaw",
    planYear: 2026,
    planMonth: 5,
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
    promoStartDate: "2026-05-04",
    promoEndDate: "2026-05-18",
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
    createdByEmail: "planner@example.com",
    updatedByEmail: "planner@example.com",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides
  };
}

function monthStatus(
  overrides: Partial<PromotionPlanMonthStatusOption> = {}
): PromotionPlanMonthStatusOption {
  return {
    id: "status-fr-2026-06",
    planYear: 2026,
    planMonth: 6,
    countryCode: "FR",
    status: "DRAFT",
    submittedByEmail: null,
    firstApprovedByEmail: null,
    approvedByEmail: null,
    rejectedByEmail: null,
    submittedAt: null,
    firstApprovedAt: null,
    approvedAt: null,
    rejectedAt: null,
    notes: null,
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

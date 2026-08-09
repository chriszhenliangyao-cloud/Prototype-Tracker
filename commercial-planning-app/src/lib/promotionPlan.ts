import {
  createXlsxWorkbook,
  type WorkbookCell,
  type WorkbookDefinedName,
  type WorkbookSheet
} from "./exports/xlsxWorkbook";
import { formatEuropeanDate } from "./format";
import { readWorkbookSheetNames, readWorksheetRows, type XlsxRow } from "./imports/xlsxLite";
import {
  buildNormalRows,
  type CalculatorFilters,
  type NormalTableRow,
  type PromotionInputsByRow,
  type PromotionTableRow
} from "./calculatorRows";
import {
  defaultPromotionPlanPeriod,
  normalizePromotionPlanPeriod,
  parsePromotionDateInput,
  retargetPromotionDateToMonth,
  validatePromotionDateRange
} from "./promotionPlanDates";
import {
  buildPromotionPlanEligibleRows,
  buildPromotionPlanPromotionRows,
  promotionPlanEntryRowKey
} from "./promotionPlanShared";
import { buildNewLaunchedProductReview } from "./promotionPlanNewLaunch";
import type {
  PromotionPlanDealType,
  PromotionPlanEntryOption,
  ReferenceData
} from "./types";

export {
  defaultPromotionPlanPeriod,
  normalizePromotionPlanPeriod,
  parsePromotionDateInput,
  retargetPromotionDateToMonth,
  validatePromotionDateRange
} from "./promotionPlanDates";

export type PromotionPlanMonth = {
  year: number;
  month: number;
};

export type PromotionPlanSaveRow = {
  key: string;
  entryId?: string | null;
  promoRrpLocal?: number | string | null;
  promoRrpEur?: number | string | null;
  promoFrontMargin?: number | string | null;
  dealType?: PromotionPlanDealType | string | null;
  promoFdMargin?: number | string | null;
  promotionName?: string | null;
  dealNote?: string | null;
  promoVolume?: number | string | null;
  promoStartDate?: string | null;
  promoEndDate?: string | null;
};

export type ParsedPromotionPlanRow = PromotionPlanMonth & {
  key: string;
  countryCode: string;
  retailerName: string;
  promotionName: string | null;
  fdName: string;
  incoterms: string;
  category: string;
  productSku: string;
  productName: string;
  promoRrpLocal: number | null;
  promoRrpEur: number | null;
  promoFrontMargin: number | null;
  dealType: PromotionPlanDealType;
  promoFdMargin: number | null;
  dealNote: string | null;
  promoVolume: number | null;
  promoStartDate: string | null;
  promoEndDate: string | null;
};

export type PromotionPlanRowSnapshot = {
  snapshotCurrency: string | null;
  snapshotLifecycleStatus: PromotionPlanEntryOption["snapshotLifecycleStatus"];
  snapshotRrpLocal: number | null;
  snapshotRrpEur: number | null;
  snapshotVatRate: number | null;
  snapshotBaseFrontMargin: number | null;
  snapshotKaBuyingMargin: number | null;
  snapshotKaBackMargin: number | null;
  snapshotFdMargin: number | null;
  snapshotTransportCost: number | null;
  snapshotBomCost: number | null;
};

export type PromotionPlanImportError = {
  sheetName: string;
  rowNumber: number;
  message: string;
};

export type PromotionPlanImportResult = {
  rows: ParsedPromotionPlanRow[];
  errors: PromotionPlanImportError[];
  monthKeys: string[];
};

type PromotionPlanBusinessParts = {
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  productSku: string;
};

const EDITABLE_HEADERS = [
  "Country",
  "Channel / Retailer",
  "Promotion Name",
  "FD",
  "Incoterms",
  "Model",
  "Category",
  "Product",
  "Lifecycle",
  "RRP Local",
  "RRP EUR",
  "VAT",
  "Base Front Margin",
  "KA Buying Margin",
  "KA Back Margin",
  "FD Margin",
  "Transport",
  "BOM",
  "RRPP Local",
  "RRPP EUR",
  "Promo Front Margin",
  "Promo Volume",
  "Promo Start Date",
  "Promo End Date",
  "After VAT",
  "Promo Rebate",
  "Margin Rebate",
  "Total Rebate",
  "Shipping Price",
  "NP",
  "NP%",
  "Deal Type",
  "Promo FD Margin",
  "FD Margin Impact",
  "Deal Note",
  "Updated By",
  "Planned Launch Date"
];

const PROMOTION_PLAN_COLUMN_WIDTHS = [
  10,
  18,
  22,
  18,
  12,
  14,
  16,
  26,
  13,
  12,
  12,
  9,
  15,
  15,
  14,
  12,
  12,
  12,
  14,
  14,
  17,
  13,
  13,
  13,
  12,
  14,
  14,
  13,
  14,
  12,
  10,
  15,
  15,
  16,
  24,
  24,
  18
];

const PROMOTION_PLAN_HIDDEN_BASELINE_COLUMNS = [10, 11, 12, 13, 14, 15, 16, 17];
const PERIOD_RULES_SHEET_NAME = "Period Rules";
const DATE_OPTIONS_SHEET_NAME = "Date Options";
const PROMOTION_OPTIONS_SHEET_NAME = "Promotion Options";
const NEW_LAUNCHED_PRODUCTS_SHEET_NAME = "New Launched Products";
const SETTLEMENT_EVIDENCE_SHEET_NAME = "Settlement Evidence";
const PROMOTION_OPTIONS_HEADERS = [
  "Country",
  "Model",
  "Category",
  "Product",
  "Lifecycle",
  "Country Product Key",
  "RRP Local",
  "RRP EUR",
  "VAT Country",
  "VAT Rate",
  "Logistics Key",
  "Transport",
  "BOM Model",
  "BOM",
  "Margin Key",
  "Base Front Margin",
  "KA Buying Margin",
  "KA Back Margin",
  "FD Margin",
  "Channel Key",
  "Channel / Retailer",
  "FD Key",
  "FD",
  "Incoterms Key",
  "Incoterms",
  "Planned Launch Date"
];
const PROMOTION_OPTIONS_COLUMN_WIDTHS = [
  12,
  16,
  20,
  32,
  14,
  34,
  14,
  14,
  14,
  12,
  34,
  14,
  16,
  14,
  58,
  18,
  18,
  18,
  14,
  38,
  24,
  48,
  20,
  48,
  16,
  18
];
const PROMOTION_PLAN_VALIDATION_ROW_COUNT = 300;
const PERIOD_RULES_HEADERS = [
  "Month",
  "Country",
  "Channel / Retailer",
  "Promo Start Date",
  "Promo End Date"
];
const PERIOD_RULES_COLUMN_WIDTHS = [12, 10, 24, 16, 16];
const NEW_LAUNCHED_PRODUCTS_HEADERS = [
  "Launch Month",
  "SKU",
  "Product",
  "Category",
  "Launched At",
  "Included in Plan",
  "Available Countries"
];
const NEW_LAUNCHED_PRODUCTS_COLUMN_WIDTHS = [14, 16, 28, 18, 14, 18, 26];
const SETTLEMENT_EVIDENCE_HEADERS = [
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
];
const SETTLEMENT_EVIDENCE_COLUMN_WIDTHS = [
  18,
  12,
  10,
  22,
  18,
  14,
  30,
  18,
  14,
  16,
  16,
  14,
  14,
  16,
  16,
  16,
  13,
  24
];

const HEADER_ALIASES = {
  countryCode: ["country", "country code"],
  retailerName: ["channel / retailer", "channel", "retailer", "ka"],
  promotionName: ["promotion name", "promo name", "campaign name"],
  fdName: ["fd", "distributor"],
  incoterms: ["incoterms", "trade terms"],
  productSku: ["model", "sku"],
  category: ["category"],
  productName: ["product", "product name"],
  promoRrpLocal: ["rrpp local", "promo rrp local", "promotion rrp local"],
  promoRrpEur: ["rrpp eur", "promo rrp eur", "promotion rrp eur", "rrpp"],
  promoFrontMargin: ["promo front margin", "front margin"],
  dealType: ["deal type", "promo deal type", "promotion deal type"],
  promoFdMargin: ["promo fd margin", "fd promo margin", "deal fd margin"],
  dealNote: ["deal note", "promo note", "promotion note", "note"],
  promoVolume: ["promo volume", "volume"],
  promoStartDate: ["promo start date", "start date", "promotion start date"],
  promoEndDate: ["promo end date", "end date", "promotion end date"]
} as const;

export function promotionPlanMonthKey({ year, month }: PromotionPlanMonth) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function promotionPlanSheetName(month: PromotionPlanMonth) {
  return promotionPlanMonthKey(month);
}

export function parsePromotionPlanMonthKey(value: string): PromotionPlanMonth | null {
  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(/^(\d{4})[-_ .]?(0?[1-9]|1[0-2])$/);
  if (!isoMatch) {
    return null;
  }

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  return Number.isInteger(year) && Number.isInteger(month)
    ? { year, month }
    : null;
}

/**
 * Standard monthly uploads target one page month. The workbook sheet name,
 * rather than its file name, controls the month that will be imported. Promo
 * periods can extend into later months; their dates do not change plan month.
 */
export function promotionPlanWorkbookTargetMonthMessage({
  workbookMonths,
  targetMonth
}: {
  workbookMonths: PromotionPlanMonth[];
  targetMonth: PromotionPlanMonth | null;
}) {
  if (!targetMonth || workbookMonths.length !== 1) {
    return null;
  }

  const workbookMonth = workbookMonths[0];
  if (
    workbookMonth.year === targetMonth.year &&
    workbookMonth.month === targetMonth.month
  ) {
    return null;
  }

  const workbookMonthKey = promotionPlanMonthKey(workbookMonth);
  const targetMonthKey = promotionPlanMonthKey(targetMonth);
  return `This workbook uses month worksheet ${workbookMonthKey}, while the page is set to ${targetMonthKey}. File names do not set the plan month. Rename the month worksheet to ${targetMonthKey} and update its Period Rules month before uploading. Promotion periods may cross into later months; only the worksheet name sets the plan month.`;
}

export function promotionPlanBusinessKeyForRow(row: NormalTableRow) {
  return promotionPlanBusinessKeyForParts({
    countryCode: row.countryCode,
    retailerName: row.retailerName,
    fdName: row.fdName,
    incoterms: row.incoterms,
    productSku: row.model
  });
}

export function promotionPlanBusinessKeyForEntry(entry: PromotionPlanEntryOption) {
  return promotionPlanBusinessKeyForParts({
    countryCode: entry.countryCode,
    retailerName: entry.retailerName,
    fdName: entry.fdName,
    incoterms: entry.incoterms,
    productSku: entry.productSku
  });
}

export function promotionPlanBusinessKeyForParts(parts: PromotionPlanBusinessParts) {
  return [
    parts.countryCode,
    parts.retailerName,
    parts.fdName,
    parts.incoterms,
    parts.productSku
  ]
    .map(normalizeBusinessKeyPart)
    .join("|");
}

export function entriesToPromotionInputs(
  rows: NormalTableRow[],
  entries: PromotionPlanEntryOption[]
): PromotionInputsByRow {
  const entriesByRowKey = new Map(
    entries.map((entry) => [promotionPlanEntryRowKey(entry), entry])
  );
  const inputsByRow: PromotionInputsByRow = {};

  for (const row of rows) {
    const entry = entriesByRowKey.get(row.key);
    if (!entry) {
      continue;
    }

    inputsByRow[row.key] = {
      promoRrpLocal: entry.promoRrpLocal ?? undefined,
      promoRrpEur: entry.promoRrpEur ?? undefined,
      promoFrontMargin: entry.promoFrontMargin ?? undefined,
      dealType: entry.dealType ?? "NORMAL",
      promoFdMargin: entry.promoFdMargin ?? undefined,
      promotionName: entry.promotionName ?? undefined,
      dealNote: entry.dealNote ?? undefined,
      promoVolume: entry.promoVolume ?? undefined,
      promoStartDate: entry.promoStartDate ?? undefined,
      promoEndDate: entry.promoEndDate ?? undefined
    };
  }

  return inputsByRow;
}

export function buildPromotionPlanWorkbookBuffer({
  data,
  entries,
  months,
  filters = {},
  lockedCountryCodesByMonth = {}
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  months: PromotionPlanMonth[];
  filters?: CalculatorFilters;
  lockedCountryCodesByMonth?: Record<string, string[]>;
}) {
  return createXlsxWorkbook(
    buildPromotionPlanWorkbookSheets({
      data,
      entries,
      months,
      filters,
      lockedCountryCodesByMonth
    }),
    {
      definedNames: buildPromotionPlanWorkbookDefinedNames({ data, entries, months })
    }
  );
}

export function buildPromotionPlanWorkbookSheets({
  data,
  entries,
  months,
  filters = {},
  lockedCountryCodesByMonth = {}
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  months: PromotionPlanMonth[];
  filters?: CalculatorFilters;
  lockedCountryCodesByMonth?: Record<string, string[]>;
}): WorkbookSheet[] {
  const selectorOptions = buildPromotionPlanWorkbookSelectorOptions({
    data,
    entries,
    months
  });
  const periodRules = new Map<string, Array<{
    monthKey: string;
    countryCode: string;
    retailerName: string;
    startDate: string | null;
    endDate: string | null;
  }>>();

  const monthSheets: WorkbookSheet[] = months.map((month) => {
    const monthKey = promotionPlanMonthKey(month);
    const monthEntries = entries.filter(
      (entry) => entry.planYear === month.year && entry.planMonth === month.month
    );
    const promotionRows = buildPromotionPlanPromotionRows({
      data,
      entries: monthEntries,
      filters,
      lockedCountryCodes: lockedCountryCodesByMonth[monthKey] ?? []
    });
    const entriesByRowKey = new Map(
      monthEntries.map((entry) => [promotionPlanEntryRowKey(entry), entry])
    );
    periodRules.set(monthKey, promotionRowsToPeriodRules(monthKey, promotionRows));
    const dateOptionsRange = dateOptionsRangeForMonth(month, months);
    const validationLastRow = Math.max(
      PROMOTION_PLAN_VALIDATION_ROW_COUNT + 1,
      promotionRows.length + 1
    );
    const workbookRows = promotionRows.map((row, index) =>
      promotionRowToWorkbookRow(
        row,
        entriesByRowKey.get(row.key),
        month,
        index + 2
      )
    );
    const emptyWorkbookRows = Array.from(
      { length: validationLastRow - 1 - workbookRows.length },
      (_item, index) => promotionWorkbookBlankRow(index + workbookRows.length + 2)
    );

    return {
      name: promotionPlanSheetName(month),
      autoFilter: true,
      columnWidths: PROMOTION_PLAN_COLUMN_WIDTHS,
      dataValidations: [
        ...promotionPlanSelectorValidations({
          selectorOptions,
          validationLastRow
        }),
        {
          type: "list",
          formula1: dateOptionsRange,
          ranges: [`W2:X${validationLastRow}`]
        },
        {
          type: "list",
          formula1: '"Normal Promo,B2B Deal,EOL Deal"',
          ranges: [`AF2:AF${validationLastRow}`]
        }
      ],
      hiddenColumns: PROMOTION_PLAN_HIDDEN_BASELINE_COLUMNS,
      freezeTopRows: 1,
      style: "promotionPlan",
      rows: [
        EDITABLE_HEADERS,
        ...workbookRows,
        ...emptyWorkbookRows
      ]
    };
  });

  return [
    ...monthSheets,
    buildSettlementEvidenceSheet({
      data,
      entries,
      months,
      filters,
      lockedCountryCodesByMonth
    }),
    buildNewLaunchedProductsSheet({ data, entries, months }),
    buildPeriodRulesSheet(months, periodRules),
    buildPromotionOptionsSheet(selectorOptions),
    buildDateOptionsSheet(months)
  ];
}

export function parsePromotionPlanWorkbook(
  workbook: Buffer | ArrayBuffer,
  data: ReferenceData,
  snapshotEntries: PromotionPlanEntryOption[] = []
): PromotionPlanImportResult {
  const allRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const allRowsByKey = new Map(
    allRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const allRowsByScopeAndProductName = indexNormalRowsByScopeAndProductName(allRows);
  const snapshotEntriesByMonthKey = new Map(
    snapshotEntries.map((entry) => [
      `${promotionPlanMonthKey({
        year: entry.planYear,
        month: entry.planMonth
      })}|${promotionPlanBusinessKeyForEntry(entry)}`,
      entry
    ])
  );
  const rows: ParsedPromotionPlanRow[] = [];
  const errors: PromotionPlanImportError[] = [];
  const monthKeys = new Set<string>();
  const seenRows = new Set<string>();
  const periodRuleResult = parsePeriodRules(workbook);
  for (const error of periodRuleResult.errors) {
    errors.push(error);
  }

  for (const sheetName of readWorkbookSheetNames(workbook)) {
    const month = parsePromotionPlanMonthKey(sheetName);
    if (!month) {
      continue;
    }

    monthKeys.add(promotionPlanMonthKey(month));
    const eligibleRows = buildPromotionPlanEligibleRows({ data, targetMonth: month });
    const eligibleRowsByKey = new Map(
      eligibleRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
    );
    const eligibleRowsByScopeAndProductName =
      indexNormalRowsByScopeAndProductName(eligibleRows);
    const worksheetRows = readWorksheetRows(workbook, sheetName);
    const headerMatch = findPromotionHeaderRow(worksheetRows);
    if (!headerMatch) {
      errors.push({
        sheetName,
        rowNumber: 1,
        message: "Missing Promotion Plan header row."
      });
      continue;
    }

    const { headerRow, indexes } = headerMatch;
    for (const worksheetRow of worksheetRows.filter(
      (row) => row.rowNumber > headerRow.rowNumber
    )) {
      if (isBlankWorksheetRow(worksheetRow)) {
        continue;
      }

      const parsedRow = parsePromotionWorksheetRow({
        sheetName,
        worksheetRow,
        indexes,
        month,
        allRowsByKey,
        allRowsByScopeAndProductName,
        eligibleRowsByKey,
        eligibleRowsByScopeAndProductName,
        snapshotEntriesByMonthKey,
        periodRulesByMonthCountryChannel: periodRuleResult.rules
      });

      if ("error" in parsedRow) {
        errors.push(parsedRow.error);
        continue;
      }

      const importKey = [
        promotionPlanMonthKey(month),
        parsedRow.row.key,
        parsedRow.row.promoStartDate ?? "",
        parsedRow.row.promoEndDate ?? ""
      ].join("|");
      if (seenRows.has(importKey)) {
        errors.push({
          sheetName,
          rowNumber: worksheetRow.rowNumber,
          message: "Duplicate promotion plan row with the same period for this month."
        });
        continue;
      }

      seenRows.add(importKey);
      rows.push(parsedRow.row);
    }
  }

  if (monthKeys.size === 0) {
    errors.push({
      sheetName: "Workbook",
      rowNumber: 1,
      message: "No month sheets found. Use sheet names like 2026-06."
    });
  }

  return { rows, errors, monthKeys: [...monthKeys].sort() };
}

export function promotionPlanEntriesFromRows(
  rows: PromotionTableRow[],
  month: PromotionPlanMonth,
  userEmail: string | null
): ParsedPromotionPlanRow[] {
  return rows.map((row) => {
    const period = normalizePromotionPlanPeriod({
      month,
      promoStartDate: row.promoStartDate,
      promoEndDate: row.promoEndDate,
      treatInvalidAsBlank: true
    });

    return {
      year: month.year,
      month: month.month,
      key: promotionPlanBusinessKeyForRow(row),
      countryCode: row.countryCode,
      retailerName: row.retailerName,
      promotionName: row.promotionName.trim() || null,
      fdName: row.fdName,
      incoterms: row.incoterms,
      category: row.category,
      productSku: row.model,
      productName: row.productName,
      promoRrpLocal: parseLooseNumber(row.promoRrpLocal),
      promoRrpEur: parseLooseNumber(row.promoRrpEur),
      promoFrontMargin: parseMarginNumber(row.promoFrontMargin),
      dealType: row.dealType,
      promoFdMargin: parseMarginNumber(row.promoFdMargin),
      dealNote: row.dealNote.trim() || null,
      promoVolume: parseInteger(row.promoVolume),
      promoStartDate:
        "error" in period ? null : period.promoStartDate,
      promoEndDate:
        "error" in period ? null : period.promoEndDate
    };
  });
}

export function promotionPlanSnapshotForRow(
  row: NormalTableRow
): PromotionPlanRowSnapshot {
  return {
    snapshotCurrency: row.currency,
    snapshotLifecycleStatus: row.productLifecycleStatus,
    snapshotRrpLocal: row.rrpLocal,
    snapshotRrpEur: row.rrpEur,
    snapshotVatRate: row.vatRate,
    snapshotBaseFrontMargin: row.kaFrontMargin,
    snapshotKaBuyingMargin: row.kaBuyingMargin,
    snapshotKaBackMargin: row.kaBackMargin,
    snapshotFdMargin: row.fdMargin,
    snapshotTransportCost: row.logisticsCost,
    snapshotBomCost: row.bomCost
  };
}

export function promotionPlanFileName(
  prefix: string,
  sourceReference: string,
  createdAt = new Date()
) {
  const timestamp = createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const safeReference = sourceReference.replace(/[^a-z0-9_-]+/gi, "-");
  return `${prefix}-${safeReference}-${timestamp}.xlsx`;
}

function promotionRowToWorkbookRow(
  row: PromotionTableRow,
  entry: PromotionPlanEntryOption | undefined,
  month: PromotionPlanMonth,
  rowNumber: number
): WorkbookSheet["rows"][number] {
  return promotionWorkbookRowCells({
    row,
    entry,
    month,
    rowNumber
  });
}

function promotionWorkbookRowCells({
  row,
  entry,
  month,
  rowNumber
}: {
  row: PromotionTableRow;
  entry: PromotionPlanEntryOption | undefined;
  month: PromotionPlanMonth;
  rowNumber: number;
}): WorkbookCell[] {
  const calculation = row.promotionCalculation;
  const normalCalculation = row.calculation;
  const period = normalizePromotionPlanPeriod({
    month,
    promoStartDate: row.promoStartDate,
    promoEndDate: row.promoEndDate,
    treatInvalidAsBlank: true
  });
  const promoStartDate = "error" in period ? "" : period.promoStartDate;
  const promoEndDate = "error" in period ? "" : period.promoEndDate;
  const formulas = promotionWorkbookFormulas(rowNumber);
  const dealType = row.dealType === "NORMAL" ? "" : promotionPlanDealTypeLabel(row.dealType);
  const promoFdMargin =
    row.dealType === "NORMAL" ? "" : numberOrBlank(row.promoFdMargin);
  const promoFrontMargin = parseMarginNumber(row.promoFrontMargin);
  const usesBaseFrontMargin =
    promoFrontMargin !== null &&
    Math.abs(promoFrontMargin - row.kaFrontMargin) < 0.000001;

  return [
    row.countryCode,
    row.retailerName,
    row.promotionName,
    row.fdName,
    row.incoterms,
    textFormula(formulas.model, row.model),
    textFormula(formulas.category, row.category),
    row.productName,
    textFormula(formulas.lifecycle, lifecycleLabel(row.productLifecycleStatus)),
    formula(formulas.rrpLocal, row.rrpLocal),
    formula(formulas.rrpEur, row.rrpEur),
    formula(formulas.vatRate, row.vatRate),
    formula(formulas.baseFrontMargin, row.kaFrontMargin),
    formula(formulas.kaBuyingMargin, row.kaBuyingMargin),
    formula(formulas.kaBackMargin, row.kaBackMargin),
    formula(formulas.fdMargin, row.fdMargin),
    formula(formulas.transport, row.logisticsCost),
    formula(formulas.bom, row.bomCost),
    numberOrBlank(row.promoRrpLocal),
    formula(formulas.promoRrpEur, parseLooseNumber(row.promoRrpEur)),
    usesBaseFrontMargin
      ? formula(formulas.promoFrontMarginFromBase, promoFrontMargin)
      : numberOrBlank(row.promoFrontMargin),
    numberOrBlank(row.promoVolume),
    dateCellOrBlank(promoStartDate),
    dateCellOrBlank(promoEndDate),
    formula(formulas.afterVat, calculation?.normalRrpExVat ?? normalCalculation?.rrpExVat),
    formula(formulas.promoRebate, calculation?.promoRebatePerUnit),
    formula(formulas.marginRebate, calculation?.marginRebatePerUnit),
    formula(formulas.totalRebate, calculation?.rebatePerUnit),
    formula(formulas.shippingPrice, normalCalculation?.shippingPrice),
    formula(formulas.np, calculation?.np),
    formula(formulas.npPercent, calculation?.npPercent),
    dealType,
    promoFdMargin,
    formula(formulas.fdMarginImpact, calculation?.fdMarginImpact),
    row.dealNote,
    entry?.updatedByEmail ?? entry?.createdByEmail ?? "",
    textFormula(formulas.plannedLaunchAt, row.plannedLaunchAt?.slice(0, 10) ?? "")
  ];
}

function promotionWorkbookBlankRow(
  rowNumber: number
): WorkbookSheet["rows"][number] {
  const formulas = promotionWorkbookFormulas(rowNumber);

  return [
    "",
    "",
    "",
    "",
    "",
    textFormula(formulas.model, ""),
    textFormula(formulas.category, ""),
    "",
    textFormula(formulas.lifecycle, ""),
    formula(formulas.rrpLocal, null),
    formula(formulas.rrpEur, null),
    formula(formulas.vatRate, null),
    formula(formulas.baseFrontMargin, null),
    formula(formulas.kaBuyingMargin, null),
    formula(formulas.kaBackMargin, null),
    formula(formulas.fdMargin, null),
    formula(formulas.transport, null),
    formula(formulas.bom, null),
    "",
    formula(formulas.promoRrpEur, null),
    formula(formulas.promoFrontMarginFromBase, null),
    "",
    "",
    "",
    formula(formulas.afterVat, null),
    formula(formulas.promoRebate, null),
    formula(formulas.marginRebate, null),
    formula(formulas.totalRebate, null),
    formula(formulas.shippingPrice, null),
    formula(formulas.np, null),
    formula(formulas.npPercent, null),
    "",
    "",
    formula(formulas.fdMarginImpact, null),
    "",
    "",
    textFormula(formulas.plannedLaunchAt, "")
  ];
}

function promotionWorkbookFormulas(rowNumber: number) {
  const options = `'${PROMOTION_OPTIONS_SHEET_NAME}'`;
  const productLookup = `MATCH(H${rowNumber},${options}!$D:$D,0)`;
  const countryProductLookup = `MATCH($A${rowNumber}&"|"&$H${rowNumber},${options}!$F:$F,0)`;
  const marginLookup = `MATCH($A${rowNumber}&"|"&$B${rowNumber}&"|"&$D${rowNumber}&"|"&$E${rowNumber}&"|"&$G${rowNumber},${options}!$O:$O,0)`;

  return {
    model: `IF(H${rowNumber}="","",IFERROR(INDEX(${options}!$B:$B,${productLookup}),""))`,
    category: `IF(H${rowNumber}="","",IFERROR(INDEX(${options}!$C:$C,${productLookup}),""))`,
    lifecycle: `IF(H${rowNumber}="","",IFERROR(INDEX(${options}!$E:$E,${productLookup}),""))`,
    rrpLocal: `IFERROR(INDEX(${options}!$G:$G,${countryProductLookup}),"")`,
    rrpEur: `IFERROR(INDEX(${options}!$H:$H,${countryProductLookup}),"")`,
    vatRate: `IFERROR(INDEX(${options}!$J:$J,MATCH($A${rowNumber},${options}!$I:$I,0)),"")`,
    transport: `IFERROR(INDEX(${options}!$L:$L,MATCH($A${rowNumber}&"|"&$H${rowNumber}&"|"&$E${rowNumber},${options}!$K:$K,0)),"")`,
    bom: `IFERROR(INDEX(${options}!$N:$N,MATCH($F${rowNumber},${options}!$M:$M,0)),"")`,
    baseFrontMargin: `IFERROR(INDEX(${options}!$P:$P,${marginLookup}),"")`,
    kaBuyingMargin: `IFERROR(INDEX(${options}!$Q:$Q,${marginLookup}),"")`,
    kaBackMargin: `IFERROR(INDEX(${options}!$R:$R,${marginLookup}),"")`,
    fdMargin: `IFERROR(INDEX(${options}!$S:$S,${marginLookup}),"")`,
    promoRrpEur: `IFERROR(S${rowNumber}*K${rowNumber}/J${rowNumber},"")`,
    promoFrontMarginFromBase: `IF(M${rowNumber}="","",M${rowNumber})`,
    afterVat: `IFERROR(K${rowNumber}/(1+L${rowNumber}),"")`,
    promoRebate: `IFERROR(MAX(0,K${rowNumber}/(1+L${rowNumber})*(1-M${rowNumber})-T${rowNumber}/(1+L${rowNumber})*(1-U${rowNumber})),"")`,
    marginRebate: `IFERROR(K${rowNumber}/(1+L${rowNumber})*(1-N${rowNumber})-K${rowNumber}/(1+L${rowNumber})*(1-M${rowNumber})*(1-O${rowNumber}),"")`,
    totalRebate: `IFERROR(Z${rowNumber}+AA${rowNumber},"")`,
    shippingPrice: `IFERROR(K${rowNumber}/(1+L${rowNumber})*(1-N${rowNumber})*(1-P${rowNumber})-Q${rowNumber},"")`,
    fdMarginImpact: `IFERROR(K${rowNumber}/(1+L${rowNumber})*(1-N${rowNumber})*(1-IF(AG${rowNumber}="",P${rowNumber},AG${rowNumber}))-Q${rowNumber}-AC${rowNumber},"")`,
    np: `IFERROR(AC${rowNumber}+AH${rowNumber}-AB${rowNumber}-R${rowNumber},"")`,
    npPercent: `IFERROR(AD${rowNumber}/(AC${rowNumber}+AH${rowNumber}-AB${rowNumber}),"")`,
    plannedLaunchAt: `IF(H${rowNumber}="","",IFERROR(INDEX(${options}!$Z:$Z,${productLookup}),""))`
  };
}

function formula(formulaText: string, value: number | null | undefined): WorkbookCell {
  return {
    formula: formulaText,
    value: typeof value === "number" && Number.isFinite(value) ? value : null
  };
}

function textFormula(formulaText: string, value: string): WorkbookCell {
  return { formula: formulaText, value };
}

type PromotionPlanWorkbookSelectorOptions = {
  countryCodes: string[];
  productRows: Array<{
    model: string;
    category: string;
    productName: string;
    lifecycle: string;
    plannedLaunchAt: string;
  }>;
  countryProductRows: Array<{
    key: string;
    rrpLocal: number | null;
    rrpEur: number | null;
  }>;
  vatRows: Array<{ countryCode: string; vatRate: number }>;
  logisticsRows: Array<{ key: string; logisticsCost: number | null }>;
  bomRows: Array<{ model: string; bomCost: number | null }>;
  marginRows: Array<{
    key: string;
    kaFrontMargin: number;
    kaBuyingMargin: number;
    kaBackMargin: number;
    fdMargin: number;
  }>;
  channelRows: Array<{ countryCode: string; retailerName: string }>;
  fdRows: Array<{ key: string; fdName: string }>;
  incotermRows: Array<{ key: string; incoterms: string }>;
};

function buildPromotionPlanWorkbookSelectorOptions({
  data,
  entries,
  months = []
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  months?: PromotionPlanMonth[];
}): PromotionPlanWorkbookSelectorOptions {
  const standardRows = buildNormalRows(data, {}, { lifecycle: "VALUE_CHAIN" });
  const preLaunchRows = months.flatMap((targetMonth) =>
    buildPromotionPlanEligibleRows({ data, targetMonth }).filter(
      (row) => row.productLifecycleStatus === "UNLAUNCHED"
    )
  );
  const existingKeys = new Set(entries.map(promotionPlanBusinessKeyForEntry));
  const existingRows = buildNormalRows(data, {}, { lifecycle: "ALL" }).filter((row) =>
    existingKeys.has(promotionPlanBusinessKeyForRow(row))
  );
  const normalRows = [
    ...new Map(
      [...standardRows, ...preLaunchRows, ...existingRows].map((row) => [
        promotionPlanBusinessKeyForRow(row),
        row
      ])
    ).values()
  ];
  const countries = new Set<string>();
  const productsByName = new Map<
    string,
    {
      model: string;
      category: string;
      productName: string;
      lifecycle: string;
      plannedLaunchAt: string;
    }
  >();
  const countryProductsByKey = new Map<
    string,
    { key: string; rrpLocal: number | null; rrpEur: number | null }
  >();
  const vatByCountry = new Map<string, { countryCode: string; vatRate: number }>();
  const logisticsByKey = new Map<
    string,
    { key: string; logisticsCost: number | null }
  >();
  const bomByModel = new Map<string, { model: string; bomCost: number | null }>();
  const marginsByKey = new Map<
    string,
    {
      key: string;
      kaFrontMargin: number;
      kaBuyingMargin: number;
      kaBackMargin: number;
      fdMargin: number;
    }
  >();
  const channelsByBusinessKey = new Map<string, { countryCode: string; retailerName: string }>();
  const fdsByBusinessKey = new Map<string, { key: string; fdName: string }>();
  const incotermsByBusinessKey = new Map<string, { key: string; incoterms: string }>();

  for (const row of normalRows) {
    countries.add(row.countryCode);
    const productNameKey = normalizeBusinessKeyPart(row.productName);
    if (!productsByName.has(productNameKey)) {
      productsByName.set(productNameKey, {
        model: row.model,
        category: row.category,
        productName: row.productName,
        lifecycle: lifecycleLabel(row.productLifecycleStatus),
        plannedLaunchAt: row.plannedLaunchAt?.slice(0, 10) ?? ""
      });
    }
    const countryProductKey = promotionOptionKey(row.countryCode, row.productName);
    if (!countryProductsByKey.has(normalizeBusinessKeyPart(countryProductKey))) {
      countryProductsByKey.set(normalizeBusinessKeyPart(countryProductKey), {
        key: countryProductKey,
        rrpLocal: row.rrpLocal,
        rrpEur: row.rrpEur
      });
    }
    if (!vatByCountry.has(normalizeBusinessKeyPart(row.countryCode))) {
      vatByCountry.set(normalizeBusinessKeyPart(row.countryCode), {
        countryCode: row.countryCode,
        vatRate: row.vatRate
      });
    }
    const logisticsKey = promotionOptionKey(
      row.countryCode,
      row.productName,
      row.incoterms
    );
    if (!logisticsByKey.has(normalizeBusinessKeyPart(logisticsKey))) {
      logisticsByKey.set(normalizeBusinessKeyPart(logisticsKey), {
        key: logisticsKey,
        logisticsCost: row.logisticsCost
      });
    }
    if (!bomByModel.has(normalizeBusinessKeyPart(row.model))) {
      bomByModel.set(normalizeBusinessKeyPart(row.model), {
        model: row.model,
        bomCost: row.bomCost
      });
    }
    const marginKey = promotionOptionKey(
      row.countryCode,
      row.retailerName,
      row.fdName,
      row.incoterms,
      row.category
    );
    if (!marginsByKey.has(normalizeBusinessKeyPart(marginKey))) {
      marginsByKey.set(normalizeBusinessKeyPart(marginKey), {
        key: marginKey,
        kaFrontMargin: row.kaFrontMargin,
        kaBuyingMargin: row.kaBuyingMargin,
        kaBackMargin: row.kaBackMargin,
        fdMargin: row.fdMargin
      });
    }
    channelsByBusinessKey.set(
      normalizeBusinessKeyPart(promotionOptionKey(row.countryCode, row.retailerName)),
      { countryCode: row.countryCode, retailerName: row.retailerName }
    );
    const fdKey = promotionOptionKey(row.countryCode, row.retailerName);
    fdsByBusinessKey.set(
      normalizeBusinessKeyPart(promotionOptionKey(fdKey, row.fdName)),
      { key: fdKey, fdName: row.fdName }
    );
    const incotermKey = promotionOptionKey(row.countryCode, row.retailerName, row.fdName);
    incotermsByBusinessKey.set(
      normalizeBusinessKeyPart(promotionOptionKey(incotermKey, row.incoterms)),
      { key: incotermKey, incoterms: row.incoterms }
    );
  }

  for (const entry of entries) {
    countries.add(entry.countryCode);
    const entryProductName = entry.productName ?? entry.productSku;
    const productNameKey = normalizeBusinessKeyPart(entryProductName);
    if (!productsByName.has(productNameKey)) {
      productsByName.set(productNameKey, {
        model: entry.productSku,
        category: entry.category,
        productName: entryProductName,
        lifecycle: entry.snapshotLifecycleStatus
          ? lifecycleLabel(entry.snapshotLifecycleStatus)
          : "",
        plannedLaunchAt: ""
      });
    }
    channelsByBusinessKey.set(
      normalizeBusinessKeyPart(
        promotionOptionKey(entry.countryCode, entry.retailerName)
      ),
      { countryCode: entry.countryCode, retailerName: entry.retailerName }
    );
    const fdKey = promotionOptionKey(entry.countryCode, entry.retailerName);
    fdsByBusinessKey.set(
      normalizeBusinessKeyPart(promotionOptionKey(fdKey, entry.fdName)),
      { key: fdKey, fdName: entry.fdName }
    );
    const incotermKey = promotionOptionKey(
      entry.countryCode,
      entry.retailerName,
      entry.fdName
    );
    incotermsByBusinessKey.set(
      normalizeBusinessKeyPart(promotionOptionKey(incotermKey, entry.incoterms)),
      { key: incotermKey, incoterms: entry.incoterms }
    );
  }

  return {
    countryCodes: [...countries].sort((left, right) => left.localeCompare(right)),
    productRows: [...productsByName.values()].sort(
      (left, right) =>
        left.productName.localeCompare(right.productName) ||
        left.model.localeCompare(right.model)
    ),
    countryProductRows: [...countryProductsByKey.values()].sort((left, right) =>
      left.key.localeCompare(right.key)
    ),
    vatRows: [...vatByCountry.values()].sort((left, right) =>
      left.countryCode.localeCompare(right.countryCode)
    ),
    logisticsRows: [...logisticsByKey.values()].sort((left, right) =>
      left.key.localeCompare(right.key)
    ),
    bomRows: [...bomByModel.values()].sort((left, right) =>
      left.model.localeCompare(right.model)
    ),
    marginRows: [...marginsByKey.values()].sort((left, right) =>
      left.key.localeCompare(right.key)
    ),
    channelRows: [...channelsByBusinessKey.values()].sort(
      (left, right) =>
        left.countryCode.localeCompare(right.countryCode) ||
        left.retailerName.localeCompare(right.retailerName)
    ),
    fdRows: [...fdsByBusinessKey.values()].sort(
      (left, right) => left.key.localeCompare(right.key) || left.fdName.localeCompare(right.fdName)
    ),
    incotermRows: [...incotermsByBusinessKey.values()].sort(
      (left, right) =>
        left.key.localeCompare(right.key) || left.incoterms.localeCompare(right.incoterms)
    )
  };
}

function buildPromotionPlanWorkbookDefinedNames({
  data,
  entries,
  months = []
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  months?: PromotionPlanMonth[];
}): WorkbookDefinedName[] {
  const selectorOptions = buildPromotionPlanWorkbookSelectorOptions({
    data,
    entries,
    months
  });
  const rowNumbersByCountry = new Map<string, number[]>();
  const rowNumbersByFdKey = new Map<string, number[]>();
  const rowNumbersByIncotermKey = new Map<string, number[]>();

  for (const [index, channel] of selectorOptions.channelRows.entries()) {
    const countryCode = channel.countryCode.toUpperCase();
    const rowNumbers = rowNumbersByCountry.get(countryCode) ?? [];
    rowNumbers.push(index + 2);
    rowNumbersByCountry.set(countryCode, rowNumbers);
  }

  for (const [index, fd] of selectorOptions.fdRows.entries()) {
    const rowNumbers = rowNumbersByFdKey.get(fd.key) ?? [];
    rowNumbers.push(index + 2);
    rowNumbersByFdKey.set(fd.key, rowNumbers);
  }

  for (const [index, incoterm] of selectorOptions.incotermRows.entries()) {
    const rowNumbers = rowNumbersByIncotermKey.get(incoterm.key) ?? [];
    rowNumbers.push(index + 2);
    rowNumbersByIncotermKey.set(incoterm.key, rowNumbers);
  }

  const blankOptionRow = promotionPlanSelectorOptionsBlankRow(selectorOptions);
  return [
    ...promotionPlanScopeDefinedNames({
      rowNumbersByKey: rowNumbersByCountry,
      nameForFirstRow: (_key, firstRow) => promotionPlanChannelDefinedName(String(_key)),
      column: "U"
    }),
    ...promotionPlanScopeDefinedNames({
      rowNumbersByKey: rowNumbersByFdKey,
      nameForFirstRow: (_key, firstRow) => promotionPlanFdDefinedName(firstRow),
      column: "W"
    }),
    ...promotionPlanScopeDefinedNames({
      rowNumbersByKey: rowNumbersByIncotermKey,
      nameForFirstRow: (_key, firstRow) => promotionPlanIncotermDefinedName(firstRow),
      column: "Y"
    }),
    {
      name: promotionPlanFdDefinedName(0),
      formula: `'${PROMOTION_OPTIONS_SHEET_NAME}'!$W$${blankOptionRow}`,
      hidden: true
    },
    {
      name: promotionPlanIncotermDefinedName(0),
      formula: `'${PROMOTION_OPTIONS_SHEET_NAME}'!$Y$${blankOptionRow}`,
      hidden: true
    }
  ];
}

function promotionPlanSelectorValidations({
  selectorOptions,
  validationLastRow
}: {
  selectorOptions: PromotionPlanWorkbookSelectorOptions;
  validationLastRow: number;
}) {
  const optionsRange = (column: string, count: number) =>
    `'${PROMOTION_OPTIONS_SHEET_NAME}'!$${column}$2:$${column}$${Math.max(2, count + 1)}`;

  return [
    {
      type: "list" as const,
      formula1: optionsRange("A", selectorOptions.countryCodes.length),
      ranges: [`A2:A${validationLastRow}`]
    },
    {
      type: "list" as const,
      formula1: 'INDIRECT("PP_CHANNEL_"&UPPER($A2))',
      ranges: [`B2:B${validationLastRow}`]
    },
    {
      type: "list" as const,
      formula1: `INDIRECT("PP_FD_"&IFERROR(MATCH($A2&"|"&$B2,'${PROMOTION_OPTIONS_SHEET_NAME}'!$T:$T,0),0))`,
      ranges: [`D2:D${validationLastRow}`]
    },
    {
      type: "list" as const,
      formula1: `INDIRECT("PP_INCOTERM_"&IFERROR(MATCH($A2&"|"&$B2&"|"&$D2,'${PROMOTION_OPTIONS_SHEET_NAME}'!$X:$X,0),0))`,
      ranges: [`E2:E${validationLastRow}`]
    },
    {
      type: "list" as const,
      formula1: optionsRange("D", selectorOptions.productRows.length),
      ranges: [`H2:H${validationLastRow}`]
    }
  ];
}

function buildPromotionOptionsSheet(
  selectorOptions: PromotionPlanWorkbookSelectorOptions
): WorkbookSheet {
  const rowCount = Math.max(
    1,
    selectorOptions.countryCodes.length,
    selectorOptions.productRows.length,
    selectorOptions.countryProductRows.length,
    selectorOptions.vatRows.length,
    selectorOptions.logisticsRows.length,
    selectorOptions.bomRows.length,
    selectorOptions.marginRows.length,
    selectorOptions.channelRows.length,
    selectorOptions.fdRows.length,
    selectorOptions.incotermRows.length
  );

  return {
    name: PROMOTION_OPTIONS_SHEET_NAME,
    hidden: true,
    columnWidths: PROMOTION_OPTIONS_COLUMN_WIDTHS,
    rows: [
      PROMOTION_OPTIONS_HEADERS,
      ...Array.from({ length: rowCount }, (_item, index) => {
        const product = selectorOptions.productRows[index];
        const countryProduct = selectorOptions.countryProductRows[index];
        const vat = selectorOptions.vatRows[index];
        const logistics = selectorOptions.logisticsRows[index];
        const bom = selectorOptions.bomRows[index];
        const margin = selectorOptions.marginRows[index];
        const channel = selectorOptions.channelRows[index];
        const fd = selectorOptions.fdRows[index];
        const incoterm = selectorOptions.incotermRows[index];
        return [
          selectorOptions.countryCodes[index] ?? "",
          product?.model ?? "",
          product?.category ?? "",
          product?.productName ?? "",
          product?.lifecycle ?? "",
          countryProduct?.key ?? "",
          countryProduct?.rrpLocal ?? "",
          countryProduct?.rrpEur ?? "",
          vat?.countryCode ?? "",
          vat?.vatRate ?? "",
          logistics?.key ?? "",
          logistics?.logisticsCost ?? "",
          bom?.model ?? "",
          bom?.bomCost ?? "",
          margin?.key ?? "",
          margin?.kaFrontMargin ?? "",
          margin?.kaBuyingMargin ?? "",
          margin?.kaBackMargin ?? "",
          margin?.fdMargin ?? "",
          channel
            ? promotionOptionKey(channel.countryCode, channel.retailerName)
            : "",
          channel?.retailerName ?? "",
          fd?.key ?? "",
          fd?.fdName ?? "",
          incoterm?.key ?? "",
          incoterm?.incoterms ?? "",
          product?.plannedLaunchAt ?? ""
        ];
      }),
      Array.from({ length: PROMOTION_OPTIONS_HEADERS.length }, () => "")
    ]
  };
}

function promotionPlanChannelDefinedName(countryCode: string) {
  return `PP_CHANNEL_${countryCode.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
}

function promotionPlanFdDefinedName(firstRow: number) {
  return `PP_FD_${firstRow}`;
}

function promotionPlanIncotermDefinedName(firstRow: number) {
  return `PP_INCOTERM_${firstRow}`;
}

function promotionPlanScopeDefinedNames({
  rowNumbersByKey,
  nameForFirstRow,
  column
}: {
  rowNumbersByKey: Map<string, number[]>;
  nameForFirstRow: (key: string, firstRow: number) => string;
  column: string;
}): WorkbookDefinedName[] {
  return [...rowNumbersByKey.entries()].flatMap(([key, rowNumbers]) => {
    const firstRow = rowNumbers[0];
    const lastRow = rowNumbers[rowNumbers.length - 1];
    if (!firstRow || !lastRow) {
      return [];
    }

    return [{
      name: nameForFirstRow(key, firstRow),
      formula: `'${PROMOTION_OPTIONS_SHEET_NAME}'!$${column}$${firstRow}:$${column}$${lastRow}`,
      hidden: true
    }];
  });
}

function promotionPlanSelectorOptionsBlankRow(
  selectorOptions: PromotionPlanWorkbookSelectorOptions
) {
  return Math.max(
    1,
    selectorOptions.countryCodes.length,
    selectorOptions.productRows.length,
    selectorOptions.countryProductRows.length,
    selectorOptions.vatRows.length,
    selectorOptions.logisticsRows.length,
    selectorOptions.bomRows.length,
    selectorOptions.marginRows.length,
    selectorOptions.channelRows.length,
    selectorOptions.fdRows.length,
    selectorOptions.incotermRows.length
  ) + 2;
}

function promotionOptionKey(...parts: string[]) {
  return parts.map((part) => part.trim()).join("|");
}

function buildPeriodRulesSheet(
  months: PromotionPlanMonth[],
  periodRulesByMonth: Map<string, Array<{
    monthKey: string;
    countryCode: string;
    retailerName: string;
    startDate: string | null;
    endDate: string | null;
  }>>
): WorkbookSheet {
  const ruleRows = months.flatMap((month) => {
    const monthKey = promotionPlanMonthKey(month);
    return periodRulesByMonth.get(monthKey) ?? [];
  });

  return {
    name: PERIOD_RULES_SHEET_NAME,
    autoFilter: true,
    columnWidths: PERIOD_RULES_COLUMN_WIDTHS,
    dataValidations: ruleRows.length > 0
      ? [
          {
            type: "list",
            formula1: allDateOptionsRange(months),
            ranges: [`D2:E${ruleRows.length + 1}`]
          }
        ]
      : [],
    freezeTopRows: 1,
    style: "promotionPeriodRules",
    rows: [
      PERIOD_RULES_HEADERS,
      ...ruleRows.map((rule) => [
        rule.monthKey,
        rule.countryCode,
        rule.retailerName,
        dateCellOrBlank(rule.startDate),
        dateCellOrBlank(rule.endDate)
      ])
    ]
  };
}

function buildNewLaunchedProductsSheet({
  data,
  entries,
  months
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  months: PromotionPlanMonth[];
}): WorkbookSheet {
  const reviewRows = months.flatMap((month) =>
    buildNewLaunchedProductReview({
      data,
      entries,
      targetMonth: month
    }).map((product) => [
      product.launchMonth,
      product.sku,
      product.productName,
      product.category,
      dateCellOrBlank(dateOnly(product.launchedAt)),
      product.includedInPlan
        ? "Yes"
        : product.status === "NO_ACTIVE_PLAN_DATA"
          ? "No active RRP/channel data"
          : "Missing from plan",
      product.availableCountryCodes.length > 0
        ? product.availableCountryCodes.join(", ")
        : "-"
    ])
  );

  return {
    name: NEW_LAUNCHED_PRODUCTS_SHEET_NAME,
    autoFilter: true,
    columnWidths: NEW_LAUNCHED_PRODUCTS_COLUMN_WIDTHS,
    freezeTopRows: 1,
    style: "newLaunchedProducts",
    rows: [NEW_LAUNCHED_PRODUCTS_HEADERS, ...reviewRows]
  };
}

function buildSettlementEvidenceSheet({
  data,
  entries,
  months,
  filters,
  lockedCountryCodesByMonth
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  months: PromotionPlanMonth[];
  filters: CalculatorFilters;
  lockedCountryCodesByMonth: Record<string, string[]>;
}): WorkbookSheet {
  const evidenceRows = months.flatMap((month) => {
    const monthKey = promotionPlanMonthKey(month);
    const monthEntries = entries.filter(
      (entry) => entry.planYear === month.year && entry.planMonth === month.month
    );
    const promotionRows = buildPromotionPlanPromotionRows({
      data,
      entries: monthEntries,
      filters,
      lockedCountryCodes: lockedCountryCodesByMonth[monthKey] ?? []
    });
    const entriesByKey = new Map(
      monthEntries.map((entry) => [promotionPlanBusinessKeyForEntry(entry), entry])
    );

    return promotionRows.map((row) => {
      const period = normalizePromotionPlanPeriod({
        month,
        promoStartDate: row.promoStartDate,
        promoEndDate: row.promoEndDate,
        treatInvalidAsBlank: true
      });
      const promoStartDate = "error" in period ? "" : period.promoStartDate;
      const promoEndDate = "error" in period ? "" : period.promoEndDate;
      const entry = entriesByKey.get(promotionPlanBusinessKeyForRow(row));

      return [
        `PP-${monthKey}-${row.countryCode}`,
        monthKey,
        row.countryCode,
        row.retailerName,
        row.fdName,
        row.model,
        row.productName,
        row.category,
        settlementDealTypeLabel(row.dealType),
        dateCellOrBlank(promoStartDate),
        dateCellOrBlank(promoEndDate),
        numberOrBlank(row.promoRrpLocal),
        numberOrBlank(row.promoRrpEur),
        row.promotionCalculation?.promoRebatePerUnit ?? "",
        row.promotionCalculation?.marginRebatePerUnit ?? "",
        row.promotionCalculation?.rebatePerUnit ?? "",
        numberOrBlank(row.promoVolume),
        entry?.updatedByEmail ?? entry?.createdByEmail ?? ""
      ];
    });
  });

  return {
    name: SETTLEMENT_EVIDENCE_SHEET_NAME,
    autoFilter: true,
    columnWidths: SETTLEMENT_EVIDENCE_COLUMN_WIDTHS,
    freezeTopRows: 1,
    rows: [SETTLEMENT_EVIDENCE_HEADERS, ...evidenceRows]
  };
}

function buildDateOptionsSheet(months: PromotionPlanMonth[]): WorkbookSheet {
  const dates = months.flatMap(monthDateOptions);
  return {
    name: DATE_OPTIONS_SHEET_NAME,
    hidden: true,
    style: "dateOptions",
    rows: [["Date"], ...dates.map((date) => [formatEuropeanDate(date)])]
  };
}

function promotionRowsToPeriodRules(monthKey: string, rows: PromotionTableRow[]) {
  const rowsByCountryChannel = new Map<
    string,
    {
      monthKey: string;
      countryCode: string;
      retailerName: string;
      startDates: Set<string>;
      endDates: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = periodRuleKey({
      monthKey,
      countryCode: row.countryCode,
      retailerName: row.retailerName
    });
    const current =
      rowsByCountryChannel.get(key) ??
      {
        monthKey,
        countryCode: row.countryCode,
        retailerName: row.retailerName,
        startDates: new Set<string>(),
        endDates: new Set<string>()
      };
    const startDate = parsePromotionDateInput(row.promoStartDate);
    const endDate = parsePromotionDateInput(row.promoEndDate);
    if (startDate) {
      current.startDates.add(startDate);
    }
    if (endDate) {
      current.endDates.add(endDate);
    }
    rowsByCountryChannel.set(key, current);
  }

  return [...rowsByCountryChannel.values()]
    .map((rule) => ({
      monthKey: rule.monthKey,
      countryCode: rule.countryCode,
      retailerName: rule.retailerName,
      startDate:
        rule.startDates.size === 1 ? [...rule.startDates][0] ?? null : null,
      endDate: rule.endDates.size === 1 ? [...rule.endDates][0] ?? null : null
    }))
    .sort(
      (left, right) =>
        left.monthKey.localeCompare(right.monthKey) ||
        left.countryCode.localeCompare(right.countryCode) ||
        left.retailerName.localeCompare(right.retailerName)
    );
}

function lifecycleLabel(status: PromotionPlanEntryOption["snapshotLifecycleStatus"]) {
  if (status === "UNLAUNCHED") {
    return "Unlaunched";
  }

  if (status === "EOL") {
    return "EOL";
  }

  return "Launched";
}

type HeaderIndexes = {
  countryCode: number;
  retailerName: number;
  promotionName: number;
  fdName: number;
  incoterms: number;
  productSku: number;
  category: number;
  productName: number;
  promoRrpLocal: number;
  promoRrpEur: number;
  promoFrontMargin: number;
  dealType: number;
  promoFdMargin: number;
  dealNote: number;
  promoVolume: number;
  promoStartDate: number;
  promoEndDate: number;
};

type PeriodRule = {
  startDate: string;
  endDate: string;
};

function findPromotionHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      countryCode: findHeaderIndex(row, HEADER_ALIASES.countryCode),
      retailerName: findHeaderIndex(row, HEADER_ALIASES.retailerName),
      promotionName: findHeaderIndex(row, HEADER_ALIASES.promotionName),
      fdName: findHeaderIndex(row, HEADER_ALIASES.fdName),
      incoterms: findHeaderIndex(row, HEADER_ALIASES.incoterms),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      category: findHeaderIndex(row, HEADER_ALIASES.category),
      productName: findHeaderIndex(row, HEADER_ALIASES.productName),
      promoRrpLocal: findHeaderIndex(row, HEADER_ALIASES.promoRrpLocal),
      promoRrpEur: findHeaderIndex(row, HEADER_ALIASES.promoRrpEur),
      promoFrontMargin: findHeaderIndex(row, HEADER_ALIASES.promoFrontMargin),
      dealType: findHeaderIndex(row, HEADER_ALIASES.dealType),
      promoFdMargin: findHeaderIndex(row, HEADER_ALIASES.promoFdMargin),
      dealNote: findHeaderIndex(row, HEADER_ALIASES.dealNote),
      promoVolume: findHeaderIndex(row, HEADER_ALIASES.promoVolume),
      promoStartDate: findHeaderIndex(row, HEADER_ALIASES.promoStartDate),
      promoEndDate: findHeaderIndex(row, HEADER_ALIASES.promoEndDate)
    };

    if (
      indexes.countryCode >= 0 &&
      indexes.retailerName >= 0 &&
      indexes.fdName >= 0 &&
      indexes.incoterms >= 0 &&
      indexes.productSku >= 0 &&
      (indexes.promoRrpLocal >= 0 || indexes.promoRrpEur >= 0)
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parsePromotionWorksheetRow({
  sheetName,
  worksheetRow,
  indexes,
  month,
  allRowsByKey,
  allRowsByScopeAndProductName,
  eligibleRowsByKey,
  eligibleRowsByScopeAndProductName,
  snapshotEntriesByMonthKey,
  periodRulesByMonthCountryChannel
}: {
  sheetName: string;
  worksheetRow: XlsxRow;
  indexes: HeaderIndexes;
  month: PromotionPlanMonth;
  allRowsByKey: Map<string, NormalTableRow>;
  allRowsByScopeAndProductName: Map<string, NormalTableRow[]>;
  eligibleRowsByKey: Map<string, NormalTableRow>;
  eligibleRowsByScopeAndProductName: Map<string, NormalTableRow[]>;
  snapshotEntriesByMonthKey: Map<string, PromotionPlanEntryOption>;
  periodRulesByMonthCountryChannel: Map<string, PeriodRule>;
}): { row: ParsedPromotionPlanRow } | { error: PromotionPlanImportError } {
  const countryCode = getCell(worksheetRow, indexes.countryCode);
  const retailerName = getCell(worksheetRow, indexes.retailerName);
  const fdName = getCell(worksheetRow, indexes.fdName);
  const incoterms = getCell(worksheetRow, indexes.incoterms);
  const selectedModel = getCell(worksheetRow, indexes.productSku);
  const selectedProductName = getCell(worksheetRow, indexes.productName);
  const modelBusinessKey = promotionPlanBusinessKeyForParts({
    countryCode,
    retailerName,
    fdName,
    incoterms,
    productSku: selectedModel
  });
  const scopeAndProductNameKey = promotionPlanScopeAndProductNameKey({
    countryCode,
    retailerName,
    fdName,
    incoterms,
    productName: selectedProductName
  });
  const allProductCandidates = selectedProductName
    ? allRowsByScopeAndProductName.get(
        scopeAndProductNameKey
      ) ?? []
    : [];
  if (allProductCandidates.length > 1) {
    return {
      error: {
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message: "Product selection is ambiguous for this country/channel/FD scope. Select the Model to identify the product."
      }
    };
  }

  const allProductBaseRow = allProductCandidates[0];
  const businessKey = allProductBaseRow
    ? promotionPlanBusinessKeyForRow(allProductBaseRow)
    : modelBusinessKey;
  const snapshotEntry = snapshotEntriesByMonthKey.get(
    `${promotionPlanMonthKey(month)}|${businessKey}`
  );
  const eligibleProductCandidates = selectedProductName
    ? eligibleRowsByScopeAndProductName.get(
        scopeAndProductNameKey
      ) ?? []
    : [];
  const eligibleProductBaseRow = eligibleProductCandidates[0];
  const baseRow = snapshotEntry
    ? allProductBaseRow ?? allRowsByKey.get(modelBusinessKey)
    : eligibleProductBaseRow ?? eligibleRowsByKey.get(modelBusinessKey);

  if (!baseRow && !snapshotEntry) {
    return {
      error: {
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message:
          "Product is not eligible for this plan month. Unlaunched products require a planned launch date within the planning window and active RRP, BOM, logistics, and channel/FD margin setup."
      }
    };
  }

  const promoRrpLocal = parseLooseNumber(getOptionalCell(worksheetRow, indexes.promoRrpLocal));
  const promoRrpEur = parseLooseNumber(getOptionalCell(worksheetRow, indexes.promoRrpEur));
  if (promoRrpLocal === null && promoRrpEur === null) {
    return {
      error: {
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message: "Missing RRPP Local or RRPP EUR."
      }
    };
  }
  const monthKey = promotionPlanMonthKey(month);
  const periodRule = periodRulesByMonthCountryChannel.get(
    periodRuleKey({
      monthKey,
      countryCode: baseRow?.countryCode ?? snapshotEntry?.countryCode ?? "",
      retailerName: baseRow?.retailerName ?? snapshotEntry?.retailerName ?? ""
    })
  );
  const rowPromoStartDate = getOptionalCell(worksheetRow, indexes.promoStartDate);
  const rowPromoEndDate = getOptionalCell(worksheetRow, indexes.promoEndDate);
  const hasVisiblePromoPeriod =
    String(rowPromoStartDate ?? "").trim() !== "" ||
    String(rowPromoEndDate ?? "").trim() !== "";
  const period = normalizePromotionPlanPeriod({
    month,
    promoStartDate: hasVisiblePromoPeriod
      ? rowPromoStartDate
      : periodRule?.startDate ?? rowPromoStartDate,
    promoEndDate: hasVisiblePromoPeriod
      ? rowPromoEndDate
      : periodRule?.endDate ?? rowPromoEndDate
  });
  if ("error" in period) {
    return {
      error: {
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message: period.error
      }
    };
  }

  return {
    row: {
      ...month,
      key: businessKey,
      countryCode: baseRow?.countryCode ?? snapshotEntry?.countryCode ?? "",
      retailerName: baseRow?.retailerName ?? snapshotEntry?.retailerName ?? "",
      promotionName: normalizeOptionalText(
        getOptionalCell(worksheetRow, indexes.promotionName)
      ),
      fdName: baseRow?.fdName ?? snapshotEntry?.fdName ?? "",
      incoterms: baseRow?.incoterms ?? snapshotEntry?.incoterms ?? "",
      category: baseRow?.category ?? snapshotEntry?.category ?? "",
      productSku: baseRow?.model ?? snapshotEntry?.productSku ?? "",
      productName:
        baseRow?.productName ??
        snapshotEntry?.productName ??
        snapshotEntry?.productSku ??
        "",
      promoRrpLocal,
      promoRrpEur,
      promoFrontMargin: parseMarginNumber(
        getOptionalCell(worksheetRow, indexes.promoFrontMargin)
      ),
      dealType: parsePromotionPlanDealType(
        getOptionalCell(worksheetRow, indexes.dealType)
      ),
      promoFdMargin: parseMarginNumber(
        getOptionalCell(worksheetRow, indexes.promoFdMargin)
      ),
      dealNote: normalizeOptionalText(getOptionalCell(worksheetRow, indexes.dealNote)),
      promoVolume: parseInteger(getOptionalCell(worksheetRow, indexes.promoVolume)),
      promoStartDate: period.promoStartDate,
      promoEndDate: period.promoEndDate
    }
  };
}

function indexNormalRowsByScopeAndProductName(rows: NormalTableRow[]) {
  const rowsByScopeAndProductName = new Map<string, NormalTableRow[]>();

  for (const row of rows) {
    const key = promotionPlanScopeAndProductNameKey({
      countryCode: row.countryCode,
      retailerName: row.retailerName,
      fdName: row.fdName,
      incoterms: row.incoterms,
      productName: row.productName
    });
    const currentRows = rowsByScopeAndProductName.get(key) ?? [];
    currentRows.push(row);
    rowsByScopeAndProductName.set(key, currentRows);
  }

  return rowsByScopeAndProductName;
}

function promotionPlanScopeAndProductNameKey({
  countryCode,
  retailerName,
  fdName,
  incoterms,
  productName
}: {
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  productName: string;
}) {
  return [countryCode, retailerName, fdName, incoterms, productName]
    .map(normalizeBusinessKeyPart)
    .join("|");
}

function parsePeriodRules(workbook: Buffer | ArrayBuffer): {
  rules: Map<string, PeriodRule>;
  errors: PromotionPlanImportError[];
} {
  const rules = new Map<string, PeriodRule>();
  const errors: PromotionPlanImportError[] = [];
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) => normalizeHeader(name) === normalizeHeader(PERIOD_RULES_SHEET_NAME)
  );
  if (!sheetName) {
    return { rules, errors };
  }

  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const headerRow = worksheetRows.find((row) =>
    row.cells.some((cell) => normalizeHeader(cell) === "month")
  );
  if (!headerRow) {
    return { rules, errors };
  }

  const monthIndex = findHeaderIndex(headerRow, ["month"]);
  const countryIndex = findHeaderIndex(headerRow, ["country", "country code"]);
  const retailerIndex = findHeaderIndex(headerRow, [
    "channel / retailer",
    "channel",
    "retailer"
  ]);
  const startIndex = findHeaderIndex(headerRow, HEADER_ALIASES.promoStartDate);
  const endIndex = findHeaderIndex(headerRow, HEADER_ALIASES.promoEndDate);

  if (
    monthIndex < 0 ||
    countryIndex < 0 ||
    retailerIndex < 0 ||
    startIndex < 0 ||
    endIndex < 0
  ) {
    errors.push({
      sheetName,
      rowNumber: headerRow.rowNumber,
      message: "Period Rules sheet is missing required headers."
    });
    return { rules, errors };
  }

  for (const worksheetRow of worksheetRows.filter(
    (row) => row.rowNumber > headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(worksheetRow)) {
      continue;
    }

    const month = parsePromotionPlanMonthKey(getCell(worksheetRow, monthIndex));
    const countryCode = getCell(worksheetRow, countryIndex);
    const retailerName = getCell(worksheetRow, retailerIndex);
    const startValue = getOptionalCell(worksheetRow, startIndex);
    const endValue = getOptionalCell(worksheetRow, endIndex);
    if (!month || !countryCode || !retailerName) {
      continue;
    }

    const hasAnyDate =
      String(startValue ?? "").trim() !== "" || String(endValue ?? "").trim() !== "";
    if (!hasAnyDate) {
      continue;
    }

    const period = normalizePromotionPlanPeriod({
      month,
      promoStartDate: startValue,
      promoEndDate: endValue
    });
    if ("error" in period) {
      errors.push({
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message: period.error
      });
      continue;
    }

    rules.set(
      periodRuleKey({
        monthKey: promotionPlanMonthKey(month),
        countryCode,
        retailerName
      }),
      {
        startDate: period.promoStartDate,
        endDate: period.promoEndDate
      }
    );
  }

  return { rules, errors };
}

function findHeaderIndex(row: XlsxRow, aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return row.cells.findIndex((cell) => normalizedAliases.includes(normalizeHeader(cell)));
}

function getCell(row: XlsxRow, index: number) {
  return index >= 0 ? (row.cells[index] ?? "").trim() : "";
}

function getOptionalCell(row: XlsxRow, index: number) {
  return index >= 0 ? row.cells[index] ?? "" : "";
}

function isBlankWorksheetRow(row: XlsxRow) {
  return row.cells.every((cell) => String(cell ?? "").trim() === "");
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeBusinessKeyPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function numberOrBlank(value: number | string | null | undefined) {
  const parsedValue = parseLooseNumber(value ?? "");
  return parsedValue ?? "";
}

function dateCellOrBlank(value: string | null | undefined): WorkbookCell {
  const date = parsePromotionDateInput(value ?? "");
  return date ? { date } : "";
}

function normalizeOptionalText(value: number | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function parsePromotionPlanDealType(
  value: number | string | null | undefined
): PromotionPlanDealType {
  const normalizedValue = String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (normalizedValue === "b2b" || normalizedValue === "b2b deal") {
    return "B2B_DEAL";
  }

  if (normalizedValue === "eol" || normalizedValue === "eol deal") {
    return "EOL_DEAL";
  }

  return "NORMAL";
}

function promotionPlanDealTypeLabel(value: PromotionPlanDealType) {
  if (value === "B2B_DEAL") {
    return "B2B Deal";
  }

  if (value === "EOL_DEAL") {
    return "EOL Deal";
  }

  return "Normal Promo";
}

function settlementDealTypeLabel(value: PromotionPlanDealType) {
  if (value === "B2B_DEAL") {
    return "B2B Deal";
  }

  if (value === "EOL_DEAL") {
    return "EOL Deal";
  }

  return "Normal";
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function parseLooseNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmedValue = String(value ?? "").trim();
  if (trimmedValue === "" || trimmedValue === "-") {
    return null;
  }

  const normalizedValue = trimmedValue
    .replace(/[%€¥$£\s]/g, "")
    .replace(/,/g, "");
  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseMarginNumber(value: number | string | null | undefined) {
  const parsedValue = parseLooseNumber(value);
  if (parsedValue === null) {
    return null;
  }

  return parsedValue > 1 ? parsedValue / 100 : parsedValue;
}

function parseInteger(value: number | string | null | undefined) {
  const parsedValue = parseLooseNumber(value);
  return parsedValue === null ? null : Math.round(parsedValue);
}

function periodRuleKey({
  monthKey,
  countryCode,
  retailerName
}: {
  monthKey: string;
  countryCode: string;
  retailerName: string;
}) {
  return [
    monthKey,
    normalizeBusinessKeyPart(countryCode),
    normalizeBusinessKeyPart(retailerName)
  ].join("|");
}

function dateOptionsRangeForMonth(
  month: PromotionPlanMonth,
  exportedMonths: PromotionPlanMonth[]
) {
  const dates = monthDateOptions(month);
  const targetIndex = Math.max(
    0,
    exportedMonths.findIndex(
      (item) => promotionPlanMonthKey(item) === promotionPlanMonthKey(month)
    )
  );
  const firstRow =
    exportedMonths
      .slice(0, targetIndex)
      .reduce((sum, item) => sum + monthDateOptions(item).length, 0) + 2;
  const lastRow = firstRow + dates.length - 1;
  return `'${DATE_OPTIONS_SHEET_NAME}'!$A$${firstRow}:$A$${lastRow}`;
}

function allDateOptionsRange(months: PromotionPlanMonth[]) {
  const dates = months.flatMap(monthDateOptions);
  const lastRow = Math.max(2, dates.length + 1);
  return `'${DATE_OPTIONS_SHEET_NAME}'!$A$2:$A$${lastRow}`;
}

function monthDateOptions(month: PromotionPlanMonth) {
  return Array.from({ length: daysInMonth(month.year, month.month) }, (_item, index) =>
    normalizedIsoDate(month.year, month.month, index + 1)
  ).filter((date): date is string => date !== null);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizedIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

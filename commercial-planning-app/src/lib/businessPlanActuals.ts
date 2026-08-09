import {
  isExcel2003XmlWorkbook,
  readExcel2003XmlWorksheetRows,
  readWorkbookSheetNames,
  readWorksheetRows,
  type XlsxRow
} from "./imports/xlsxLite";

export type BusinessPlanActualImportRow = {
  planYear: number;
  planMonth: number;
  countryCode: string;
  customerName: string;
  poNumber: string;
  poDate: Date;
  productModel: string | null;
  productName: string | null;
  sourceLineKey: string;
  siUnits: number;
  siValueEur: number;
};

export type BusinessPlanActualImportError = {
  sheetName: string;
  rowNumber: number;
  message: string;
};

export type BusinessPlanActualImportResult = {
  rows: BusinessPlanActualImportRow[];
  errors: BusinessPlanActualImportError[];
  countryCodes: string[];
};

const poSheetName = "By PO";
const requiredHeaders = [
  "PO #",
  "PO Date",
  "Country",
  "SKU",
  "Qty",
  "Turnover (EUR)"
] as const;

export function parseBusinessPlanActualWorkbook(
  input: Buffer | ArrayBuffer
): BusinessPlanActualImportResult {
  const rows = readPoRows(input);
  const errors: BusinessPlanActualImportError[] = [];
  const header = rows[0]?.cells ?? [];
  const headerIndexes = new Map<string, number>();

  for (const [index, cell] of header.entries()) {
    headerIndexes.set(normalizeHeader(cell), index);
  }

  const missingHeaders = requiredHeaders.filter(
    (headerName) => !headerIndexes.has(normalizeHeader(headerName))
  );
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      countryCodes: [],
      errors: [
        {
          sheetName: poSheetName,
          rowNumber: rows[0]?.rowNumber ?? 1,
          message: `Missing required column(s): ${missingHeaders.join(", ")}.`
        }
      ]
    };
  }

  const poNumberIndex = requiredHeaderIndex(headerIndexes, "PO #");
  const poDateIndex = requiredHeaderIndex(headerIndexes, "PO Date");
  const countryIndex = requiredHeaderIndex(headerIndexes, "Country");
  const customerIndex = findHeaderIndex(headerIndexes, "KA");
  const skuIndex = requiredHeaderIndex(headerIndexes, "SKU");
  const productIndex = findHeaderIndex(headerIndexes, "Product");
  const quantityIndex = requiredHeaderIndex(headerIndexes, "Qty");
  const turnoverIndex = requiredHeaderIndex(headerIndexes, "Turnover (EUR)");
  const importedRows: BusinessPlanActualImportRow[] = [];

  for (const row of rows.slice(1)) {
    if (isPoSubtotalRow(row)) {
      continue;
    }

    const poNumber = cellAt(row, poNumberIndex);
    if (!poNumber) {
      continue;
    }

    const parsedDate = parsePoDate(cellAt(row, poDateIndex));
    const countryCode = cellAt(row, countryIndex).toUpperCase();
    const customerName = cellAt(row, customerIndex) || "Unspecified FD";
    const productModel = cellAt(row, skuIndex) || null;
    const productName = cellAt(row, productIndex) || null;
    const siUnits = parseWorkbookNumber(cellAt(row, quantityIndex));
    const siValueEur = parseWorkbookNumber(cellAt(row, turnoverIndex));

    const rowIssues: string[] = [];
    if (!parsedDate) {
      rowIssues.push("PO Date is missing or invalid.");
    }
    if (!/^[A-Z0-9]{2,5}$/.test(countryCode)) {
      rowIssues.push("Country is missing or invalid.");
    }
    if (!productModel) {
      rowIssues.push("SKU is required for product achievement.");
    }
    if (siUnits === null) {
      rowIssues.push("Qty is missing or invalid.");
    }
    if (siValueEur === null) {
      rowIssues.push("Turnover (EUR) is missing or invalid.");
    }
    if (
      rowIssues.length > 0 ||
      !parsedDate ||
      !productModel ||
      siUnits === null ||
      siValueEur === null
    ) {
      errors.push({
        sheetName: poSheetName,
        rowNumber: row.rowNumber,
        message: rowIssues.join(" ")
      });
      continue;
    }

    const sourceIdentifier =
      cellAt(row, skuIndex) || cellAt(row, productIndex) || "line";
    importedRows.push({
      planYear: parsedDate.getUTCFullYear(),
      planMonth: parsedDate.getUTCMonth() + 1,
      countryCode,
      customerName,
      poNumber,
      poDate: parsedDate,
      productModel,
      productName,
      sourceLineKey: `${poNumber}|${sourceIdentifier}|${row.rowNumber}`,
      siUnits,
      siValueEur
    });
  }

  return {
    rows: importedRows,
    errors,
    countryCodes: [...new Set(importedRows.map((row) => row.countryCode))].sort()
  };
}

export function normalizeBusinessPlanActualCustomer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function readPoRows(input: Buffer | ArrayBuffer): XlsxRow[] {
  if (isExcel2003XmlWorkbook(input)) {
    return readExcel2003XmlWorksheetRows(input, poSheetName);
  }

  const sheetNames = readWorkbookSheetNames(input);
  const sheetName = sheetNames.find(
    (name) => normalizeHeader(name) === normalizeHeader(poSheetName)
  );
  if (!sheetName) {
    throw new Error(`Missing worksheet: ${poSheetName}.`);
  }
  return readWorksheetRows(input, sheetName);
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function requiredHeaderIndex(indexes: Map<string, number>, header: string) {
  const index = indexes.get(normalizeHeader(header));
  if (index === undefined) {
    throw new Error(`Missing required column: ${header}.`);
  }
  return index;
}

function findHeaderIndex(indexes: Map<string, number>, header: string) {
  return indexes.get(normalizeHeader(header)) ?? -1;
}

function cellAt(row: XlsxRow, index: number) {
  return index >= 0 ? (row.cells[index] ?? "").trim() : "";
}

function isPoSubtotalRow(row: XlsxRow) {
  return (
    row.cells.length <= requiredHeaders.length &&
    /\b(?:sub)?total\b/i.test(cellAt(row, 0))
  );
}

function parsePoDate(value: string): Date | null {
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return validUtcDate(
      Number(isoDate[1]),
      Number(isoDate[2]),
      Number(isoDate[3])
    );
  }

  const europeanDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (europeanDate) {
    return validUtcDate(
      Number(europeanDate[3]),
      Number(europeanDate[2]),
      Number(europeanDate[1])
    );
  }

  return null;
}

function validUtcDate(year: number, month: number, day: number): Date | null {
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function parseWorkbookNumber(value: string): number | null {
  const normalized = value.trim().replace(/[€$\s]/g, "");
  if (!normalized) {
    return null;
  }

  const number = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

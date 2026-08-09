import {
  readFirstWorksheetRows,
  readWorkbookSheetNames,
  readWorksheetRows,
  type XlsxRow
} from "./xlsxLite";

export type ImportError = {
  rowNumber: number;
  sheet?: string;
  field?: string;
  message: string;
};

export type ImportParseResult<T> = {
  rows: T[];
  errors: ImportError[];
  duplicateKeys: string[];
};

export type BomProductImportRow = {
  rowNumber: number;
  model: string;
  name: string;
  category: string;
  lifecycleStatus?: ProductLifecycleImportStatus;
  plannedLaunchDate?: string | null;
  bomRmb: number | null;
  bomEur: number;
};

export type ProductLifecycleImportStatus = "LAUNCHED" | "UNLAUNCHED" | "EOL";

export type ProductCountryRrpImportRow = {
  rowNumber: number;
  countryCode: string;
  model: string;
  productName?: string;
  rrpLocal: number;
  rrpEur: number;
  currency: string;
};

export type CountryExchangeImportRow = {
  rowNumber: number;
  countryCode: string;
  currency: string;
  exchangeRateToEur: number;
  vatRate: number;
};

export type LogisticsCostImportRow = {
  rowNumber: number;
  incoterms: string;
  category: string;
  logisticsCostRmb: number | null;
  logisticsCostEur: number;
};

export type OperationalMarginImportRow = {
  rowNumber: number;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  category: string;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  kaBackMargin: number;
  fdMargin: number;
};

export type MasterDataWorkbookImportResult = {
  countries: CountryExchangeImportRow[];
  bomProducts: BomProductImportRow[];
  productCountryRrps: ProductCountryRrpImportRow[];
  logisticsCosts: LogisticsCostImportRow[];
  operationalMargins: OperationalMarginImportRow[];
  errors: ImportError[];
  duplicateKeys: string[];
};

type HeaderMap = Map<string, number>;

type ParseConfig<T> = {
  requiredHeaders: string[];
  parseRow: (
    row: XlsxRow,
    headers: HeaderMap,
    errors: ImportError[]
  ) => T | null;
  keyForRow: (row: T) => string;
};

const BOM_REQUIRED_HEADERS = ["Model", "Name", "Category", "Bom (EUR)"];
const RRP_REQUIRED_HEADERS = [
  "Country",
  "Model",
  "RRP Local",
  "RRP EUR",
  "Currency"
];
const MARGIN_REQUIRED_HEADERS = [
  "Country",
  "Retailer",
  "FD",
  "Incoterms",
  "Category",
  "KA buying margin",
  "KA front margin",
  "KA back margin",
  "FD Margin"
];
const RRP_WITH_EXR_REQUIRED_HEADERS = ["Country", "Model", "RRP Local", "Currency"];
const LOGISTICS_REQUIRED_HEADERS = ["Incoterms", "Category", "EUR"];

const MASTER_DATA_SHEETS = {
  bom: "Bom cost",
  rrp: "RRP",
  margin: "Margin data",
  logistics: "Logistic cost",
  exr: "EXR"
} as const;

const MASTER_DATA_SHEET_ALIASES: Record<
  keyof typeof MASTER_DATA_SHEETS,
  string[]
> = {
  bom: ["BOM cost", "Bom", "BOM", "BOM成本"],
  rrp: ["RRP data", "Country RRP", "RRP定价"],
  margin: ["Margin", "Margins", "Margin Data", "渠道Margin", "毛利数据"],
  logistics: [
    "Logistics cost",
    "Logistic costs",
    "Logistics costs",
    "Transport cost",
    "物流成本",
    "运输成本"
  ],
  exr: ["FX", "Exchange rate", "Exchange rates", "VAT", "汇率"]
};

const HEADER_ALIASES: Record<string, string[]> = {
  Model: [
    "SKU",
    "Model Code",
    "Product Model",
    "Model / SKU",
    "SKU / Model",
    "型号",
    "产品型号",
    "商品型号"
  ],
  Name: [
    "Product",
    "Product Name",
    "Product Title",
    "产品",
    "产品名称",
    "商品名称",
    "品名"
  ],
  Category: ["Product Category", "品类", "类别", "产品品类"],
  "Lifecycle Status": [
    "Lifecycle",
    "Product Lifecycle",
    "Product Status",
    "Launch Status",
    "Listing Status",
    "Stage",
    "Progress",
    "Status",
    "进度",
    "状态",
    "上市状态",
    "生命周期"
  ],
  "Planned Launch Date": [
    "Planned Launch",
    "Planned Launch Month",
    "Launch Plan Date",
    "Expected Launch Date",
    "Expected Launch",
    "Planned Go Live Date",
    "预计上市日期",
    "计划上市日期",
    "上市计划日期"
  ],
  "Bom (EUR)": [
    "BOM EUR",
    "BOM(EUR)",
    "BOM (EUR)",
    "BOM Cost EUR",
    "BOM Cost (EUR)",
    "BOM €",
    "BOM欧元",
    "BOM成本EUR",
    "BOM（EUR）"
  ],
  "Bom (RMB)": [
    "BOM RMB",
    "BOM(RMB)",
    "BOM (RMB)",
    "BOM Cost RMB",
    "BOM Cost (RMB)",
    "BOM ¥",
    "BOM人民币",
    "BOM成本RMB",
    "BOM（RMB）"
  ],
  Country: [
    "Country Code",
    "Country / Market",
    "Market",
    "国家",
    "国家代码",
    "市场"
  ],
  "RRP Local": [
    "RRP",
    "RRPP",
    "RRP Local Currency",
    "RRP (Local)",
    "Local RRP",
    "Local RRPP",
    "RRPP Local",
    "RRP 本币",
    "RRP本币",
    "RRP当地币",
    "当地RRP",
    "本币RRP"
  ],
  "RRP EUR": [
    "RRP(EUR)",
    "RRP (EUR)",
    "RRP EURO",
    "RRPP EUR",
    "EUR RRP",
    "RRP €",
    "RRP欧元",
    "欧元RRP",
    "RRP（EUR）"
  ],
  Currency: ["Currency Code", "币种", "货币"],
  EUR: [
    "Logistics EUR",
    "Logistic EUR",
    "Transport EUR",
    "Transportation EUR",
    "EUR Cost",
    "Logistics Cost EUR",
    "物流EUR",
    "物流成本EUR",
    "运输成本EUR"
  ],
  RMB: [
    "CNY",
    "RMB Cost",
    "Logistics RMB",
    "Logistic RMB",
    "Transport RMB",
    "Logistics Cost RMB",
    "物流RMB",
    "物流成本RMB",
    "运输成本RMB"
  ],
  EXR: ["Exchange Rate", "FX", "FX Rate", "汇率"],
  VAT: ["VAT Rate", "Tax Rate", "增值税", "税率"],
  Retailer: [
    "KA",
    "KA/Retailer",
    "KA / Retailer",
    "Channel",
    "Customer",
    "Retail Partner",
    "客户",
    "零售商",
    "渠道",
    "KA客户",
    "渠道客户"
  ],
  FD: ["Distributor", "FD Name", "分销商", "代理商", "FD名称"],
  Incoterms: ["Incoterm", "Trade Terms", "贸易条款", "交易条款"],
  "KA buying margin": [
    "KA Margin",
    "KA Margin %",
    "KA Buying Margin %",
    "KA Buying Margin Percent",
    "Buying Margin",
    "统一KA Margin",
    "预设KA毛利",
    "KA预设毛利",
    "KA采购毛利",
    "KA买入毛利"
  ],
  "KA front margin": [
    "KA Front",
    "KA Front %",
    "KA Front Margin %",
    "KA Front Margin Percent",
    "Front Margin",
    "前台毛利",
    "前端毛利",
    "KA前台毛利"
  ],
  "KA back margin": [
    "KA Back",
    "KA Back %",
    "KA Back Margin %",
    "KA Back Margin Percent",
    "Back Margin",
    "后台毛利",
    "后端毛利",
    "KA后台毛利"
  ],
  "FD Margin": [
    "FD Margin %",
    "FD Margin Percent",
    "Distributor Margin",
    "FD毛利",
    "分销商毛利",
    "代理商毛利"
  ]
};

const HEADER_ALIAS_LOOKUP = buildHeaderAliasLookup();

export function parseBomProductWorkbook(
  buffer: Buffer | ArrayBuffer
): ImportParseResult<BomProductImportRow> {
  return parseWorkbook(buffer, {
    requiredHeaders: BOM_REQUIRED_HEADERS,
    parseRow: parseBomProductRow,
    keyForRow: (row) => row.model
  });
}

export function parseRrpWorkbook(
  buffer: Buffer | ArrayBuffer
): ImportParseResult<ProductCountryRrpImportRow> {
  return parseWorkbook(buffer, {
    requiredHeaders: RRP_REQUIRED_HEADERS,
    parseRow: parseRrpRow,
    keyForRow: (row) => `${row.countryCode}|${row.model}`
  });
}

export function parseMarginWorkbook(
  buffer: Buffer | ArrayBuffer
): ImportParseResult<OperationalMarginImportRow> {
  return parseWorkbook(buffer, {
    requiredHeaders: MARGIN_REQUIRED_HEADERS,
    parseRow: parseMarginRow,
    keyForRow: (row) =>
      [
        row.countryCode,
        row.retailerName,
        row.fdName,
        row.incoterms,
        row.category
      ].join("|")
  });
}

export function parseMasterDataWorkbook(
  buffer: Buffer | ArrayBuffer
): MasterDataWorkbookImportResult {
  try {
    readWorkbookSheetNames(buffer);
  } catch (error) {
    const result = invalidWorkbookResult<never>(error);
    return emptyMasterDataWorkbookResult(result.errors);
  }

  const errors: ImportError[] = [];
  const duplicateKeys: string[] = [];

  const countriesResult = parseNamedWorksheet(
    buffer,
    "exr",
    MASTER_DATA_SHEETS.exr,
    parseCountryExchangeWorksheet
  );
  pushResultProblems(MASTER_DATA_SHEETS.exr, countriesResult, errors, duplicateKeys);
  const countryByCode = new Map(
    countriesResult.rows.map((country) => [country.countryCode, country])
  );

  const bomResult = parseNamedWorksheet(buffer, "bom", MASTER_DATA_SHEETS.bom, (rows) =>
    parseWorksheet(rows, {
      requiredHeaders: BOM_REQUIRED_HEADERS,
      parseRow: parseBomProductRow,
      keyForRow: (row) => row.model
    })
  );
  pushResultProblems(MASTER_DATA_SHEETS.bom, bomResult, errors, duplicateKeys);

  const rrpResult = parseNamedWorksheet(buffer, "rrp", MASTER_DATA_SHEETS.rrp, (rows) =>
    parseRrpWorksheetWithExchange(rows, countryByCode)
  );
  pushResultProblems(MASTER_DATA_SHEETS.rrp, rrpResult, errors, duplicateKeys);

  const logisticsResult = parseNamedWorksheet(
    buffer,
    "logistics",
    MASTER_DATA_SHEETS.logistics,
    parseLogisticsCostWorksheet
  );
  pushResultProblems(
    MASTER_DATA_SHEETS.logistics,
    logisticsResult,
    errors,
    duplicateKeys
  );

  const marginResult = parseNamedWorksheet(buffer, "margin", MASTER_DATA_SHEETS.margin, (rows) =>
    parseWorksheet(rows, {
      requiredHeaders: MARGIN_REQUIRED_HEADERS,
      parseRow: parseMarginRowWithRetailerFallback,
      keyForRow: (row) =>
        [
          row.countryCode,
          row.retailerName,
          row.fdName,
          row.incoterms,
          row.category
        ].join("|")
    })
  );
  pushResultProblems(MASTER_DATA_SHEETS.margin, marginResult, errors, duplicateKeys);

  return {
    countries: countriesResult.rows,
    bomProducts: bomResult.rows,
    productCountryRrps: rrpResult.rows,
    logisticsCosts: logisticsResult.rows,
    operationalMargins: marginResult.rows,
    errors,
    duplicateKeys
  };
}

function parseWorkbook<T>(
  buffer: Buffer | ArrayBuffer,
  config: ParseConfig<T>
): ImportParseResult<T> {
  let worksheetRows: XlsxRow[];
  try {
    worksheetRows = readFirstWorksheetRows(buffer);
  } catch (error) {
    return invalidWorkbookResult(error);
  }

  return parseWorksheet(worksheetRows, config);
}

function parseNamedWorksheet<T>(
  buffer: Buffer | ArrayBuffer,
  sheetKey: keyof typeof MASTER_DATA_SHEETS,
  sheetName: string,
  parser: (worksheetRows: XlsxRow[]) => ImportParseResult<T>
): ImportParseResult<T> {
  try {
    const actualSheetName = resolveSheetName(buffer, sheetName, [
      sheetName,
      ...MASTER_DATA_SHEET_ALIASES[sheetKey]
    ]);
    return parser(readWorksheetRows(buffer, actualSheetName));
  } catch (error) {
    return invalidWorkbookResult(error);
  }
}

function resolveSheetName(
  buffer: Buffer | ArrayBuffer,
  expectedSheetName: string,
  aliases: string[]
): string {
  const sheetNames = readWorkbookSheetNames(buffer);
  const normalizedAliases = new Set(aliases.map(normalizeSheetName));
  const exactMatch = sheetNames.find((name) =>
    normalizedAliases.has(normalizeSheetName(name))
  );

  if (exactMatch) {
    return exactMatch;
  }

  const compactAliases = new Set(aliases.map((name) => compactHeader(name)));
  const compactMatch = sheetNames.find((name) =>
    compactAliases.has(compactHeader(name))
  );

  if (compactMatch) {
    return compactMatch;
  }

  throw new Error(`Missing worksheet: ${expectedSheetName}`);
}

function parseWorksheet<T>(
  worksheetRows: XlsxRow[],
  config: ParseConfig<T>
): ImportParseResult<T> {
  const headerCandidate = findHeaderRow(
    worksheetRows,
    config.requiredHeaders
  );
  const headerRowIndex = headerCandidate.index;
  const headerRow = headerCandidate.row;
  const headers = headerCandidate.headers;
  const missingHeaders = headerCandidate.missingHeaders;

  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: headerRow?.rowNumber ?? 1,
          message: `Missing required columns: ${missingHeaders.join(", ")}`
        }
      ],
      duplicateKeys: []
    };
  }

  const errors: ImportError[] = [];
  const rowByKey = new Map<string, T>();
  const duplicateKeys: string[] = [];
  const duplicateKeySet = new Set<string>();

  for (const row of worksheetRows.slice(headerRowIndex + 1)) {
    if (isBlankRow(row)) {
      continue;
    }

    const parsedRow = config.parseRow(row, headers, errors);
    if (!parsedRow) {
      continue;
    }

    const key = config.keyForRow(parsedRow);
    if (rowByKey.has(key) && !duplicateKeySet.has(key)) {
      duplicateKeys.push(key);
      duplicateKeySet.add(key);
    }
    rowByKey.set(key, parsedRow);
  }

  return {
    rows: [...rowByKey.values()],
    errors,
    duplicateKeys
  };
}

function emptyMasterDataWorkbookResult(
  errors: ImportError[]
): MasterDataWorkbookImportResult {
  return {
    countries: [],
    bomProducts: [],
    productCountryRrps: [],
    logisticsCosts: [],
    operationalMargins: [],
    errors,
    duplicateKeys: []
  };
}

function pushResultProblems<T>(
  sheet: string,
  result: ImportParseResult<T>,
  errors: ImportError[],
  duplicateKeys: string[]
) {
  errors.push(...result.errors.map((error) => ({ ...error, sheet })));
  duplicateKeys.push(...result.duplicateKeys.map((key) => `${sheet}:${key}`));
}

function parseCountryExchangeWorksheet(
  worksheetRows: XlsxRow[]
): ImportParseResult<CountryExchangeImportRow> {
  const headerCandidate = findHeaderRow(worksheetRows, ["EXR", "VAT"]);
  const headerRowIndex = headerCandidate.index;
  const headerRow = headerCandidate.row;
  const headers = headerCandidate.headers;
  const exrIndex = headers.get(canonicalHeader("EXR"));
  const vatIndex = headers.get(canonicalHeader("VAT"));

  if (exrIndex === undefined || vatIndex === undefined) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: headerRow?.rowNumber ?? 1,
          message: `Missing required columns: ${[
            exrIndex === undefined ? "EXR" : "",
            vatIndex === undefined ? "VAT" : ""
          ]
            .filter(Boolean)
            .join(", ")}`
        }
      ],
      duplicateKeys: []
    };
  }

  const currencyIndex =
    headers.get(canonicalHeader("Currency")) ?? Math.max(0, exrIndex - 1);
  const errors: ImportError[] = [];
  const rowByKey = new Map<string, CountryExchangeImportRow>();
  const duplicateKeys: string[] = [];
  const duplicateKeySet = new Set<string>();

  for (const row of worksheetRows.slice(headerRowIndex + 1)) {
    if (isBlankRow(row)) {
      continue;
    }

    const parsedRow = parseCountryExchangeRowByIndex(
      row,
      currencyIndex,
      exrIndex,
      vatIndex,
      errors
    );
    if (!parsedRow) {
      continue;
    }

    if (rowByKey.has(parsedRow.countryCode) && !duplicateKeySet.has(parsedRow.countryCode)) {
      duplicateKeys.push(parsedRow.countryCode);
      duplicateKeySet.add(parsedRow.countryCode);
    }
    rowByKey.set(parsedRow.countryCode, parsedRow);
  }

  return {
    rows: [...rowByKey.values()],
    errors,
    duplicateKeys
  };
}

function parseCountryExchangeRowByIndex(
  row: XlsxRow,
  currencyIndex: number,
  exrIndex: number,
  vatIndex: number,
  errors: ImportError[]
): CountryExchangeImportRow | null {
  const countryCode = (row.cells[0] ?? "").trim().toUpperCase();
  const currencyPair = (row.cells[currencyIndex] ?? "").trim();
  const exchangeRateToEur = parseNumber(row.cells[exrIndex] ?? "");
  const vatRate = parsePercent(row.cells[vatIndex] ?? "");
  const currency = parseCurrencyFromPair(currencyPair || null);

  if (countryCode === "") {
    errors.push({
      rowNumber: row.rowNumber,
      field: "Country",
      message: "Required value"
    });
  }
  if (currencyPair === "") {
    errors.push({
      rowNumber: row.rowNumber,
      field: "Currency",
      message: "Required value"
    });
  } else if (currency === null) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "Currency",
      message: "Invalid currency code"
    });
  }
  if (exchangeRateToEur === null || exchangeRateToEur <= 0) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "EXR",
      message: "Invalid number"
    });
  }
  if (vatRate === null) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "VAT",
      message: "Invalid number"
    });
  }

  if (
    countryCode === "" ||
    currency === null ||
    exchangeRateToEur === null ||
    exchangeRateToEur <= 0 ||
    vatRate === null
  ) {
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    countryCode,
    currency,
    exchangeRateToEur,
    vatRate
  };
}

function parseRrpWorksheetWithExchange(
  worksheetRows: XlsxRow[],
  countryByCode: Map<string, CountryExchangeImportRow>
): ImportParseResult<ProductCountryRrpImportRow> {
  return parseWorksheet(worksheetRows, {
    requiredHeaders: RRP_WITH_EXR_REQUIRED_HEADERS,
    parseRow: (row, headers, errors) =>
      parseRrpRowWithExchange(row, headers, errors, countryByCode),
    keyForRow: (row) => `${row.countryCode}|${row.model}`
  });
}

function parseRrpRowWithExchange(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[],
  countryByCode: Map<string, CountryExchangeImportRow>
): ProductCountryRrpImportRow | null {
  const countryCode = parseRequiredText(row, headers, "Country", errors);
  const model = parseRequiredText(row, headers, "Model", errors);
  const productName = readText(row, headers, "Name");
  const currency = parseCurrencyCode(row, headers, "Currency", errors);
  const rrpLocal = parseRequiredNumber(row, headers, "RRP Local", errors);

  if (
    countryCode === null ||
    model === null ||
    currency === null ||
    rrpLocal === null
  ) {
    return null;
  }

  const normalizedCountryCode = countryCode.toUpperCase();
  const countryExchange = countryByCode.get(normalizedCountryCode);
  if (!countryExchange) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "Country",
      message: `Missing EXR row for ${normalizedCountryCode}`
    });
    return null;
  }

  if (currency !== countryExchange.currency) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "Currency",
      message: `Currency ${currency} does not match EXR currency ${countryExchange.currency}`
    });
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    countryCode: normalizedCountryCode,
    model,
    productName: productName || undefined,
    rrpLocal,
    rrpEur: roundCurrency(rrpLocal / countryExchange.exchangeRateToEur),
    currency
  };
}

function parseLogisticsCostWorksheet(
  worksheetRows: XlsxRow[]
): ImportParseResult<LogisticsCostImportRow> {
  return parseWorksheet(worksheetRows, {
    requiredHeaders: LOGISTICS_REQUIRED_HEADERS,
    parseRow: parseLogisticsCostRow,
    keyForRow: (row) => `${row.incoterms}|${row.category}`
  });
}

function parseLogisticsCostRow(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): LogisticsCostImportRow | null {
  const incoterms = parseRequiredText(row, headers, "Incoterms", errors);
  const category = parseRequiredText(row, headers, "Category", errors);
  const logisticsCostEur = parseRequiredNumber(row, headers, "EUR", errors);
  const logisticsCostRmb = parseOptionalNumber(row, headers, "RMB", errors);

  if (
    incoterms === null ||
    category === null ||
    logisticsCostEur === null ||
    logisticsCostRmb === undefined
  ) {
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    incoterms: incoterms.toUpperCase(),
    category,
    logisticsCostRmb,
    logisticsCostEur
  };
}

function parseCurrencyFromPair(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const currency = value.split("/")[0]?.trim().toUpperCase() ?? "";
  return isValidCurrencyCode(currency) ? currency : null;
}

function roundCurrency(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function invalidWorkbookResult<T>(error: unknown): ImportParseResult<T> {
  const message = error instanceof Error ? error.message : "Invalid XLSX file";

  return {
    rows: [],
    errors: [
      {
        rowNumber: 1,
        message: message.includes("Invalid XLSX file")
          ? message
          : `Invalid XLSX file: ${message}`
      }
    ],
    duplicateKeys: []
  };
}

function parseBomProductRow(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): BomProductImportRow | null {
  const model = parseRequiredText(row, headers, "Model", errors);
  const name = parseRequiredText(row, headers, "Name", errors);
  const category = parseRequiredText(row, headers, "Category", errors);
  const lifecycleStatus = parseLifecycleStatus(row, headers, errors);
  const plannedLaunchDate = parseOptionalPlannedLaunchDate(row, headers, errors);
  const bomEur = parseRequiredNumber(row, headers, "Bom (EUR)", errors);
  const bomRmb = parseOptionalNumber(row, headers, "Bom (RMB)", errors);

  if (
    model === null ||
    name === null ||
    category === null ||
    lifecycleStatus === null ||
    (headers.has(canonicalHeader("Planned Launch Date")) &&
      plannedLaunchDate === undefined) ||
    bomEur === null ||
    bomRmb === undefined
  ) {
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    model,
    name,
    category,
    ...(lifecycleStatus ? { lifecycleStatus } : {}),
    ...(plannedLaunchDate !== undefined ? { plannedLaunchDate } : {}),
    bomRmb,
    bomEur
  };
}

function parseRrpRow(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): ProductCountryRrpImportRow | null {
  const countryCode = parseRequiredText(row, headers, "Country", errors);
  const model = parseRequiredText(row, headers, "Model", errors);
  const currency = parseCurrencyCode(row, headers, "Currency", errors);
  const rrpLocal = parseRequiredNumber(row, headers, "RRP Local", errors);
  const rrpEur = parseRequiredNumber(row, headers, "RRP EUR", errors);

  if (
    countryCode === null ||
    model === null ||
    currency === null ||
    rrpLocal === null ||
    rrpEur === null
  ) {
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    countryCode: countryCode.toUpperCase(),
    model,
    rrpLocal,
    rrpEur,
    currency
  };
}

function parseMarginRow(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): OperationalMarginImportRow | null {
  const countryCode = parseRequiredText(row, headers, "Country", errors);
  const retailerName = parseRequiredText(row, headers, "Retailer", errors);
  const fdName = parseRequiredText(row, headers, "FD", errors);
  const incoterms = parseRequiredText(row, headers, "Incoterms", errors);
  const category = parseRequiredText(row, headers, "Category", errors);
  const kaBuyingMargin = parseRequiredPercent(
    row,
    headers,
    "KA buying margin",
    errors
  );
  const kaFrontMargin = parseRequiredPercent(
    row,
    headers,
    "KA front margin",
    errors
  );
  const kaBackMargin = parseRequiredPercent(
    row,
    headers,
    "KA back margin",
    errors
  );
  const fdMargin = parseRequiredPercent(row, headers, "FD Margin", errors);

  if (
    countryCode === null ||
    retailerName === null ||
    fdName === null ||
    incoterms === null ||
    category === null ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null
  ) {
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    countryCode: countryCode.toUpperCase(),
    retailerName,
    fdName,
    incoterms: incoterms.toUpperCase(),
    category,
    kaBuyingMargin,
    kaFrontMargin,
    kaBackMargin,
    fdMargin
  };
}

function parseMarginRowWithRetailerFallback(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): OperationalMarginImportRow | null {
  const countryCode = parseRequiredText(row, headers, "Country", errors);
  const retailerValue = readText(row, headers, "Retailer");
  const fdValue = readText(row, headers, "FD");
  const incoterms = parseRequiredText(row, headers, "Incoterms", errors);
  const category = parseRequiredText(row, headers, "Category", errors);
  const kaBuyingMargin = parseRequiredPercent(
    row,
    headers,
    "KA buying margin",
    errors
  );
  const kaFrontMargin = parseRequiredPercent(
    row,
    headers,
    "KA front margin",
    errors
  );
  const kaBackMargin = parseRequiredPercent(
    row,
    headers,
    "KA back margin",
    errors
  );
  const fdMargin = parseRequiredPercent(row, headers, "FD Margin", errors);
  const retailerName = retailerValue || fdValue;
  const fdName = fdValue || retailerValue;

  if (
    countryCode === null ||
    !retailerName ||
    !fdName ||
    incoterms === null ||
    category === null ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null
  ) {
    if (!retailerName || !fdName) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "Retailer / FD",
        message: "At least one value is required"
      });
    }
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    countryCode: countryCode.toUpperCase(),
    retailerName,
    fdName,
    incoterms: incoterms.toUpperCase(),
    category,
    kaBuyingMargin,
    kaFrontMargin,
    kaBackMargin,
    fdMargin
  };
}

function buildHeaderMap(cells: string[]): HeaderMap {
  const headers = new Map<string, number>();
  cells.forEach((cell, index) => {
    const canonical = canonicalHeader(cell);
    if (canonical && !headers.has(canonical)) {
      headers.set(canonical, index);
    }
  });

  return headers;
}

function findHeaderRow(
  worksheetRows: XlsxRow[],
  requiredHeaders: string[]
): {
  index: number;
  row?: XlsxRow;
  headers: HeaderMap;
  missingHeaders: string[];
} {
  const candidates = worksheetRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !isBlankRow(row))
    .slice(0, 25);

  let bestCandidate:
    | {
        index: number;
        row: XlsxRow;
        headers: HeaderMap;
        missingHeaders: string[];
        matchedCount: number;
        knownHeaderCount: number;
      }
    | undefined;

  for (const candidate of candidates) {
    const headers = buildHeaderMap(candidate.row.cells);
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.has(canonicalHeader(header))
    );
    const matchedCount = requiredHeaders.length - missingHeaders.length;
    const knownHeaderCount = [...headers.keys()].filter((header) =>
      HEADER_ALIAS_LOOKUP.has(header)
    ).length;

    const scoredCandidate = {
      ...candidate,
      headers,
      missingHeaders,
      matchedCount,
      knownHeaderCount
    };

    if (missingHeaders.length === 0) {
      return scoredCandidate;
    }

    if (
      !bestCandidate ||
      scoredCandidate.matchedCount > bestCandidate.matchedCount ||
      (scoredCandidate.matchedCount === bestCandidate.matchedCount &&
        scoredCandidate.knownHeaderCount > bestCandidate.knownHeaderCount)
    ) {
      bestCandidate = scoredCandidate;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  return {
    index: -1,
    row: undefined,
    headers: new Map(),
    missingHeaders: requiredHeaders
  };
}

function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeSheetName(sheetName: string): string {
  return normalizeHeader(sheetName);
}

function canonicalHeader(header: string): string {
  const normalizedHeader = normalizeHeader(header);
  if (!normalizedHeader) {
    return "";
  }

  return (
    HEADER_ALIAS_LOOKUP.get(normalizedHeader) ??
    HEADER_ALIAS_LOOKUP.get(compactHeader(normalizedHeader)) ??
    normalizedHeader
  );
}

function buildHeaderAliasLookup(): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const canonicalKey = normalizeHeader(canonical);
    for (const alias of [canonical, ...aliases]) {
      const normalizedAlias = normalizeHeader(alias);
      const compactAlias = compactHeader(normalizedAlias);
      lookup.set(normalizedAlias, canonicalKey);
      if (!lookup.has(compactAlias)) {
        lookup.set(compactAlias, canonicalKey);
      }
    }
  }

  return lookup;
}

function compactHeader(header: string): string {
  return normalizeHeader(header).replace(/[^\p{L}\p{N}]+/gu, "");
}

function isBlankRow(row: XlsxRow): boolean {
  return row.cells.every((cell) => !cell || cell.trim() === "");
}

function readText(row: XlsxRow, headers: HeaderMap, header: string): string {
  const value = readRawCell(row, headers, header);
  return value.trim();
}

function readRawCell(row: XlsxRow, headers: HeaderMap, header: string): string {
  const index = headers.get(canonicalHeader(header));
  return index === undefined ? "" : row.cells[index] ?? "";
}

function parseRequiredText(
  row: XlsxRow,
  headers: HeaderMap,
  header: string,
  errors: ImportError[]
): string | null {
  const value = readText(row, headers, header);
  if (value === "") {
    errors.push({
      rowNumber: row.rowNumber,
      field: header,
      message: "Required value"
    });
    return null;
  }

  return value;
}

function parseRequiredNumber(
  row: XlsxRow,
  headers: HeaderMap,
  header: string,
  errors: ImportError[]
): number | null {
  const parsedNumber = parseNumber(readRawCell(row, headers, header));
  if (parsedNumber === null) {
    errors.push({
      rowNumber: row.rowNumber,
      field: header,
      message: "Invalid number"
    });
  }

  return parsedNumber;
}

function parseCurrencyCode(
  row: XlsxRow,
  headers: HeaderMap,
  header: string,
  errors: ImportError[]
): string | null {
  const value = parseRequiredText(row, headers, header, errors);
  if (value === null) {
    return null;
  }

  const currency = value.toUpperCase();
  if (!isValidCurrencyCode(currency)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: header,
      message: "Invalid currency code"
    });
    return null;
  }

  return currency;
}

function parseLifecycleStatus(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): ProductLifecycleImportStatus | undefined | null {
  if (!headers.has(canonicalHeader("Lifecycle Status"))) {
    return undefined;
  }

  const value = readText(row, headers, "Lifecycle Status");
  if (value === "") {
    return undefined;
  }

  const normalizedValue = normalizeLifecycleValue(value);
  if (
    [
      "launched",
      "released",
      "listed",
      "onmarket",
      "inmarket",
      "live",
      "已上市",
      "上市"
    ].includes(normalizedValue)
  ) {
    return "LAUNCHED";
  }
  if (
    [
      "unlaunched",
      "notlaunched",
      "notreleased",
      "prelaunch",
      "prelaunched",
      "未上市",
      "新品",
      "待上市"
    ].includes(normalizedValue)
  ) {
    return "UNLAUNCHED";
  }
  if (
    [
      "eol",
      "endoflife",
      "discontinued",
      "退市",
      "停产",
      "下市"
    ].includes(normalizedValue)
  ) {
    return "EOL";
  }

  errors.push({
    rowNumber: row.rowNumber,
    field: "Lifecycle Status",
    message: "Invalid lifecycle status; use Launched, Unlaunched, or EOL"
  });
  return null;
}

function parseOptionalPlannedLaunchDate(
  row: XlsxRow,
  headers: HeaderMap,
  errors: ImportError[]
): string | null | undefined {
  if (!headers.has(canonicalHeader("Planned Launch Date"))) {
    return undefined;
  }

  const rawValue = readRawCell(row, headers, "Planned Launch Date").trim();
  if (rawValue === "") {
    return null;
  }

  const parsed = parseCalendarDate(rawValue);
  if (!parsed) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "Planned Launch Date",
      message: "Use a valid date, for example 2026-08-01"
    });
    return undefined;
  }

  return parsed;
}

function parseCalendarDate(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const europeanMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : europeanMatch
      ? {
          year: Number(europeanMatch[3]),
          month: Number(europeanMatch[2]),
          day: Number(europeanMatch[1])
        }
      : null;

  if (parts) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (
      date.getUTCFullYear() === parts.year &&
      date.getUTCMonth() === parts.month - 1 &&
      date.getUTCDate() === parts.day
    ) {
      return date.toISOString().slice(0, 10);
    }
    return null;
  }

  const serial = parseNumber(trimmed);
  if (serial === null || serial < 1 || serial > 100_000) {
    return null;
  }

  const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  return excelDate.toISOString().slice(0, 10);
}

function normalizeLifecycleValue(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-–—/]+/g, "");
}

function parseOptionalNumber(
  row: XlsxRow,
  headers: HeaderMap,
  header: string,
  errors: ImportError[]
): number | null | undefined {
  const rawValue = readRawCell(row, headers, header);
  if (rawValue.trim() === "") {
    return null;
  }

  const parsedNumber = parseNumber(rawValue);
  if (parsedNumber === null) {
    errors.push({
      rowNumber: row.rowNumber,
      field: header,
      message: "Invalid number"
    });
    return undefined;
  }

  return parsedNumber;
}

function isValidCurrencyCode(currency: string): boolean {
  try {
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency
    }).format(1);
    return true;
  } catch {
    return false;
  }
}

function parseRequiredPercent(
  row: XlsxRow,
  headers: HeaderMap,
  header: string,
  errors: ImportError[]
): number | null {
  const parsedNumber = parsePercent(readRawCell(row, headers, header));
  if (parsedNumber === null) {
    errors.push({
      rowNumber: row.rowNumber,
      field: header,
      message: "Invalid number"
    });
  }

  return parsedNumber;
}

function parseNumber(value: string): number | null {
  const trimmedValue = value.trim().replace(/[\s\u00a0]/g, "");
  if (trimmedValue === "") {
    return null;
  }

  const normalizedValue = normalizeNumberString(trimmedValue);
  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeNumberString(value: string): string {
  const withoutCurrencySymbols = value.replace(/[€¥£$]/g, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(withoutCurrencySymbols)) {
    return withoutCurrencySymbols.replaceAll(",", "");
  }
  if (
    withoutCurrencySymbols.includes(",") &&
    /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(withoutCurrencySymbols)
  ) {
    return withoutCurrencySymbols.replaceAll(".", "").replace(",", ".");
  }
  if (
    withoutCurrencySymbols.includes(",") &&
    !withoutCurrencySymbols.includes(".")
  ) {
    return withoutCurrencySymbols.replace(",", ".");
  }

  return withoutCurrencySymbols;
}

function parsePercent(value: string): number | null {
  const trimmedValue = value.trim();
  if (trimmedValue.includes("%")) {
    const percentValue = trimmedValue.replace("%", "").trim();
    if (percentValue.includes("%")) {
      return null;
    }

    const parsedNumber = parseNumber(percentValue);
    return normalizePercent(parsedNumber === null ? null : parsedNumber / 100);
  }

  const parsedNumber = parseNumber(trimmedValue);
  if (parsedNumber !== null && parsedNumber > 1 && parsedNumber <= 100) {
    return normalizePercent(parsedNumber / 100);
  }

  return normalizePercent(parsedNumber);
}

function normalizePercent(value: number | null): number | null {
  if (value === null || value < 0 || value > 1) {
    return null;
  }

  return value;
}

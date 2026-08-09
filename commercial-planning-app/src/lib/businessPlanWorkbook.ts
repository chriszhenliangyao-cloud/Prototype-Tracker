import {
  buildBusinessPlanProfileAssumption,
  buildBusinessPlanBaseRows,
  buildBusinessPlanLines,
  businessPlanChannelProfileKey,
  businessPlanChannelProfileLabel,
  getBusinessPlanMonths,
  monthLabel,
  quarterForMonth,
  temporaryAssumptionRowKey,
  type BusinessPlanChannelProductOverrideDraft,
  type BusinessPlanChannelProfileDraft,
  type BusinessPlanLine,
  type BusinessPlanTemporaryAssumption,
  type BusinessPlanDraftLine
} from "./calculations/businessPlan";
import type { NormalTableRow } from "./calculatorRows";
import {
  readWorkbookSheetNames,
  readWorksheetRows,
  type XlsxRow
} from "./imports/xlsxLite";
import {
  businessPlanAssumptionFromEntry,
  businessPlanBusinessKeyForParts,
  businessPlanDraftLinesFromEntries
} from "./businessPlanPersistence";
import type {
  BusinessPlanEntryOption,
  ReferenceData
} from "./types";
import {
  createXlsxWorkbook,
  type WorkbookCell,
  type WorkbookDataValidation,
  type WorkbookSheet
} from "./exports/xlsxWorkbook";

export type BusinessPlanImportError = {
  sheetName: string;
  rowNumber: number;
  message: string;
};

export type BusinessPlanImportResult = {
  rows: BusinessPlanDraftLine[];
  channelProfiles: BusinessPlanWorkbookChannelProfile[];
  errors: BusinessPlanImportError[];
};

type BusinessPlanWorkbookChannelProfile = BusinessPlanChannelProfileDraft & {
  productOverrides: BusinessPlanChannelProductOverrideDraft[];
};

type BusinessPlanWorkbookCategoryMargin = {
  category: string;
  countryCode: string;
  fdMargin: number;
  fdName: string;
  incoterms: string;
  kaBackMargin: number;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  planYear: number;
  retailerName: string;
};

type BusinessPlanWorkbookProductPrice = {
  bomCostEur?: number | null;
  category?: string | null;
  countryCode: string;
  currency: string;
  logisticsCostEur?: number | null;
  planYear: number;
  productName?: string | null;
  productSku: string;
  rrpEur: number | null;
  rrpLocal: number | null;
};

type BusinessPlanMasterDataHeaderIndexes = {
  dataType?: number;
  source?: number;
  year?: number;
  countryCode: number;
  channelName?: number;
  fdName?: number;
  incoterms?: number;
  category?: number;
  productSku: number;
  currency: number;
  rrpLocal: number;
  rrpEur: number;
  kaBuyingMargin?: number;
  kaFrontMargin?: number;
  kaBackMargin?: number;
  fdMargin?: number;
  marginGroups?: BusinessPlanMasterDataMarginGroup[];
};

type BusinessPlanMasterDataMarginGroup = {
  category: string;
  fdMargin: number;
  kaBackMargin: number;
  kaBuyingMargin: number;
  kaFrontMargin: number;
};

const BP_INPUT_SHEET_NAME = "BP Input";
const BP_OVERVIEW_SHEET_NAME = "Overview";
const BP_MASTER_DATA_SHEET_NAME = "BP Master Data";
const BP_DATA_INPUT_SHEET_NAME = "BP Data Input";
const BP_CHANNEL_SETUP_SHEET_NAME = "BP Channel Setup";
const BP_CHANNEL_OVERRIDE_SHEET_NAME = "BP Channel Product Overrides";
const BP_NEW_TARGETS_SHEET_NAME = "BP New Channel Targets";
const BP_GUIDE_SHEET_NAME = "Guide";
const BP_OPTIONS_SHEET_NAME = "BP Options";
const BP_CHANNEL_SETUP_EXTRA_ROWS = 60;
const BP_NEW_TARGET_EXTRA_ROWS = 300;
const BP_DATA_INPUT_EXTRA_ROWS = 500;
const BP_MASTER_DATA_EXTRA_ROWS = 500;
const BP_DIRECT_INPUT_EXTRA_ROWS = 500;
const BP_MASTER_DATA_DYNAMIC_OPTION_ROWS = 1200;
const EUR_CURRENCY_FORMAT = "€#,##0.00";
const BP_INPUT_TABLE_NAME = "BPInputTable";
const BP_MASTER_DATA_TABLE_NAME = "BPMasterDataTable";
const BP_INPUT_LAST_COLUMN = "AI";
const BP_MASTER_DATA_LAST_COLUMN = "AD";
const BP_MASTER_DATA_FX_START_COLUMN = "AF";
const BP_MASTER_DATA_FX_RATE_COLUMN = "AG";
const BP_MASTER_DATA_MARGIN_CATEGORIES = [
  {
    category: "Power bank",
    fdMarginColumn: "I",
    headerPrefix: "Power bank",
    kaBackColumn: "H",
    kaBuyingColumn: "F",
    kaFrontColumn: "G"
  },
  {
    category: "Charger",
    fdMarginColumn: "M",
    headerPrefix: "Charger",
    kaBackColumn: "L",
    kaBuyingColumn: "J",
    kaFrontColumn: "K"
  },
  {
    category: "Cable",
    fdMarginColumn: "Q",
    headerPrefix: "Cable",
    kaBackColumn: "P",
    kaBuyingColumn: "N",
    kaFrontColumn: "O"
  },
  {
    category: "Wireless charger",
    fdMarginColumn: "U",
    headerPrefix: "Wireless",
    kaBackColumn: "T",
    kaBuyingColumn: "R",
    kaFrontColumn: "S"
  }
] as const;
const BP_OVERVIEW_TOP_LIMIT = 10;
const BP_OVERVIEW_INTEGER_FORMAT = "#,##0";
const BP_OVERVIEW_PERCENT_FORMAT = "0.0%";
const BP_TEMPLATE_HEADERS = [
  "Year",
  "Month",
  "Quarter",
  "Country",
  "Channel / KA",
  "FD",
  "Incoterms",
  "Model code",
  "Product name",
  "Category",
  "Currency",
  "RRP Local",
  "RRP EUR",
  "VAT",
  "KA Buying Margin",
  "KA Front Margin",
  "KA Back Margin",
  "FD Margin",
  "Logistics EUR",
  "BOM EUR",
  "FD Buying Price EUR",
  "GP / Unit EUR",
  "Margin Rebate / Unit EUR",
  "Promo Rebate / Unit EUR",
  "Promo Discount % (Edit)",
  "Promo Price Local (Edit)",
  "Promo Price EUR",
  "SI Units (Edit)",
  "SO Units (Edit)",
  "SI Value EUR",
  "SO Value EUR",
  "GP EUR",
  "Promo Rebate EUR",
  "Net Profit EUR",
  "Row Key"
];

const BP_TEMPLATE_WIDTHS = [
  10, 10, 10, 10, 20, 18, 12, 16, 28, 16, 10, 12, 12, 10, 15, 15, 14, 12, 12,
  12, 17, 14, 20, 20, 16, 17, 15, 12, 12, 14, 14, 13, 16, 14, 30
];

const BP_CHANNEL_SETUP_HEADERS = [
  "Year",
  "Country",
  "Channel / KA",
  "FD",
  "Incoterms",
  "KA Buying Margin",
  "KA Front Margin",
  "KA Back Margin",
  "FD Margin"
];

const BP_CHANNEL_SETUP_WIDTHS = [
  10, 10, 24, 20, 14, 18, 18, 18, 14
];

const BP_CHANNEL_OVERRIDE_HEADERS = [
  "Channel Profile",
  "Model code",
  "RRP Local Override",
  "RRP EUR Override",
  "Currency Override",
  "KA Buying Margin Override",
  "KA Front Margin Override",
  "KA Back Margin Override",
  "FD Margin Override",
  "BOM EUR Override",
  "Logistics EUR Override"
];

const BP_NEW_TARGET_HEADERS = [
  "Year",
  "Month",
  "Quarter",
  "Channel Profile",
  "Model code",
  "Promo Discount % (Edit)",
  "Promo Price Local (Edit)",
  "SI Units (Edit)",
  "SO Units (Edit)"
];

const BP_DATA_INPUT_HEADERS = [
  "Year",
  "Month",
  "Country",
  "Channel / KA",
  "FD",
  "Incoterms",
  "Model code",
  "Promo Discount % (Edit)",
  "Promo Price Local (Edit)",
  "SI Units (Edit)",
  "SO Units (Edit)",
  "KA Buying Margin",
  "KA Front Margin",
  "KA Back Margin",
  "FD Margin"
];

const BP_DATA_INPUT_WIDTHS = [
  10, 14, 10, 24, 20, 14, 16, 18, 18, 14, 14, 18, 18, 18, 14
];

const BP_MASTER_DATA_HEADERS = [
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
  "BOM EUR"
];

const BP_MASTER_DATA_WIDTHS = [
  12, 10, 16, 12, 12, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
  15, 15, 15, 13, 10, 34, 18, 12, 12, 10, 12, 12, 3, 12, 14
];

const HEADER_ALIASES = {
  year: ["year", "plan year", "年份"],
  month: ["month", "plan month", "月份"],
  countryCode: ["country", "country code", "market", "市场", "国家"],
  channelName: ["channel / ka", "channel / retailer", "channel", "customer", "ka", "渠道"],
  fdName: ["fd", "fd name", "distributor"],
  incoterms: ["incoterms", "incoterm"],
  productSku: ["model code", "model", "sku", "product sku", "型号"],
  promoDiscountPercent: [
    "promo discount %",
    "promo discount % edit",
    "promo discount edit",
    "promo discount",
    "promo discunt",
    "promotion discount",
    "促销折扣"
  ],
  promoPriceLocal: [
    "promo price local",
    "promo price local edit",
    "rrpp local",
    "rrpp local edit",
    "promo rrpp local",
    "促销价",
    "本地促销价"
  ],
  siUnits: [
    "si units",
    "si units edit",
    "sell-in",
    "sell-in quantity",
    "sell-in (quantity)",
    "si"
  ],
  soUnits: [
    "so units",
    "so units edit",
    "sell-out",
    "sell-out quantity",
    "sell-out (quantity)",
    "so"
  ],
  rowKey: ["row key", "bp row key"]
} as const;

const CHANNEL_PROFILE_ALIASES = [
  "channel profile",
  "bp channel profile",
  "profile"
];

const OVERRIDE_HEADER_ALIASES = {
  rrpLocal: ["rrp local override", "rrp local", "local rrp override"],
  rrpEur: ["rrp eur override", "rrp eur", "eur rrp override"],
  currency: ["currency override", "currency"],
  kaBuyingMargin: ["ka buying margin override", "ka buying margin"],
  kaFrontMargin: ["ka front margin override", "ka front margin"],
  kaBackMargin: ["ka back margin override", "ka back margin"],
  fdMargin: ["fd margin override", "fd margin"],
  bomCost: ["bom eur override", "bom cost eur override", "bom eur"],
  logisticsCost: [
    "logistics eur override",
    "logistics cost eur override",
    "logistics eur"
  ]
} as const;

type HeaderIndexes = {
  year: number;
  month: number;
  countryCode: number;
  channelName: number;
  fdName: number;
  incoterms: number;
  productSku: number;
  productName: number;
  category: number;
  currency: number;
  rrpLocal: number;
  rrpEur: number;
  promoDiscountPercent: number;
  promoPriceLocal: number;
  siUnits: number;
  soUnits: number;
  rowKey: number;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  kaBackMargin: number;
  fdMargin: number;
  bomCost: number;
  logisticsCost: number;
};

type BusinessPlanDataInputSourceRow = {
  year: number;
  month: number;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  category?: string;
  productSku: string;
  promoDiscountPercent: number;
  promoPriceLocal: number | null;
  siUnits: number;
  soUnits: number;
  kaBuyingMargin: number | null;
  kaFrontMargin: number | null;
  kaBackMargin: number | null;
  fdMargin: number | null;
};

export function buildBusinessPlanTemplateWorkbookBuffer({
  channelProfiles = [],
  data,
  year
}: {
  channelProfiles?: BusinessPlanWorkbookChannelProfile[];
  data: ReferenceData;
  year: number;
}) {
  return createXlsxWorkbook(
    buildBusinessPlanTemplateWorkbookSheets({ channelProfiles, data, year })
  );
}

export function buildBusinessPlanSavedWorkbookBuffer({
  channelProfiles = [],
  data,
  entries,
  year
}: {
  channelProfiles?: BusinessPlanWorkbookChannelProfile[];
  data: ReferenceData;
  entries: BusinessPlanEntryOption[];
  year: number;
}) {
  return createXlsxWorkbook(
    buildBusinessPlanSavedWorkbookSheets({ channelProfiles, data, entries, year })
  );
}

export function buildBusinessPlanSavedWorkbookSheets({
  channelProfiles = [],
  data,
  entries,
  year
}: {
  channelProfiles?: BusinessPlanWorkbookChannelProfile[];
  data: ReferenceData;
  entries: BusinessPlanEntryOption[];
  year: number;
}): WorkbookSheet[] {
  const legacyAssumptions = entries
    .filter((entry) => entry.planYear === year && !entry.channelProfileId)
    .map(businessPlanAssumptionFromEntry)
    .filter(
      (assumption): assumption is BusinessPlanTemporaryAssumption =>
        assumption !== null
    );
  const legacyProfiles = businessPlanProfilesFromLegacyAssumptions(
    legacyAssumptions,
    year
  );
  const dataInputRows = businessPlanDataInputRowsFromEntries(entries, year);
  const sheets = buildBusinessPlanTemplateWorkbookSheets({
    channelProfiles: mergeWorkbookChannelProfiles([
      ...channelProfiles,
      ...legacyProfiles
    ]),
    data,
    dataInputRows,
    year
  });
  const overviewSheet = businessPlanOverviewSheet({ data, entries, year });
  return [
    overviewSheet,
    ...sheets.filter((sheet) => sheet.name !== BP_OVERVIEW_SHEET_NAME)
  ];
}

export function buildBusinessPlanTemplateWorkbookSheets({
  assumptions = [],
  channelProfiles = [],
  dataInputRows = [],
  data,
  year
}: {
  assumptions?: BusinessPlanTemporaryAssumption[];
  channelProfiles?: BusinessPlanWorkbookChannelProfile[];
  dataInputRows?: BusinessPlanDataInputSourceRow[];
  data: ReferenceData;
  year: number;
}): WorkbookSheet[] {
  const baseRows = buildBusinessPlanBaseRows(data, assumptions);
  const months = getBusinessPlanMonths();
  const options = businessPlanOptionGroups(baseRows);
  const masterDataRows = businessPlanMasterDataRows({
    baseRows,
    channelProfiles,
    data,
    rows: dataInputRows,
    year
  });
  const templateRows = baseRows.flatMap((row, rowIndex) =>
    months.map((month) =>
      businessPlanTemplateRow({
        month: month.month,
        row,
        rowNumber: 2 + rowIndex * months.length + month.month - 1,
        year
      })
    )
  );
  const directInputRows = businessPlanDirectInputRows({
    baseRows,
    data,
    dataInputRows,
    rowStart: templateRows.length + 2,
    year
  });
  const lastValidationRow =
    BP_TEMPLATE_HEADERS.length > 0
      ? templateRows.length + directInputRows.length + 1
      : 1;

  const sheets: WorkbookSheet[] = [
    businessPlanMasterDataSheet({
      options,
      rows: masterDataRows
    }),
    {
      name: BP_INPUT_SHEET_NAME,
      columnWidths: BP_TEMPLATE_WIDTHS,
      dataValidations: businessPlanInputDataValidations({
        lastRow: lastValidationRow,
        options
      }),
      freezeTopRows: 1,
      hiddenColumns: [34],
      style: "businessPlan",
      tables: [
        {
          columns: BP_TEMPLATE_HEADERS,
          name: BP_INPUT_TABLE_NAME,
          ref: `A1:${BP_INPUT_LAST_COLUMN}${lastValidationRow}`,
          styleName: "TableStyleMedium2"
        }
      ],
      rows: [BP_TEMPLATE_HEADERS, ...templateRows, ...directInputRows]
    },
    businessPlanOptionsSheet(options, channelProfiles, masterDataRows.length),
    {
      name: BP_GUIDE_SHEET_NAME,
      columnWidths: [24, 92],
      rows: [
        ["Field", "Usage"],
        [
          "Step 1 - BP Master Data",
          "Maintain BP-only setup in one visible sheet. Left side: add/review Country, Channel / KA, FD, Incoterms, and one set of margins per category. Right side: review market product price, VAT, logistics, and BOM. Edits here affect this BP workbook only and do not change formal Master Data."
        ],
        [
          "Step 2 - BP Input",
          "Enter or copy monthly BP target rows: Month, Country, Channel / KA, FD, Incoterms, Model code, Promo Discount or Promo Price Local, SI Units, and SO Units. BP Input is still the upload source, so copying a row keeps formulas, formatting, and dropdowns."
        ],
        [
          "Promo Price Local (Edit)",
          "Enter RRPP / promo price in local currency, such as PLN for PL rows or EUR for ES rows. Promo Price EUR and value columns convert automatically."
        ],
        [
          "SI Units (Edit)",
          "Monthly Sell-In target. Decimal allocations are supported when copied from source BP files."
        ],
        [
          "SO Units (Edit)",
          "Monthly Sell-Out target. Decimal allocations are supported when copied from source BP files."
        ],
        [
          "New Channel / FD",
          "Add the new Channel / FD once in BP Master Data and fill the category margin columns that apply. BP Options then picks up the new Channel / FD for BP Input dropdowns, and BP Input reuses the category margins for every product in that category."
        ],
        [
          "RRP EUR",
          "RRP EUR is formula-backed from RRP Local and FX rate to EUR. Edit local RRP or FX rate when needed; BP Input will use the converted EUR value for BP calculations."
        ],
        [
          "Upload rule",
          "System upload reads BP Input as the main BP plan sheet. BP Master Data provides BP-only Channel / FD margins for rows that do not exist in formal Master Data."
        ],
        [
          "BP Options",
          "System-generated hidden dropdown and lookup source. It follows BP Master Data and should not be manually maintained."
        ]
      ]
    }
  ];

  return [
    businessPlanOverviewSheet({
      data,
      entries: [],
      year
    }),
    ...sheets
  ];
}

function businessPlanOverviewSheet({
  data,
  entries,
  year
}: {
  data: ReferenceData;
  entries: BusinessPlanEntryOption[];
  year: number;
}): WorkbookSheet {
  const yearEntries = entries.filter((entry) => entry.planYear === year);
  const lines = buildBusinessPlanLines(
    data,
    businessPlanDraftLinesFromEntries(yearEntries, data)
  );
  const totalMetrics = sumOverviewMetrics(lines);
  const monthlyMetrics = overviewMetricMap(
    lines,
    (line) => monthLabel(line.month)
  );
  const categoryMetrics = overviewMetricMap(lines, (line) => line.category);
  const channelMetrics = overviewMetricMap(lines, (line) => line.channelName);
  const productMetrics = overviewMetricMap(lines, (line) => line.model);
  const productDetails = new Map(
    lines.map((line) => [
      line.model,
      {
        category: line.category,
        productName: line.productName
      }
    ])
  );
  const topChannels = topOverviewKeys(channelMetrics, BP_OVERVIEW_TOP_LIMIT);
  const topProducts = topOverviewKeys(productMetrics, BP_OVERVIEW_TOP_LIMIT);
  const rows: WorkbookCell[][] = [];

  rows.push(
    ["BP Offline Overview", "", "", "", "", "", ""],
    ["Edit BP Input rows, then refresh formulas to update this Overview."],
    []
  );

  rows.push(
    [
      "Annual SI",
      "Annual SO",
      "SI Value EUR",
      "SO Value EUR",
      "GP EUR",
      "NP EUR",
      ""
    ],
    [
      overviewFormulaCell(
        bpInputSumFormula("SI Units (Edit)"),
        totalMetrics.siUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumFormula("SO Units (Edit)"),
        totalMetrics.soUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumFormula("SI Value EUR"),
        totalMetrics.siValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumFormula("SO Value EUR"),
        totalMetrics.soValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumFormula("GP EUR"),
        totalMetrics.gpEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumFormula("Net Profit EUR"),
        totalMetrics.netProfitEur,
        EUR_CURRENCY_FORMAT
      ),
      ""
    ],
    [],
    []
  );

  rows.push(["Monthly SI Trend", "", "", "", "", "", ""]);
  const monthlyStart = rows.length + 2;
  const monthlyEnd = monthlyStart + getBusinessPlanMonths().length - 1;
  rows.push(["Month", "SI Units", "SI Value EUR", "SI Trend", "", "", ""]);
  for (const month of getBusinessPlanMonths()) {
    const rowNumber = rows.length + 1;
    const metrics = monthlyMetrics.get(month.label) ?? emptyOverviewMetrics();
    rows.push([
      month.label,
      overviewFormulaCell(
        bpInputSumIfFormula("SI Units (Edit)", "Month", `$A${rowNumber}`),
        metrics.siUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("SI Value EUR", "Month", `$A${rowNumber}`),
        metrics.siValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        overviewBarFormula(
          `B${rowNumber}`,
          `MAX($B$${monthlyStart}:$B$${monthlyEnd})`
        ),
        ""
      ),
      "",
      "",
      ""
    ]);
  }

  rows.push([], []);
  rows.push(["Category Mix", "", "", "", "", "", ""]);
  const categoryStart = rows.length + 2;
  const categoryTotalRow =
    categoryStart + BP_MASTER_DATA_MARGIN_CATEGORIES.length;
  rows.push([
    "Category",
    "SI Units",
    "SI Value EUR",
    "Value Share",
    "Mix bar",
    "",
    ""
  ]);
  for (const category of BP_MASTER_DATA_MARGIN_CATEGORIES.map(
    (margin) => margin.category
  )) {
    const rowNumber = rows.length + 1;
    const metrics = categoryMetrics.get(category) ?? emptyOverviewMetrics();
    rows.push([
      category,
      overviewFormulaCell(
        bpInputSumIfFormula("SI Units (Edit)", "Category", `$A${rowNumber}`),
        metrics.siUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("SI Value EUR", "Category", `$A${rowNumber}`),
        metrics.siValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        `IFERROR(C${rowNumber}/$C$${categoryTotalRow},0)`,
        totalMetrics.siValueEur > 0
          ? metrics.siValueEur / totalMetrics.siValueEur
          : 0,
        BP_OVERVIEW_PERCENT_FORMAT
      ),
      overviewFormulaCell(
        overviewBarFormula(`C${rowNumber}`, `$C$${categoryTotalRow}`),
        ""
      ),
      "",
      ""
    ]);
  }
  rows.push([
    "Total",
    overviewFormulaCell(
      `SUM(B${categoryStart}:B${categoryTotalRow - 1})`,
      totalMetrics.siUnits,
      BP_OVERVIEW_INTEGER_FORMAT
    ),
    overviewFormulaCell(
      `SUM(C${categoryStart}:C${categoryTotalRow - 1})`,
      totalMetrics.siValueEur,
      EUR_CURRENCY_FORMAT
    ),
    overviewFormulaCell(
      `SUM(D${categoryStart}:D${categoryTotalRow - 1})`,
      totalMetrics.siValueEur > 0 ? 1 : 0,
      BP_OVERVIEW_PERCENT_FORMAT
    ),
    "",
    "",
    ""
  ]);

  rows.push([], []);
  rows.push(["Monthly Targets", "", "", "", "", "", ""]);
  const targetStart = rows.length + 2;
  const targetTotalRow = targetStart + getBusinessPlanMonths().length;
  rows.push([
    "Month",
    "SI Units",
    "SO Units",
    "SI Value EUR",
    "SO Value EUR",
    "GP EUR",
    "NP EUR"
  ]);
  for (const month of getBusinessPlanMonths()) {
    const rowNumber = rows.length + 1;
    const metrics = monthlyMetrics.get(month.label) ?? emptyOverviewMetrics();
    rows.push([
      month.label,
      overviewFormulaCell(
        bpInputSumIfFormula("SI Units (Edit)", "Month", `$A${rowNumber}`),
        metrics.siUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("SO Units (Edit)", "Month", `$A${rowNumber}`),
        metrics.soUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("SI Value EUR", "Month", `$A${rowNumber}`),
        metrics.siValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("SO Value EUR", "Month", `$A${rowNumber}`),
        metrics.soValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("GP EUR", "Month", `$A${rowNumber}`),
        metrics.gpEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        bpInputSumIfFormula("Net Profit EUR", "Month", `$A${rowNumber}`),
        metrics.netProfitEur,
        EUR_CURRENCY_FORMAT
      )
    ]);
  }
  rows.push([
    "Total",
    overviewFormulaCell(
      `SUM(B${targetStart}:B${targetTotalRow - 1})`,
      totalMetrics.siUnits,
      BP_OVERVIEW_INTEGER_FORMAT
    ),
    overviewFormulaCell(
      `SUM(C${targetStart}:C${targetTotalRow - 1})`,
      totalMetrics.soUnits,
      BP_OVERVIEW_INTEGER_FORMAT
    ),
    overviewFormulaCell(
      `SUM(D${targetStart}:D${targetTotalRow - 1})`,
      totalMetrics.siValueEur,
      EUR_CURRENCY_FORMAT
    ),
    overviewFormulaCell(
      `SUM(E${targetStart}:E${targetTotalRow - 1})`,
      totalMetrics.soValueEur,
      EUR_CURRENCY_FORMAT
    ),
    overviewFormulaCell(
      `SUM(F${targetStart}:F${targetTotalRow - 1})`,
      totalMetrics.gpEur,
      EUR_CURRENCY_FORMAT
    ),
    overviewFormulaCell(
      `SUM(G${targetStart}:G${targetTotalRow - 1})`,
      totalMetrics.netProfitEur,
      EUR_CURRENCY_FORMAT
    )
  ]);

  rows.push([], []);
  rows.push(["Target Analysis - Channel Top 10", "", "", "", "", "", ""]);
  rows.push([
    "Channel / KA",
    "SI Units",
    "SI Value EUR",
    "Share",
    "SO Units",
    "Share bar",
    ""
  ]);
  for (const channel of paddedOverviewKeys(topChannels, BP_OVERVIEW_TOP_LIMIT)) {
    const rowNumber = rows.length + 1;
    if (!channel) {
      rows.push(["", "", "", "", "", "", ""]);
      continue;
    }
    const metrics = channelMetrics.get(channel) ?? emptyOverviewMetrics();
    rows.push([
      channel,
      overviewFormulaCell(
        `SUMIFS(${bpInputTableColumn("SI Units (Edit)" )},${bpInputTableColumn(
          "Channel / KA"
        )},$A${rowNumber})`,
        metrics.siUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        `SUMIFS(${bpInputTableColumn("SI Value EUR")},${bpInputTableColumn(
          "Channel / KA"
        )},$A${rowNumber})`,
        metrics.siValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        `IFERROR(B${rowNumber}/$B$${targetTotalRow},0)`,
        totalMetrics.siUnits > 0
          ? metrics.siUnits / totalMetrics.siUnits
          : 0,
        BP_OVERVIEW_PERCENT_FORMAT
      ),
      overviewFormulaCell(
        `SUMIFS(${bpInputTableColumn("SO Units (Edit)")},${bpInputTableColumn(
          "Channel / KA"
        )},$A${rowNumber})`,
        metrics.soUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        overviewBarFormula(`B${rowNumber}`, `$B$${targetTotalRow}`),
        ""
      ),
      ""
    ]);
  }

  rows.push([], []);
  rows.push(["Target Analysis - Product Top 10", "", "", "", "", "", ""]);
  rows.push([
    "Model code",
    "Product name",
    "Category",
    "SI Units",
    "SI Value EUR",
    "Share",
    "Share bar"
  ]);
  for (const productSku of paddedOverviewKeys(
    topProducts,
    BP_OVERVIEW_TOP_LIMIT
  )) {
    const rowNumber = rows.length + 1;
    if (!productSku) {
      rows.push(["", "", "", "", "", "", ""]);
      continue;
    }
    const metrics = productMetrics.get(productSku) ?? emptyOverviewMetrics();
    const details = productDetails.get(productSku);
    rows.push([
      productSku,
      details?.productName ?? "",
      details?.category ?? "",
      overviewFormulaCell(
        `SUMIFS(${bpInputTableColumn("SI Units (Edit)")},${bpInputTableColumn(
          "Model code"
        )},$A${rowNumber})`,
        metrics.siUnits,
        BP_OVERVIEW_INTEGER_FORMAT
      ),
      overviewFormulaCell(
        `SUMIFS(${bpInputTableColumn("SI Value EUR")},${bpInputTableColumn(
          "Model code"
        )},$A${rowNumber})`,
        metrics.siValueEur,
        EUR_CURRENCY_FORMAT
      ),
      overviewFormulaCell(
        `IFERROR(D${rowNumber}/$B$${targetTotalRow},0)`,
        totalMetrics.siUnits > 0
          ? metrics.siUnits / totalMetrics.siUnits
          : 0,
        BP_OVERVIEW_PERCENT_FORMAT
      ),
      overviewFormulaCell(
        overviewBarFormula(`D${rowNumber}`, `$B$${targetTotalRow}`),
        ""
      )
    ]);
  }

  return {
    name: BP_OVERVIEW_SHEET_NAME,
    columnWidths: [16, 32, 20, 14, 16, 12, 24],
    freezeTopRows: 2,
    style: "businessPlan",
    rows
  };
}

type BusinessPlanOverviewMetrics = {
  gpEur: number;
  netProfitEur: number;
  siUnits: number;
  siValueEur: number;
  soUnits: number;
  soValueEur: number;
};

function emptyOverviewMetrics(): BusinessPlanOverviewMetrics {
  return {
    gpEur: 0,
    netProfitEur: 0,
    siUnits: 0,
    siValueEur: 0,
    soUnits: 0,
    soValueEur: 0
  };
}

function overviewMetricMap(
  lines: BusinessPlanLine[],
  keyForLine: (line: BusinessPlanLine) => string
): Map<string, BusinessPlanOverviewMetrics> {
  const groups = new Map<string, BusinessPlanOverviewMetrics>();

  for (const line of lines) {
    const key = keyForLine(line);
    const current = groups.get(key) ?? emptyOverviewMetrics();
    groups.set(key, addLineToOverviewMetrics(current, line));
  }

  return groups;
}

function sumOverviewMetrics(
  lines: BusinessPlanLine[]
): BusinessPlanOverviewMetrics {
  return lines.reduce(
    (sum, line) => addLineToOverviewMetrics(sum, line),
    emptyOverviewMetrics()
  );
}

function addLineToOverviewMetrics(
  metrics: BusinessPlanOverviewMetrics,
  line: BusinessPlanLine
): BusinessPlanOverviewMetrics {
  return {
    gpEur: metrics.gpEur + line.gpEur,
    netProfitEur: metrics.netProfitEur + line.netProfitEur,
    siUnits: metrics.siUnits + line.siUnits,
    siValueEur: metrics.siValueEur + line.siValueEur,
    soUnits: metrics.soUnits + line.soUnits,
    soValueEur: metrics.soValueEur + line.soValueEur
  };
}

function topOverviewKeys(
  metricsByKey: Map<string, BusinessPlanOverviewMetrics>,
  count: number
) {
  return [...metricsByKey.entries()]
    .filter(([, metrics]) => metrics.siUnits > 0)
    .sort((left, right) => {
      const siDifference = right[1].siUnits - left[1].siUnits;
      return siDifference !== 0 ? siDifference : left[0].localeCompare(right[0]);
    })
    .slice(0, count)
    .map(([key]) => key);
}

function paddedOverviewKeys(keys: string[], targetLength: number) {
  return [...keys, ...Array(Math.max(0, targetLength - keys.length)).fill("")];
}

function overviewFormulaCell(
  formula: string,
  value: number | string | null = null,
  numberFormatCode?: string
): WorkbookCell {
  return { formula, value, numberFormatCode };
}

function bpInputTableColumn(column: string) {
  return `${BP_INPUT_TABLE_NAME}[${column}]`;
}

function bpInputSumFormula(column: string) {
  return `SUM(${bpInputTableColumn(column)})`;
}

function bpInputSumIfFormula(
  sumColumn: string,
  criteriaColumn: string,
  criteriaCell: string
) {
  return `SUMIFS(${bpInputTableColumn(sumColumn)},${bpInputTableColumn(
    criteriaColumn
  )},${criteriaCell})`;
}

function overviewBarFormula(valueCell: string, totalCell: string) {
  return `IFERROR(REPT("|",ROUND(${valueCell}/${totalCell}*24,0)),"")`;
}

type BusinessPlanOptionGroups = {
  months: string[];
  countries: string[];
  channels: string[];
  fds: string[];
  incoterms: string[];
  models: string[];
  currencies: string[];
  productNames: string[];
  categories: string[];
  productLookups: Array<{
    key: string;
    productName: string;
    category: string;
    currency: string;
    rrpLocal: number | null;
    rrpEur: number | null;
    vatRate: number | null;
    logisticsCost: number | null;
    bomCost: number | null;
  }>;
  masterLookups: Array<{
    key: string;
    rowKey: string;
    kaBuyingMargin: number;
    kaFrontMargin: number;
    kaBackMargin: number;
    fdMargin: number;
  }>;
};

function businessPlanOptionGroups(baseRows: NormalTableRow[]): BusinessPlanOptionGroups {
  const productLookups = new Map<string, BusinessPlanOptionGroups["productLookups"][number]>();
  const masterLookups = new Map<string, BusinessPlanOptionGroups["masterLookups"][number]>();

  for (const row of baseRows) {
    const productKey = productLookupKey(row.countryCode, row.model);
    if (!productLookups.has(productKey)) {
      productLookups.set(productKey, {
        key: productKey,
        productName: row.productName,
        category: row.category,
        currency: row.currency,
        rrpLocal: row.rrpLocal,
        rrpEur: row.rrpEur,
        vatRate: row.vatRate,
        logisticsCost: row.logisticsCost,
        bomCost: row.bomCost
      });
    }

    const marginKey = categoryMarginLookupKey({
      category: row.category,
      countryCode: row.countryCode,
      fdName: row.fdName,
      incoterms: row.incoterms,
      retailerName: row.channelName
    });
    if (masterLookups.has(marginKey)) {
      continue;
    }
    masterLookups.set(marginKey, {
      key: marginKey,
      rowKey: row.key,
      kaBuyingMargin: row.kaBuyingMargin,
      kaFrontMargin: row.kaFrontMargin,
      kaBackMargin: row.kaBackMargin,
      fdMargin: row.fdMargin
    });
  }

  return {
    months: getBusinessPlanMonths().map((month) => month.label),
    countries: uniqueSorted(baseRows.map((row) => row.countryCode)),
    channels: uniqueSorted(baseRows.map((row) => row.channelName)),
    fds: uniqueSorted(baseRows.map((row) => row.fdName)),
    incoterms: uniqueSorted(baseRows.map((row) => row.incoterms)),
    models: uniqueSorted(baseRows.map((row) => row.model)),
    currencies: uniqueSorted(baseRows.map((row) => row.currency)),
    productNames: uniqueSorted(baseRows.map((row) => row.productName)),
    categories: uniqueSorted(baseRows.map((row) => row.category)),
    productLookups: [...productLookups.values()],
    masterLookups: [...masterLookups.values()]
  };
}

function businessPlanOptionsSheet(
  options: BusinessPlanOptionGroups,
  channelProfiles: BusinessPlanWorkbookChannelProfile[],
  masterDataRowCount = BP_MASTER_DATA_DYNAMIC_OPTION_ROWS
): WorkbookSheet {
  const profileOptionCount = channelProfileOptionRowCount(channelProfiles);
  const dynamicMasterDataOptionRows = Math.max(
    masterDataRowCount * BP_MASTER_DATA_MARGIN_CATEGORIES.length,
    BP_MASTER_DATA_DYNAMIC_OPTION_ROWS
  );
  const maxOptionCount = Math.max(
    optionRowCount("Month", options.months.length),
    optionRowCount("Country", options.countries.length),
    optionRowCount("Channel / KA", options.channels.length),
    optionRowCount("FD", options.fds.length),
    optionRowCount("Incoterms", options.incoterms.length),
    optionRowCount("Model code", options.models.length),
    optionRowCount("Currency", options.currencies.length),
    optionRowCount("Product name", options.productNames.length),
    optionRowCount("Category", options.categories.length),
    profileOptionCount,
    options.productLookups.length,
    options.masterLookups.length,
    dynamicMasterDataOptionRows
  );

  return {
    name: BP_OPTIONS_SHEET_NAME,
    columnWidths: [
      16, 12, 22, 18, 14, 18, 12, 28, 18, 34, 28, 28, 18, 12, 14, 14, 10,
      14, 12, 42, 30, 18, 18, 18, 14
    ],
    freezeTopRows: 1,
    hidden: true,
    rows: [
      [
        "Month",
        "Country",
        "Channel / KA",
        "FD",
        "Incoterms",
        "Model code",
        "Currency",
        "Product name",
        "Category",
        "Channel Profile",
        "Product Lookup Key",
        "Product Name Lookup",
        "Category Lookup",
        "Currency Lookup",
        "RRP Local Lookup",
        "RRP EUR Lookup",
        "VAT Lookup",
        "Logistics EUR Lookup",
        "BOM EUR Lookup",
        "Master Lookup Key",
        "Row Key Lookup",
        "KA Buying Margin Lookup",
        "KA Front Margin Lookup",
        "KA Back Margin Lookup",
        "FD Margin Lookup"
      ],
      ...Array.from({ length: maxOptionCount }, (_, index) => {
        const masterDataRowNumber = index + 2;

        return [
          options.months[index] ?? "",
          optionWithMasterData(index, options.countries, "B"),
          optionWithMasterData(index, options.channels, "C"),
          optionWithMasterData(index, options.fds, "D"),
          optionWithMasterData(index, options.incoterms, "E"),
          optionWithMasterData(index, options.models, "V"),
          optionWithMasterData(index, options.currencies, "W"),
          optionWithMasterData(index, options.productNames, "X"),
          optionWithMasterData(index, options.categories, "Y"),
          channelProfiles[index]
            ? businessPlanChannelProfileLabel(channelProfiles[index])
            : "",
          productLookupCell(index, options.productLookups, "key", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "productName", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "category", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "currency", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "rrpLocal", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "rrpEur", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "vatRate", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "logisticsCost", masterDataRowNumber),
          productLookupCell(index, options.productLookups, "bomCost", masterDataRowNumber),
          masterLookupCell(index, options.masterLookups, "key", masterDataRowNumber),
          masterLookupCell(index, options.masterLookups, "rowKey", masterDataRowNumber),
          masterLookupCell(index, options.masterLookups, "kaBuyingMargin", masterDataRowNumber),
          masterLookupCell(index, options.masterLookups, "kaFrontMargin", masterDataRowNumber),
          masterLookupCell(index, options.masterLookups, "kaBackMargin", masterDataRowNumber),
          masterLookupCell(index, options.masterLookups, "fdMargin", masterDataRowNumber)
        ];
      })
    ]
  };
}

function optionWithMasterData(
  index: number,
  values: string[],
  masterDataColumn: string
): WorkbookCell {
  return values[index] ?? formula(`'${BP_MASTER_DATA_SHEET_NAME}'!${masterDataColumn}${index + 2}`, "");
}

function productLookupCell(
  index: number,
  lookups: BusinessPlanOptionGroups["productLookups"],
  field: keyof BusinessPlanOptionGroups["productLookups"][number],
  masterDataRowNumber: number
): WorkbookCell {
  const staticValue = lookups[index]?.[field];
  if (
    staticValue !== undefined &&
    !["key", "currency", "rrpLocal", "rrpEur", "vatRate", "logisticsCost", "bomCost"].includes(field)
  ) {
    return staticValue;
  }

  const masterData = `'${BP_MASTER_DATA_SHEET_NAME}'`;
  const staticLiteral = formulaLiteral(staticValue);
  const lookupKey = `${masterData}!B${masterDataRowNumber}&"|"&${masterData}!V${masterDataRowNumber}`;
  const staticLookupFormula = (column: string) =>
    lookups.length === 0
      ? `""`
      : `IFERROR(INDEX($${column}$2:$${column}$${lookups.length + 1},MATCH(${lookupKey},$K$2:$K$${lookups.length + 1},0)),"")`;
  const dynamicProductCheck = `OR(${masterData}!B${masterDataRowNumber}="",${masterData}!V${masterDataRowNumber}="")`;
  const productColumns: Record<
    keyof BusinessPlanOptionGroups["productLookups"][number],
    string
  > = {
    key: `IF(${dynamicProductCheck},${staticLiteral},${lookupKey})`,
    productName: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!X${masterDataRowNumber}<>"",${masterData}!X${masterDataRowNumber},${staticLookupFormula("L")}))`,
    category: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!Y${masterDataRowNumber}<>"",${masterData}!Y${masterDataRowNumber},${staticLookupFormula("M")}))`,
    currency: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!W${masterDataRowNumber}<>"",${masterData}!W${masterDataRowNumber},${staticLookupFormula("N")}))`,
    rrpLocal: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!Z${masterDataRowNumber}<>"",${masterData}!Z${masterDataRowNumber},${staticLookupFormula("O")}))`,
    rrpEur: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!AA${masterDataRowNumber}<>"",${masterData}!AA${masterDataRowNumber},${staticLookupFormula("P")}))`,
    vatRate: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!AB${masterDataRowNumber}<>"",${masterData}!AB${masterDataRowNumber},${staticLookupFormula("Q")}))`,
    logisticsCost: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!AC${masterDataRowNumber}<>"",${masterData}!AC${masterDataRowNumber},${staticLookupFormula("R")}))`,
    bomCost: `IF(${dynamicProductCheck},${staticLiteral},IF(${masterData}!AD${masterDataRowNumber}<>"",${masterData}!AD${masterDataRowNumber},${staticLookupFormula("S")}))`
  };

  return formula(productColumns[field], "");
}

function masterLookupCell(
  index: number,
  lookups: BusinessPlanOptionGroups["masterLookups"],
  field: keyof BusinessPlanOptionGroups["masterLookups"][number],
  masterDataRowNumber: number
): WorkbookCell {
  const staticValue = lookups[index]?.[field];
  if (staticValue !== undefined) {
    return staticValue;
  }

  const masterData = `'${BP_MASTER_DATA_SHEET_NAME}'`;
  const categoryIndex = index % BP_MASTER_DATA_MARGIN_CATEGORIES.length;
  const categoryGroup = BP_MASTER_DATA_MARGIN_CATEGORIES[categoryIndex]!;
  const dynamicRowNumber =
    Math.floor(index / BP_MASTER_DATA_MARGIN_CATEGORIES.length) + 2;
  const masterCheck = `OR(${masterData}!B${dynamicRowNumber}="",${masterData}!C${dynamicRowNumber}="",${masterData}!D${dynamicRowNumber}="",${masterData}!E${dynamicRowNumber}="")`;
  const masterColumns: Record<
    keyof BusinessPlanOptionGroups["masterLookups"][number],
    string
  > = {
    key: `IF(${masterCheck},"",${masterData}!B${dynamicRowNumber}&"|"&${masterData}!C${dynamicRowNumber}&"|"&${masterData}!D${dynamicRowNumber}&"|"&${masterData}!E${dynamicRowNumber}&"|${categoryGroup.category}")`,
    rowKey: `""`,
    kaBuyingMargin: `IF(${masterCheck},"",${masterData}!${categoryGroup.kaBuyingColumn}${dynamicRowNumber})`,
    kaFrontMargin: `IF(${masterCheck},"",${masterData}!${categoryGroup.kaFrontColumn}${dynamicRowNumber})`,
    kaBackMargin: `IF(${masterCheck},"",${masterData}!${categoryGroup.kaBackColumn}${dynamicRowNumber})`,
    fdMargin: `IF(${masterCheck},"",${masterData}!${categoryGroup.fdMarginColumn}${dynamicRowNumber})`
  };

  return formula(masterColumns[field], "");
}

function businessPlanChannelSetupSheet(
  channelProfiles: BusinessPlanWorkbookChannelProfile[] = [],
  options: BusinessPlanOptionGroups
): WorkbookSheet {
  const profileRows = channelProfiles.map((profile) => [
    profile.planYear,
    profile.countryCode,
    profile.retailerName,
    profile.fdName,
    profile.incoterms,
    profile.kaBuyingMargin,
    profile.kaFrontMargin,
    profile.kaBackMargin,
    profile.fdMargin
  ]);
  const blankRows = Array.from({ length: BP_CHANNEL_SETUP_EXTRA_ROWS }, () =>
    BP_CHANNEL_SETUP_HEADERS.map(() => "")
  );

  return {
    name: BP_CHANNEL_SETUP_SHEET_NAME,
    autoFilter: true,
    columnWidths: BP_CHANNEL_SETUP_WIDTHS,
    dataValidations: businessPlanChannelSetupDataValidations({
      lastRow: channelProfiles.length + BP_CHANNEL_SETUP_EXTRA_ROWS + 1,
      options
    }),
    freezeTopRows: 1,
    style: "businessPlan",
    rows: [
      BP_CHANNEL_SETUP_HEADERS,
      ...profileRows,
      ...blankRows
    ]
  };
}

function businessPlanChannelProductOverridesSheet(
  channelProfiles: BusinessPlanWorkbookChannelProfile[] = [],
  options: BusinessPlanOptionGroups
): WorkbookSheet {
  const overrideRows = channelProfiles.flatMap((profile) =>
    profile.productOverrides.map((override) => [
      businessPlanChannelProfileLabel(profile),
      override.productSku,
      localCurrencyNumberOrBlank(
        override.rrpLocal,
        override.currency ?? ""
      ),
      eurNumberOrBlank(override.rrpEur),
      override.currency ?? "",
      nullablePercentCell(override.kaBuyingMargin),
      nullablePercentCell(override.kaFrontMargin),
      nullablePercentCell(override.kaBackMargin),
      nullablePercentCell(override.fdMargin),
      eurNumberOrBlank(override.bomCost),
      eurNumberOrBlank(override.logisticsCost)
    ])
  );
  const blankRows = Array.from({ length: BP_CHANNEL_SETUP_EXTRA_ROWS }, () =>
    BP_CHANNEL_OVERRIDE_HEADERS.map(() => "")
  );

  return {
    name: BP_CHANNEL_OVERRIDE_SHEET_NAME,
    autoFilter: true,
    columnWidths: [34, 18, 18, 18, 16, 24, 24, 24, 18, 18, 22],
    dataValidations: businessPlanOverrideDataValidations({
      lastRow: overrideRows.length + BP_CHANNEL_SETUP_EXTRA_ROWS + 1,
      options,
      profileOptionCount: channelProfileOptionRowCount(channelProfiles)
    }),
    freezeTopRows: 1,
    style: "businessPlan",
    rows: [BP_CHANNEL_OVERRIDE_HEADERS, ...overrideRows, ...blankRows]
  };
}

function businessPlanProfilesFromLegacyAssumptions(
  assumptions: BusinessPlanTemporaryAssumption[],
  year: number
): BusinessPlanWorkbookChannelProfile[] {
  const profiles = new Map<string, BusinessPlanWorkbookChannelProfile>();

  for (const assumption of assumptions) {
    const profile: BusinessPlanWorkbookChannelProfile = {
      id: businessPlanChannelProfileKey({
        planYear: year,
        countryCode: assumption.countryCode,
        retailerName: assumption.retailerName,
        fdName: assumption.fdName,
        incoterms: assumption.incoterms
      }),
      planYear: year,
      countryCode: assumption.countryCode,
      retailerName: assumption.retailerName,
      fdName: assumption.fdName,
      incoterms: assumption.incoterms,
      kaBuyingMargin: assumption.kaBuyingMargin,
      kaFrontMargin: assumption.kaFrontMargin,
      kaBackMargin: assumption.kaBackMargin,
      fdMargin: assumption.fdMargin,
      productOverrides: []
    };
    const existing = profiles.get(profile.id);
    const nextProfile = existing ?? profile;
    const hasOverride = nextProfile.productOverrides.some(
      (override) =>
        override.productSku.toLowerCase() === assumption.productSku.toLowerCase()
    );
    if (!hasOverride) {
      nextProfile.productOverrides.push({
        id: `bp-legacy-override-${profile.id}-${assumption.productSku.toLowerCase()}`,
        channelProfileId: profile.id,
        productSku: assumption.productSku,
        rrpLocal: assumption.rrpLocal,
        rrpEur: assumption.rrpEur,
        currency: assumption.currency,
        kaBuyingMargin: null,
        kaFrontMargin: null,
        kaBackMargin: null,
        fdMargin: null,
        bomCost: assumption.bomCostEur ?? null,
        logisticsCost: assumption.logisticsCostEur ?? null
      });
    }
    profiles.set(profile.id, nextProfile);
  }

  return [...profiles.values()];
}

function mergeWorkbookChannelProfiles(
  profiles: BusinessPlanWorkbookChannelProfile[]
) {
  const byKey = new Map<string, BusinessPlanWorkbookChannelProfile>();

  for (const profile of profiles) {
    const key = channelProfileIdentityKey(profile);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...profile,
        productOverrides: [...profile.productOverrides]
      });
      continue;
    }

    const overridesBySku = new Map(
      existing.productOverrides.map((override) => [
        override.productSku.toLowerCase(),
        override
      ])
    );
    for (const override of profile.productOverrides) {
      overridesBySku.set(override.productSku.toLowerCase(), override);
    }
    byKey.set(key, {
      ...existing,
      productOverrides: [...overridesBySku.values()]
    });
  }

  return [...byKey.values()];
}

function channelProfileIdentityKey(
  profile: Pick<
    BusinessPlanWorkbookChannelProfile,
    "planYear" | "countryCode" | "retailerName" | "fdName" | "incoterms"
  >
) {
  return [
    profile.planYear,
    profile.countryCode,
    profile.retailerName,
    profile.fdName,
    profile.incoterms
  ]
    .map((value) => normalizeBusinessPart(String(value)))
    .join("|");
}

function channelMasterIdentityKey({
  countryCode,
  fdName,
  incoterms,
  retailerName
}: {
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
}) {
  return [countryCode, retailerName, fdName, incoterms]
    .map((value) => normalizeBusinessPart(String(value)))
    .join("|");
}

function profileMapByChannelIdentity(
  profiles: BusinessPlanWorkbookChannelProfile[]
) {
  return new Map(
    profiles.map((profile) => [channelProfileIdentityKey(profile), profile])
  );
}

function categoryMarginMapByIdentity(
  margins: BusinessPlanWorkbookCategoryMargin[]
) {
  return new Map(
    margins.map((margin) => [
      categoryMarginLookupKey({
        category: margin.category,
        countryCode: margin.countryCode,
        fdName: margin.fdName,
        incoterms: margin.incoterms,
        retailerName: margin.retailerName,
        planYear: margin.planYear
      }),
      margin
    ])
  );
}

function productPriceMapByIdentity(
  productPrices: BusinessPlanWorkbookProductPrice[]
) {
  return new Map(
    productPrices.map((productPrice) => [
      productLookupKey(productPrice.countryCode, productPrice.productSku),
      productPrice
    ])
  );
}

function productPriceOverrideForProfile(
  productPrice: BusinessPlanWorkbookProductPrice,
  profileId: string
): BusinessPlanChannelProductOverrideDraft {
  return {
    id: `bp-product-price:${productLookupKey(
      productPrice.countryCode,
      productPrice.productSku
    )}`,
    channelProfileId: profileId,
    productSku: productPrice.productSku,
    productName: productPrice.productName ?? null,
    category: productPrice.category ?? null,
    rrpLocal: productPrice.rrpLocal,
    rrpEur: productPrice.rrpEur,
    currency: productPrice.currency,
    kaBuyingMargin: null,
    kaFrontMargin: null,
    kaBackMargin: null,
    fdMargin: null,
    bomCost: productPrice.bomCostEur ?? null,
    logisticsCost: productPrice.logisticsCostEur ?? null
  };
}

function productPriceDiffersFromBaseRow(
  productPrice: BusinessPlanWorkbookProductPrice,
  baseRow: NormalTableRow
) {
  return (
    normalizeBusinessPart(productPrice.currency) !==
      normalizeBusinessPart(baseRow.currency) ||
    !nullableNumbersEqual(productPrice.rrpLocal, baseRow.rrpLocal) ||
    !nullableNumbersEqual(productPrice.rrpEur, baseRow.rrpEur)
  );
}

function businessPlanDataInputRowsFromEntries(
  entries: BusinessPlanEntryOption[],
  year: number
): BusinessPlanDataInputSourceRow[] {
  return entries
    .filter((entry) => entry.planYear === year)
    .sort(
      (left, right) =>
        left.planMonth - right.planMonth ||
        left.countryCode.localeCompare(right.countryCode) ||
        left.retailerName.localeCompare(right.retailerName) ||
        left.productSku.localeCompare(right.productSku)
    )
    .map((entry) => ({
      year: entry.planYear,
      month: entry.planMonth,
      countryCode: entry.countryCode,
      retailerName: entry.retailerName,
      fdName: entry.fdName,
      incoterms: entry.incoterms,
      category: entry.category,
      productSku: entry.productSku,
      promoDiscountPercent: entry.promoDiscountPercent,
      promoPriceLocal: entry.promoPriceLocal,
      siUnits: entry.siUnits,
      soUnits: entry.soUnits,
      kaBuyingMargin:
        entry.channelProfileId || entry.source === "BP_ASSUMPTION"
          ? entry.snapshotKaBuyingMargin ?? null
          : null,
      kaFrontMargin:
        entry.channelProfileId || entry.source === "BP_ASSUMPTION"
          ? entry.snapshotKaFrontMargin ?? null
          : null,
      kaBackMargin:
        entry.channelProfileId || entry.source === "BP_ASSUMPTION"
          ? entry.snapshotKaBackMargin ?? null
          : null,
      fdMargin:
        entry.channelProfileId || entry.source === "BP_ASSUMPTION"
          ? entry.snapshotFdMargin ?? null
          : null
    }));
}

function businessPlanDataInputSheet({
  options,
  rows
}: {
  options: BusinessPlanOptionGroups;
  rows: WorkbookCell[][];
}): WorkbookSheet {
  return {
    name: BP_DATA_INPUT_SHEET_NAME,
    autoFilter: true,
    columnWidths: BP_DATA_INPUT_WIDTHS,
    dataValidations: businessPlanDataInputDataValidations({
      lastRow: rows.length + 1,
      options
    }),
    freezeTopRows: 1,
    style: "businessPlan",
    rows: [BP_DATA_INPUT_HEADERS, ...rows]
  };
}

function businessPlanDataInputRows({
  rows,
  year
}: {
  rows: BusinessPlanDataInputSourceRow[];
  year: number;
}): WorkbookCell[][] {
  const savedRows = rows.map((row) => businessPlanDataInputWorkbookRow(row));
  const blankRows = Array.from(
    { length: BP_DATA_INPUT_EXTRA_ROWS },
    () => [year, "", "", "", "", "DDP", "", "", "", 0, 0, "", "", "", ""]
  );

  return [...savedRows, ...blankRows];
}

function businessPlanDataInputWorkbookRow(
  row: BusinessPlanDataInputSourceRow
): WorkbookCell[] {
  return [
    row.year,
    monthLabel(row.month),
    row.countryCode,
    row.retailerName,
    row.fdName,
    row.incoterms,
    row.productSku,
    row.promoDiscountPercent,
    row.promoPriceLocal ?? "",
    row.siUnits,
    row.soUnits,
    row.kaBuyingMargin ?? "",
    row.kaFrontMargin ?? "",
    row.kaBackMargin ?? "",
    row.fdMargin ?? ""
  ];
}

function businessPlanMasterDataSheet({
  options,
  rows
}: {
  options: BusinessPlanOptionGroups;
  rows: WorkbookCell[][];
}): WorkbookSheet {
  const lastRow = rows.length + 1;
  const headerRow = [
    ...BP_MASTER_DATA_HEADERS,
    "",
    "Currency",
    "FX rate to EUR"
  ];

  return {
    name: BP_MASTER_DATA_SHEET_NAME,
    columnWidths: BP_MASTER_DATA_WIDTHS,
    dataValidations: businessPlanMasterDataDataValidations({
      lastRow,
      options
    }),
    freezeTopRows: 1,
    tables: [
      {
        columns: BP_MASTER_DATA_HEADERS,
        name: BP_MASTER_DATA_TABLE_NAME,
        ref: `A1:${BP_MASTER_DATA_LAST_COLUMN}${lastRow}`,
        styleName: "TableStyleMedium2"
      }
    ],
    style: "bpMasterData",
    rows: [headerRow, ...rows]
  };
}

function businessPlanMasterDataRows({
  baseRows,
  channelProfiles,
  data,
  rows,
  year
}: {
  baseRows: NormalTableRow[];
  channelProfiles: BusinessPlanWorkbookChannelProfile[];
  data: ReferenceData;
  rows: BusinessPlanDataInputSourceRow[];
  year: number;
}): WorkbookCell[][] {
  const productRows = uniqueBy(
    baseRows,
    (row) => productLookupKey(row.countryCode, row.model)
  ).map(businessPlanMasterProductFromBaseRow);
  const channelRows = [
    ...businessPlanMasterChannelRowsFromBaseRows(baseRows),
    ...businessPlanMasterChannelRowsFromInputRows({ baseRows, data, rows, year }),
    ...businessPlanMasterChannelRowsFromProfiles({ baseRows, channelProfiles, year })
  ];
  const contentRows = businessPlanMasterRowsByCountry({
    channelRows,
    productRows
  });
  const fxRows = businessPlanMasterFxRows(data);
  const rowCount = Math.max(
    12,
    contentRows.length + BP_MASTER_DATA_EXTRA_ROWS,
    fxRows.length
  );

  return Array.from({ length: rowCount }, (_, index) =>
    businessPlanMasterDataVisualRow({
      channelRow: contentRows[index]?.channelRow ?? null,
      fxRow: fxRows[index] ?? null,
      monthName: index < 12 ? monthLabel(index + 1) : "",
      productRow: contentRows[index]?.productRow ?? null,
      rowNumber: index + 2
    })
  );
}

type BusinessPlanMasterProductRow = {
  bomCost: number | null;
  category: string;
  countryCode: string;
  currency: string;
  logisticsCost: number | null;
  productName: string;
  productSku: string;
  rrpEur: number | null;
  rrpLocal: number | null;
  vatRate: number | null;
};

type BusinessPlanMasterMarginValues = {
  fdMargin: number;
  kaBackMargin: number;
  kaBuyingMargin: number;
  kaFrontMargin: number;
};

type BusinessPlanMasterChannelRow = {
  countryCode: string;
  fdName: string;
  incoterms: string;
  marginsByCategory: Map<string, BusinessPlanMasterMarginValues>;
  retailerName: string;
};

function businessPlanMasterRowsByCountry({
  channelRows,
  productRows
}: {
  channelRows: BusinessPlanMasterChannelRow[];
  productRows: BusinessPlanMasterProductRow[];
}) {
  const countries = uniqueSorted([
    ...channelRows.map((row) => row.countryCode),
    ...productRows.map((row) => row.countryCode)
  ]);

  return countries.flatMap((countryCode) => {
    const countryChannelRows = channelRows.filter(
      (row) => normalizeBusinessPart(row.countryCode) === normalizeBusinessPart(countryCode)
    );
    const countryProductRows = productRows.filter(
      (row) => normalizeBusinessPart(row.countryCode) === normalizeBusinessPart(countryCode)
    );
    const rowCount = Math.max(countryChannelRows.length, countryProductRows.length);

    return Array.from({ length: rowCount }, (_, index) => ({
      channelRow: countryChannelRows[index] ?? null,
      productRow: countryProductRows[index] ?? null
    }));
  });
}

function businessPlanMasterProductFromBaseRow(
  row: NormalTableRow
): BusinessPlanMasterProductRow {
  return {
    bomCost: row.bomCost,
    category: row.category,
    countryCode: row.countryCode,
    currency: row.currency,
    logisticsCost: row.logisticsCost,
    productName: row.productName,
    productSku: row.model,
    rrpEur: row.rrpEur,
    rrpLocal: row.rrpLocal,
    vatRate: row.vatRate
  };
}

function businessPlanMasterChannelRowsFromBaseRows(
  baseRows: NormalTableRow[]
): BusinessPlanMasterChannelRow[] {
  const rowsByKey = new Map<string, BusinessPlanMasterChannelRow>();

  for (const row of baseRows) {
    addBusinessPlanMasterChannelMargin(rowsByKey, {
      category: row.category,
      countryCode: row.countryCode,
      fdName: row.fdName,
      incoterms: row.incoterms,
      margin: {
        fdMargin: row.fdMargin,
        kaBackMargin: row.kaBackMargin,
        kaBuyingMargin: row.kaBuyingMargin,
        kaFrontMargin: row.kaFrontMargin
      },
      retailerName: row.channelName
    });
  }

  return [...rowsByKey.values()];
}

function businessPlanMasterChannelRowsFromInputRows({
  baseRows,
  data,
  rows,
  year
}: {
  baseRows: NormalTableRow[];
  data: ReferenceData;
  rows: BusinessPlanDataInputSourceRow[];
  year: number;
}): BusinessPlanMasterChannelRow[] {
  const formalCategoryKeys = new Set(
    baseRows.map((row) =>
      categoryMarginLookupKey({
        category: row.category,
        countryCode: row.countryCode,
        fdName: row.fdName,
        incoterms: row.incoterms,
        retailerName: row.channelName,
        planYear: year
      })
    )
  );
  const rowsByKey = new Map<string, BusinessPlanMasterChannelRow>();

  for (const row of rows) {
    if (
      row.kaBuyingMargin === null ||
      row.kaFrontMargin === null ||
      row.kaBackMargin === null ||
      row.fdMargin === null
    ) {
      continue;
    }

    const baseRow = baseRowForDataInputRow({ baseRows, data, row });
    const category = baseRow?.category ?? row.category ?? "";
    if (!category) {
      continue;
    }

    const categoryKey = categoryMarginLookupKey({
      category,
      countryCode: row.countryCode,
      fdName: row.fdName,
      incoterms: row.incoterms,
      retailerName: row.retailerName,
      planYear: row.year
    });
    if (formalCategoryKeys.has(categoryKey)) {
      continue;
    }

    addBusinessPlanMasterChannelMargin(rowsByKey, {
      category,
      countryCode: row.countryCode,
      fdName: row.fdName,
      incoterms: row.incoterms,
      margin: {
        fdMargin: row.fdMargin,
        kaBackMargin: row.kaBackMargin,
        kaBuyingMargin: row.kaBuyingMargin,
        kaFrontMargin: row.kaFrontMargin
      },
      retailerName: row.retailerName
    });
  }

  return [...rowsByKey.values()];
}

function businessPlanMasterChannelRowsFromProfiles({
  baseRows,
  channelProfiles,
  year
}: {
  baseRows: NormalTableRow[];
  channelProfiles: BusinessPlanWorkbookChannelProfile[];
  year: number;
}): BusinessPlanMasterChannelRow[] {
  const formalCategoryKeys = new Set(
    baseRows.map((row) =>
      categoryMarginLookupKey({
        category: row.category,
        countryCode: row.countryCode,
        fdName: row.fdName,
        incoterms: row.incoterms,
        retailerName: row.channelName,
        planYear: year
      })
    )
  );
  const rowsByKey = new Map<string, BusinessPlanMasterChannelRow>();

  for (const profile of channelProfiles) {
    if (profile.planYear !== year) {
      continue;
    }

    for (const category of BP_MASTER_DATA_MARGIN_CATEGORIES.map((item) => item.category)) {
      const categoryKey = categoryMarginLookupKey({ ...profile, category });
      if (formalCategoryKeys.has(categoryKey)) {
        continue;
      }

      addBusinessPlanMasterChannelMargin(rowsByKey, {
        category,
        countryCode: profile.countryCode,
        fdName: profile.fdName,
        incoterms: profile.incoterms,
        margin: {
          fdMargin: profile.fdMargin,
          kaBackMargin: profile.kaBackMargin,
          kaBuyingMargin: profile.kaBuyingMargin,
          kaFrontMargin: profile.kaFrontMargin
        },
        retailerName: profile.retailerName
      });
    }
  }

  return [...rowsByKey.values()];
}

function addBusinessPlanMasterChannelMargin(
  rowsByKey: Map<string, BusinessPlanMasterChannelRow>,
  {
    category,
    countryCode,
    fdName,
    incoterms,
    margin,
    retailerName
  }: {
    category: string;
    countryCode: string;
    fdName: string;
    incoterms: string;
    margin: BusinessPlanMasterMarginValues;
    retailerName: string;
  }
) {
  const rowKey = channelMasterIdentityKey({
    countryCode,
    fdName,
    incoterms,
    retailerName
  });
  const existing =
    rowsByKey.get(rowKey) ??
    {
      countryCode,
      fdName,
      incoterms,
      marginsByCategory: new Map<string, BusinessPlanMasterMarginValues>(),
      retailerName
    };

  existing.marginsByCategory.set(normalizeBusinessPart(category), margin);
  rowsByKey.set(rowKey, existing);
}

function businessPlanMasterFxRows(
  data: ReferenceData
): Array<{ currency: string; exchangeRateToEur: number }> {
  const rowsByCurrency = new Map<string, { currency: string; exchangeRateToEur: number }>();

  rowsByCurrency.set("EUR", { currency: "EUR", exchangeRateToEur: 1 });
  for (const rate of data.exchangeRates ?? []) {
    if (rate.status !== "ACTIVE" || rate.exchangeRateToEur <= 0) {
      continue;
    }
    rowsByCurrency.set(rate.currency.toUpperCase(), {
      currency: rate.currency.toUpperCase(),
      exchangeRateToEur: rate.exchangeRateToEur
    });
  }

  return [...rowsByCurrency.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency)
  );
}

function businessPlanMasterDataVisualRow({
  channelRow,
  fxRow,
  monthName,
  productRow,
  rowNumber
}: {
  channelRow: BusinessPlanMasterChannelRow | null;
  fxRow: { currency: string; exchangeRateToEur: number } | null;
  monthName: string;
  productRow: BusinessPlanMasterProductRow | null;
  rowNumber: number;
}): WorkbookCell[] {
  return [
    monthName,
    channelRow?.countryCode ?? productRow?.countryCode ?? "",
    channelRow?.retailerName ?? "",
    channelRow?.fdName ?? "",
    channelRow?.incoterms ?? "",
    ...BP_MASTER_DATA_MARGIN_CATEGORIES.flatMap((category) => {
      const margin = channelRow?.marginsByCategory.get(
        normalizeBusinessPart(category.category)
      );

      return [
        nullablePercentCell(margin?.kaBuyingMargin),
        nullablePercentCell(margin?.kaFrontMargin),
        nullablePercentCell(margin?.kaBackMargin),
        nullablePercentCell(margin?.fdMargin)
      ];
    }),
    productRow?.productSku ?? "",
    productRow?.currency ?? "",
    productRow?.productName ?? "",
    productRow?.category ?? "",
    productRow ? localCurrencyNumberOrBlank(productRow.rrpLocal, productRow.currency) : "",
    businessPlanMasterRrpEurCell({ productRow, rowNumber }),
    nullablePercentCell(productRow?.vatRate),
    eurNumberOrBlank(productRow?.logisticsCost),
    eurNumberOrBlank(productRow?.bomCost),
    "",
    fxRow?.currency ?? "",
    fxRow?.exchangeRateToEur ?? ""
  ];
}

function businessPlanMasterRrpEurCell({
  productRow,
  rowNumber
}: {
  productRow: BusinessPlanMasterProductRow | null;
  rowNumber: number;
}): WorkbookCell {
  const formulaText = `IFERROR(IF(OR(W${rowNumber}="",Z${rowNumber}=""),"",Z${rowNumber}/VLOOKUP(W${rowNumber},$${BP_MASTER_DATA_FX_START_COLUMN}$2:$${BP_MASTER_DATA_FX_RATE_COLUMN}$100,2,FALSE)),"")`;

  return formula(formulaText, productRow?.rrpEur ?? null, EUR_CURRENCY_FORMAT);
}

function businessPlanProductPriceRowFromBaseRow({
  row,
  year
}: {
  row: NormalTableRow;
  year: number;
}): WorkbookCell[] {
  return [
    "Product Price",
    "Master Data",
    year,
    row.countryCode,
    "",
    "",
    "",
    "",
    row.model,
    row.currency,
    localCurrencyNumberOrBlank(row.rrpLocal, row.currency),
    eurNumberOrBlank(row.rrpEur),
    "",
    "",
    "",
    "",
    row.missingFields.length > 0 ? `Missing ${row.missingFields.join(", ")}` : "Ready"
  ];
}

function businessPlanCategoryMarginRowFromBaseRow({
  row,
  source,
  year
}: {
  row: NormalTableRow;
  source: "Master Data" | "BP-only";
  year: number;
}): WorkbookCell[] {
  return [
    "Category Margin",
    source,
    year,
    row.countryCode,
    row.channelName,
    row.fdName,
    row.incoterms,
    row.category,
    "",
    "",
    "",
    "",
    row.kaBuyingMargin,
    row.kaFrontMargin,
    row.kaBackMargin,
    row.fdMargin,
    "Ready"
  ];
}

function businessPlanCategoryMarginRowFromSourceRow({
  baseRow,
  row
}: {
  baseRow: NormalTableRow | null;
  row: BusinessPlanDataInputSourceRow;
}): WorkbookCell[] {
  if (baseRow) {
    return businessPlanCategoryMarginRowFromBaseRow({
      row: baseRow,
      source: "BP-only",
      year: row.year
    });
  }

  return [
    "Category Margin",
    "BP-only",
    row.year,
    row.countryCode,
    row.retailerName,
    row.fdName,
    row.incoterms,
    row.category ?? "",
    "",
    "",
    "",
    "",
    row.kaBuyingMargin ?? "",
    row.kaFrontMargin ?? "",
    row.kaBackMargin ?? "",
    row.fdMargin ?? "",
    row.category ? "Ready" : "Missing category"
  ];
}

function businessPlanCategoryMarginRowFromProfile(
  profile: BusinessPlanWorkbookChannelProfile,
  category: string
): WorkbookCell[] {
  return [
    "Category Margin",
    "BP-only",
    profile.planYear,
    profile.countryCode,
    profile.retailerName,
    profile.fdName,
    profile.incoterms,
    category,
    "",
    "",
    "",
    "",
    profile.kaBuyingMargin,
    profile.kaFrontMargin,
    profile.kaBackMargin,
    profile.fdMargin,
    "Ready"
  ];
}

function businessPlanBlankProductPriceRow({
  rowNumber,
  year
}: {
  rowNumber: number;
  year: number;
}): WorkbookCell[] {
  return [
    "Product Price",
    "BP-only",
    year,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    formula(`IF(OR(D${rowNumber}="",I${rowNumber}=""),"",IF(OR(J${rowNumber}="",K${rowNumber}="",L${rowNumber}=""),"Missing price","Ready"))`, "")
  ];
}

function businessPlanBlankCategoryMarginRow({
  rowNumber,
  year
}: {
  rowNumber: number;
  year: number;
}): WorkbookCell[] {
  return [
    "Category Margin",
    "BP-only",
    year,
    "",
    "",
    "",
    "DDP",
    "",
    "",
    "",
    "",
    "",
    "",
    formula(`IF(OR(D${rowNumber}="",E${rowNumber}="",F${rowNumber}="",G${rowNumber}="",H${rowNumber}=""),"",IF(OR(M${rowNumber}="",N${rowNumber}="",O${rowNumber}="",P${rowNumber}=""),"Missing margin","Ready"))`, "")
  ];
}

function businessPlanDirectInputRows({
  baseRows,
  data,
  dataInputRows,
  rowStart,
  year
}: {
  baseRows: NormalTableRow[];
  data: ReferenceData;
  dataInputRows: BusinessPlanDataInputSourceRow[];
  rowStart: number;
  year: number;
}): WorkbookCell[][] {
  const count = dataInputRows.length + BP_DIRECT_INPUT_EXTRA_ROWS;

  return Array.from({ length: count }, (_, index) => {
    const dataInputRow = dataInputRows[index];
    const baseRow = dataInputRow
      ? baseRowForDataInputRow({ baseRows, data, row: dataInputRow })
      : null;

    return businessPlanDirectInputRow({
      baseRow,
      dataInputRow,
      rowNumber: rowStart + index,
      year
    });
  });
}

function businessPlanDirectInputRow({
  baseRow,
  dataInputRow,
  rowNumber,
  year
}: {
  baseRow: NormalTableRow | null;
  dataInputRow: BusinessPlanDataInputSourceRow | undefined;
  rowNumber: number;
  year: number;
}): WorkbookCell[] {
  const productLookupLastRow = 5000;
  const masterLookupLastRow = productLookupLastRow;
  const productLookupKeyFormula = `D${rowNumber}&"|"&H${rowNumber}`;
  const masterLookupKeyFormula = `D${rowNumber}&"|"&E${rowNumber}&"|"&F${rowNumber}&"|"&G${rowNumber}&"|"&J${rowNumber}`;
  const productLookupFormula = (column: string) =>
    `IFERROR(INDEX('${BP_OPTIONS_SHEET_NAME}'!$${column}$2:$${column}$${productLookupLastRow},MATCH(${productLookupKeyFormula},'${BP_OPTIONS_SHEET_NAME}'!$K$2:$K$${productLookupLastRow},0)),"")`;
  const masterLookupFormula = (column: string) =>
    `IFERROR(INDEX('${BP_OPTIONS_SHEET_NAME}'!$${column}$2:$${column}$${masterLookupLastRow},MATCH(${masterLookupKeyFormula},'${BP_OPTIONS_SHEET_NAME}'!$T$2:$T$${masterLookupLastRow},0)),"")`;
  const fdBuyingPriceFormula = `IFERROR(M${rowNumber}/(1+N${rowNumber})*(1-O${rowNumber})*(1-R${rowNumber}),"")`;
  const gpPerUnitFormula = `IFERROR(U${rowNumber}-S${rowNumber}-T${rowNumber},"")`;
  const marginRebateFormula = `IFERROR(M${rowNumber}/(1+N${rowNumber})*(1-O${rowNumber})-M${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})*(1-Q${rowNumber}),"")`;
  const promoRebateFormula = `IFERROR(MAX(0,M${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})-AA${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})),"")`;
  const promoPriceLocalFormula = `IFERROR(L${rowNumber}*(1-Y${rowNumber}),"")`;
  const promoPriceEurFormula = `IFERROR(IF(L${rowNumber}=0,M${rowNumber}*(1-Y${rowNumber}),Z${rowNumber}/L${rowNumber}*M${rowNumber}),"")`;
  const siValueFormula = `IFERROR(U${rowNumber}*AB${rowNumber},"")`;
  const soValueFormula = `IFERROR(U${rowNumber}*AC${rowNumber},"")`;
  const gpFormula = `IFERROR(V${rowNumber}*AB${rowNumber},"")`;
  const promoRebateTotalFormula = `IFERROR((W${rowNumber}+X${rowNumber})*AC${rowNumber},"")`;
  const netProfitFormula = `IFERROR(AF${rowNumber}-AG${rowNumber},"")`;
  const promoPriceLocalValue = dataInputRow
    ? dataInputRow.promoPriceLocal ??
      (baseRow?.rrpLocal === null || baseRow?.rrpLocal === undefined
        ? null
        : baseRow.rrpLocal * (1 - dataInputRow.promoDiscountPercent))
    : null;
  const promoPriceEurValue =
    promoPriceLocalValue !== null &&
    baseRow?.rrpLocal !== null &&
    baseRow?.rrpLocal !== undefined &&
    baseRow.rrpLocal !== 0 &&
    baseRow.rrpEur !== null
      ? (promoPriceLocalValue / baseRow.rrpLocal) * baseRow.rrpEur
      : baseRow?.rrpEur === null || baseRow?.rrpEur === undefined || !dataInputRow
        ? null
        : baseRow.rrpEur * (1 - dataInputRow.promoDiscountPercent);

  return [
    dataInputRow?.year ?? year,
    dataInputRow ? monthLabel(dataInputRow.month) : "",
    formula(quarterFormulaForMonthCell(`B${rowNumber}`), dataInputRow ? quarterForMonth(dataInputRow.month) : ""),
    dataInputRow?.countryCode ?? "",
    dataInputRow?.retailerName ?? "",
    dataInputRow?.fdName ?? "",
    dataInputRow?.incoterms ?? "DDP",
    dataInputRow?.productSku ?? "",
    formula(productLookupFormula("L"), baseRow?.productName ?? ""),
    formula(productLookupFormula("M"), baseRow?.category ?? ""),
    formula(productLookupFormula("N"), baseRow?.currency ?? ""),
    formula(productLookupFormula("O"), baseRow?.rrpLocal ?? null, baseRow ? currencyFormatCode(baseRow.currency) : undefined),
    formula(productLookupFormula("P"), baseRow?.rrpEur ?? null, EUR_CURRENCY_FORMAT),
    formula(productLookupFormula("Q"), baseRow?.vatRate ?? null),
    formula(masterLookupFormula("V"), baseRow?.kaBuyingMargin ?? dataInputRow?.kaBuyingMargin ?? null),
    formula(masterLookupFormula("W"), baseRow?.kaFrontMargin ?? dataInputRow?.kaFrontMargin ?? null),
    formula(masterLookupFormula("X"), baseRow?.kaBackMargin ?? dataInputRow?.kaBackMargin ?? null),
    formula(masterLookupFormula("Y"), baseRow?.fdMargin ?? dataInputRow?.fdMargin ?? null),
    formula(productLookupFormula("R"), baseRow?.logisticsCost ?? null, EUR_CURRENCY_FORMAT),
    formula(productLookupFormula("S"), baseRow?.bomCost ?? null, EUR_CURRENCY_FORMAT),
    formula(fdBuyingPriceFormula, baseRow?.calculation?.fdBuyingPrice ?? null, EUR_CURRENCY_FORMAT),
    formula(gpPerUnitFormula, baseRow?.calculation?.gp ?? null, EUR_CURRENCY_FORMAT),
    formula(marginRebateFormula, null, EUR_CURRENCY_FORMAT),
    formula(promoRebateFormula, null, EUR_CURRENCY_FORMAT),
    dataInputRow?.promoDiscountPercent ?? "",
    dataInputRow?.promoPriceLocal !== null &&
    dataInputRow?.promoPriceLocal !== undefined
      ? formattedNumberOrBlank(
          dataInputRow.promoPriceLocal,
          baseRow ? currencyFormatCode(baseRow.currency) : EUR_CURRENCY_FORMAT
        )
      : formula(promoPriceLocalFormula, promoPriceLocalValue, baseRow ? currencyFormatCode(baseRow.currency) : undefined),
    formula(promoPriceEurFormula, promoPriceEurValue, EUR_CURRENCY_FORMAT),
    dataInputRow?.siUnits ?? 0,
    dataInputRow?.soUnits ?? 0,
    formula(siValueFormula, baseRow?.calculation?.fdBuyingPrice && dataInputRow ? baseRow.calculation.fdBuyingPrice * dataInputRow.siUnits : 0, EUR_CURRENCY_FORMAT),
    formula(soValueFormula, baseRow?.calculation?.fdBuyingPrice && dataInputRow ? baseRow.calculation.fdBuyingPrice * dataInputRow.soUnits : 0, EUR_CURRENCY_FORMAT),
    formula(gpFormula, baseRow?.calculation?.gp && dataInputRow ? baseRow.calculation.gp * dataInputRow.siUnits : 0, EUR_CURRENCY_FORMAT),
    formula(promoRebateTotalFormula, 0, EUR_CURRENCY_FORMAT),
    formula(netProfitFormula, 0, EUR_CURRENCY_FORMAT),
    baseRow?.key ?? ""
  ];
}

function businessPlanDataDrivenInputRows({
  baseRows,
  data,
  dataInputRows,
  rowStart
}: {
  baseRows: NormalTableRow[];
  data: ReferenceData;
  dataInputRows: BusinessPlanDataInputSourceRow[];
  rowStart: number;
}): WorkbookCell[][] {
  const count = dataInputRows.length + BP_DATA_INPUT_EXTRA_ROWS;

  return Array.from({ length: count }, (_, index) => {
    const bpInputRowNumber = rowStart + index;
    const dataInputRowNumber = index + 2;
    const dataInputRow = dataInputRows[index];
    const baseRow = dataInputRow
      ? baseRowForDataInputRow({ baseRows, data, row: dataInputRow })
      : null;

    return businessPlanDataDrivenInputRow({
      baseRow,
      dataInputRow,
      dataInputRowNumber,
      rowNumber: bpInputRowNumber
    });
  });
}

function businessPlanDataDrivenInputRow({
  baseRow,
  dataInputRow,
  dataInputRowNumber,
  rowNumber
}: {
  baseRow: NormalTableRow | null;
  dataInputRow: BusinessPlanDataInputSourceRow | undefined;
  dataInputRowNumber: number;
  rowNumber: number;
}): WorkbookCell[] {
  const dataSheet = `'${BP_DATA_INPUT_SHEET_NAME}'`;
  const productLookupLastRow = 5000;
  const masterLookupLastRow = productLookupLastRow;
  const productLookupKeyFormula = `${dataSheet}!C${dataInputRowNumber}&"|"&${dataSheet}!G${dataInputRowNumber}`;
  const masterLookupKeyFormula = `${dataSheet}!C${dataInputRowNumber}&"|"&${dataSheet}!D${dataInputRowNumber}&"|"&${dataSheet}!E${dataInputRowNumber}&"|"&${dataSheet}!F${dataInputRowNumber}&"|"&J${rowNumber}`;
  const productLookupFormula = (column: string) =>
    `IFERROR(INDEX('${BP_OPTIONS_SHEET_NAME}'!$${column}$2:$${column}$${productLookupLastRow},MATCH(${productLookupKeyFormula},'${BP_OPTIONS_SHEET_NAME}'!$K$2:$K$${productLookupLastRow},0)),"")`;
  const masterLookupFormula = (column: string, fallbackColumn: string) =>
    `IFERROR(INDEX('${BP_OPTIONS_SHEET_NAME}'!$${column}$2:$${column}$${masterLookupLastRow},MATCH(${masterLookupKeyFormula},'${BP_OPTIONS_SHEET_NAME}'!$T$2:$T$${masterLookupLastRow},0)),${dataSheet}!${fallbackColumn}${dataInputRowNumber})`;
  const masterRowKeyFormula = `IFERROR(INDEX('${BP_OPTIONS_SHEET_NAME}'!$U$2:$U$${masterLookupLastRow},MATCH(${masterLookupKeyFormula},'${BP_OPTIONS_SHEET_NAME}'!$T$2:$T$${masterLookupLastRow},0)),"")`;
  const fdBuyingPriceFormula = `IFERROR(M${rowNumber}/(1+N${rowNumber})*(1-O${rowNumber})*(1-R${rowNumber}),"")`;
  const gpPerUnitFormula = `IFERROR(U${rowNumber}-S${rowNumber}-T${rowNumber},"")`;
  const marginRebateFormula = `IFERROR(M${rowNumber}/(1+N${rowNumber})*(1-O${rowNumber})-M${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})*(1-Q${rowNumber}),"")`;
  const promoRebateFormula = `IFERROR(MAX(0,M${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})-AA${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})),"")`;
  const promoPriceLocalFormula = `IFERROR(IF(${dataSheet}!I${dataInputRowNumber}<>"",${dataSheet}!I${dataInputRowNumber},L${rowNumber}*(1-Y${rowNumber})),"")`;
  const promoPriceEurFormula = `IFERROR(IF(L${rowNumber}=0,M${rowNumber}*(1-Y${rowNumber}),Z${rowNumber}/L${rowNumber}*M${rowNumber}),"")`;
  const siValueFormula = `IFERROR(U${rowNumber}*AB${rowNumber},"")`;
  const soValueFormula = `IFERROR(U${rowNumber}*AC${rowNumber},"")`;
  const gpFormula = `IFERROR(V${rowNumber}*AB${rowNumber},"")`;
  const promoRebateTotalFormula = `IFERROR((W${rowNumber}+X${rowNumber})*AC${rowNumber},"")`;
  const netProfitFormula = `IFERROR(AF${rowNumber}-AG${rowNumber},"")`;
  const promoPriceLocalValue = dataInputRow
    ? dataInputRow.promoPriceLocal ??
      (baseRow?.rrpLocal === null || baseRow?.rrpLocal === undefined
        ? null
        : baseRow.rrpLocal * (1 - dataInputRow.promoDiscountPercent))
    : null;
  const promoPriceEurValue =
    promoPriceLocalValue !== null &&
    baseRow?.rrpLocal !== null &&
    baseRow?.rrpLocal !== undefined &&
    baseRow.rrpLocal !== 0 &&
    baseRow.rrpEur !== null
      ? (promoPriceLocalValue / baseRow.rrpLocal) * baseRow.rrpEur
      : baseRow?.rrpEur === null || baseRow?.rrpEur === undefined || !dataInputRow
        ? null
        : baseRow.rrpEur * (1 - dataInputRow.promoDiscountPercent);

  return [
    formula(`IF(${dataSheet}!A${dataInputRowNumber}="","",${dataSheet}!A${dataInputRowNumber})`, dataInputRow?.year ?? ""),
    formula(`IF(${dataSheet}!B${dataInputRowNumber}="","",${dataSheet}!B${dataInputRowNumber})`, dataInputRow ? monthLabel(dataInputRow.month) : ""),
    formula(quarterFormulaForMonthCell(`B${rowNumber}`), dataInputRow ? quarterForMonth(dataInputRow.month) : ""),
    formula(`IF(${dataSheet}!C${dataInputRowNumber}="","",${dataSheet}!C${dataInputRowNumber})`, dataInputRow?.countryCode ?? ""),
    formula(`IF(${dataSheet}!D${dataInputRowNumber}="","",${dataSheet}!D${dataInputRowNumber})`, dataInputRow?.retailerName ?? ""),
    formula(`IF(${dataSheet}!E${dataInputRowNumber}="","",${dataSheet}!E${dataInputRowNumber})`, dataInputRow?.fdName ?? ""),
    formula(`IF(${dataSheet}!F${dataInputRowNumber}="","",${dataSheet}!F${dataInputRowNumber})`, dataInputRow?.incoterms ?? ""),
    formula(`IF(${dataSheet}!G${dataInputRowNumber}="","",${dataSheet}!G${dataInputRowNumber})`, dataInputRow?.productSku ?? ""),
    formula(productLookupFormula("L"), baseRow?.productName ?? ""),
    formula(productLookupFormula("M"), baseRow?.category ?? ""),
    formula(productLookupFormula("N"), baseRow?.currency ?? ""),
    formula(productLookupFormula("O"), baseRow?.rrpLocal ?? null, baseRow ? currencyFormatCode(baseRow.currency) : undefined),
    formula(productLookupFormula("P"), baseRow?.rrpEur ?? null, EUR_CURRENCY_FORMAT),
    formula(productLookupFormula("Q"), baseRow?.vatRate ?? null),
    formula(masterLookupFormula("V", "L"), baseRow?.kaBuyingMargin ?? dataInputRow?.kaBuyingMargin ?? null),
    formula(masterLookupFormula("W", "M"), baseRow?.kaFrontMargin ?? dataInputRow?.kaFrontMargin ?? null),
    formula(masterLookupFormula("X", "N"), baseRow?.kaBackMargin ?? dataInputRow?.kaBackMargin ?? null),
    formula(masterLookupFormula("Y", "O"), baseRow?.fdMargin ?? dataInputRow?.fdMargin ?? null),
    formula(productLookupFormula("R"), baseRow?.logisticsCost ?? null, EUR_CURRENCY_FORMAT),
    formula(productLookupFormula("S"), baseRow?.bomCost ?? null, EUR_CURRENCY_FORMAT),
    formula(fdBuyingPriceFormula, baseRow?.calculation?.fdBuyingPrice ?? null, EUR_CURRENCY_FORMAT),
    formula(gpPerUnitFormula, baseRow?.calculation?.gp ?? null, EUR_CURRENCY_FORMAT),
    formula(marginRebateFormula, null, EUR_CURRENCY_FORMAT),
    formula(promoRebateFormula, null, EUR_CURRENCY_FORMAT),
    formula(`IF(${dataSheet}!H${dataInputRowNumber}="","",${dataSheet}!H${dataInputRowNumber})`, dataInputRow?.promoDiscountPercent ?? ""),
    formula(promoPriceLocalFormula, promoPriceLocalValue, baseRow ? currencyFormatCode(baseRow.currency) : undefined),
    formula(promoPriceEurFormula, promoPriceEurValue, EUR_CURRENCY_FORMAT),
    formula(`IF(${dataSheet}!J${dataInputRowNumber}="","",${dataSheet}!J${dataInputRowNumber})`, dataInputRow?.siUnits ?? ""),
    formula(`IF(${dataSheet}!K${dataInputRowNumber}="","",${dataSheet}!K${dataInputRowNumber})`, dataInputRow?.soUnits ?? ""),
    formula(siValueFormula, baseRow?.calculation?.fdBuyingPrice && dataInputRow ? baseRow.calculation.fdBuyingPrice * dataInputRow.siUnits : 0, EUR_CURRENCY_FORMAT),
    formula(soValueFormula, baseRow?.calculation?.fdBuyingPrice && dataInputRow ? baseRow.calculation.fdBuyingPrice * dataInputRow.soUnits : 0, EUR_CURRENCY_FORMAT),
    formula(gpFormula, baseRow?.calculation?.gp && dataInputRow ? baseRow.calculation.gp * dataInputRow.siUnits : 0, EUR_CURRENCY_FORMAT),
    formula(promoRebateTotalFormula, 0, EUR_CURRENCY_FORMAT),
    formula(netProfitFormula, 0, EUR_CURRENCY_FORMAT),
    formula(masterRowKeyFormula, baseRow?.key ?? "")
  ];
}

function baseRowForDataInputRow({
  baseRows,
  data,
  row
}: {
  baseRows: NormalTableRow[];
  data: ReferenceData;
  row: BusinessPlanDataInputSourceRow;
}) {
  const masterRow = baseRows.find(
    (baseRow) =>
      businessKeyForRow(baseRow) ===
      businessKeyForParts({
        countryCode: row.countryCode,
        retailerName: row.retailerName,
        fdName: row.fdName,
        incoterms: row.incoterms,
        productSku: row.productSku
      })
  );
  if (masterRow) {
    return masterRow;
  }
  if (
    row.kaBuyingMargin === null ||
    row.kaFrontMargin === null ||
    row.kaBackMargin === null ||
    row.fdMargin === null
  ) {
    return null;
  }

  const profile = {
    id: businessPlanChannelProfileKey({
      planYear: row.year,
      countryCode: row.countryCode,
      retailerName: row.retailerName,
      fdName: row.fdName,
      incoterms: row.incoterms
    }),
    planYear: row.year,
    countryCode: row.countryCode,
    retailerName: row.retailerName,
    fdName: row.fdName,
    incoterms: row.incoterms,
    kaBuyingMargin: row.kaBuyingMargin,
    kaFrontMargin: row.kaFrontMargin,
    kaBackMargin: row.kaBackMargin,
    fdMargin: row.fdMargin
  };
  const assumption = buildBusinessPlanProfileAssumption({
    data,
    profile,
    productSku: row.productSku,
    override: null
  });
  if (!assumption) {
    return null;
  }

  return (
    buildBusinessPlanBaseRows(data, [assumption]).find(
      (item) => item.key === temporaryAssumptionRowKey(assumption)
    ) ?? null
  );
}

function firstProductBaseRow({
  countryCode,
  data,
  productSku
}: {
  countryCode: string;
  data: ReferenceData;
  productSku: string;
}) {
  return (
    buildBusinessPlanBaseRows(data).find(
      (row) =>
        normalizeBusinessPart(row.countryCode) ===
          normalizeBusinessPart(countryCode) &&
        normalizeBusinessPart(row.model) === normalizeBusinessPart(productSku)
    ) ?? null
  );
}

function businessPlanNewChannelTargetsSheet({
  options,
  profileOptionCount,
  year
}: {
  options: BusinessPlanOptionGroups;
  profileOptionCount: number;
  year: number;
}): WorkbookSheet {
  return {
    name: BP_NEW_TARGETS_SHEET_NAME,
    autoFilter: true,
    columnWidths: [10, 14, 10, 34, 18, 20, 22, 16, 16],
    dataValidations: businessPlanNewTargetDataValidations({
      lastRow: BP_NEW_TARGET_EXTRA_ROWS + 1,
      options,
      profileOptionCount
    }),
    freezeTopRows: 1,
    style: "businessPlan",
    rows: [
      BP_NEW_TARGET_HEADERS,
      ...businessPlanBlankNewTargetRows({ rowStart: 2, year })
    ]
  };
}

function businessPlanInputDataValidations({
  lastRow,
  options
}: {
  lastRow: number;
  options: BusinessPlanOptionGroups;
}): WorkbookDataValidation[] {
  return [
    dataValidationForOption({
      optionColumn: "A",
      optionCount: options.months.length,
      targetRange: `B2:B${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "B",
      optionCount: optionRowCount("Country", options.countries.length),
      targetRange: `D2:D${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "C",
      optionCount: optionRowCount("Channel / KA", options.channels.length),
      targetRange: `E2:E${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "D",
      optionCount: optionRowCount("FD", options.fds.length),
      targetRange: `F2:F${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "E",
      optionCount: optionRowCount("Incoterms", options.incoterms.length),
      targetRange: `G2:G${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "F",
      optionCount: optionRowCount("Model code", options.models.length),
      targetRange: `H2:H${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "G",
      optionCount: optionRowCount("Currency", options.currencies.length),
      targetRange: `K2:K${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "H",
      optionCount: optionRowCount("Product name", options.productNames.length),
      targetRange: `I2:I${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "I",
      optionCount: optionRowCount("Category", options.categories.length),
      targetRange: `J2:J${lastRow}`
    })
  ].filter((validation): validation is WorkbookDataValidation => validation !== null);
}

function businessPlanMasterDataDataValidations({
  lastRow,
  options
}: {
  lastRow: number;
  options: BusinessPlanOptionGroups;
}): WorkbookDataValidation[] {
  return [
    dataValidationForOption({
      optionColumn: "A",
      optionCount: options.months.length,
      targetRange: `A2:A${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "B",
      optionCount: optionRowCount("Country", options.countries.length),
      targetRange: `B2:B${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "E",
      optionCount: optionRowCount("Incoterms", options.incoterms.length),
      targetRange: `E2:E${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "F",
      optionCount: optionRowCount("Model code", options.models.length),
      targetRange: `V2:V${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "G",
      optionCount: optionRowCount("Currency", options.currencies.length),
      targetRange: `W2:W${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "I",
      optionCount: optionRowCount("Category", options.categories.length),
      targetRange: `Y2:Y${lastRow}`
    })
  ].filter((validation): validation is WorkbookDataValidation => validation !== null);
}

function businessPlanDataInputDataValidations({
  lastRow,
  options
}: {
  lastRow: number;
  options: BusinessPlanOptionGroups;
}): WorkbookDataValidation[] {
  return [
    dataValidationForOption({
      optionColumn: "A",
      optionCount: options.months.length,
      targetRange: `B2:B${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "B",
      optionCount: optionRowCount("Country", options.countries.length),
      targetRange: `C2:C${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "E",
      optionCount: optionRowCount("Incoterms", options.incoterms.length),
      targetRange: `F2:F${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "F",
      optionCount: optionRowCount("Model code", options.models.length),
      targetRange: `G2:G${lastRow}`
    })
  ].filter((validation): validation is WorkbookDataValidation => validation !== null);
}

function businessPlanChannelSetupDataValidations({
  lastRow,
  options
}: {
  lastRow: number;
  options: BusinessPlanOptionGroups;
}): WorkbookDataValidation[] {
  return [
    dataValidationForOption({
      optionColumn: "B",
      optionCount: options.countries.length,
      targetRange: `B2:B${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "E",
      optionCount: options.incoterms.length,
      targetRange: `E2:E${lastRow}`
    })
  ].filter((validation): validation is WorkbookDataValidation => validation !== null);
}

function businessPlanOverrideDataValidations({
  lastRow,
  options,
  profileOptionCount
}: {
  lastRow: number;
  options: BusinessPlanOptionGroups;
  profileOptionCount: number;
}): WorkbookDataValidation[] {
  return [
    dataValidationForOption({
      optionColumn: "J",
      optionCount: profileOptionCount,
      targetRange: `A2:A${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "F",
      optionCount: options.models.length,
      targetRange: `B2:B${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "G",
      optionCount: options.currencies.length,
      targetRange: `E2:E${lastRow}`
    })
  ].filter((validation): validation is WorkbookDataValidation => validation !== null);
}

function businessPlanNewTargetDataValidations({
  lastRow,
  options,
  profileOptionCount
}: {
  lastRow: number;
  options: BusinessPlanOptionGroups;
  profileOptionCount: number;
}): WorkbookDataValidation[] {
  return [
    dataValidationForOption({
      optionColumn: "A",
      optionCount: options.months.length,
      targetRange: `B2:B${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "J",
      optionCount: profileOptionCount,
      targetRange: `D2:D${lastRow}`
    }),
    dataValidationForOption({
      optionColumn: "F",
      optionCount: options.models.length,
      targetRange: `E2:E${lastRow}`
    })
  ].filter((validation): validation is WorkbookDataValidation => validation !== null);
}

function businessPlanBlankNewTargetRows({
  rowStart,
  year
}: {
  rowStart: number;
  year: number;
}): WorkbookCell[][] {
  return Array.from({ length: BP_NEW_TARGET_EXTRA_ROWS }, (_, index) => {
    const rowNumber = rowStart + index;

    return [
      year,
      "",
      formula(quarterFormulaForMonthCell(`B${rowNumber}`), ""),
      "",
      "",
      0,
      "",
      0,
      0
    ];
  });
}

function businessPlanNewTargetWorkbookRow({
  entry,
  rowNumber
}: {
  entry: BusinessPlanEntryOption;
  rowNumber: number;
}): WorkbookCell[] {
  return [
    entry.planYear,
    monthLabel(entry.planMonth),
    formula(quarterFormulaForMonthCell(`B${rowNumber}`), quarterForMonth(entry.planMonth)),
    businessPlanChannelProfileLabel(entry),
    entry.productSku,
    entry.promoDiscountPercent,
    entry.promoPriceLocal === null
      ? ""
      : formattedNumberOrBlank(
          entry.promoPriceLocal,
          currencyFormatCode(entry.snapshotCurrency ?? "")
        ),
    entry.siUnits,
    entry.soUnits
  ];
}

function channelProfileOptionRowCount(
  channelProfiles: BusinessPlanWorkbookChannelProfile[]
) {
  return Math.max(channelProfiles.length + BP_CHANNEL_SETUP_EXTRA_ROWS, 1);
}

function channelProfileOptionCell(rowNumber: number): WorkbookCell {
  return formula(
    `IF(OR('${BP_CHANNEL_SETUP_SHEET_NAME}'!B${rowNumber}="",'${BP_CHANNEL_SETUP_SHEET_NAME}'!C${rowNumber}="",'${BP_CHANNEL_SETUP_SHEET_NAME}'!D${rowNumber}="",'${BP_CHANNEL_SETUP_SHEET_NAME}'!E${rowNumber}=""),"",'${BP_CHANNEL_SETUP_SHEET_NAME}'!B${rowNumber}&" | "&'${BP_CHANNEL_SETUP_SHEET_NAME}'!C${rowNumber}&" / "&'${BP_CHANNEL_SETUP_SHEET_NAME}'!D${rowNumber}&" / "&'${BP_CHANNEL_SETUP_SHEET_NAME}'!E${rowNumber})`,
    ""
  );
}

function nullablePercentCell(value: number | null | undefined): WorkbookCell {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function optionRowCount(optionName: string, valueCount: number) {
  if (optionName !== "Month") {
    return (
      valueCount +
      BP_MASTER_DATA_DYNAMIC_OPTION_ROWS * BP_MASTER_DATA_MARGIN_CATEGORIES.length
    );
  }

  return valueCount;
}

function dataValidationForOption({
  optionColumn,
  optionCount,
  targetRange
}: {
  optionColumn: string;
  optionCount: number;
  targetRange: string;
}): WorkbookDataValidation | null {
  if (optionCount === 0) {
    return null;
  }

  return {
    type: "list",
    formula1: `'${BP_OPTIONS_SHEET_NAME}'!$${optionColumn}$2:$${optionColumn}$${
      optionCount + 1
    }`,
    ranges: [targetRange]
  };
}

export function parseBusinessPlanWorkbook(
  workbook: Buffer | ArrayBuffer,
  data: ReferenceData
): BusinessPlanImportResult {
  const sheetName =
    readWorkbookSheetNames(workbook).find(
      (name) => normalizeHeader(name) === normalizeHeader(BP_INPUT_SHEET_NAME)
    ) ?? BP_INPUT_SHEET_NAME;
  const legacySetupResult = parseLegacyBusinessPlanChannelSetup(workbook);
  const profileResult = parseBusinessPlanChannelProfiles(workbook);
  const overrideResult = parseBusinessPlanChannelProductOverrides(
    workbook,
    profileResult.channelProfiles
  );
  const masterDataProfileResult = parseBusinessPlanMasterDataProfiles({
    data,
    workbook
  });
  const channelProfiles = mergeWorkbookChannelProfiles([
    ...overrideResult.channelProfiles
  ]);
  const channelProfilesByIdentity = profileMapByChannelIdentity(channelProfiles);
  const categoryMarginsByIdentity = categoryMarginMapByIdentity(
    masterDataProfileResult.categoryMargins
  );
  const productPricesByIdentity = productPriceMapByIdentity(
    masterDataProfileResult.productPrices
  );
  const rowsByKey = new Map(
    buildBusinessPlanBaseRows(data, legacySetupResult.assumptions).map((row) => [
      row.key,
      row
    ])
  );
  const rowsByBusinessKey = new Map(
    buildBusinessPlanBaseRows(data, legacySetupResult.assumptions).map((row) => [
      businessKeyForRow(row),
      row
    ])
  );
  const assumptionByRowKey = new Map(
    legacySetupResult.assumptions.map((assumption) => [
      temporaryAssumptionRowKey(assumption),
      assumption
    ])
  );
  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const headerMatch = findBusinessPlanHeaderRow(worksheetRows);
  const errors: BusinessPlanImportError[] = [
    ...legacySetupResult.errors,
    ...profileResult.errors,
    ...overrideResult.errors,
    ...masterDataProfileResult.errors
  ];
  const importedRows: BusinessPlanDraftLine[] = [];
  const seenRows = new Set<string>();
  const inlineProfiles = new Map<string, BusinessPlanWorkbookChannelProfile>();

  if (!headerMatch) {
    errors.push(
        {
          sheetName,
          rowNumber: 1,
          message: "Missing BP Input header row."
        }
    );
  } else {
    for (const worksheetRow of worksheetRows.filter(
      (row) => row.rowNumber > headerMatch.headerRow.rowNumber
    )) {
      if (
        isBlankWorksheetRow(worksheetRow) ||
        isBlankBusinessPlanDataInputRow(worksheetRow, headerMatch.indexes)
      ) {
        continue;
      }

      const parsed = parseBusinessPlanWorksheetRow({
        data,
        indexes: headerMatch.indexes,
        row: worksheetRow,
        rowsByBusinessKey,
        rowsByKey,
        assumptionByRowKey,
        categoryMarginsByIdentity,
        channelProfilesByIdentity,
        sheetName,
        productPricesByIdentity
      });

      if ("error" in parsed) {
        errors.push(parsed.error);
        continue;
      }

      collectInlineChannelProfile({
        errors,
        profile: parsed.channelProfile,
        profiles: inlineProfiles,
        rowNumber: worksheetRow.rowNumber,
        sheetName
      });
      addImportedBusinessPlanRow({
        errors,
        importedRows,
        row: parsed.row,
        rowNumber: worksheetRow.rowNumber,
        seenRows,
        sheetName
      });
    }
  }

  const dataInputResult = parseBusinessPlanDataInput({
    data,
    workbook
  });
  errors.push(...dataInputResult.errors);
  for (const item of dataInputResult.rows) {
    collectInlineChannelProfile({
      errors,
      profile: item.channelProfile,
      profiles: inlineProfiles,
      rowNumber: item.rowNumber,
      sheetName: item.sheetName
    });
    addImportedBusinessPlanRow({
      duplicateMode: "skip",
      errors,
      importedRows,
      row: item.row,
      rowNumber: item.rowNumber,
      seenRows,
      sheetName: item.sheetName
    });
  }

  const newTargetResult = parseBusinessPlanNewChannelTargets({
    channelProfiles,
    data,
    workbook
  });
  errors.push(...newTargetResult.errors);
  for (const item of newTargetResult.rows) {
    addImportedBusinessPlanRow({
      errors,
      importedRows,
      row: item.row,
      rowNumber: item.rowNumber,
      seenRows,
      sheetName: item.sheetName
    });
  }

  return {
    rows: importedRows,
    channelProfiles: mergeWorkbookChannelProfiles([
      ...channelProfiles,
      ...inlineProfiles.values()
    ]),
    errors
  };
}

export function businessPlanFileName(prefix: string, reference = "template") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeReference = reference.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();

  return `${prefix}-${safeReference}-${timestamp}.xlsx`;
}

function businessPlanTemplateRow({
  month,
  row,
  rowNumber,
  year
}: {
  month: number;
  row: NormalTableRow;
  rowNumber: number;
  year: number;
}): WorkbookCell[] {
  const formulaForQuarter = quarterFormulaForMonthCell(`B${rowNumber}`);
  const fdBuyingPriceFormula = `IFERROR(M${rowNumber}/(1+N${rowNumber})*(1-O${rowNumber})*(1-R${rowNumber}),"")`;
  const gpPerUnitFormula = `IFERROR(U${rowNumber}-S${rowNumber}-T${rowNumber},"")`;
  const marginRebateFormula = `IFERROR(M${rowNumber}/(1+N${rowNumber})*(1-O${rowNumber})-M${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})*(1-Q${rowNumber}),"")`;
  const promoRebateFormula = `IFERROR(MAX(0,M${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})-AA${rowNumber}/(1+N${rowNumber})*(1-P${rowNumber})),"")`;
  const promoPriceLocalFormula = `IFERROR(L${rowNumber}*(1-Y${rowNumber}),"")`;
  const promoPriceEurFormula = `IFERROR(IF(L${rowNumber}=0,M${rowNumber}*(1-Y${rowNumber}),Z${rowNumber}/L${rowNumber}*M${rowNumber}),"")`;
  const siValueFormula = `IFERROR(U${rowNumber}*AB${rowNumber},"")`;
  const soValueFormula = `IFERROR(U${rowNumber}*AC${rowNumber},"")`;
  const gpFormula = `IFERROR(V${rowNumber}*AB${rowNumber},"")`;
  const promoRebateTotalFormula = `IFERROR((W${rowNumber}+X${rowNumber})*AC${rowNumber},"")`;
  const netProfitFormula = `IFERROR(AF${rowNumber}-AG${rowNumber},"")`;

  return [
    year,
    monthLabel(month),
    formula(formulaForQuarter, quarterForMonth(month)),
    row.countryCode,
    row.channelName,
    row.fdName,
    row.incoterms,
    row.model,
    row.productName,
    row.category,
    row.currency,
    localCurrencyNumberOrBlank(row.rrpLocal, row.currency),
    eurNumberOrBlank(row.rrpEur),
    row.vatRate,
    row.kaBuyingMargin,
    row.kaFrontMargin,
    row.kaBackMargin,
    row.fdMargin,
    eurNumberOrBlank(row.logisticsCost),
    eurNumberOrBlank(row.bomCost),
    formula(fdBuyingPriceFormula, row.calculation?.fdBuyingPrice, EUR_CURRENCY_FORMAT),
    formula(gpPerUnitFormula, row.calculation?.gp, EUR_CURRENCY_FORMAT),
    formula(marginRebateFormula, null, EUR_CURRENCY_FORMAT),
    formula(promoRebateFormula, null, EUR_CURRENCY_FORMAT),
    0,
    formula(promoPriceLocalFormula, row.rrpLocal, currencyFormatCode(row.currency)),
    formula(promoPriceEurFormula, row.rrpEur, EUR_CURRENCY_FORMAT),
    0,
    0,
    formula(siValueFormula, 0, EUR_CURRENCY_FORMAT),
    formula(soValueFormula, 0, EUR_CURRENCY_FORMAT),
    formula(gpFormula, 0, EUR_CURRENCY_FORMAT),
    formula(promoRebateTotalFormula, 0, EUR_CURRENCY_FORMAT),
    formula(netProfitFormula, 0, EUR_CURRENCY_FORMAT),
    row.key
  ];
}

function quarterFormulaForMonthCell(cellReference: string) {
  return `IFERROR(CHOOSE(MATCH(${cellReference},'${BP_OPTIONS_SHEET_NAME}'!$A$2:$A$13,0),"Q1","Q1","Q1","Q2","Q2","Q2","Q3","Q3","Q3","Q4","Q4","Q4"),"")`;
}

function findBusinessPlanHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      year: findHeaderIndex(row, HEADER_ALIASES.year),
      month: findHeaderIndex(row, HEADER_ALIASES.month),
      countryCode: findHeaderIndex(row, HEADER_ALIASES.countryCode),
      channelName: findHeaderIndex(row, HEADER_ALIASES.channelName),
      fdName: findHeaderIndex(row, HEADER_ALIASES.fdName),
      incoterms: findHeaderIndex(row, HEADER_ALIASES.incoterms),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      productName: findHeaderIndex(row, ["product name", "name", "产品名称"]),
      category: findHeaderIndex(row, ["category", "品类"]),
      currency: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.currency),
      rrpLocal: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpLocal),
      rrpEur: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpEur),
      promoDiscountPercent: findHeaderIndex(
        row,
        HEADER_ALIASES.promoDiscountPercent
      ),
      promoPriceLocal: findHeaderIndex(row, HEADER_ALIASES.promoPriceLocal),
      siUnits: findHeaderIndex(row, HEADER_ALIASES.siUnits),
      soUnits: findHeaderIndex(row, HEADER_ALIASES.soUnits),
      rowKey: findHeaderIndex(row, HEADER_ALIASES.rowKey),
      kaBuyingMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.kaBuyingMargin),
      kaFrontMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.kaFrontMargin),
      kaBackMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.kaBackMargin),
      fdMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.fdMargin),
      bomCost: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.bomCost),
      logisticsCost: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.logisticsCost)
    };

    if (
      indexes.year >= 0 &&
      indexes.month >= 0 &&
      (indexes.rowKey >= 0 ||
        (indexes.countryCode >= 0 &&
          indexes.channelName >= 0 &&
          indexes.fdName >= 0 &&
          indexes.incoterms >= 0 &&
          indexes.productSku >= 0)) &&
      (indexes.promoDiscountPercent >= 0 || indexes.promoPriceLocal >= 0) &&
      indexes.siUnits >= 0 &&
      indexes.soUnits >= 0
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parseBusinessPlanWorksheetRow({
  assumptionByRowKey,
  categoryMarginsByIdentity,
  channelProfilesByIdentity,
  data,
  indexes,
  productPricesByIdentity,
  row,
  rowsByBusinessKey,
  rowsByKey,
  sheetName
}: {
  indexes: HeaderIndexes;
  row: XlsxRow;
  data: ReferenceData;
  assumptionByRowKey: Map<string, BusinessPlanTemporaryAssumption>;
  categoryMarginsByIdentity?: Map<string, BusinessPlanWorkbookCategoryMargin>;
  channelProfilesByIdentity?: Map<string, BusinessPlanWorkbookChannelProfile>;
  rowsByBusinessKey: Map<string, NormalTableRow>;
  rowsByKey: Map<string, NormalTableRow>;
  productPricesByIdentity?: Map<string, BusinessPlanWorkbookProductPrice>;
  sheetName: string;
}):
  | {
      row: BusinessPlanDraftLine;
      channelProfile?: BusinessPlanWorkbookChannelProfile;
    }
  | { error: BusinessPlanImportError } {
  const rowKeyValue = getOptionalCell(row, indexes.rowKey);
  const visibleBusinessKeyRow = rowsByBusinessKey.get(
    businessKeyForParts({
      countryCode: getOptionalCell(row, indexes.countryCode),
      fdName: getOptionalCell(row, indexes.fdName),
      incoterms: getOptionalCell(row, indexes.incoterms),
      productSku: getOptionalCell(row, indexes.productSku),
      retailerName: getOptionalCell(row, indexes.channelName)
    })
  );
  let baseRow =
    visibleBusinessKeyRow ??
    (rowKeyValue && rowsByKey.has(rowKeyValue)
      ? rowsByKey.get(rowKeyValue)
      : undefined);

  const year = parseWholeNumber(getCell(row, indexes.year));
  const month = parseMonthValue(getCell(row, indexes.month));
  if (year === null || month === null) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message: "Missing valid Year or Month."
      }
    };
  }

  const snapshotRow = parseSnapshotBackedBusinessPlanRow({
    data,
    indexes,
    month,
    row,
    sheetName,
    year
  });
  if (snapshotRow) {
    return snapshotRow;
  }

  if (baseRow) {
    const parsedProductPrice = parseProductPriceBackedBusinessPlanRow({
      baseRow,
      data,
      productPricesByIdentity,
      sheetName,
      year,
      rowNumber: row.rowNumber
    });
    if (parsedProductPrice && "error" in parsedProductPrice) {
      return parsedProductPrice;
    }
    if (parsedProductPrice) {
      baseRow = parsedProductPrice.baseRow;
      const promoDiscountPercent = parsePercent(
        getCell(row, indexes.promoDiscountPercent)
      );

      return {
        row: {
          id: `bp-import-${year}-${month}-${baseRow.key}`,
          rowKey: baseRow.key,
          year,
          month,
          promoPriceLocal: parsePromoPriceLocalInput(
            getCell(row, indexes.promoPriceLocal),
            baseRow
          ),
          siUnits: parseUnitNumber(getCell(row, indexes.siUnits)) ?? 0,
          soUnits: parseUnitNumber(getCell(row, indexes.soUnits)) ?? 0,
          promoDiscountPercent,
          assumption: parsedProductPrice.assumption
        }
      };
    }
  }

  if (!baseRow) {
    const parsedCategoryMargin = parseCategoryMarginBackedBusinessPlanRow({
      categoryMarginsByIdentity,
      data,
      indexes,
      productPricesByIdentity,
      row,
      sheetName,
      year
    });
    if (parsedCategoryMargin && "error" in parsedCategoryMargin) {
      return parsedCategoryMargin;
    }
    if (parsedCategoryMargin) {
      baseRow = parsedCategoryMargin.baseRow;
      const promoDiscountPercent = parsePercent(
        getCell(row, indexes.promoDiscountPercent)
      );

      return {
        row: {
          id: `bp-import-${year}-${month}-${baseRow.key}`,
          rowKey: baseRow.key,
          year,
          month,
          promoPriceLocal: parsePromoPriceLocalInput(
            getCell(row, indexes.promoPriceLocal),
            baseRow
          ),
          siUnits: parseUnitNumber(getCell(row, indexes.siUnits)) ?? 0,
          soUnits: parseUnitNumber(getCell(row, indexes.soUnits)) ?? 0,
          promoDiscountPercent,
          assumption: parsedCategoryMargin.assumption
        }
      };
    }

    const parsedProfile = parseProfileBackedBusinessPlanRow({
      channelProfilesByIdentity,
      data,
      indexes,
      row,
      sheetName,
      year
    });
    if (parsedProfile && "error" in parsedProfile) {
      return parsedProfile;
    }
    if (parsedProfile) {
      baseRow = parsedProfile.baseRow;
      const promoDiscountPercent = parsePercent(
        getCell(row, indexes.promoDiscountPercent)
      );

      return {
        row: {
          id: `bp-import-${year}-${month}-${baseRow.key}`,
          rowKey: baseRow.key,
          year,
          month,
          promoPriceLocal: parsePromoPriceLocalInput(
            getCell(row, indexes.promoPriceLocal),
            baseRow
          ),
          siUnits: parseUnitNumber(getCell(row, indexes.siUnits)) ?? 0,
          soUnits: parseUnitNumber(getCell(row, indexes.soUnits)) ?? 0,
          promoDiscountPercent,
          assumption: parsedProfile.assumption,
          channelProfileId: parsedProfile.channelProfile.id
        },
        channelProfile: parsedProfile.channelProfile
      };
    }

    const parsedInline = parseInlineBusinessPlanProfileRow({
      data,
      indexes,
      month,
      row,
      sheetName,
      year
    });
    if ("error" in parsedInline) {
      return parsedInline;
    }
    baseRow = parsedInline.baseRow;
    const promoDiscountPercent = parsePercent(
      getCell(row, indexes.promoDiscountPercent)
    );

    return {
      row: {
        id: `bp-import-${year}-${month}-${baseRow.key}`,
        rowKey: baseRow.key,
        year,
        month,
        promoPriceLocal: parsePromoPriceLocalInput(
          getCell(row, indexes.promoPriceLocal),
          baseRow
        ),
        siUnits: parseUnitNumber(getCell(row, indexes.siUnits)) ?? 0,
        soUnits: parseUnitNumber(getCell(row, indexes.soUnits)) ?? 0,
        promoDiscountPercent,
        assumption: parsedInline.assumption,
        channelProfileId: parsedInline.channelProfile.id
      },
      channelProfile: parsedInline.channelProfile
    };
  }

  const promoDiscountPercent = parsePercent(
    getCell(row, indexes.promoDiscountPercent)
  );

  return {
    row: {
      id: `bp-import-${year}-${month}-${baseRow.key}`,
      rowKey: baseRow.key,
      year,
      month,
      promoPriceLocal: parsePromoPriceLocalInput(
        getCell(row, indexes.promoPriceLocal),
        baseRow
      ),
      siUnits: parseUnitNumber(getCell(row, indexes.siUnits)) ?? 0,
      soUnits: parseUnitNumber(getCell(row, indexes.soUnits)) ?? 0,
      promoDiscountPercent,
      ...(assumptionByRowKey.has(baseRow.key)
        ? { assumption: assumptionByRowKey.get(baseRow.key) }
        : {})
    }
  };
}

function parseSnapshotBackedBusinessPlanRow({
  data,
  indexes,
  month,
  row,
  sheetName,
  year
}: {
  data: ReferenceData;
  indexes: HeaderIndexes;
  month: number;
  row: XlsxRow;
  sheetName: string;
  year: number;
}):
  | {
      row: BusinessPlanDraftLine;
    }
  | { error: BusinessPlanImportError }
  | null {
  const snapshotIndexes = [
    indexes.countryCode,
    indexes.channelName,
    indexes.fdName,
    indexes.incoterms,
    indexes.productSku,
    indexes.productName,
    indexes.category,
    indexes.currency,
    indexes.rrpLocal,
    indexes.rrpEur,
    indexes.kaBuyingMargin,
    indexes.kaFrontMargin,
    indexes.kaBackMargin,
    indexes.fdMargin,
    indexes.bomCost,
    indexes.logisticsCost
  ];
  if (snapshotIndexes.some((index) => index < 0)) {
    return null;
  }

  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const retailerName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const productSku = getOptionalCell(row, indexes.productSku);
  const productName = getOptionalCell(row, indexes.productName);
  const category = getOptionalCell(row, indexes.category);
  const currency = getOptionalCell(row, indexes.currency).toUpperCase();
  const rrpLocal = parseOptionalNumber(getOptionalCell(row, indexes.rrpLocal));
  const rrpEur = parseOptionalNumber(getOptionalCell(row, indexes.rrpEur));
  const kaBuyingMargin = parseRequiredPercentCell(row, indexes.kaBuyingMargin);
  const kaFrontMargin = parseRequiredPercentCell(row, indexes.kaFrontMargin);
  const kaBackMargin = parseRequiredPercentCell(row, indexes.kaBackMargin);
  const fdMargin = parseRequiredPercentCell(row, indexes.fdMargin);
  const bomCostEur = parseOptionalNumber(getOptionalCell(row, indexes.bomCost));
  const logisticsCostEur = parseOptionalNumber(
    getOptionalCell(row, indexes.logisticsCost)
  );

  if (
    !countryCode ||
    !retailerName ||
    !fdName ||
    !incoterms ||
    !productSku ||
    !productName ||
    !category ||
    !currency ||
    rrpLocal === null ||
    rrpEur === null ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null ||
    bomCostEur === null ||
    logisticsCostEur === null
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input snapshot rows must include Country, Channel / KA, FD, Incoterms, Model code, Product name, Category, Currency, RRP, margin, BOM, and Logistics."
      }
    };
  }

  const assumption: BusinessPlanTemporaryAssumption = {
    countryCode,
    retailerName,
    fdName,
    incoterms,
    productSku,
    productName,
    category,
    currency,
    rrpLocal,
    rrpEur,
    kaBuyingMargin,
    kaFrontMargin,
    kaBackMargin,
    fdMargin,
    bomCostEur,
    logisticsCostEur
  };
  const baseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
    (item) => item.key === temporaryAssumptionRowKey(assumption)
  );
  if (!baseRow || baseRow.missingFields.length > 0) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input snapshot row is missing product RRP, BOM, or Logistics in the uploaded workbook."
      }
    };
  }

  return {
    row: {
      id: `bp-import-${year}-${month}-${baseRow.key}`,
      rowKey: baseRow.key,
      year,
      month,
      promoPriceLocal: parsePromoPriceLocalInput(
        getCell(row, indexes.promoPriceLocal),
        baseRow
      ),
      siUnits: parseUnitNumber(getCell(row, indexes.siUnits)) ?? 0,
      soUnits: parseUnitNumber(getCell(row, indexes.soUnits)) ?? 0,
      promoDiscountPercent: parsePercent(
        getCell(row, indexes.promoDiscountPercent)
      ),
      assumption
    }
  };
}

function parseProductPriceBackedBusinessPlanRow({
  baseRow,
  data,
  productPricesByIdentity,
  rowNumber,
  sheetName,
  year
}: {
  baseRow: NormalTableRow;
  data: ReferenceData;
  productPricesByIdentity:
    | Map<string, BusinessPlanWorkbookProductPrice>
    | undefined;
  rowNumber: number;
  sheetName: string;
  year: number;
}):
  | {
      assumption: BusinessPlanTemporaryAssumption;
      baseRow: NormalTableRow;
    }
  | { error: BusinessPlanImportError }
  | null {
  const productPrice = productPricesByIdentity?.get(
    productLookupKey(baseRow.countryCode, baseRow.model)
  );
  if (!productPrice || !productPriceDiffersFromBaseRow(productPrice, baseRow)) {
    return null;
  }

  const profile = {
    id: businessPlanChannelProfileKey({
      planYear: year,
      countryCode: baseRow.countryCode,
      retailerName: baseRow.retailerName,
      fdName: baseRow.fdName,
      incoterms: baseRow.incoterms
    }),
    planYear: year,
    countryCode: baseRow.countryCode,
    retailerName: baseRow.retailerName,
    fdName: baseRow.fdName,
    incoterms: baseRow.incoterms,
    kaBuyingMargin: baseRow.kaBuyingMargin,
    kaFrontMargin: baseRow.kaFrontMargin,
    kaBackMargin: baseRow.kaBackMargin,
    fdMargin: baseRow.fdMargin
  };
  const assumption = buildBusinessPlanProfileAssumption({
    data,
    profile,
    productSku: baseRow.model,
    override: productPriceOverrideForProfile(productPrice, profile.id)
  });
  if (!assumption) {
    return {
      error: {
        sheetName,
        rowNumber,
        message:
          "BP Input row uses a Product Price setup that is not available in formal Product Master Data."
      }
    };
  }

  const assumedBaseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
    (item) => item.key === temporaryAssumptionRowKey(assumption)
  );
  if (!assumedBaseRow || assumedBaseRow.missingFields.length > 0) {
    return {
      error: {
        sheetName,
        rowNumber,
        message:
          "BP Input row is missing product RRP, BOM, or Logistics in BP Master Data or formal Master Data."
      }
    };
  }

  return { assumption, baseRow: assumedBaseRow };
}

function parseCategoryMarginBackedBusinessPlanRow({
  categoryMarginsByIdentity,
  data,
  indexes,
  productPricesByIdentity,
  row,
  sheetName,
  year
}: {
  categoryMarginsByIdentity:
    | Map<string, BusinessPlanWorkbookCategoryMargin>
    | undefined;
  data: ReferenceData;
  indexes: HeaderIndexes;
  productPricesByIdentity:
    | Map<string, BusinessPlanWorkbookProductPrice>
    | undefined;
  row: XlsxRow;
  sheetName: string;
  year: number;
}):
  | {
      assumption: BusinessPlanTemporaryAssumption;
      baseRow: NormalTableRow;
    }
  | { error: BusinessPlanImportError }
  | null {
  if (!categoryMarginsByIdentity || categoryMarginsByIdentity.size === 0) {
    return null;
  }

  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const retailerName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const productSku = getOptionalCell(row, indexes.productSku);
  if (!countryCode || !retailerName || !fdName || !incoterms || !productSku) {
    return null;
  }

  const productPrice = productPricesByIdentity?.get(
    productLookupKey(countryCode, productSku)
  );
  const product = data.products.find(
    (item) =>
      item.status === "ACTIVE" &&
      item.sku.toLowerCase() === productSku.toLowerCase()
  );
  const productBaseRow = firstProductBaseRow({
    countryCode,
    data,
    productSku
  });
  const category = productBaseRow?.category || product?.category || "";
  if (!product || !category) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input row uses a product that is not available in Master Data for this country."
      }
    };
  }

  const categoryMargin = categoryMarginsByIdentity.get(
    categoryMarginLookupKey({
      category,
      countryCode,
      fdName,
      incoterms,
      retailerName,
      planYear: year
    })
  );
  if (!categoryMargin) {
    return null;
  }

  const profile = {
    id: businessPlanChannelProfileKey({
      planYear: year,
      countryCode,
      retailerName,
      fdName,
      incoterms
    }),
    planYear: year,
    countryCode,
    retailerName,
    fdName,
    incoterms,
    kaBuyingMargin: categoryMargin.kaBuyingMargin,
    kaFrontMargin: categoryMargin.kaFrontMargin,
    kaBackMargin: categoryMargin.kaBackMargin,
    fdMargin: categoryMargin.fdMargin
  };
  const assumption = buildBusinessPlanProfileAssumption({
    data,
    profile,
    productSku,
    override: productPrice
      ? productPriceOverrideForProfile(productPrice, profile.id)
      : null
  });
  if (!assumption) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input row uses a BP-only Channel / FD product that is not available in Master Data for this country."
      }
    };
  }

  const baseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
    (item) => item.key === temporaryAssumptionRowKey(assumption)
  );
  if (!baseRow || baseRow.missingFields.length > 0) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input row is missing product RRP, BOM, or Logistics in Master Data."
      }
    };
  }

  return { assumption, baseRow };
}

function parseProfileBackedBusinessPlanRow({
  channelProfilesByIdentity,
  data,
  indexes,
  row,
  sheetName,
  year
}: {
  channelProfilesByIdentity:
    | Map<string, BusinessPlanWorkbookChannelProfile>
    | undefined;
  data: ReferenceData;
  indexes: HeaderIndexes;
  row: XlsxRow;
  sheetName: string;
  year: number;
}):
  | {
      assumption: BusinessPlanTemporaryAssumption;
      baseRow: NormalTableRow;
      channelProfile: BusinessPlanWorkbookChannelProfile;
    }
  | { error: BusinessPlanImportError }
  | null {
  if (!channelProfilesByIdentity || channelProfilesByIdentity.size === 0) {
    return null;
  }

  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const retailerName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const productSku = getOptionalCell(row, indexes.productSku);
  if (!countryCode || !retailerName || !fdName || !incoterms || !productSku) {
    return null;
  }

  const channelProfile = channelProfilesByIdentity.get(
    channelProfileIdentityKey({
      planYear: year,
      countryCode,
      retailerName,
      fdName,
      incoterms
    })
  );
  if (!channelProfile) {
    return null;
  }

  const override =
    channelProfile.productOverrides.find(
      (item) => item.productSku.toLowerCase() === productSku.toLowerCase()
    ) ?? null;
  const assumption = buildBusinessPlanProfileAssumption({
    data,
    profile: channelProfile,
    productSku,
    override
  });
  if (!assumption) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input row uses a BP-only Channel / FD product that is not available in Master Data for this country."
      }
    };
  }

  const baseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
    (item) => item.key === temporaryAssumptionRowKey(assumption)
  );
  if (!baseRow || baseRow.missingFields.length > 0) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Input row is missing product RRP, BOM, or Logistics in Master Data."
      }
    };
  }

  return { assumption, baseRow, channelProfile };
}

function parseInlineBusinessPlanProfileRow({
  data,
  indexes,
  row,
  sheetName,
  year
}: {
  data: ReferenceData;
  indexes: HeaderIndexes;
  month: number;
  row: XlsxRow;
  sheetName: string;
  year: number;
}):
  | {
      assumption: BusinessPlanTemporaryAssumption;
      baseRow: NormalTableRow;
      channelProfile: BusinessPlanWorkbookChannelProfile;
    }
  | { error: BusinessPlanImportError } {
  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const retailerName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const productSku = getOptionalCell(row, indexes.productSku);
  const kaBuyingMargin = parseRequiredPercentCell(row, indexes.kaBuyingMargin);
  const kaFrontMargin = parseRequiredPercentCell(row, indexes.kaFrontMargin);
  const kaBackMargin = parseRequiredPercentCell(row, indexes.kaBackMargin);
  const fdMargin = parseRequiredPercentCell(row, indexes.fdMargin);

  if (
    !countryCode ||
    !retailerName ||
    !fdName ||
    !incoterms ||
    !productSku ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "New Channel / FD rows must include Country, Channel / KA, FD, Incoterms, Model code, and all four margin fields."
      }
    };
  }

  const channelProfile: BusinessPlanWorkbookChannelProfile = {
    id: businessPlanChannelProfileKey({
      planYear: year,
      countryCode,
      retailerName,
      fdName,
      incoterms
    }),
    planYear: year,
    countryCode,
    retailerName,
    fdName,
    incoterms,
    kaBuyingMargin,
    kaFrontMargin,
    kaBackMargin,
    fdMargin,
    productOverrides: []
  };
  const assumption = buildBusinessPlanProfileAssumption({
    data,
    profile: channelProfile,
    productSku,
    override: null
  });
  if (!assumption) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "New Channel / FD row uses a product that is not available in Master Data for this country."
      }
    };
  }

  const baseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
    (item) => item.key === temporaryAssumptionRowKey(assumption)
  );
  if (!baseRow || baseRow.missingFields.length > 0) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "New Channel / FD row is missing product RRP, BOM, or Logistics in Master Data."
      }
    };
  }

  return { assumption, baseRow, channelProfile };
}

function collectInlineChannelProfile({
  errors,
  profile,
  profiles,
  rowNumber,
  sheetName
}: {
  errors: BusinessPlanImportError[];
  profile: BusinessPlanWorkbookChannelProfile | undefined;
  profiles: Map<string, BusinessPlanWorkbookChannelProfile>;
  rowNumber: number;
  sheetName: string;
}) {
  if (!profile) {
    return;
  }

  const existing = profiles.get(profile.id);
  if (existing && !sameChannelProfileMargins(existing, profile)) {
    errors.push({
      sheetName,
      rowNumber,
      message:
        "The same BP-only Country / Channel / FD / Incoterms combination has different margin values. Keep one margin setup per channel combination."
    });
    return;
  }

  profiles.set(profile.id, profile);
}

function sameChannelProfileMargins(
  left: BusinessPlanWorkbookChannelProfile,
  right: BusinessPlanWorkbookChannelProfile
) {
  return (
    numbersEqual(left.kaBuyingMargin, right.kaBuyingMargin) &&
    numbersEqual(left.kaFrontMargin, right.kaFrontMargin) &&
    numbersEqual(left.kaBackMargin, right.kaBackMargin) &&
    numbersEqual(left.fdMargin, right.fdMargin)
  );
}

function numbersEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.000001;
}

function nullableNumbersEqual(
  left: number | null | undefined,
  right: number | null | undefined
) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }

  return numbersEqual(left, right);
}

function addImportedBusinessPlanRow({
  duplicateMode = "error",
  errors,
  importedRows,
  row,
  rowNumber,
  seenRows,
  sheetName
}: {
  duplicateMode?: "error" | "skip";
  errors: BusinessPlanImportError[];
  importedRows: BusinessPlanDraftLine[];
  row: BusinessPlanDraftLine;
  rowNumber: number;
  seenRows: Set<string>;
  sheetName: string;
}) {
  if (
    row.siUnits === 0 &&
    row.soUnits === 0 &&
    row.promoDiscountPercent === 0 &&
    row.promoPriceLocal === null
  ) {
    return;
  }

  const importKey = `${row.year}|${row.month}|${row.rowKey}`;
  if (seenRows.has(importKey)) {
    if (duplicateMode === "skip") {
      return;
    }
    errors.push({
      sheetName,
      rowNumber,
      message: "Duplicate BP row for this year, month, and product/channel combination."
    });
    return;
  }

  seenRows.add(importKey);
  importedRows.push(row);
}

function parseBusinessPlanDataInput({
  data,
  workbook
}: {
  data: ReferenceData;
  workbook: Buffer | ArrayBuffer;
}): {
  rows: Array<{
    channelProfile?: BusinessPlanWorkbookChannelProfile;
    row: BusinessPlanDraftLine;
    rowNumber: number;
    sheetName: string;
  }>;
  errors: BusinessPlanImportError[];
} {
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) => normalizeHeader(name) === normalizeHeader(BP_DATA_INPUT_SHEET_NAME)
  );
  if (!sheetName) {
    return { rows: [], errors: [] };
  }

  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const headerMatch = findBusinessPlanHeaderRow(worksheetRows);
  if (!headerMatch) {
    return {
      rows: [],
      errors: [
        {
          sheetName,
          rowNumber: 1,
          message: "Missing BP Data Input header row."
        }
      ]
    };
  }

  const baseRows = buildBusinessPlanBaseRows(data);
  const rowsByKey = new Map(baseRows.map((row) => [row.key, row]));
  const rowsByBusinessKey = new Map(
    baseRows.map((row) => [businessKeyForRow(row), row])
  );
  const rows: Array<{
    channelProfile?: BusinessPlanWorkbookChannelProfile;
    row: BusinessPlanDraftLine;
    rowNumber: number;
    sheetName: string;
  }> = [];
  const errors: BusinessPlanImportError[] = [];

  for (const worksheetRow of worksheetRows.filter(
    (row) => row.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (
      isBlankWorksheetRow(worksheetRow) ||
      isBlankBusinessPlanDataInputRow(worksheetRow, headerMatch.indexes)
    ) {
      continue;
    }

    const parsed = parseBusinessPlanWorksheetRow({
      assumptionByRowKey: new Map(),
      data,
      indexes: headerMatch.indexes,
      row: worksheetRow,
      rowsByBusinessKey,
      rowsByKey,
      sheetName
    });

    if ("error" in parsed) {
      errors.push(parsed.error);
      continue;
    }

    rows.push({
      channelProfile: parsed.channelProfile,
      row: parsed.row,
      rowNumber: worksheetRow.rowNumber,
      sheetName
    });
  }

  return { rows, errors };
}

function isBlankBusinessPlanDataInputRow(row: XlsxRow, indexes: HeaderIndexes) {
  const textFields = [
    indexes.month,
    indexes.countryCode,
    indexes.channelName,
    indexes.fdName,
    indexes.productSku,
    indexes.promoDiscountPercent,
    indexes.promoPriceLocal,
    indexes.kaBuyingMargin,
    indexes.kaFrontMargin,
    indexes.kaBackMargin,
    indexes.fdMargin
  ];
  const hasTextValue = textFields.some(
    (index) => getOptionalCell(row, index).trim() !== ""
  );
  const hasUnits =
    parseUnitNumber(getOptionalCell(row, indexes.siUnits)) !== 0 ||
    parseUnitNumber(getOptionalCell(row, indexes.soUnits)) !== 0;

  return !hasTextValue && !hasUnits;
}

function parseBusinessPlanMasterDataProfiles({
  data,
  workbook
}: {
  data: ReferenceData;
  workbook: Buffer | ArrayBuffer;
}): {
  categoryMargins: BusinessPlanWorkbookCategoryMargin[];
  productPrices: BusinessPlanWorkbookProductPrice[];
  errors: BusinessPlanImportError[];
} {
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) => normalizeHeader(name) === normalizeHeader(BP_MASTER_DATA_SHEET_NAME)
  );
  if (!sheetName) {
    return { categoryMargins: [], productPrices: [], errors: [] };
  }

  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const formalMasterKeys = new Set(
    buildBusinessPlanBaseRows(data).map((row) =>
      categoryMarginLookupKey({
        category: row.category,
        countryCode: row.countryCode,
        retailerName: row.channelName,
        fdName: row.fdName,
        incoterms: row.incoterms
      })
    )
  );
  const visualHeaderMatch = findBusinessPlanVisualMasterDataHeaderRow(
    worksheetRows
  );
  if (visualHeaderMatch) {
    return parseBusinessPlanVisualMasterDataProfiles({
      data,
      formalMasterKeys,
      headerMatch: visualHeaderMatch,
      sheetName,
      worksheetRows
    });
  }

  const headerMatch = findBusinessPlanMasterDataHeaderRow(worksheetRows);
  if (!headerMatch) {
    return {
      categoryMargins: [],
      productPrices: [],
      errors: [
        {
          sheetName,
          rowNumber: 1,
          message: "Missing BP Master Data header row."
        }
      ]
    };
  }

  const oldIndexes = headerMatch.indexes as Required<
    Omit<BusinessPlanMasterDataHeaderIndexes, "marginGroups">
  >;
  const categoryMargins = new Map<string, BusinessPlanWorkbookCategoryMargin>();
  const productPrices = new Map<string, BusinessPlanWorkbookProductPrice>();
  const errors: BusinessPlanImportError[] = [];

  for (const row of worksheetRows.filter(
    (item) => item.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(row)) {
      continue;
    }

    const dataType = normalizeBusinessPart(
      getOptionalCell(row, oldIndexes.dataType)
    );
    if (
      dataType &&
      dataType !== "category margin" &&
      dataType !== "product price"
    ) {
      continue;
    }
    if (dataType === "product price") {
      const parsed = parseBusinessPlanProductPriceRow({
        data,
        indexes: oldIndexes,
        row,
        sheetName
      });
      if (parsed === null) {
        continue;
      }
      if ("error" in parsed) {
        errors.push(parsed.error);
        continue;
      }
      collectProductPrice({
        errors,
        productPrice: parsed.productPrice,
        productPrices,
        rowNumber: row.rowNumber,
        sheetName
      });
      continue;
    }

    const source = normalizeBusinessPart(
      getOptionalCell(row, oldIndexes.source)
    );
    const countryCode = getOptionalCell(
      row,
      oldIndexes.countryCode
    ).toUpperCase();
    const retailerName = getOptionalCell(row, oldIndexes.channelName);
    const fdName = getOptionalCell(row, oldIndexes.fdName);
    const incoterms = getOptionalCell(row, oldIndexes.incoterms);
    const category = getOptionalCell(row, oldIndexes.category);
    if (source === "master data" || source === "masterdata") {
      continue;
    }
    if (!countryCode && !retailerName && !fdName && !category) {
      continue;
    }

    const formalKey = channelMasterIdentityKey({
      countryCode,
      retailerName,
      fdName,
      incoterms
    });
    const formalCategoryKey = categoryMarginLookupKey({
      category,
      countryCode,
      retailerName,
      fdName,
      incoterms
    });
    if (formalMasterKeys.has(formalCategoryKey) || formalMasterKeys.has(formalKey)) {
      errors.push({
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Master Data row duplicates a formal Master Data Channel / FD / Incoterms / Category combination. Use the existing Master Data setup in BP Input instead of creating a BP-only setup."
      });
      continue;
    }

    const parsed = parseBusinessPlanCategoryMarginRow({
      indexes: oldIndexes,
      row,
      sheetName
    });
    if (parsed === null) {
      continue;
    }
    if ("error" in parsed) {
      errors.push(parsed.error);
      continue;
    }

    collectCategoryMargin({
      errors,
      margin: parsed.margin,
      margins: categoryMargins,
      rowNumber: row.rowNumber,
      sheetName
    });
  }

  return {
    categoryMargins: [...categoryMargins.values()],
    productPrices: [...productPrices.values()],
    errors
  };
}

function parseBusinessPlanVisualMasterDataProfiles({
  data,
  formalMasterKeys,
  headerMatch,
  sheetName,
  worksheetRows
}: {
  data: ReferenceData;
  formalMasterKeys: Set<string>;
  headerMatch: NonNullable<ReturnType<typeof findBusinessPlanVisualMasterDataHeaderRow>>;
  sheetName: string;
  worksheetRows: XlsxRow[];
}): {
  categoryMargins: BusinessPlanWorkbookCategoryMargin[];
  productPrices: BusinessPlanWorkbookProductPrice[];
  errors: BusinessPlanImportError[];
} {
  const categoryMargins = new Map<string, BusinessPlanWorkbookCategoryMargin>();
  const productPrices = new Map<string, BusinessPlanWorkbookProductPrice>();
  const errors: BusinessPlanImportError[] = [];

  for (const row of worksheetRows.filter(
    (item) => item.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(row)) {
      continue;
    }

    const productPrice = parseBusinessPlanVisualProductPriceRow({
      data,
      indexes: headerMatch.indexes,
      row,
      sheetName
    });
    if (productPrice && "error" in productPrice) {
      errors.push(productPrice.error);
    } else if (productPrice) {
      collectProductPrice({
        errors,
        productPrice: productPrice.productPrice,
        productPrices,
        rowNumber: row.rowNumber,
        sheetName
      });
    }

    const parsedMargins = parseBusinessPlanVisualCategoryMarginRows({
      formalMasterKeys,
      indexes: headerMatch.indexes,
      row,
      sheetName
    });
    for (const parsedMargin of parsedMargins) {
      if ("error" in parsedMargin) {
        errors.push(parsedMargin.error);
        continue;
      }

      collectCategoryMargin({
        errors,
        margin: parsedMargin.margin,
        margins: categoryMargins,
        rowNumber: row.rowNumber,
        sheetName
      });
    }
  }

  return {
    categoryMargins: [...categoryMargins.values()],
    productPrices: [...productPrices.values()],
    errors
  };
}

function parseBusinessPlanVisualProductPriceRow({
  data,
  indexes,
  row,
  sheetName
}: {
  data: ReferenceData;
  indexes: NonNullable<ReturnType<typeof findBusinessPlanVisualMasterDataHeaderRow>>["indexes"];
  row: XlsxRow;
  sheetName: string;
}):
  | { productPrice: BusinessPlanWorkbookProductPrice }
  | { error: BusinessPlanImportError }
  | null {
  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const productSku = getOptionalCell(row, indexes.productSku);
  const productName = getOptionalCell(row, indexes.productName);
  const category = getOptionalCell(row, indexes.category);
  const currency = getOptionalCell(row, indexes.currency).toUpperCase();
  const rrpLocal = parseOptionalNumber(getOptionalCell(row, indexes.rrpLocal));
  const rrpEur = parseOptionalNumber(getOptionalCell(row, indexes.rrpEur));
  const bomCostEur = parseOptionalNumber(getOptionalCell(row, indexes.bomCost));
  const logisticsCostEur = parseOptionalNumber(
    getOptionalCell(row, indexes.logisticsCost)
  );
  const hasInput = [
    productSku,
    productName,
    category,
    currency,
    getOptionalCell(row, indexes.rrpLocal),
    getOptionalCell(row, indexes.rrpEur)
  ].some((value) => value.trim() !== "");

  if (!hasInput) {
    return null;
  }

  const product = data.products.find(
    (item) =>
      item.status === "ACTIVE" &&
      item.sku.toLowerCase() === productSku.toLowerCase()
  );
  if (
    !countryCode ||
    !productSku ||
    !currency ||
    rrpLocal === null ||
    rrpEur === null ||
    (!product && (!productName || !category))
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Master Data product rows must include Country, Model code, Product name, Category, Currency, RRP Local, and RRP EUR."
      }
    };
  }

  return {
    productPrice: {
      bomCostEur,
      category: product?.category ?? category,
      countryCode,
      currency,
      logisticsCostEur,
      planYear: 0,
      productName: product?.name ?? productName,
      productSku: product?.sku ?? productSku,
      rrpEur,
      rrpLocal
    }
  };
}

function parseBusinessPlanVisualCategoryMarginRows({
  formalMasterKeys,
  indexes,
  row,
  sheetName
}: {
  formalMasterKeys: Set<string>;
  indexes: NonNullable<ReturnType<typeof findBusinessPlanVisualMasterDataHeaderRow>>["indexes"];
  row: XlsxRow;
  sheetName: string;
}): Array<
  | { margin: BusinessPlanWorkbookCategoryMargin }
  | { error: BusinessPlanImportError }
> {
  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const retailerName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const hasChannelIdentity = Boolean(
    countryCode || retailerName || fdName || incoterms
  );
  const results: Array<
    | { margin: BusinessPlanWorkbookCategoryMargin }
    | { error: BusinessPlanImportError }
  > = [];

  for (const marginGroup of indexes.marginGroups) {
    const rawMarginCells = [
      getOptionalCell(row, marginGroup.kaBuyingMargin),
      getOptionalCell(row, marginGroup.kaFrontMargin),
      getOptionalCell(row, marginGroup.kaBackMargin),
      getOptionalCell(row, marginGroup.fdMargin)
    ];
    const hasMarginInput = rawMarginCells.some((value) => value.trim() !== "");
    if (!hasMarginInput) {
      continue;
    }

    const kaBuyingMargin = parseRequiredPercentCell(row, marginGroup.kaBuyingMargin);
    const kaFrontMargin = parseRequiredPercentCell(row, marginGroup.kaFrontMargin);
    const kaBackMargin = parseRequiredPercentCell(row, marginGroup.kaBackMargin);
    const fdMargin = parseRequiredPercentCell(row, marginGroup.fdMargin);
    if (
      !hasChannelIdentity ||
      !countryCode ||
      !retailerName ||
      !fdName ||
      !incoterms ||
      kaBuyingMargin === null ||
      kaFrontMargin === null ||
      kaBackMargin === null ||
      fdMargin === null
    ) {
      results.push({
        error: {
          sheetName,
          rowNumber: row.rowNumber,
          message:
            "BP Master Data margin setup must include Country, Channel / KA, FD, Incoterms, and all four margin fields for the category."
        }
      });
      continue;
    }

    const margin = {
      category: marginGroup.category,
      countryCode,
      fdMargin,
      fdName,
      incoterms,
      kaBackMargin,
      kaBuyingMargin,
      kaFrontMargin,
      planYear: 0,
      retailerName
    };
    const formalKey = categoryMarginLookupKey(margin);
    if (formalMasterKeys.has(formalKey)) {
      continue;
    }

    results.push({ margin });
  }

  return results;
}

function findBusinessPlanVisualMasterDataHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const marginGroups = BP_MASTER_DATA_MARGIN_CATEGORIES.map((category) => ({
      category: category.category,
      fdMargin: findHeaderIndex(row, [`${category.headerPrefix} fd`]),
      kaBackMargin: findHeaderIndex(row, [`${category.headerPrefix} back`]),
      kaBuyingMargin: findHeaderIndex(row, [
        `${category.headerPrefix} ka buy`,
        `${category.headerPrefix} buy`
      ]),
      kaFrontMargin: findHeaderIndex(row, [`${category.headerPrefix} front`])
    }));
    const indexes = {
      countryCode: findHeaderIndex(row, HEADER_ALIASES.countryCode),
      channelName: findHeaderIndex(row, HEADER_ALIASES.channelName),
      fdName: findHeaderIndex(row, HEADER_ALIASES.fdName),
      incoterms: findHeaderIndex(row, HEADER_ALIASES.incoterms),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      currency: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.currency),
      productName: findHeaderIndex(row, ["product name", "name", "产品名称"]),
      category: findHeaderIndex(row, ["category", "品类"]),
      rrpLocal: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpLocal),
      rrpEur: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpEur),
      vatRate: findHeaderIndex(row, ["vat", "vat rate"]),
      logisticsCost: findHeaderIndex(row, ["logistics eur", "logistics cost eur"]),
      bomCost: findHeaderIndex(row, ["bom eur", "bom cost eur"]),
      marginGroups
    };

    if (
      indexes.countryCode >= 0 &&
      indexes.channelName >= 0 &&
      indexes.fdName >= 0 &&
      indexes.incoterms >= 0 &&
      indexes.productSku >= 0 &&
      indexes.currency >= 0 &&
      indexes.rrpLocal >= 0 &&
      indexes.rrpEur >= 0 &&
      indexes.marginGroups.every(
        (group) =>
          group.kaBuyingMargin >= 0 &&
          group.kaFrontMargin >= 0 &&
          group.kaBackMargin >= 0 &&
          group.fdMargin >= 0
      )
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function findBusinessPlanMasterDataHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      dataType: findHeaderIndex(row, ["data type"]),
      source: findHeaderIndex(row, ["source"]),
      year: findHeaderIndex(row, HEADER_ALIASES.year),
      countryCode: findHeaderIndex(row, HEADER_ALIASES.countryCode),
      channelName: findHeaderIndex(row, HEADER_ALIASES.channelName),
      fdName: findHeaderIndex(row, HEADER_ALIASES.fdName),
      incoterms: findHeaderIndex(row, HEADER_ALIASES.incoterms),
      category: findHeaderIndex(row, ["category"]),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      currency: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.currency),
      rrpLocal: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpLocal),
      rrpEur: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpEur),
      kaBuyingMargin: findHeaderIndex(row, ["ka buying margin"]),
      kaFrontMargin: findHeaderIndex(row, ["ka front margin"]),
      kaBackMargin: findHeaderIndex(row, ["ka back margin"]),
      fdMargin: findHeaderIndex(row, ["fd margin"])
    };

    if (
      indexes.dataType >= 0 &&
      indexes.source >= 0 &&
      indexes.year >= 0 &&
      indexes.countryCode >= 0 &&
      indexes.channelName >= 0 &&
      indexes.fdName >= 0 &&
      indexes.incoterms >= 0 &&
      indexes.category >= 0 &&
      indexes.productSku >= 0 &&
      indexes.currency >= 0 &&
      indexes.rrpLocal >= 0 &&
      indexes.rrpEur >= 0 &&
      indexes.kaBuyingMargin >= 0 &&
      indexes.kaFrontMargin >= 0 &&
      indexes.kaBackMargin >= 0 &&
      indexes.fdMargin >= 0
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parseBusinessPlanProductPriceRow({
  data,
  indexes,
  row,
  sheetName
}: {
  data: ReferenceData;
  indexes: Required<Omit<BusinessPlanMasterDataHeaderIndexes, "marginGroups">>;
  row: XlsxRow;
  sheetName: string;
}):
  | { productPrice: BusinessPlanWorkbookProductPrice }
  | { error: BusinessPlanImportError }
  | null {
  const planYear = parseWholeNumber(getOptionalCell(row, indexes.year));
  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const productSku = getOptionalCell(row, indexes.productSku);
  const product = data.products.find(
    (item) =>
      item.status === "ACTIVE" &&
      item.sku.toLowerCase() === productSku.toLowerCase()
  );
  const currency = getOptionalCell(row, indexes.currency).toUpperCase();
  const rrpLocal = parseOptionalNumber(getOptionalCell(row, indexes.rrpLocal));
  const rrpEur = parseOptionalNumber(getOptionalCell(row, indexes.rrpEur));
  const hasInput = [
    countryCode,
    productSku,
    currency,
    getOptionalCell(row, indexes.rrpLocal),
    getOptionalCell(row, indexes.rrpEur)
  ].some((value) => value.trim() !== "");

  if (!hasInput) {
    return null;
  }

  if (
    planYear === null ||
    !countryCode ||
    !productSku ||
    !currency ||
    rrpLocal === null ||
    rrpEur === null
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "Product Price rows must include Year, Country, Model code, Currency, RRP Local, and RRP EUR."
      }
    };
  }

  if (!product) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "Product Price row uses a Model code that is not available in formal Product Master Data."
      }
    };
  }

  return {
    productPrice: {
      countryCode,
      currency,
      planYear,
      productSku: product.sku,
      rrpEur,
      rrpLocal
    }
  };
}

function parseBusinessPlanCategoryMarginRow({
  indexes,
  row,
  sheetName
}: {
  indexes: Required<Omit<BusinessPlanMasterDataHeaderIndexes, "marginGroups">>;
  row: XlsxRow;
  sheetName: string;
}):
  | { margin: BusinessPlanWorkbookCategoryMargin }
  | { error: BusinessPlanImportError }
  | null {
  const planYear = parseWholeNumber(getOptionalCell(row, indexes.year));
  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const retailerName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const category = getOptionalCell(row, indexes.category);
  const kaBuyingMargin = parseRequiredPercentCell(row, indexes.kaBuyingMargin);
  const kaFrontMargin = parseRequiredPercentCell(row, indexes.kaFrontMargin);
  const kaBackMargin = parseRequiredPercentCell(row, indexes.kaBackMargin);
  const fdMargin = parseRequiredPercentCell(row, indexes.fdMargin);
  const hasInput = [
    countryCode,
    retailerName,
    fdName,
    category,
    getOptionalCell(row, indexes.kaBuyingMargin),
    getOptionalCell(row, indexes.kaFrontMargin),
    getOptionalCell(row, indexes.kaBackMargin),
    getOptionalCell(row, indexes.fdMargin)
  ].some((value) => value.trim() !== "");

  if (!hasInput) {
    return null;
  }

  if (
    planYear === null ||
    !countryCode ||
    !retailerName ||
    !fdName ||
    !incoterms ||
    !category ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "Category Margin rows must include Year, Country, Channel / KA, FD, Incoterms, Category, and all four margin fields."
      }
    };
  }

  return {
    margin: {
      category,
      countryCode,
      fdMargin,
      fdName,
      incoterms,
      kaBackMargin,
      kaBuyingMargin,
      kaFrontMargin,
      planYear,
      retailerName
    }
  };
}

function collectProductPrice({
  errors,
  productPrice,
  productPrices,
  rowNumber,
  sheetName
}: {
  errors: BusinessPlanImportError[];
  productPrice: BusinessPlanWorkbookProductPrice;
  productPrices: Map<string, BusinessPlanWorkbookProductPrice>;
  rowNumber: number;
  sheetName: string;
}) {
  const key = productLookupKey(productPrice.countryCode, productPrice.productSku);
  const existing = productPrices.get(key);
  if (existing && !sameProductPriceValues(existing, productPrice)) {
    errors.push({
      sheetName,
      rowNumber,
      message:
        "The same Country / Model code has different Product Price values. Keep one price setup per market product."
    });
    return;
  }

  productPrices.set(key, productPrice);
}

function collectCategoryMargin({
  errors,
  margin,
  margins,
  rowNumber,
  sheetName
}: {
  errors: BusinessPlanImportError[];
  margin: BusinessPlanWorkbookCategoryMargin | undefined;
  margins: Map<string, BusinessPlanWorkbookCategoryMargin>;
  rowNumber: number;
  sheetName: string;
}) {
  if (!margin) {
    return;
  }

  const key = categoryMarginLookupKey(margin);
  const existing = margins.get(key);
  if (existing && !sameCategoryMarginValues(existing, margin)) {
    errors.push({
      sheetName,
      rowNumber,
      message:
        "The same BP-only Country / Channel / FD / Incoterms / Category combination has different margin values. Keep one margin setup per category combination."
    });
    return;
  }

  margins.set(key, margin);
}

function sameProductPriceValues(
  left: BusinessPlanWorkbookProductPrice,
  right: BusinessPlanWorkbookProductPrice
) {
  return (
    normalizeBusinessPart(left.productName ?? "") ===
      normalizeBusinessPart(right.productName ?? "") &&
    normalizeBusinessPart(left.category ?? "") ===
      normalizeBusinessPart(right.category ?? "") &&
    normalizeBusinessPart(left.currency) === normalizeBusinessPart(right.currency) &&
    numbersEqual(left.rrpLocal ?? 0, right.rrpLocal ?? 0) &&
    numbersEqual(left.rrpEur ?? 0, right.rrpEur ?? 0) &&
    nullableNumbersEqual(left.bomCostEur, right.bomCostEur) &&
    nullableNumbersEqual(left.logisticsCostEur, right.logisticsCostEur)
  );
}

function sameCategoryMarginValues(
  left: BusinessPlanWorkbookCategoryMargin,
  right: BusinessPlanWorkbookCategoryMargin
) {
  return (
    numbersEqual(left.kaBuyingMargin, right.kaBuyingMargin) &&
    numbersEqual(left.kaFrontMargin, right.kaFrontMargin) &&
    numbersEqual(left.kaBackMargin, right.kaBackMargin) &&
    numbersEqual(left.fdMargin, right.fdMargin)
  );
}

function parseBusinessPlanChannelProfiles(workbook: Buffer | ArrayBuffer): {
  channelProfiles: BusinessPlanWorkbookChannelProfile[];
  errors: BusinessPlanImportError[];
} {
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) => normalizeHeader(name) === normalizeHeader(BP_CHANNEL_SETUP_SHEET_NAME)
  );
  if (!sheetName) {
    return { channelProfiles: [], errors: [] };
  }

  const worksheetRows = readWorksheetRows(workbook, sheetName);
  if (findBusinessPlanChannelSetupHeaderRow(worksheetRows)) {
    return { channelProfiles: [], errors: [] };
  }
  const headerMatch = findBusinessPlanChannelProfileHeaderRow(worksheetRows);
  if (!headerMatch) {
    return { channelProfiles: [], errors: [] };
  }

  const channelProfiles: BusinessPlanWorkbookChannelProfile[] = [];
  const errors: BusinessPlanImportError[] = [];
  const seenKeys = new Set<string>();

  for (const row of worksheetRows.filter(
    (item) => item.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(row)) {
      continue;
    }

    const parsed = parseBusinessPlanChannelProfileRow({
      indexes: headerMatch.indexes,
      row,
      sheetName
    });
    if (parsed === null) {
      continue;
    }
    if ("error" in parsed) {
      errors.push(parsed.error);
      continue;
    }

    const key = channelProfileIdentityKey(parsed.profile);
    if (seenKeys.has(key)) {
      errors.push({
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "Duplicate BP Channel Profile for the same Year, Country, Channel / KA, FD, and Incoterms."
      });
      continue;
    }

    seenKeys.add(key);
    channelProfiles.push(parsed.profile);
  }

  return { channelProfiles, errors };
}

function findBusinessPlanChannelProfileHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      year: findHeaderIndex(row, HEADER_ALIASES.year),
      countryCode: findHeaderIndex(row, HEADER_ALIASES.countryCode),
      channelName: findHeaderIndex(row, HEADER_ALIASES.channelName),
      fdName: findHeaderIndex(row, HEADER_ALIASES.fdName),
      incoterms: findHeaderIndex(row, HEADER_ALIASES.incoterms),
      kaBuyingMargin: findHeaderIndex(row, ["ka buying margin"]),
      kaFrontMargin: findHeaderIndex(row, ["ka front margin"]),
      kaBackMargin: findHeaderIndex(row, ["ka back margin"]),
      fdMargin: findHeaderIndex(row, ["fd margin"])
    };

    if (
      indexes.year >= 0 &&
      indexes.countryCode >= 0 &&
      indexes.channelName >= 0 &&
      indexes.fdName >= 0 &&
      indexes.incoterms >= 0 &&
      indexes.kaBuyingMargin >= 0 &&
      indexes.kaFrontMargin >= 0 &&
      indexes.kaBackMargin >= 0 &&
      indexes.fdMargin >= 0
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parseBusinessPlanChannelProfileRow({
  indexes,
  row,
  sheetName
}: {
  indexes: NonNullable<
    ReturnType<typeof findBusinessPlanChannelProfileHeaderRow>
  >["indexes"];
  row: XlsxRow;
  sheetName: string;
}): { profile: BusinessPlanWorkbookChannelProfile } | { error: BusinessPlanImportError } | null {
  const channelName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  if (!channelName && !fdName && !incoterms) {
    return null;
  }

  const planYear = parseWholeNumber(getOptionalCell(row, indexes.year));
  const countryCode = getOptionalCell(row, indexes.countryCode).toUpperCase();
  const kaBuyingMargin = parseRequiredPercentCell(row, indexes.kaBuyingMargin);
  const kaFrontMargin = parseRequiredPercentCell(row, indexes.kaFrontMargin);
  const kaBackMargin = parseRequiredPercentCell(row, indexes.kaBackMargin);
  const fdMargin = parseRequiredPercentCell(row, indexes.fdMargin);

  if (
    planYear === null ||
    !countryCode ||
    !channelName ||
    !fdName ||
    !incoterms ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Channel Setup row is incomplete. Fill Year, Country, Channel / KA, FD, Incoterms, and all four margin fields."
      }
    };
  }

  const profile = {
    id: businessPlanChannelProfileKey({
      planYear,
      countryCode,
      retailerName: channelName,
      fdName,
      incoterms
    }),
    planYear,
    countryCode,
    retailerName: channelName,
    fdName,
    incoterms,
    kaBuyingMargin,
    kaFrontMargin,
    kaBackMargin,
    fdMargin,
    productOverrides: []
  };

  return { profile };
}

function parseBusinessPlanChannelProductOverrides(
  workbook: Buffer | ArrayBuffer,
  channelProfiles: BusinessPlanWorkbookChannelProfile[]
): {
  channelProfiles: BusinessPlanWorkbookChannelProfile[];
  errors: BusinessPlanImportError[];
} {
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) =>
      normalizeHeader(name) === normalizeHeader(BP_CHANNEL_OVERRIDE_SHEET_NAME)
  );
  const profiles = channelProfiles.map((profile) => ({
    ...profile,
    productOverrides: [...profile.productOverrides]
  }));
  if (!sheetName) {
    return { channelProfiles: profiles, errors: [] };
  }

  const profileByLabel = profileMapByLabel(profiles);
  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const headerMatch = findBusinessPlanOverrideHeaderRow(worksheetRows);
  if (!headerMatch) {
    return {
      channelProfiles: profiles,
      errors: [
        {
          sheetName,
          rowNumber: 1,
          message: "Missing BP Channel Product Overrides header row."
        }
      ]
    };
  }

  const errors: BusinessPlanImportError[] = [];
  const seenKeys = new Set<string>();

  for (const row of worksheetRows.filter(
    (item) => item.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(row)) {
      continue;
    }

    const profileLabel = getOptionalCell(row, headerMatch.indexes.channelProfile);
    const productSku = getOptionalCell(row, headerMatch.indexes.productSku);
    if (!profileLabel && !productSku) {
      continue;
    }
    const profile = profileByLabel.get(normalizeProfileLabel(profileLabel));
    if (!profile || !productSku) {
      errors.push({
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "Product Override must select a configured Channel Profile and a Model code."
      });
      continue;
    }

    const duplicateKey = `${profile.id}|${productSku.toLowerCase()}`;
    if (seenKeys.has(duplicateKey)) {
      errors.push({
        sheetName,
        rowNumber: row.rowNumber,
        message: "Duplicate product override within the same Channel Profile."
      });
      continue;
    }
    seenKeys.add(duplicateKey);

    profile.productOverrides.push({
      id: `bp-override-${duplicateKey}`,
      channelProfileId: profile.id,
      productSku,
      rrpLocal: parseOptionalNumber(
        getOptionalCell(row, headerMatch.indexes.rrpLocal)
      ),
      rrpEur: parseOptionalNumber(getOptionalCell(row, headerMatch.indexes.rrpEur)),
      currency: getOptionalCell(row, headerMatch.indexes.currency) || null,
      kaBuyingMargin: parseOptionalPercentCell(
        row,
        headerMatch.indexes.kaBuyingMargin
      ),
      kaFrontMargin: parseOptionalPercentCell(
        row,
        headerMatch.indexes.kaFrontMargin
      ),
      kaBackMargin: parseOptionalPercentCell(
        row,
        headerMatch.indexes.kaBackMargin
      ),
      fdMargin: parseOptionalPercentCell(row, headerMatch.indexes.fdMargin),
      bomCost: parseOptionalNumber(getOptionalCell(row, headerMatch.indexes.bomCost)),
      logisticsCost: parseOptionalNumber(
        getOptionalCell(row, headerMatch.indexes.logisticsCost)
      )
    });
  }

  return { channelProfiles: profiles, errors };
}

function findBusinessPlanOverrideHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      channelProfile: findHeaderIndex(row, CHANNEL_PROFILE_ALIASES),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      rrpLocal: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpLocal),
      rrpEur: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.rrpEur),
      currency: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.currency),
      kaBuyingMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.kaBuyingMargin),
      kaFrontMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.kaFrontMargin),
      kaBackMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.kaBackMargin),
      fdMargin: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.fdMargin),
      bomCost: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.bomCost),
      logisticsCost: findHeaderIndex(row, OVERRIDE_HEADER_ALIASES.logisticsCost)
    };

    if (indexes.channelProfile >= 0 && indexes.productSku >= 0) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parseBusinessPlanNewChannelTargets({
  channelProfiles,
  data,
  workbook
}: {
  channelProfiles: BusinessPlanWorkbookChannelProfile[];
  data: ReferenceData;
  workbook: Buffer | ArrayBuffer;
}): {
  rows: Array<{
    row: BusinessPlanDraftLine;
    rowNumber: number;
    sheetName: string;
  }>;
  errors: BusinessPlanImportError[];
} {
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) => normalizeHeader(name) === normalizeHeader(BP_NEW_TARGETS_SHEET_NAME)
  );
  if (!sheetName) {
    return { rows: [], errors: [] };
  }

  const profileByLabel = profileMapByLabel(channelProfiles);
  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const headerMatch = findBusinessPlanNewTargetHeaderRow(worksheetRows);
  if (!headerMatch) {
    return {
      rows: [],
      errors: [
        {
          sheetName,
          rowNumber: 1,
          message: "Missing BP New Channel Targets header row."
        }
      ]
    };
  }

  const rows: Array<{
    row: BusinessPlanDraftLine;
    rowNumber: number;
    sheetName: string;
  }> = [];
  const errors: BusinessPlanImportError[] = [];

  for (const worksheetRow of worksheetRows.filter(
    (row) => row.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(worksheetRow)) {
      continue;
    }

    const profileLabel = getOptionalCell(
      worksheetRow,
      headerMatch.indexes.channelProfile
    );
    const productSku = getOptionalCell(worksheetRow, headerMatch.indexes.productSku);
    const profile = profileByLabel.get(normalizeProfileLabel(profileLabel));
    if (!profileLabel && !productSku) {
      continue;
    }
    if (!profile || !productSku) {
      errors.push({
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message:
          "New Channel Target must select a configured Channel Profile and a Model code."
      });
      continue;
    }

    const override =
      profile.productOverrides.find(
        (item) => item.productSku.toLowerCase() === productSku.toLowerCase()
      ) ?? null;
    const assumption = buildBusinessPlanProfileAssumption({
      data,
      profile,
      productSku,
      override
    });
    if (!assumption) {
      errors.push({
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message: "New Channel Target uses a product that is not in Master Data."
      });
      continue;
    }

    const baseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
      (row) => row.key === temporaryAssumptionRowKey(assumption)
    );
    if (!baseRow || baseRow.missingFields.length > 0) {
      errors.push({
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message:
          "New Channel Target is missing product RRP, BOM, or Logistics. Add a Product Override before upload."
      });
      continue;
    }

    const year = parseWholeNumber(getCell(worksheetRow, headerMatch.indexes.year));
    const month = parseMonthValue(getCell(worksheetRow, headerMatch.indexes.month));
    if (year === null || month === null) {
      errors.push({
        sheetName,
        rowNumber: worksheetRow.rowNumber,
        message: "Missing valid Year or Month."
      });
      continue;
    }

    rows.push({
      row: {
        id: `bp-import-${year}-${month}-${baseRow.key}`,
        rowKey: baseRow.key,
        year,
        month,
        promoPriceLocal: parsePromoPriceLocalInput(
          getCell(worksheetRow, headerMatch.indexes.promoPriceLocal),
          baseRow
        ),
        siUnits: parseUnitNumber(
          getCell(worksheetRow, headerMatch.indexes.siUnits)
        ) ?? 0,
        soUnits: parseUnitNumber(
          getCell(worksheetRow, headerMatch.indexes.soUnits)
        ) ?? 0,
        promoDiscountPercent: parsePercent(
          getCell(worksheetRow, headerMatch.indexes.promoDiscountPercent)
        ),
        assumption,
        channelProfileId: profile.id
      },
      rowNumber: worksheetRow.rowNumber,
      sheetName
    });
  }

  return { rows, errors };
}

function findBusinessPlanNewTargetHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      year: findHeaderIndex(row, HEADER_ALIASES.year),
      month: findHeaderIndex(row, HEADER_ALIASES.month),
      channelProfile: findHeaderIndex(row, CHANNEL_PROFILE_ALIASES),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      promoDiscountPercent: findHeaderIndex(
        row,
        HEADER_ALIASES.promoDiscountPercent
      ),
      promoPriceLocal: findHeaderIndex(row, HEADER_ALIASES.promoPriceLocal),
      siUnits: findHeaderIndex(row, HEADER_ALIASES.siUnits),
      soUnits: findHeaderIndex(row, HEADER_ALIASES.soUnits)
    };

    if (
      indexes.year >= 0 &&
      indexes.month >= 0 &&
      indexes.channelProfile >= 0 &&
      indexes.productSku >= 0 &&
      (indexes.promoDiscountPercent >= 0 || indexes.promoPriceLocal >= 0) &&
      indexes.siUnits >= 0 &&
      indexes.soUnits >= 0
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parseLegacyBusinessPlanChannelSetup(workbook: Buffer | ArrayBuffer): {
  assumptions: BusinessPlanTemporaryAssumption[];
  errors: BusinessPlanImportError[];
} {
  const sheetName = readWorkbookSheetNames(workbook).find(
    (name) => normalizeHeader(name) === normalizeHeader(BP_CHANNEL_SETUP_SHEET_NAME)
  );
  if (!sheetName) {
    return { assumptions: [], errors: [] };
  }

  const worksheetRows = readWorksheetRows(workbook, sheetName);
  const headerMatch = findBusinessPlanChannelSetupHeaderRow(worksheetRows);
  if (!headerMatch) {
    if (findBusinessPlanChannelProfileHeaderRow(worksheetRows)) {
      return { assumptions: [], errors: [] };
    }

    return {
      assumptions: [],
      errors: [
        {
          sheetName,
          rowNumber: 1,
          message: "Missing BP Channel Setup header row."
        }
      ]
    };
  }

  const assumptions: BusinessPlanTemporaryAssumption[] = [];
  const errors: BusinessPlanImportError[] = [];
  const seenKeys = new Set<string>();

  for (const row of worksheetRows.filter(
    (item) => item.rowNumber > headerMatch.headerRow.rowNumber
  )) {
    if (isBlankWorksheetRow(row)) {
      continue;
    }

    const parsed = parseBusinessPlanChannelSetupRow({
      indexes: headerMatch.indexes,
      row,
      sheetName
    });
    if (parsed === null) {
      continue;
    }
    if ("error" in parsed) {
      errors.push(parsed.error);
      continue;
    }

    const key = temporaryAssumptionRowKey(parsed.assumption);
    if (seenKeys.has(key)) {
      errors.push({
        sheetName,
        rowNumber: row.rowNumber,
        message: "Duplicate BP Channel Setup row for this country/channel/FD/product."
      });
      continue;
    }

    seenKeys.add(key);
    assumptions.push(parsed.assumption);
  }

  return { assumptions, errors };
}

function findBusinessPlanChannelSetupHeaderRow(rows: XlsxRow[]) {
  for (const row of rows) {
    const indexes = {
      countryCode: findHeaderIndex(row, HEADER_ALIASES.countryCode),
      channelName: findHeaderIndex(row, HEADER_ALIASES.channelName),
      fdName: findHeaderIndex(row, HEADER_ALIASES.fdName),
      incoterms: findHeaderIndex(row, HEADER_ALIASES.incoterms),
      productSku: findHeaderIndex(row, HEADER_ALIASES.productSku),
      productName: findHeaderIndex(row, ["product name", "name", "产品名称"]),
      category: findHeaderIndex(row, ["category", "品类"]),
      currency: findHeaderIndex(row, ["currency", "货币"]),
      rrpLocal: findHeaderIndex(row, ["rrp local", "local rrp"]),
      rrpEur: findHeaderIndex(row, ["rrp eur", "eur rrp"]),
      kaBuyingMargin: findHeaderIndex(row, ["ka buying margin"]),
      kaFrontMargin: findHeaderIndex(row, ["ka front margin"]),
      kaBackMargin: findHeaderIndex(row, ["ka back margin"]),
      fdMargin: findHeaderIndex(row, ["fd margin"]),
      bomCostEur: findHeaderIndex(row, ["bom eur", "bom cost eur"]),
      logisticsCostEur: findHeaderIndex(row, [
        "logistics eur",
        "logistics cost eur"
      ])
    };

    if (
      indexes.countryCode >= 0 &&
      indexes.channelName >= 0 &&
      indexes.fdName >= 0 &&
      indexes.incoterms >= 0 &&
      indexes.productSku >= 0 &&
      indexes.productName >= 0 &&
      indexes.category >= 0 &&
      indexes.currency >= 0 &&
      indexes.kaBuyingMargin >= 0 &&
      indexes.kaFrontMargin >= 0 &&
      indexes.kaBackMargin >= 0 &&
      indexes.fdMargin >= 0
    ) {
      return { headerRow: row, indexes };
    }
  }

  return null;
}

function parseBusinessPlanChannelSetupRow({
  indexes,
  row,
  sheetName
}: {
  indexes: NonNullable<
    ReturnType<typeof findBusinessPlanChannelSetupHeaderRow>
  >["indexes"];
  row: XlsxRow;
  sheetName: string;
}):
  | { assumption: BusinessPlanTemporaryAssumption }
  | { error: BusinessPlanImportError }
  | null {
  const channelName = getOptionalCell(row, indexes.channelName);
  const fdName = getOptionalCell(row, indexes.fdName);
  if (!channelName && !fdName) {
    return null;
  }

  const countryCode = getOptionalCell(row, indexes.countryCode);
  const incoterms = getOptionalCell(row, indexes.incoterms);
  const productSku = getOptionalCell(row, indexes.productSku);
  const productName = getOptionalCell(row, indexes.productName);
  const category = getOptionalCell(row, indexes.category);
  const currency = getOptionalCell(row, indexes.currency);
  const kaBuyingMargin = parseRequiredPercentCell(row, indexes.kaBuyingMargin);
  const kaFrontMargin = parseRequiredPercentCell(row, indexes.kaFrontMargin);
  const kaBackMargin = parseRequiredPercentCell(row, indexes.kaBackMargin);
  const fdMargin = parseRequiredPercentCell(row, indexes.fdMargin);

  if (
    !countryCode ||
    !channelName ||
    !fdName ||
    !incoterms ||
    !productSku ||
    !productName ||
    !category ||
    !currency ||
    kaBuyingMargin === null ||
    kaFrontMargin === null ||
    kaBackMargin === null ||
    fdMargin === null
  ) {
    return {
      error: {
        sheetName,
        rowNumber: row.rowNumber,
        message:
          "BP Channel Setup row is incomplete. Fill country, channel, FD, incoterms, product, currency, and all margin fields."
      }
    };
  }

  return {
    assumption: {
      countryCode,
      retailerName: channelName,
      fdName,
      incoterms,
      productSku,
      productName,
      category,
      currency,
      rrpLocal: parseOptionalNumber(getOptionalCell(row, indexes.rrpLocal)),
      rrpEur: parseOptionalNumber(getOptionalCell(row, indexes.rrpEur)),
      kaBuyingMargin,
      kaFrontMargin,
      kaBackMargin,
      fdMargin,
      bomCostEur: parseOptionalNumber(getOptionalCell(row, indexes.bomCostEur)),
      logisticsCostEur: parseOptionalNumber(
        getOptionalCell(row, indexes.logisticsCostEur)
      )
    }
  };
}

function businessKeyForRow(row: NormalTableRow) {
  return businessKeyForParts({
    countryCode: row.countryCode,
    fdName: row.fdName,
    incoterms: row.incoterms,
    productSku: row.model,
    retailerName: row.retailerName
  });
}

function productLookupKey(countryCode: string, productSku: string) {
  return [countryCode, productSku].map(normalizeBusinessPart).join("|");
}

function categoryMarginLookupKey({
  category,
  countryCode,
  fdName,
  incoterms,
  retailerName
}: {
  category: string;
  countryCode: string;
  fdName: string;
  incoterms: string;
  planYear?: number;
  retailerName: string;
}) {
  return [
    countryCode,
    retailerName,
    fdName,
    incoterms,
    category
  ].map(normalizeBusinessPart).join("|");
}

function businessKeyForParts({
  countryCode,
  fdName,
  incoterms,
  productSku,
  retailerName
}: {
  countryCode: string;
  fdName: string;
  incoterms: string;
  productSku: string;
  retailerName: string;
}) {
  return [
    countryCode,
    retailerName,
    fdName,
    incoterms,
    productSku
  ].map(normalizeBusinessPart).join("|");
}

function findHeaderIndex(row: XlsxRow, aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return row.cells.findIndex((cell) => normalizedAliases.includes(normalizeHeader(cell)));
}

function normalizeHeader(value: string | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function normalizeBusinessPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueBy<T>(items: T[], keyForItem: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyForItem(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function isBlankWorksheetRow(row: XlsxRow) {
  return row.cells.every((cell) => cell === undefined || cell.trim() === "");
}

function getCell(row: XlsxRow, index: number) {
  return index >= 0 ? (row.cells[index] ?? "").trim() : "";
}

function getOptionalCell(row: XlsxRow, index: number) {
  return index >= 0 ? getCell(row, index) : "";
}

function parseWholeNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function parseUnitNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePromoPriceLocalInput(value: string, row: NormalTableRow) {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return null;
  }
  if (
    row.rrpLocal !== null &&
    Math.abs(parsed - row.rrpLocal) < 0.00001
  ) {
    return null;
  }

  return parsed;
}

function parseMonthValue(value: string) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
    return Math.trunc(parsed);
  }

  const normalized = value.trim().toLowerCase();
  const month = getBusinessPlanMonths().find(
    (item) => item.label.toLowerCase() === normalized
  );

  return month?.month ?? null;
}

function parsePercent(value: string) {
  const cleanedValue = value.trim().replace(/%$/, "");
  const parsed = Number(cleanedValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(1, parsed > 1 ? parsed / 100 : parsed);
}

function parseRequiredPercentCell(row: XlsxRow, index: number) {
  const cleanedValue = getOptionalCell(row, index).replace(/%$/, "").trim();
  if (cleanedValue === "") {
    return null;
  }

  const parsed = Number(cleanedValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.min(1, parsed > 1 ? parsed / 100 : parsed);
}

function parseOptionalPercentCell(row: XlsxRow, index: number) {
  const value = getOptionalCell(row, index);
  if (!value) {
    return null;
  }

  return parseRequiredPercentCell(row, index);
}

function profileMapByLabel(
  channelProfiles: BusinessPlanWorkbookChannelProfile[]
) {
  const profiles = new Map<string, BusinessPlanWorkbookChannelProfile>();

  for (const profile of channelProfiles) {
    profiles.set(normalizeProfileLabel(businessPlanChannelProfileLabel(profile)), profile);
    profiles.set(
      normalizeProfileLabel(
        businessPlanChannelProfileLabel({ ...profile, countryCode: undefined })
      ),
      profile
    );
    profiles.set(normalizeProfileLabel(profile.id), profile);
  }

  return profiles;
}

function normalizeProfileLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formula(
  formulaText: string,
  value?: number | string | null,
  numberFormatCode?: string
) {
  return {
    formula: formulaText,
    value,
    ...(numberFormatCode ? { numberFormatCode } : {})
  };
}

function formulaLiteral(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return `""`;
}

function localCurrencyNumberOrBlank(
  value: number | null | undefined,
  currency: string
): WorkbookCell {
  return formattedNumberOrBlank(value, currencyFormatCode(currency));
}

function eurNumberOrBlank(value: number | null | undefined): WorkbookCell {
  return formattedNumberOrBlank(value, EUR_CURRENCY_FORMAT);
}

function integerNumberOrBlank(value: number | null | undefined): WorkbookCell {
  return formattedNumberOrBlank(value, "#,##0");
}

function formattedNumberOrBlank(
  value: number | null | undefined,
  numberFormatCode: string
): WorkbookCell {
  return typeof value === "number" && Number.isFinite(value)
    ? { value, numberFormatCode }
    : "";
}

function currencyFormatCode(currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (normalizedCurrency === "EUR") {
    return EUR_CURRENCY_FORMAT;
  }
  if (!normalizedCurrency) {
    return "#,##0.00";
  }

  return `"${normalizedCurrency.replace(/"/g, '""')}" #,##0.00`;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

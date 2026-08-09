import { inferExchangeRateToEur } from "../quickSimulation";
import type { ReferenceData } from "../types";
import { createXlsxWorkbook, type WorkbookSheet } from "./xlsxWorkbook";

export function buildMasterDataWorkbookBuffer(data: ReferenceData) {
  return createXlsxWorkbook(buildMasterDataWorkbookSheets(data));
}

export function buildMasterDataWorkbookSheets(data: ReferenceData): WorkbookSheet[] {
  return [
    buildExrSheet(data),
    buildBomSheet(data),
    buildRrpSheet(data),
    buildLogisticsSheet(data),
    buildMarginSheet(data)
  ];
}

function buildExrSheet(data: ReferenceData): WorkbookSheet {
  return {
    name: "EXR",
    rows: [
      ["Country", "Currency", "EXR", "VAT"],
      ...data.countries
        .filter((country) => country.status === "ACTIVE")
        .map((country) => [
          country.code,
          country.currency,
          roundNumber(exchangeRateForCountry(data, country.code), 4),
          country.vatRate
        ])
    ]
  };
}

function exchangeRateForCountry(data: ReferenceData, countryCode: string) {
  const country = data.countries.find((item) => item.code === countryCode);
  const explicitRate = (data.exchangeRates ?? []).find(
    (rate) =>
      country &&
      rate.currency.toUpperCase() === country.currency.toUpperCase() &&
      rate.status === "ACTIVE" &&
      rate.exchangeRateToEur > 0
  );

  return explicitRate?.exchangeRateToEur ?? inferExchangeRateToEur(data, countryCode);
}

function buildBomSheet(data: ReferenceData): WorkbookSheet {
  const latestBomByProductId = latestActiveByKey(
    data.bomCosts,
    (bom) => bom.productId,
    (bom) => bom.effectiveDate
  );

  return {
    name: "Bom cost",
    rows: [
      [
        "Lifecycle Status",
        "Planned Launch Date",
        "Model",
        "Name",
        "Category",
        "Bom (RMB)",
        "Bom (EUR)"
      ],
      ...data.products
        .filter((product) => product.status === "ACTIVE")
        .map((product) => {
          const bom = latestBomByProductId.get(product.id);
          return [
            lifecycleExportLabel(product.lifecycleStatus),
            product.plannedLaunchAt?.slice(0, 10) ?? "",
            product.sku,
            product.name,
            product.category,
            bom?.bomCostRmb ?? "",
            bom?.bomCost ?? ""
          ];
        })
    ]
  };
}

function buildRrpSheet(data: ReferenceData): WorkbookSheet {
  return {
    name: "RRP",
    rows: [
      ["Country", "Model", "Product", "RRP Local", "Currency"],
      ...data.productCountryRrps
        .filter((rrp) => rrp.status === "ACTIVE")
        .map((rrp) => [
          rrp.countryCode,
          rrp.productSku,
          rrp.productName,
          rrp.rrpLocal,
          rrp.currency
        ])
    ]
  };
}

function buildLogisticsSheet(data: ReferenceData): WorkbookSheet {
  const uniqueCosts = latestActiveByKey(
    data.logisticsCosts,
    (cost) => `${cost.productSize}|${cost.category}|${cost.logisticsCost}`,
    (cost) => cost.effectiveDate
  );

  return {
    name: "Logistic cost",
    rows: [
      ["Incoterms", "Category", "RMB", "EUR"],
      ...[...uniqueCosts.values()].map((cost) => [
        cost.productSize,
        cost.category,
        "",
        cost.logisticsCost
      ])
    ]
  };
}

function buildMarginSheet(data: ReferenceData): WorkbookSheet {
  return {
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
      ...data.operationalMargins
        .filter((margin) => margin.status === "ACTIVE")
        .map((margin) => [
          margin.countryCode,
          margin.retailerName,
          margin.fdName,
          margin.incoterms,
          margin.category,
          margin.kaBuyingMargin,
          margin.kaFrontMargin,
          margin.kaBackMargin,
          margin.fdMargin
        ])
    ]
  };
}

function latestActiveByKey<T extends { status: string }>(
  records: T[],
  keyForRecord: (record: T) => string,
  dateForRecord: (record: T) => string
) {
  return records
    .filter((record) => record.status === "ACTIVE")
    .reduce((map, record) => {
      const key = keyForRecord(record);
      const current = map.get(key);
      if (!current || dateForRecord(record) >= dateForRecord(current)) {
        map.set(key, record);
      }
      return map;
    }, new Map<string, T>());
}

function lifecycleExportLabel(value: string) {
  if (value === "UNLAUNCHED") {
    return "Unlaunched";
  }

  if (value === "EOL") {
    return "EOL";
  }

  return "Launched";
}

function roundNumber(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

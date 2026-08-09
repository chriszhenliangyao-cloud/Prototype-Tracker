import {
  calculateWideNormalValueChain,
  calculateWidePromotionValueChain,
  type SettlementMode,
  type WideNormalValueChainResult,
  type WidePromotionValueChainResult
} from "./calculations/valueChain";
import { selectLogisticsCost } from "./logisticsSelection";
import type {
  BomCostOption,
  CountryOption,
  LogisticsCostOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  PromotionPlanDealType,
  ProductLifecycleStatus,
  ProductOption,
  ReferenceData
} from "./types";

export type MissingField = "RRP" | "BOM" | "LOGISTICS";
export type ProductLifecycle =
  | "ALL"
  | "VALUE_CHAIN"
  | ProductLifecycleStatus;

export type CalculatorStringFilter = string | string[];
export type CalculatorNumberFilter = number | number[];

export type CalculatorFilters = {
  countryCode?: CalculatorStringFilter;
  channelName?: CalculatorStringFilter;
  retailerName?: CalculatorStringFilter;
  fdName?: CalculatorStringFilter;
  model?: CalculatorStringFilter;
  category?: CalculatorStringFilter;
  productName?: CalculatorStringFilter;
  kaBuyingMargin?: CalculatorNumberFilter;
};

export type NormalTableRow = {
  key: string;
  countryCode: string;
  channelName: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  model: string;
  category: string;
  productName: string;
  productLifecycleStatus: ProductLifecycleStatus;
  plannedLaunchAt: string | null;
  rrpLocal: number | null;
  rrpEur: number | null;
  currency: string;
  vatRate: number;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  kaBackMargin: number;
  fdMargin: number;
  logisticsCost: number | null;
  bomCost: number | null;
  missingFields: MissingField[];
  calculation: WideNormalValueChainResult | null;
};

export type PromotionInputsByRow = Record<
  string,
  {
    promoRrpLocal?: number | string;
    promoRrpEur?: number | string;
    promoVolume?: number | string;
    promoFrontMargin?: number | string;
    dealType?: PromotionPlanDealType;
    promoFdMargin?: number | string;
    promotionName?: string;
    dealNote?: string;
    promoStartDate?: string;
    promoEndDate?: string;
    settlementMode?: SettlementMode;
  }
>;

export type RrppSimulationInputsByRow = Record<
  string,
  {
    rrppLocal?: number | string;
    rrppEur?: number | string;
    kaBuyingMargin?: number | string;
    actualFrontMargin?: number | string;
    promoFrontMargin?: number | string;
    dealType?: PromotionPlanDealType;
    promoFdMargin?: number | string;
  }
>;

export type PromotionTableRow = NormalTableRow & {
  promoRrpLocal: number | string;
  promoRrpEur: number | string;
  promoVolume: number | string;
  promoFrontMargin: number | string;
  dealType: PromotionPlanDealType;
  promoFdMargin: number | string;
  promotionName: string;
  dealNote: string;
  promoStartDate: string;
  promoEndDate: string;
  settlementMode: SettlementMode;
  promotionCalculation: WidePromotionValueChainResult | null;
};

export type RrppSimulationTableRow = NormalTableRow & {
  baseKaBuyingMargin: number;
  simulationKaBuyingMargin: number | string;
  simulationActualFrontMargin: number | string;
  simulationRrppLocal: number | string;
  simulationRrppEur: number | string;
  simulationPromoFrontMargin: number | string;
  dealType: PromotionPlanDealType;
  promoFdMargin: number | string;
  rrppSimulationCalculation: WidePromotionValueChainResult | null;
};

export type BuildNormalRowsOptions = {
  lifecycle?: ProductLifecycle;
};

export function buildNormalRows(
  data: ReferenceData,
  filters: CalculatorFilters = {},
  options: BuildNormalRowsOptions = {}
): NormalTableRow[] {
  const activeCountries = data.countries.filter(isActive);
  const activeProducts = data.products.filter(isActive);
  const activeMargins = data.operationalMargins.filter(isActive);
  const activeBomCosts = data.bomCosts.filter(isActive);
  const activeLogisticsCosts = latestLogisticsByBusinessKey(
    data.logisticsCosts.filter(isActive)
  );
  const activeRrps = data.productCountryRrps.filter(isActive);

  return activeMargins
    .flatMap((margin) =>
      activeProducts
        .filter((product) => product.category === margin.category)
        .map((product) =>
          buildNormalRow({
            countries: activeCountries,
            bomCosts: activeBomCosts,
            logisticsCosts: activeLogisticsCosts,
            productCountryRrps: activeRrps,
            margin,
            product
          })
        )
    )
    .filter((row): row is NormalTableRow => row !== null)
    .filter((row) => matchesLifecycle(row, options.lifecycle ?? "ALL"))
    .filter((row) => matchesFilters(row, filters));
}

export function buildPromotionRows(
  data: ReferenceData,
  inputsByRow: PromotionInputsByRow,
  filters: CalculatorFilters = {},
  options: BuildNormalRowsOptions = {}
): PromotionTableRow[] {
  return buildPromotionRowsFromBaseRows(
    buildNormalRows(data, filters, options),
    inputsByRow
  );
}

export function buildPromotionRowsFromBaseRows(
  rows: NormalTableRow[],
  inputsByRow: PromotionInputsByRow
): PromotionTableRow[] {
  return rows.map((row) => {
    const inputs = inputsByRow[row.key] ?? {};
    const hasPromoRrpLocal = inputs.promoRrpLocal !== undefined;
    const promoRrpLocal = inputs.promoRrpLocal ?? row.rrpLocal ?? 0;
    const promoRrpEur =
      hasPromoRrpLocal
        ? convertLocalRrpToEur(
            parseInputNumber(promoRrpLocal),
            row.rrpLocal,
            row.rrpEur
          )
        : inputs.promoRrpEur ?? row.rrpEur ?? promoRrpLocal;
    const promoVolume = inputs.promoVolume ?? 1000;
    const promoFrontMargin = inputs.promoFrontMargin ?? row.kaFrontMargin;
    const dealType = normalizePromotionDealType(inputs.dealType);
    const promoFdMargin =
      dealType === "NORMAL" ||
      inputs.promoFdMargin === undefined ||
      inputs.promoFdMargin === ""
        ? row.fdMargin
        : inputs.promoFdMargin;
    const promotionName = inputs.promotionName ?? "";
    const dealNote = inputs.dealNote ?? "";
    const promoStartDate = inputs.promoStartDate ?? "";
    const promoEndDate = inputs.promoEndDate ?? "";
    const settlementMode = "INVOICE_DISCOUNT";
    const promoRrpEurNumber = parseInputNumber(promoRrpEur);
    const promoVolumeNumber = parseInputNumber(promoVolume);
    const promoFrontMarginNumber = parseInputNumber(promoFrontMargin);
    const promoFdMarginNumber = parseInputNumber(promoFdMargin);
    const promotionCalculation =
      row.calculation !== null &&
      promoRrpEurNumber !== null &&
      promoRrpEurNumber > 0 &&
      promoVolumeNumber !== null &&
      promoVolumeNumber > 0 &&
      promoFrontMarginNumber !== null &&
      promoFrontMarginNumber >= 0 &&
      promoFrontMarginNumber <= 1 &&
      promoFdMarginNumber !== null &&
      promoFdMarginNumber >= 0 &&
      promoFdMarginNumber <= 1
        ? calculateWidePromotionValueChain({
            normalRrp: row.calculation.rrp,
            promoRrp: promoRrpEurNumber,
            vatRate: row.vatRate,
            normalKaBuyingMargin: row.kaBuyingMargin,
            promoKaBuyingMargin: promoFrontMarginNumber,
            fdMargin: row.fdMargin,
            dealType,
            promoFdMargin: promoFdMarginNumber,
            actualFrontMargin: row.kaFrontMargin,
            actualBackMargin: row.kaBackMargin,
            logisticsCost: row.calculation.logisticsCost,
            bomCost: row.calculation.bomCost,
            promoVolume: promoVolumeNumber,
            settlementMode
          })
        : null;

    return {
      ...row,
      promoRrpLocal,
      promoRrpEur,
      promoVolume,
      promoFrontMargin,
      dealType,
      promoFdMargin,
      promotionName,
      dealNote,
      promoStartDate,
      promoEndDate,
      settlementMode,
      promotionCalculation
    };
  });
}

export function buildRrppSimulationRows(
  data: ReferenceData,
  inputsByRow: RrppSimulationInputsByRow,
  filters: CalculatorFilters = {},
  options: BuildNormalRowsOptions = {}
): RrppSimulationTableRow[] {
  return buildNormalRows(data, filters, options).map((row) => {
    const inputs = inputsByRow[row.key] ?? {};
    const hasRrppLocal = inputs.rrppLocal !== undefined;
    const simulationRrppLocal = inputs.rrppLocal ?? row.rrpLocal ?? "";
    const simulationRrppEur =
      hasRrppLocal
        ? convertLocalRrpToEur(
            parseInputNumber(simulationRrppLocal),
            row.rrpLocal,
            row.rrpEur
          )
        : inputs.rrppEur ?? row.rrpEur ?? "";
    const simulationPromoFrontMargin =
      inputs.promoFrontMargin ?? row.kaFrontMargin;
    const simulationActualFrontMargin =
      row.kaFrontMargin;
    const simulationKaBuyingMargin =
      inputs.kaBuyingMargin ?? row.kaBuyingMargin;
    const dealType = normalizePromotionDealType(inputs.dealType);
    const promoFdMargin =
      dealType === "NORMAL" ||
      inputs.promoFdMargin === undefined ||
      inputs.promoFdMargin === ""
        ? row.fdMargin
        : inputs.promoFdMargin;
    const simulationRrppEurNumber = parseInputNumber(simulationRrppEur);
    const simulationPromoFrontMarginNumber = parseInputNumber(
      simulationPromoFrontMargin
    );
    const simulationKaBuyingMarginNumber = parseInputNumber(
      simulationKaBuyingMargin
    );
    const promoFdMarginNumber = parseInputNumber(promoFdMargin);
    const normalRrp = row.rrpEur ?? simulationRrppEurNumber;
    const isValidKaBuyingMargin =
      simulationKaBuyingMarginNumber !== null &&
      simulationKaBuyingMarginNumber >= 0 &&
      simulationKaBuyingMarginNumber <= 1;
    const isValidPromoFdMargin =
      promoFdMarginNumber !== null &&
      promoFdMarginNumber >= 0 &&
      promoFdMarginNumber <= 1;
    const calculation =
      normalRrp !== null &&
      normalRrp > 0 &&
      isValidKaBuyingMargin &&
      row.logisticsCost !== null &&
      row.bomCost !== null
        ? calculateWideNormalValueChain({
            rrp: normalRrp,
            vatRate: row.vatRate,
            kaBuyingMargin: simulationKaBuyingMarginNumber,
            fdMargin: row.fdMargin,
            actualFrontMargin: row.kaFrontMargin,
            actualBackMargin: row.kaBackMargin,
            logisticsCost: row.logisticsCost,
            bomCost: row.bomCost
          })
        : null;
    const rrppSimulationCalculation =
      normalRrp !== null &&
      normalRrp > 0 &&
      simulationRrppEurNumber !== null &&
      simulationRrppEurNumber > 0 &&
      isValidKaBuyingMargin &&
      simulationPromoFrontMarginNumber !== null &&
      simulationPromoFrontMarginNumber >= 0 &&
      simulationPromoFrontMarginNumber <= 1 &&
      isValidPromoFdMargin &&
      row.logisticsCost !== null &&
      row.bomCost !== null
        ? calculateWidePromotionValueChain({
            normalRrp,
            promoRrp: simulationRrppEurNumber,
            vatRate: row.vatRate,
            normalKaBuyingMargin: simulationKaBuyingMarginNumber,
            promoKaBuyingMargin: simulationPromoFrontMarginNumber,
            fdMargin: row.fdMargin,
            dealType,
            promoFdMargin: promoFdMarginNumber,
            actualFrontMargin: row.kaFrontMargin,
            actualBackMargin: row.kaBackMargin,
            logisticsCost: row.logisticsCost,
            bomCost: row.bomCost,
            promoVolume: 1,
            settlementMode: "INVOICE_DISCOUNT"
          })
        : null;

    return {
      ...row,
      kaBuyingMargin: isValidKaBuyingMargin
        ? simulationKaBuyingMarginNumber
        : row.kaBuyingMargin,
      baseKaBuyingMargin: row.kaBuyingMargin,
      simulationKaBuyingMargin,
      simulationActualFrontMargin,
      calculation,
      simulationRrppLocal,
      simulationRrppEur,
      simulationPromoFrontMargin,
      dealType,
      promoFdMargin,
      rrppSimulationCalculation
    };
  });
}

type BuildNormalRowInput = {
  countries: CountryOption[];
  bomCosts: BomCostOption[];
  logisticsCosts: LogisticsCostOption[];
  productCountryRrps: ProductCountryRrpOption[];
  margin: OperationalMarginOption;
  product: ProductOption;
};

function buildNormalRow({
  countries,
  bomCosts,
  logisticsCosts,
  productCountryRrps,
  margin,
  product
}: BuildNormalRowInput): NormalTableRow | null {
  const country = countries.find((item) => item.id === margin.countryId);
  if (!country) {
    return null;
  }

  const rrp = latestByEffectiveDate(
    productCountryRrps.filter(
      (item) => item.productId === product.id && item.countryId === country.id
    )
  );
  const bom = latestByEffectiveDate(
    bomCosts.filter((item) => item.productId === product.id)
  );
  const logisticsSelection = selectLogisticsCost({
    logisticsCosts,
    countryId: country.id,
    category: product.category,
    productCapacity: product.capacity,
    incoterms: margin.incoterms
  });
  const logistics = logisticsSelection.logisticsCost;
  const missingFields = getMissingFields({ rrp, bom, logistics });
  const calculation =
    rrp !== null && bom !== null && logistics !== null
      ? calculateWideNormalValueChain({
          rrp: rrp.rrpEur,
          vatRate: country.vatRate,
          kaBuyingMargin: margin.kaBuyingMargin,
          fdMargin: margin.fdMargin,
          actualFrontMargin: margin.kaFrontMargin,
          actualBackMargin: margin.kaBackMargin,
          logisticsCost: logistics.logisticsCost,
          bomCost: bom.bomCost
        })
      : null;

  return {
    key: `${margin.id}|${product.id}`,
    countryCode: country.code,
    channelName: margin.retailerName,
    retailerName: margin.retailerName,
    fdName: margin.fdName,
    incoterms: margin.incoterms,
    model: product.sku,
    category: product.category,
    productName: product.name,
    productLifecycleStatus: product.lifecycleStatus,
    plannedLaunchAt: product.plannedLaunchAt ?? null,
    rrpLocal: rrp?.rrpLocal ?? null,
    rrpEur: rrp?.rrpEur ?? null,
    currency: rrp?.currency ?? country.currency,
    vatRate: country.vatRate,
    kaBuyingMargin: margin.kaBuyingMargin,
    kaFrontMargin: margin.kaFrontMargin,
    kaBackMargin: margin.kaBackMargin,
    fdMargin: margin.fdMargin,
    logisticsCost: logistics?.logisticsCost ?? null,
    bomCost: bom?.bomCost ?? null,
    missingFields,
    calculation
  };
}

function getMissingFields({
  rrp,
  bom,
  logistics
}: {
  rrp: ProductCountryRrpOption | null;
  bom: BomCostOption | null;
  logistics: LogisticsCostOption | null;
}): MissingField[] {
  const missingFields: MissingField[] = [];

  if (rrp === null) {
    missingFields.push("RRP");
  }
  if (bom === null) {
    missingFields.push("BOM");
  }
  if (logistics === null) {
    missingFields.push("LOGISTICS");
  }

  return missingFields;
}

function matchesFilters(row: NormalTableRow, filters: CalculatorFilters) {
  return (
    matches(row.countryCode, filters.countryCode) &&
    matches(row.channelName, filters.channelName) &&
    matches(row.retailerName, filters.retailerName) &&
    matches(row.fdName, filters.fdName) &&
    matches(row.model, filters.model) &&
    matches(row.category, filters.category) &&
    matches(row.productName, filters.productName) &&
    matchesNumber(row.kaBuyingMargin, filters.kaBuyingMargin)
  );
}

export function normalRowMatchesFilters(
  row: NormalTableRow,
  filters: CalculatorFilters
) {
  return matchesFilters(row, filters);
}

function matchesLifecycle(row: NormalTableRow, lifecycle: ProductLifecycle) {
  if (lifecycle === "VALUE_CHAIN") {
    return (
      row.productLifecycleStatus === "LAUNCHED" ||
      row.productLifecycleStatus === "EOL"
    );
  }

  if (lifecycle === "ALL") {
    return true;
  }

  return row.productLifecycleStatus === lifecycle;
}

function matches(value: string, filter?: CalculatorStringFilter) {
  const values = Array.isArray(filter) ? filter : filter ? [filter] : [];
  return values.length === 0 || values.includes(value);
}

function matchesNumber(value: number, filter?: CalculatorNumberFilter) {
  const values = Array.isArray(filter) ? filter : filter === undefined ? [] : [filter];
  return values.length === 0 || values.includes(value);
}

function convertLocalRrpToEur(
  promoRrpLocal: number | null,
  normalRrpLocal: number | null,
  normalRrpEur: number | null
): number | string {
  if (promoRrpLocal === null) {
    return "";
  }

  if (
    normalRrpLocal !== null &&
    normalRrpLocal > 0 &&
    normalRrpEur !== null &&
    normalRrpEur > 0
  ) {
    return promoRrpLocal * (normalRrpEur / normalRrpLocal);
  }

  return promoRrpLocal;
}

function normalizePromotionDealType(
  dealType: PromotionPlanDealType | undefined
): PromotionPlanDealType {
  return dealType === "B2B_DEAL" || dealType === "EOL_DEAL"
    ? dealType
    : "NORMAL";
}

function parseInputNumber(value: number | string): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function isActive<T extends { status: string }>(record: T) {
  return record.status === "ACTIVE";
}

function latestByEffectiveDate<T extends { effectiveDate: string; id: string }>(
  records: T[]
): T | null {
  return latestFirst(records)[0] ?? null;
}

function latestFirst<T extends { effectiveDate: string; id: string }>(
  records: T[]
): T[] {
  return [...records].sort(compareEffectiveDateDesc);
}

function latestLogisticsByBusinessKey(
  logisticsCosts: LogisticsCostOption[]
): LogisticsCostOption[] {
  const latestByKey = new Map<string, LogisticsCostOption>();

  for (const logisticsCost of latestFirst(logisticsCosts)) {
    const key = [
      logisticsCost.countryId,
      logisticsCost.category,
      logisticsCost.productSize
    ].join("|");

    if (!latestByKey.has(key)) {
      latestByKey.set(key, logisticsCost);
    }
  }

  return [...latestByKey.values()];
}

function compareEffectiveDateDesc<T extends { effectiveDate: string; id: string }>(
  left: T,
  right: T
) {
  const dateDelta =
    parseEffectiveDate(right.effectiveDate) -
    parseEffectiveDate(left.effectiveDate);

  return dateDelta === 0 ? left.id.localeCompare(right.id) : dateDelta;
}

function parseEffectiveDate(effectiveDate: string) {
  const timestamp = Date.parse(effectiveDate);

  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

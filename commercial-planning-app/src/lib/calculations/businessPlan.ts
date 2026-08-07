import {
  buildNormalRows,
  type MissingField,
  type NormalTableRow
} from "../calculatorRows";
import { selectLogisticsCost } from "../logisticsSelection";
import type {
  BusinessPlanChannelProductOverrideOption,
  BusinessPlanChannelProfileOption,
  LogisticsCostOption,
  ReferenceData
} from "../types";
import {
  calculateWideNormalValueChain,
  calculateWidePromotionValueChain
} from "./valueChain";

export type BusinessPlanTemporaryAssumption = {
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  productSku: string;
  productName: string;
  category: string;
  currency: string;
  rrpLocal: number | null;
  rrpEur: number | null;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  kaBackMargin: number;
  fdMargin: number;
  bomCostEur?: number | null;
  logisticsCostEur?: number | null;
};

export type BusinessPlanChannelProfileDraft = Pick<
  BusinessPlanChannelProfileOption,
  | "id"
  | "planYear"
  | "countryCode"
  | "retailerName"
  | "fdName"
  | "incoterms"
  | "kaBuyingMargin"
  | "kaFrontMargin"
  | "kaBackMargin"
  | "fdMargin"
>;

export type BusinessPlanChannelProductOverrideDraft = Pick<
  BusinessPlanChannelProductOverrideOption,
  | "id"
  | "channelProfileId"
  | "productSku"
  | "rrpLocal"
  | "rrpEur"
  | "currency"
  | "kaBuyingMargin"
  | "kaFrontMargin"
  | "kaBackMargin"
  | "fdMargin"
  | "bomCost"
  | "logisticsCost"
> & {
  productName?: string | null;
  category?: string | null;
};

export type BusinessPlanDraftLine = {
  id: string;
  rowKey: string;
  year: number;
  month: number;
  promoPriceLocal?: number | null;
  siUnits: number;
  soUnits: number;
  promoDiscountPercent: number;
  assumption?: BusinessPlanTemporaryAssumption;
  channelProfileId?: string | null;
};

export type BusinessPlanMetric = {
  siUnits: number;
  soUnits: number;
  siValueEur: number;
  soValueEur: number;
  kaSiValueEur: number;
  gpEur: number;
  promoRebateEur: number;
  netProfitEur: number;
};

export type BusinessPlanLine = BusinessPlanDraftLine &
  BusinessPlanMetric & {
    quarter: BusinessPlanQuarter;
    countryCode: string;
    channelName: string;
    fdName: string;
    incoterms: string;
    model: string;
    productName: string;
    category: string;
    lifecycleStatus: string;
    currency: string;
    rrpLocal: number | null;
    rrpEur: number | null;
    promoPriceLocal: number | null;
    promoPriceEur: number | null;
    fdBuyingPriceEur: number | null;
    gpPerUnitEur: number | null;
    promoRebatePerUnitEur: number | null;
    npPercent: number | null;
    warningLevel: string | null;
    missingFields: string[];
    source: "MASTER_DATA" | "BP_ASSUMPTION";
  };

export type BusinessPlanQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export type BusinessPlanGroupMetric = BusinessPlanMetric & {
  key: string;
  label: string;
};

export type BusinessPlanSummary = {
  annual: BusinessPlanMetric;
  byQuarter: BusinessPlanGroupMetric[];
  byMonth: BusinessPlanGroupMetric[];
  byChannelQuarter: BusinessPlanGroupMetric[];
  byChannelMonth: BusinessPlanGroupMetric[];
  byCategory: BusinessPlanGroupMetric[];
  byProduct: BusinessPlanGroupMetric[];
};

const MONTH_LABELS = [
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
];

const ZERO_METRIC: BusinessPlanMetric = {
  siUnits: 0,
  soUnits: 0,
  siValueEur: 0,
  soValueEur: 0,
  kaSiValueEur: 0,
  gpEur: 0,
  promoRebateEur: 0,
  netProfitEur: 0
};

export function buildBusinessPlanBaseRows(
  data: ReferenceData,
  assumptions: BusinessPlanTemporaryAssumption[] = []
) {
  const baseRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const assumptionRows = assumptions
    .map((assumption) => buildTemporaryAssumptionRow(data, assumption))
    .filter((row): row is NormalTableRow => row !== null);

  return [...baseRows, ...assumptionRows];
}

export function buildBusinessPlanLines(
  data: ReferenceData,
  drafts: BusinessPlanDraftLine[]
): BusinessPlanLine[] {
  const draftAssumptions = drafts
    .map((draft) => draft.assumption)
    .filter(
      (assumption): assumption is BusinessPlanTemporaryAssumption =>
        assumption !== undefined
    );
  const rowByKey = new Map(
    buildBusinessPlanBaseRows(data, draftAssumptions).map((row) => [row.key, row])
  );

  return drafts.flatMap((draft) => {
    const row = rowByKey.get(draft.rowKey);

    if (!row) {
      return [];
    }

    return [buildBusinessPlanLine(row, draft)];
  });
}

export function buildBusinessPlanLine(
  row: NormalTableRow,
  draft: BusinessPlanDraftLine
): BusinessPlanLine {
  const siUnits = positiveNumber(draft.siUnits);
  const soUnits = positiveNumber(draft.soUnits);
  const targetPriceLocal =
    typeof draft.promoPriceLocal === "number" &&
    Number.isFinite(draft.promoPriceLocal) &&
    draft.promoPriceLocal >= 0
      ? draft.promoPriceLocal
      : null;
  const promoDiscountPercent =
    targetPriceLocal !== null && row.rrpLocal !== null && row.rrpLocal > 0
      ? clampPercent(1 - targetPriceLocal / row.rrpLocal)
      : clampPercent(draft.promoDiscountPercent);
  const discountMultiplier = 1 - promoDiscountPercent;
  const promoPriceLocal =
    row.rrpLocal === null
      ? null
      : roundCurrency(targetPriceLocal ?? row.rrpLocal * discountMultiplier);
  const promoPriceEur =
    row.rrpEur === null
      ? null
      : targetPriceLocal !== null && row.rrpLocal !== null && row.rrpLocal > 0
        ? roundCurrency((targetPriceLocal / row.rrpLocal) * row.rrpEur)
        : roundCurrency(row.rrpEur * discountMultiplier);
  const promotionCalculation =
    row.calculation !== null && promoPriceEur !== null && promoPriceEur > 0
      ? calculateWidePromotionValueChain({
          normalRrp: row.calculation.rrp,
          promoRrp: promoPriceEur,
          vatRate: row.vatRate,
          normalKaBuyingMargin: row.kaBuyingMargin,
          promoKaBuyingMargin: row.kaFrontMargin,
          fdMargin: row.fdMargin,
          actualFrontMargin: row.kaFrontMargin,
          actualBackMargin: row.kaBackMargin,
          logisticsCost: row.calculation.logisticsCost,
          bomCost: row.calculation.bomCost,
          promoVolume: Math.max(soUnits, 1),
          settlementMode: "INVOICE_DISCOUNT"
        })
      : null;
  const fdBuyingPriceEur = row.calculation?.fdBuyingPrice ?? null;
  const gpPerUnitEur = row.calculation?.gp ?? null;
  const promoRebatePerUnitEur = promotionCalculation?.rebatePerUnit ?? null;
  const siValueEur = fdBuyingPriceEur === null ? 0 : fdBuyingPriceEur * siUnits;
  const soValueEur = fdBuyingPriceEur === null ? 0 : fdBuyingPriceEur * soUnits;
  const kaSiValueEur =
    row.calculation === null ? 0 : row.calculation.landingPrice * siUnits;
  const gpEur = gpPerUnitEur === null ? 0 : gpPerUnitEur * siUnits;
  const promoRebateEur =
    promoRebatePerUnitEur === null ? 0 : promoRebatePerUnitEur * soUnits;

  return {
    ...draft,
    month: normalizeMonth(draft.month),
    quarter: quarterForMonth(draft.month),
    siUnits,
    soUnits,
    promoDiscountPercent,
    countryCode: row.countryCode,
    channelName: row.channelName,
    fdName: row.fdName,
    incoterms: row.incoterms,
    model: row.model,
    productName: row.productName,
    category: row.category,
    lifecycleStatus: row.productLifecycleStatus,
    currency: row.currency,
    rrpLocal: row.rrpLocal,
    rrpEur: row.rrpEur,
    promoPriceLocal,
    promoPriceEur,
    fdBuyingPriceEur,
    gpPerUnitEur,
    promoRebatePerUnitEur,
    npPercent: promotionCalculation?.npPercent ?? null,
    warningLevel:
      promotionCalculation?.warningLevel ?? row.calculation?.warningLevel ?? null,
    missingFields: row.missingFields,
    source: isTemporaryAssumptionRow(row) ? "BP_ASSUMPTION" : "MASTER_DATA",
    siValueEur,
    soValueEur,
    kaSiValueEur,
    gpEur,
    promoRebateEur,
    netProfitEur: gpEur - promoRebateEur
  };
}

export function temporaryAssumptionRowKey(
  assumption: Pick<
    BusinessPlanTemporaryAssumption,
    "countryCode" | "retailerName" | "fdName" | "incoterms" | "productSku"
  >
) {
  return `bp-assumption:${[
    assumption.countryCode,
    assumption.retailerName,
    assumption.fdName,
    assumption.incoterms,
    assumption.productSku
  ].map(normalizeAssumptionKeyPart).join("|")}`;
}

export function businessPlanChannelProfileKey(
  profile: Pick<
    BusinessPlanChannelProfileDraft,
    "planYear" | "countryCode" | "retailerName" | "fdName" | "incoterms"
  >
) {
  return `bp-profile:${[
    profile.planYear,
    profile.countryCode,
    profile.retailerName,
    profile.fdName,
    profile.incoterms
  ]
    .map((value) => normalizeAssumptionKeyPart(String(value)))
    .join("|")}`;
}

export function businessPlanChannelProfileLabel(
  profile: Pick<
    BusinessPlanChannelProfileDraft,
    "retailerName" | "fdName" | "incoterms"
  > &
    Partial<Pick<BusinessPlanChannelProfileDraft, "countryCode">>
) {
  const label = `${profile.retailerName} / ${profile.fdName} / ${profile.incoterms}`;

  return profile.countryCode ? `${profile.countryCode} | ${label}` : label;
}

export function buildBusinessPlanProfileAssumption({
  data,
  profile,
  productSku,
  override
}: {
  data: ReferenceData;
  profile: BusinessPlanChannelProfileDraft;
  productSku: string;
  override?: BusinessPlanChannelProductOverrideDraft | null;
}): BusinessPlanTemporaryAssumption | null {
  const normalizedSku = productSku.trim();
  const product = data.products.find(
    (item) =>
      item.status === "ACTIVE" &&
      item.sku.toLowerCase() === normalizedSku.toLowerCase()
  );
  const overrideProductName =
    typeof override?.productName === "string" && override.productName.trim()
      ? override.productName.trim()
      : null;
  const overrideCategory =
    typeof override?.category === "string" && override.category.trim()
      ? override.category.trim()
      : null;
  if (!product && (!normalizedSku || !overrideProductName || !overrideCategory)) {
    return null;
  }

  const optionalValue = <T extends number | string | null | undefined>(
    value: T,
    fallback: T
  ) => (value === null || value === undefined || value === "" ? fallback : value);

  return {
    countryCode: profile.countryCode,
    retailerName: profile.retailerName,
    fdName: profile.fdName,
    incoterms: profile.incoterms,
    productSku: product?.sku ?? normalizedSku,
    productName: product?.name ?? overrideProductName ?? normalizedSku,
    category: product?.category ?? overrideCategory ?? "",
    currency: String(optionalValue(override?.currency, "")),
    rrpLocal: override?.rrpLocal ?? null,
    rrpEur: override?.rrpEur ?? null,
    kaBuyingMargin: Number(
      optionalValue(override?.kaBuyingMargin, profile.kaBuyingMargin)
    ),
    kaFrontMargin: Number(
      optionalValue(override?.kaFrontMargin, profile.kaFrontMargin)
    ),
    kaBackMargin: Number(
      optionalValue(override?.kaBackMargin, profile.kaBackMargin)
    ),
    fdMargin: Number(optionalValue(override?.fdMargin, profile.fdMargin)),
    bomCostEur: override?.bomCost ?? null,
    logisticsCostEur: override?.logisticsCost ?? null
  };
}

export function profileDuplicatesMasterData(
  data: ReferenceData,
  profile: Pick<
    BusinessPlanChannelProfileDraft,
    "countryCode" | "retailerName" | "fdName" | "incoterms"
  >
) {
  return data.operationalMargins.some(
    (margin) =>
      margin.status === "ACTIVE" &&
      normalizeAssumptionKeyPart(margin.countryCode) ===
        normalizeAssumptionKeyPart(profile.countryCode) &&
      normalizeAssumptionKeyPart(margin.retailerName) ===
        normalizeAssumptionKeyPart(profile.retailerName) &&
      normalizeAssumptionKeyPart(margin.fdName) ===
        normalizeAssumptionKeyPart(profile.fdName) &&
      normalizeAssumptionKeyPart(margin.incoterms) ===
        normalizeAssumptionKeyPart(profile.incoterms)
  );
}

export function summarizeBusinessPlan(
  lines: BusinessPlanLine[]
): BusinessPlanSummary {
  return {
    annual: sumMetrics(lines),
    byQuarter: sortByKnownOrder(groupLines(lines, (line) => line.quarter), [
      "Q1",
      "Q2",
      "Q3",
      "Q4"
    ]),
    byMonth: sortByKnownOrder(
      groupLines(lines, (line) => monthLabel(line.month)),
      MONTH_LABELS
    ),
    byChannelQuarter: groupLines(
      lines,
      (line) => `${line.countryCode} · ${line.channelName} · ${line.quarter}`
    ),
    byChannelMonth: groupLines(
      lines,
      (line) =>
        `${line.countryCode} · ${line.channelName} · ${monthLabel(line.month)}`
    ),
    byCategory: groupLines(lines, (line) => line.category),
    byProduct: groupLines(
      lines,
      (line) => `${line.model} · ${line.productName}`
    )
  };
}

export function quarterForMonth(month: number): BusinessPlanQuarter {
  const normalizedMonth = normalizeMonth(month);

  if (normalizedMonth <= 3) {
    return "Q1";
  }

  if (normalizedMonth <= 6) {
    return "Q2";
  }

  if (normalizedMonth <= 9) {
    return "Q3";
  }

  return "Q4";
}

export function monthLabel(month: number) {
  return MONTH_LABELS[normalizeMonth(month) - 1] ?? "January";
}

export function getBusinessPlanMonths() {
  return MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    quarter: quarterForMonth(index + 1)
  }));
}

function groupLines(
  lines: BusinessPlanLine[],
  keyForLine: (line: BusinessPlanLine) => string
): BusinessPlanGroupMetric[] {
  const groups = new Map<string, BusinessPlanLine[]>();

  for (const line of lines) {
    const key = keyForLine(line);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  return [...groups.entries()]
    .map(([key, groupedLines]) => ({
      key,
      label: key,
      ...sumMetrics(groupedLines)
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function sortByKnownOrder(
  groups: BusinessPlanGroupMetric[],
  orderedLabels: string[]
) {
  const order = new Map(orderedLabels.map((label, index) => [label, index]));

  return [...groups].sort(
    (left, right) =>
      (order.get(left.label) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.label) ?? Number.MAX_SAFE_INTEGER)
  );
}

function sumMetrics(lines: BusinessPlanLine[]): BusinessPlanMetric {
  return lines.reduce<BusinessPlanMetric>(
    (sum, line) => ({
      siUnits: sum.siUnits + line.siUnits,
      soUnits: sum.soUnits + line.soUnits,
      siValueEur: sum.siValueEur + line.siValueEur,
      soValueEur: sum.soValueEur + line.soValueEur,
      kaSiValueEur: sum.kaSiValueEur + line.kaSiValueEur,
      gpEur: sum.gpEur + line.gpEur,
      promoRebateEur: sum.promoRebateEur + line.promoRebateEur,
      netProfitEur: sum.netProfitEur + line.netProfitEur
    }),
    { ...ZERO_METRIC }
  );
}

function normalizeMonth(month: number) {
  if (!Number.isFinite(month)) {
    return 1;
  }

  return Math.min(12, Math.max(1, Math.trunc(month)));
}

function positiveNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function buildTemporaryAssumptionRow(
  data: ReferenceData,
  assumption: BusinessPlanTemporaryAssumption
): NormalTableRow | null {
  const country = data.countries.find(
    (item) =>
      item.status === "ACTIVE" &&
      item.code.toUpperCase() === assumption.countryCode.toUpperCase()
  );

  if (!country) {
    return null;
  }

  const product =
    data.products.find(
      (item) =>
        item.status === "ACTIVE" &&
        item.sku.toLowerCase() === assumption.productSku.toLowerCase()
    ) ?? null;
  const rrp = latestByEffectiveDate(
    data.productCountryRrps.filter(
      (item) =>
        item.status === "ACTIVE" &&
        item.countryCode.toUpperCase() === country.code.toUpperCase() &&
        item.productSku.toLowerCase() === assumption.productSku.toLowerCase()
    )
  );
  const bom = latestByEffectiveDate(
    data.bomCosts.filter(
      (item) =>
        item.status === "ACTIVE" &&
        item.productSku.toLowerCase() === assumption.productSku.toLowerCase()
    )
  );
  const logisticsSelection = selectLogisticsCost({
    logisticsCosts: latestLogisticsByBusinessKey(
      data.logisticsCosts.filter((item) => item.status === "ACTIVE")
    ),
    countryId: country.id,
    category: assumption.category,
    productCapacity: product?.capacity ?? null,
    incoterms: assumption.incoterms
  });
  const logistics = logisticsSelection.logisticsCost;
  const rrpLocal = positiveNullableNumber(assumption.rrpLocal) ?? rrp?.rrpLocal ?? null;
  const rrpEur = positiveNullableNumber(assumption.rrpEur) ?? rrp?.rrpEur ?? null;
  const bomCost =
    nonNegativeNullableNumber(assumption.bomCostEur) ?? bom?.bomCost ?? null;
  const logisticsCost =
    nonNegativeNullableNumber(assumption.logisticsCostEur) ??
    logistics?.logisticsCost ??
    null;
  const missingFields: MissingField[] = [];
  if (rrpLocal === null || rrpEur === null) {
    missingFields.push("RRP");
  }
  if (bomCost === null) {
    missingFields.push("BOM");
  }
  if (logisticsCost === null) {
    missingFields.push("LOGISTICS");
  }
  const calculation =
    rrpEur !== null && bomCost !== null && logisticsCost !== null
      ? calculateWideNormalValueChain({
          rrp: rrpEur,
          vatRate: country.vatRate,
          kaBuyingMargin: clampPercent(assumption.kaBuyingMargin),
          fdMargin: clampPercent(assumption.fdMargin),
          actualFrontMargin: clampPercent(assumption.kaFrontMargin),
          actualBackMargin: clampPercent(assumption.kaBackMargin),
          logisticsCost,
          bomCost
        })
      : null;

  return {
    key: temporaryAssumptionRowKey(assumption),
    countryCode: country.code,
    channelName: assumption.retailerName,
    retailerName: assumption.retailerName,
    fdName: assumption.fdName,
    incoterms: assumption.incoterms,
    model: assumption.productSku,
    category: assumption.category,
    productName: assumption.productName || product?.name || assumption.productSku,
    productLifecycleStatus: product?.lifecycleStatus ?? "UNLAUNCHED",
    plannedLaunchAt: product?.plannedLaunchAt ?? null,
    rrpLocal,
    rrpEur,
    currency: assumption.currency || rrp?.currency || country.currency,
    vatRate: country.vatRate,
    kaBuyingMargin: clampPercent(assumption.kaBuyingMargin),
    kaFrontMargin: clampPercent(assumption.kaFrontMargin),
    kaBackMargin: clampPercent(assumption.kaBackMargin),
    fdMargin: clampPercent(assumption.fdMargin),
    logisticsCost,
    bomCost,
    missingFields,
    calculation
  };
}

function isTemporaryAssumptionRow(row: NormalTableRow) {
  return row.key.startsWith("bp-assumption:");
}

function positiveNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function nonNegativeNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function latestByEffectiveDate<T extends { effectiveDate: string; id: string }>(
  records: T[]
) {
  return latestFirst(records)[0] ?? null;
}

function latestFirst<T extends { effectiveDate: string; id: string }>(
  records: T[]
): T[] {
  return [...records].sort((left, right) => {
    const dateDelta =
      parseEffectiveDate(right.effectiveDate) -
      parseEffectiveDate(left.effectiveDate);

    return dateDelta === 0 ? left.id.localeCompare(right.id) : dateDelta;
  });
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

function parseEffectiveDate(effectiveDate: string) {
  const timestamp = Date.parse(effectiveDate);

  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function normalizeAssumptionKeyPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

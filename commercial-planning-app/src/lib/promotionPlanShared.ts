import type {
  CalculatorFilters,
  NormalTableRow,
  PromotionInputsByRow,
  PromotionTableRow
} from "./calculatorRows";
import {
  buildNormalRows,
  buildPromotionRowsFromBaseRows,
  normalRowMatchesFilters
} from "./calculatorRows";
import { calculateWideNormalValueChain } from "./calculations/valueChain";
import type {
  ProductLifecycleStatus,
  PromotionPlanEntryOption,
  PromotionPlanMonthStatusOption,
  ReferenceData
} from "./types";

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
  dealType?: PromotionPlanEntryOption["dealType"] | null;
  promoFdMargin?: number | string | null;
  promotionName?: string | null;
  dealNote?: string | null;
  promoVolume?: number | string | null;
  promoStartDate?: string | null;
  promoEndDate?: string | null;
};

type PromotionPlanBusinessParts = {
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  productSku: string;
};

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
 * An unlaunched product can be planned in the two full calendar months before
 * its planned launch month, and in the launch month itself. This never changes
 * the actual lifecycle; it only controls new promotion-plan additions.
 */
export function isPreLaunchPromotionPlanEligible(
  plannedLaunchAt: string | null | undefined,
  targetMonth: PromotionPlanMonth
) {
  if (!plannedLaunchAt) {
    return false;
  }

  const plannedDate = new Date(plannedLaunchAt);
  if (Number.isNaN(plannedDate.getTime())) {
    return false;
  }

  const launchMonthIndex =
    plannedDate.getUTCFullYear() * 12 + plannedDate.getUTCMonth();
  const targetMonthIndex = targetMonth.year * 12 + targetMonth.month - 1;
  return (
    targetMonthIndex >= launchMonthIndex - 2 &&
    targetMonthIndex <= launchMonthIndex
  );
}

/**
 * Returns the rows that may be newly added to a promotion plan for a month.
 * Existing saved rows intentionally use the broader entry helper below so a
 * later planning-date change never makes an approved or drafted row vanish.
 */
export function buildPromotionPlanEligibleRows({
  data,
  targetMonth
}: {
  data: ReferenceData;
  targetMonth: PromotionPlanMonth;
}): NormalTableRow[] {
  const standardRows = buildNormalRows(data, {}, { lifecycle: "VALUE_CHAIN" });
  const preLaunchRows = buildNormalRows(data, {}, { lifecycle: "UNLAUNCHED" }).filter(
    (row) =>
      row.missingFields.length === 0 &&
      isPreLaunchPromotionPlanEligible(row.plannedLaunchAt, targetMonth)
  );

  return sortPromotionPlanRows([...standardRows, ...preLaunchRows]);
}

export type PromotionPlanPreLaunchConfigurationIssue = {
  model: string;
  productName: string;
  plannedLaunchAt: string;
  missingSetup: string;
};

export function getPromotionPlanPreLaunchConfigurationIssues({
  data,
  targetMonth
}: {
  data: ReferenceData;
  targetMonth: PromotionPlanMonth;
}): PromotionPlanPreLaunchConfigurationIssue[] {
  const eligibleProducts = data.products.filter(
    (product) =>
      product.status === "ACTIVE" &&
      product.lifecycleStatus === "UNLAUNCHED" &&
      isPreLaunchPromotionPlanEligible(product.plannedLaunchAt, targetMonth)
  );
  const unlaunchedRows = buildNormalRows(data, {}, { lifecycle: "UNLAUNCHED" });

  return eligibleProducts.flatMap((product) => {
    const productRows = unlaunchedRows.filter((row) => row.model === product.sku);
    if (productRows.some((row) => row.missingFields.length === 0)) {
      return [];
    }

    const missingFields = new Set(productRows.flatMap((row) => row.missingFields));
    const setupLabels: Record<string, string> = {
      RRP: "active RRP",
      BOM: "BOM",
      LOGISTICS: "logistics"
    };
    const missingSetup =
      productRows.length === 0
        ? "channel / FD margin configuration"
        : [...missingFields]
            .map((field) => setupLabels[field] ?? field.toLowerCase())
            .join(", ");
    return [
      {
        model: product.sku,
        productName: product.name,
        plannedLaunchAt: product.plannedLaunchAt ?? "",
        missingSetup
      }
    ];
  });
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

const PROMOTION_PLAN_ENTRY_ROW_KEY_PREFIX = "promotion-entry:";

export function promotionPlanEntryRowKey(entry: Pick<PromotionPlanEntryOption, "id">) {
  return `${PROMOTION_PLAN_ENTRY_ROW_KEY_PREFIX}${entry.id}`;
}

export function promotionPlanEntryIdFromRowKey(rowKey: string) {
  return rowKey.startsWith(PROMOTION_PLAN_ENTRY_ROW_KEY_PREFIX)
    ? rowKey.slice(PROMOTION_PLAN_ENTRY_ROW_KEY_PREFIX.length)
    : null;
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

/**
 * Keeps personal autosave snapshots tied to the server version they began from.
 * A shared import or another user's save therefore cannot be hidden by an older
 * browser draft for the same country-month.
 */
export function promotionPlanAutosaveBaseline(
  entries: PromotionPlanEntryOption[],
  statuses: Array<Pick<PromotionPlanMonthStatusOption, "countryCode" | "updatedAt">>,
  countryCodes: string[]
) {
  const allowedCountries = new Set(
    countryCodes.map((countryCode) => countryCode.trim().toUpperCase())
  );
  const parts = [
    ...entries
      .filter((entry) => allowedCountries.has(entry.countryCode.toUpperCase()))
      .map((entry) => `${entry.id}:${entry.updatedAt}`),
    ...statuses
      .filter((status) => allowedCountries.has(status.countryCode.toUpperCase()))
      .map((status) => `status:${status.countryCode}:${status.updatedAt}`)
  ].sort();

  let hash = 2166136261;
  for (const character of parts.join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
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

export function buildPromotionPlanBaseRows({
  data,
  entries,
  targetMonth,
  lockedCountryCodes = []
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  targetMonth?: PromotionPlanMonth;
  lockedCountryCodes?: string[];
}): NormalTableRow[] {
  const currentRows = targetMonth
    ? buildPromotionPlanEligibleRows({ data, targetMonth })
    : buildNormalRows(data, {}, { lifecycle: "VALUE_CHAIN" });
  const allCurrentRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const lockedCountries = new Set(
    lockedCountryCodes.map((countryCode) => countryCode.toUpperCase())
  );

  if (lockedCountries.size === 0) {
    return currentRows;
  }

  const currentRowsByBusinessKey = new Map(
    allCurrentRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const unlockedCurrentRows = currentRows.filter(
    (row) => !lockedCountries.has(row.countryCode.toUpperCase())
  );
  const snapshotRows = entries
    .filter((entry) => lockedCountries.has(entry.countryCode.toUpperCase()))
    .map((entry) =>
      promotionPlanSnapshotRowFromEntry({
        entry,
        fallbackRow: currentRowsByBusinessKey.get(
          promotionPlanBusinessKeyForEntry(entry)
        )
      })
    );

  return sortPromotionPlanRows([...unlockedCurrentRows, ...snapshotRows]);
}

export function buildPromotionPlanEntryBaseRows({
  data,
  entries,
  lockedCountryCodes = []
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  lockedCountryCodes?: string[];
}): NormalTableRow[] {
  const currentRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const lockedCountries = new Set(
    lockedCountryCodes.map((countryCode) => countryCode.toUpperCase())
  );
  const currentRowsByBusinessKey = new Map(
    currentRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const entryRows = entries.flatMap((entry) => {
    const businessKey = promotionPlanBusinessKeyForEntry(entry);
    const currentRow = currentRowsByBusinessKey.get(businessKey);
    if (currentRow && !lockedCountries.has(entry.countryCode.toUpperCase())) {
      return [{ ...currentRow, key: promotionPlanEntryRowKey(entry) }];
    }

    return [
      promotionPlanSnapshotRowFromEntry({
        entry,
        fallbackRow: currentRow
      })
    ];
  });

  return sortPromotionPlanRows(entryRows);
}

export function buildPromotionPlanPromotionRows({
  data,
  entries,
  filters = {},
  lockedCountryCodes = []
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  filters?: CalculatorFilters;
  lockedCountryCodes?: string[];
}): PromotionTableRow[] {
  const baseRows = buildPromotionPlanEntryBaseRows({
    data,
    entries,
    lockedCountryCodes
  })
    .filter((row) => normalRowMatchesFilters(row, filters));
  return buildPromotionRowsFromBaseRows(
    baseRows,
    entriesToPromotionInputs(baseRows, entries)
  );
}

function promotionPlanSnapshotRowFromEntry({
  entry,
  fallbackRow
}: {
  entry: PromotionPlanEntryOption;
  fallbackRow?: NormalTableRow;
}): NormalTableRow {
  const rrpLocal = entry.snapshotRrpLocal ?? fallbackRow?.rrpLocal ?? null;
  const rrpEur = entry.snapshotRrpEur ?? fallbackRow?.rrpEur ?? null;
  const vatRate = entry.snapshotVatRate ?? fallbackRow?.vatRate ?? 0;
  const kaBuyingMargin =
    entry.snapshotKaBuyingMargin ?? fallbackRow?.kaBuyingMargin ?? 0;
  const kaFrontMargin =
    entry.snapshotBaseFrontMargin ?? fallbackRow?.kaFrontMargin ?? 0;
  const kaBackMargin = entry.snapshotKaBackMargin ?? fallbackRow?.kaBackMargin ?? 0;
  const fdMargin = entry.snapshotFdMargin ?? fallbackRow?.fdMargin ?? 0;
  const logisticsCost =
    entry.snapshotTransportCost ?? fallbackRow?.logisticsCost ?? null;
  const bomCost = entry.snapshotBomCost ?? fallbackRow?.bomCost ?? null;
  const calculation =
    isCompleteNumber(rrpEur) &&
    isCompleteNumber(logisticsCost) &&
    isCompleteNumber(bomCost)
      ? calculateWideNormalValueChain({
          rrp: rrpEur,
          vatRate,
          kaBuyingMargin,
          fdMargin,
          actualFrontMargin: kaFrontMargin,
          actualBackMargin: kaBackMargin,
          logisticsCost,
          bomCost
        })
      : null;

  return {
    key: promotionPlanEntryRowKey(entry),
    countryCode: entry.countryCode,
    channelName: entry.retailerName,
    retailerName: entry.retailerName,
    fdName: entry.fdName,
    incoterms: entry.incoterms,
    model: entry.productSku,
    category: entry.category,
    productName: entry.productName ?? fallbackRow?.productName ?? entry.productSku,
    productLifecycleStatus:
      entry.snapshotLifecycleStatus ??
      fallbackRow?.productLifecycleStatus ??
      ("LAUNCHED" satisfies ProductLifecycleStatus),
    plannedLaunchAt: fallbackRow?.plannedLaunchAt ?? null,
    rrpLocal,
    rrpEur,
    currency: entry.snapshotCurrency ?? fallbackRow?.currency ?? "EUR",
    vatRate,
    kaBuyingMargin,
    kaFrontMargin,
    kaBackMargin,
    fdMargin,
    logisticsCost,
    bomCost,
    missingFields: [
      ...(rrpEur === null ? ["RRP" as const] : []),
      ...(bomCost === null ? ["BOM" as const] : []),
      ...(logisticsCost === null ? ["LOGISTICS" as const] : [])
    ],
    calculation
  };
}

function sortPromotionPlanRows(rows: NormalTableRow[]) {
  return [...rows].sort(
    (left, right) =>
      left.countryCode.localeCompare(right.countryCode) ||
      left.retailerName.localeCompare(right.retailerName) ||
      left.fdName.localeCompare(right.fdName) ||
      left.incoterms.localeCompare(right.incoterms) ||
      left.category.localeCompare(right.category) ||
      left.model.localeCompare(right.model) ||
      left.productName.localeCompare(right.productName) ||
      left.key.localeCompare(right.key)
  );
}

function isCompleteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeBusinessKeyPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

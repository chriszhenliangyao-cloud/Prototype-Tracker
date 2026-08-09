import {
  buildBusinessPlanBaseRows,
  temporaryAssumptionRowKey,
  type BusinessPlanTemporaryAssumption,
  type BusinessPlanDraftLine
} from "./calculations/businessPlan";
import type { NormalTableRow } from "./calculatorRows";
import type { BusinessPlanEntryOption, ReferenceData } from "./types";

export function businessPlanBusinessKeyForRow(row: NormalTableRow) {
  return businessPlanBusinessKeyForParts({
    countryCode: row.countryCode,
    fdName: row.fdName,
    incoterms: row.incoterms,
    productSku: row.model,
    retailerName: row.retailerName
  });
}

export function businessPlanBusinessKeyForEntry(entry: {
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  productSku: string;
}) {
  return businessPlanBusinessKeyForParts(entry);
}

export function businessPlanBusinessKeyForParts({
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

export function businessPlanDraftLinesFromEntries(
  entries: BusinessPlanEntryOption[],
  data: ReferenceData
): BusinessPlanDraftLine[] {
  const rowsByBusinessKey = new Map(
    buildBusinessPlanBaseRows(data).map((row) => [
      businessPlanBusinessKeyForRow(row),
      row
    ])
  );

  return entries.flatMap((entry) => {
    const assumption = businessPlanAssumptionFromEntry(entry);
    if (assumption) {
      return [
        {
          id: `bp-${entry.planYear}-${entry.planMonth}-${temporaryAssumptionRowKey(assumption)}`,
          rowKey: temporaryAssumptionRowKey(assumption),
          year: entry.planYear,
          month: entry.planMonth,
          promoPriceLocal: entry.promoPriceLocal,
          siUnits: entry.siUnits,
          soUnits: entry.soUnits,
          promoDiscountPercent: entry.promoDiscountPercent,
          channelProfileId: entry.channelProfileId ?? null,
          assumption
        }
      ];
    }

    const baseRow = rowsByBusinessKey.get(businessPlanBusinessKeyForEntry(entry));
    if (!baseRow) {
      return [];
    }

    return [
      {
        id: `bp-${entry.planYear}-${entry.planMonth}-${baseRow.key}`,
        rowKey: baseRow.key,
        year: entry.planYear,
        month: entry.planMonth,
        promoPriceLocal: entry.promoPriceLocal,
        siUnits: entry.siUnits,
        soUnits: entry.soUnits,
        promoDiscountPercent: entry.promoDiscountPercent,
        channelProfileId: entry.channelProfileId ?? null
      }
    ];
  });
}

export function normalizeBusinessPlanCountryCode(value: string) {
  return value.trim().toUpperCase();
}

export function businessPlanAssumptionFromEntry(
  entry: BusinessPlanEntryOption
): BusinessPlanTemporaryAssumption | null {
  if (
    entry.snapshotKaBuyingMargin === null ||
    entry.snapshotKaBuyingMargin === undefined ||
    entry.snapshotKaFrontMargin === null ||
    entry.snapshotKaFrontMargin === undefined ||
    entry.snapshotKaBackMargin === null ||
    entry.snapshotKaBackMargin === undefined ||
    entry.snapshotFdMargin === null ||
    entry.snapshotFdMargin === undefined
  ) {
    return null;
  }

  return {
    countryCode: entry.countryCode,
    retailerName: entry.retailerName,
    fdName: entry.fdName,
    incoterms: entry.incoterms,
    productSku: entry.productSku,
    productName: entry.productName ?? entry.productSku,
    category: entry.category,
    currency: entry.snapshotCurrency ?? "",
    rrpLocal: entry.snapshotRrpLocal ?? null,
    rrpEur: entry.snapshotRrpEur ?? null,
    kaBuyingMargin: entry.snapshotKaBuyingMargin,
    kaFrontMargin: entry.snapshotKaFrontMargin,
    kaBackMargin: entry.snapshotKaBackMargin,
    fdMargin: entry.snapshotFdMargin,
    bomCostEur: entry.snapshotBomCost ?? null,
    logisticsCostEur: entry.snapshotLogisticsCost ?? null
  };
}

function normalizeBusinessPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

import type {
  NormalTableRow,
  PromotionInputsByRow,
  PromotionTableRow
} from "./calculatorRows";
import type { WarningLevel } from "./calculations/valueChain";

export type PromotionPriceScheme = {
  id: string;
  name: string;
  rrpDiscountPercent: number;
  promoVolume: number;
};

export type PromotionSchemeSummary = {
  schemeId: string;
  name: string;
  completeRows: number;
  rowCount: number;
  totalRebate: number;
  averageNpPercent: number;
  warningRows: number;
  criticalRows: number;
  bestNpPercent: number | null;
  worstNpPercent: number | null;
};

export function buildPromotionInputsForScheme(
  rows: NormalTableRow[],
  scheme: PromotionPriceScheme
): PromotionInputsByRow {
  const discountMultiplier = 1 - scheme.rrpDiscountPercent;

  return rows.reduce<PromotionInputsByRow>((inputs, row) => {
    inputs[row.key] = {
      promoRrpLocal:
        row.rrpLocal === null ? "" : roundCurrency(row.rrpLocal * discountMultiplier),
      promoRrpEur:
        row.rrpEur === null ? "" : roundCurrency(row.rrpEur * discountMultiplier),
      promoVolume: scheme.promoVolume
    };

    return inputs;
  }, {});
}

export function summarizePromotionScheme(
  scheme: PromotionPriceScheme,
  rows: PromotionTableRow[]
): PromotionSchemeSummary {
  const completeRows = rows.filter((row) => row.promotionCalculation !== null);
  const npPercents = completeRows.map(
    (row) => row.promotionCalculation?.npPercent ?? 0
  );

  return {
    schemeId: scheme.id,
    name: scheme.name,
    completeRows: completeRows.length,
    rowCount: rows.length,
    totalRebate: completeRows.reduce(
      (sum, row) => sum + (row.promotionCalculation?.totalRebate ?? 0),
      0
    ),
    averageNpPercent:
      completeRows.length === 0
        ? 0
        : npPercents.reduce((sum, value) => sum + value, 0) / completeRows.length,
    warningRows: countWarnings(completeRows, "WARNING"),
    criticalRows: countWarnings(completeRows, "CRITICAL"),
    bestNpPercent: npPercents.length === 0 ? null : Math.max(...npPercents),
    worstNpPercent: npPercents.length === 0 ? null : Math.min(...npPercents)
  };
}

function countWarnings(
  rows: PromotionTableRow[],
  warningLevel: Exclude<WarningLevel, "GOOD">
): number {
  return rows.filter(
    (row) => row.promotionCalculation?.warningLevel === warningLevel
  ).length;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

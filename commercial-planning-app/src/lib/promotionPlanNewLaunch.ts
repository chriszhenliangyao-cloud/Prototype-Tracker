import { buildNormalRows } from "./calculatorRows";
import { promotionPlanMonthKey, type PromotionPlanMonth } from "./promotionPlanShared";
import type { PromotionPlanEntryOption, ReferenceData } from "./types";

export type NewLaunchedProductReviewStatus =
  | "INCLUDED"
  | "MISSING"
  | "NO_ACTIVE_PLAN_DATA";

export type NewLaunchedProductReview = {
  launchMonth: string;
  sku: string;
  productName: string;
  category: string;
  launchedAt: string;
  availableCountryCodes: string[];
  includedInPlan: boolean;
  status: NewLaunchedProductReviewStatus;
};

export function buildNewLaunchedProductReview({
  data,
  entries,
  targetMonth
}: {
  data: ReferenceData;
  entries: PromotionPlanEntryOption[];
  targetMonth: PromotionPlanMonth;
}): NewLaunchedProductReview[] {
  const launchMonth = previousMonth(targetMonth);
  const launchMonthKey = promotionPlanMonthKey(launchMonth);
  const planEntries = entries.filter(
    (entry) =>
      entry.planYear === targetMonth.year && entry.planMonth === targetMonth.month
  );
  const plannedSkus = new Set(
    planEntries.map((entry) => normalizeSku(entry.productSku))
  );
  const currentRows = buildNormalRows(data, {}, { lifecycle: "VALUE_CHAIN" });
  const availableCountriesBySku = new Map<string, Set<string>>();

  for (const row of currentRows) {
    const sku = normalizeSku(row.model);
    const countries = availableCountriesBySku.get(sku) ?? new Set<string>();
    countries.add(row.countryCode);
    availableCountriesBySku.set(sku, countries);
  }

  return data.products
    .filter(
      (product) =>
        product.lifecycleStatus === "LAUNCHED" &&
        typeof product.launchedAt === "string" &&
        madridMonthKey(product.launchedAt) === launchMonthKey
    )
    .map((product) => {
      const sku = normalizeSku(product.sku);
      const launchedAt = product.launchedAt ?? "";
      const availableCountryCodes = [
        ...(availableCountriesBySku.get(sku) ?? new Set<string>())
      ].sort();
      const includedInPlan = plannedSkus.has(sku);
      const status: NewLaunchedProductReviewStatus = includedInPlan
        ? "INCLUDED"
        : availableCountryCodes.length > 0
          ? "MISSING"
          : "NO_ACTIVE_PLAN_DATA";

      return {
        launchMonth: launchMonthKey,
        sku: product.sku,
        productName: product.name,
        category: product.category,
        launchedAt,
        availableCountryCodes,
        includedInPlan,
        status
      };
    })
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.sku.localeCompare(right.sku)
    );
}

export function missingNewLaunchedProducts(
  reviews: NewLaunchedProductReview[]
) {
  return reviews.filter((review) => review.status === "MISSING");
}

export function previousMonth(month: PromotionPlanMonth): PromotionPlanMonth {
  if (month.month === 1) {
    return { year: month.year - 1, month: 12 };
  }

  return { year: month.year, month: month.month - 1 };
}

function madridMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

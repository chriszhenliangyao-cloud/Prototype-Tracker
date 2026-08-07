import type { BusinessPlanLine } from "./calculations/businessPlan";
import type { BusinessPlanActualEntryOption } from "./types";

export type BusinessPlanAchievementMetric = {
  targetSiUnits: number;
  actualSiUnits: number;
  targetSiValueEur: number;
  actualSiValueEur: number;
};

export type BusinessPlanAchievementMonth = BusinessPlanAchievementMetric & {
  month: number;
  label: string;
};

export type BusinessPlanAchievementProduct = BusinessPlanAchievementMetric & {
  countryCode: string;
  productModel: string;
  productName: string;
  hasBpProductMatch: boolean;
};

export type BusinessPlanAchievementProductSort =
  | "TARGET_SI_DESC"
  | "ACTUAL_SI_DESC"
  | "SI_ACHIEVEMENT_DESC"
  | "TARGET_VALUE_DESC"
  | "VALUE_ACHIEVEMENT_DESC";

export type BusinessPlanAchievement = {
  summary: BusinessPlanAchievementMetric;
  annualSummary: BusinessPlanAchievementMetric;
  byMonth: BusinessPlanAchievementMonth[];
  byProduct: BusinessPlanAchievementProduct[];
  coverage: Array<{ countryCode: string; months: number[] }>;
  latestImportedAt: string | null;
};

const monthLabels = [
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

const zeroMetric: BusinessPlanAchievementMetric = {
  targetSiUnits: 0,
  actualSiUnits: 0,
  targetSiValueEur: 0,
  actualSiValueEur: 0
};

export function buildBusinessPlanAchievement({
  actuals,
  aggregateProductsAcrossMarkets = false,
  lines,
  period = "ALL",
  productFilter = "ALL"
}: {
  actuals: BusinessPlanActualEntryOption[];
  aggregateProductsAcrossMarkets?: boolean;
  lines: BusinessPlanLine[];
  period?: string;
  productFilter?: string;
}): BusinessPlanAchievement {
  const targetProductModels = buildTargetProductModels(lines);
  const annualTargetLines = lines.filter((line) =>
    matchesProductFilter(line.model, productFilter)
  );
  const annualActualRows = actuals.filter((row) =>
    matchesProductFilter(
      resolveActualProductModel(row, targetProductModels),
      productFilter
    )
  );
  const targetLines = lines.filter(
    (line) =>
      matchesPeriod(line.month, period) &&
      matchesProductFilter(line.model, productFilter)
  );
  const actualRows = actuals.filter(
    (row) =>
      matchesPeriod(row.planMonth, period) &&
      matchesProductFilter(
        resolveActualProductModel(row, targetProductModels),
        productFilter
      )
  );
  const summary = combineMetrics(
    metricFromTargetLines(targetLines),
    metricFromActualRows(actualRows)
  );
  const annualSummary = combineMetrics(
    metricFromTargetLines(annualTargetLines),
    metricFromActualRows(annualActualRows)
  );
  const targetByMonth = groupTargetMetrics(targetLines, (line) => String(line.month));
  const actualByMonth = groupActualMetrics(actualRows, (row) => String(row.planMonth));
  const targetByProduct = groupTargetMetrics(targetLines, (line) =>
    productKey(
      aggregateProductsAcrossMarkets ? null : line.countryCode,
      line.model,
      line.productName
    )
  );
  const actualByProduct = groupActualMetrics(actualRows, (row) =>
    productKey(
      aggregateProductsAcrossMarkets ? null : row.countryCode,
      resolveActualProductModel(row, targetProductModels),
      row.productName
    )
  );
  const productIdentities = new Map<
    string,
    { countryCode: string; productModel: string; productName: string }
  >();

  for (const line of targetLines) {
    productIdentities.set(productKey(
      aggregateProductsAcrossMarkets ? null : line.countryCode,
      line.model,
      line.productName
    ), {
      countryCode: aggregateProductsAcrossMarkets ? "All markets" : line.countryCode,
      productModel: line.model,
      productName: line.productName
    });
  }
  for (const row of actualRows) {
    const resolvedProductModel = resolveActualProductModel(row, targetProductModels);
    const key = productKey(
      aggregateProductsAcrossMarkets ? null : row.countryCode,
      resolvedProductModel,
      row.productName
    );
    if (!productIdentities.has(key)) {
      productIdentities.set(key, {
        countryCode: aggregateProductsAcrossMarkets ? "All markets" : row.countryCode,
        productModel: resolvedProductModel || "Unspecified SKU",
        productName: row.productName || "Unspecified product"
      });
    }
  }

  return {
    summary,
    annualSummary,
    byMonth: monthLabels.map((label, index) => {
      const key = String(index + 1);
      return {
        month: index + 1,
        label,
        ...combineMetrics(targetByMonth.get(key), actualByMonth.get(key))
      };
    }),
    byProduct: [...productIdentities.entries()]
      .map(([key, identity]) => {
        const target = targetByProduct.get(key);
        return {
          ...identity,
          ...combineMetrics(target, actualByProduct.get(key)),
          hasBpProductMatch: Boolean(target)
        };
      })
      .sort(
        (left, right) =>
          left.countryCode.localeCompare(right.countryCode) ||
          left.productModel.localeCompare(right.productModel) ||
          left.productName.localeCompare(right.productName)
      ),
    coverage: buildCoverage(actualRows),
    latestImportedAt: latestImportedAt(actualRows)
  };
}

export function achievementRate(actual: number, target: number): number | null {
  return target > 0 ? actual / target : null;
}

export function sortBusinessPlanAchievementProducts(
  products: BusinessPlanAchievementProduct[],
  sort: BusinessPlanAchievementProductSort
) {
  return [...products].sort((left, right) => {
    const difference = productSortMetric(right, sort) - productSortMetric(left, sort);
    if (difference !== 0) {
      return difference;
    }

    return (
      left.countryCode.localeCompare(right.countryCode) ||
      left.productModel.localeCompare(right.productModel) ||
      left.productName.localeCompare(right.productName)
    );
  });
}

function productSortMetric(
  product: BusinessPlanAchievementProduct,
  sort: BusinessPlanAchievementProductSort
) {
  switch (sort) {
    case "ACTUAL_SI_DESC":
      return product.actualSiUnits;
    case "SI_ACHIEVEMENT_DESC":
      return achievementRate(product.actualSiUnits, product.targetSiUnits) ?? -Infinity;
    case "TARGET_VALUE_DESC":
      return product.targetSiValueEur;
    case "VALUE_ACHIEVEMENT_DESC":
      return achievementRate(product.actualSiValueEur, product.targetSiValueEur) ?? -Infinity;
    case "TARGET_SI_DESC":
    default:
      return product.targetSiUnits;
  }
}

function metricFromTargetLines(lines: BusinessPlanLine[]) {
  return lines.reduce(
    (metric, line) => ({
      targetSiUnits: metric.targetSiUnits + line.siUnits,
      actualSiUnits: metric.actualSiUnits,
      targetSiValueEur: metric.targetSiValueEur + line.siValueEur,
      actualSiValueEur: metric.actualSiValueEur
    }),
    { ...zeroMetric }
  );
}

function metricFromActualRows(rows: BusinessPlanActualEntryOption[]) {
  return rows.reduce(
    (metric, row) => ({
      targetSiUnits: metric.targetSiUnits,
      actualSiUnits: metric.actualSiUnits + row.siUnits,
      targetSiValueEur: metric.targetSiValueEur,
      actualSiValueEur: metric.actualSiValueEur + row.siValueEur
    }),
    { ...zeroMetric }
  );
}

function groupTargetMetrics(
  lines: BusinessPlanLine[],
  keyForLine: (line: BusinessPlanLine) => string
) {
  const groups = new Map<string, BusinessPlanAchievementMetric>();
  for (const line of lines) {
    const key = keyForLine(line);
    groups.set(key, combineMetrics(groups.get(key), metricFromTargetLines([line])));
  }
  return groups;
}

function groupActualMetrics(
  rows: BusinessPlanActualEntryOption[],
  keyForRow: (row: BusinessPlanActualEntryOption) => string
) {
  const groups = new Map<string, BusinessPlanAchievementMetric>();
  for (const row of rows) {
    const key = keyForRow(row);
    groups.set(key, combineMetrics(groups.get(key), metricFromActualRows([row])));
  }
  return groups;
}

function combineMetrics(
  target: Partial<BusinessPlanAchievementMetric> | undefined,
  actual: Partial<BusinessPlanAchievementMetric> | undefined
): BusinessPlanAchievementMetric {
  return {
    targetSiUnits: (target?.targetSiUnits ?? 0) + (actual?.targetSiUnits ?? 0),
    actualSiUnits: (target?.actualSiUnits ?? 0) + (actual?.actualSiUnits ?? 0),
    targetSiValueEur:
      (target?.targetSiValueEur ?? 0) + (actual?.targetSiValueEur ?? 0),
    actualSiValueEur: (target?.actualSiValueEur ?? 0) + (actual?.actualSiValueEur ?? 0)
  };
}

function matchesPeriod(month: number, period: string) {
  if (period === "ALL") {
    return true;
  }
  if (period.startsWith("MONTH_")) {
    return month === Number(period.slice("MONTH_".length));
  }
  const quarter = Math.floor((month - 1) / 3) + 1;
  return period === `Q${quarter}`;
}

function matchesProductFilter(productModel: string | null, productFilter: string) {
  return productFilter === "ALL" || normalizeProductModel(productModel) === normalizeProductModel(productFilter);
}

function buildTargetProductModels(lines: BusinessPlanLine[]) {
  const targetModels = new Map<string, string>();
  for (const line of lines) {
    targetModels.set(
      targetProductModelKey(line.countryCode, line.model),
      line.model
    );
  }
  return targetModels;
}

function resolveActualProductModel(
  row: BusinessPlanActualEntryOption,
  targetModels: Map<string, string>
) {
  const sourceModel = row.productModel;
  if (!sourceModel) {
    return null;
  }

  for (const candidate of productModelCandidates(sourceModel)) {
    const targetModel = targetModels.get(
      targetProductModelKey(row.countryCode, candidate)
    );
    if (targetModel) {
      return targetModel;
    }
  }
  return sourceModel;
}

function targetProductModelKey(countryCode: string, productModel: string) {
  return `${countryCode}|${normalizeProductModel(productModel)}`;
}

function productModelCandidates(sourceModel: string) {
  const candidates = [sourceModel];
  const source = normalizeProductModel(sourceModel);
  const colorAliases: Array<[RegExp, string]> = [
    [/-BLACK$/, "-B"],
    [/-BLUE$/, "-BU"],
    [/-ORANGE$/, "-O"],
    [/-DESERTTITAN$/, "-D"],
    [/-TITAN$/, "-T"],
    [/-WHITE$/, "-W"]
  ];

  for (const [suffix, replacement] of colorAliases) {
    if (suffix.test(source)) {
      candidates.push(source.replace(suffix, replacement));
      candidates.push(source.replace(suffix, ""));
      break;
    }
  }
  return candidates;
}

function productKey(
  countryCode: string | null,
  productModel: string | null,
  productName: string | null
) {
  const model = normalizeProductModel(productModel);
  const name = normalizeProductName(productName);
  return `${countryCode ?? "ALL"}|${model ? `model:${model}` : `name:${name || "unspecified"}`}`;
}

function normalizeProductModel(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeProductName(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildCoverage(rows: BusinessPlanActualEntryOption[]) {
  const coverage = new Map<string, Set<number>>();
  for (const row of rows) {
    const months = coverage.get(row.countryCode) ?? new Set<number>();
    months.add(row.planMonth);
    coverage.set(row.countryCode, months);
  }
  return [...coverage.entries()]
    .map(([countryCode, months]) => ({
      countryCode,
      months: [...months].sort((left, right) => left - right)
    }))
    .sort((left, right) => left.countryCode.localeCompare(right.countryCode));
}

function latestImportedAt(rows: BusinessPlanActualEntryOption[]) {
  return rows.reduce<string | null>((latest, row) => {
    if (!latest || row.importedAt > latest) {
      return row.importedAt;
    }
    return latest;
  }, null);
}

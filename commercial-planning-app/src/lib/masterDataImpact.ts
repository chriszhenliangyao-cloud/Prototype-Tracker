import type { MasterDataWorkbookImportResult } from "./imports/masterDataImport";
import type { ReferenceData, RecordStatus } from "./types";

export type MasterDataImpactGroup = {
  key: "markets" | "products" | "bom" | "rrp" | "logistics" | "margins";
  label: string;
  incoming: number;
  added: number;
  changed: number;
  inactivated: number;
};

export type MasterDataImpactPreview = {
  groups: MasterDataImpactGroup[];
  totalChanges: number;
  affectedModules: string[];
};

export function buildMasterDataImpactPreview(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactPreview {
  const groups = [
    marketImpact(incoming, current),
    productImpact(incoming, current),
    bomImpact(incoming, current),
    rrpImpact(incoming, current),
    logisticsImpact(incoming, current),
    marginImpact(incoming, current)
  ];
  const changedKeys = new Set(
    groups
      .filter((group) => group.added + group.changed + group.inactivated > 0)
      .map((group) => group.key)
  );

  return {
    groups,
    totalChanges: groups.reduce(
      (sum, group) => sum + group.added + group.changed + group.inactivated,
      0
    ),
    affectedModules: affectedModules(changedKeys)
  };
}

function marketImpact(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactGroup {
  const activeCountries = activeMap(current.countries, (row) => row.code);
  const activeRates = activeMap(
    current.exchangeRates ?? [],
    (row) => row.currency.toUpperCase()
  );
  const incomingCodes = new Set(incoming.countries.map((row) => row.countryCode));
  let added = 0;
  let changed = 0;

  for (const row of incoming.countries) {
    const country = activeCountries.get(row.countryCode);
    const rate = activeRates.get(row.currency.toUpperCase());
    if (!country) {
      added += 1;
      continue;
    }
    if (
      country.currency.toUpperCase() !== row.currency.toUpperCase() ||
      !sameNumber(country.vatRate, row.vatRate) ||
      !rate ||
      !sameNumber(rate.exchangeRateToEur, row.exchangeRateToEur)
    ) {
      changed += 1;
    }
  }

  return impactGroup({
    key: "markets",
    label: "Markets, VAT & FX",
    incoming: incoming.countries.length,
    added,
    changed,
    inactivated: [...activeCountries.keys()].filter((key) => !incomingCodes.has(key)).length
  });
}

function productImpact(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactGroup {
  const activeProducts = activeMap(current.products, (row) => row.sku);
  const incomingSkus = new Set(incoming.bomProducts.map((row) => row.model));
  let added = 0;
  let changed = 0;

  for (const row of incoming.bomProducts) {
    const product = activeProducts.get(row.model);
    if (!product) {
      added += 1;
      continue;
    }
    const nextLifecycle = row.lifecycleStatus ?? product.lifecycleStatus;
    const nextLaunchDate =
      row.plannedLaunchDate === undefined
        ? dateOnly(product.plannedLaunchAt)
        : row.plannedLaunchDate ?? "";
    if (
      product.name !== row.name ||
      product.category !== row.category ||
      product.lifecycleStatus !== nextLifecycle ||
      dateOnly(product.plannedLaunchAt) !== nextLaunchDate
    ) {
      changed += 1;
    }
  }

  return impactGroup({
    key: "products",
    label: "Products",
    incoming: incoming.bomProducts.length,
    added,
    changed,
    inactivated: [...activeProducts.keys()].filter((key) => !incomingSkus.has(key)).length
  });
}

function bomImpact(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactGroup {
  const activeBom = latestActiveMap(current.bomCosts, (row) => row.productSku);
  const incomingSkus = new Set(incoming.bomProducts.map((row) => row.model));
  let added = 0;
  let changed = 0;

  for (const row of incoming.bomProducts) {
    const bom = activeBom.get(row.model);
    if (!bom) {
      added += 1;
    } else if (
      !sameNumber(bom.bomCost, row.bomEur) ||
      !sameNullableNumber(bom.bomCostRmb, row.bomRmb)
    ) {
      changed += 1;
    }
  }

  return impactGroup({
    key: "bom",
    label: "BOM costs",
    incoming: incoming.bomProducts.length,
    added,
    changed,
    inactivated: [...activeBom.keys()].filter((key) => !incomingSkus.has(key)).length
  });
}

function rrpImpact(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactGroup {
  const activeRrps = latestActiveMap(
    current.productCountryRrps,
    (row) => key(row.countryCode, row.productSku)
  );
  const incomingKeys = new Set(
    incoming.productCountryRrps.map((row) => key(row.countryCode, row.model))
  );
  let added = 0;
  let changed = 0;

  for (const row of incoming.productCountryRrps) {
    const rrp = activeRrps.get(key(row.countryCode, row.model));
    if (!rrp) {
      added += 1;
    } else if (
      !sameNumber(rrp.rrpLocal, row.rrpLocal) ||
      !sameNumber(rrp.rrpEur, row.rrpEur) ||
      rrp.currency.toUpperCase() !== row.currency.toUpperCase()
    ) {
      changed += 1;
    }
  }

  return impactGroup({
    key: "rrp",
    label: "Country RRP",
    incoming: incoming.productCountryRrps.length,
    added,
    changed,
    inactivated: [...activeRrps.keys()].filter((item) => !incomingKeys.has(item)).length
  });
}

function logisticsImpact(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactGroup {
  const activeCosts = latestActiveMap(
    current.logisticsCosts,
    (row) => key(row.countryCode, row.category, row.productSize)
  );
  const expectedRows = incoming.countries.flatMap((country) =>
    incoming.logisticsCosts.map((row) => ({
      key: key(country.countryCode, row.category, row.incoterms),
      value: row.logisticsCostEur
    }))
  );
  const incomingKeys = new Set(expectedRows.map((row) => row.key));
  let added = 0;
  let changed = 0;

  for (const row of expectedRows) {
    const cost = activeCosts.get(row.key);
    if (!cost) {
      added += 1;
    } else if (!sameNumber(cost.logisticsCost, row.value)) {
      changed += 1;
    }
  }

  return impactGroup({
    key: "logistics",
    label: "Logistics costs",
    incoming: expectedRows.length,
    added,
    changed,
    inactivated: [...activeCosts.keys()].filter((item) => !incomingKeys.has(item)).length
  });
}

function marginImpact(
  incoming: MasterDataWorkbookImportResult,
  current: ReferenceData
): MasterDataImpactGroup {
  const activeMargins = latestActiveMap(
    current.operationalMargins,
    (row) => key(
      row.countryCode,
      row.retailerName,
      row.fdName,
      row.incoterms,
      row.category
    )
  );
  const incomingKeys = new Set(
    incoming.operationalMargins.map((row) => key(
      row.countryCode,
      row.retailerName,
      row.fdName,
      row.incoterms,
      row.category
    ))
  );
  let added = 0;
  let changed = 0;

  for (const row of incoming.operationalMargins) {
    const margin = activeMargins.get(key(
      row.countryCode,
      row.retailerName,
      row.fdName,
      row.incoterms,
      row.category
    ));
    if (!margin) {
      added += 1;
    } else if (
      !sameNumber(margin.kaBuyingMargin, row.kaBuyingMargin) ||
      !sameNumber(margin.kaFrontMargin, row.kaFrontMargin) ||
      !sameNumber(margin.kaBackMargin, row.kaBackMargin) ||
      !sameNumber(margin.fdMargin, row.fdMargin)
    ) {
      changed += 1;
    }
  }

  return impactGroup({
    key: "margins",
    label: "Commercial margins",
    incoming: incoming.operationalMargins.length,
    added,
    changed,
    inactivated: [...activeMargins.keys()].filter((item) => !incomingKeys.has(item)).length
  });
}

function affectedModules(changedKeys: Set<MasterDataImpactGroup["key"]>) {
  const modules = new Set<string>();
  if (changedKeys.has("products")) {
    [
      "Project Tracking",
      "Sales & Inventory",
      "Forecast Management",
      "Logistics Delivery",
      "Marketing Assets",
      "Prototype Management"
    ].forEach((module) => modules.add(module));
  }
  if (["markets", "bom", "rrp", "logistics", "margins"].some((key) => changedKeys.has(key as MasterDataImpactGroup["key"]))) {
    [
      "On-sale Product Simulation",
      "New Product Simulation",
      "BP Achievement",
      "Monthly Promotion Approval"
    ].forEach((module) => modules.add(module));
  }
  return [...modules];
}

function impactGroup(group: MasterDataImpactGroup): MasterDataImpactGroup {
  return group;
}

function activeMap<T extends { status: RecordStatus }>(
  rows: T[],
  keyForRow: (row: T) => string
) {
  return new Map(rows.filter((row) => row.status === "ACTIVE").map((row) => [keyForRow(row), row]));
}

function latestActiveMap<T extends { status: RecordStatus; effectiveDate: string }>(
  rows: T[],
  keyForRow: (row: T) => string
) {
  const result = new Map<string, T>();
  for (const row of rows.filter((item) => item.status === "ACTIVE")) {
    const rowKey = keyForRow(row);
    const existing = result.get(rowKey);
    if (!existing || row.effectiveDate > existing.effectiveDate) {
      result.set(rowKey, row);
    }
  }
  return result;
}

function key(...values: string[]) {
  return values.map((value) => value.trim()).join("\u001F");
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.000001;
}

function sameNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined
) {
  if (left === null || left === undefined) {
    return right === null || right === undefined;
  }
  if (right === null || right === undefined) return false;
  return sameNumber(left, right);
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

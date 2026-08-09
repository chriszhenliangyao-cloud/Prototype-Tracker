import type { ReferenceData } from "./types";

export type PlatformMasterDataProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  lifecycleStatus: "LAUNCHED" | "UNLAUNCHED" | "EOL";
  launchedAt: string | null;
  plannedLaunchAt: string | null;
};

export type PlatformMasterDataCatalog = {
  generatedAt: string;
  products: PlatformMasterDataProduct[];
  categories: string[];
  markets: Array<{
    id: string;
    code: string;
    name: string;
    currency: string;
    vatRate: number;
  }>;
  channels: string[];
  retailers: string[];
  distributors: string[];
  incoterms: string[];
};

export function buildPlatformMasterDataCatalog(
  data: ReferenceData,
  generatedAt = new Date().toISOString()
): PlatformMasterDataCatalog {
  const products = data.products
    .filter((product) => product.status === "ACTIVE")
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: normalizePlatformCategory(product.category),
      lifecycleStatus: product.lifecycleStatus,
      launchedAt: product.launchedAt ?? null,
      plannedLaunchAt: product.plannedLaunchAt ?? null
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));

  const categories = [
    "Power Bank",
    "Charger",
    "Wireless Charger",
    "Charging Cable"
  ];
  for (const product of products) {
    if (!categories.includes(product.category)) categories.push(product.category);
  }

  return {
    generatedAt,
    products,
    categories,
    markets: data.countries
      .filter((country) => country.status === "ACTIVE")
      .map((country) => ({
        id: country.id,
        code: country.code,
        name: country.name,
        currency: country.currency,
        vatRate: country.vatRate
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    channels: uniqueSorted([
      ...data.channelMargins.map((margin) => margin.channelName),
      ...data.fdMargins.map((margin) => margin.channelName)
    ]),
    retailers: uniqueSorted([
      ...data.operationalMargins.map((margin) => margin.retailerName),
      ...data.channelMargins.map((margin) => margin.kaName)
    ]),
    distributors: uniqueSorted([
      ...data.operationalMargins.map((margin) => margin.fdName),
      ...data.fdMargins.map((margin) => margin.fdName)
    ]),
    incoterms: uniqueSorted(
      data.operationalMargins.map((margin) => margin.incoterms)
    )
  };
}

export function normalizePlatformCategory(category: string) {
  const value = category.trim().toLowerCase();
  if (value === "cable" || value === "charging cable") return "Charging Cable";
  if (value === "power bank") return "Power Bank";
  if (value === "wireless charger") return "Wireless Charger";
  if (value === "charger") return "Charger";
  return category.trim();
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

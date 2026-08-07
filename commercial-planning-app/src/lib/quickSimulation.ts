import type {
  RrppSimulationInputsByRow
} from "./calculatorRows";
import type {
  BomCostOption,
  ProductCountryRrpOption,
  ProductOption,
  ReferenceData
} from "./types";

export type QuickSimulationDraft = {
  countryCodes: string[];
  channelKeys?: string[];
  category: string;
  productName: string;
  model?: string;
  rrpEur: number;
  bomEur?: number;
  bomRmb?: number;
};

export type QuickSimulationProductDraft = {
  id: string;
  category: string;
  productName: string;
  model?: string;
  rrpEur: number;
  simRrppEur?: number;
  bomEur?: number;
  bomRmb?: number;
};

export type QuickProductSetSimulationDraft = {
  countryCodes: string[];
  channelKeys?: string[];
  products: QuickSimulationProductDraft[];
};

export type QuickSimulationPreview = {
  data: ReferenceData;
  inputsByRow: RrppSimulationInputsByRow;
  sku: string;
  rrpEur: number;
  bomEur: number;
  bomRmb: number | null;
};

export type QuickProductSetSimulationPreview = {
  data: ReferenceData;
  inputsByRow: RrppSimulationInputsByRow;
  products: Array<{
    draftId: string;
    productId: string;
    sku: string;
    productName: string;
    category: string;
    rrpEur: number;
    simRrppEur: number | null;
    bomEur: number;
    bomRmb: number | null;
  }>;
};

export type QuickSimulationInputMergeDraft = {
  data: Pick<ReferenceData, "countries" | "productCountryRrps" | "exchangeRates" | "operationalMargins">;
  baseInputsByRow: RrppSimulationInputsByRow;
  manualInputsByRow: RrppSimulationInputsByRow;
  bulkRrppEur?: number;
  applyBulkRrppEur?: boolean;
};

type PreviewOrderRow = {
  key: string;
};

const QUICK_PRODUCT_ID = "quick-simulation-product";
const QUICK_SET_PRODUCT_ID_PREFIX = "quick-simulation-product-set";
const QUICK_SIMULATION_EFFECTIVE_DATE = new Date(0).toISOString();

export function buildSuggestedSku(productName: string) {
  const compact = productName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);

  return compact ? `NP-${compact}` : "NP-SIM";
}

export function uniqueSuggestedSku(baseSku: string, existingSkus: string[]) {
  const normalizedBase = normalizeSku(baseSku);
  const existing = new Set(existingSkus.map((sku) => normalizeSku(sku)));
  if (!existing.has(normalizedBase)) {
    return normalizedBase;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalizedBase}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now()}`;
}

export function normalizeSku(value: string) {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "NP-SIM"
  );
}

export function inferExchangeRateToEur(
  data: Pick<ReferenceData, "countries" | "productCountryRrps" | "exchangeRates">,
  countryCode: string
) {
  const country = data.countries.find((item) => item.code === countryCode);
  if (!country || country.currency === "EUR") {
    return 1;
  }

  const explicitRate = inferCurrencyExchangeRateToEur(data, country.currency);
  if (explicitRate > 0) {
    return explicitRate;
  }

  const ratios = data.productCountryRrps
    .filter(
      (rrp) =>
        rrp.countryCode === countryCode &&
        rrp.status === "ACTIVE" &&
        rrp.rrpLocal > 0 &&
        rrp.rrpEur > 0
    )
    .map((rrp) => rrp.rrpLocal / rrp.rrpEur)
    .filter((ratio) => Number.isFinite(ratio) && ratio > 0)
    .sort((a, b) => a - b);

  if (ratios.length === 0) {
    return 1;
  }

  return ratios[Math.floor(ratios.length / 2)] ?? 1;
}

export function inferCurrencyExchangeRateToEur(
  data: Pick<ReferenceData, "exchangeRates" | "countries" | "productCountryRrps">,
  currency: string
) {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (normalizedCurrency === "" || normalizedCurrency === "EUR") {
    return 1;
  }

  const explicitRate = (data.exchangeRates ?? []).find(
    (rate) =>
      rate.currency.toUpperCase() === normalizedCurrency &&
      rate.status === "ACTIVE" &&
      rate.exchangeRateToEur > 0
  );
  if (explicitRate) {
    return explicitRate.exchangeRateToEur;
  }

  return 0;
}

export function convertEurToLocalCurrency(
  data: Pick<ReferenceData, "countries" | "productCountryRrps" | "exchangeRates">,
  countryCode: string,
  eurValue: number
) {
  if (!Number.isFinite(eurValue)) {
    return 0;
  }

  return roundCurrency(eurValue * inferExchangeRateToEur(data, countryCode));
}

export function mergeQuickSimulationInputsByRow({
  data,
  baseInputsByRow,
  manualInputsByRow,
  bulkRrppEur,
  applyBulkRrppEur = false
}: QuickSimulationInputMergeDraft): RrppSimulationInputsByRow {
  const nextInputs: RrppSimulationInputsByRow = { ...baseInputsByRow };

  if (
    applyBulkRrppEur &&
    bulkRrppEur !== undefined &&
    Number.isFinite(bulkRrppEur)
  ) {
    const countryByMarginId = new Map(
      data.operationalMargins.map((margin) => [margin.id, margin.countryCode])
    );

    for (const [key, input] of Object.entries(nextInputs)) {
      const marginId = key.split("|")[0] ?? "";
      const countryCode = countryByMarginId.get(marginId);
      nextInputs[key] = {
        ...input,
        rrppLocal: countryCode
          ? convertEurToLocalCurrency(data, countryCode, bulkRrppEur)
          : bulkRrppEur,
        rrppEur: undefined
      };
    }
  }

  return {
    ...nextInputs,
    ...manualInputsByRow
  };
}

export function buildQuickSimulationPreview(
  referenceData: ReferenceData,
  draft: QuickSimulationDraft
): QuickSimulationPreview | null {
  const countries = selectQuickCountries(referenceData, draft.countryCodes);
  const productName = draft.productName.trim();
  const category = draft.category.trim();
  const bomEur = resolveBomEur(referenceData, draft);
  const bomRmb = draft.bomRmb && draft.bomRmb > 0 ? draft.bomRmb : null;

  if (
    countries.length === 0 ||
    productName === "" ||
    category === "" ||
    draft.rrpEur <= 0 ||
    bomEur <= 0
  ) {
    return null;
  }

  const sku = normalizeSku(draft.model || buildSuggestedSku(productName));
  const product: ProductOption = {
    id: QUICK_PRODUCT_ID,
    sku,
    name: productName,
    category,
    capacity: null,
    lifecycleStatus: "UNLAUNCHED",
    launchedAt: null,
    status: "ACTIVE"
  };
  const bom: BomCostOption = {
    id: "quick-simulation-bom",
    productId: QUICK_PRODUCT_ID,
    productSku: sku,
    productName,
    bomCost: bomEur,
    bomCostRmb: bomRmb,
    currency: "EUR",
    effectiveDate: QUICK_SIMULATION_EFFECTIVE_DATE,
    status: "ACTIVE"
  };
  const rrps: ProductCountryRrpOption[] = countries.map((country) => {
    const exchangeRate = inferExchangeRateToEur(referenceData, country.code);
    return {
      id: `quick-simulation-rrp-${country.code}`,
      productId: QUICK_PRODUCT_ID,
      productSku: sku,
      productName,
      countryId: country.id,
      countryCode: country.code,
      rrpLocal: roundCurrency(draft.rrpEur * exchangeRate),
      rrpEur: roundCurrency(draft.rrpEur),
      currency: country.currency,
      effectiveDate: QUICK_SIMULATION_EFFECTIVE_DATE,
      status: "ACTIVE"
    };
  });
  const matchingMargins = referenceData.operationalMargins.filter(
    (margin) =>
      margin.status === "ACTIVE" &&
      countries.some((country) => country.code === margin.countryCode) &&
      margin.category === category &&
      matchesQuickChannelKeys(margin, draft.channelKeys)
  );
  const rrpByCountryCode = new Map(rrps.map((rrp) => [rrp.countryCode, rrp]));
  const inputsByRow = Object.fromEntries(
    matchingMargins.flatMap((margin) => {
      const rrp = rrpByCountryCode.get(margin.countryCode);
      if (!rrp) {
        return [];
      }
      return [
        [
          `${margin.id}|${QUICK_PRODUCT_ID}`,
          {
            rrppLocal: rrp.rrpLocal,
            rrppEur: rrp.rrpEur,
            kaBuyingMargin: margin.kaBuyingMargin
          }
        ]
      ];
    })
  );

  return {
    data: {
      ...referenceData,
      products: [product],
      bomCosts: [bom],
      productCountryRrps: rrps,
      operationalMargins: matchingMargins
    },
    inputsByRow,
    sku,
    rrpEur: roundCurrency(draft.rrpEur),
    bomEur,
    bomRmb
  };
}

export function buildQuickProductSetSimulationPreview(
  referenceData: ReferenceData,
  draft: QuickProductSetSimulationDraft
): QuickProductSetSimulationPreview | null {
  const countries = selectQuickCountries(referenceData, draft.countryCodes);
  const usedSkus = referenceData.products.map((product) => product.sku);
  const productPreviews = draft.products.flatMap((productDraft, index) => {
    const productName = productDraft.productName.trim();
    const category = productDraft.category.trim();
    const bomEur = resolveBomEur(referenceData, productDraft);
    const bomRmb =
      productDraft.bomRmb && productDraft.bomRmb > 0 ? productDraft.bomRmb : null;
    const simRrppEur =
      productDraft.simRrppEur && productDraft.simRrppEur > 0
        ? roundCurrency(productDraft.simRrppEur)
        : null;

    if (
      productName === "" ||
      category === "" ||
      productDraft.rrpEur <= 0 ||
      bomEur <= 0
    ) {
      return [];
    }

    const sku = uniqueSuggestedSku(
      normalizeSku(productDraft.model || buildSuggestedSku(productName)),
      usedSkus
    );
    usedSkus.push(sku);

    return [
      {
        draftId: productDraft.id,
        productId: `${QUICK_SET_PRODUCT_ID_PREFIX}-${index + 1}`,
        sku,
        productName,
        category,
        rrpEur: roundCurrency(productDraft.rrpEur),
        simRrppEur,
        bomEur,
        bomRmb
      }
    ];
  });

  if (countries.length === 0 || productPreviews.length === 0) {
    return null;
  }

  const productCategories = new Set(
    productPreviews.map((product) => product.category)
  );
  const products: ProductOption[] = productPreviews.map((product) => ({
    id: product.productId,
    sku: product.sku,
    name: product.productName,
    category: product.category,
    capacity: null,
    lifecycleStatus: "UNLAUNCHED",
    launchedAt: null,
    status: "ACTIVE"
  }));
  const bomCosts: BomCostOption[] = productPreviews.map((product) => ({
    id: `quick-simulation-bom-${product.productId}`,
    productId: product.productId,
    productSku: product.sku,
    productName: product.productName,
    bomCost: product.bomEur,
    bomCostRmb: product.bomRmb,
    currency: "EUR",
    effectiveDate: QUICK_SIMULATION_EFFECTIVE_DATE,
    status: "ACTIVE"
  }));
  const rrps: ProductCountryRrpOption[] = productPreviews.flatMap((product) =>
    countries.map((country) => {
      const exchangeRate = inferExchangeRateToEur(referenceData, country.code);
      return {
        id: `quick-simulation-rrp-${product.productId}-${country.code}`,
        productId: product.productId,
        productSku: product.sku,
        productName: product.productName,
        countryId: country.id,
        countryCode: country.code,
        rrpLocal: roundCurrency(product.rrpEur * exchangeRate),
        rrpEur: product.rrpEur,
        currency: country.currency,
        effectiveDate: QUICK_SIMULATION_EFFECTIVE_DATE,
        status: "ACTIVE" as const
      };
    })
  );
  const matchingMargins = referenceData.operationalMargins.filter(
    (margin) =>
      margin.status === "ACTIVE" &&
      countries.some((country) => country.code === margin.countryCode) &&
      productCategories.has(margin.category) &&
      matchesQuickChannelKeys(margin, draft.channelKeys)
  );
  const rrpByProductCountry = new Map(
    rrps.map((rrp) => [`${rrp.productId}|${rrp.countryCode}`, rrp])
  );
  const inputsByRow = Object.fromEntries(
    matchingMargins.flatMap((margin) =>
      productPreviews.flatMap((product) => {
        if (product.category !== margin.category) {
          return [];
        }
        const rrp = rrpByProductCountry.get(
          `${product.productId}|${margin.countryCode}`
        );
        if (!rrp) {
          return [];
        }
        const rrppEur = product.simRrppEur ?? product.rrpEur;
        const exchangeRate = inferExchangeRateToEur(
          referenceData,
          margin.countryCode
        );
        return [
          [
            `${margin.id}|${product.productId}`,
            {
              rrppLocal: roundCurrency(rrppEur * exchangeRate),
              rrppEur,
              kaBuyingMargin: margin.kaBuyingMargin
            }
          ]
        ];
      })
    )
  );

  return {
    data: {
      ...referenceData,
      products,
      bomCosts,
      productCountryRrps: rrps,
      operationalMargins: matchingMargins
    },
    inputsByRow,
    products: productPreviews
  };
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function applyManualPreviewRowOrder<T extends PreviewOrderRow>(
  rows: T[],
  manualOrder: string[]
): T[] {
  if (rows.length === 0 || manualOrder.length === 0) {
    return rows;
  }

  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const orderedKeys = new Set<string>();
  const orderedRows: T[] = [];

  for (const key of manualOrder) {
    const row = rowByKey.get(key);
    if (!row || orderedKeys.has(key)) {
      continue;
    }
    orderedKeys.add(key);
    orderedRows.push(row);
  }

  for (const row of rows) {
    if (!orderedKeys.has(row.key)) {
      orderedRows.push(row);
    }
  }

  return orderedRows;
}

export function moveManualPreviewRowOrder<T extends PreviewOrderRow>(
  rows: T[],
  manualOrder: string[],
  rowKey: string,
  direction: "up" | "down"
) {
  const orderedKeys = applyManualPreviewRowOrder(rows, manualOrder).map(
    (row) => row.key
  );
  const currentIndex = orderedKeys.indexOf(rowKey);
  if (currentIndex < 0) {
    return orderedKeys;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= orderedKeys.length) {
    return orderedKeys;
  }

  const nextKeys = [...orderedKeys];
  const [movedKey] = nextKeys.splice(currentIndex, 1);
  nextKeys.splice(nextIndex, 0, movedKey);
  return nextKeys;
}

export function dropManualPreviewRowOrder<T extends PreviewOrderRow>(
  rows: T[],
  manualOrder: string[],
  draggedRowKey: string,
  targetRowKey: string
) {
  if (draggedRowKey === targetRowKey) {
    return applyManualPreviewRowOrder(rows, manualOrder).map((row) => row.key);
  }

  const orderedKeys = applyManualPreviewRowOrder(rows, manualOrder).map(
    (row) => row.key
  );
  if (!orderedKeys.includes(draggedRowKey) || !orderedKeys.includes(targetRowKey)) {
    return orderedKeys;
  }

  const nextKeys = orderedKeys.filter((key) => key !== draggedRowKey);
  const targetIndex = nextKeys.indexOf(targetRowKey);
  nextKeys.splice(targetIndex, 0, draggedRowKey);
  return nextKeys;
}

function selectQuickCountries(referenceData: ReferenceData, countryCodes: string[]) {
  const activeCountries = referenceData.countries.filter(
    (item) => item.status === "ACTIVE"
  );
  const selectedCountryCodes = new Set(
    countryCodes.map((code) => code.toUpperCase())
  );

  return selectedCountryCodes.size === 0
    ? activeCountries
    : activeCountries.filter((country) => selectedCountryCodes.has(country.code));
}

export function quickChannelKey(countryCode: string, retailerName: string) {
  return `${countryCode}||${retailerName}`;
}

function matchesQuickChannelKeys(
  margin: { countryCode: string; retailerName: string },
  channelKeys?: string[]
) {
  const selected = new Set(
    (channelKeys ?? [])
      .map((key) => key.trim())
      .filter((key) => key !== "")
  );

  return (
    selected.size === 0 ||
    selected.has(quickChannelKey(margin.countryCode, margin.retailerName))
  );
}

function resolveBomEur(
  referenceData: ReferenceData,
  draft: Pick<QuickSimulationDraft, "bomEur" | "bomRmb">
) {
  if (draft.bomEur && draft.bomEur > 0) {
    return roundCurrency(draft.bomEur);
  }

  if (draft.bomRmb && draft.bomRmb > 0) {
    const rmbRate = inferCurrencyExchangeRateToEur(referenceData, "RMB");
    return rmbRate > 0 ? roundCurrency(draft.bomRmb / rmbRate) : 0;
  }

  return 0;
}

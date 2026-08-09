import { formatMoney, formatPercent } from "./format";
import type { PromotionPlanDealType } from "./types";

export type PromotionMapMonth = {
  year: number;
  month: number;
};

export type PromotionMapRowSource = {
  key: string;
  countryCode: string;
  channelName: string;
  fdName: string;
  model: string;
  productName: string;
  currency: string;
  promoRrpLocal: number | string;
  promoRrpEur: number | string;
  promoFrontMargin: number | string;
  dealType?: PromotionPlanDealType;
  promoVolume: number | string;
  promoStartDate: string;
  promoEndDate: string;
  promotionCalculation: {
    np: number;
    npPercent: number;
    fdMarginImpact?: number;
  } | null;
};

export type PromotionMapDay = {
  date: string;
  dayOfMonth: number;
  label: string;
};

export type PromotionMapItem = {
  key: string;
  fdName: string;
  model: string;
  productName: string;
  currency: string;
  promoRrpLocal: number | null;
  promoRrpEur: number | null;
  primaryPrice: string;
  secondaryPrice: string | null;
  promoFrontMargin: number | null;
  promoFrontMarginLabel: string;
  dealType: PromotionPlanDealType;
  dealTypeLabel: string;
  fdMarginImpactLabel: string | null;
  promoVolume: number | null;
  promoVolumeLabel: string;
  np: number | null;
  npLabel: string;
  npPercent: number | null;
  npPercentLabel: string;
};

export type PromotionMapBlock = {
  key: string;
  colorIndex: number;
  startDate: string;
  endDate: string;
  visibleStartDate: string;
  visibleEndDate: string;
  startDayIndex: number;
  spanDays: number;
  items: PromotionMapItem[];
};

export type PromotionMapGroup = {
  key: string;
  countryCode: string;
  channelName: string;
  blocks: PromotionMapBlock[];
};

export type PromotionMap = {
  days: PromotionMapDay[];
  groups: PromotionMapGroup[];
  skippedRowCount: number;
};

export type PromotionMapProductOption = {
  value: string;
  label: string;
  count: number;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

export function buildPromotionMapDays(month: PromotionMapMonth) {
  const dayCount = daysInMonth(month);
  return Array.from({ length: dayCount }, (_, index) => {
    const dayOfMonth = index + 1;
    return {
      date: isoDate(month.year, month.month, dayOfMonth),
      dayOfMonth,
      label: `${dayOfMonth}-${MONTH_LABELS[month.month - 1] ?? ""}`
    };
  });
}

export function buildPromotionMap({
  rows,
  month
}: {
  rows: PromotionMapRowSource[];
  month: PromotionMapMonth;
}): PromotionMap {
  const days = buildPromotionMapDays(month);
  const monthStartDate = days[0]?.date ?? isoDate(month.year, month.month, 1);
  const monthEndDate =
    days[days.length - 1]?.date ?? isoDate(month.year, month.month, 1);
  const groupMap = new Map<string, PromotionMapGroup>();
  const blockMap = new Map<string, PromotionMapBlock>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const startDate = normalizeDate(row.promoStartDate) ?? monthStartDate;
    const endDate = normalizeDate(row.promoEndDate) ?? monthEndDate;

    if (endDate < startDate || endDate < monthStartDate || startDate > monthEndDate) {
      skippedRowCount += 1;
      continue;
    }

    const visibleStartDate = startDate < monthStartDate ? monthStartDate : startDate;
    const visibleEndDate = endDate > monthEndDate ? monthEndDate : endDate;
    const groupKey = `${row.countryCode}||${row.channelName}`;
    const blockKey = `${groupKey}||${visibleStartDate}||${visibleEndDate}`;
    const group =
      groupMap.get(groupKey) ??
      createGroup(groupMap, groupKey, row.countryCode, row.channelName);
    const block =
      blockMap.get(blockKey) ??
      createBlock({
        blockMap,
        group,
        groupKey,
        blockKey,
        startDate,
        endDate,
        visibleStartDate,
        visibleEndDate,
        monthStartDate
      });

    block.items.push(buildPromotionMapItem(row));
  }

  const groups = [...groupMap.values()]
    .map((group) => ({
      ...group,
      blocks: group.blocks
        .map((block) => ({
          ...block,
          items: block.items.sort(compareMapItems)
        }))
        .sort(compareMapBlocks)
    }))
    .sort(compareMapGroups);

  groups.forEach((group, groupIndex) => {
    group.blocks.forEach((block, blockIndex) => {
      block.colorIndex = (groupIndex + blockIndex) % 6;
    });
  });

  return {
    days,
    groups,
    skippedRowCount
  };
}

export function buildPromotionMapProductOptions(
  rows: PromotionMapRowSource[]
): PromotionMapProductOption[] {
  const optionMap = new Map<
    string,
    {
      productName: string;
      count: number;
    }
  >();

  for (const row of rows) {
    const value = productFilterKey(row);
    const current = optionMap.get(value);

    if (current) {
      current.count += 1;
      continue;
    }

    optionMap.set(value, {
      productName: row.productName,
      count: 1
    });
  }

  return [...optionMap.entries()]
    .map(([value, option]) => ({
      value,
      label: `${option.productName} · ${value}`,
      count: option.count
    }))
    .sort(
      (a, b) =>
        a.value.localeCompare(b.value) || a.label.localeCompare(b.label)
    );
}

export function filterPromotionMapRowsByProduct(
  rows: PromotionMapRowSource[],
  productFilters: string[]
) {
  const selectedProducts = new Set(productFilters.filter(Boolean));

  if (selectedProducts.size === 0) {
    return rows;
  }

  return rows.filter((row) => selectedProducts.has(productFilterKey(row)));
}

function createGroup(
  groupMap: Map<string, PromotionMapGroup>,
  key: string,
  countryCode: string,
  channelName: string
) {
  const group = {
    key,
    countryCode,
    channelName,
    blocks: []
  };
  groupMap.set(key, group);
  return group;
}

function createBlock({
  blockMap,
  group,
  groupKey,
  blockKey,
  startDate,
  endDate,
  visibleStartDate,
  visibleEndDate,
  monthStartDate
}: {
  blockMap: Map<string, PromotionMapBlock>;
  group: PromotionMapGroup;
  groupKey: string;
  blockKey: string;
  startDate: string;
  endDate: string;
  visibleStartDate: string;
  visibleEndDate: string;
  monthStartDate: string;
}) {
  const startDayIndex = daysBetween(monthStartDate, visibleStartDate);
  const spanDays = daysBetween(visibleStartDate, visibleEndDate) + 1;
  const block = {
    key: blockKey,
    colorIndex: 0,
    startDate,
    endDate,
    visibleStartDate,
    visibleEndDate,
    startDayIndex,
    spanDays,
    items: []
  };

  blockMap.set(blockKey, block);
  group.blocks.push(block);
  return block;
}

function buildPromotionMapItem(row: PromotionMapRowSource): PromotionMapItem {
  const promoRrpLocal = parseDisplayNumber(row.promoRrpLocal);
  const promoRrpEur = parseDisplayNumber(row.promoRrpEur);
  const promoFrontMargin = parseDisplayNumber(row.promoFrontMargin);
  const promoVolume = parseDisplayNumber(row.promoVolume);
  const currency = row.currency || "EUR";
  const isLocalCurrencyPrimary = currency !== "EUR";
  const primaryValue = isLocalCurrencyPrimary ? promoRrpLocal : promoRrpEur;
  const primaryCurrency = isLocalCurrencyPrimary ? currency : "EUR";
  const secondaryValue = isLocalCurrencyPrimary ? promoRrpEur : null;

  return {
    key: row.key,
    fdName: row.fdName,
    model: row.model,
    productName: row.productName,
    currency,
    promoRrpLocal,
    promoRrpEur,
    primaryPrice:
      primaryValue === null ? "-" : normalizeCurrencyLabel(formatMoney(primaryValue, primaryCurrency)),
    secondaryPrice:
      secondaryValue === null
        ? null
        : normalizeCurrencyLabel(formatMoney(secondaryValue, "EUR")),
    promoFrontMargin,
    promoFrontMarginLabel:
      promoFrontMargin === null ? "-" : formatPercent(promoFrontMargin),
    dealType: row.dealType ?? "NORMAL",
    dealTypeLabel: dealTypeLabel(row.dealType ?? "NORMAL"),
    fdMarginImpactLabel:
      row.promotionCalculation?.fdMarginImpact === undefined ||
      row.promotionCalculation?.fdMarginImpact === null ||
      Math.abs(row.promotionCalculation.fdMarginImpact) < 0.000001
        ? null
        : normalizeCurrencyLabel(
            formatMoney(row.promotionCalculation.fdMarginImpact, "EUR")
          ),
    promoVolume,
    promoVolumeLabel:
      promoVolume === null
        ? "-"
        : new Intl.NumberFormat("en-GB", {
            maximumFractionDigits: 0
          }).format(promoVolume),
    np: row.promotionCalculation?.np ?? null,
    npLabel:
      row.promotionCalculation?.np === undefined ||
      row.promotionCalculation?.np === null
        ? "-"
        : normalizeCurrencyLabel(formatMoney(row.promotionCalculation.np, "EUR")),
    npPercent: row.promotionCalculation?.npPercent ?? null,
    npPercentLabel:
      row.promotionCalculation?.npPercent === undefined ||
      row.promotionCalculation?.npPercent === null
        ? "-"
        : formatPercent(row.promotionCalculation.npPercent)
  };
}

function dealTypeLabel(dealType: PromotionPlanDealType) {
  if (dealType === "B2B_DEAL") {
    return "B2B Deal";
  }

  if (dealType === "EOL_DEAL") {
    return "EOL Deal";
  }

  return "Normal Promo";
}

function productFilterKey(row: PromotionMapRowSource) {
  const model = row.model.trim();

  return model || row.productName.trim() || row.key;
}

function daysInMonth(month: PromotionMapMonth) {
  return new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const normalized = date.toISOString().slice(0, 10);

  return normalized === value ? value : null;
}

function daysBetween(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function parseDisplayNumber(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrencyLabel(value: string) {
  return value.replace(/\s+/g, " ");
}

function compareMapGroups(a: PromotionMapGroup, b: PromotionMapGroup) {
  return (
    a.countryCode.localeCompare(b.countryCode) ||
    a.channelName.localeCompare(b.channelName)
  );
}

function compareMapBlocks(a: PromotionMapBlock, b: PromotionMapBlock) {
  return (
    a.startDayIndex - b.startDayIndex ||
    a.spanDays - b.spanDays ||
    a.key.localeCompare(b.key)
  );
}

function compareMapItems(a: PromotionMapItem, b: PromotionMapItem) {
  return (
    a.model.localeCompare(b.model) || a.productName.localeCompare(b.productName)
  );
}

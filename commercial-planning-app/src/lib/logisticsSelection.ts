import type { LogisticsCostOption } from "./types";

export type LogisticsSelectionStatus =
  | "MATCHED"
  | "MISSING"
  | "AMBIGUOUS_MISSING_CAPACITY";

export type LogisticsSelection = {
  status: LogisticsSelectionStatus;
  logisticsCost: LogisticsCostOption | null;
  message: string | null;
};

type SelectLogisticsCostInput = {
  logisticsCosts: LogisticsCostOption[];
  countryId: string;
  category: string | null | undefined;
  productCapacity: string | null | undefined;
  incoterms?: string | null | undefined;
};

export function selectLogisticsCost({
  logisticsCosts,
  countryId,
  category,
  productCapacity,
  incoterms
}: SelectLogisticsCostInput): LogisticsSelection {
  const normalizedCategory = category?.trim() ?? "";
  const normalizedCapacity = productCapacity?.trim() ?? "";
  const normalizedIncoterms = incoterms?.trim().toUpperCase() ?? "";
  const countryCategoryRows = logisticsCosts.filter(
    (cost) =>
      cost.countryId === countryId && cost.category === normalizedCategory
  );

  if (normalizedIncoterms) {
    const incotermsMatch =
      countryCategoryRows.find(
        (cost) => cost.productSize.trim().toUpperCase() === normalizedIncoterms
      ) ?? null;

    if (incotermsMatch) {
      return matched(incotermsMatch);
    }
  }

  if (normalizedCapacity) {
    const exactMatch =
      countryCategoryRows.find(
        (cost) => cost.productSize === normalizedCapacity
      ) ?? null;

    return exactMatch
      ? matched(exactMatch)
      : missing(
          `No logistics cost found for ${normalizedCategory || "this category"} with product size ${normalizedCapacity}. Add master data or provide an override reason.`
        );
  }

  if (countryCategoryRows.length === 1) {
    return matched(countryCategoryRows[0]);
  }

  if (countryCategoryRows.length === 0) {
    return missing(
      `No logistics cost found for ${normalizedCategory || "this category"} in the selected country. Add master data or provide an override reason.`
    );
  }

  return {
    status: "AMBIGUOUS_MISSING_CAPACITY",
    logisticsCost: null,
    message:
      "Product capacity is missing, and multiple logistics sizes match this country and category. Set product capacity or provide an override reason."
  };
}

function matched(logisticsCost: LogisticsCostOption): LogisticsSelection {
  return {
    status: "MATCHED",
    logisticsCost,
    message: null
  };
}

function missing(message: string): LogisticsSelection {
  return {
    status: "MISSING",
    logisticsCost: null,
    message
  };
}

export type PromotionPlanMonthLike = {
  year: number;
  month: number;
};

export function defaultPromotionPlanPeriod({
  year,
  month
}: PromotionPlanMonthLike) {
  return {
    startDate: normalizedIsoDate(year, month, 1) ?? "",
    endDate: normalizedIsoDate(year, month, daysInMonth(year, month)) ?? ""
  };
}

export function normalizePromotionPlanPeriod({
  month,
  promoStartDate,
  promoEndDate,
  treatInvalidAsBlank = false
}: {
  month: PromotionPlanMonthLike;
  promoStartDate: number | string | null | undefined;
  promoEndDate: number | string | null | undefined;
  treatInvalidAsBlank?: boolean;
}):
  | { promoStartDate: string; promoEndDate: string }
  | { error: string } {
  const startDate = parseNullablePromotionDate(promoStartDate, treatInvalidAsBlank);
  const endDate = parseNullablePromotionDate(promoEndDate, treatInvalidAsBlank);

  if (startDate.error || endDate.error) {
    return { error: "Invalid promo date. Use DD/MM/YYYY." };
  }

  const defaults = defaultPromotionPlanPeriod(month);
  const promoStart = startDate.date ?? defaults.startDate;
  const promoEnd = endDate.date ?? defaults.endDate;
  const periodError = validatePromotionDateRange(promoStart, promoEnd);

  return periodError
    ? { error: periodError }
    : { promoStartDate: promoStart, promoEndDate: promoEnd };
}

export function parsePromotionDateInput(
  value: number | string | null | undefined
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialDateToIsoDate(value);
  }

  const trimmedValue = String(value ?? "").trim();
  if (trimmedValue === "") {
    return null;
  }

  const isoMatch = trimmedValue.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return normalizedIsoDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
  }

  const europeanMatch = trimmedValue.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (europeanMatch) {
    return normalizedIsoDate(
      Number(europeanMatch[3]),
      Number(europeanMatch[2]),
      Number(europeanMatch[1])
    );
  }

  const serialNumber = Number(trimmedValue);
  if (Number.isFinite(serialNumber) && serialNumber > 0) {
    return excelSerialDateToIsoDate(serialNumber);
  }

  return null;
}

export function validatePromotionDateRange(
  promoStartDate: string | null | undefined,
  promoEndDate: string | null | undefined
) {
  if (!promoStartDate || !promoEndDate) {
    return null;
  }

  // A plan is assigned by its worksheet/month, so a promotion can run over a
  // month boundary. Only invalid chronological ranges are rejected here.
  return promoEndDate < promoStartDate
    ? "Promo End Date cannot be earlier than Promo Start Date."
    : null;
}

export function retargetPromotionDateToMonth(
  value: number | string | null | undefined,
  targetMonth: PromotionPlanMonthLike
) {
  const sourceDate = parsePromotionDateInput(value);
  if (!sourceDate || isPlaceholderPromotionDate(sourceDate)) {
    return null;
  }

  const sourceDay = Number(sourceDate.slice(8, 10));
  const targetDay = Math.min(sourceDay, daysInMonth(targetMonth.year, targetMonth.month));
  return normalizedIsoDate(targetMonth.year, targetMonth.month, targetDay);
}

function parseNullablePromotionDate(
  value: number | string | null | undefined,
  treatInvalidAsBlank: boolean
): { date: string | null; error?: string } {
  const hasValue = String(value ?? "").trim() !== "";
  if (!hasValue) {
    return { date: null };
  }

  const date = parsePromotionDateInput(value);
  if (!date) {
    return treatInvalidAsBlank
      ? { date: null }
      : { date: null, error: "Invalid promo date. Use DD/MM/YYYY." };
  }

  return isPlaceholderPromotionDate(date) ? { date: null } : { date };
}

function isPlaceholderPromotionDate(date: string) {
  return /^1900-/.test(date);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function excelSerialDateToIsoDate(serialNumber: number) {
  const timestamp = Math.round((serialNumber - 25569) * 86400 * 1000);
  return new Date(timestamp).toISOString().slice(0, 10);
}

function normalizedIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import type { CalculatorFilters } from "@/lib/calculatorRows";
import {
  getPromotionPlanEntriesForMonths,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  buildPromotionPlanWorkbookBuffer,
  promotionPlanFileName,
  promotionPlanMonthKey,
  parsePromotionPlanMonthKey
} from "@/lib/promotionPlan";
import {
  canDownloadPromotionPlanHistory,
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  isPromotionPlanDeadlineLocked
} from "@/lib/promotionPlanAccess";
import { canViewAllCountries } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const now = new Date();
  const planYear =
    toPlanYear(request.nextUrl.searchParams.get("year")) ?? now.getFullYear();
  const planMonth =
    toPlanMonth(request.nextUrl.searchParams.get("month")) ?? now.getMonth() + 1;
  const months = parseExportMonths(
    request.nextUrl.searchParams.get("months"),
    { year: planYear, month: planMonth }
  );
  const filters = parseFilters(request.nextUrl.searchParams.get("filters"));
  const [data, countryAccesses] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    countryAccesses,
    data.countries
  );
  const canSeeAllCountries = canViewAllCountries(effectiveRole);
  if (!canDownloadPromotionPlanHistory(effectiveRole, accessibleCountryCodes)) {
    return NextResponse.json(
      { message: "No country access has been assigned for your account." },
      { status: 403 }
    );
  }
  const exportData =
    canSeeAllCountries
      ? data
      : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  const entries = await getPromotionPlanEntriesForMonths(
    months,
    canSeeAllCountries ? undefined : accessibleCountryCodes
  );
  const lockedCountryCodesByMonth = await getLockedCountryCodesByMonth({
    months,
    countryCodes: exportData.countries.map((country) => country.code)
  });
  const workbook = buildPromotionPlanWorkbookBuffer({
    data: exportData,
    entries,
    months,
    filters,
    lockedCountryCodesByMonth
  });
  const sourceReference = months.map(promotionPlanMonthKey).join("_");

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${promotionPlanFileName(
        "promotion-plan",
        sourceReference
      )}"`,
      "Cache-Control": "no-store"
    }
  });
}

async function getLockedCountryCodesByMonth({
  months,
  countryCodes
}: {
  months: Array<{ year: number; month: number }>;
  countryCodes: string[];
}) {
  const lockedByMonth: Record<string, string[]> = {};

  await Promise.all(
    months.map(async (month) => {
      const monthKey = promotionPlanMonthKey(month);
      const statuses = await getPromotionPlanMonthStatuses({
        planYear: month.year,
        planMonth: month.month,
        countryCodes
      });
      const approvedCountries = new Set(
        statuses
          .filter((status) => status.status === "APPROVED")
          .map((status) => status.countryCode)
      );
      const deadlineLocked = isPromotionPlanDeadlineLocked({
        planYear: month.year,
        planMonth: month.month
      });

      lockedByMonth[monthKey] = countryCodes.filter(
        (countryCode) => deadlineLocked || approvedCountries.has(countryCode)
      );
    })
  );

  return lockedByMonth;
}

function parseExportMonths(
  value: string | null,
  fallback: { year: number; month: number }
) {
  if (!value) {
    return [fallback];
  }

  const months = value
    .split(",")
    .map((monthKey) => parsePromotionPlanMonthKey(monthKey))
    .filter((month): month is { year: number; month: number } => month !== null);
  return months.length > 0 ? months : [fallback];
}

function parseFilters(value: string | null): CalculatorFilters {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Partial<CalculatorFilters>;
    return {
      countryCode: normalizedFilter(parsed.countryCode),
      channelName: normalizedFilter(parsed.channelName),
      retailerName: normalizedFilter(parsed.retailerName),
      fdName: normalizedFilter(parsed.fdName),
      model: normalizedFilter(parsed.model),
      category: normalizedFilter(parsed.category),
      productName: normalizedFilter(parsed.productName),
      kaBuyingMargin: normalizedNumberFilter(parsed.kaBuyingMargin)
    };
  } catch {
    return {};
  }
}

function normalizedFilter(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function normalizedNumberFilter(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isFinite);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toPlanMonth(value: unknown) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

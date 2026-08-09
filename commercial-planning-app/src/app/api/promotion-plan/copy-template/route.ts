import { NextResponse, type NextRequest } from "next/server";
import type { CalculatorFilters } from "@/lib/calculatorRows";
import { canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  getPromotionPlanEntries,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  promotionPlanFileName,
  promotionPlanMonthKey,
  parsePromotionPlanMonthKey
} from "@/lib/promotionPlan";
import { buildPromotionPlanCopyTemplateWorkbookBuffer } from "@/lib/promotionPlanCopy";
import {
  canDownloadPromotionPlanHistory,
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const source = parsePromotionPlanMonthKey(
    request.nextUrl.searchParams.get("source") ?? ""
  );
  const target = parsePromotionPlanMonthKey(
    request.nextUrl.searchParams.get("target") ?? ""
  );

  if (!source || !target) {
    return NextResponse.json(
      { message: "Choose valid source and target months." },
      { status: 400 }
    );
  }

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

  const visibleCountryCodes =
    canSeeAllCountries
      ? data.countries.map((country) => country.code)
      : accessibleCountryCodes;
  const visibleData =
    canSeeAllCountries
      ? data
      : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  const [sourceEntries, targetStatuses] = await Promise.all([
    getPromotionPlanEntries(source.year, source.month, visibleCountryCodes),
    getPromotionPlanMonthStatuses({
      planYear: target.year,
      planMonth: target.month,
      countryCodes: visibleCountryCodes
    })
  ]);
  const scopedCountryCodes = selectedTemplateCountryCodes(
    filters.countryCode,
    visibleCountryCodes
  );
  const scopedCountrySet = new Set(scopedCountryCodes);
  const scopedSourceEntries = sourceEntries.filter((entry) =>
    scopedCountrySet.has(entry.countryCode.toUpperCase())
  );

  if (scopedSourceEntries.length === 0) {
    return NextResponse.json(
      {
        message: `No promotion history was found in ${promotionPlanMonthKey(source)} for the selected country scope.`
      },
      { status: 404 }
    );
  }

  const templateCountryCodes = Array.from(
    new Set(scopedSourceEntries.map((entry) => entry.countryCode.toUpperCase()))
  );
  const workbook = buildPromotionPlanCopyTemplateWorkbookBuffer({
    data: filterReferenceDataByCountryCodes(visibleData, templateCountryCodes),
    sourceEntries: scopedSourceEntries,
    targetMonth: target,
    targetStatuses: targetStatuses.filter((status) =>
      templateCountryCodes.includes(status.countryCode.toUpperCase())
    ),
    accessibleCountryCodes,
    role: effectiveRole
  });
  const sourceReference = `${promotionPlanMonthKey(source)}-to-${promotionPlanMonthKey(
    target
  )}`;

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${promotionPlanFileName(
        "promotion-plan-copy-template",
        sourceReference
      )}"`,
      "Cache-Control": "no-store"
    }
  });
}

function selectedTemplateCountryCodes(
  countryFilter: CalculatorFilters["countryCode"],
  visibleCountryCodes: string[]
) {
  const selectedCountryCodes = Array.isArray(countryFilter)
    ? countryFilter
    : countryFilter
      ? [countryFilter]
      : [];
  const selectedCountrySet = new Set(
    selectedCountryCodes.map((countryCode) => countryCode.trim().toUpperCase())
  );

  return selectedCountrySet.size === 0
    ? visibleCountryCodes.map((countryCode) => countryCode.toUpperCase())
    : visibleCountryCodes
        .map((countryCode) => countryCode.toUpperCase())
        .filter((countryCode) => selectedCountrySet.has(countryCode));
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

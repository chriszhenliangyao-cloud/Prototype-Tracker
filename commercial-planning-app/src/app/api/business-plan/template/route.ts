import { NextResponse, type NextRequest } from "next/server";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  buildBusinessPlanTemplateWorkbookBuffer,
  businessPlanFileName
} from "@/lib/businessPlanWorkbook";
import {
  getBusinessPlanChannelProfiles,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  hasPromotionCountryAccess
} from "@/lib/promotionPlanAccess";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const [data, countryAccesses] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  if (!canSaveScenario(effectiveRole)) {
    return NextResponse.json(
      { message: "You do not have BP access." },
      { status: 403 }
    );
  }

  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    countryAccesses,
    data.countries
  );
  const visibleData =
    canViewAllCountries(effectiveRole)
      ? data
      : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  if (!canViewAllCountries(effectiveRole) && accessibleCountryCodes.length === 0) {
    return NextResponse.json(
      { message: "No country access has been assigned for your account." },
      { status: 403 }
    );
  }

  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(requestedYear)
    ? requestedYear
    : new Date().getFullYear();
  const requestedCountry = toCountryCode(
    request.nextUrl.searchParams.get("country")
  );
  const templateData = requestedCountry
    ? filterReferenceDataByCountryCodes(visibleData, [requestedCountry])
    : visibleData;

  if (
    requestedCountry &&
    !hasPromotionCountryAccess(
      effectiveRole,
      requestedCountry,
      accessibleCountryCodes
    )
  ) {
    return NextResponse.json(
      { message: "You do not have access to this BP country." },
      { status: 403 }
    );
  }
  if (requestedCountry && templateData.countries.length === 0) {
    return NextResponse.json(
      { message: "The selected country is not available in Master Data." },
      { status: 404 }
    );
  }

  const channelProfiles = await getBusinessPlanChannelProfiles(
    year,
    requestedCountry
      ? [requestedCountry]
      : templateData.countries.map((country) => country.code)
  );
  const workbook = buildBusinessPlanTemplateWorkbookBuffer({
    channelProfiles,
    data: templateData,
    year
  });

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${businessPlanFileName(
        "business-plan-input-template",
        requestedCountry ? `${year}-${requestedCountry}` : String(year)
      )}"`,
      "Cache-Control": "no-store"
    }
  });
}

function toCountryCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{2,5}$/.test(code) ? code : null;
}

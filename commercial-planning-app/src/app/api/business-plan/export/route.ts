import { NextResponse, type NextRequest } from "next/server";
import { canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  buildBusinessPlanSavedWorkbookBuffer,
  businessPlanFileName
} from "@/lib/businessPlanWorkbook";
import {
  getBusinessPlanChannelProfiles,
  getBusinessPlanEntries,
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

  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(requestedYear)
    ? requestedYear
    : new Date().getFullYear();
  const countryCode = toCountryCode(request.nextUrl.searchParams.get("country"));
  if (!countryCode) {
    return NextResponse.json(
      { message: "Choose a BP country before export." },
      { status: 400 }
    );
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
  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    countryAccesses,
    data.countries
  );

  if (!canViewAllCountries(effectiveRole) && accessibleCountryCodes.length === 0) {
    return NextResponse.json(
      { message: "No country access has been assigned for your account." },
      { status: 403 }
    );
  }
  if (
    !hasPromotionCountryAccess(effectiveRole, countryCode, accessibleCountryCodes)
  ) {
    return NextResponse.json(
      { message: "You do not have access to this BP country." },
      { status: 403 }
    );
  }

  const exportData = filterReferenceDataByCountryCodes(data, [countryCode]);
  if (exportData.countries.length === 0) {
    return NextResponse.json(
      { message: "The selected country is not available in Master Data." },
      { status: 404 }
    );
  }

  const [entries, channelProfiles] = await Promise.all([
    getBusinessPlanEntries(year, [countryCode]),
    getBusinessPlanChannelProfiles(year, [countryCode])
  ]);
  const workbook = buildBusinessPlanSavedWorkbookBuffer({
    channelProfiles,
    data: exportData,
    entries,
    year
  });

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${businessPlanFileName(
        "business-plan-saved",
        `${year}-${countryCode}`
      )}"`,
      "Cache-Control": "no-store"
    }
  });
}

function toCountryCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{2,5}$/.test(code) ? code : null;
}

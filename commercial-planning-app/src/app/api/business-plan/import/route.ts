import { NextResponse, type NextRequest } from "next/server";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { parseBusinessPlanWorkbook } from "@/lib/businessPlanWorkbook";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import {
  readWorkbookSheetNames,
  readWorksheetRows,
  type XlsxRow
} from "@/lib/imports/xlsxLite";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  hasPromotionCountryAccess
} from "@/lib/promotionPlanAccess";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!isUploadedWorkbookFile(file) || file.size === 0) {
    return NextResponse.json({ message: "Upload an .xlsx file." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { message: "Only .xlsx files are supported." },
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
  const requestedCountry = toCountryCode(
    request.nextUrl.searchParams.get("country")
  );
  const parseData = requestedCountry
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
  if (requestedCountry && parseData.countries.length === 0) {
    return NextResponse.json(
      { message: "The selected country is not available in Master Data." },
      { status: 404 }
    );
  }

  try {
    const workbookBuffer = Buffer.from(await file.arrayBuffer());
    const workbookCountryCodes = readBusinessPlanWorkbookCountryCodes(
      workbookBuffer
    );
    if (
      requestedCountry &&
      workbookCountryCodes.length > 0 &&
      !workbookCountryCodes.includes(requestedCountry)
    ) {
      const workbookCountryLabel = workbookCountryCodes.join(", ");
      return NextResponse.json(
        {
          status: "error",
          message: `This workbook is for ${workbookCountryLabel}, but the current BP page is ${requestedCountry}. Switch the BP Country to ${workbookCountryLabel} before uploading this file.`,
          imported: 0,
          skipped: 1,
          errors: [
            {
              sheetName: "Workbook",
              rowNumber: 1,
              message: `Workbook country ${workbookCountryLabel} does not match selected BP country ${requestedCountry}.`
            }
          ],
          channelProfiles: []
        },
        { status: 400 }
      );
    }

    const result = parseBusinessPlanWorkbook(workbookBuffer, parseData);

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "No valid BP rows were imported.",
          imported: 0,
          skipped: result.errors.length,
          errors: result.errors,
          channelProfiles: result.channelProfiles
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: `${result.rows.length} BP row(s) imported.`,
      imported: result.rows.length,
      skipped: result.errors.length,
      errors: result.errors,
      channelProfiles: result.channelProfiles,
      rows: result.rows
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to parse the uploaded BP workbook.",
        imported: 0,
        skipped: 1,
        errors: []
      },
      { status: 400 }
    );
  }
}

function toCountryCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{2,5}$/.test(code) ? code : null;
}

function isUploadedWorkbookFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "arrayBuffer" in value &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.arrayBuffer === "function"
  );
}

function readBusinessPlanWorkbookCountryCodes(workbook: Buffer) {
  const countryCodes = new Set<string>();
  const sheetNames = new Set(readWorkbookSheetNames(workbook));

  for (const sheetName of ["BP Input", "BP Master Data"]) {
    if (!sheetNames.has(sheetName)) {
      continue;
    }

    for (const code of readCountryCodesFromRows(readWorksheetRows(workbook, sheetName))) {
      countryCodes.add(code);
    }
  }

  return [...countryCodes].sort();
}

function readCountryCodesFromRows(rows: XlsxRow[]) {
  const header = rows[0]?.cells ?? [];
  const countryIndex = header.findIndex(
    (cell) => cell.trim().toLowerCase() === "country"
  );
  if (countryIndex < 0) {
    return [];
  }

  return rows
    .slice(1)
    .map((row) => row.cells[countryIndex]?.trim().toUpperCase() ?? "")
    .filter((code) => /^[A-Z0-9]{2,5}$/.test(code));
}

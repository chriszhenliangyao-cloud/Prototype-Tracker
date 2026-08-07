import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { parseBusinessPlanActualWorkbook } from "@/lib/businessPlanActuals";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import {
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const planYear = toPlanYear(request.nextUrl.searchParams.get("year"));
  if (!planYear) {
    return NextResponse.json({ message: "Choose a valid BP year." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!isWorkbookFile(file) || file.size === 0) {
    return NextResponse.json({ message: "Choose a PO workbook first." }, { status: 400 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json(
      { message: "Upload an .xls or .xlsx PO workbook." },
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
      { message: "You do not have permission to import PO actuals." },
      { status: 403 }
    );
  }

  try {
    const parsed = parseBusinessPlanActualWorkbook(
      Buffer.from(await file.arrayBuffer())
    );
    const errors = [...parsed.errors];
    const masterCountries = new Set(data.countries.map((country) => country.code));
    const visibleCountries = new Set(
      canViewAllCountries(effectiveRole)
        ? data.countries.map((country) => country.code)
        : getAccessibleCountryCodes(
            effectiveRole,
            session.email,
            countryAccesses,
            data.countries
          )
    );
    const rowsForYear = parsed.rows.filter((row) => {
      if (row.planYear === planYear) {
        return true;
      }
      errors.push({
        sheetName: "By PO",
        rowNumber: sourceRowNumber(row.sourceLineKey),
        message: `PO Date belongs to ${row.planYear}, not the selected BP year ${planYear}.`
      });
      return false;
    });
    const validRows = rowsForYear.filter((row) => {
      if (!masterCountries.has(row.countryCode)) {
        errors.push({
          sheetName: "By PO",
          rowNumber: sourceRowNumber(row.sourceLineKey),
          message: `${row.countryCode} is not an active country in Master Data.`
        });
        return false;
      }
      if (!visibleCountries.has(row.countryCode)) {
        errors.push({
          sheetName: "By PO",
          rowNumber: sourceRowNumber(row.sourceLineKey),
          message: `You do not have access to import actuals for ${row.countryCode}.`
        });
        return false;
      }
      return true;
    });

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "No valid PO actual rows were imported.",
          imported: 0,
          skipped: errors.length,
          errors
        },
        { status: 400 }
      );
    }

    const replacementScopes = uniqueScopes(validRows);
    const importedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        replacementScopes.map((scope) =>
          tx.businessPlanActualEntry.deleteMany({
            where: {
              planYear,
              planMonth: scope.planMonth,
              countryCode: scope.countryCode
            }
          })
        )
      );
      await tx.businessPlanActualEntry.createMany({
        data: validRows.map((row) => ({
          planYear: row.planYear,
          planMonth: row.planMonth,
          countryCode: row.countryCode,
          customerName: row.customerName,
          poNumber: row.poNumber,
          poDate: row.poDate,
          productModel: row.productModel,
          productName: row.productName,
          sourceLineKey: row.sourceLineKey,
          siUnits: String(row.siUnits),
          siValueEur: String(row.siValueEur),
          sourceFileName: file.name,
          importedByEmail: session.email,
          importedAt
        }))
      });
    });

    revalidatePath("/business-plan");
    revalidatePath("/platform/business/bp");
    return NextResponse.json({
      status: "success",
      message: `${validRows.length} PO actual row(s) imported. ${replacementScopes.length} country-month scope(s) were replaced using PO Date for the month.`,
      imported: validRows.length,
      skipped: errors.length,
      errors,
      countryCodes: [...new Set(validRows.map((row) => row.countryCode))].sort(),
      months: replacementScopes.map((scope) => `${scope.countryCode}-${String(scope.planMonth).padStart(2, "0")}`)
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to read the PO workbook.",
        imported: 0,
        skipped: 1,
        errors: []
      },
      { status: 400 }
    );
  }
}

function toPlanYear(value: string | null) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function isWorkbookFile(value: FormDataEntryValue | null): value is File {
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

function uniqueScopes(
  rows: Array<{ countryCode: string; planMonth: number }>
) {
  const scopes = new Map<string, { countryCode: string; planMonth: number }>();
  for (const row of rows) {
    scopes.set(`${row.countryCode}|${row.planMonth}`, {
      countryCode: row.countryCode,
      planMonth: row.planMonth
    });
  }
  return [...scopes.values()];
}

function sourceRowNumber(sourceLineKey: string) {
  const rowNumber = Number(sourceLineKey.split("|").at(-1));
  return Number.isInteger(rowNumber) && rowNumber > 0 ? rowNumber : 0;
}

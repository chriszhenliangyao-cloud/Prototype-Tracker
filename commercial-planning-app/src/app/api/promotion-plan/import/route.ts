import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  getPromotionPlanEntriesForMonths,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import { buildNormalRows } from "@/lib/calculatorRows";
import {
  buildPromotionPlanWorkbookBuffer,
  promotionPlanBusinessKeyForRow,
  parsePromotionPlanMonthKey,
  parsePromotionPlanWorkbook,
  promotionPlanMonthKey,
  promotionPlanWorkbookTargetMonthMessage,
  promotionPlanSnapshotForRow
} from "@/lib/promotionPlan";
import { createPromotionPlanArchive } from "@/lib/promotionPlanArchive";
import { readWorkbookSheetNames } from "@/lib/imports/xlsxLite";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  getPromotionPlanEditState,
  hasPromotionCountryAccess,
  isPromotionPlanDeadlineLocked
} from "@/lib/promotionPlanAccess";
import { prisma } from "@/lib/prisma";
import {
  findPromotionPlanPeriodOverlap,
  promotionPlanPeriodOverlapMessage
} from "@/lib/promotionPlanPeriods";

type UploadedWorkbookFile = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

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

  const data = await getReferenceData();
  const countryAccesses = await getUserCountryAccesses();
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  if (!canSaveScenario(effectiveRole)) {
    return NextResponse.json(
      { message: "You do not have Promotion Plan access." },
      { status: 403 }
    );
  }
  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    countryAccesses,
    data.countries
  );
  const canSeeAllCountries = canViewAllCountries(effectiveRole);
  if (!canSeeAllCountries && accessibleCountryCodes.length === 0) {
    return NextResponse.json(
      { message: "No country access has been assigned for your account." },
      { status: 403 }
    );
  }

  const workbookBuffer = Buffer.from(await file.arrayBuffer());
  const workbookMonths = readWorkbookSheetNames(workbookBuffer)
    .map(parsePromotionPlanMonthKey)
    .filter((month): month is { year: number; month: number } => month !== null);
  const targetMonthMessage = promotionPlanWorkbookTargetMonthMessage({
    workbookMonths,
    targetMonth: requestedTargetMonth(formData)
  });
  if (targetMonthMessage) {
    return NextResponse.json(
      {
        status: "error",
        message: "No promotion plan rows were imported.",
        imported: 0,
        skipped: 0,
        errors: [
          {
            sheetName: promotionPlanMonthKey(workbookMonths[0]),
            rowNumber: 1,
            message: targetMonthMessage
          }
        ]
      },
      { status: 400 }
    );
  }
  const existingEntries = await getPromotionPlanEntriesForMonths(
    workbookMonths,
    canSeeAllCountries ? undefined : accessibleCountryCodes
  );
  const parsed = parsePromotionPlanWorkbook(workbookBuffer, data, existingEntries);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        status: "error",
        message: "No valid promotion plan rows were imported.",
        imported: 0,
        skipped: parsed.errors.length,
        errors: parsed.errors
      },
      { status: 400 }
    );
  }

  const months = parsed.monthKeys
    .map(parsePromotionPlanMonthKey)
    .filter((month): month is { year: number; month: number } => month !== null);
  const monthStatusRows = (
    await Promise.all(
      months.map((month) =>
        getPromotionPlanMonthStatuses({
          planYear: month.year,
          planMonth: month.month
        })
      )
    )
  ).flat();
  const statusByMonthCountry = new Map(
    monthStatusRows.map((status) => [
      `${promotionPlanMonthKey({
        year: status.planYear,
        month: status.planMonth
      })}|${status.countryCode}`,
      status.status
    ])
  );
  const baseRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const baseRowsByKey = new Map(
    baseRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const skippedErrors = [...parsed.errors];
  const importableRows: Array<{
    row: (typeof parsed.rows)[number];
    baseRow: (typeof baseRows)[number];
  }> = [];

  for (const row of parsed.rows) {
    const editState = getPromotionPlanEditState({
      role: effectiveRole,
      hasCountryAccess: hasPromotionCountryAccess(
        effectiveRole,
        row.countryCode,
        accessibleCountryCodes
      ),
      planYear: row.year,
      planMonth: row.month,
      status:
        statusByMonthCountry.get(
          `${promotionPlanMonthKey(row)}|${row.countryCode}`
        ) ?? "DRAFT"
    });
    if (!editState.editable) {
      skippedErrors.push({
        sheetName: promotionPlanMonthKey(row),
        rowNumber: 0,
        message: `${row.countryCode} ${row.productSku} skipped: ${editState.reason}.`
      });
      continue;
    }

    const baseRow = baseRowsByKey.get(row.key);
    if (!baseRow) {
      skippedErrors.push({
        sheetName: promotionPlanMonthKey(row),
        rowNumber: 0,
        message: `${row.countryCode} ${row.productSku} skipped: current Master Data combination not found.`
      });
      continue;
    }
    importableRows.push({ row, baseRow });
  }

  if (skippedErrors.length > 0 || importableRows.length === 0) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "No promotion plan rows were imported. Fix the listed workbook rows before uploading so the selected country-month is not only partially replaced.",
        imported: 0,
        skipped: skippedErrors.length,
        errors: skippedErrors
      },
      { status: 400 }
    );
  }

  const overlap = findPromotionPlanPeriodOverlap(
    importableRows.map(({ row }) => ({
      scopeKey: row.key,
      countryCode: row.countryCode,
      retailerName: row.retailerName,
      fdName: row.fdName,
      productSku: row.productSku,
      promotionName: row.promotionName,
      promoStartDate: row.promoStartDate,
      promoEndDate: row.promoEndDate
    }))
  );
  if (overlap) {
    return NextResponse.json(
      {
        status: "error",
        message: `Promotion periods cannot overlap. ${promotionPlanPeriodOverlapMessage(overlap)}`,
        imported: 0,
        skipped: skippedErrors.length,
        errors: skippedErrors
      },
      { status: 400 }
    );
  }

  const touchedMonthCountries = new Map(
    importableRows.map(({ row }) => [
      `${promotionPlanMonthKey(row)}|${row.countryCode}`,
      { year: row.year, month: row.month, countryCode: row.countryCode }
    ])
  );
  let imported = 0;
  if (importableRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const touched of touchedMonthCountries.values()) {
        await tx.promotionPlanEntry.deleteMany({
          where: {
            planYear: touched.year,
            planMonth: touched.month,
            countryCode: touched.countryCode
          }
        });
      }
      for (const { row, baseRow } of importableRows) {
        await tx.promotionPlanEntry.create({
          data: {
            planYear: row.year,
            planMonth: row.month,
            countryCode: row.countryCode,
            retailerName: row.retailerName,
            fdName: row.fdName,
            incoterms: row.incoterms,
            category: row.category,
            productSku: row.productSku,
            productName: row.productName,
            promotionName: row.promotionName,
            promoRrpLocal: nullableDecimal(row.promoRrpLocal),
            promoRrpEur: nullableDecimal(row.promoRrpEur),
            promoFrontMargin: nullableDecimal(row.promoFrontMargin),
            dealType: row.dealType,
            promoFdMargin: nullableDecimal(row.promoFdMargin),
            dealNote: row.dealNote,
            promoVolume: row.promoVolume,
            promoStartDate: nullableDate(row.promoStartDate),
            promoEndDate: nullableDate(row.promoEndDate),
            ...snapshotPrismaData(promotionPlanSnapshotForRow(baseRow)),
            createdByEmail: session.email,
            updatedByEmail: session.email
          }
        });
        imported += 1;
      }
    });
  }

  let archive = null;
  if (imported > 0) {
    const archiveData =
      canSeeAllCountries
        ? data
        : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
    const entries = await getPromotionPlanEntriesForMonths(
      months,
      canSeeAllCountries ? undefined : accessibleCountryCodes
    );
    const workbook = buildPromotionPlanWorkbookBuffer({
      data: archiveData,
      entries,
      months,
      lockedCountryCodesByMonth: getLockedCountryCodesByMonth({
        months,
        countryCodes: archiveData.countries.map((country) => country.code),
        statusByMonthCountry
      })
    });
    const sourceReference = parsed.monthKeys.join("_");
    archive = await createPromotionPlanArchive({
      source: "PROMOTION_PLAN_IMPORT",
      sourceReference,
      title: `Promotion Plan workbook imported`,
      message: `${imported} rows imported or updated across ${parsed.monthKeys.length} month sheet(s).`,
      workbook,
      month: months.length === 1 ? months[0] : null,
      createdByEmail: session.email
    });
  }

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");

  return NextResponse.json({
    status: "success",
    message: `${imported} promotion plan rows imported.`,
    imported,
    skipped: skippedErrors.length,
    monthKeys: parsed.monthKeys,
    errors: skippedErrors,
    archive
  });
}

function getLockedCountryCodesByMonth({
  months,
  countryCodes,
  statusByMonthCountry
}: {
  months: Array<{ year: number; month: number }>;
  countryCodes: string[];
  statusByMonthCountry: Map<string, string>;
}) {
  const lockedByMonth: Record<string, string[]> = {};

  for (const month of months) {
    const monthKey = promotionPlanMonthKey(month);
    const deadlineLocked = isPromotionPlanDeadlineLocked({
      planYear: month.year,
      planMonth: month.month
    });

    lockedByMonth[monthKey] = countryCodes.filter(
      (countryCode) =>
        deadlineLocked ||
        statusByMonthCountry.get(`${monthKey}|${countryCode}`) === "APPROVED"
    );
  }

  return lockedByMonth;
}

function isUploadedWorkbookFile(value: unknown): value is UploadedWorkbookFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<UploadedWorkbookFile>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function requestedTargetMonth(formData: FormData) {
  const year = Number(formData.get("targetYear"));
  const month = Number(formData.get("targetMonth"));
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12
    ? { year, month }
    : null;
}

function nullableDecimal(value: number | null) {
  return value === null ? null : String(value);
}

function nullableDate(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function snapshotPrismaData(
  snapshot: ReturnType<typeof promotionPlanSnapshotForRow>
) {
  return {
    snapshotCurrency: snapshot.snapshotCurrency,
    snapshotLifecycleStatus: snapshot.snapshotLifecycleStatus,
    snapshotRrpLocal: nullableDecimal(snapshot.snapshotRrpLocal),
    snapshotRrpEur: nullableDecimal(snapshot.snapshotRrpEur),
    snapshotVatRate: nullableDecimal(snapshot.snapshotVatRate),
    snapshotBaseFrontMargin: nullableDecimal(snapshot.snapshotBaseFrontMargin),
    snapshotKaBuyingMargin: nullableDecimal(snapshot.snapshotKaBuyingMargin),
    snapshotKaBackMargin: nullableDecimal(snapshot.snapshotKaBackMargin),
    snapshotFdMargin: nullableDecimal(snapshot.snapshotFdMargin),
    snapshotTransportCost: nullableDecimal(snapshot.snapshotTransportCost),
    snapshotBomCost: nullableDecimal(snapshot.snapshotBomCost)
  };
}

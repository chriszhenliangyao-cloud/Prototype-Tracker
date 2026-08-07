import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { canBypassPromotionPlanLocks } from "@/lib/auth/roles";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { buildNormalRows } from "@/lib/calculatorRows";
import {
  getPromotionPlanEntriesForMonths,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  buildPromotionPlanWorkbookBuffer,
  parsePromotionPlanMonthKey,
  parsePromotionPlanWorkbook,
  promotionPlanBusinessKeyForEntry,
  promotionPlanBusinessKeyForRow,
  promotionPlanMonthKey,
  promotionPlanSnapshotForRow,
  type PromotionPlanRowSnapshot
} from "@/lib/promotionPlan";
import { createPromotionPlanArchive } from "@/lib/promotionPlanArchive";
import { readWorkbookSheetNames } from "@/lib/imports/xlsxLite";
import { getEffectivePromotionPlanRole } from "@/lib/promotionPlanAccess";
import { prisma } from "@/lib/prisma";
import {
  findPromotionPlanPeriodOverlap,
  promotionPlanPeriodOverlapMessage
} from "@/lib/promotionPlanPeriods";
import type { PromotionPlanEntryOption } from "@/lib/types";

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

  const [data, countryAccesses] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  if (!canBypassPromotionPlanLocks(effectiveRole)) {
    return NextResponse.json(
      { message: "Historical Promotion Plan import is only available to business admins." },
      { status: 403 }
    );
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

  const workbookBuffer = Buffer.from(await file.arrayBuffer());
  const workbookMonths = readWorkbookSheetNames(workbookBuffer)
    .map(parsePromotionPlanMonthKey)
    .filter((month): month is { year: number; month: number } => month !== null);
  const existingEntries = await getPromotionPlanEntriesForMonths(workbookMonths);
  const parsed = parsePromotionPlanWorkbook(workbookBuffer, data, existingEntries);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        status: "error",
        message: "No valid historical promotion plan rows were imported.",
        imported: 0,
        skipped: parsed.errors.length,
        errors: parsed.errors
      },
      { status: 400 }
    );
  }

  const baseRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const baseRowsByKey = new Map(
    baseRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const existingEntriesByMonthKey = new Map(
    existingEntries.map((entry) => [
      `${promotionPlanMonthKey({
        year: entry.planYear,
        month: entry.planMonth
      })}|${promotionPlanBusinessKeyForEntry(entry)}`,
      entry
    ])
  );
  const skippedErrors = [...parsed.errors];
  const touchedMonthCountries = new Map<
    string,
    { year: number; month: number; countryCode: string }
  >();
  const importableRows: Array<{
    row: (typeof parsed.rows)[number];
    snapshot: PromotionPlanRowSnapshot;
  }> = [];

  for (const row of parsed.rows) {
    const baseRow = baseRowsByKey.get(row.key);
    const existingEntry = existingEntriesByMonthKey.get(
      `${promotionPlanMonthKey(row)}|${row.key}`
    );
    const snapshot = baseRow
      ? promotionPlanSnapshotForRow(baseRow)
      : snapshotFromEntry(existingEntry);

    if (!snapshot) {
      skippedErrors.push({
        sheetName: promotionPlanMonthKey(row),
        rowNumber: 0,
        message: `${row.countryCode} ${row.productSku} skipped: no current Master Data combination or historical snapshot was found.`
      });
      continue;
    }

    importableRows.push({ row, snapshot });
    touchedMonthCountries.set(
      `${promotionPlanMonthKey(row)}|${row.countryCode}`,
      { year: row.year, month: row.month, countryCode: row.countryCode }
    );
  }

  if (skippedErrors.length > 0 || importableRows.length === 0) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "No historical promotion plan rows were imported. Fix the listed workbook rows before uploading so the selected country-month is not only partially replaced.",
        imported: 0,
        replaced: 0,
        skipped: skippedErrors.length,
        errors: skippedErrors
      },
      { status: 400 }
    );
  }

  let replaced = 0;
  const imported = importableRows.length;
  const approvedAt = new Date();

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
        replaced: 0,
        skipped: skippedErrors.length,
        errors: skippedErrors
      },
      { status: 400 }
    );
  }

  if (imported > 0) {
    await prisma.$transaction(async (tx) => {
      for (const touched of touchedMonthCountries.values()) {
        const deleteResult = await tx.promotionPlanEntry.deleteMany({
          where: {
            planYear: touched.year,
            planMonth: touched.month,
            countryCode: touched.countryCode
          }
        });
        replaced += deleteResult.count;
      }

      for (const { row, snapshot } of importableRows) {
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
            ...snapshotPrismaData(snapshot),
            createdByEmail: session.email,
            updatedByEmail: session.email
          }
        });
      }

      for (const touched of touchedMonthCountries.values()) {
        await tx.promotionPlanMonthStatus.upsert({
          where: {
            planYear_planMonth_countryCode: {
              planYear: touched.year,
              planMonth: touched.month,
              countryCode: touched.countryCode
            }
          },
          update: {
            status: "APPROVED",
            submittedByEmail: session.email,
            firstApprovedByEmail: session.email,
            approvedByEmail: session.email,
            submittedAt: approvedAt,
            firstApprovedAt: approvedAt,
            approvedAt,
            rejectedByEmail: null,
            rejectedAt: null,
            notes: `Historical Promotion Plan imported by ${session.email ?? "Admin"}.`
          },
          create: {
            planYear: touched.year,
            planMonth: touched.month,
            countryCode: touched.countryCode,
            status: "APPROVED",
            submittedByEmail: session.email,
            firstApprovedByEmail: session.email,
            approvedByEmail: session.email,
            submittedAt: approvedAt,
            firstApprovedAt: approvedAt,
            approvedAt,
            notes: `Historical Promotion Plan imported by ${session.email ?? "Admin"}.`
          }
        });
      }
    });
  }

  let archive = null;
  const months = parsed.monthKeys
    .map(parsePromotionPlanMonthKey)
    .filter((month): month is { year: number; month: number } => month !== null);

  if (imported > 0 && months.length > 0) {
    const entries = await getPromotionPlanEntriesForMonths(months);
    const allCountryCodes = data.countries.map((country) => country.code);
    const workbook = buildPromotionPlanWorkbookBuffer({
      data,
      entries,
      months,
      lockedCountryCodesByMonth: Object.fromEntries(
        months.map((month) => [promotionPlanMonthKey(month), allCountryCodes])
      )
    });
    const sourceReference = `historical-import-${parsed.monthKeys.join("_")}`;
    archive = await createPromotionPlanArchive({
      source: "PROMOTION_PLAN_HISTORICAL_IMPORT",
      sourceReference,
      title: "Historical Promotion Plan imported",
      message: `${imported} historical promotion plan rows imported and marked approved across ${touchedMonthCountries.size} country-month record(s). ${replaced} previous row(s) were replaced.`,
      workbook,
      month: months.length === 1 ? months[0] : null,
      createdByEmail: session.email,
      createdAt: approvedAt
    });
  }

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");

  return NextResponse.json({
    status: imported > 0 ? "success" : "error",
    message:
      imported > 0
        ? `${imported} historical promotion plan rows imported and marked approved. ${replaced} previous row(s) were replaced.`
        : "No historical promotion plan rows were imported.",
    imported,
    replaced,
    skipped: skippedErrors.length,
    monthKeys: parsed.monthKeys,
    errors: skippedErrors,
    archive
  });
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

function snapshotFromEntry(
  entry: PromotionPlanEntryOption | undefined
): PromotionPlanRowSnapshot | null {
  if (!entry) {
    return null;
  }

  return {
    snapshotCurrency: entry.snapshotCurrency,
    snapshotLifecycleStatus: entry.snapshotLifecycleStatus,
    snapshotRrpLocal: entry.snapshotRrpLocal,
    snapshotRrpEur: entry.snapshotRrpEur,
    snapshotVatRate: entry.snapshotVatRate,
    snapshotBaseFrontMargin: entry.snapshotBaseFrontMargin,
    snapshotKaBuyingMargin: entry.snapshotKaBuyingMargin,
    snapshotKaBackMargin: entry.snapshotKaBackMargin,
    snapshotFdMargin: entry.snapshotFdMargin,
    snapshotTransportCost: entry.snapshotTransportCost,
    snapshotBomCost: entry.snapshotBomCost
  };
}

function snapshotPrismaData(snapshot: PromotionPlanRowSnapshot) {
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

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { buildNormalRows } from "@/lib/calculatorRows";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  getPromotionPlanEntries,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  buildPromotionPlanWorkbookBuffer,
  promotionPlanBusinessKeyForRow,
  promotionPlanMonthKey,
  promotionPlanSnapshotForRow
} from "@/lib/promotionPlan";
import { buildPromotionPlanCopyRows } from "@/lib/promotionPlanCopy";
import { createPromotionPlanArchive } from "@/lib/promotionPlanArchive";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  isPromotionPlanDeadlineLocked
} from "@/lib/promotionPlanAccess";
import { prisma } from "@/lib/prisma";
import {
  findPromotionPlanPeriodOverlap,
  promotionPlanPeriodOverlapMessage
} from "@/lib/promotionPlanPeriods";

type CopyPayload = {
  sourceYear?: unknown;
  sourceMonth?: unknown;
  targetYear?: unknown;
  targetMonth?: unknown;
  countryCodes?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as CopyPayload;
  const sourceYear = toPlanYear(payload.sourceYear);
  const sourceMonth = toPlanMonth(payload.sourceMonth);
  const targetYear = toPlanYear(payload.targetYear);
  const targetMonth = toPlanMonth(payload.targetMonth);

  if (!sourceYear || !sourceMonth || !targetYear || !targetMonth) {
    return NextResponse.json(
      { message: "Choose valid source and target months." },
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

  const validCountryCodes = new Set(data.countries.map((country) => country.code));
  const requestedCountryCodes = Array.isArray(payload.countryCodes)
    ? payload.countryCodes
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toUpperCase())
        .filter((value) => validCountryCodes.has(value))
    : [];
  const sourceCountryCodes =
    requestedCountryCodes.length > 0
      ? requestedCountryCodes
      : canSeeAllCountries
        ? [...validCountryCodes].sort()
        : accessibleCountryCodes;
  const allowedSourceCountryCodes =
    canSeeAllCountries
      ? sourceCountryCodes
      : sourceCountryCodes.filter((countryCode) =>
          accessibleCountryCodes.includes(countryCode)
        );

  if (allowedSourceCountryCodes.length === 0) {
    return NextResponse.json(
      { message: "No accessible country was selected." },
      { status: 403 }
    );
  }

  const target = { year: targetYear, month: targetMonth };
  const [sourceEntries, targetStatuses] = await Promise.all([
    getPromotionPlanEntries(sourceYear, sourceMonth, allowedSourceCountryCodes),
    getPromotionPlanMonthStatuses({
      planYear: targetYear,
      planMonth: targetMonth,
      countryCodes: allowedSourceCountryCodes
    })
  ]);
  const copyResult = buildPromotionPlanCopyRows({
    data,
    sourceEntries,
    targetMonth: target,
    targetStatuses,
    accessibleCountryCodes,
    role: effectiveRole
  });

  const baseRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const baseRowsByKey = new Map(
    baseRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const errors = [...copyResult.errors];
  const copyableRows: Array<{
    row: (typeof copyResult.rows)[number];
    baseRow: (typeof baseRows)[number];
  }> = [];

  for (const row of copyResult.rows) {
    const baseRow = baseRowsByKey.get(row.key);
    if (!baseRow) {
      errors.push({
        message: `${row.countryCode} ${row.productSku} skipped: current Master Data combination not found.`
      });
      continue;
    }

    copyableRows.push({ row, baseRow });
  }

  if (errors.length > 0 || copyableRows.length === 0) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "No promotion plan rows were copied. Fix the listed source rows before copying so the target month is not only partially replaced.",
        copied: 0,
        skipped: errors.length,
        errors
      },
      { status: 400 }
    );
  }

  const overlap = findPromotionPlanPeriodOverlap(
    copyableRows.map(({ row }) => ({
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
        copied: 0,
        skipped: errors.length,
        errors
      },
      { status: 400 }
    );
  }

  const copiedCountryCodes = [...new Set(copyableRows.map(({ row }) => row.countryCode))];
  let copied = 0;
  if (copyableRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const countryCode of copiedCountryCodes) {
        await tx.promotionPlanEntry.deleteMany({
          where: { planYear: targetYear, planMonth: targetMonth, countryCode }
        });
      }
      for (const { row, baseRow } of copyableRows) {
        await tx.promotionPlanEntry.create({
          data: {
            planYear: targetYear,
            planMonth: targetMonth,
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
        copied += 1;
      }
    });
  }

  if (copied === 0) {
    return NextResponse.json(
      {
        status: "error",
        message: "No promotion plan rows were copied.",
        copied,
        skipped: errors.length,
        errors
      },
      { status: 400 }
    );
  }

  const archiveData =
    canSeeAllCountries
      ? filterReferenceDataByCountryCodes(data, copiedCountryCodes)
      : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  const targetEntries = await getPromotionPlanEntries(
    targetYear,
    targetMonth,
    copiedCountryCodes
  );
  const workbook = buildPromotionPlanWorkbookBuffer({
    data: archiveData,
    entries: targetEntries,
    months: [target],
    lockedCountryCodesByMonth: {
      [promotionPlanMonthKey(target)]: getLockedCountryCodes({
        countryCodes: archiveData.countries.map((country) => country.code),
        statuses: targetStatuses,
        target
      })
    }
  });
  const sourceReference = `${promotionPlanMonthKey({
    year: sourceYear,
    month: sourceMonth
  })}-to-${promotionPlanMonthKey(target)}`;
  const archive = await createPromotionPlanArchive({
    source: "PROMOTION_PLAN_COPY",
    sourceReference,
    title: `Promotion Plan copied to ${promotionPlanMonthKey(target)}`,
    message: `${copied} rows copied from ${sourceReference}.`,
    workbook,
    month: target,
    createdByEmail: session.email
  });

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");

  return NextResponse.json({
    status: "success",
    message: `Copied ${copied} promotion plan rows into ${promotionPlanMonthKey(target)}.`,
    copied,
    skipped: errors.length,
    errors,
    archive
  });
}

function getLockedCountryCodes({
  countryCodes,
  statuses,
  target
}: {
  countryCodes: string[];
  statuses: Array<{ countryCode: string; status: string }>;
  target: { year: number; month: number };
}) {
  const approvedCountries = new Set(
    statuses
      .filter((status) => status.status === "APPROVED")
      .map((status) => status.countryCode)
  );
  const deadlineLocked = isPromotionPlanDeadlineLocked({
    planYear: target.year,
    planMonth: target.month
  });

  return countryCodes.filter(
    (countryCode) => deadlineLocked || approvedCountries.has(countryCode)
  );
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toPlanMonth(value: unknown) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
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

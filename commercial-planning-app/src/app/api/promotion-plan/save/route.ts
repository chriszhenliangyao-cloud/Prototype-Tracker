import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  getPromotionPlanEntries,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import { createPromotionPlanArchive } from "@/lib/promotionPlanArchive";
import { prisma } from "@/lib/prisma";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  getPromotionPlanEditState,
  hasPromotionCountryAccess,
  isPromotionPlanDeadlineLocked
} from "@/lib/promotionPlanAccess";
import {
  buildPromotionPlanWorkbookBuffer,
  normalizePromotionPlanPeriod,
  promotionPlanBusinessKeyForEntry,
  promotionPlanBusinessKeyForRow,
  promotionPlanMonthKey,
  promotionPlanSnapshotForRow,
  type PromotionPlanSaveRow
} from "@/lib/promotionPlan";
import { buildNormalRows, type NormalTableRow } from "@/lib/calculatorRows";
import type { PromotionPlanEntryOption } from "@/lib/types";
import {
  findPromotionPlanPeriodOverlap,
  promotionPlanPeriodOverlapMessage
} from "@/lib/promotionPlanPeriods";
import { buildPromotionPlanEligibleRows } from "@/lib/promotionPlanShared";

export const dynamic = "force-dynamic";

type SavePayload = {
  planYear?: unknown;
  planMonth?: unknown;
  rows?: unknown;
  deleteEntryIds?: unknown;
  deleteKeys?: unknown;
};

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as SavePayload;
  const planYear = toPlanYear(payload.planYear);
  const planMonth = toPlanMonth(payload.planMonth);
  const saveRows = Array.isArray(payload.rows)
    ? payload.rows.filter(isPromotionPlanSaveRow)
    : [];
  const deleteEntryIds = Array.isArray(payload.deleteEntryIds)
    ? [
        ...new Set(
          payload.deleteEntryIds.filter(
            (value): value is string =>
              typeof value === "string" && value.trim() !== ""
          )
        )
      ]
    : [];
  // Kept for sessions that were already open before period-level rows shipped.
  const legacyDeleteKeys = Array.isArray(payload.deleteKeys)
    ? [...new Set(payload.deleteKeys.filter((value): value is string => typeof value === "string" && value.trim() !== ""))]
    : [];

  if (!planYear || !planMonth) {
    return NextResponse.json(
      { message: "Choose a valid year and month." },
      { status: 400 }
    );
  }

  if (saveRows.length === 0 && deleteEntryIds.length === 0 && legacyDeleteKeys.length === 0) {
    return NextResponse.json(
      { message: "No promotion plan rows were submitted." },
      { status: 400 }
    );
  }

  const data = await getReferenceData();
  const [countryAccesses, monthStatuses] = await Promise.all([
    getUserCountryAccesses(),
    getPromotionPlanMonthStatuses({ planYear, planMonth })
  ]);
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

  const statusByCountry = new Map(
    monthStatuses.map((status) => [status.countryCode, status.status])
  );
  // Keep saved historical rows resolvable even when a product's lifecycle or
  // planned launch date changes. Eligibility only governs new additions.
  const baseRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const rowsByKey = new Map(
    baseRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const eligibleNewRowKeys = new Set(
    buildPromotionPlanEligibleRows({
      data,
      targetMonth: { year: planYear, month: planMonth }
    }).map((row) => promotionPlanBusinessKeyForRow(row))
  );
  const existingEntries = await getPromotionPlanEntries(
    planYear,
    planMonth,
    canSeeAllCountries ? undefined : accessibleCountryCodes
  );
  const existingEntriesById = new Map(existingEntries.map((entry) => [entry.id, entry]));
  const requestedDeletionIds = new Set([
    ...deleteEntryIds,
    ...existingEntries
      .filter((entry) => legacyDeleteKeys.includes(promotionPlanBusinessKeyForEntry(entry)))
      .map((entry) => entry.id)
  ]);
  let saved = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: Array<{ message: string }> = [];
  const deletableEntryIds = new Set<string>();
  for (const entryId of requestedDeletionIds) {
    const existingEntry = existingEntriesById.get(entryId);
    if (!existingEntry) {
      continue;
    }
    const editState = getPromotionPlanEditState({
      role: effectiveRole,
      hasCountryAccess: hasPromotionCountryAccess(effectiveRole, existingEntry.countryCode, accessibleCountryCodes),
      planYear,
      planMonth,
      status: statusByCountry.get(existingEntry.countryCode) ?? "DRAFT"
    });
    if (!editState.editable) {
      skipped += 1;
      errors.push({ message: `${existingEntry.countryCode} skipped deletion: ${editState.reason}.` });
      continue;
    }
    deletableEntryIds.add(entryId);
  }

  const rowsToPersist: Array<{
    saveRow: PromotionPlanSaveRow;
    row: (typeof baseRows)[number];
    period: { promoStartDate: string; promoEndDate: string };
    snapshot: ReturnType<typeof promotionPlanSnapshotForRow>;
  }> = [];
  const persistedEntryIds = new Set<string>();

  for (const saveRow of saveRows) {
    const row = rowsByKey.get(saveRow.key);
    if (!row) {
      skipped += 1;
      errors.push({ message: "Skipped row because the country/channel/FD/SKU no longer exists." });
      continue;
    }

    const existingEntry = saveRow.entryId ? existingEntriesById.get(saveRow.entryId) : null;
    if (!existingEntry && !eligibleNewRowKeys.has(saveRow.key)) {
      skipped += 1;
      errors.push({
        message: `${row.countryCode} ${row.model} skipped: the product is not eligible for this plan month. Unlaunched products require a planned launch date within the planning window and complete commercial setup.`
      });
      continue;
    }

    const editState = getPromotionPlanEditState({
      role: effectiveRole,
      hasCountryAccess: hasPromotionCountryAccess(
        effectiveRole,
        row.countryCode,
        accessibleCountryCodes
      ),
      planYear,
      planMonth,
      status: statusByCountry.get(row.countryCode) ?? "DRAFT"
    });
    if (!editState.editable) {
      skipped += 1;
      errors.push({
        message: `${row.countryCode} ${row.model} skipped: ${editState.reason}.`
      });
      continue;
    }
    const period = normalizePromotionPlanPeriod({
      month: { year: planYear, month: planMonth },
      promoStartDate: saveRow.promoStartDate,
      promoEndDate: saveRow.promoEndDate
    });
    if ("error" in period) {
      skipped += 1;
      errors.push({
        message: `${row.countryCode} ${row.model} skipped: ${period.error}`
      });
      continue;
    }
    if (saveRow.entryId && existingEntry && !promotionPlanEntryMatchesRow(existingEntry, row)) {
      skipped += 1;
      errors.push({ message: `${row.countryCode} ${row.model} skipped: the promotion period does not match its original scope.` });
      continue;
    }
    if (existingEntry && persistedEntryIds.has(existingEntry.id)) {
      skipped += 1;
      errors.push({ message: `${row.countryCode} ${row.model} skipped: the same promotion period was submitted more than once.` });
      continue;
    }
    if (existingEntry) {
      deletableEntryIds.delete(existingEntry.id);
      persistedEntryIds.add(existingEntry.id);
    }
    rowsToPersist.push({
      saveRow,
      row,
      period,
      snapshot: promotionPlanSnapshotForRow(row)
    });
  }

  const retainedEntries = existingEntries.filter(
    (entry) => !deletableEntryIds.has(entry.id) && !persistedEntryIds.has(entry.id)
  );
  const overlap = findPromotionPlanPeriodOverlap([
    ...retainedEntries.map((entry) => ({
      scopeKey: promotionPlanBusinessKeyForEntry(entry),
      countryCode: entry.countryCode,
      retailerName: entry.retailerName,
      fdName: entry.fdName,
      productSku: entry.productSku,
      promotionName: entry.promotionName,
      promoStartDate: dateToIso(entry.promoStartDate),
      promoEndDate: dateToIso(entry.promoEndDate)
    })),
    ...rowsToPersist.map(({ row, saveRow, period }) => ({
      scopeKey: promotionPlanBusinessKeyForRow(row),
      countryCode: row.countryCode,
      retailerName: row.retailerName,
      fdName: row.fdName,
      productSku: row.model,
      promotionName: nullableText(saveRow.promotionName),
      promoStartDate: period.promoStartDate,
      promoEndDate: period.promoEndDate
    }))
  ]);
  if (overlap) {
    return NextResponse.json({ status: "error", message: `Promotion periods cannot overlap. ${promotionPlanPeriodOverlapMessage(overlap)}`, saved: 0, deleted: 0, skipped, errors }, { status: 400 });
  }

  if (rowsToPersist.length > 0 || deletableEntryIds.size > 0) {
    await prisma.$transaction(async (tx) => {
      for (const entryId of deletableEntryIds) {
        await tx.promotionPlanEntry.delete({ where: { id: entryId } });
        deleted += 1;
      }
      for (const item of rowsToPersist) {
        const data = promotionPlanEntryData(item.saveRow, item.row, item.period, item.snapshot, session.email);
        const existingEntry = item.saveRow.entryId ? existingEntriesById.get(item.saveRow.entryId) : null;
        if (existingEntry) {
          await tx.promotionPlanEntry.update({ where: { id: existingEntry.id }, data });
        } else {
          await tx.promotionPlanEntry.create({ data: { ...data, planYear, planMonth, countryCode: item.row.countryCode, retailerName: item.row.retailerName, fdName: item.row.fdName, incoterms: item.row.incoterms, productSku: item.row.model, createdByEmail: session.email } });
        }
        saved += 1;
      }
    });
  }

  if (saved === 0 && deleted === 0) {
    return NextResponse.json(
      {
        status: "error",
        message: "No promotion plan rows were saved.",
        saved,
        deleted,
        skipped,
        errors
      },
      { status: 400 }
    );
  }

  const month = { year: planYear, month: planMonth };
  const archiveData =
    canSeeAllCountries
      ? data
      : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  const entries = await getPromotionPlanEntries(
    planYear,
    planMonth,
    canSeeAllCountries ? undefined : accessibleCountryCodes
  );
  const workbook = buildPromotionPlanWorkbookBuffer({
    data: archiveData,
    entries,
    months: [month],
    lockedCountryCodesByMonth: {
      [promotionPlanMonthKey(month)]: archiveData.countries
        .filter(
          (country) =>
            isPromotionPlanDeadlineLocked({ planYear, planMonth }) ||
            statusByCountry.get(country.code) === "APPROVED"
        )
        .map((country) => country.code)
    }
  });
  const sourceReference = promotionPlanMonthKey(month);
  const archive = await createPromotionPlanArchive({
    source: "PROMOTION_PLAN_SAVE",
    sourceReference,
    title: `Promotion Plan saved for ${sourceReference}`,
    message: `${saved} rows saved, ${deleted} rows removed, ${skipped} skipped.`,
    workbook,
    month,
    createdByEmail: session.email
  });

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");
  revalidatePath("/platform/collaboration/other-approvals");

  return NextResponse.json({
    status: "success",
    message: `Saved ${saved} promotion plan rows and removed ${deleted} row(s) for ${sourceReference}.`,
    saved,
    deleted,
    skipped,
    errors,
    archive
  });
}

function isPromotionPlanSaveRow(value: unknown): value is PromotionPlanSaveRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PromotionPlanSaveRow>;
  return typeof candidate.key === "string" && candidate.key.trim() !== "";
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toPlanMonth(value: unknown) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function nullableDecimal(value: unknown) {
  const number = parseLooseNumber(value);
  return number === null ? null : String(number);
}

function nullableMarginDecimal(value: unknown) {
  const number = parseLooseNumber(value);
  if (number === null) {
    return null;
  }

  return String(number > 1 ? number / 100 : number);
}

function nullableDealType(value: unknown) {
  return value === "B2B_DEAL" || value === "EOL_DEAL" ? value : "NORMAL";
}

function nullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function nullableInteger(value: unknown) {
  const number = parseLooseNumber(value);
  return number === null ? null : Math.round(number);
}

function nullableDate(value: unknown) {
  const trimmedValue = String(value ?? "").trim();
  const match = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLooseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmedValue = String(value ?? "").trim();
  if (trimmedValue === "" || trimmedValue === "-") {
    return null;
  }

  const parsedValue = Number(
    trimmedValue.replace(/[%€¥$£\s]/g, "").replace(/,/g, "")
  );
  return Number.isFinite(parsedValue) ? parsedValue : null;
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

function promotionPlanEntryMatchesRow(
  entry: PromotionPlanEntryOption,
  row: NormalTableRow
) {
  return (
    entry.countryCode === row.countryCode &&
    entry.retailerName === row.retailerName &&
    entry.fdName === row.fdName &&
    entry.incoterms === row.incoterms &&
    entry.productSku === row.model
  );
}

function promotionPlanEntryData(
  saveRow: PromotionPlanSaveRow,
  row: NormalTableRow,
  period: { promoStartDate: string; promoEndDate: string },
  snapshot: ReturnType<typeof promotionPlanSnapshotForRow>,
  updatedByEmail: string | null
) {
  const dealType = nullableDealType(saveRow.dealType);
  return {
    category: row.category,
    productName: row.productName,
    promotionName: nullableText(saveRow.promotionName),
    promoRrpLocal: nullableDecimal(saveRow.promoRrpLocal),
    promoRrpEur: nullableDecimal(saveRow.promoRrpEur),
    promoFrontMargin: nullableMarginDecimal(saveRow.promoFrontMargin),
    dealType,
    promoFdMargin:
      dealType === "NORMAL" ? null : nullableMarginDecimal(saveRow.promoFdMargin),
    dealNote: dealType === "NORMAL" ? null : nullableText(saveRow.dealNote),
    promoVolume: nullableInteger(saveRow.promoVolume),
    promoStartDate: nullableDate(period.promoStartDate),
    promoEndDate: nullableDate(period.promoEndDate),
    ...snapshotPrismaData(snapshot),
    updatedByEmail
  };
}

function dateToIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

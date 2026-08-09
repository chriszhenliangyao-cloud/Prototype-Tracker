import { buildNormalRows } from "./calculatorRows";
import {
  retargetPromotionDateToMonth,
  buildPromotionPlanWorkbookBuffer,
  promotionPlanBusinessKeyForEntry,
  promotionPlanBusinessKeyForRow,
  promotionPlanMonthKey,
  type ParsedPromotionPlanRow,
  type PromotionPlanMonth
} from "./promotionPlan";
import {
  hasPromotionCountryAccess,
  isPromotionPlanDeadlineLocked
} from "./promotionPlanAccess";
import { buildPromotionPlanEligibleRows } from "./promotionPlanShared";
import type {
  PromotionPlanEntryOption,
  PromotionPlanMonthStatusOption,
  ReferenceData,
  UserRole
} from "./types";

export type PromotionPlanCopyError = {
  message: string;
};

export type PromotionPlanCopyResult = {
  rows: ParsedPromotionPlanRow[];
  errors: PromotionPlanCopyError[];
};

export function buildPromotionPlanCopyRows({
  data,
  sourceEntries,
  targetMonth,
  targetStatuses,
  accessibleCountryCodes,
  role,
  enforceTargetEditable = true,
  now = new Date()
}: {
  data: ReferenceData;
  sourceEntries: PromotionPlanEntryOption[];
  targetMonth: PromotionPlanMonth;
  targetStatuses: PromotionPlanMonthStatusOption[];
  accessibleCountryCodes: string[];
  role: UserRole;
  enforceTargetEditable?: boolean;
  now?: Date;
}): PromotionPlanCopyResult {
  const baseRows = buildNormalRows(data, {}, { lifecycle: "ALL" });
  const baseRowsByKey = new Map(
    baseRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
  );
  const eligibleTargetRowKeys = new Set(
    buildPromotionPlanEligibleRows({ data, targetMonth }).map((row) =>
      promotionPlanBusinessKeyForRow(row)
    )
  );
  const statusByCountry = new Map(
    targetStatuses.map((status) => [status.countryCode.toUpperCase(), status.status])
  );
  const deadlineLocked = isPromotionPlanDeadlineLocked({
    planYear: targetMonth.year,
    planMonth: targetMonth.month,
    now
  });
  const rows: ParsedPromotionPlanRow[] = [];
  const errors: PromotionPlanCopyError[] = [];

  for (const sourceEntry of sourceEntries) {
    const countryCode = sourceEntry.countryCode.toUpperCase();
    const sourceKey = promotionPlanBusinessKeyForEntry(sourceEntry);

    if (
      !hasPromotionCountryAccess(role, countryCode, accessibleCountryCodes)
    ) {
      errors.push({
        message: `${countryCode} ${sourceEntry.productSku} skipped: no country access.`
      });
      continue;
    }

    if (enforceTargetEditable) {
      const targetStatus = statusByCountry.get(countryCode);
      if (targetStatus === "FIRST_APPROVED" || targetStatus === "APPROVED") {
        errors.push({
          message: `${countryCode} ${sourceEntry.productSku} skipped: target month is ${targetStatus.toLowerCase().replace("_", " ")}.`
        });
        continue;
      }

      if (deadlineLocked) {
        errors.push({
          message: `${countryCode} ${sourceEntry.productSku} skipped: deadline passed.`
        });
        continue;
      }
    }

    const baseRow = baseRowsByKey.get(sourceKey);
    if (!baseRow) {
      errors.push({
        message: `${countryCode} ${sourceEntry.productSku} skipped: current Master Data combination not found.`
      });
      continue;
    }

    if (!eligibleTargetRowKeys.has(sourceKey)) {
      errors.push({
        message: `${countryCode} ${sourceEntry.productSku} skipped: the product is not eligible for the target plan month. Unlaunched products can be copied only in their pre-launch planning window.`
      });
      continue;
    }

    rows.push({
      year: targetMonth.year,
      month: targetMonth.month,
      key: sourceKey,
      countryCode: baseRow.countryCode,
      retailerName: baseRow.retailerName,
      promotionName: sourceEntry.promotionName,
      fdName: baseRow.fdName,
      incoterms: baseRow.incoterms,
      category: baseRow.category,
      productSku: baseRow.model,
      productName: baseRow.productName,
      promoRrpLocal: sourceEntry.promoRrpLocal,
      promoRrpEur: sourceEntry.promoRrpEur,
      promoFrontMargin: sourceEntry.promoFrontMargin,
      dealType: sourceEntry.dealType,
      promoFdMargin: sourceEntry.promoFdMargin,
      dealNote: sourceEntry.dealNote,
      promoVolume: sourceEntry.promoVolume,
      promoStartDate: retargetPromotionDateToMonth(
        sourceEntry.promoStartDate,
        targetMonth
      ),
      promoEndDate: retargetPromotionDateToMonth(
        sourceEntry.promoEndDate,
        targetMonth
      )
    });
  }

  return { rows, errors };
}

export function buildPromotionPlanCopyTemplateWorkbookBuffer({
  data,
  sourceEntries,
  targetMonth,
  targetStatuses,
  accessibleCountryCodes,
  role,
  now = new Date()
}: {
  data: ReferenceData;
  sourceEntries: PromotionPlanEntryOption[];
  targetMonth: PromotionPlanMonth;
  targetStatuses: PromotionPlanMonthStatusOption[];
  accessibleCountryCodes: string[];
  role: UserRole;
  now?: Date;
}) {
  const copiedRows = buildPromotionPlanCopyRows({
    data,
    sourceEntries,
    targetMonth,
    targetStatuses,
    accessibleCountryCodes,
    role,
    enforceTargetEditable: false,
    now
  });
  return buildPromotionPlanWorkbookBuffer({
    data,
    entries: copiedRows.rows.map((row, index) =>
      copyRowToPromotionPlanEntry(row, index)
    ),
    months: [targetMonth]
  });
}

function copyRowToPromotionPlanEntry(
  row: ParsedPromotionPlanRow,
  index: number
): PromotionPlanEntryOption {
  const timestamp = new Date(0).toISOString();
  return {
    id: `copy-template-${promotionPlanMonthKey(row)}-${index}`,
    planYear: row.year,
    planMonth: row.month,
    countryCode: row.countryCode,
    retailerName: row.retailerName,
    promotionName: row.promotionName,
    fdName: row.fdName,
    incoterms: row.incoterms,
    category: row.category,
    productSku: row.productSku,
    productName: row.productName,
    promoRrpLocal: row.promoRrpLocal,
    promoRrpEur: row.promoRrpEur,
    promoFrontMargin: row.promoFrontMargin,
    dealType: row.dealType,
    promoFdMargin: row.promoFdMargin,
    dealNote: row.dealNote,
    promoVolume: row.promoVolume,
    promoStartDate: row.promoStartDate,
    promoEndDate: row.promoEndDate,
    snapshotCurrency: null,
    snapshotLifecycleStatus: null,
    snapshotRrpLocal: null,
    snapshotRrpEur: null,
    snapshotVatRate: null,
    snapshotBaseFrontMargin: null,
    snapshotKaBuyingMargin: null,
    snapshotKaBackMargin: null,
    snapshotFdMargin: null,
    snapshotTransportCost: null,
    snapshotBomCost: null,
    createdByEmail: null,
    updatedByEmail: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

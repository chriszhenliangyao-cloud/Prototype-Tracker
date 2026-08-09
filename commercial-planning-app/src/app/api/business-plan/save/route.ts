import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { getBusinessPlanEditState } from "@/lib/businessPlanAccess";
import {
  getBusinessPlanChannelProfiles,
  getBusinessPlanEntries,
  getBusinessPlanYearStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  buildBusinessPlanBaseRows,
  buildBusinessPlanProfileAssumption,
  profileDuplicatesMasterData,
  temporaryAssumptionRowKey
} from "@/lib/calculations/businessPlan";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  hasPromotionCountryAccess
} from "@/lib/promotionPlanAccess";
import type {
  BusinessPlanChannelProductOverrideDraft,
  BusinessPlanChannelProfileDraft,
  BusinessPlanDraftLine
} from "@/lib/calculations/businessPlan";

export const dynamic = "force-dynamic";

type SavePayload = {
  planYear?: unknown;
  countryCode?: unknown;
  rows?: unknown;
  channelProfiles?: unknown;
};

type SaveChannelProfile = BusinessPlanChannelProfileDraft & {
  productOverrides: BusinessPlanChannelProductOverrideDraft[];
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
  const countryCode = toCountryCode(payload.countryCode);
  const draftRows = Array.isArray(payload.rows)
    ? payload.rows.filter(isBusinessPlanDraftLine)
    : [];
  const shouldSyncProfiles = Array.isArray(payload.channelProfiles);

  if (!planYear || !countryCode) {
    return NextResponse.json(
      { message: "Choose a valid BP year and country." },
      { status: 400 }
    );
  }
  const channelProfiles = parseChannelProfiles(
    payload.channelProfiles,
    planYear,
    countryCode
  );

  const [data, countryAccesses, statuses] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses(),
    getBusinessPlanYearStatuses({ planYear, countryCodes: [countryCode] })
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  if (!canSaveScenario(effectiveRole)) {
    return NextResponse.json({ message: "You do not have BP access." }, { status: 403 });
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
  const editState = getBusinessPlanEditState({
    hasCountryAccess: hasPromotionCountryAccess(
      effectiveRole,
      countryCode,
      accessibleCountryCodes
    ),
    status: statuses[0]?.status ?? "DRAFT"
  });
  if (!editState.editable) {
    return NextResponse.json(
      { message: `This BP is locked: ${editState.reason}.` },
      { status: 403 }
    );
  }

  const profileValidationErrors = validateChannelProfiles(
    channelProfiles,
    data,
    planYear,
    countryCode
  );
  if (profileValidationErrors.length > 0) {
    return NextResponse.json(
      { message: profileValidationErrors[0] },
      { status: 400 }
    );
  }

  const profilesById = new Map(
    channelProfiles.map((profile) => [profile.id, profile])
  );
  const profileDraftErrors: string[] = [];
  const normalizedDraftRows = draftRows.flatMap((draft) => {
    if (!draft.channelProfileId) {
      return [draft];
    }

    const profile = profilesById.get(draft.channelProfileId);
    const productSku = draft.assumption?.productSku ?? "";
    if (!profile || !productSku) {
      profileDraftErrors.push(
        "A BP-only target must select a saved Channel Profile and a Master Data product."
      );
      return [];
    }
    const override = profile.productOverrides.find(
      (item) => item.productSku.toLowerCase() === productSku.toLowerCase()
    );
    const assumption = buildBusinessPlanProfileAssumption({
      data,
      profile,
      productSku,
      override
    });
    if (!assumption) {
      profileDraftErrors.push(
        `Profile ${profile.retailerName} / ${profile.fdName} uses an unknown product.`
      );
      return [];
    }
    return [{ ...draft, rowKey: temporaryAssumptionRowKey(assumption), assumption }];
  });
  if (profileDraftErrors.length > 0) {
    return NextResponse.json({ message: profileDraftErrors[0] }, { status: 400 });
  }

  const effectiveRows = buildBusinessPlanBaseRows(
    data,
    normalizedDraftRows
      .map((row) => row.assumption)
      .filter((assumption) => assumption !== undefined)
  ).filter(
    (row) => row.countryCode === countryCode
  );
  const baseRowsByKey = new Map(effectiveRows.map((row) => [row.key, row]));
  const profileRowsWithMissingCosts = normalizedDraftRows.filter((draft) => {
    if (!draft.channelProfileId) {
      return false;
    }
    const baseRow = baseRowsByKey.get(draft.rowKey);
    return Boolean(baseRow && baseRow.missingFields.length > 0);
  });
  if (profileRowsWithMissingCosts.length > 0) {
    return NextResponse.json(
      {
        message:
          "A BP-only target is missing RRP, BOM, or Logistics. Add the required product override before saving."
      },
      { status: 400 }
    );
  }

  const rowsToSave = normalizedDraftRows.filter((row) => {
    const baseRow = baseRowsByKey.get(row.rowKey);
    return (
      baseRow &&
      row.year === planYear &&
      !isEmptyDraftLine(row)
    );
  });
  const existingEntries = await getBusinessPlanEntries(planYear, [countryCode]);
  let deleted = 0;
  let saved = 0;
  let skipped = normalizedDraftRows.length - rowsToSave.length;
  const profileIdByDraftId = new Map<string, string>();

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const profile of channelProfiles) {
          const persisted = await tx.businessPlanChannelProfile.upsert({
            where: {
              planYear_countryCode_retailerName_fdName_incoterms: {
                planYear,
                countryCode,
                retailerName: profile.retailerName,
                fdName: profile.fdName,
                incoterms: profile.incoterms
              }
            },
            update: {
              kaBuyingMargin: decimal(profile.kaBuyingMargin),
              kaFrontMargin: decimal(profile.kaFrontMargin),
              kaBackMargin: decimal(profile.kaBackMargin),
              fdMargin: decimal(profile.fdMargin),
              updatedByEmail: session.email
            },
            create: {
              planYear,
              countryCode,
              retailerName: profile.retailerName,
              fdName: profile.fdName,
              incoterms: profile.incoterms,
              kaBuyingMargin: decimal(profile.kaBuyingMargin),
              kaFrontMargin: decimal(profile.kaFrontMargin),
              kaBackMargin: decimal(profile.kaBackMargin),
              fdMargin: decimal(profile.fdMargin),
              createdByEmail: session.email,
              updatedByEmail: session.email
            }
          });
          profileIdByDraftId.set(profile.id, persisted.id);
          await tx.businessPlanChannelProductOverride.deleteMany({
            where: { channelProfileId: persisted.id }
          });
          if (profile.productOverrides.length > 0) {
            await tx.businessPlanChannelProductOverride.createMany({
              data: profile.productOverrides.map((override) => ({
                channelProfileId: persisted.id,
                productSku: override.productSku,
                rrpLocal: nullableDecimal(override.rrpLocal),
                rrpEur: nullableDecimal(override.rrpEur),
                currency: nonEmptyString(override.currency),
                kaBuyingMargin: nullableDecimal(override.kaBuyingMargin),
                kaFrontMargin: nullableDecimal(override.kaFrontMargin),
                kaBackMargin: nullableDecimal(override.kaBackMargin),
                fdMargin: nullableDecimal(override.fdMargin),
                bomCost: nullableDecimal(override.bomCost),
                logisticsCost: nullableDecimal(override.logisticsCost),
                createdByEmail: session.email,
                updatedByEmail: session.email
              }))
            });
          }
        }
        if (shouldSyncProfiles) {
          const keptProfileIds = [...profileIdByDraftId.values()];
          await tx.businessPlanChannelProfile.deleteMany({
            where: {
              planYear,
              countryCode,
              ...(keptProfileIds.length > 0
                ? { id: { notIn: keptProfileIds } }
                : {})
            }
          });
        }

        const deletedResult = await tx.businessPlanEntry.deleteMany({
          where: {
            planYear,
            countryCode
          }
        });
        const entryRowsByKey = new Map<
          string,
          Prisma.BusinessPlanEntryCreateManyInput
        >();

        for (const draft of rowsToSave) {
          const row = baseRowsByKey.get(draft.rowKey);
          if (!row) {
            continue;
          }
          const entryKey = [
            planYear,
            draft.month,
            row.countryCode,
            row.retailerName,
            row.fdName,
            row.incoterms,
            row.model
          ].join("|");
          entryRowsByKey.set(entryKey, {
            planYear,
            planMonth: draft.month,
            countryCode: row.countryCode,
            retailerName: row.retailerName,
            fdName: row.fdName,
            incoterms: row.incoterms,
            productSku: row.model,
            category: row.category,
            productName: row.productName,
            channelProfileId: draft.channelProfileId
              ? profileIdByDraftId.get(draft.channelProfileId) ?? null
              : null,
            promoPriceLocal: nullableDecimal(draft.promoPriceLocal),
            promoDiscountPercent: nullableDecimal(draft.promoDiscountPercent),
            siUnits: positiveInteger(draft.siUnits),
            soUnits: positiveInteger(draft.soUnits),
            source: rowSource(row.key),
            snapshotCurrency: snapshotCurrency(row.key, row.currency),
            snapshotRrpLocal: snapshotDecimal(row.key, row.rrpLocal),
            snapshotRrpEur: snapshotDecimal(row.key, row.rrpEur),
            snapshotKaBuyingMargin: snapshotDecimal(row.key, row.kaBuyingMargin),
            snapshotKaFrontMargin: snapshotDecimal(row.key, row.kaFrontMargin),
            snapshotKaBackMargin: snapshotDecimal(row.key, row.kaBackMargin),
            snapshotFdMargin: snapshotDecimal(row.key, row.fdMargin),
            snapshotBomCost: snapshotDecimal(row.key, row.bomCost),
            snapshotLogisticsCost: snapshotDecimal(row.key, row.logisticsCost),
            createdByEmail: session.email,
            updatedByEmail: session.email
          });
        }

        const entryRows = [...entryRowsByKey.values()];
        if (entryRows.length > 0) {
          const createResult = await tx.businessPlanEntry.createMany({
            data: entryRows
          });
          saved += createResult.count;
        }
        deleted = Math.max(0, deletedResult.count - saved);

        if (statuses[0]?.status === "REJECTED") {
          await tx.businessPlanYearStatus.update({
            where: { planYear_countryCode: { planYear, countryCode } },
            data: {
              status: "DRAFT",
              rejectedByEmail: null,
              rejectedAt: null
            }
          });
        }
      },
      { maxWait: 10_000, timeout: 60_000 }
    );
  } catch (error) {
    console.error("Business plan save failed", error);
    return NextResponse.json(
      {
        status: "error",
        message:
          "Save failed while writing BP rows. Please try again; if it repeats, contact the system owner.",
        saved,
        deleted,
        skipped
      },
      { status: 500 }
    );
  }

  const [entries, profiles] = await Promise.all([
    getBusinessPlanEntries(planYear, [countryCode]),
    getBusinessPlanChannelProfiles(planYear, [countryCode])
  ]);
  revalidatePath("/business-plan");
  revalidatePath("/platform/business/bp");

  return NextResponse.json({
    status: "success",
    message: `Saved ${saved} BP row(s), removed ${deleted} row(s).`,
    saved,
    deleted,
    skipped,
    entries,
    profiles
  });
}

function isBusinessPlanDraftLine(value: unknown): value is BusinessPlanDraftLine {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<BusinessPlanDraftLine>;
  return (
    typeof candidate.rowKey === "string" &&
    Number.isInteger(candidate.year) &&
    Number.isInteger(candidate.month)
  );
}

function isEmptyDraftLine(row: BusinessPlanDraftLine) {
  return (
    positiveInteger(row.siUnits) === 0 &&
    positiveInteger(row.soUnits) === 0 &&
    (parseNumber(row.promoDiscountPercent) ?? 0) === 0 &&
    parseNumber(row.promoPriceLocal) === null
  );
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toCountryCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{2,5}$/.test(code) ? code : null;
}

function nullableDecimal(value: unknown) {
  const number = parseNumber(value);
  return number === null ? null : String(number);
}

function parseNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
}

function rowSource(rowKey: string) {
  return rowKey.startsWith("bp-assumption:") ? "BP_ASSUMPTION" : "MASTER_DATA";
}

function snapshotCurrency(rowKey: string, currency: string) {
  return rowSource(rowKey) === "BP_ASSUMPTION" ? currency : null;
}

function snapshotDecimal(rowKey: string, value: unknown) {
  return rowSource(rowKey) === "BP_ASSUMPTION" ? nullableDecimal(value) : null;
}

function decimal(value: number) {
  return String(value);
}

function nonEmptyString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function parseChannelProfiles(
  value: unknown,
  planYear: number | null,
  countryCode: string | null
): SaveChannelProfile[] {
  if (!Array.isArray(value) || !planYear || !countryCode) {
    return [];
  }

  return value.map((item) => {
    const record = isRecord(item) ? item : {};
    const overrides = Array.isArray(record.productOverrides)
      ? record.productOverrides.map((override) => {
          const values = isRecord(override) ? override : {};
          return {
            id: String(values.id ?? ""),
            channelProfileId: String(values.channelProfileId ?? record.id ?? ""),
            productSku: String(values.productSku ?? "").trim(),
            rrpLocal: nullableNumber(values.rrpLocal),
            rrpEur: nullableNumber(values.rrpEur),
            currency: nonEmptyString(values.currency),
            kaBuyingMargin: nullableNumber(values.kaBuyingMargin),
            kaFrontMargin: nullableNumber(values.kaFrontMargin),
            kaBackMargin: nullableNumber(values.kaBackMargin),
            fdMargin: nullableNumber(values.fdMargin),
            bomCost: nullableNumber(values.bomCost),
            logisticsCost: nullableNumber(values.logisticsCost)
          };
        })
      : [];

    return {
      id: String(record.id ?? "").trim(),
      planYear,
      countryCode,
      retailerName: String(record.retailerName ?? "").trim(),
      fdName: String(record.fdName ?? "").trim(),
      incoterms: String(record.incoterms ?? "").trim(),
      kaBuyingMargin: nullableNumber(record.kaBuyingMargin) ?? Number.NaN,
      kaFrontMargin: nullableNumber(record.kaFrontMargin) ?? Number.NaN,
      kaBackMargin: nullableNumber(record.kaBackMargin) ?? Number.NaN,
      fdMargin: nullableNumber(record.fdMargin) ?? Number.NaN,
      productOverrides: overrides
    };
  });
}

function validateChannelProfiles(
  profiles: SaveChannelProfile[],
  data: Awaited<ReturnType<typeof getReferenceData>>,
  planYear: number,
  countryCode: string
) {
  const profileIds = new Set<string>();
  const businessKeys = new Set<string>();

  for (const profile of profiles) {
    if (!profile.id || !profile.retailerName || !profile.fdName || !profile.incoterms) {
      return ["Every BP Channel Profile needs Channel / KA, FD, and Incoterms."];
    }
    if (
      profile.planYear !== planYear ||
      profile.countryCode.toUpperCase() !== countryCode.toUpperCase()
    ) {
      return ["A BP Channel Profile does not belong to the selected year and country."];
    }
    if (
      !Number.isFinite(profile.kaBuyingMargin) ||
      !Number.isFinite(profile.kaFrontMargin) ||
      !Number.isFinite(profile.kaBackMargin) ||
      !Number.isFinite(profile.fdMargin)
    ) {
      return ["Every BP Channel Profile must include all four margin values."];
    }
    if (profileDuplicatesMasterData(data, profile)) {
      return [
        `${profile.retailerName} / ${profile.fdName} already exists in Master Data. Use the standard BP Input rows instead.`
      ];
    }
    const profileKey = [
      profile.countryCode,
      profile.retailerName,
      profile.fdName,
      profile.incoterms
    ]
      .map(normalizeProfilePart)
      .join("|");
    if (profileIds.has(profile.id) || businessKeys.has(profileKey)) {
      return ["Duplicate BP Channel Profile for the same Country / Channel / FD / Incoterms."];
    }
    profileIds.add(profile.id);
    businessKeys.add(profileKey);

    const overrideProducts = new Set<string>();
    for (const override of profile.productOverrides) {
      const productKey = override.productSku.toLowerCase();
      if (!productKey || overrideProducts.has(productKey)) {
        return ["Each product can have only one override within a BP Channel Profile."];
      }
      if (
        !data.products.some(
          (product) =>
            product.status === "ACTIVE" &&
            product.sku.toLowerCase() === productKey
        )
      ) {
        return [`Product override ${override.productSku} is not in current Master Data.`];
      }
      overrideProducts.add(productKey);
    }
  }

  return [];
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeProfilePart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

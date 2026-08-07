"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { optionalText } from "@/lib/formData";
import { parseNumber } from "@/lib/format";
import {
  parseBomProductWorkbook,
  parseMarginWorkbook,
  parseMasterDataWorkbook,
  parseRrpWorkbook,
  type BomProductImportRow,
  type CountryExchangeImportRow,
  type ImportError,
  type LogisticsCostImportRow,
  type MasterDataWorkbookImportResult,
  type OperationalMarginImportRow,
  type ProductCountryRrpImportRow
} from "@/lib/imports/masterDataImport";
import { createMasterDataArchive } from "@/lib/masterDataArchive";
import { masterDataImportErrorMessage } from "@/lib/masterDataImportError";
import {
  getMasterData,
  MASTER_DATA_REFERENCE_CACHE_TAG
} from "@/lib/data";
import {
  buildMasterDataImpactPreview,
  type MasterDataImpactPreview
} from "@/lib/masterDataImpact";
import { prisma } from "@/lib/prisma";
import {
  canAssignUserRole,
  canManageUserCountryAccess,
  isUserRole
} from "../../lib/auth/roles";
import { requireMasterDataEditor } from "../../lib/auth/server";
import { parsePromotionDateInput } from "../../lib/promotionPlanDates";

type Entity =
  | "country"
  | "exchangeRate"
  | "product"
  | "bomCost"
  | "logisticsCost"
  | "channelMargin"
  | "fdMargin";

export type ImportActionState = {
  status: "idle" | "success" | "error";
  message: string;
  imported: number;
  updated: number;
  skipped: number;
  summary: ImportSheetSummary[];
  errors: ImportError[];
  duplicateKeys: string[];
};

export type ImportSheetSummary = {
  label: string;
  rows: number;
};

export type MasterDataPreviewState = {
  status: "valid" | "error";
  message: string;
  summary: ImportSheetSummary[];
  errors: ImportError[];
  duplicateKeys: string[];
  impact: MasterDataImpactPreview | null;
};

const initialImportState: ImportActionState = {
  status: "idle",
  message: "",
  imported: 0,
  updated: 0,
  skipped: 0,
  summary: [],
  errors: [],
  duplicateKeys: []
};

type ImportCounters = {
  imported: number;
  updated: number;
};

type ImportedCountry = {
  id: string;
  code: string;
};

type ImportedProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
};

type MasterDataDb = typeof prisma | Prisma.TransactionClient;

export async function importMasterDataWorkbook(
  _previousState: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  const session = await requireMasterDataEditor();

  try {
    const buffer = await readWorkbookBuffer(formData);
    return await applyMasterDataWorkbookBuffer(buffer, session.email);
  } catch (error) {
    return importFailureState(error);
  }
}

export async function applyMasterDataWorkbookBuffer(
  buffer: Buffer,
  createdByEmail?: string | null
): Promise<ImportActionState> {
  const result = parseMasterDataWorkbook(buffer);
  const errors = [...result.errors, ...validateMasterDataSnapshotReferences(result)];
  const counters: ImportCounters = { imported: 0, updated: 0 };
  const countryByCode = new Map<string, ImportedCountry>();
  const productBySku = new Map<string, ImportedProduct>();

  if (errors.length > 0 || result.duplicateKeys.length > 0) {
    return importState({
      imported: counters.imported,
      updated: counters.updated,
      summary: masterDataSummary(result),
      errors,
      duplicateKeys: result.duplicateKeys
    });
  }

  if (await hasExistingMasterData()) {
    const backup = await archiveMasterDataUpdate({
      source: "MASTER_DATA_IMPORT",
      sourceReference: "Before workbook publish",
      title: "Master Data pre-import backup",
      message: "Read-only snapshot created before publishing a replacement workbook.",
      createdByEmail
    });
    if (!backup) {
      throw new Error(
        "The pre-import backup could not be created. No Master Data was changed."
      );
    }
  }

  await prisma.$transaction(
    async (tx) => {
      const snapshot = await loadMasterDataWriteSnapshot(tx);
      await synchronizeMasterDataSnapshot({
        counters,
        countryByCode,
        db: tx,
        productBySku,
        result,
        snapshot
      });
      await replaceActiveMasterDataSnapshot(result, tx, snapshot);
    },
    { maxWait: 30_000, timeout: 240_000 }
  );

  revalidateMasterDataDependents();
  const state = importState({
    imported: counters.imported,
    updated: counters.updated,
    summary: masterDataSummary(result),
    errors,
    duplicateKeys: result.duplicateKeys
  });
  const publishedArchive = await archiveMasterDataUpdate({
    source: "MASTER_DATA_IMPORT",
    sourceReference: "Published workbook",
    title: "Master Data workbook imported",
    message: `${state.imported} imported, ${state.updated} updated, ${state.skipped} skipped.`,
    createdByEmail
  });
  if (!publishedArchive) {
    state.message =
      "Master Data was published and the pre-import backup is safe, but the new-version archive needs to be retried.";
  }
  return state;
}

export async function previewMasterDataWorkbookBuffer(
  buffer: Buffer
): Promise<MasterDataPreviewState> {
  const result = parseMasterDataWorkbook(buffer);
  const errors = [...result.errors, ...validateMasterDataSnapshotReferences(result)];
  const duplicateKeys = result.duplicateKeys;
  const summary = masterDataSummary(result);

  if (errors.length > 0 || duplicateKeys.length > 0) {
    return {
      status: "error",
      message: "Workbook validation failed. No data has been changed.",
      summary,
      errors,
      duplicateKeys,
      impact: null
    };
  }

  return {
    status: "valid",
    message: "Validation passed. Review the impact before publishing.",
    summary,
    errors: [],
    duplicateKeys: [],
    impact: buildMasterDataImpactPreview(result, await getMasterData())
  };
}

export async function createMasterRecord(formData: FormData) {
  const session = await requireMasterDataEditor();

  const entity = formData.get("entity") as Entity;
  const reference = masterRecordReference(entity, formData);

  switch (entity) {
    case "country":
      await prisma.country.create({
        data: {
          name: text(formData, "name"),
          code: text(formData, "code").toUpperCase(),
          vatRate: decimal(formData, "vatRate"),
          currency: text(formData, "currency").toUpperCase(),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "exchangeRate":
      await prisma.currencyExchangeRate.create({
        data: {
          currency: text(formData, "currency").toUpperCase(),
          exchangeRateToEur: decimal(formData, "exchangeRateToEur"),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "product":
      const createLifecycleStatus = lifecycleStatus(formData);
      await prisma.product.create({
        data: {
          sku: text(formData, "sku"),
          name: text(formData, "name"),
          category: text(formData, "category"),
          capacity: optionalText(formData, "capacity"),
          lifecycleStatus: createLifecycleStatus,
          launchedAt:
            createLifecycleStatus === "LAUNCHED" ? new Date() : null,
          plannedLaunchAt: optionalDate(formData, "plannedLaunchAt"),
          status: status(formData)
        }
      });
      break;
    case "bomCost":
      await prisma.bomCost.create({
        data: {
          productId: text(formData, "productId"),
          bomCost: decimal(formData, "bomCost"),
          bomCostRmb: optionalDecimal(formData, "bomCostRmb"),
          currency: text(formData, "currency").toUpperCase(),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "logisticsCost":
      await prisma.logisticsCost.create({
        data: {
          countryId: text(formData, "countryId"),
          category: text(formData, "category"),
          productSize: text(formData, "productSize"),
          logisticsCost: decimal(formData, "logisticsCost"),
          currency: text(formData, "currency").toUpperCase(),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "channelMargin":
      await prisma.channelMargin.create({
        data: {
          countryId: text(formData, "countryId"),
          channelName: text(formData, "channelName"),
          kaName: text(formData, "kaName"),
          category: text(formData, "category"),
          normalFrontMargin: decimal(formData, "normalFrontMargin"),
          normalBackMargin: decimal(formData, "normalBackMargin"),
          promoFrontMargin: decimal(formData, "promoFrontMargin"),
          promoBackMargin: decimal(formData, "promoBackMargin"),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "fdMargin":
      await prisma.fdMargin.create({
        data: {
          countryId: text(formData, "countryId"),
          fdName: text(formData, "fdName"),
          channelName: text(formData, "channelName"),
          category: text(formData, "category"),
          normalFdMargin: decimal(formData, "normalFdMargin"),
          promoFdMargin: decimal(formData, "promoFdMargin"),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
  }

  revalidateMasterDataDependents();
  await archiveMasterDataUpdate({
    source: "MASTER_DATA_MANUAL_CREATE",
    sourceReference: reference,
    title: "Master Data record created",
    message: `${entityLabel(entity)} created: ${reference}.`,
    createdByEmail: session.email
  });
}

export async function updateMasterRecord(formData: FormData) {
  const session = await requireMasterDataEditor();

  const entity = formData.get("entity") as Entity;
  const id = text(formData, "id");
  const reference = masterRecordReference(entity, formData) || id;

  switch (entity) {
    case "country":
      await prisma.country.update({
        where: { id },
        data: {
          name: text(formData, "name"),
          code: text(formData, "code").toUpperCase(),
          vatRate: decimal(formData, "vatRate"),
          currency: text(formData, "currency").toUpperCase(),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "exchangeRate":
      await prisma.currencyExchangeRate.update({
        where: { id },
        data: {
          currency: text(formData, "currency").toUpperCase(),
          exchangeRateToEur: decimal(formData, "exchangeRateToEur"),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "product":
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { lifecycleStatus: true }
      });
      const updateLifecycleStatus = lifecycleStatus(formData);
      await prisma.product.update({
        where: { id },
        data: {
          sku: text(formData, "sku"),
          name: text(formData, "name"),
          category: text(formData, "category"),
          capacity: optionalText(formData, "capacity"),
          lifecycleStatus: updateLifecycleStatus,
          ...productLaunchData(
            existingProduct?.lifecycleStatus ?? null,
            updateLifecycleStatus
          ),
          plannedLaunchAt: optionalDate(formData, "plannedLaunchAt"),
          status: status(formData)
        }
      });
      break;
    case "bomCost":
      await prisma.bomCost.update({
        where: { id },
        data: {
          productId: text(formData, "productId"),
          bomCost: decimal(formData, "bomCost"),
          bomCostRmb: optionalDecimal(formData, "bomCostRmb"),
          currency: text(formData, "currency").toUpperCase(),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "logisticsCost":
      await prisma.logisticsCost.update({
        where: { id },
        data: {
          countryId: text(formData, "countryId"),
          category: text(formData, "category"),
          productSize: text(formData, "productSize"),
          logisticsCost: decimal(formData, "logisticsCost"),
          currency: text(formData, "currency").toUpperCase(),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "channelMargin":
      await prisma.channelMargin.update({
        where: { id },
        data: {
          countryId: text(formData, "countryId"),
          channelName: text(formData, "channelName"),
          kaName: text(formData, "kaName"),
          category: text(formData, "category"),
          normalFrontMargin: decimal(formData, "normalFrontMargin"),
          normalBackMargin: decimal(formData, "normalBackMargin"),
          promoFrontMargin: decimal(formData, "promoFrontMargin"),
          promoBackMargin: decimal(formData, "promoBackMargin"),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
    case "fdMargin":
      await prisma.fdMargin.update({
        where: { id },
        data: {
          countryId: text(formData, "countryId"),
          fdName: text(formData, "fdName"),
          channelName: text(formData, "channelName"),
          category: text(formData, "category"),
          normalFdMargin: decimal(formData, "normalFdMargin"),
          promoFdMargin: decimal(formData, "promoFdMargin"),
          status: status(formData),
          effectiveDate: date(formData, "effectiveDate")
        }
      });
      break;
  }

  revalidateMasterDataDependents();
  await archiveMasterDataUpdate({
    source: "MASTER_DATA_MANUAL_UPDATE",
    sourceReference: reference,
    title: "Master Data record updated",
    message: `${entityLabel(entity)} updated: ${reference}.`,
    createdByEmail: session.email
  });
}

export async function deleteMasterRecord(formData: FormData) {
  const session = await requireMasterDataEditor();

  const entity = formData.get("entity") as Entity;
  const id = text(formData, "id");
  const reference = masterRecordReference(entity, formData) || id;

  switch (entity) {
    case "country":
      await prisma.country.delete({ where: { id } });
      break;
    case "exchangeRate":
      await prisma.currencyExchangeRate.delete({ where: { id } });
      break;
    case "product":
      await prisma.product.delete({ where: { id } });
      break;
    case "bomCost":
      await prisma.bomCost.delete({ where: { id } });
      break;
    case "logisticsCost":
      await prisma.logisticsCost.delete({ where: { id } });
      break;
    case "channelMargin":
      await prisma.channelMargin.delete({ where: { id } });
      break;
    case "fdMargin":
      await prisma.fdMargin.delete({ where: { id } });
      break;
  }

  revalidateMasterDataDependents();
  await archiveMasterDataUpdate({
    source: "MASTER_DATA_MANUAL_DELETE",
    sourceReference: reference,
    title: "Master Data record deleted",
    message: `${entityLabel(entity)} deleted: ${reference}.`,
    createdByEmail: session.email
  });
}

export async function createUserCountryAccess(formData: FormData) {
  const session = await requireMasterDataEditor();
  if (!canManageUserCountryAccess(session.role)) {
    throw new Error("Only Admin can maintain user country access.");
  }

  const email = text(formData, "email").toLowerCase();
  const countryCode = text(formData, "countryCode").toUpperCase();
  const label = optionalText(formData, "label");
  const role = userRole(formData);
  if (!canAssignUserRole(session.role, role)) {
    throw new Error("You cannot assign this role.");
  }
  const approvalRole = promotionPlanApprovalRole(formData);
  const receivesPromotionPlanEmail =
    text(formData, "receivesPromotionPlanEmail") === "YES";
  const recordStatus = status(formData);

  await prisma.userCountryAccess.upsert({
    where: {
      email_countryCode: {
        email,
        countryCode
      }
    },
    update: {
      label,
      role,
      approvalRole,
      receivesPromotionPlanEmail,
      status: recordStatus,
      createdByEmail: session.email
    },
    create: {
      email,
      label,
      countryCode,
      role,
      approvalRole,
      receivesPromotionPlanEmail,
      status: recordStatus,
      createdByEmail: session.email
    }
  });
  revalidatePath("/master-data");
  revalidatePath("/promotion");
  revalidatePath("/platform/system/master-data");
  revalidatePath("/platform/collaboration/monthly-approvals");
  revalidatePath("/platform/collaboration/other-approvals");
}

export async function deleteUserCountryAccess(formData: FormData) {
  const session = await requireMasterDataEditor();
  if (!canManageUserCountryAccess(session.role)) {
    throw new Error("Only Admin can maintain user country access.");
  }

  const existing = await prisma.userCountryAccess.findUnique({
    where: { id: text(formData, "id") }
  });
  if (existing && !canAssignUserRole(session.role, existing.role)) {
    throw new Error("You cannot remove this role assignment.");
  }

  await prisma.userCountryAccess.delete({
    where: { id: text(formData, "id") }
  });
  revalidatePath("/master-data");
  revalidatePath("/promotion");
  revalidatePath("/platform/system/master-data");
  revalidatePath("/platform/collaboration/monthly-approvals");
  revalidatePath("/platform/collaboration/other-approvals");
}

export async function createPromotionPlanEmailRecipient(formData: FormData) {
  const session = await requireMasterDataEditor();
  if (!canManageUserCountryAccess(session.role)) {
    throw new Error("Only Admin can maintain promotion plan email recipients.");
  }

  const email = text(formData, "email").toLowerCase();
  const countryCode = text(formData, "countryCode").toUpperCase();
  await prisma.promotionPlanEmailRecipient.upsert({
    where: {
      email_countryCode: {
        email,
        countryCode
      }
    },
    update: {
      label: optionalText(formData, "label"),
      status: status(formData),
      createdByEmail: session.email
    },
    create: {
      email,
      label: optionalText(formData, "label"),
      countryCode,
      status: status(formData),
      createdByEmail: session.email
    }
  });
  revalidatePath("/master-data");
  revalidatePath("/platform/system/master-data");
}

export async function deletePromotionPlanEmailRecipient(formData: FormData) {
  const session = await requireMasterDataEditor();
  if (!canManageUserCountryAccess(session.role)) {
    throw new Error("Only Admin can maintain promotion plan email recipients.");
  }

  await prisma.promotionPlanEmailRecipient.delete({
    where: { id: text(formData, "id") }
  });
  revalidatePath("/master-data");
  revalidatePath("/platform/system/master-data");
}

export async function importBomProductData(
  _previousState: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  await requireMasterDataEditor();

  try {
    const buffer = await readWorkbookBuffer(formData);
    const result = parseBomProductWorkbook(buffer);
    let imported = 0;
    let updated = 0;

    for (const row of result.rows) {
      const existingProduct = await prisma.product.findUnique({
        where: { sku: row.model }
      });
      const product =
        existingProduct === null
          ? await prisma.product.create({
              data: {
                sku: row.model,
                name: row.name,
                category: row.category,
                capacity: null,
                lifecycleStatus: row.lifecycleStatus ?? "LAUNCHED",
                launchedAt:
                  (row.lifecycleStatus ?? "LAUNCHED") === "LAUNCHED"
                    ? new Date()
                    : null,
                ...(row.plannedLaunchDate !== undefined
                  ? {
                      plannedLaunchAt: row.plannedLaunchDate
                        ? new Date(`${row.plannedLaunchDate}T00:00:00.000Z`)
                        : null
                    }
                  : {}),
                status: "ACTIVE"
              }
            })
          : await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                name: row.name,
                category: row.category,
                ...(row.lifecycleStatus
                  ? {
                      lifecycleStatus: row.lifecycleStatus,
                  ...productLaunchData(
                        existingProduct.lifecycleStatus,
                        row.lifecycleStatus
                      )
                    }
                  : {}),
                ...(row.plannedLaunchDate !== undefined
                  ? {
                      plannedLaunchAt: row.plannedLaunchDate
                        ? new Date(`${row.plannedLaunchDate}T00:00:00.000Z`)
                        : null
                    }
                  : {})
              }
            });

      const activeBomCosts = await prisma.bomCost.findMany({
        where: {
          productId: product.id,
          status: "ACTIVE"
        },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
      });
      const bomCostData = {
        bomCost: row.bomEur.toString(),
        bomCostRmb: row.bomRmb === null ? null : row.bomRmb.toString(),
        currency: "EUR"
      };

      if (activeBomCosts.length > 0) {
        const [latestBomCost, ...olderBomCosts] = activeBomCosts;
        await prisma.bomCost.update({
          where: { id: latestBomCost.id },
          data: bomCostData
        });
        await inactivateBomCosts(olderBomCosts.map((cost) => cost.id));
        updated += 1;
      } else {
        await prisma.bomCost.create({
          data: {
            productId: product.id,
            ...bomCostData,
            effectiveDate: new Date()
          }
        });
        imported += 1;
      }
    }

    revalidateMasterDataDependents();
    return importState({
      imported,
      updated,
      errors: result.errors,
      duplicateKeys: result.duplicateKeys
    });
  } catch (error) {
    return fileErrorState(error);
  }
}

export async function importRrpData(
  _previousState: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  await requireMasterDataEditor();

  try {
    const buffer = await readWorkbookBuffer(formData);
    const result = parseRrpWorkbook(buffer);
    const errors = [...result.errors];
    let imported = 0;
    let updated = 0;

    for (const row of result.rows) {
      const [country, product] = await Promise.all([
        prisma.country.findUnique({ where: { code: row.countryCode } }),
        prisma.product.findUnique({ where: { sku: row.model } })
      ]);

      if (!country || !product) {
        errors.push({
          rowNumber: row.rowNumber,
          message: missingRrpReferenceMessage(row.countryCode, row.model, {
            hasCountry: Boolean(country),
            hasProduct: Boolean(product)
          })
        });
        continue;
      }

      const activeRrps = await prisma.productCountryRrp.findMany({
        where: {
          productId: product.id,
          countryId: country.id,
          status: "ACTIVE"
        },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
      });
      const rrpData = {
        rrpLocal: row.rrpLocal.toString(),
        rrpEur: row.rrpEur.toString(),
        currency: row.currency
      };

      if (activeRrps.length > 0) {
        const [latestRrp, ...olderRrps] = activeRrps;
        await prisma.productCountryRrp.update({
          where: { id: latestRrp.id },
          data: rrpData
        });
        await inactivateProductCountryRrps(olderRrps.map((rrp) => rrp.id));
        updated += 1;
      } else {
        await prisma.productCountryRrp.create({
          data: {
            productId: product.id,
            countryId: country.id,
            ...rrpData,
            effectiveDate: new Date()
          }
        });
        imported += 1;
      }
    }

    revalidateMasterDataDependents();
    return importState({
      imported,
      updated,
      errors,
      duplicateKeys: result.duplicateKeys
    });
  } catch (error) {
    return fileErrorState(error);
  }
}

export async function importOperationalMarginData(
  _previousState: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  await requireMasterDataEditor();

  try {
    const buffer = await readWorkbookBuffer(formData);
    const result = parseMarginWorkbook(buffer);
    const errors = [...result.errors];
    let imported = 0;
    let updated = 0;

    for (const row of result.rows) {
      const country = await prisma.country.findUnique({
        where: { code: row.countryCode }
      });

      if (!country) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `Missing country for ${row.countryCode}`
        });
        continue;
      }

      const activeMargins = await prisma.operationalMargin.findMany({
        where: {
          countryId: country.id,
          retailerName: row.retailerName,
          fdName: row.fdName,
          incoterms: row.incoterms,
          category: row.category,
          status: "ACTIVE"
        },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
      });
      const marginData = {
        kaBuyingMargin: row.kaBuyingMargin.toString(),
        kaFrontMargin: row.kaFrontMargin.toString(),
        kaBackMargin: row.kaBackMargin.toString(),
        fdMargin: row.fdMargin.toString()
      };

      if (activeMargins.length > 0) {
        const [latestMargin, ...olderMargins] = activeMargins;
        await prisma.operationalMargin.update({
          where: { id: latestMargin.id },
          data: marginData
        });
        await inactivateOperationalMargins(
          olderMargins.map((margin) => margin.id)
        );
        updated += 1;
      } else {
        await prisma.operationalMargin.create({
          data: {
            countryId: country.id,
            retailerName: row.retailerName,
            fdName: row.fdName,
            incoterms: row.incoterms,
            category: row.category,
            ...marginData,
            effectiveDate: new Date()
          }
        });
        imported += 1;
      }
    }

    revalidateMasterDataDependents();
    return importState({
      imported,
      updated,
      errors,
      duplicateKeys: result.duplicateKeys
    });
  } catch (error) {
    return fileErrorState(error);
  }
}

async function upsertCountryExchange(
  row: CountryExchangeImportRow,
  db: MasterDataDb = prisma
): Promise<{
  country: ImportedCountry;
  action: "imported" | "updated";
}> {
  await db.currencyExchangeRate.upsert({
    where: { currency: row.currency.toUpperCase() },
    update: {
      exchangeRateToEur: row.exchangeRateToEur.toString(),
      status: "ACTIVE"
    },
    create: {
      currency: row.currency.toUpperCase(),
      exchangeRateToEur: row.exchangeRateToEur.toString(),
      status: "ACTIVE",
      effectiveDate: new Date()
    }
  });

  const existingCountry = await db.country.findUnique({
    where: { code: row.countryCode }
  });
  const countryData = {
    vatRate: row.vatRate.toString(),
    currency: row.currency,
    status: "ACTIVE" as const
  };

  if (existingCountry) {
    const country = await db.country.update({
      where: { id: existingCountry.id },
      data: countryData
    });
    return { country, action: "updated" };
  }

  const country = await db.country.create({
    data: {
      name: row.countryCode,
      code: row.countryCode,
      ...countryData,
      effectiveDate: new Date()
    }
  });
  return { country, action: "imported" };
}

type MasterDataWriteSnapshot = Awaited<
  ReturnType<typeof loadMasterDataWriteSnapshot>
>;

async function loadMasterDataWriteSnapshot(db: MasterDataDb) {
  const [
    countries,
    exchangeRates,
    products,
    bomCosts,
    productCountryRrps,
    logisticsCosts,
    operationalMargins
  ] = await Promise.all([
    db.country.findMany(),
    db.currencyExchangeRate.findMany(),
    db.product.findMany(),
    db.bomCost.findMany({
      where: { status: "ACTIVE" },
      include: { product: { select: { sku: true } } },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
    }),
    db.productCountryRrp.findMany({
      where: { status: "ACTIVE" },
      include: {
        country: { select: { code: true } },
        product: { select: { sku: true } }
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
    }),
    db.logisticsCost.findMany({
      where: { status: "ACTIVE" },
      include: { country: { select: { code: true } } },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
    }),
    db.operationalMargin.findMany({
      where: { status: "ACTIVE" },
      include: { country: { select: { code: true } } },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
    })
  ]);

  return {
    countries,
    exchangeRates,
    products,
    bomCosts,
    productCountryRrps,
    logisticsCosts,
    operationalMargins
  };
}

async function synchronizeMasterDataSnapshot({
  counters,
  countryByCode,
  db,
  productBySku,
  result,
  snapshot
}: {
  counters: ImportCounters;
  countryByCode: Map<string, ImportedCountry>;
  db: MasterDataDb;
  productBySku: Map<string, ImportedProduct>;
  result: MasterDataWorkbookImportResult;
  snapshot: MasterDataWriteSnapshot;
}) {
  const countries = new Map(
    snapshot.countries.map((country) => [country.code, country])
  );
  const exchangeRates = new Map(
    snapshot.exchangeRates.map((rate) => [rate.currency.toUpperCase(), rate])
  );
  const changedCurrencies = new Set(
    result.countries
      .filter((row) => {
        const existing = exchangeRates.get(row.currency.toUpperCase());
        return (
          !existing ||
          existing.status !== "ACTIVE" ||
          !sameDecimal(existing.exchangeRateToEur, row.exchangeRateToEur)
        );
      })
      .map((row) => row.currency.toUpperCase())
  );
  const processedCurrencies = new Set<string>();

  for (const row of result.countries) {
    const currency = row.currency.toUpperCase();
    const existingRate = exchangeRates.get(currency);
    if (changedCurrencies.has(currency) && !processedCurrencies.has(currency)) {
      const rate = existingRate
        ? await db.currencyExchangeRate.update({
            where: { id: existingRate.id },
            data: {
              exchangeRateToEur: row.exchangeRateToEur.toString(),
              status: "ACTIVE"
            }
          })
        : await db.currencyExchangeRate.create({
            data: {
              currency,
              exchangeRateToEur: row.exchangeRateToEur.toString(),
              status: "ACTIVE",
              effectiveDate: new Date()
            }
          });
      exchangeRates.set(currency, rate);
      processedCurrencies.add(currency);
    }

    const existing = countries.get(row.countryCode);
    const countryChanged =
      !existing ||
      existing.status !== "ACTIVE" ||
      existing.currency.toUpperCase() !== currency ||
      !sameDecimal(existing.vatRate, row.vatRate);
    const country = !existing
      ? await db.country.create({
          data: {
            name: row.countryCode,
            code: row.countryCode,
            vatRate: row.vatRate.toString(),
            currency: row.currency,
            status: "ACTIVE",
            effectiveDate: new Date()
          }
        })
      : countryChanged
        ? await db.country.update({
            where: { id: existing.id },
            data: {
              vatRate: row.vatRate.toString(),
              currency: row.currency,
              status: "ACTIVE"
            }
          })
        : existing;

    countries.set(row.countryCode, country);
    countryByCode.set(row.countryCode, country);
    incrementCounter(
      counters,
      !existing
        ? "imported"
        : countryChanged || changedCurrencies.has(currency)
          ? "updated"
          : null
    );
  }

  const products = new Map(
    snapshot.products.map((product) => [product.sku, product])
  );
  const bomCosts = latestRowsByKey(
    snapshot.bomCosts,
    (cost) => cost.product.sku
  );

  for (const row of result.bomProducts) {
    const existing = products.get(row.model);
    const nextLifecycle = row.lifecycleStatus ?? existing?.lifecycleStatus ?? "LAUNCHED";
    const nextPlannedLaunchDate =
      row.plannedLaunchDate === undefined
        ? dateOnlyValue(existing?.plannedLaunchAt ?? null)
        : row.plannedLaunchDate ?? "";
    const productChanged =
      !existing ||
      existing.status !== "ACTIVE" ||
      existing.name !== row.name ||
      existing.category !== row.category ||
      existing.lifecycleStatus !== nextLifecycle ||
      dateOnlyValue(existing.plannedLaunchAt) !== nextPlannedLaunchDate;
    const product = !existing
      ? await db.product.create({
          data: {
            sku: row.model,
            name: row.name,
            category: row.category,
            capacity: null,
            lifecycleStatus: nextLifecycle,
            launchedAt: nextLifecycle === "LAUNCHED" ? new Date() : null,
            ...(row.plannedLaunchDate !== undefined
              ? {
                  plannedLaunchAt: row.plannedLaunchDate
                    ? new Date(`${row.plannedLaunchDate}T00:00:00.000Z`)
                    : null
                }
              : {}),
            status: "ACTIVE"
          }
        })
      : productChanged
        ? await db.product.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              category: row.category,
              lifecycleStatus: nextLifecycle,
              ...productLaunchData(existing.lifecycleStatus, nextLifecycle),
              ...(row.plannedLaunchDate !== undefined
                ? {
                    plannedLaunchAt: row.plannedLaunchDate
                      ? new Date(`${row.plannedLaunchDate}T00:00:00.000Z`)
                      : null
                  }
                : {}),
              status: "ACTIVE"
            }
          })
        : existing;

    products.set(row.model, product);
    productBySku.set(row.model, product);
    incrementCounter(counters, !existing ? "imported" : productChanged ? "updated" : null);

    const bomGroup = bomCosts.get(row.model);
    const bomChanged =
      !bomGroup ||
      !sameDecimal(bomGroup.latest.bomCost, row.bomEur) ||
      !sameNullableDecimal(bomGroup.latest.bomCostRmb, row.bomRmb) ||
      bomGroup.olderIds.length > 0;
    if (!bomGroup) {
      await db.bomCost.create({
        data: {
          productId: product.id,
          bomCost: row.bomEur.toString(),
          bomCostRmb: row.bomRmb === null ? null : row.bomRmb.toString(),
          currency: "EUR",
          effectiveDate: new Date()
        }
      });
    } else if (bomChanged) {
      await db.bomCost.update({
        where: { id: bomGroup.latest.id },
        data: {
          bomCost: row.bomEur.toString(),
          bomCostRmb: row.bomRmb === null ? null : row.bomRmb.toString(),
          currency: "EUR"
        }
      });
      await inactivateBomCosts(bomGroup.olderIds, db);
    }
    incrementCounter(counters, !bomGroup ? "imported" : bomChanged ? "updated" : null);
  }

  const rrps = latestRowsByKey(
    snapshot.productCountryRrps,
    (rrp) => snapshotKey(rrp.country.code, rrp.product.sku)
  );
  for (const row of result.productCountryRrps) {
    const country = countryByCode.get(row.countryCode);
    const product = productBySku.get(row.model);
    if (!country || !product) {
      throw new Error(`Validated RRP reference is missing for ${row.countryCode} ${row.model}.`);
    }
    const rowKey = snapshotKey(row.countryCode, row.model);
    const group = rrps.get(rowKey);
    const changed =
      !group ||
      !sameDecimal(group.latest.rrpLocal, row.rrpLocal) ||
      !sameDecimal(group.latest.rrpEur, row.rrpEur) ||
      group.latest.currency.toUpperCase() !== row.currency.toUpperCase() ||
      group.olderIds.length > 0;
    if (!group) {
      await db.productCountryRrp.create({
        data: {
          productId: product.id,
          countryId: country.id,
          rrpLocal: row.rrpLocal.toString(),
          rrpEur: row.rrpEur.toString(),
          currency: row.currency,
          effectiveDate: new Date()
        }
      });
    } else if (changed) {
      await db.productCountryRrp.update({
        where: { id: group.latest.id },
        data: {
          rrpLocal: row.rrpLocal.toString(),
          rrpEur: row.rrpEur.toString(),
          currency: row.currency
        }
      });
      await inactivateProductCountryRrps(group.olderIds, db);
    }
    incrementCounter(counters, !group ? "imported" : changed ? "updated" : null);
  }

  const logisticsCosts = latestRowsByKey(
    snapshot.logisticsCosts,
    (cost) => snapshotKey(cost.country.code, cost.category, cost.productSize)
  );
  for (const row of result.logisticsCosts) {
    for (const country of countryByCode.values()) {
      const rowKey = snapshotKey(country.code, row.category, row.incoterms);
      const group = logisticsCosts.get(rowKey);
      const changed =
        !group ||
        !sameDecimal(group.latest.logisticsCost, row.logisticsCostEur) ||
        group.latest.currency.toUpperCase() !== "EUR" ||
        group.olderIds.length > 0;
      if (!group) {
        await db.logisticsCost.create({
          data: {
            countryId: country.id,
            category: row.category,
            productSize: row.incoterms,
            logisticsCost: row.logisticsCostEur.toString(),
            currency: "EUR",
            effectiveDate: new Date()
          }
        });
      } else if (changed) {
        await db.logisticsCost.update({
          where: { id: group.latest.id },
          data: {
            logisticsCost: row.logisticsCostEur.toString(),
            currency: "EUR"
          }
        });
        await inactivateLogisticsCosts(group.olderIds, db);
      }
      incrementCounter(counters, !group ? "imported" : changed ? "updated" : null);
    }
  }

  const operationalMargins = latestRowsByKey(
    snapshot.operationalMargins,
    (margin) => snapshotKey(
      margin.country.code,
      margin.retailerName,
      margin.fdName,
      margin.incoterms,
      margin.category
    )
  );
  for (const row of result.operationalMargins) {
    const country = countryByCode.get(row.countryCode);
    if (!country) {
      throw new Error(`Validated margin country is missing for ${row.countryCode}.`);
    }
    const rowKey = snapshotKey(
      row.countryCode,
      row.retailerName,
      row.fdName,
      row.incoterms,
      row.category
    );
    const group = operationalMargins.get(rowKey);
    const changed =
      !group ||
      !sameDecimal(group.latest.kaBuyingMargin, row.kaBuyingMargin) ||
      !sameDecimal(group.latest.kaFrontMargin, row.kaFrontMargin) ||
      !sameDecimal(group.latest.kaBackMargin, row.kaBackMargin) ||
      !sameDecimal(group.latest.fdMargin, row.fdMargin) ||
      group.olderIds.length > 0;
    if (!group) {
      await db.operationalMargin.create({
        data: {
          countryId: country.id,
          retailerName: row.retailerName,
          fdName: row.fdName,
          incoterms: row.incoterms,
          category: row.category,
          kaBuyingMargin: row.kaBuyingMargin.toString(),
          kaFrontMargin: row.kaFrontMargin.toString(),
          kaBackMargin: row.kaBackMargin.toString(),
          fdMargin: row.fdMargin.toString(),
          effectiveDate: new Date()
        }
      });
    } else if (changed) {
      await db.operationalMargin.update({
        where: { id: group.latest.id },
        data: {
          kaBuyingMargin: row.kaBuyingMargin.toString(),
          kaFrontMargin: row.kaFrontMargin.toString(),
          kaBackMargin: row.kaBackMargin.toString(),
          fdMargin: row.fdMargin.toString()
        }
      });
      await inactivateOperationalMargins(group.olderIds, db);
    }
    incrementCounter(counters, !group ? "imported" : changed ? "updated" : null);
  }
}

async function upsertBomProduct(
  row: BomProductImportRow,
  db: MasterDataDb = prisma
): Promise<{
  product: ImportedProduct;
  productAction: "imported" | "updated";
  bomAction: "imported" | "updated";
}> {
  const existingProduct = await db.product.findUnique({
    where: { sku: row.model }
  });
  const product =
    existingProduct === null
      ? await db.product.create({
          data: {
            sku: row.model,
            name: row.name,
            category: row.category,
            capacity: null,
            lifecycleStatus: row.lifecycleStatus ?? "LAUNCHED",
            launchedAt:
              (row.lifecycleStatus ?? "LAUNCHED") === "LAUNCHED"
                ? new Date()
                : null,
            ...(row.plannedLaunchDate !== undefined
              ? {
                  plannedLaunchAt: row.plannedLaunchDate
                    ? new Date(`${row.plannedLaunchDate}T00:00:00.000Z`)
                    : null
                }
              : {}),
            status: "ACTIVE"
          }
        })
      : await db.product.update({
          where: { id: existingProduct.id },
          data: {
            name: row.name,
            category: row.category,
            ...(row.lifecycleStatus
              ? {
                  lifecycleStatus: row.lifecycleStatus,
              ...productLaunchData(
                    existingProduct.lifecycleStatus,
                    row.lifecycleStatus
                  )
                }
              : {}),
            ...(row.plannedLaunchDate !== undefined
              ? {
                  plannedLaunchAt: row.plannedLaunchDate
                    ? new Date(`${row.plannedLaunchDate}T00:00:00.000Z`)
                    : null
                }
              : {}),
            status: "ACTIVE"
          }
        });
  const bomAction = await upsertBomCost(product.id, row, db);

  return {
    product,
    productAction: existingProduct === null ? "imported" : "updated",
    bomAction
  };
}

async function upsertBomCost(
  productId: string,
  row: BomProductImportRow,
  db: MasterDataDb = prisma
): Promise<"imported" | "updated"> {
  const activeBomCosts = await db.bomCost.findMany({
    where: {
      productId,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const bomCostData = {
    bomCost: row.bomEur.toString(),
    bomCostRmb: row.bomRmb === null ? null : row.bomRmb.toString(),
    currency: "EUR"
  };

  if (activeBomCosts.length > 0) {
    const [latestBomCost, ...olderBomCosts] = activeBomCosts;
    await db.bomCost.update({
      where: { id: latestBomCost.id },
      data: bomCostData
    });
    await inactivateBomCosts(olderBomCosts.map((cost) => cost.id), db);
    return "updated";
  }

  await db.bomCost.create({
    data: {
      productId,
      ...bomCostData,
      effectiveDate: new Date()
    }
  });
  return "imported";
}

async function upsertRrp(
  row: ProductCountryRrpImportRow,
  countryByCode: Map<string, ImportedCountry>,
  productBySku: Map<string, ImportedProduct>,
  errors: ImportError[],
  db: MasterDataDb = prisma
): Promise<"imported" | "updated" | null> {
  const country =
    countryByCode.get(row.countryCode) ??
    (await db.country.findUnique({ where: { code: row.countryCode } }));
  const product =
    productBySku.get(row.model) ??
    (await db.product.findUnique({ where: { sku: row.model } }));

  if (!country || !product) {
    errors.push({
      sheet: "RRP",
      rowNumber: row.rowNumber,
      message: missingRrpReferenceMessage(row.countryCode, row.model, {
        hasCountry: Boolean(country),
        hasProduct: Boolean(product)
      })
    });
    return null;
  }

  const activeRrps = await db.productCountryRrp.findMany({
    where: {
      productId: product.id,
      countryId: country.id,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const rrpData = {
    rrpLocal: row.rrpLocal.toString(),
    rrpEur: row.rrpEur.toString(),
    currency: row.currency
  };

  if (activeRrps.length > 0) {
    const [latestRrp, ...olderRrps] = activeRrps;
    await db.productCountryRrp.update({
      where: { id: latestRrp.id },
      data: rrpData
    });
    await inactivateProductCountryRrps(olderRrps.map((rrp) => rrp.id), db);
    return "updated";
  }

  await db.productCountryRrp.create({
    data: {
      productId: product.id,
      countryId: country.id,
      ...rrpData,
      effectiveDate: new Date()
    }
  });
  return "imported";
}

async function upsertLogisticsForCountries(
  row: LogisticsCostImportRow,
  countryByCode: Map<string, ImportedCountry>,
  db: MasterDataDb = prisma
): Promise<ImportCounters> {
  const counters: ImportCounters = { imported: 0, updated: 0 };

  for (const country of countryByCode.values()) {
    const action = await upsertLogisticsCost(row, country, db);
    incrementCounter(counters, action);
  }

  return counters;
}

async function upsertLogisticsCost(
  row: LogisticsCostImportRow,
  country: ImportedCountry,
  db: MasterDataDb = prisma
): Promise<"imported" | "updated"> {
  const activeLogisticsCosts = await db.logisticsCost.findMany({
    where: {
      countryId: country.id,
      category: row.category,
      productSize: row.incoterms,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const logisticsCostData = {
    logisticsCost: row.logisticsCostEur.toString(),
    currency: "EUR"
  };

  if (activeLogisticsCosts.length > 0) {
    const [latestCost, ...olderCosts] = activeLogisticsCosts;
    await db.logisticsCost.update({
      where: { id: latestCost.id },
      data: logisticsCostData
    });
    await inactivateLogisticsCosts(olderCosts.map((cost) => cost.id), db);
    return "updated";
  }

  await db.logisticsCost.create({
    data: {
      countryId: country.id,
      category: row.category,
      productSize: row.incoterms,
      ...logisticsCostData,
      effectiveDate: new Date()
    }
  });
  return "imported";
}

async function upsertOperationalMargin(
  row: OperationalMarginImportRow,
  countryByCode: Map<string, ImportedCountry>,
  errors: ImportError[],
  db: MasterDataDb = prisma
): Promise<"imported" | "updated" | null> {
  const country =
    countryByCode.get(row.countryCode) ??
    (await db.country.findUnique({ where: { code: row.countryCode } }));

  if (!country) {
    errors.push({
      sheet: "Margin data",
      rowNumber: row.rowNumber,
      message: `Missing country for ${row.countryCode}`
    });
    return null;
  }

  const activeMargins = await db.operationalMargin.findMany({
    where: {
      countryId: country.id,
      retailerName: row.retailerName,
      fdName: row.fdName,
      incoterms: row.incoterms,
      category: row.category,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const marginData = {
    kaBuyingMargin: row.kaBuyingMargin.toString(),
    kaFrontMargin: row.kaFrontMargin.toString(),
    kaBackMargin: row.kaBackMargin.toString(),
    fdMargin: row.fdMargin.toString()
  };

  if (activeMargins.length > 0) {
    const [latestMargin, ...olderMargins] = activeMargins;
    await db.operationalMargin.update({
      where: { id: latestMargin.id },
      data: marginData
    });
    await inactivateOperationalMargins(olderMargins.map((margin) => margin.id), db);
    return "updated";
  }

  await db.operationalMargin.create({
    data: {
      countryId: country.id,
      retailerName: row.retailerName,
      fdName: row.fdName,
      incoterms: row.incoterms,
      category: row.category,
      ...marginData,
      effectiveDate: new Date()
    }
  });
  return "imported";
}

function validateMasterDataSnapshotReferences(
  result: MasterDataWorkbookImportResult
): ImportError[] {
  const errors: ImportError[] = [];
  const countryCodes = new Set(result.countries.map((row) => row.countryCode));
  const productSkus = new Set(result.bomProducts.map((row) => row.model));

  for (const row of result.productCountryRrps) {
    const hasCountry = countryCodes.has(row.countryCode);
    const hasProduct = productSkus.has(row.model);

    if (!hasCountry || !hasProduct) {
      errors.push({
        sheet: "RRP",
        rowNumber: row.rowNumber,
        message: missingRrpReferenceMessage(row.countryCode, row.model, {
          hasCountry,
          hasProduct
        })
      });
    }
  }

  for (const row of result.operationalMargins) {
    if (!countryCodes.has(row.countryCode)) {
      errors.push({
        sheet: "Margin data",
        rowNumber: row.rowNumber,
        message: `Missing country for ${row.countryCode}`
      });
    }
  }

  return errors;
}

async function replaceActiveMasterDataSnapshot(
  result: MasterDataWorkbookImportResult,
  db: MasterDataDb,
  snapshot: MasterDataWriteSnapshot
): Promise<void> {
  const countryCodes = result.countries.map((row) => row.countryCode);
  const currencies = result.countries.map((row) => row.currency.toUpperCase());
  const productSkus = result.bomProducts.map((row) => row.model);
  const expectedBomSkus = new Set(productSkus);
  const expectedRrpKeys = new Set(
    result.productCountryRrps.map((row) => snapshotKey(row.countryCode, row.model))
  );
  const expectedLogisticsKeys = new Set<string>();
  for (const countryCode of countryCodes) {
    for (const row of result.logisticsCosts) {
      expectedLogisticsKeys.add(snapshotKey(countryCode, row.category, row.incoterms));
    }
  }
  const expectedMarginKeys = new Set(
    result.operationalMargins.map((row) =>
      snapshotKey(
        row.countryCode,
        row.retailerName,
        row.fdName,
        row.incoterms,
        row.category
      )
    )
  );

  await db.country.updateMany({
    where: { status: "ACTIVE", code: { notIn: countryCodes } },
    data: { status: "INACTIVE" }
  });
  await db.currencyExchangeRate.updateMany({
    where: { status: "ACTIVE", currency: { notIn: currencies } },
    data: { status: "INACTIVE" }
  });
  await db.product.updateMany({
    where: { status: "ACTIVE", sku: { notIn: productSkus } },
    data: { status: "INACTIVE" }
  });

  await inactivateBomCosts(
    snapshot.bomCosts
      .filter((cost) => !expectedBomSkus.has(cost.product.sku))
      .map((cost) => cost.id),
    db
  );

  await inactivateProductCountryRrps(
    snapshot.productCountryRrps
      .filter(
        (rrp) => !expectedRrpKeys.has(snapshotKey(rrp.country.code, rrp.product.sku))
      )
      .map((rrp) => rrp.id),
    db
  );

  await inactivateLogisticsCosts(
    snapshot.logisticsCosts
      .filter(
        (cost) =>
          !expectedLogisticsKeys.has(
            snapshotKey(cost.country.code, cost.category, cost.productSize)
          )
      )
      .map((cost) => cost.id),
    db
  );

  await inactivateOperationalMargins(
    snapshot.operationalMargins
      .filter(
        (margin) =>
          !expectedMarginKeys.has(
            snapshotKey(
              margin.country.code,
              margin.retailerName,
              margin.fdName,
              margin.incoterms,
              margin.category
            )
          )
      )
      .map((margin) => margin.id),
    db
  );
}

function latestRowsByKey<
  T extends { id: string; effectiveDate: Date; createdAt: Date }
>(rows: T[], keyForRow: (row: T) => string) {
  const groups = new Map<string, { latest: T; olderIds: string[] }>();

  for (const row of rows) {
    const rowKey = keyForRow(row);
    const group = groups.get(rowKey);
    if (!group) {
      groups.set(rowKey, { latest: row, olderIds: [] });
      continue;
    }

    if (masterRowIsNewer(row, group.latest)) {
      group.olderIds.push(group.latest.id);
      group.latest = row;
    } else {
      group.olderIds.push(row.id);
    }
  }

  return groups;
}

function masterRowIsNewer(
  candidate: { effectiveDate: Date; createdAt: Date },
  current: { effectiveDate: Date; createdAt: Date }
) {
  const effectiveDifference =
    candidate.effectiveDate.getTime() - current.effectiveDate.getTime();
  return effectiveDifference > 0 ||
    (effectiveDifference === 0 && candidate.createdAt > current.createdAt);
}

function sameDecimal(value: unknown, expected: number) {
  const actual = Number(value);
  return Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9;
}

function sameNullableDecimal(value: unknown | null, expected: number | null) {
  if (value === null || value === undefined) return expected === null;
  return expected !== null && sameDecimal(value, expected);
}

function dateOnlyValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function snapshotKey(...values: string[]): string {
  return values.map((value) => value.trim()).join("\u001F");
}

function incrementCounter(
  counters: ImportCounters,
  action: "imported" | "updated" | null
) {
  if (action === "imported") {
    counters.imported += 1;
  }
  if (action === "updated") {
    counters.updated += 1;
  }
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function decimal(formData: FormData, key: string) {
  return parseNumber(formData.get(key)).toString();
}

function optionalDecimal(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  return value === null ? null : parseNumber(value).toString();
}

function date(formData: FormData, key: string) {
  const value = text(formData, key);
  const isoDate = parsePromotionDateInput(value);
  return isoDate ? new Date(`${isoDate}T00:00:00.000Z`) : new Date();
}

function optionalDate(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) {
    return null;
  }

  const isoDate = parsePromotionDateInput(value);
  if (!isoDate) {
    throw new Error(`${key} must be a valid date.`);
  }

  return new Date(`${isoDate}T00:00:00.000Z`);
}

function status(formData: FormData) {
  return text(formData, "status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function userRole(formData: FormData) {
  const value = text(formData, "role");
  if (isUserRole(value)) {
    return value;
  }

  return "VIEWER";
}

function promotionPlanApprovalRole(formData: FormData) {
  const value = text(formData, "approvalRole");
  if (value === "FIRST_APPROVER" || value === "FINAL_APPROVER") {
    return value;
  }

  return "NONE";
}

function lifecycleStatus(formData: FormData) {
  const value = text(formData, "lifecycleStatus");
  if (value === "UNLAUNCHED" || value === "EOL") {
    return value;
  }

  return "LAUNCHED";
}

function productLaunchData(
  previousStatus: "LAUNCHED" | "UNLAUNCHED" | "EOL" | null,
  nextStatus: "LAUNCHED" | "UNLAUNCHED" | "EOL"
) {
  return previousStatus !== "LAUNCHED" && nextStatus === "LAUNCHED"
    ? { launchedAt: new Date() }
    : {};
}

function revalidateMasterDataDependents() {
  revalidateTag(MASTER_DATA_REFERENCE_CACHE_TAG, { expire: 0 });
  revalidatePath("/master-data");
  revalidatePath("/");
  revalidatePath("/promotion");
  revalidatePath("/simulation");
  revalidatePath("/platform/system/master-data");
  revalidatePath("/platform/business/value-chain/on-sale");
  revalidatePath("/platform/business/value-chain/new-product");
  revalidatePath("/platform/business/bp");
  revalidatePath("/platform/collaboration/monthly-approvals");
  revalidatePath("/platform/collaboration/other-approvals");
}

async function archiveMasterDataUpdate({
  source,
  sourceReference,
  title,
  message,
  createdByEmail
}: {
  source:
    | "MASTER_DATA_IMPORT"
    | "MASTER_DATA_MANUAL_CREATE"
    | "MASTER_DATA_MANUAL_UPDATE"
    | "MASTER_DATA_MANUAL_DELETE";
  sourceReference: string;
  title: string;
  message: string;
  createdByEmail?: string | null;
}) {
  return createMasterDataArchive({
    source,
    sourceReference,
    title,
    message,
    createdByEmail
  });
}

function masterRecordReference(entity: Entity, formData: FormData) {
  switch (entity) {
    case "country":
      return text(formData, "code").toUpperCase() || text(formData, "name");
    case "exchangeRate":
      return text(formData, "currency").toUpperCase();
    case "product":
      return text(formData, "sku") || text(formData, "name");
    case "bomCost":
      return text(formData, "productId");
    case "logisticsCost":
      return [
        text(formData, "countryId"),
        text(formData, "category"),
        text(formData, "productSize")
      ]
        .filter(Boolean)
        .join(" / ");
    case "channelMargin":
      return [
        text(formData, "countryId"),
        text(formData, "channelName"),
        text(formData, "category")
      ]
        .filter(Boolean)
        .join(" / ");
    case "fdMargin":
      return [
        text(formData, "countryId"),
        text(formData, "fdName"),
        text(formData, "category")
      ]
        .filter(Boolean)
        .join(" / ");
  }
}

function entityLabel(entity: Entity) {
  switch (entity) {
    case "country":
      return "Country";
    case "exchangeRate":
      return "EXR";
    case "product":
      return "Product";
    case "bomCost":
      return "BOM";
    case "logisticsCost":
      return "Logistics";
    case "channelMargin":
      return "Channel margin";
    case "fdMargin":
      return "FD margin";
  }
}

type UploadedWorkbookFile = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

class ImportFileError extends Error {}

async function readWorkbookBuffer(formData: FormData): Promise<Buffer> {
  const file = formData.get("file");

  if (!isUploadedWorkbookFile(file) || file.size === 0) {
    throw new ImportFileError("Upload an .xlsx file.");
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new ImportFileError("Only .xlsx files are supported.");
  }

  return Buffer.from(await file.arrayBuffer());
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

function importFailureState(error: unknown): ImportActionState {
  if (error instanceof ImportFileError) {
    return {
      ...initialImportState,
      status: "error",
      message: error.message,
      errors: [],
      duplicateKeys: []
    };
  }

  const message = masterDataImportErrorMessage(error);
  return {
    ...initialImportState,
    status: "error",
    message,
    errors: [
      {
        rowNumber: 0,
        message
      }
    ],
    duplicateKeys: []
  };
}

function fileErrorState(error: unknown): ImportActionState {
  return importFailureState(error);
}

function importState({
  imported,
  updated,
  summary = [],
  errors,
  duplicateKeys
}: {
  imported: number;
  updated: number;
  summary?: ImportSheetSummary[];
  errors: ImportError[];
  duplicateKeys: string[];
}): ImportActionState {
  const hasProblems = errors.length > 0 || duplicateKeys.length > 0;

  return {
    status: hasProblems ? "error" : "success",
    message: hasProblems
      ? "Import completed with errors."
      : "Imported master data.",
    imported,
    updated,
    skipped: skippedCount(errors, duplicateKeys),
    summary,
    errors,
    duplicateKeys
  };
}

function masterDataSummary(
  result: MasterDataWorkbookImportResult
): ImportSheetSummary[] {
  return [
    { label: "EXR", rows: result.countries.length },
    { label: "Bom cost", rows: result.bomProducts.length },
    { label: "RRP", rows: result.productCountryRrps.length },
    { label: "Logistic cost", rows: result.logisticsCosts.length },
    { label: "Margin data", rows: result.operationalMargins.length }
  ];
}

async function hasExistingMasterData() {
  const data = await getMasterData();
  return [
    data.countries,
    data.products,
    data.bomCosts,
    data.productCountryRrps,
    data.logisticsCosts,
    data.operationalMargins
  ].some((rows) => rows.length > 0);
}

function skippedCount(errors: ImportError[], duplicateKeys: string[]): number {
  const sourceRows = new Set(
    errors
      .map((error) =>
        error.rowNumber > 0 ? `${error.sheet ?? "Workbook"}:${error.rowNumber}` : ""
      )
      .filter(Boolean)
  );
  const unknownErrorRows = new Set(
    errors
      .map((error) =>
        error.rowNumber === 0 ? `${error.sheet ?? "Workbook"}:0` : ""
      )
      .filter(Boolean)
  );

  return sourceRows.size + unknownErrorRows.size + duplicateKeys.length;
}

async function inactivateBomCosts(
  ids: string[],
  db: MasterDataDb = prisma
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await db.bomCost.updateMany({
    where: { id: { in: ids } },
    data: { status: "INACTIVE" }
  });
}

async function inactivateProductCountryRrps(
  ids: string[],
  db: MasterDataDb = prisma
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await db.productCountryRrp.updateMany({
    where: { id: { in: ids } },
    data: { status: "INACTIVE" }
  });
}

async function inactivateLogisticsCosts(
  ids: string[],
  db: MasterDataDb = prisma
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await db.logisticsCost.updateMany({
    where: { id: { in: ids } },
    data: { status: "INACTIVE" }
  });
}

async function inactivateOperationalMargins(
  ids: string[],
  db: MasterDataDb = prisma
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await db.operationalMargin.updateMany({
    where: { id: { in: ids } },
    data: { status: "INACTIVE" }
  });
}

function missingRrpReferenceMessage(
  countryCode: string,
  model: string,
  references: { hasCountry: boolean; hasProduct: boolean }
): string {
  if (!references.hasCountry && !references.hasProduct) {
    return `Missing country and product for ${countryCode} ${model}`;
  }
  if (!references.hasCountry) {
    return `Missing country for ${countryCode} ${model}`;
  }

  return `Missing product for ${countryCode} ${model}`;
}

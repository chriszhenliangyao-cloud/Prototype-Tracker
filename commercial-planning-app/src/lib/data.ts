import { prisma } from "./prisma";
import { unstable_cache } from "next/cache";
import type {
  BomCostOption,
  BusinessPlanApprovalQueueItem,
  BusinessPlanActualEntryOption,
  BusinessPlanChannelProfileOption,
  BusinessPlanEntryOption,
  BusinessPlanYearStatusOption,
  ChannelMarginOption,
  CountryOption,
  CurrencyExchangeRateOption,
  DashboardMetrics,
  FdMarginOption,
  LogisticsCostOption,
  MasterDataArchiveDriveStatus,
  MasterDataArchiveOption,
  OperationalMarginOption,
  ProductCountryRrpOption,
  PromotionPlanApprovalQueueItem,
  PromotionPlanEmailNotificationOption,
  PromotionPlanEmailNotificationStatus,
  PromotionPlanEmailRecipientOption,
  PromotionPlanMonthStatusOption,
  PromotionPlanArchiveDriveStatus,
  PromotionPlanArchiveOption,
  PromotionPlanEntryOption,
  PromotionPlanStatus,
  ProductOption,
  ReferenceData,
  ScenarioComparisonRow,
  UserCountryAccessOption
} from "./types";

export const MASTER_DATA_REFERENCE_CACHE_TAG = "commercial-master-data-reference";

const getCachedReferenceData = unstable_cache(
  loadReferenceData,
  ["commercial-master-data-reference-v1"],
  { tags: [MASTER_DATA_REFERENCE_CACHE_TAG], revalidate: 300 }
);

export async function getReferenceData(): Promise<ReferenceData> {
  try {
    return await getCachedReferenceData();
  } catch (error) {
    if (String(error).includes("incrementalCache missing")) {
      return loadReferenceData();
    }
    throw error;
  }
}

async function loadReferenceData(): Promise<ReferenceData> {
  const [
    countries,
    exchangeRates,
    products,
    bomCosts,
    logisticsCosts,
    productCountryRrps,
    operationalMargins,
    channelMargins,
    fdMargins
  ] = await prisma.$transaction([
    prisma.country.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ code: "asc" }]
    }),
    prisma.currencyExchangeRate.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ currency: "asc" }]
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ category: "asc" }, { sku: "asc" }]
    }),
    prisma.bomCost.findMany({
      where: { status: "ACTIVE" },
      include: { product: true },
      orderBy: [{ product: { sku: "asc" } }]
    }),
    prisma.logisticsCost.findMany({
      where: { status: "ACTIVE" },
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { category: "asc" }]
    }),
    prisma.productCountryRrp.findMany({
      where: { status: "ACTIVE" },
      include: { product: true, country: true },
      orderBy: [{ country: { code: "asc" } }, { product: { sku: "asc" } }]
    }),
    prisma.operationalMargin.findMany({
      where: { status: "ACTIVE" },
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { retailerName: "asc" }]
    }),
    prisma.channelMargin.findMany({
      where: { status: "ACTIVE" },
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { channelName: "asc" }]
    }),
    prisma.fdMargin.findMany({
      where: { status: "ACTIVE" },
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { fdName: "asc" }]
    })
  ]);

  return {
    countries: countries.map(serializeCountry),
    exchangeRates: exchangeRates.map(serializeExchangeRate),
    products: products.map(serializeProduct),
    bomCosts: bomCosts.map(serializeBomCost),
    logisticsCosts: logisticsCosts.map((cost) => ({
      id: cost.id,
      countryId: cost.countryId,
      countryCode: cost.country.code,
      category: cost.category,
      productSize: cost.productSize,
      logisticsCost: Number(cost.logisticsCost),
      currency: cost.currency,
      effectiveDate: cost.effectiveDate.toISOString(),
      status: cost.status
    })),
    productCountryRrps: productCountryRrps.map(serializeProductCountryRrp),
    operationalMargins: operationalMargins.map(serializeOperationalMargin),
    channelMargins: channelMargins.map((margin) => ({
      id: margin.id,
      countryId: margin.countryId,
      countryCode: margin.country.code,
      channelName: margin.channelName,
      kaName: margin.kaName,
      category: margin.category,
      normalFrontMargin: Number(margin.normalFrontMargin),
      normalBackMargin: Number(margin.normalBackMargin),
      promoFrontMargin: Number(margin.promoFrontMargin),
      promoBackMargin: Number(margin.promoBackMargin),
      effectiveDate: margin.effectiveDate.toISOString(),
      status: margin.status
    })),
    fdMargins: fdMargins.map((margin) => ({
      id: margin.id,
      countryId: margin.countryId,
      countryCode: margin.country.code,
      fdName: margin.fdName,
      channelName: margin.channelName,
      category: margin.category,
      normalFdMargin: Number(margin.normalFdMargin),
      promoFdMargin: Number(margin.promoFdMargin),
      effectiveDate: margin.effectiveDate.toISOString(),
      status: margin.status
    }))
  };
}

export async function getMasterData(): Promise<ReferenceData> {
  const [
    countries,
    exchangeRates,
    products,
    bomCosts,
    logisticsCosts,
    productCountryRrps,
    operationalMargins,
    channelMargins,
    fdMargins
  ] = await prisma.$transaction([
    prisma.country.findMany({ orderBy: [{ code: "asc" }] }),
    prisma.currencyExchangeRate.findMany({ orderBy: [{ currency: "asc" }] }),
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { sku: "asc" }] }),
    prisma.bomCost.findMany({
      include: { product: true },
      orderBy: [{ product: { sku: "asc" } }]
    }),
    prisma.logisticsCost.findMany({
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { category: "asc" }]
    }),
    prisma.productCountryRrp.findMany({
      include: { product: true, country: true },
      orderBy: [{ country: { code: "asc" } }, { product: { sku: "asc" } }]
    }),
    prisma.operationalMargin.findMany({
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { retailerName: "asc" }]
    }),
    prisma.channelMargin.findMany({
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { channelName: "asc" }]
    }),
    prisma.fdMargin.findMany({
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }, { fdName: "asc" }]
    })
  ]);

  return {
    countries: countries.map(serializeCountry),
    exchangeRates: exchangeRates.map(serializeExchangeRate),
    products: products.map(serializeProduct),
    bomCosts: bomCosts.map(serializeBomCost),
    logisticsCosts: logisticsCosts.map((cost) => ({
      id: cost.id,
      countryId: cost.countryId,
      countryCode: cost.country.code,
      category: cost.category,
      productSize: cost.productSize,
      logisticsCost: Number(cost.logisticsCost),
      currency: cost.currency,
      effectiveDate: cost.effectiveDate.toISOString(),
      status: cost.status
    })),
    productCountryRrps: productCountryRrps.map(serializeProductCountryRrp),
    operationalMargins: operationalMargins.map(serializeOperationalMargin),
    channelMargins: channelMargins.map((margin) => ({
      id: margin.id,
      countryId: margin.countryId,
      countryCode: margin.country.code,
      channelName: margin.channelName,
      kaName: margin.kaName,
      category: margin.category,
      normalFrontMargin: Number(margin.normalFrontMargin),
      normalBackMargin: Number(margin.normalBackMargin),
      promoFrontMargin: Number(margin.promoFrontMargin),
      promoBackMargin: Number(margin.promoBackMargin),
      effectiveDate: margin.effectiveDate.toISOString(),
      status: margin.status
    })),
    fdMargins: fdMargins.map((margin) => ({
      id: margin.id,
      countryId: margin.countryId,
      countryCode: margin.country.code,
      fdName: margin.fdName,
      channelName: margin.channelName,
      category: margin.category,
      normalFdMargin: Number(margin.normalFdMargin),
      promoFdMargin: Number(margin.promoFdMargin),
      effectiveDate: margin.effectiveDate.toISOString(),
      status: margin.status
    }))
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const scenarios = await prisma.scenario.findMany({
    include: { result: true }
  });

  const gpPercents = scenarios
    .map((scenario) => decimalToNullableNumber(scenario.result?.gpPercent))
    .filter((value): value is number => value !== null);
  const npPercents = scenarios
    .map((scenario) => decimalToNullableNumber(scenario.result?.npPercent))
    .filter((value): value is number => value !== null);

  return {
    averageGpPercent: average(gpPercents),
    averageNpPercent: average(npPercents),
    totalRebate: scenarios.reduce(
      (sum, scenario) =>
        sum + (decimalToNullableNumber(scenario.result?.totalRebate) ?? 0),
      0
    ),
    lowGpScenarios: scenarios.filter(
      (scenario) =>
        scenario.type === "NORMAL" &&
        ["WARNING", "CRITICAL"].includes(scenario.result?.warningLevel ?? "")
    ).length,
    lowNpPromotionScenarios: scenarios.filter(
      (scenario) =>
        scenario.type === "PROMOTION" &&
        ["WARNING", "CRITICAL"].includes(scenario.result?.warningLevel ?? "")
    ).length,
    pendingApprovalScenarios: scenarios.filter(
      (scenario) => scenario.status === "SUBMITTED"
    ).length,
    scenarioCount: scenarios.length
  };
}

export async function getScenarioComparisonRows(): Promise<
  ScenarioComparisonRow[]
> {
  const scenarios = await prisma.scenario.findMany({
    include: {
      country: true,
      product: true,
      channelMargin: true,
      fdMargin: true,
      input: true,
      result: true
    },
    orderBy: { createdAt: "desc" }
  });

  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    type: scenario.type,
    country: scenario.country.name,
    countryCode: scenario.country.code,
    currency: scenario.country.currency,
    sku: scenario.product.sku,
    productName: scenario.product.name,
    channel: scenario.channelMargin.channelName,
    kaName: scenario.channelMargin.kaName,
    fdName: scenario.fdMargin.fdName,
    status: scenario.status,
    settlementMode: scenario.settlementMode,
    normalRrp: decimalToNullableNumber(scenario.input?.normalRrp),
    promoRrp: decimalToNullableNumber(scenario.input?.promoRrp),
    rebatePerUnit: decimalToNullableNumber(scenario.result?.rebatePerUnit),
    totalRebate: decimalToNullableNumber(scenario.result?.totalRebate),
    gp: decimalToNullableNumber(scenario.result?.gp),
    gpPercent: decimalToNullableNumber(scenario.result?.gpPercent),
    np: decimalToNullableNumber(scenario.result?.np),
    npPercent: decimalToNullableNumber(scenario.result?.npPercent),
    warningLevel: scenario.result?.warningLevel ?? "GOOD",
    createdAt: scenario.createdAt.toISOString()
  }));
}

export async function getRecentMasterDataArchives(
  limit = 8
): Promise<MasterDataArchiveOption[]> {
  const archives = await prisma.masterDataArchive.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return archives.map((archive) => ({
    id: archive.id,
    source: archive.source,
    sourceReference: archive.sourceReference,
    title: archive.title,
    message: archive.message,
    workbookFileName: archive.workbookFileName,
    driveStatus: archive.driveStatus as MasterDataArchiveDriveStatus,
    driveFileId: archive.driveFileId,
    driveUrl: archive.driveUrl,
    createdByEmail: archive.createdByEmail,
    createdAt: archive.createdAt.toISOString(),
    updatedAt: archive.updatedAt.toISOString()
  }));
}

export async function getPromotionPlanEntries(
  planYear: number,
  planMonth: number,
  countryCodes?: string[]
): Promise<PromotionPlanEntryOption[]> {
  if (countryCodes && countryCodes.length === 0) {
    return [];
  }

  const entries = await prisma.promotionPlanEntry.findMany({
    where: {
      planYear,
      planMonth,
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    orderBy: [
      { countryCode: "asc" },
      { retailerName: "asc" },
      { fdName: "asc" },
      { productSku: "asc" }
    ]
  });

  return entries.map(serializePromotionPlanEntry);
}

export async function getPromotionPlanEntriesForMonths(
  months: Array<{ year: number; month: number }>,
  countryCodes?: string[]
): Promise<PromotionPlanEntryOption[]> {
  if (months.length === 0 || (countryCodes && countryCodes.length === 0)) {
    return [];
  }

  const entries = await prisma.promotionPlanEntry.findMany({
    where: {
      OR: months.map((month) => ({
        planYear: month.year,
        planMonth: month.month
      })),
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    orderBy: [
      { planYear: "asc" },
      { planMonth: "asc" },
      { countryCode: "asc" },
      { retailerName: "asc" },
      { fdName: "asc" },
      { productSku: "asc" }
    ]
  });

  return entries.map(serializePromotionPlanEntry);
}

export async function getBusinessPlanEntries(
  planYear: number,
  countryCodes?: string[]
): Promise<BusinessPlanEntryOption[]> {
  if (countryCodes && countryCodes.length === 0) {
    return [];
  }

  const entries = await prisma.businessPlanEntry.findMany({
    where: {
      planYear,
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    orderBy: [
      { countryCode: "asc" },
      { retailerName: "asc" },
      { fdName: "asc" },
      { productSku: "asc" },
      { planMonth: "asc" }
    ]
  });

  return entries.map(serializeBusinessPlanEntry);
}

export async function getBusinessPlanActualEntries(
  planYear: number,
  countryCodes?: string[]
): Promise<BusinessPlanActualEntryOption[]> {
  if (countryCodes && countryCodes.length === 0) {
    return [];
  }

  const entries = await prisma.businessPlanActualEntry.findMany({
    where: {
      planYear,
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    orderBy: [
      { countryCode: "asc" },
      { planMonth: "asc" },
      { customerName: "asc" },
      { poDate: "asc" },
      { poNumber: "asc" }
    ]
  });

  return entries.map(serializeBusinessPlanActualEntry);
}

export async function getBusinessPlanChannelProfiles(
  planYear: number,
  countryCodes?: string[]
): Promise<BusinessPlanChannelProfileOption[]> {
  if (countryCodes && countryCodes.length === 0) {
    return [];
  }

  const profiles = await prisma.businessPlanChannelProfile.findMany({
    where: {
      planYear,
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    include: { productOverrides: { orderBy: { productSku: "asc" } } },
    orderBy: [
      { countryCode: "asc" },
      { retailerName: "asc" },
      { fdName: "asc" },
      { incoterms: "asc" }
    ]
  });

  return profiles.map(serializeBusinessPlanChannelProfile);
}

export async function getUserCountryAccesses(): Promise<
  UserCountryAccessOption[]
> {
  const accessRows = await prisma.userCountryAccess.findMany({
    orderBy: [{ email: "asc" }, { countryCode: "asc" }]
  });

  return accessRows.map((row) => ({
    id: row.id,
    email: row.email,
    label: row.label,
    countryCode: row.countryCode,
    role: row.role,
    approvalRole: row.approvalRole,
    receivesPromotionPlanEmail: row.receivesPromotionPlanEmail,
    status: row.status,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

export async function getPromotionPlanEmailRecipients(): Promise<
  PromotionPlanEmailRecipientOption[]
> {
  const recipients = await prisma.promotionPlanEmailRecipient.findMany({
    orderBy: [
      { countryCode: "asc" },
      { email: "asc" }
    ]
  });

  return recipients.map(serializePromotionPlanEmailRecipient);
}

export async function getBusinessPlanYearStatuses({
  planYear,
  countryCodes
}: {
  planYear: number;
  countryCodes?: string[];
}): Promise<BusinessPlanYearStatusOption[]> {
  const statuses = await prisma.businessPlanYearStatus.findMany({
    where: {
      planYear,
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    orderBy: [{ countryCode: "asc" }]
  });

  return statuses.map(serializeBusinessPlanYearStatus);
}

export async function getBusinessPlanApprovalQueue({
  countryCodes,
  canFirstApprove,
  canFinalApprove,
  limit = 50
}: {
  countryCodes?: string[];
  canFirstApprove: boolean;
  canFinalApprove: boolean;
  limit?: number;
}): Promise<BusinessPlanApprovalQueueItem[]> {
  if ((countryCodes && countryCodes.length === 0) || (!canFirstApprove && !canFinalApprove)) {
    return [];
  }

  // Both approval roles can inspect active plans from submission. Only the
  // approver assigned to the current stage receives action permissions.
  const reviewStatuses: PromotionPlanStatus[] = ["SUBMITTED", "FIRST_APPROVED"];

  const statuses = await prisma.businessPlanYearStatus.findMany({
    where: {
      status: { in: reviewStatuses },
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    }
  });
  const sortedStatuses = statuses
    .sort((left, right) => approvalQueueTime(right) - approvalQueueTime(left))
    .slice(0, limit);

  if (sortedStatuses.length === 0) {
    return [];
  }

  const entryCounts = await prisma.businessPlanEntry.groupBy({
    by: ["planYear", "countryCode"],
    where: {
      OR: sortedStatuses.map((status) => ({
        planYear: status.planYear,
        countryCode: status.countryCode
      }))
    },
    _count: { _all: true }
  });
  const entryCountByKey = new Map(
    entryCounts.map((count) => [
      businessPlanStatusKey(count.planYear, count.countryCode),
      count._count._all
    ])
  );

  return sortedStatuses.map((status) => ({
    id: status.id,
    planYear: status.planYear,
    countryCode: status.countryCode,
    status: status.status === "FIRST_APPROVED" ? "FIRST_APPROVED" : "SUBMITTED",
    submittedByEmail: status.submittedByEmail,
    submittedAt: status.submittedAt?.toISOString() ?? null,
    entryCount:
      entryCountByKey.get(businessPlanStatusKey(status.planYear, status.countryCode)) ??
      0,
    stage: status.status === "FIRST_APPROVED" ? "final" : "first",
    updatedAt: status.updatedAt.toISOString()
  }));
}

export async function getPromotionPlanMonthStatuses({
  planYear,
  planMonth,
  countryCodes
}: {
  planYear: number;
  planMonth: number;
  countryCodes?: string[];
}): Promise<PromotionPlanMonthStatusOption[]> {
  const statuses = await prisma.promotionPlanMonthStatus.findMany({
    where: {
      planYear,
      planMonth,
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    },
    orderBy: [{ countryCode: "asc" }]
  });

  return statuses.map(serializePromotionPlanMonthStatus);
}

export async function getPromotionPlanApprovalQueue({
  countryCodes,
  canFirstApprove,
  canFinalApprove,
  limit = 50
}: {
  countryCodes?: string[];
  canFirstApprove: boolean;
  canFinalApprove: boolean;
  limit?: number;
}): Promise<PromotionPlanApprovalQueueItem[]> {
  if ((countryCodes && countryCodes.length === 0) || (!canFirstApprove && !canFinalApprove)) {
    return [];
  }

  // The final approver can inspect a new submission immediately, as in Other
  // Approvals. Action permissions below remain tied to the active stage.
  const reviewStatuses: PromotionPlanStatus[] = canFinalApprove
    ? ["SUBMITTED", "FIRST_APPROVED"]
    : ["SUBMITTED"];

  const statuses = await prisma.promotionPlanMonthStatus.findMany({
    where: {
      status: { in: reviewStatuses },
      ...(countryCodes && countryCodes.length > 0
        ? { countryCode: { in: countryCodes } }
        : {})
    }
  });

  const sortedStatuses = statuses
    .sort((left, right) => approvalQueueTime(right) - approvalQueueTime(left))
    .slice(0, limit);

  if (sortedStatuses.length === 0) {
    return [];
  }

  const entryCounts = await prisma.promotionPlanEntry.groupBy({
    by: ["planYear", "planMonth", "countryCode"],
    where: {
      OR: sortedStatuses.map((status) => ({
        planYear: status.planYear,
        planMonth: status.planMonth,
        countryCode: status.countryCode
      }))
    },
    _count: { _all: true }
  });
  const entryCountByKey = new Map(
    entryCounts.map((count) => [
      promotionPlanStatusKey(count.planYear, count.planMonth, count.countryCode),
      count._count._all
    ])
  );

  return sortedStatuses.map((status) => {
    const stage = status.status === "FIRST_APPROVED" ? "final" : "first";
    const canApprove =
      stage === "first" ? canFirstApprove : canFinalApprove;

    return {
      id: status.id,
      planYear: status.planYear,
      planMonth: status.planMonth,
      countryCode: status.countryCode,
      status: status.status === "FIRST_APPROVED" ? "FIRST_APPROVED" : "SUBMITTED",
      submittedByEmail: status.submittedByEmail,
      submittedAt: status.submittedAt?.toISOString() ?? null,
      entryCount:
        entryCountByKey.get(
          promotionPlanStatusKey(status.planYear, status.planMonth, status.countryCode)
        ) ?? 0,
      stage,
      canApprove,
      canReturnForRevision: canApprove,
      updatedAt: status.updatedAt.toISOString()
    };
  });
}

export async function getRecentPromotionPlanArchives(
  limit = 8
): Promise<PromotionPlanArchiveOption[]> {
  const archives = await prisma.promotionPlanArchive.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return archives.map((archive) => ({
    id: archive.id,
    planYear: archive.planYear,
    planMonth: archive.planMonth,
    source: archive.source,
    sourceReference: archive.sourceReference,
    title: archive.title,
    message: archive.message,
    workbookFileName: archive.workbookFileName,
    driveStatus: archive.driveStatus as PromotionPlanArchiveDriveStatus,
    driveFileId: archive.driveFileId,
    driveUrl: archive.driveUrl,
    createdByEmail: archive.createdByEmail,
    createdAt: archive.createdAt.toISOString(),
    updatedAt: archive.updatedAt.toISOString()
  }));
}

export async function getRecentPromotionPlanEmailNotifications(
  limit = 20
): Promise<PromotionPlanEmailNotificationOption[]> {
  const notifications = await prisma.promotionPlanEmailNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return notifications.map(serializePromotionPlanEmailNotification);
}

function serializeCountry(country: {
  id: string;
  name: string;
  code: string;
  vatRate: unknown;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  effectiveDate: Date;
}): CountryOption {
  return {
    id: country.id,
    name: country.name,
    code: country.code,
    vatRate: Number(country.vatRate),
    currency: country.currency,
    status: country.status,
    effectiveDate: country.effectiveDate.toISOString()
  };
}

function serializeExchangeRate(rate: {
  id: string;
  currency: string;
  exchangeRateToEur: unknown;
  effectiveDate: Date;
  status: "ACTIVE" | "INACTIVE";
}): CurrencyExchangeRateOption {
  return {
    id: rate.id,
    currency: rate.currency,
    exchangeRateToEur: Number(rate.exchangeRateToEur),
    effectiveDate: rate.effectiveDate.toISOString(),
    status: rate.status
  };
}

function serializeProduct(product: {
  id: string;
  sku: string;
  name: string;
  category: string;
  capacity: string | null;
  lifecycleStatus: "LAUNCHED" | "UNLAUNCHED" | "EOL";
  launchedAt: Date | null;
  plannedLaunchAt: Date | null;
  status: "ACTIVE" | "INACTIVE";
}): ProductOption {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    capacity: product.capacity,
    lifecycleStatus: product.lifecycleStatus,
    launchedAt: product.launchedAt?.toISOString() ?? null,
    plannedLaunchAt: product.plannedLaunchAt?.toISOString() ?? null,
    status: product.status
  };
}

function serializeBomCost(cost: {
  id: string;
  productId: string;
  product: {
    sku: string;
    name: string;
  };
  bomCost: unknown;
  bomCostRmb: unknown | null;
  currency: string;
  effectiveDate: Date;
  status: "ACTIVE" | "INACTIVE";
}): BomCostOption {
  return {
    id: cost.id,
    productId: cost.productId,
    productSku: cost.product.sku,
    productName: cost.product.name,
    bomCost: Number(cost.bomCost),
    bomCostRmb: decimalToNullableNumber(cost.bomCostRmb),
    currency: cost.currency,
    effectiveDate: cost.effectiveDate.toISOString(),
    status: cost.status
  };
}

function serializeProductCountryRrp(rrp: {
  id: string;
  productId: string;
  product: {
    sku: string;
    name: string;
  };
  countryId: string;
  country: {
    code: string;
  };
  rrpLocal: unknown;
  rrpEur: unknown;
  currency: string;
  effectiveDate: Date;
  status: "ACTIVE" | "INACTIVE";
}): ProductCountryRrpOption {
  return {
    id: rrp.id,
    productId: rrp.productId,
    productSku: rrp.product.sku,
    productName: rrp.product.name,
    countryId: rrp.countryId,
    countryCode: rrp.country.code,
    rrpLocal: Number(rrp.rrpLocal),
    rrpEur: Number(rrp.rrpEur),
    currency: rrp.currency,
    effectiveDate: rrp.effectiveDate.toISOString(),
    status: rrp.status
  };
}

function serializeOperationalMargin(margin: {
  id: string;
  countryId: string;
  country: {
    code: string;
  };
  retailerName: string;
  fdName: string;
  incoterms: string;
  category: string;
  kaBuyingMargin: unknown;
  kaFrontMargin: unknown;
  kaBackMargin: unknown;
  fdMargin: unknown;
  effectiveDate: Date;
  status: "ACTIVE" | "INACTIVE";
}): OperationalMarginOption {
  return {
    id: margin.id,
    countryId: margin.countryId,
    countryCode: margin.country.code,
    retailerName: margin.retailerName,
    fdName: margin.fdName,
    incoterms: margin.incoterms,
    category: margin.category,
    kaBuyingMargin: Number(margin.kaBuyingMargin),
    kaFrontMargin: Number(margin.kaFrontMargin),
    kaBackMargin: Number(margin.kaBackMargin),
    fdMargin: Number(margin.fdMargin),
    effectiveDate: margin.effectiveDate.toISOString(),
    status: margin.status
  };
}

export function serializePromotionPlanEntry(entry: {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  retailerName: string;
  promotionName?: string | null;
  fdName: string;
  incoterms: string;
  category: string;
  productSku: string;
  productName: string | null;
  promoRrpLocal: unknown | null;
  promoRrpEur: unknown | null;
  promoFrontMargin: unknown | null;
  dealType?: string | null;
  promoFdMargin?: unknown | null;
  dealNote?: string | null;
  promoVolume: number | null;
  promoStartDate: Date | null;
  promoEndDate: Date | null;
  snapshotCurrency: string | null;
  snapshotLifecycleStatus: "LAUNCHED" | "UNLAUNCHED" | "EOL" | null;
  snapshotRrpLocal: unknown | null;
  snapshotRrpEur: unknown | null;
  snapshotVatRate: unknown | null;
  snapshotBaseFrontMargin: unknown | null;
  snapshotKaBuyingMargin: unknown | null;
  snapshotKaBackMargin: unknown | null;
  snapshotFdMargin: unknown | null;
  snapshotTransportCost: unknown | null;
  snapshotBomCost: unknown | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromotionPlanEntryOption {
  return {
    id: entry.id,
    planYear: entry.planYear,
    planMonth: entry.planMonth,
    countryCode: entry.countryCode,
    retailerName: entry.retailerName,
    promotionName: entry.promotionName ?? null,
    fdName: entry.fdName,
    incoterms: entry.incoterms,
    category: entry.category,
    productSku: entry.productSku,
    productName: entry.productName,
    promoRrpLocal: decimalToNullableNumber(entry.promoRrpLocal),
    promoRrpEur: decimalToNullableNumber(entry.promoRrpEur),
    promoFrontMargin: decimalToNullableNumber(entry.promoFrontMargin),
    dealType:
      entry.dealType === "B2B_DEAL" || entry.dealType === "EOL_DEAL"
        ? entry.dealType
        : "NORMAL",
    promoFdMargin: decimalToNullableNumber(entry.promoFdMargin ?? null),
    dealNote: entry.dealNote ?? null,
    promoVolume: entry.promoVolume,
    promoStartDate: dateToInputValue(entry.promoStartDate),
    promoEndDate: dateToInputValue(entry.promoEndDate),
    snapshotCurrency: entry.snapshotCurrency,
    snapshotLifecycleStatus: entry.snapshotLifecycleStatus,
    snapshotRrpLocal: decimalToNullableNumber(entry.snapshotRrpLocal),
    snapshotRrpEur: decimalToNullableNumber(entry.snapshotRrpEur),
    snapshotVatRate: decimalToNullableNumber(entry.snapshotVatRate),
    snapshotBaseFrontMargin: decimalToNullableNumber(entry.snapshotBaseFrontMargin),
    snapshotKaBuyingMargin: decimalToNullableNumber(entry.snapshotKaBuyingMargin),
    snapshotKaBackMargin: decimalToNullableNumber(entry.snapshotKaBackMargin),
    snapshotFdMargin: decimalToNullableNumber(entry.snapshotFdMargin),
    snapshotTransportCost: decimalToNullableNumber(entry.snapshotTransportCost),
    snapshotBomCost: decimalToNullableNumber(entry.snapshotBomCost),
    createdByEmail: entry.createdByEmail,
    updatedByEmail: entry.updatedByEmail,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function serializeBusinessPlanEntry(entry: {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  category: string;
  productSku: string;
  productName: string | null;
  channelProfileId?: string | null;
  promoPriceLocal: unknown | null;
  promoDiscountPercent: unknown | null;
  siUnits: number;
  soUnits: number;
  source?: string | null;
  snapshotCurrency?: string | null;
  snapshotRrpLocal?: unknown | null;
  snapshotRrpEur?: unknown | null;
  snapshotKaBuyingMargin?: unknown | null;
  snapshotKaFrontMargin?: unknown | null;
  snapshotKaBackMargin?: unknown | null;
  snapshotFdMargin?: unknown | null;
  snapshotBomCost?: unknown | null;
  snapshotLogisticsCost?: unknown | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BusinessPlanEntryOption {
  return {
    id: entry.id,
    planYear: entry.planYear,
    planMonth: entry.planMonth,
    countryCode: entry.countryCode,
    retailerName: entry.retailerName,
    fdName: entry.fdName,
    incoterms: entry.incoterms,
    category: entry.category,
    productSku: entry.productSku,
    productName: entry.productName,
    channelProfileId: entry.channelProfileId ?? null,
    promoPriceLocal: decimalToNullableNumber(entry.promoPriceLocal),
    promoDiscountPercent:
      decimalToNullableNumber(entry.promoDiscountPercent) ?? 0,
    siUnits: entry.siUnits,
    soUnits: entry.soUnits,
    source:
      entry.source === "BP_ASSUMPTION" ? "BP_ASSUMPTION" : "MASTER_DATA",
    snapshotCurrency: entry.snapshotCurrency ?? null,
    snapshotRrpLocal: decimalToNullableNumber(entry.snapshotRrpLocal),
    snapshotRrpEur: decimalToNullableNumber(entry.snapshotRrpEur),
    snapshotKaBuyingMargin: decimalToNullableNumber(
      entry.snapshotKaBuyingMargin
    ),
    snapshotKaFrontMargin: decimalToNullableNumber(entry.snapshotKaFrontMargin),
    snapshotKaBackMargin: decimalToNullableNumber(entry.snapshotKaBackMargin),
    snapshotFdMargin: decimalToNullableNumber(entry.snapshotFdMargin),
    snapshotBomCost: decimalToNullableNumber(entry.snapshotBomCost),
    snapshotLogisticsCost: decimalToNullableNumber(entry.snapshotLogisticsCost),
    createdByEmail: entry.createdByEmail,
    updatedByEmail: entry.updatedByEmail,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function serializeBusinessPlanActualEntry(entry: {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  customerName: string;
  poNumber: string;
  poDate: Date;
  productModel: string | null;
  productName: string | null;
  sourceLineKey: string;
  siUnits: unknown;
  siValueEur: unknown;
  sourceFileName: string | null;
  importedByEmail: string | null;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): BusinessPlanActualEntryOption {
  return {
    id: entry.id,
    planYear: entry.planYear,
    planMonth: entry.planMonth,
    countryCode: entry.countryCode,
    customerName: entry.customerName,
    poNumber: entry.poNumber,
    poDate: entry.poDate.toISOString(),
    productModel: entry.productModel,
    productName: entry.productName,
    sourceLineKey: entry.sourceLineKey,
    siUnits: decimalToNullableNumber(entry.siUnits) ?? 0,
    siValueEur: decimalToNullableNumber(entry.siValueEur) ?? 0,
    sourceFileName: entry.sourceFileName,
    importedByEmail: entry.importedByEmail,
    importedAt: entry.importedAt.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function serializeBusinessPlanChannelProfile(profile: {
  id: string;
  planYear: number;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  kaBuyingMargin: unknown;
  kaFrontMargin: unknown;
  kaBackMargin: unknown;
  fdMargin: unknown;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  productOverrides: Array<{
    id: string;
    channelProfileId: string;
    productSku: string;
    rrpLocal: unknown | null;
    rrpEur: unknown | null;
    currency: string | null;
    kaBuyingMargin: unknown | null;
    kaFrontMargin: unknown | null;
    kaBackMargin: unknown | null;
    fdMargin: unknown | null;
    bomCost: unknown | null;
    logisticsCost: unknown | null;
    createdByEmail: string | null;
    updatedByEmail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): BusinessPlanChannelProfileOption {
  return {
    id: profile.id,
    planYear: profile.planYear,
    countryCode: profile.countryCode,
    retailerName: profile.retailerName,
    fdName: profile.fdName,
    incoterms: profile.incoterms,
    kaBuyingMargin: Number(profile.kaBuyingMargin),
    kaFrontMargin: Number(profile.kaFrontMargin),
    kaBackMargin: Number(profile.kaBackMargin),
    fdMargin: Number(profile.fdMargin),
    productOverrides: profile.productOverrides.map((override) => ({
      id: override.id,
      channelProfileId: override.channelProfileId,
      productSku: override.productSku,
      rrpLocal: decimalToNullableNumber(override.rrpLocal),
      rrpEur: decimalToNullableNumber(override.rrpEur),
      currency: override.currency,
      kaBuyingMargin: decimalToNullableNumber(override.kaBuyingMargin),
      kaFrontMargin: decimalToNullableNumber(override.kaFrontMargin),
      kaBackMargin: decimalToNullableNumber(override.kaBackMargin),
      fdMargin: decimalToNullableNumber(override.fdMargin),
      bomCost: decimalToNullableNumber(override.bomCost),
      logisticsCost: decimalToNullableNumber(override.logisticsCost),
      createdByEmail: override.createdByEmail,
      updatedByEmail: override.updatedByEmail,
      createdAt: override.createdAt.toISOString(),
      updatedAt: override.updatedAt.toISOString()
    })),
    createdByEmail: profile.createdByEmail,
    updatedByEmail: profile.updatedByEmail,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

function dateToInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function approvalQueueTime(status: {
  submittedAt: Date | null;
  updatedAt: Date;
}) {
  return (status.submittedAt ?? status.updatedAt).getTime();
}

function promotionPlanStatusKey(
  planYear: number,
  planMonth: number,
  countryCode: string
) {
  return `${planYear}-${planMonth}-${countryCode}`;
}

function businessPlanStatusKey(planYear: number, countryCode: string) {
  return `${planYear}-${countryCode}`;
}

function serializePromotionPlanMonthStatus(status: {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  status: string;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: Date | null;
  firstApprovedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromotionPlanMonthStatusOption {
  return {
    id: status.id,
    planYear: status.planYear,
    planMonth: status.planMonth,
    countryCode: status.countryCode,
    status: promotionPlanStatus(status.status),
    submittedByEmail: status.submittedByEmail,
    firstApprovedByEmail: status.firstApprovedByEmail,
    approvedByEmail: status.approvedByEmail,
    rejectedByEmail: status.rejectedByEmail,
    submittedAt: status.submittedAt?.toISOString() ?? null,
    firstApprovedAt: status.firstApprovedAt?.toISOString() ?? null,
    approvedAt: status.approvedAt?.toISOString() ?? null,
    rejectedAt: status.rejectedAt?.toISOString() ?? null,
    notes: status.notes,
    createdAt: status.createdAt.toISOString(),
    updatedAt: status.updatedAt.toISOString()
  };
}

function serializeBusinessPlanYearStatus(status: {
  id: string;
  planYear: number;
  countryCode: string;
  status: string;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: Date | null;
  firstApprovedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BusinessPlanYearStatusOption {
  return {
    id: status.id,
    planYear: status.planYear,
    countryCode: status.countryCode,
    status: promotionPlanStatus(status.status),
    submittedByEmail: status.submittedByEmail,
    firstApprovedByEmail: status.firstApprovedByEmail,
    approvedByEmail: status.approvedByEmail,
    rejectedByEmail: status.rejectedByEmail,
    submittedAt: status.submittedAt?.toISOString() ?? null,
    firstApprovedAt: status.firstApprovedAt?.toISOString() ?? null,
    approvedAt: status.approvedAt?.toISOString() ?? null,
    rejectedAt: status.rejectedAt?.toISOString() ?? null,
    notes: status.notes,
    createdAt: status.createdAt.toISOString(),
    updatedAt: status.updatedAt.toISOString()
  };
}

function serializePromotionPlanEmailRecipient(recipient: {
  id: string;
  email: string;
  label: string | null;
  countryCode: string;
  status: "ACTIVE" | "INACTIVE";
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromotionPlanEmailRecipientOption {
  return {
    id: recipient.id,
    email: recipient.email,
    label: recipient.label,
    countryCode: recipient.countryCode,
    status: recipient.status,
    createdByEmail: recipient.createdByEmail,
    createdAt: recipient.createdAt.toISOString(),
    updatedAt: recipient.updatedAt.toISOString()
  };
}

function serializePromotionPlanEmailNotification(notification: {
  id: string;
  archiveId: string | null;
  planYear: number;
  planMonth: number;
  countryCodes: string;
  toEmails: string;
  ccEmails: string;
  status: string;
  provider?: string | null;
  attemptCount?: number | null;
  lastAttemptAt?: Date | null;
  messageId?: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromotionPlanEmailNotificationOption {
  return {
    id: notification.id,
    archiveId: notification.archiveId,
    planYear: notification.planYear,
    planMonth: notification.planMonth,
    countryCodes: parseJsonStringArray(notification.countryCodes),
    toEmails: parseJsonStringArray(notification.toEmails),
    ccEmails: parseJsonStringArray(notification.ccEmails),
    status: promotionPlanEmailNotificationStatus(notification.status),
    provider: notification.provider || "SES",
    attemptCount: notification.attemptCount ?? 0,
    lastAttemptAt: notification.lastAttemptAt?.toISOString() ?? null,
    messageId: notification.messageId ?? null,
    errorMessage: notification.errorMessage,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdByEmail: notification.createdByEmail,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString()
  };
}

function promotionPlanStatus(status: string): PromotionPlanStatus {
  return status === "SUBMITTED" ||
    status === "FIRST_APPROVED" ||
    status === "APPROVED" ||
    status === "REJECTED"
    ? status
    : "DRAFT";
}

function promotionPlanEmailNotificationStatus(
  status: string
): PromotionPlanEmailNotificationStatus {
  return status === "SENT" ||
    status === "FAILED" ||
    status === "PENDING" ||
    status === "NOT_CONFIGURED"
    ? status
    : "NOT_CONFIGURED";
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function decimalToNullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

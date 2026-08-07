import { PromotionCalculator } from "@/components/PromotionCalculator";
import { PromotionApprovalPageShell } from "@/components/PromotionApprovalPageShell";
import { requireUser } from "@/lib/auth/server";
import {
  canBypassPromotionPlanLocks,
  canManagePromotionPlanApprovalHistory,
  canSaveScenario,
  canViewAllCountries
} from "@/lib/auth/roles";
import { getOtherApprovalRequests } from "@/lib/otherApprovals";
import {
  getPromotionPlanApprovalQueue,
  getPromotionPlanEntries,
  getRecentPromotionPlanArchives,
  getRecentPromotionPlanEmailNotifications,
  getPromotionPlanMonthStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  canDownloadPromotionPlanHistory,
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import {
  canApprovePromotionPlanWithCapabilities,
  getPromotionPlanApproverCapabilities
} from "@/lib/promotionPlanApprovalWorkflow";
import { buildNewLaunchedProductReview } from "@/lib/promotionPlanNewLaunch";
import type {
  PromotionPlanEmailNotificationOption,
  PromotionPlanArchiveOption
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PromotionPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PromotionWorkspace({ searchParams, returnTo: "/promotion" });
}

export async function PromotionWorkspace({
  searchParams,
  returnTo
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  returnTo: string;
}) {
  const session = await requireUser(returnTo);
  const params = await searchParams;
  const today = new Date();
  const selectedYear =
    toPlanYear(params.year) ?? today.getFullYear();
  const selectedMonth =
    toPlanMonth(params.month) ?? today.getMonth() + 1;
  const initialModule = toApprovalWorkspace(params.workspace);
  const initialOtherApprovalId = toRequestId(params.requestId);
  const initialDeliveryDialogOpen = toBooleanFlag(params.deliveryStatus);

  const [data, countryAccesses] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  const approvalCapabilities = getPromotionPlanApproverCapabilities({
    role: effectiveRole,
    email: session.email,
    accessRows: countryAccesses
  });
  const canApprovePlan = canApprovePromotionPlanWithCapabilities(
    approvalCapabilities
  );
  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    countryAccesses,
    data.countries
  );
  const canSeeAllCountries = canViewAllCountries(effectiveRole);
  const canDownloadPlanHistory = canDownloadPromotionPlanHistory(
    effectiveRole,
    accessibleCountryCodes
  );
  const visibleData =
    canSeeAllCountries
      ? data
      : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  const visibleCountryCodes =
    canSeeAllCountries
      ? visibleData.countries.map((country) => country.code)
      : accessibleCountryCodes;
  const reviewCountryCode = toCountryCode(params.country, visibleCountryCodes);
  const [
    planEntries,
    monthStatuses,
    approvalQueue,
    recentApprovalArchives,
    recentEmailNotifications,
    otherApprovals
  ] = await Promise.all([
    getPromotionPlanEntries(
      selectedYear,
      selectedMonth,
      canSeeAllCountries ? undefined : accessibleCountryCodes
    ),
    getPromotionPlanMonthStatuses({
      planYear: selectedYear,
      planMonth: selectedMonth,
      countryCodes: visibleCountryCodes
    }),
    getPromotionPlanApprovalQueue({
      countryCodes: visibleCountryCodes,
      canFirstApprove: approvalCapabilities.canFirstApprove,
      canFinalApprove: approvalCapabilities.canFinalApprove
    }),
    getRecentPromotionPlanArchives(50),
    getRecentPromotionPlanEmailNotifications(50),
    getOtherApprovalRequests({
      countryCodes: visibleCountryCodes,
      limit: 120
    })
  ]);
  const deliveryStatus =
    canApprovePlan || canSeeAllCountries
      ? filterPromotionPlanDeliveryStatus({
          archives: recentApprovalArchives,
          notifications: recentEmailNotifications,
          visibleCountryCodes
        })
      : { archives: [], notifications: [] };
  const newLaunchedProducts = buildNewLaunchedProductReview({
    data: visibleData,
    entries: planEntries,
    targetMonth: { year: selectedYear, month: selectedMonth }
  });

  return (
    <PromotionApprovalPageShell
      canFinalApprove={approvalCapabilities.canFinalApprove}
      canFirstApprove={approvalCapabilities.canFirstApprove}
      canApproveMonthlyPlan={canApprovePlan}
      canManageApprovalHistory={canManagePromotionPlanApprovalHistory(effectiveRole)}
      canManagePromotionBackfill={canBypassPromotionPlanLocks(effectiveRole)}
      canManageAllOtherApprovals={canBypassPromotionPlanLocks(effectiveRole)}
      canSaveOtherApprovals={canSaveScenario(effectiveRole)}
      canSeeAllCountries={canSeeAllCountries}
      countries={visibleData.countries}
      monthlyApprovalQueue={approvalQueue}
      monthlyDeliveryArchives={deliveryStatus.archives}
      monthlyDeliveryNotifications={deliveryStatus.notifications}
      otherApprovals={otherApprovals}
      initialModule={initialModule}
      initialOtherApprovalId={initialOtherApprovalId}
      initialDeliveryDialogOpen={initialDeliveryDialogOpen}
      userEmail={session.email}
    >
      <PromotionCalculator
        accessibleCountryCodes={accessibleCountryCodes}
        approvalQueue={approvalQueue}
        canApprovePlan={canApprovePlan}
        canFinalApprovePlan={approvalCapabilities.canFinalApprove}
        canFirstApprovePlan={approvalCapabilities.canFirstApprove}
        canSavePlan={canSaveScenario(effectiveRole)}
        canDownloadPlanHistory={canDownloadPlanHistory}
        data={visibleData}
        recentApprovalArchives={deliveryStatus.archives}
        recentEmailNotifications={deliveryStatus.notifications}
        monthStatuses={monthStatuses}
        newLaunchedProducts={newLaunchedProducts}
        planEntries={planEntries}
        role={effectiveRole}
        reviewCountryCode={reviewCountryCode}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        userEmail={session.email}
      />
    </PromotionApprovalPageShell>
  );
}

function filterPromotionPlanDeliveryStatus({
  archives,
  notifications,
  visibleCountryCodes
}: {
  archives: PromotionPlanArchiveOption[];
  notifications: PromotionPlanEmailNotificationOption[];
  visibleCountryCodes: string[];
}) {
  const visibleSet = new Set(
    visibleCountryCodes.map((countryCode) => countryCode.toUpperCase())
  );
  const visibleNotifications = notifications.filter((notification) =>
    notification.countryCodes.some((countryCode) =>
      visibleSet.has(countryCode.toUpperCase())
    )
  );
  const visibleArchiveIds = new Set(
    visibleNotifications
      .map((notification) => notification.archiveId)
      .filter((archiveId): archiveId is string => Boolean(archiveId))
  );

  return {
    notifications: visibleNotifications,
    archives: archives.filter((archive) => visibleArchiveIds.has(archive.id))
  };
}

function toPlanYear(value: string | string[] | undefined) {
  const year = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toPlanMonth(value: string | string[] | undefined) {
  const month = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function toApprovalWorkspace(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) === "other-approvals"
    ? "other-approvals" as const
    : "monthly" as const;
}

function toRequestId(value: string | string[] | undefined) {
  const requestId = String(Array.isArray(value) ? value[0] : value ?? "").trim();
  return requestId.length > 0 && requestId.length <= 160 ? requestId : null;
}

function toBooleanFlag(value: string | string[] | undefined) {
  return ["1", "true"].includes(
    String(Array.isArray(value) ? value[0] : value ?? "").toLowerCase()
  );
}

function toCountryCode(
  value: string | string[] | undefined,
  accessibleCountryCodes: string[]
) {
  const countryCode = String(Array.isArray(value) ? value[0] : value ?? "")
    .trim()
    .toUpperCase();
  return accessibleCountryCodes.includes(countryCode) ? countryCode : null;
}

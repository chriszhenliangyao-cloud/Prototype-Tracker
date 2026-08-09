import { BusinessPlanPlanner } from "@/components/BusinessPlanPlanner";
import { canSaveScenario, canViewAllCountries } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/server";
import { resolveBusinessPlanCountryCode } from "@/lib/businessPlanCountrySelection";
import { businessPlanDraftLinesFromEntries } from "@/lib/businessPlanPersistence";
import {
  getBusinessPlanApprovalQueue,
  getBusinessPlanActualEntries,
  getBusinessPlanChannelProfiles,
  getBusinessPlanEntries,
  getBusinessPlanYearStatuses,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import {
  canApprovePromotionPlanWithCapabilities,
  getPromotionPlanApproverCapabilities
} from "@/lib/promotionPlanApprovalWorkflow";

export const dynamic = "force-dynamic";

export default async function BusinessPlanPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return BusinessPlanWorkspace({
    searchParams,
    returnTo: "/business-plan"
  });
}

export async function BusinessPlanWorkspace({
  searchParams,
  returnTo
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  returnTo: string;
}) {
  const session = await requireUser(returnTo);
  const params = await searchParams;
  const today = new Date();
  const selectedYear = toPlanYear(params.year) ?? today.getFullYear();

  const [data, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    accessRows
  );
  const approvalCapabilities = getPromotionPlanApproverCapabilities({
    role: effectiveRole,
    email: session.email,
    accessRows
  });
  const canSeeAllCountries = canViewAllCountries(effectiveRole);
  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    accessRows,
    data.countries
  );
  const visibleData = canSeeAllCountries
    ? data
    : filterReferenceDataByCountryCodes(data, accessibleCountryCodes);
  const visibleCountryCodes = visibleData.countries.map((country) => country.code);
  const selectedCountryCode = resolveBusinessPlanCountryCode({
    defaultToAllMarkets: canSeeAllCountries,
    requestedCountry: params.country,
    visibleCountryCodes
  });
  const selectedCountryCodes = selectedCountryCode
    ? [selectedCountryCode]
    : visibleCountryCodes;
  const selectedCountryData = selectedCountryCode
    ? filterReferenceDataByCountryCodes(visibleData, [selectedCountryCode])
    : visibleData;
  const canApprovePlan = canApprovePromotionPlanWithCapabilities(
    approvalCapabilities
  );
  const [entries, actuals, channelProfiles, yearStatuses, approvalQueue] = await Promise.all([
    selectedCountryCodes.length > 0
      ? getBusinessPlanEntries(selectedYear, selectedCountryCodes)
      : Promise.resolve([]),
    selectedCountryCodes.length > 0
      ? getBusinessPlanActualEntries(selectedYear, selectedCountryCodes)
      : Promise.resolve([]),
    selectedCountryCodes.length > 0
      ? getBusinessPlanChannelProfiles(selectedYear, selectedCountryCodes)
      : Promise.resolve([]),
    getBusinessPlanYearStatuses({
      planYear: selectedYear,
      countryCodes: visibleCountryCodes
    }),
    getBusinessPlanApprovalQueue({
      countryCodes: visibleCountryCodes,
      canFirstApprove: approvalCapabilities.canFirstApprove,
      canFinalApprove: approvalCapabilities.canFinalApprove
    })
  ]);
  const initialDraftLines = businessPlanDraftLinesFromEntries(
    entries,
    selectedCountryData
  );

  return (
    <BusinessPlanPlanner
      approvalQueue={approvalQueue}
      canApprovePlan={canApprovePlan}
      canChangeCountry={visibleCountryCodes.length > 1}
      canFinalApprovePlan={approvalCapabilities.canFinalApprove}
      canFirstApprovePlan={approvalCapabilities.canFirstApprove}
      canSavePlan={canSaveScenario(effectiveRole)}
      countryOptions={visibleCountryCodes}
      data={selectedCountryData}
      initialActuals={actuals}
      initialDraftLines={initialDraftLines}
      initialChannelProfiles={channelProfiles}
      selectedCountryCode={selectedCountryCode}
      selectedYear={selectedYear}
      userEmail={session.email}
      yearStatuses={yearStatuses}
    />
  );
}

function toPlanYear(value: string | string[] | undefined) {
  const year = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

import type {
  CountryOption,
  PromotionPlanStatus,
  ReferenceData,
  UserCountryAccessOption,
  UserRole
} from "./types";
import {
  canBypassPromotionPlanLocks,
  canViewAllCountries
} from "./auth/roles";

export type PromotionPlanLockReason =
  | "submitted"
  | "first approved"
  | "approved"
  | "deadline passed"
  | "no country access";

export type PromotionPlanEditState = {
  editable: boolean;
  reason: PromotionPlanLockReason | null;
};

const roleStrength: UserRole[] = [
  "VIEWER",
  "KA_OWNER",
  "SALES_MANAGER",
  "FINANCE",
  "GM",
  "ADMIN",
  "GTM_LEADER",
  "OWNER"
];
const GLOBAL_COUNTRY_CODE = "GLOBAL";

export function isPromotionPlanAdmin(role: UserRole) {
  return canViewAllCountries(role);
}

export function getEffectivePromotionPlanRole(
  baseRole: UserRole,
  email: string | null | undefined,
  accessRows: UserCountryAccessOption[]
): UserRole {
  const normalizedEmail = normalizeEmail(email);
  const candidateRoles = [baseRole];

  if (normalizedEmail) {
    for (const row of accessRows) {
      if (!isActiveUserPermission(row)) {
        continue;
      }

      if (normalizeEmail(row.email) === normalizedEmail) {
        candidateRoles.push(row.role);
      }
    }
  }

  return candidateRoles.reduce((strongest, role) =>
    roleStrength.indexOf(role) > roleStrength.indexOf(strongest)
      ? role
      : strongest
  );
}

export function getAccessibleCountryCodes(
  role: UserRole,
  email: string | null | undefined,
  accessRows: UserCountryAccessOption[],
  countries: CountryOption[]
) {
  if (canViewAllCountries(role)) {
    return countries.map((country) => country.code).sort();
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const validCountries = new Set(countries.map((country) => country.code));
  const rowsForUser = accessRows.filter(
    (row) =>
      isActiveUserPermission(row) && normalizeEmail(row.email) === normalizedEmail
  );

  if (
    rowsForUser.some(
      (row) => row.countryCode.toUpperCase() === GLOBAL_COUNTRY_CODE
    )
  ) {
    return [...validCountries].sort();
  }

  return [
    ...new Set(
      rowsForUser
        .map((row) => row.countryCode.toUpperCase())
        .filter((countryCode) => validCountries.has(countryCode))
    )
  ].sort();
}

export function hasPromotionCountryAccess(
  role: UserRole,
  countryCode: string,
  accessibleCountryCodes: string[]
) {
  return (
    isPromotionPlanAdmin(role) ||
    accessibleCountryCodes.includes(countryCode.toUpperCase())
  );
}

export function canDownloadPromotionPlanHistory(
  role: UserRole,
  accessibleCountryCodes: string[]
) {
  return canViewAllCountries(role) || accessibleCountryCodes.length > 0;
}

export function isPromotionPlanDeadlineLocked({
  planYear,
  planMonth,
  now = new Date()
}: {
  planYear: number;
  planMonth: number;
  now?: Date;
}) {
  const madrid = madridYearMonth(now);
  return (
    madrid.year > planYear ||
    (madrid.year === planYear && madrid.month >= planMonth)
  );
}

export function getPromotionPlanEditState({
  role,
  hasCountryAccess,
  planYear,
  planMonth,
  status = "DRAFT",
  now = new Date()
}: {
  role: UserRole;
  hasCountryAccess: boolean;
  planYear: number;
  planMonth: number;
  status?: PromotionPlanStatus | null;
  now?: Date;
}): PromotionPlanEditState {
  if (canBypassPromotionPlanLocks(role)) {
    return { editable: true, reason: null };
  }

  if (!hasCountryAccess) {
    return { editable: false, reason: "no country access" };
  }

  if (status === "SUBMITTED") {
    return { editable: false, reason: "submitted" };
  }

  if (status === "APPROVED") {
    return { editable: false, reason: "approved" };
  }

  if (status === "FIRST_APPROVED") {
    return { editable: false, reason: "first approved" };
  }

  if (isPromotionPlanDeadlineLocked({ planYear, planMonth, now })) {
    return { editable: false, reason: "deadline passed" };
  }

  return { editable: true, reason: null };
}

export function filterReferenceDataByCountryCodes(
  data: ReferenceData,
  countryCodes: string[]
): ReferenceData {
  const allowedCodes = new Set(countryCodes.map((code) => code.toUpperCase()));
  if (allowedCodes.size === 0) {
    return {
      ...data,
      countries: [],
      exchangeRates: data.exchangeRates ? [] : data.exchangeRates,
      products: [],
      bomCosts: [],
      logisticsCosts: [],
      productCountryRrps: [],
      operationalMargins: [],
      channelMargins: [],
      fdMargins: []
    };
  }

  const allowedCountryIds = new Set(
    data.countries
      .filter((country) => allowedCodes.has(country.code))
      .map((country) => country.id)
  );

  const countries = data.countries.filter((country) =>
    allowedCodes.has(country.code.toUpperCase())
  );
  const logisticsCosts = data.logisticsCosts.filter(
    (cost) =>
      allowedCodes.has(cost.countryCode.toUpperCase()) ||
      allowedCountryIds.has(cost.countryId)
  );
  const productCountryRrps = data.productCountryRrps.filter(
    (rrp) =>
      allowedCodes.has(rrp.countryCode.toUpperCase()) ||
      allowedCountryIds.has(rrp.countryId)
  );
  const operationalMargins = data.operationalMargins.filter(
    (margin) =>
      allowedCodes.has(margin.countryCode.toUpperCase()) ||
      allowedCountryIds.has(margin.countryId)
  );
  const channelMargins = data.channelMargins.filter(
    (margin) =>
      allowedCodes.has(margin.countryCode.toUpperCase()) ||
      allowedCountryIds.has(margin.countryId)
  );
  const fdMargins = data.fdMargins.filter(
    (margin) =>
      allowedCodes.has(margin.countryCode.toUpperCase()) ||
      allowedCountryIds.has(margin.countryId)
  );
  const allowedProductIds = new Set(
    productCountryRrps.map((rrp) => rrp.productId)
  );
  const products = data.products.filter((product) =>
    allowedProductIds.has(product.id)
  );
  const bomCosts = data.bomCosts.filter((cost) =>
    allowedProductIds.has(cost.productId)
  );
  const allowedCurrencies = new Set(
    [
      ...countries.map((country) => country.currency),
      ...productCountryRrps.map((rrp) => rrp.currency),
      "EUR",
      "RMB"
    ].map(normalizeCurrency)
  );
  const exchangeRates = data.exchangeRates?.filter((rate) =>
    allowedCurrencies.has(normalizeCurrency(rate.currency))
  );

  return {
    ...data,
    countries,
    exchangeRates,
    products,
    bomCosts,
    logisticsCosts,
    productCountryRrps,
    operationalMargins,
    channelMargins,
    fdMargins
  };
}

function madridYearMonth(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value)
  };
}

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeCurrency(currency: string) {
  return currency.trim().toUpperCase();
}

function isActiveUserPermission(row: UserCountryAccessOption) {
  return row.status === "ACTIVE";
}

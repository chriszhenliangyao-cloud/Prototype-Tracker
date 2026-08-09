import type {
  CountryOption,
  ReferenceData,
  UserCountryAccessOption,
  UserRole
} from "./types";
import {
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  hasPromotionCountryAccess,
  isPromotionPlanAdmin
} from "./promotionPlanAccess";

export type CountryScopedReferenceData = {
  accessibleCountryCodes: string[];
  data: ReferenceData;
  role: UserRole;
};

export function getEffectiveCountryAccessRole(
  baseRole: UserRole,
  email: string | null | undefined,
  accessRows: UserCountryAccessOption[]
) {
  return getEffectivePromotionPlanRole(baseRole, email, accessRows);
}

export function isCountryAccessAdmin(role: UserRole) {
  return isPromotionPlanAdmin(role);
}

export function hasCountryAccess(
  role: UserRole,
  countryCode: string,
  accessibleCountryCodes: string[]
) {
  return hasPromotionCountryAccess(role, countryCode, accessibleCountryCodes);
}

export { filterReferenceDataByCountryCodes, getAccessibleCountryCodes };

export function getCountryScopedReferenceData({
  accessRows,
  baseRole,
  data,
  email
}: {
  accessRows: UserCountryAccessOption[];
  baseRole: UserRole;
  data: ReferenceData;
  email: string | null | undefined;
}): CountryScopedReferenceData {
  const role = getEffectiveCountryAccessRole(baseRole, email, accessRows);
  const accessibleCountryCodes = getAccessibleCountryCodes(
    role,
    email,
    accessRows,
    data.countries
  );

  return {
    accessibleCountryCodes,
    data:
      isCountryAccessAdmin(role)
        ? data
        : filterReferenceDataByCountryCodes(data, accessibleCountryCodes),
    role
  };
}

export function countryCodesForRole({
  accessRows,
  baseRole,
  countries,
  email
}: {
  accessRows: UserCountryAccessOption[];
  baseRole: UserRole;
  countries: CountryOption[];
  email: string | null | undefined;
}) {
  const role = getEffectiveCountryAccessRole(baseRole, email, accessRows);
  return {
    accessibleCountryCodes: getAccessibleCountryCodes(
      role,
      email,
      accessRows,
      countries
    ),
    role
  };
}

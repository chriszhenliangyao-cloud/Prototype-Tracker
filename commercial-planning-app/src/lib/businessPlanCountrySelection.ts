export function resolveBusinessPlanCountryCode({
  defaultToAllMarkets,
  requestedCountry,
  visibleCountryCodes
}: {
  defaultToAllMarkets: boolean;
  requestedCountry: string | string[] | undefined;
  visibleCountryCodes: string[];
}): string | null {
  const selection = parseBusinessPlanCountrySelection(
    requestedCountry,
    visibleCountryCodes
  );

  if (selection !== undefined) {
    return selection;
  }

  if (defaultToAllMarkets) {
    return null;
  }

  return visibleCountryCodes[0] ?? null;
}

function parseBusinessPlanCountrySelection(
  value: string | string[] | undefined,
  visibleCountryCodes: string[]
): string | null | undefined {
  const countryCode = String(Array.isArray(value) ? value[0] : value ?? "")
    .trim()
    .toUpperCase();

  if (!countryCode) {
    return undefined;
  }

  if (countryCode === "ALL") {
    return null;
  }

  return visibleCountryCodes.includes(countryCode) ? countryCode : undefined;
}

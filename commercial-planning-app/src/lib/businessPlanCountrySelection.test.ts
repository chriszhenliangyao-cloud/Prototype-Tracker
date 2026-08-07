import { describe, expect, it } from "vitest";
import { resolveBusinessPlanCountryCode } from "./businessPlanCountrySelection";

describe("resolveBusinessPlanCountryCode", () => {
  it("defaults all-country users to the all-market BP view", () => {
    expect(
      resolveBusinessPlanCountryCode({
        defaultToAllMarkets: true,
        requestedCountry: undefined,
        visibleCountryCodes: ["ES", "FR", "PL"]
      })
    ).toBeNull();
  });

  it("keeps an explicitly selected country for all-country users", () => {
    expect(
      resolveBusinessPlanCountryCode({
        defaultToAllMarkets: true,
        requestedCountry: "pl",
        visibleCountryCodes: ["ES", "FR", "PL"]
      })
    ).toBe("PL");
  });

  it("defaults restricted users to their first visible country", () => {
    expect(
      resolveBusinessPlanCountryCode({
        defaultToAllMarkets: false,
        requestedCountry: undefined,
        visibleCountryCodes: ["PL"]
      })
    ).toBe("PL");
  });

  it("supports an explicit all-market request for any multi-country view", () => {
    expect(
      resolveBusinessPlanCountryCode({
        defaultToAllMarkets: false,
        requestedCountry: "ALL",
        visibleCountryCodes: ["ES", "PL"]
      })
    ).toBeNull();
  });
});

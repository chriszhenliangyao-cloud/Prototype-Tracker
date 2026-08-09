import { describe, expect, it } from "vitest";
import { getBusinessPlanEditState } from "./businessPlanAccess";

describe("business plan access", () => {
  it("locks BP editing once a country-year is submitted or approved", () => {
    expect(
      getBusinessPlanEditState({
        hasCountryAccess: true,
        status: "DRAFT"
      })
    ).toEqual({ editable: true, reason: null });

    expect(
      getBusinessPlanEditState({
        hasCountryAccess: true,
        status: "SUBMITTED"
      })
    ).toEqual({ editable: false, reason: "submitted" });

    expect(
      getBusinessPlanEditState({
        hasCountryAccess: true,
        status: "APPROVED"
      })
    ).toEqual({ editable: false, reason: "approved" });
  });

  it("requires country access before BP editing", () => {
    expect(
      getBusinessPlanEditState({
        hasCountryAccess: false,
        status: "DRAFT"
      })
    ).toEqual({ editable: false, reason: "no country access" });
  });
});

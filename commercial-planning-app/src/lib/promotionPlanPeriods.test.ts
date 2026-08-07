import { describe, expect, it } from "vitest";
import { findPromotionPlanPeriodOverlap } from "./promotionPlanPeriods";

const scope = {
  scopeKey: "PL|MEX|Komsa|DDP|P75-P1",
  countryCode: "PL",
  retailerName: "MEX",
  fdName: "Komsa",
  productSku: "P75-P1"
};

describe("promotion plan periods", () => {
  it("allows separate price periods for the same channel product when dates do not overlap", () => {
    expect(
      findPromotionPlanPeriodOverlap([
        { ...scope, promotionName: "Launch", promoStartDate: "2026-08-01", promoEndDate: "2026-08-10" },
        { ...scope, promotionName: "Mid-month", promoStartDate: "2026-08-15", promoEndDate: "2026-08-25" },
        { ...scope, promotionName: "Finale", promoStartDate: "2026-08-26", promoEndDate: "2026-08-30" }
      ])
    ).toBeNull();
  });

  it("allows a non-overlapping period to continue into the following month", () => {
    expect(
      findPromotionPlanPeriodOverlap([
        {
          ...scope,
          promotionName: "August close",
          promoStartDate: "2026-08-20",
          promoEndDate: "2026-09-28"
        }
      ])
    ).toBeNull();
  });

  it("blocks inclusive date overlaps for the same channel product", () => {
    const overlap = findPromotionPlanPeriodOverlap([
      { ...scope, promotionName: "First", promoStartDate: "2026-08-01", promoEndDate: "2026-08-10" },
      { ...scope, promotionName: "Second", promoStartDate: "2026-08-10", promoEndDate: "2026-08-20" }
    ]);

    expect(overlap?.first.promotionName).toBe("First");
    expect(overlap?.second.promotionName).toBe("Second");
  });

  it("keeps the same product independent across different channel scopes", () => {
    expect(
      findPromotionPlanPeriodOverlap([
        { ...scope, promoStartDate: "2026-08-01", promoEndDate: "2026-08-20" },
        {
          ...scope,
          scopeKey: "PL|X-Kom|Komsa|DDP|P75-P1",
          retailerName: "X-Kom",
          promoStartDate: "2026-08-01",
          promoEndDate: "2026-08-20"
        }
      ])
    ).toBeNull();
  });
});

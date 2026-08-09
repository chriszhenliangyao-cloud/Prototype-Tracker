import { describe, expect, test } from "vitest";
import {
  buildPromotionMap,
  buildPromotionMapDays,
  buildPromotionMapProductOptions,
  filterPromotionMapRowsByProduct,
  type PromotionMapRowSource
} from "./promotionMap";

describe("promotion map", () => {
  test("builds one day column for each day in the selected month", () => {
    const days = buildPromotionMapDays({ year: 2026, month: 2 });

    expect(days).toHaveLength(28);
    expect(days[0]).toMatchObject({
      date: "2026-02-01",
      dayOfMonth: 1,
      label: "1-Feb"
    });
    expect(days[27]).toMatchObject({
      date: "2026-02-28",
      dayOfMonth: 28,
      label: "28-Feb"
    });
  });

  test("clips cross-month promotions to the visible month range", () => {
    const map = buildPromotionMap({
      rows: [
        promotionRow({
          promoStartDate: "2026-06-25",
          promoEndDate: "2026-07-05"
        })
      ],
      month: { year: 2026, month: 7 }
    });

    expect(map.groups).toHaveLength(1);
    expect(map.groups[0]?.blocks[0]).toMatchObject({
      startDate: "2026-06-25",
      endDate: "2026-07-05",
      visibleStartDate: "2026-07-01",
      visibleEndDate: "2026-07-05",
      startDayIndex: 0,
      spanDays: 5
    });
  });

  test("merges products for the same country, channel, and date range", () => {
    const map = buildPromotionMap({
      rows: [
        promotionRow({ model: "P41L-P1", productName: "PowerPaw 10K" }),
        promotionRow({ model: "P51L-P2", productName: "Pocket 20K 45W" })
      ],
      month: { year: 2026, month: 7 }
    });

    expect(map.groups).toHaveLength(1);
    expect(map.groups[0]?.blocks).toHaveLength(1);
    expect(map.groups[0]?.blocks[0]?.items.map((item) => item.model)).toEqual([
      "P41L-P1",
      "P51L-P2"
    ]);
  });

  test("keeps local currency as the primary price for non-EUR countries", () => {
    const map = buildPromotionMap({
      rows: [
        promotionRow({
          countryCode: "PL",
          currency: "PLN",
          promoRrpLocal: 199.99,
          promoRrpEur: 46.51
        })
      ],
      month: { year: 2026, month: 7 }
    });

    const item = map.groups[0]?.blocks[0]?.items[0];

    expect(item?.primaryPrice).toBe("PLN 199.99");
    expect(item?.secondaryPrice).toBe("€46.51");
  });

  test("builds stable product options and filters multiple products across channels", () => {
    const rows = [
      promotionRow({
        key: "fr-boulanger-p41",
        channelName: "Boulanger",
        model: "P41L-P1",
        productName: "PowerPaw 10K"
      }),
      promotionRow({
        key: "fr-fnac-p41",
        channelName: "Fnac",
        model: "P41L-P1",
        productName: "PowerPaw 10K"
      }),
      promotionRow({
        key: "fr-fnac-p51",
        channelName: "Fnac",
        model: "P51L-P2",
        productName: "Pocket 20K 45W"
      })
    ];

    expect(buildPromotionMapProductOptions(rows)).toEqual([
      { value: "P41L-P1", label: "PowerPaw 10K · P41L-P1", count: 2 },
      { value: "P51L-P2", label: "Pocket 20K 45W · P51L-P2", count: 1 }
    ]);
    expect(filterPromotionMapRowsByProduct(rows, ["P41L-P1"]).map((row) => row.key)).toEqual([
      "fr-boulanger-p41",
      "fr-fnac-p41"
    ]);
    expect(
      filterPromotionMapRowsByProduct(rows, ["P41L-P1", "P51L-P2"]).map((row) => row.key)
    ).toEqual(["fr-boulanger-p41", "fr-fnac-p41", "fr-fnac-p51"]);
    expect(filterPromotionMapRowsByProduct(rows, [])).toHaveLength(3);
  });
});

function promotionRow(
  overrides: Partial<PromotionMapRowSource> = {}
): PromotionMapRowSource {
  return {
    key: "row-1",
    countryCode: "FR",
    channelName: "Boulanger",
    fdName: "BBC",
    model: "P41L-P1",
    productName: "PowerPaw 10K",
    currency: "EUR",
    promoRrpLocal: 39.99,
    promoRrpEur: 39.99,
    promoFrontMargin: 0.35,
    promoVolume: 1000,
    promoStartDate: "2026-07-03",
    promoEndDate: "2026-07-12",
    promotionCalculation: {
      np: 5.25,
      npPercent: 0.18
    },
    ...overrides
  };
}

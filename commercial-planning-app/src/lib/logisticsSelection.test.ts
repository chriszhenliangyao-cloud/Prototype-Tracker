import { describe, expect, test } from "vitest";
import { selectLogisticsCost } from "./logisticsSelection";
import type { LogisticsCostOption } from "./types";

const logisticsCosts: LogisticsCostOption[] = [
  row("es-charger-compact", "ES", "Charger", "Compact", 2.1),
  row("es-cable-small", "ES", "Cable", "Small", 0.9),
  row("es-cable-large", "ES", "Cable", "Large", 1.4)
];

describe("selectLogisticsCost", () => {
  test("matches country, category, and product size when capacity is present", () => {
    expect(
      selectLogisticsCost({
        logisticsCosts,
        countryId: "ES",
        category: "Charger",
        productCapacity: "Compact"
      })
    ).toEqual({
      status: "MATCHED",
      logisticsCost: logisticsCosts[0],
      message: null
    });
  });

  test("uses the only country/category logistics row when capacity is missing", () => {
    expect(
      selectLogisticsCost({
        logisticsCosts,
        countryId: "ES",
        category: "Charger",
        productCapacity: null
      })
    ).toEqual({
      status: "MATCHED",
      logisticsCost: logisticsCosts[0],
      message: null
    });
  });

  test("prefers an incoterms logistics row before product capacity fallback", () => {
    const selection = selectLogisticsCost({
      logisticsCosts: [
        row("es-powerbank-ddp", "ES", "Power bank", "DDP", 0.9),
        row("es-powerbank-fob", "ES", "Power bank", "FOB", 0.25)
      ],
      countryId: "ES",
      category: "Power bank",
      productCapacity: null,
      incoterms: "FOB"
    });

    expect(selection).toEqual({
      status: "MATCHED",
      logisticsCost: row("es-powerbank-fob", "ES", "Power bank", "FOB", 0.25),
      message: null
    });
  });

  test("returns missing when no logistics rows exist for the country and category", () => {
    const selection = selectLogisticsCost({
      logisticsCosts,
      countryId: "FR",
      category: "Charger",
      productCapacity: null
    });

    expect(selection.status).toBe("MISSING");
    expect(selection.logisticsCost).toBeNull();
    expect(selection.message).toContain("No logistics cost");
  });

  test("returns ambiguous when blank capacity could match multiple product sizes", () => {
    const selection = selectLogisticsCost({
      logisticsCosts,
      countryId: "ES",
      category: "Cable",
      productCapacity: " "
    });

    expect(selection.status).toBe("AMBIGUOUS_MISSING_CAPACITY");
    expect(selection.logisticsCost).toBeNull();
    expect(selection.message).toContain("capacity");
  });

  test("returns missing when capacity is present but no exact logistics row matches", () => {
    const selection = selectLogisticsCost({
      logisticsCosts,
      countryId: "ES",
      category: "Charger",
      productCapacity: "Large"
    });

    expect(selection.status).toBe("MISSING");
    expect(selection.logisticsCost).toBeNull();
    expect(selection.message).toContain("No logistics cost");
  });
});

function row(
  id: string,
  countryId: string,
  category: string,
  productSize: string,
  logisticsCost: number
): LogisticsCostOption {
  return {
    id,
    countryId,
    countryCode: countryId,
    category,
    productSize,
    logisticsCost,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE"
  };
}

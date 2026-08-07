import { describe, expect, test } from "vitest";
import {
  canDownloadPromotionPlanHistory,
  filterReferenceDataByCountryCodes,
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole,
  getPromotionPlanEditState,
  isPromotionPlanDeadlineLocked
} from "./promotionPlanAccess";
import type {
  CountryOption,
  ReferenceData,
  UserCountryAccessOption
} from "./types";

describe("promotion plan access and locking", () => {
  const countries: CountryOption[] = [
    country("FR", "France"),
    country("ES", "Spain"),
    country("DE", "Germany")
  ];
  const access: UserCountryAccessOption[] = [
    userAccess("sales@example.com", "FR"),
    userAccess("sales@example.com", "ES"),
    userAccess("viewer@example.com", "DE")
  ];

  test("global roles can access every country without explicit country rows", () => {
    for (const role of [
      "OWNER",
      "GTM_LEADER",
      "GM",
      "ADMIN"
    ] as const) {
      expect(getAccessibleCountryCodes(role, `${role.toLowerCase()}@example.com`, access, countries)).toEqual([
        "DE",
        "ES",
        "FR"
      ]);
    }
  });

  test("non-admin users are limited to assigned countries", () => {
    expect(
      getAccessibleCountryCodes("SALES_MANAGER", "sales@example.com", access, countries)
    ).toEqual(["ES", "FR"]);
  });

  test("allows every country-assigned account to download historical templates without granting write access", () => {
    expect(canDownloadPromotionPlanHistory("VIEWER", ["DE"])).toBe(true);
    expect(canDownloadPromotionPlanHistory("KA_OWNER", ["ES"])).toBe(true);
    expect(canDownloadPromotionPlanHistory("VIEWER", [])).toBe(false);
  });

  test("global country access grants every country to non-admin users", () => {
    expect(
      getAccessibleCountryCodes(
        "KA_OWNER",
        "global@example.com",
        [userAccess("global@example.com", "GLOBAL")],
        countries
      )
    ).toEqual(["DE", "ES", "FR"]);
  });

  test("configured user role can elevate promotion plan permissions", () => {
    expect(
      getEffectivePromotionPlanRole("VIEWER", "finance@example.com", [
        {
          ...userAccess("finance@example.com", "GLOBAL"),
          role: "FINANCE"
        }
      ])
    ).toBe("FINANCE");
  });

  test("locks non-admin users from a promotion month once that month starts in Madrid", () => {
    expect(
      isPromotionPlanDeadlineLocked({
        planYear: 2026,
        planMonth: 6,
        now: new Date("2026-05-31T21:59:59.000Z")
      })
    ).toBe(false);
    expect(
      isPromotionPlanDeadlineLocked({
        planYear: 2026,
        planMonth: 6,
        now: new Date("2026-05-31T22:00:00.000Z")
      })
    ).toBe(true);
  });

  test("locks submitted rows for review until they are returned for revision", () => {
    expect(
      getPromotionPlanEditState({
        role: "KA_OWNER",
        hasCountryAccess: true,
        planYear: 2026,
        planMonth: 6,
        status: "SUBMITTED",
        now: new Date("2026-05-15T10:00:00.000Z")
      })
    ).toEqual({ editable: false, reason: "submitted" });
    expect(
      getPromotionPlanEditState({
        role: "KA_OWNER",
        hasCountryAccess: true,
        planYear: 2026,
        planMonth: 6,
        status: "REJECTED",
        now: new Date("2026-05-15T10:00:00.000Z")
      })
    ).toEqual({ editable: true, reason: null });
  });

  test("approved months lock non-admin users immediately, while platform administrators can still edit", () => {
    expect(
      getPromotionPlanEditState({
        role: "SALES_MANAGER",
        hasCountryAccess: true,
        planYear: 2026,
        planMonth: 6,
        status: "APPROVED",
        now: new Date("2026-05-15T10:00:00.000Z")
      })
    ).toEqual({ editable: false, reason: "approved" });
    expect(
      getPromotionPlanEditState({
        role: "GTM_LEADER",
        hasCountryAccess: true,
        planYear: 2026,
        planMonth: 6,
        status: "APPROVED",
        now: new Date("2026-06-15T10:00:00.000Z")
      })
    ).toEqual({ editable: true, reason: null });
  });

  test("GM can view all countries but does not bypass approved-month locks", () => {
    expect(
      getPromotionPlanEditState({
        role: "GM",
        hasCountryAccess: true,
        planYear: 2026,
        planMonth: 6,
        status: "APPROVED",
        now: new Date("2026-06-15T10:00:00.000Z")
      })
    ).toEqual({ editable: false, reason: "approved" });
  });

  test("first approved months lock non-admin users before final approval", () => {
    expect(
      getPromotionPlanEditState({
        role: "SALES_MANAGER",
        hasCountryAccess: true,
        planYear: 2026,
        planMonth: 6,
        status: "FIRST_APPROVED",
        now: new Date("2026-05-15T10:00:00.000Z")
      })
    ).toEqual({ editable: false, reason: "first approved" });
  });

  test("isolates the five-country promotion test team by assigned country", () => {
    const teamCountries = [
      country("ES", "Spain"),
      country("FR", "France"),
      country("DE", "Germany"),
      country("IT", "Italy"),
      country("PL", "Poland")
    ];
    const teamAccess = [
      userAccess("ka.es@example.test", "ES"),
      userAccess("ka.fr@example.test", "FR"),
      userAccess("ka.de@example.test", "DE"),
      userAccess("ka.it@example.test", "IT"),
      userAccess("ka.pl@example.test", "PL")
    ];

    expect(
      getAccessibleCountryCodes(
        "KA_OWNER",
        "ka.es@example.test",
        teamAccess,
        teamCountries
      )
    ).toEqual(["ES"]);
    expect(
      getAccessibleCountryCodes(
        "KA_OWNER",
        "ka.fr@example.test",
        teamAccess,
        teamCountries
      )
    ).toEqual(["FR"]);
    expect(
      getAccessibleCountryCodes(
        "KA_OWNER",
        "ka.de@example.test",
        teamAccess,
        teamCountries
      )
    ).toEqual(["DE"]);
    expect(
      getAccessibleCountryCodes(
        "KA_OWNER",
        "ka.it@example.test",
        teamAccess,
        teamCountries
      )
    ).toEqual(["IT"]);
    expect(
      getAccessibleCountryCodes(
        "KA_OWNER",
        "ka.pl@example.test",
        teamAccess,
        teamCountries
      )
    ).toEqual(["PL"]);
    expect(
      getAccessibleCountryCodes(
        "ADMIN",
        "promo.admin@example.test",
        teamAccess,
        teamCountries
      )
    ).toEqual(["DE", "ES", "FR", "IT", "PL"]);
  });

  test("filters country-scoped reference data down to authorized products and BOM", () => {
    const scopedData = filterReferenceDataByCountryCodes(referenceData(), ["ES"]);

    expect(scopedData.countries.map((item) => item.code)).toEqual(["ES"]);
    expect(scopedData.productCountryRrps.map((item) => item.countryCode)).toEqual([
      "ES"
    ]);
    expect(scopedData.products.map((item) => item.sku)).toEqual(["ES-SKU"]);
    expect(scopedData.bomCosts.map((item) => item.productSku)).toEqual(["ES-SKU"]);
    expect(scopedData.operationalMargins.map((item) => item.countryCode)).toEqual([
      "ES"
    ]);
    expect(scopedData.exchangeRates?.map((item) => item.currency)).toEqual([
      "EUR",
      "RMB"
    ]);
  });
});

function country(code: string, name: string): CountryOption {
  return {
    id: `country-${code.toLowerCase()}`,
    name,
    code,
    vatRate: 0.2,
    currency: "EUR",
    status: "ACTIVE",
    effectiveDate: "2026-01-01T00:00:00.000Z"
  };
}

function userAccess(email: string, countryCode: string): UserCountryAccessOption {
  return {
    id: `${email}-${countryCode}`,
    email,
    label: null,
    countryCode,
    role: "KA_OWNER",
    approvalRole: "NONE",
    receivesPromotionPlanEmail: false,
    status: "ACTIVE",
    createdByEmail: "admin@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function referenceData(): ReferenceData {
  return {
    countries: [
      country("ES", "Spain"),
      country("FR", "France")
    ],
    exchangeRates: [
      {
        id: "rate-eur",
        currency: "EUR",
        exchangeRateToEur: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "rate-rmb",
        currency: "RMB",
        exchangeRateToEur: 7.8,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "rate-pln",
        currency: "PLN",
        exchangeRateToEur: 4.3,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    products: [
      product("product-es", "ES-SKU", "Spain Product"),
      product("product-fr", "FR-SKU", "France Product")
    ],
    bomCosts: [
      bom("bom-es", "product-es", "ES-SKU"),
      bom("bom-fr", "product-fr", "FR-SKU")
    ],
    logisticsCosts: [
      logistics("logistics-es", "country-es", "ES"),
      logistics("logistics-fr", "country-fr", "FR")
    ],
    productCountryRrps: [
      rrp("rrp-es", "product-es", "ES-SKU", "country-es", "ES"),
      rrp("rrp-fr", "product-fr", "FR-SKU", "country-fr", "FR")
    ],
    operationalMargins: [
      margin("margin-es", "country-es", "ES"),
      margin("margin-fr", "country-fr", "FR")
    ],
    channelMargins: [],
    fdMargins: []
  };
}

function product(id: string, sku: string, name: string) {
  return {
    id,
    sku,
    name,
    category: "Charger",
    capacity: null,
    lifecycleStatus: "LAUNCHED" as const,
    status: "ACTIVE" as const
  };
}

function bom(id: string, productId: string, productSku: string) {
  return {
    id,
    productId,
    productSku,
    productName: productSku,
    bomCost: 10,
    bomCostRmb: 78,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE" as const
  };
}

function logistics(id: string, countryId: string, countryCode: string) {
  return {
    id,
    countryId,
    countryCode,
    category: "Charger",
    productSize: "DDP",
    logisticsCost: 0.3,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE" as const
  };
}

function rrp(
  id: string,
  productId: string,
  productSku: string,
  countryId: string,
  countryCode: string
) {
  return {
    id,
    productId,
    productSku,
    productName: productSku,
    countryId,
    countryCode,
    rrpLocal: 99,
    rrpEur: 99,
    currency: "EUR",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE" as const
  };
}

function margin(id: string, countryId: string, countryCode: string) {
  return {
    id,
    countryId,
    countryCode,
    retailerName: "Retailer",
    fdName: "FD",
    incoterms: "DDP",
    category: "Charger",
    kaBuyingMargin: 0.3,
    kaFrontMargin: 0.2,
    kaBackMargin: 0.1,
    fdMargin: 0.08,
    effectiveDate: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE" as const
  };
}

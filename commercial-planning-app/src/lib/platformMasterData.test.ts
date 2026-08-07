import { describe, expect, it } from "vitest";
import { buildPlatformMasterDataCatalog } from "./platformMasterData";
import type { ReferenceData } from "./types";

describe("platform master-data catalog", () => {
  it("normalizes product categories and de-duplicates business dimensions", () => {
    const data: ReferenceData = {
      countries: [
        {
          id: "de",
          code: "DE",
          name: "Germany",
          currency: "EUR",
          vatRate: 0.19,
          status: "ACTIVE",
          effectiveDate: "2026-01-01"
        }
      ],
      products: [
        {
          id: "cable",
          sku: "CBL-1",
          name: "Cable",
          category: "Cable",
          capacity: null,
          lifecycleStatus: "UNLAUNCHED",
          status: "ACTIVE"
        }
      ],
      bomCosts: [],
      logisticsCosts: [],
      productCountryRrps: [],
      operationalMargins: [
        {
          id: "op",
          countryId: "de",
          countryCode: "DE",
          retailerName: "Amazon DE",
          fdName: "DACH FD",
          incoterms: "DDP",
          category: "Cable",
          kaBuyingMargin: 0.2,
          kaFrontMargin: 0.2,
          kaBackMargin: 0.1,
          fdMargin: 0.05,
          effectiveDate: "2026-01-01",
          status: "ACTIVE"
        }
      ],
      channelMargins: [
        {
          id: "channel",
          countryId: "de",
          countryCode: "DE",
          channelName: "Online",
          kaName: "Amazon DE",
          category: "Cable",
          normalFrontMargin: 0.2,
          normalBackMargin: 0.1,
          promoFrontMargin: 0.18,
          promoBackMargin: 0.08,
          effectiveDate: "2026-01-01",
          status: "ACTIVE"
        }
      ],
      fdMargins: [
        {
          id: "fd",
          countryId: "de",
          countryCode: "DE",
          fdName: "DACH FD",
          channelName: "Online",
          category: "Cable",
          normalFdMargin: 0.05,
          promoFdMargin: 0.04,
          effectiveDate: "2026-01-01",
          status: "ACTIVE"
        }
      ]
    };

    const catalog = buildPlatformMasterDataCatalog(data, "2026-08-06T00:00:00Z");

    expect(catalog.products[0]).toMatchObject({
      id: "cable",
      sku: "CBL-1",
      category: "Charging Cable"
    });
    expect(catalog.channels).toEqual(["Online"]);
    expect(catalog.retailers).toEqual(["Amazon DE"]);
    expect(catalog.distributors).toEqual(["DACH FD"]);
    expect(catalog.incoterms).toEqual(["DDP"]);
  });
});

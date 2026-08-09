import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BusinessPlanPlanner } from "./BusinessPlanPlanner";
import type { ReferenceData } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/business-plan",
  useRouter: () => ({ push: vi.fn() })
}));

describe("BusinessPlanPlanner", () => {
  it("renders metric switches and a consolidated targets panel by default", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          }
        ]}
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );

    expect(markup).toContain("Monthly SI Trend");
    expect(markup).toContain("Category Mix");
    expect(markup).toContain("Target Analysis");
    expect(markup).toContain("Monthly Targets");
    expect(markup).toContain("January");
    expect(markup).toContain("Units");
    expect(markup).toContain("Value");
    expect(markup).not.toContain("Channel / Quarter Targets");
    expect(markup).not.toContain("Channel / Month Targets");
    expect(markup).not.toContain("Product Targets");
  });

  it("puts role-aware BP actions before view filters and summary content", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={true}
        canChangeCountry={true}
        canFinalApprovePlan={true}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          }
        ]}
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="approver@example.test"
        yearStatuses={[
          {
            id: "bp-status",
            planYear: 2026,
            countryCode: "ES",
            status: "FIRST_APPROVED",
            submittedByEmail: "ka@example.test",
            firstApprovedByEmail: "first@example.test",
            approvedByEmail: null,
            rejectedByEmail: null,
            submittedAt: "2026-07-01T00:00:00.000Z",
            firstApprovedAt: "2026-07-02T00:00:00.000Z",
            approvedAt: null,
            rejectedAt: null,
            notes: null,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z"
          }
        ]}
      />
    );

    const actionsIndex = markup.indexOf("BP Actions");
    const viewIndex = markup.indexOf("BP View");
    const summaryIndex = markup.indexOf("BP Summary");

    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(viewIndex).toBeGreaterThan(actionsIndex);
    expect(summaryIndex).toBeGreaterThan(viewIndex);
    expect(markup).toContain("System Input");
    expect(markup).toContain("Excel Input");
    expect(markup).toContain("Save Draft");
    expect(markup).toContain("Export Current BP");
    expect(markup).toContain("Final Approve");
    expect(markup).toContain("Reject");
  });

  it("shows a SI-only monthly trend, category pie mix, and scoped saved BP view", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          }
        ]}
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );

    const monthlySection = markup.slice(
      markup.indexOf("Monthly SI Trend"),
      markup.indexOf("Category Mix")
    );
    const categorySection = markup.slice(
      markup.indexOf("Category Mix"),
      markup.indexOf("Monthly Targets")
    );

    expect(markup).toContain("Saved BP View");
    expect(markup).toContain("Annual INIU SI Value");
    expect(markup).toContain("KA SI value");
    expect(monthlySection).toContain("SI units");
    expect(monthlySection).toContain('aria-label="January SI units 100"');
    expect(monthlySection).not.toContain("SO units");
    expect(monthlySection).not.toContain("SO value EUR");
    expect(markup).toContain("Category mix pie chart");
    expect(categorySection).toContain(
      'aria-label="Charger category mix annotation"'
    );
    expect(categorySection).not.toContain("grid content-center gap-2");
  });

  it("shows an all-market saved BP summary when no single country is selected", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES", "PL"]}
        data={multiCountryReferenceData()}
        initialDraftLines={[
          {
            id: "line-es",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          },
          {
            id: "line-pl",
            rowKey: "margin-pl|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 50,
            soUnits: 40
          }
        ]}
        selectedCountryCode={null}
        selectedYear={2026}
        userEmail="owner@example.test"
        yearStatuses={[]}
      />
    );

    expect(markup).toContain("All markets");
    expect(markup).toContain("View only");
    expect(markup).toContain(
      "Aggregated saved BP for all visible markets. Select one market to edit, upload, save, or submit."
    );
    expect(markup).toContain("150");
    expect(markup).toContain("2 / 2 BP line(s)");
    expect(markup).toContain("All markets · 2026");
  });

  it("renders monthly targets as a full-width row and defaults target analysis to product drilldown", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          },
          {
            id: "line-2",
            rowKey: "margin-es-online|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 40,
            soUnits: 30
          },
          {
            id: "line-3",
            rowKey: "margin-es-cable|product-cable",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 20,
            soUnits: 15
          }
        ]}
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );
    const savedViewSection = markup.slice(
      markup.indexOf("Saved BP View"),
      markup.indexOf("Saved BP View Results")
    );
    const monthlyTargetsSection = markup.slice(
      markup.indexOf("Monthly Targets"),
      markup.indexOf("Target Analysis")
    );
    const targetAnalysisSection = markup.slice(
      markup.indexOf("Target Analysis")
    );
    const firstProductIndex = targetAnalysisSection.indexOf(
      'aria-label="CHG-65W-EU · 65W Charger product target annotation"'
    );
    const nextProductIndex = targetAnalysisSection.indexOf(
      'aria-label="CBL-240W · Cable 240W product target annotation"'
    );

    expect(savedViewSection).toContain("Year");
    expect(savedViewSection).toContain("Country");
    expect(savedViewSection).toContain("Channel / KA");
    expect(savedViewSection).toContain("Product");
    expect(savedViewSection).toContain("Time dimension");
    expect(savedViewSection).toContain("Monthly");
    expect(savedViewSection).toContain("Quarterly");
    expect(savedViewSection).toContain("Period");
    expect(savedViewSection).toContain("All months");
    expect(savedViewSection).not.toContain("Breakdown");
    expect(savedViewSection).not.toContain("Metric");
    expect(savedViewSection).not.toContain("Show");
    expect(savedViewSection).toContain(
      "grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]"
    );
    expect(savedViewSection).toContain("w-full min-w-0");
    expect(monthlyTargetsSection).toContain("Total");
    expect(monthlyTargetsSection).not.toContain("Target Analysis");
    expect(markup).not.toContain("<h3>Product Mix</h3>");
    expect(targetAnalysisSection).toContain("Product");
    expect(targetAnalysisSection).toContain("Channel");
    expect(targetAnalysisSection).toContain("Product Contribution");
    expect(targetAnalysisSection).toContain("Target product mix pie chart");
    expect(targetAnalysisSection).toContain("Product contribution list");
    expect(targetAnalysisSection).toContain("140 SI");
    expect(targetAnalysisSection).toContain("Units");
    expect(targetAnalysisSection).toContain("Value");
    expect(targetAnalysisSection).toContain("INIU SI value");
    expect(targetAnalysisSection).not.toContain("Show");
    expect(targetAnalysisSection).not.toContain("Top 10");
    expect(targetAnalysisSection).toContain(
      'aria-label="CHG-65W-EU · 65W Charger product target annotation"'
    );
    expect(firstProductIndex).toBeGreaterThanOrEqual(0);
    expect(nextProductIndex).toBeGreaterThan(firstProductIndex);
    expect(targetAnalysisSection).not.toContain("Selected segment");
    expect(targetAnalysisSection).not.toContain("Expanded segments");
    expect(targetAnalysisSection).not.toContain("Channels / FD in this product");
    expect(targetAnalysisSection).not.toContain("child detail list");
    expect(targetAnalysisSection).not.toContain("Selected product channels");
  });

  it("can render multiple expanded product drilldowns inline", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          },
          {
            id: "line-2",
            rowKey: "margin-es-online|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 40,
            soUnits: 30
          },
          {
            id: "line-3",
            rowKey: "margin-es-cable|product-cable",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 20,
            soUnits: 15
          }
        ]}
        initialExpandedTargetKeys={["CHG-65W-EU", "CBL-240W"]}
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );
    const targetAnalysisSection = markup.slice(
      markup.indexOf("Target Analysis")
    );
    const firstProductIndex = targetAnalysisSection.indexOf(
      'aria-label="CHG-65W-EU · 65W Charger product target annotation"'
    );
    const firstChildListIndex = targetAnalysisSection.indexOf(
      'aria-label="CHG-65W-EU · 65W Charger child detail list"'
    );
    const secondProductIndex = targetAnalysisSection.indexOf(
      'aria-label="CBL-240W · Cable 240W product target annotation"'
    );
    const secondChildListIndex = targetAnalysisSection.indexOf(
      'aria-label="CBL-240W · Cable 240W child detail list"'
    );

    expect(targetAnalysisSection).toContain("Expanded segments");
    expect(targetAnalysisSection).toContain("2 open");
    expect(targetAnalysisSection).toContain("Channels / FD in this product");
    expect(targetAnalysisSection).toContain("MediaMarkt ES · FD ES");
    expect(targetAnalysisSection).toContain("Amazon ES · Online FD");
    expect(firstChildListIndex).toBeGreaterThan(firstProductIndex);
    expect(firstChildListIndex).toBeLessThan(secondProductIndex);
    expect(secondChildListIndex).toBeGreaterThan(secondProductIndex);
    expect(targetAnalysisSection).not.toContain("Selected product channels");
  });

  it("can render multiple expanded channel product drilldowns inline", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          },
          {
            id: "line-2",
            rowKey: "margin-es-cable|product-cable",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 20,
            soUnits: 15
          },
          {
            id: "line-3",
            rowKey: "margin-es-online|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.1,
            siUnits: 40,
            soUnits: 30
          }
        ]}
        initialExpandedTargetKeys={[
          "ES|MediaMarkt ES|FD ES|DDP",
          "ES|Amazon ES|Online FD|DDP"
        ]}
        initialTargetDimension="channel"
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );
    const targetAnalysisSection = markup.slice(
      markup.indexOf("Target Analysis")
    );
    const selectedChannelIndex = targetAnalysisSection.indexOf(
      'aria-label="MediaMarkt ES · FD ES channel target annotation"'
    );
    const selectedChildListIndex = targetAnalysisSection.indexOf(
      'aria-label="MediaMarkt ES · FD ES child detail list"'
    );
    const nextChannelIndex = targetAnalysisSection.indexOf(
      'aria-label="Amazon ES · Online FD channel target annotation"'
    );

    expect(targetAnalysisSection).toContain("Channel Mix");
    expect(targetAnalysisSection).toContain("Target channel mix pie chart");
    expect(targetAnalysisSection).toContain("Expanded segments");
    expect(targetAnalysisSection).toContain("2 open");
    expect(targetAnalysisSection).toContain("Channel contribution list");
    expect(targetAnalysisSection).toContain("Products in this channel");
    expect(targetAnalysisSection).toContain("CHG-65W-EU · 65W Charger");
    expect(targetAnalysisSection).toContain("CBL-240W · Cable 240W");
    expect(targetAnalysisSection).toContain("120 SI");
    expect(targetAnalysisSection).toContain("Charger");
    expect(targetAnalysisSection).toContain("Cable");
    expect(targetAnalysisSection).toContain(
      'aria-label="MediaMarkt ES · FD ES channel target annotation"'
    );
    expect(targetAnalysisSection).not.toContain("Selected channel products");
    expect(selectedChildListIndex).toBeGreaterThan(selectedChannelIndex);
    expect(selectedChildListIndex).toBeLessThan(nextChannelIndex);
    expect(targetAnalysisSection).toContain(
      'aria-label="Amazon ES · Online FD child detail list"'
    );
  });

  it("includes BP-only channel assumptions in summary, filters, and input lines", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-new-channel",
            rowKey:
              "bp-assumption:es|new retail es|breakthrough fd|ddp|chg-65w-eu",
            year: 2026,
            month: 2,
            promoDiscountPercent: 0.1,
            siUnits: 25,
            soUnits: 20,
            assumption: {
              countryCode: "ES",
              retailerName: "New Retail ES",
              fdName: "Breakthrough FD",
              incoterms: "DDP",
              productSku: "CHG-65W-EU",
              productName: "65W Charger",
              category: "Charger",
              currency: "EUR",
              rrpLocal: 120,
              rrpEur: 120,
              kaBuyingMargin: 0.38,
              kaFrontMargin: 0.35,
              kaBackMargin: 0.03,
              fdMargin: 0.08,
              bomCostEur: 20,
              logisticsCostEur: 2
            }
          }
        ]}
        initialTargetDimension="channel"
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );

    expect(markup).toContain("25");
    expect(markup).toContain("New Retail ES");
    expect(markup).toContain("Breakthrough FD");
    expect(markup).toContain(
      'aria-label="New Retail ES · Breakthrough FD channel target annotation"'
    );
  });

  it("shows a simplified system input area for master data and BP-only rows", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[]}
        initialInputOpen
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );

    expect(markup).toContain("Add BP Input Row");
    expect(markup).toContain("BP-only");
    expect(markup).toContain("Channel / KA");
    expect(markup).toContain("FD");
    expect(markup).toContain("Incoterms");
    expect(markup).toContain("Promo Price Local");
    expect(markup).toContain("SI Units");
    expect(markup).toContain("SO Units");
    expect(markup).toContain("KA Buying %");
    expect(markup).toContain("KA Front %");
    expect(markup).toContain("KA Back %");
    expect(markup).toContain("FD Margin %");
    expect(markup).toContain("Add input row");
    expect(markup).not.toContain("Product Override");
    expect(markup).not.toContain("Save product override");
  });

  it("keeps main BP modules compact without explanatory helper copy", () => {
    const markup = renderToStaticMarkup(
      <BusinessPlanPlanner
        approvalQueue={[]}
        canApprovePlan={false}
        canChangeCountry={true}
        canFinalApprovePlan={false}
        canFirstApprovePlan={false}
        canSavePlan={true}
        countryOptions={["ES"]}
        data={referenceData()}
        initialDraftLines={[
          {
            id: "line-1",
            rowKey: "margin-es|product-65w",
            year: 2026,
            month: 1,
            promoDiscountPercent: 0.2,
            siUnits: 100,
            soUnits: 80
          }
        ]}
        selectedCountryCode="ES"
        selectedYear={2026}
        userEmail="ka@example.test"
        yearStatuses={[]}
      />
    );

    expect(markup).not.toContain("Add, save, export, submit, and approve");
    expect(markup).not.toContain(
      "All modules below refresh from this saved BP view."
    );
    expect(markup).not.toContain(
      "BP Summary, monthly SI trend, category mix"
    );
    expect(markup).not.toContain(
      "Filtered annual BP target rollup by country"
    );
    expect(markup).not.toContain(
      "Targets follow the Saved BP View time dimension and period."
    );
  });
});

function referenceData(): ReferenceData {
  return {
    countries: [
      {
        id: "country-es",
        name: "Spain",
        code: "ES",
        vatRate: 0.2,
        currency: "EUR",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    exchangeRates: [
      {
        id: "eur-rate",
        currency: "EUR",
        exchangeRateToEur: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    products: [
      {
        id: "product-65w",
        sku: "CHG-65W-EU",
        name: "65W Charger",
        category: "Charger",
        capacity: "Small",
        lifecycleStatus: "LAUNCHED",
        launchedAt: "2025-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "product-cable",
        sku: "CBL-240W",
        name: "Cable 240W",
        category: "Cable",
        capacity: "Small",
        lifecycleStatus: "LAUNCHED",
        launchedAt: "2025-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    bomCosts: [
      {
        id: "bom-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        bomCost: 20,
        bomCostRmb: 156,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "bom-cable",
        productId: "product-cable",
        productSku: "CBL-240W",
        productName: "Cable 240W",
        bomCost: 8,
        bomCostRmb: 62,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    logisticsCosts: [
      {
        id: "logistics-es-charger",
        countryId: "country-es",
        countryCode: "ES",
        category: "Charger",
        productSize: "Small",
        logisticsCost: 2,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "logistics-es-cable",
        countryId: "country-es",
        countryCode: "ES",
        category: "Cable",
        productSize: "Small",
        logisticsCost: 1,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      {
        id: "rrp-es-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        countryId: "country-es",
        countryCode: "ES",
        rrpLocal: 120,
        rrpEur: 120,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "rrp-es-cable",
        productId: "product-cable",
        productSku: "CBL-240W",
        productName: "Cable 240W",
        countryId: "country-es",
        countryCode: "ES",
        rrpLocal: 50,
        rrpEur: 50,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      {
        id: "margin-es",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "MediaMarkt ES",
        fdName: "FD ES",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.4,
        kaFrontMargin: 0.4,
        kaBackMargin: 0,
        fdMargin: 0.1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "margin-es-cable",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "MediaMarkt ES",
        fdName: "FD ES",
        incoterms: "DDP",
        category: "Cable",
        kaBuyingMargin: 0.4,
        kaFrontMargin: 0.4,
        kaBackMargin: 0,
        fdMargin: 0.1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      },
      {
        id: "margin-es-online",
        countryId: "country-es",
        countryCode: "ES",
        retailerName: "Amazon ES",
        fdName: "Online FD",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.35,
        kaFrontMargin: 0.35,
        kaBackMargin: 0,
        fdMargin: 0.08,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    channelMargins: [],
    fdMargins: []
  };
}

function multiCountryReferenceData(): ReferenceData {
  const data = referenceData();
  return {
    ...data,
    countries: [
      ...data.countries,
      {
        id: "country-pl",
        name: "Poland",
        code: "PL",
        vatRate: 0.23,
        currency: "EUR",
        status: "ACTIVE",
        effectiveDate: "2026-01-01T00:00:00.000Z"
      }
    ],
    logisticsCosts: [
      ...data.logisticsCosts,
      {
        id: "logistics-pl-charger",
        countryId: "country-pl",
        countryCode: "PL",
        category: "Charger",
        productSize: "Small",
        logisticsCost: 2.5,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    productCountryRrps: [
      ...data.productCountryRrps,
      {
        id: "rrp-pl-65w",
        productId: "product-65w",
        productSku: "CHG-65W-EU",
        productName: "65W Charger",
        countryId: "country-pl",
        countryCode: "PL",
        rrpLocal: 130,
        rrpEur: 130,
        currency: "EUR",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ],
    operationalMargins: [
      ...data.operationalMargins,
      {
        id: "margin-pl",
        countryId: "country-pl",
        countryCode: "PL",
        retailerName: "MediaMarkt PL",
        fdName: "FD PL",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: 0.42,
        kaFrontMargin: 0.42,
        kaBackMargin: 0,
        fdMargin: 0.11,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        status: "ACTIVE"
      }
    ]
  };
}

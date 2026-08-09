import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(callback: T) => callback
}));
vi.mock("@/lib/formData", async () => await import("../../lib/formData"));
vi.mock("@/lib/format", async () => await import("../../lib/format"));
vi.mock(
  "@/lib/imports/masterDataImport",
  async () => await import("../../lib/imports/masterDataImport")
);
vi.mock(
  "@/lib/masterDataArchive",
  async () => await import("../../lib/masterDataArchive")
);
vi.mock("@/lib/prisma", async () => await import("../../lib/prisma"));

const execFileAsync = promisify(execFile);
const testDirectory = await mkdtemp(join(tmpdir(), "value-chain-actions-test-"));
const databaseUrl = `file:${join(testDirectory, "test.db")}`;

process.env.DATABASE_URL = databaseUrl;

await execFileAsync(
  process.execPath,
  ["scripts/init-local-db.mjs"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    }
  }
);

const {
  importBomProductData,
  importMasterDataWorkbook,
  importOperationalMarginData,
  importRrpData
} = await import("./actions");
const { revalidatePath, revalidateTag } = await import("next/cache");
const { prisma } = await import("../../lib/prisma");

const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRevalidateTag = vi.mocked(revalidateTag);

describe("master data import actions", () => {
  beforeEach(async () => {
    mockedRevalidatePath.mockClear();
    mockedRevalidateTag.mockClear();
    await prisma.masterDataArchive.deleteMany();
    await prisma.operationalMargin.deleteMany();
    await prisma.productCountryRrp.deleteMany();
    await prisma.bomCost.deleteMany();
    await prisma.product.deleteMany();
    await prisma.country.deleteMany();
    await prisma.currencyExchangeRate.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(testDirectory, { recursive: true, force: true });
  });

  test("BOM import creates product and BOM, then updates the active BOM without changing product capacity or status", async () => {
    const createState = await importBomProductData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
          ["M3-TEST", "Hub M3", "Hub", 199.5, 28.5]
        ]),
        "bom-upload.XLSX"
      )
    );

    expect(createState).toMatchObject({
      status: "success",
      message: "Imported master data.",
      imported: 1,
      updated: 0,
      skipped: 0,
      errors: [],
      duplicateKeys: []
    });

    const createdProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: "M3-TEST" },
      include: { bomCosts: true }
    });
    expect(createdProduct).toMatchObject({
      name: "Hub M3",
      category: "Hub",
      capacity: null,
      status: "ACTIVE"
    });
    expect(createdProduct.bomCosts).toHaveLength(1);
    expect(Number(createdProduct.bomCosts[0].bomCost)).toBe(28.5);
    expect(Number(createdProduct.bomCosts[0].bomCostRmb)).toBe(199.5);
    expect(createdProduct.bomCosts[0].currency).toBe("EUR");
    expect(createdProduct.bomCosts[0].status).toBe("ACTIVE");

    await prisma.product.update({
      where: { id: createdProduct.id },
      data: { capacity: "Keeps Existing Capacity", status: "INACTIVE" }
    });

    const updateState = await importBomProductData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
          ["M3-TEST", "Hub M3 Pro", "Controller", null, 31.75]
        ])
      )
    );

    expect(updateState).toMatchObject({
      status: "success",
      imported: 0,
      updated: 1,
      skipped: 0,
      errors: [],
      duplicateKeys: []
    });

    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: "M3-TEST" },
      include: { bomCosts: true }
    });
    expect(updatedProduct).toMatchObject({
      name: "Hub M3 Pro",
      category: "Controller",
      capacity: "Keeps Existing Capacity",
      status: "INACTIVE"
    });
    expect(updatedProduct.bomCosts).toHaveLength(1);
    expect(Number(updatedProduct.bomCosts[0].bomCost)).toBe(31.75);
    expect(updatedProduct.bomCosts[0].bomCostRmb).toBeNull();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/master-data");
    expect(mockedRevalidateTag).toHaveBeenCalledWith(
      "commercial-master-data-reference",
      { expire: 0 }
    );
  });

  test("BOM import syncs product lifecycle status when the workbook provides it", async () => {
    await importBomProductData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Lifecycle Status", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
          ["Unlaunched", "P99-P1", "Future Charger", "Charger", 120, 15.38]
        ])
      )
    );

    const createdProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: "P99-P1" }
    });
    expect(createdProduct.lifecycleStatus).toBe("UNLAUNCHED");

    await importBomProductData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["进度", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
          ["EOL", "P99-P1", "Future Charger", "Charger", 121, 15.51]
        ])
      )
    );

    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: "P99-P1" }
    });
    expect(updatedProduct.lifecycleStatus).toBe("EOL");
  });

  test("RRP import creates and updates active RRP rows while reporting missing references", async () => {
    const { country, product } = await seedCountryAndProduct("Spain", "ES");

    const createState = await importRrpData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
          ["ES", "M3-TEST", 129.99, 119.5, "EUR"],
          ["ZZ", "M3-TEST", 89.99, 80, "EUR"],
          ["ES", "MISSING-SKU", 79.99, 70, "EUR"]
        ])
      )
    );

    expect(createState).toMatchObject({
      status: "error",
      imported: 1,
      updated: 0,
      skipped: 2,
      duplicateKeys: []
    });
    expect(createState.errors).toEqual([
      {
        rowNumber: 3,
        message: "Missing country for ZZ M3-TEST"
      },
      {
        rowNumber: 4,
        message: "Missing product for ES MISSING-SKU"
      }
    ]);

    const createdRrp = await prisma.productCountryRrp.findFirstOrThrow({
      where: {
        productId: product.id,
        countryId: country.id,
        status: "ACTIVE"
      }
    });
    expect(Number(createdRrp.rrpLocal)).toBe(129.99);
    expect(Number(createdRrp.rrpEur)).toBe(119.5);
    expect(createdRrp.currency).toBe("EUR");

    const updateState = await importRrpData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
          ["ES", "M3-TEST", 119.99, 109.5, "EUR"]
        ])
      )
    );

    expect(updateState).toMatchObject({
      status: "success",
      imported: 0,
      updated: 1,
      skipped: 0,
      errors: [],
      duplicateKeys: []
    });

    const updatedRrps = await prisma.productCountryRrp.findMany({
      where: { productId: product.id, countryId: country.id }
    });
    expect(updatedRrps).toHaveLength(1);
    expect(Number(updatedRrps[0].rrpLocal)).toBe(119.99);
    expect(Number(updatedRrps[0].rrpEur)).toBe(109.5);
  });

  test("operational margin import creates and updates active rows while reporting missing countries", async () => {
    const country = await seedCountry("France", "FR");

    const createState = await importOperationalMarginData(
      idleState(),
      uploadFormData(
        createWorkbook([
          [
            "Country",
            "Retailer",
            "FD",
            "Incoterms",
            "Category",
            "KA buying margin",
            "KA front margin",
            "KA back margin",
            "FD Margin"
          ],
          [
            "FR",
            "Retail Partner",
            "Main Distributor",
            "DDP",
            "Hub",
            "42%",
            "21%",
            "7.5%",
            "13%"
          ],
          [
            "ZZ",
            "Retail Partner",
            "Main Distributor",
            "DDP",
            "Hub",
            "42%",
            "21%",
            "7.5%",
            "13%"
          ]
        ])
      )
    );

    expect(createState).toMatchObject({
      status: "error",
      imported: 1,
      updated: 0,
      skipped: 1,
      duplicateKeys: []
    });
    expect(createState.errors).toEqual([
      {
        rowNumber: 3,
        message: "Missing country for ZZ"
      }
    ]);

    const createdMargin = await prisma.operationalMargin.findFirstOrThrow({
      where: {
        countryId: country.id,
        retailerName: "Retail Partner",
        fdName: "Main Distributor",
        incoterms: "DDP",
        category: "Hub",
        status: "ACTIVE"
      }
    });
    expect(Number(createdMargin.kaBuyingMargin)).toBe(0.42);
    expect(Number(createdMargin.kaFrontMargin)).toBe(0.21);
    expect(Number(createdMargin.kaBackMargin)).toBe(0.075);
    expect(Number(createdMargin.fdMargin)).toBe(0.13);

    const updateState = await importOperationalMarginData(
      idleState(),
      uploadFormData(
        createWorkbook([
          [
            "Country",
            "Retailer",
            "FD",
            "Incoterms",
            "Category",
            "KA buying margin",
            "KA front margin",
            "KA back margin",
            "FD Margin"
          ],
          [
            "FR",
            "Retail Partner",
            "Main Distributor",
            "DDP",
            "Hub",
            "43%",
            "22%",
            "8%",
            "14%"
          ]
        ])
      )
    );

    expect(updateState).toMatchObject({
      status: "success",
      imported: 0,
      updated: 1,
      skipped: 0,
      errors: [],
      duplicateKeys: []
    });

    const updatedMargins = await prisma.operationalMargin.findMany({
      where: { countryId: country.id }
    });
    expect(updatedMargins).toHaveLength(1);
    expect(Number(updatedMargins[0].kaBuyingMargin)).toBe(0.43);
    expect(Number(updatedMargins[0].kaFrontMargin)).toBe(0.22);
    expect(Number(updatedMargins[0].kaBackMargin)).toBe(0.08);
    expect(Number(updatedMargins[0].fdMargin)).toBe(0.14);
  });

  test("duplicate workbook keys make import status error and count as skipped rows", async () => {
    const { product } = await seedCountryAndProduct("Spain", "ES");

    const state = await importRrpData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
          ["ES", "M3-TEST", 129.99, 119.5, "EUR"],
          ["ES", "M3-TEST", 119.99, 109.5, "EUR"]
        ])
      )
    );

    expect(state).toMatchObject({
      status: "error",
      imported: 1,
      updated: 0,
      skipped: 1,
      errors: [],
      duplicateKeys: ["ES|M3-TEST"]
    });

    const createdRrp = await prisma.productCountryRrp.findFirstOrThrow({
      where: {
        productId: product.id,
        status: "ACTIVE"
      }
    });
    expect(Number(createdRrp.rrpLocal)).toBe(119.99);
    expect(Number(createdRrp.rrpEur)).toBe(109.5);
  });

  test("combined workbook import writes countries, products, RRP, logistics, and operational margins", async () => {
    const state = await importMasterDataWorkbook(
      idleState(),
      uploadFormData(
        createWorkbookWithSheets([
          {
            name: "EXR",
            rows: [
              [null, "Currency", "EXR", "VAT"],
              ["PL", "PLN/EUR", 4.3, 0.23],
              ["FR", "EUR/EUR", 1, 0.2]
            ]
          },
          {
            name: "Bom cost",
            rows: [
              ["Lifecycle Status", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
              ["Unlaunched", "P72-P1", "Power Bank 10K", "Power bank", 70, 8.97]
            ]
          },
          {
            name: "RRP",
            rows: [
              ["Country", "Model", "Product", "RRP", "Currency"],
              ["PL", "P72-P1", "Power Bank 10K", 199.99, "PLN"]
            ]
          },
          {
            name: "Logistic cost",
            rows: [
              ["Incoterms", "Category", "RMB", "EUR"],
              ["DDP", "Power bank", 7, 0.9]
            ]
          },
          {
            name: "Margin data",
            rows: [
              [
                "Country",
                "Retailer",
                "FD",
                "Incoterms",
                "Category",
                "KA buying margin",
                "KA front margin",
                "KA back margin",
                "FD Margin"
              ],
              ["PL", "", "Westech", "DDP", "Power bank", 0.45, 0.2, 0.04, 0.08]
            ]
          }
        ])
      )
    );

    expect(state).toMatchObject({
      status: "success",
      imported: 8,
      updated: 0,
      skipped: 0,
      errors: [],
      duplicateKeys: []
    });

    const pl = await prisma.country.findUniqueOrThrow({ where: { code: "PL" } });
    expect(Number(pl.vatRate)).toBe(0.23);
    expect(pl.currency).toBe("PLN");
    const plnRate = await prisma.currencyExchangeRate.findUniqueOrThrow({
      where: { currency: "PLN" }
    });
    expect(Number(plnRate.exchangeRateToEur)).toBe(4.3);

    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: "P72-P1" },
      include: { bomCosts: true, countryRrps: true }
    });
    expect(product.name).toBe("Power Bank 10K");
    expect(product.category).toBe("Power bank");
    expect(product.lifecycleStatus).toBe("UNLAUNCHED");
    expect(Number(product.bomCosts[0].bomCost)).toBe(8.97);
    expect(Number(product.countryRrps[0].rrpLocal)).toBe(199.99);
    expect(Number(product.countryRrps[0].rrpEur)).toBe(46.5093);

    const logistics = await prisma.logisticsCost.findMany({
      orderBy: [{ countryId: "asc" }]
    });
    expect(logistics).toHaveLength(2);
    expect(logistics.map((cost) => cost.productSize)).toEqual(["DDP", "DDP"]);
    expect(logistics.map((cost) => Number(cost.logisticsCost))).toEqual([0.9, 0.9]);

    const margin = await prisma.operationalMargin.findFirstOrThrow({
      where: { countryId: pl.id }
    });
    expect(margin.retailerName).toBe("Westech");
    expect(margin.fdName).toBe("Westech");

    const archives = await prisma.masterDataArchive.findMany();
    expect(archives).toHaveLength(1);
    expect(archives[0]).toMatchObject({
      source: "MASTER_DATA_IMPORT",
      sourceReference: "Published workbook",
      driveStatus: "NOT_CONFIGURED"
    });
    expect(archives[0].workbookFileName).toMatch(/^Master data master-data-import-Published-workbook /);
    expect(archives[0].workbookBytes.length).toBeGreaterThan(100);
  });

  test("combined workbook import replaces the active master data snapshot without deleting archives", async () => {
    await importMasterDataWorkbook(
      idleState(),
      uploadFormData(
        createWorkbookWithSheets([
          {
            name: "EXR",
            rows: [
              [null, "Currency", "EXR", "VAT"],
              ["ES", "EUR/EUR", 1, 0.21],
              ["FR", "GBP/EUR", 0.86, 0.2]
            ]
          },
          {
            name: "Bom cost",
            rows: [
              ["Lifecycle Status", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
              ["Launched", "P1", "Pocket 10K", "Power bank", 70, 8.97],
              ["Launched", "P2", "Cable 240W", "Cable", 12, 1.54]
            ]
          },
          {
            name: "RRP",
            rows: [
              ["Country", "Model", "Product", "RRP", "Currency"],
              ["ES", "P1", "Pocket 10K", 29.99, "EUR"],
              ["FR", "P2", "Cable 240W", 19.99, "GBP"]
            ]
          },
          {
            name: "Logistic cost",
            rows: [
              ["Incoterms", "Category", "RMB", "EUR"],
              ["DDP", "Power bank", 7, 0.9],
              ["DDP", "Cable", 4, 0.52]
            ]
          },
          {
            name: "Margin data",
            rows: [
              [
                "Country",
                "Retailer",
                "FD",
                "Incoterms",
                "Category",
                "KA buying margin",
                "KA front margin",
                "KA back margin",
                "FD Margin"
              ],
              ["ES", "Orange", "Esprinet", "DDP", "Power bank", 0.37, 0.3, 0.03, 0.08],
              ["FR", "Fnac", "ALSO", "DDP", "Cable", 0.45, 0.25, 0.04, 0.1]
            ]
          }
        ]),
        "initial-master-data.xlsx"
      )
    );

    const replacementState = await importMasterDataWorkbook(
      idleState(),
      uploadFormData(
        createWorkbookWithSheets([
          {
            name: "EXR",
            rows: [
              [null, "Currency", "EXR", "VAT"],
              ["ES", "EUR/EUR", 1, 0.21]
            ]
          },
          {
            name: "Bom cost",
            rows: [
              ["Lifecycle Status", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
              ["Launched", "P1", "Pocket 10K Updated", "Power bank", 75, 9.62]
            ]
          },
          {
            name: "RRP",
            rows: [
              ["Country", "Model", "Product", "RRP", "Currency"],
              ["ES", "P1", "Pocket 10K Updated", 34.99, "EUR"]
            ]
          },
          {
            name: "Logistic cost",
            rows: [
              ["Incoterms", "Category", "RMB", "EUR"],
              ["DDP", "Power bank", 8, 1.03]
            ]
          },
          {
            name: "Margin data",
            rows: [
              [
                "Country",
                "Retailer",
                "FD",
                "Incoterms",
                "Category",
                "KA buying margin",
                "KA front margin",
                "KA back margin",
                "FD Margin"
              ],
              ["ES", "Orange", "Esprinet", "DDP", "Power bank", 0.4, 0.31, 0.03, 0.08]
            ]
          }
        ]),
        "replacement-master-data.xlsx"
      )
    );

    expect(replacementState.status).toBe("success");

    await expect(
      prisma.product.findUniqueOrThrow({ where: { sku: "P1" } })
    ).resolves.toMatchObject({ status: "ACTIVE", name: "Pocket 10K Updated" });
    await expect(
      prisma.product.findUniqueOrThrow({ where: { sku: "P2" } })
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      prisma.country.findUniqueOrThrow({ where: { code: "ES" } })
    ).resolves.toMatchObject({ status: "ACTIVE" });
    await expect(
      prisma.country.findUniqueOrThrow({ where: { code: "FR" } })
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      prisma.currencyExchangeRate.findUniqueOrThrow({ where: { currency: "GBP" } })
    ).resolves.toMatchObject({ status: "INACTIVE" });

    const activeProducts = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sku: "asc" }
    });
    expect(activeProducts.map((product) => product.sku)).toEqual(["P1"]);

    const activeRrps = await prisma.productCountryRrp.findMany({
      where: { status: "ACTIVE" },
      include: { country: true, product: true }
    });
    expect(activeRrps.map((rrp) => `${rrp.country.code}:${rrp.product.sku}`)).toEqual([
      "ES:P1"
    ]);

    const inactiveP2Bom = await prisma.bomCost.findFirstOrThrow({
      where: { product: { sku: "P2" } }
    });
    expect(inactiveP2Bom.status).toBe("INACTIVE");

    const activeLogistics = await prisma.logisticsCost.findMany({
      where: { status: "ACTIVE" },
      include: { country: true }
    });
    expect(activeLogistics.map((cost) => `${cost.country.code}:${cost.category}`)).toEqual([
      "ES:Power bank"
    ]);

    const activeMargins = await prisma.operationalMargin.findMany({
      where: { status: "ACTIVE" },
      include: { country: true }
    });
    expect(
      activeMargins.map((margin) => `${margin.country.code}:${margin.retailerName}`)
    ).toEqual(["ES:Orange"]);

    const archives = await prisma.masterDataArchive.findMany({
      orderBy: { createdAt: "asc" }
    });
    expect(archives).toHaveLength(3);
    expect(archives.map((archive) => archive.title)).toEqual([
      "Master Data workbook imported",
      "Master Data pre-import backup",
      "Master Data workbook imported"
    ]);
    expect(archives.every((archive) => archive.workbookBytes.length > 100)).toBe(true);
  });

  test("reimporting an identical combined workbook skips unchanged rows", async () => {
    const workbook = createWorkbookWithSheets([
      {
        name: "EXR",
        rows: [
          [null, "Currency", "EXR", "VAT"],
          ["ES", "EUR/EUR", 1, 0.21]
        ]
      },
      {
        name: "Bom cost",
        rows: [
          ["Lifecycle Status", "Model", "Name", "Category", "Bom (RMB)", "Bom (EUR)"],
          ["Launched", "P1", "Pocket 10K", "Power bank", 70, 8.97]
        ]
      },
      {
        name: "RRP",
        rows: [
          ["Country", "Model", "Product", "RRP", "Currency"],
          ["ES", "P1", "Pocket 10K", 29.99, "EUR"]
        ]
      },
      {
        name: "Logistic cost",
        rows: [
          ["Incoterms", "Category", "RMB", "EUR"],
          ["DDP", "Power bank", 7, 0.9]
        ]
      },
      {
        name: "Margin data",
        rows: [
          [
            "Country",
            "Retailer",
            "FD",
            "Incoterms",
            "Category",
            "KA buying margin",
            "KA front margin",
            "KA back margin",
            "FD Margin"
          ],
          ["ES", "Orange", "Esprinet", "DDP", "Power bank", 0.37, 0.3, 0.03, 0.08]
        ]
      }
    ]);

    const first = await importMasterDataWorkbook(
      idleState(),
      uploadFormData(workbook, "master-data.xlsx")
    );
    const second = await importMasterDataWorkbook(
      idleState(),
      uploadFormData(workbook, "master-data.xlsx")
    );

    expect(first).toMatchObject({ status: "success", imported: 6, updated: 0 });
    expect(second).toMatchObject({ status: "success", imported: 0, updated: 0 });
    await expect(prisma.masterDataArchive.count()).resolves.toBe(3);
  });

  test("multiple parser errors on the same source row count as one skipped row", async () => {
    const state = await importRrpData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
          [" ", "M3-TEST", 129.99, 119.5, " "]
        ])
      )
    );

    expect(state.status).toBe("error");
    expect(state.skipped).toBe(1);
    expect(state.errors).toEqual([
      {
        rowNumber: 2,
        field: "Country",
        message: "Required value"
      },
      {
        rowNumber: 2,
        field: "Currency",
        message: "Required value"
      }
    ]);
  });

  test("RRP import updates the latest active duplicate and marks older matching active rows inactive", async () => {
    const { country, product } = await seedCountryAndProduct("Spain", "ES");
    const olderRrp = await prisma.productCountryRrp.create({
      data: {
        productId: product.id,
        countryId: country.id,
        rrpLocal: "149.99",
        rrpEur: "139.50",
        currency: "EUR",
        effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE"
      }
    });
    const latestRrp = await prisma.productCountryRrp.create({
      data: {
        productId: product.id,
        countryId: country.id,
        rrpLocal: "139.99",
        rrpEur: "129.50",
        currency: "EUR",
        effectiveDate: new Date("2026-02-01T00:00:00.000Z"),
        status: "ACTIVE"
      }
    });

    const state = await importRrpData(
      idleState(),
      uploadFormData(
        createWorkbook([
          ["Country", "Model", "RRP Local", "RRP EUR", "Currency"],
          ["ES", "M3-TEST", 119.99, 109.5, "EUR"]
        ])
      )
    );

    expect(state).toMatchObject({
      status: "success",
      imported: 0,
      updated: 1,
      skipped: 0
    });

    const rrps = await prisma.productCountryRrp.findMany({
      where: { productId: product.id, countryId: country.id },
      orderBy: [{ effectiveDate: "asc" }]
    });
    expect(rrps).toHaveLength(2);
    expect(rrps.find((rrp) => rrp.id === olderRrp.id)?.status).toBe("INACTIVE");
    const updatedLatest = rrps.find((rrp) => rrp.id === latestRrp.id);
    expect(updatedLatest?.status).toBe("ACTIVE");
    expect(Number(updatedLatest?.rrpLocal)).toBe(119.99);
    expect(Number(updatedLatest?.rrpEur)).toBe(109.5);
  });

  test("margin import updates the latest active duplicate and marks older matching active rows inactive", async () => {
    const country = await seedCountry("France", "FR");
    const olderMargin = await prisma.operationalMargin.create({
      data: {
        countryId: country.id,
        retailerName: "Retail Partner",
        fdName: "Main Distributor",
        incoterms: "DDP",
        category: "Hub",
        kaBuyingMargin: "0.40",
        kaFrontMargin: "0.20",
        kaBackMargin: "0.07",
        fdMargin: "0.12",
        effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE"
      }
    });
    const latestMargin = await prisma.operationalMargin.create({
      data: {
        countryId: country.id,
        retailerName: "Retail Partner",
        fdName: "Main Distributor",
        incoterms: "DDP",
        category: "Hub",
        kaBuyingMargin: "0.41",
        kaFrontMargin: "0.21",
        kaBackMargin: "0.08",
        fdMargin: "0.13",
        effectiveDate: new Date("2026-02-01T00:00:00.000Z"),
        status: "ACTIVE"
      }
    });

    const state = await importOperationalMarginData(
      idleState(),
      uploadFormData(
        createWorkbook([
          [
            "Country",
            "Retailer",
            "FD",
            "Incoterms",
            "Category",
            "KA buying margin",
            "KA front margin",
            "KA back margin",
            "FD Margin"
          ],
          [
            "FR",
            "Retail Partner",
            "Main Distributor",
            "DDP",
            "Hub",
            "43%",
            "22%",
            "9%",
            "14%"
          ]
        ])
      )
    );

    expect(state).toMatchObject({
      status: "success",
      imported: 0,
      updated: 1,
      skipped: 0
    });

    const margins = await prisma.operationalMargin.findMany({
      where: { countryId: country.id },
      orderBy: [{ effectiveDate: "asc" }]
    });
    expect(margins).toHaveLength(2);
    expect(margins.find((margin) => margin.id === olderMargin.id)?.status).toBe(
      "INACTIVE"
    );
    const updatedLatest = margins.find((margin) => margin.id === latestMargin.id);
    expect(updatedLatest?.status).toBe("ACTIVE");
    expect(Number(updatedLatest?.kaBuyingMargin)).toBe(0.43);
    expect(Number(updatedLatest?.kaFrontMargin)).toBe(0.22);
    expect(Number(updatedLatest?.kaBackMargin)).toBe(0.09);
    expect(Number(updatedLatest?.fdMargin)).toBe(0.14);
  });

  test("workbook file validation rejects missing, empty, and non-xlsx uploads", async () => {
    await expectInvalidUpload(new FormData(), "Upload an .xlsx file.");

    await expectInvalidUpload(
      uploadFormData(Buffer.alloc(0), "empty.xlsx"),
      "Upload an .xlsx file."
    );

    await expectInvalidUpload(
      uploadFormData(Buffer.from("not xlsx"), "master-data.csv"),
      "Only .xlsx files are supported."
    );
  });
});

function idleState() {
  return {
    status: "idle" as const,
    message: "",
    imported: 0,
    updated: 0,
    skipped: 0,
    summary: [],
    errors: [],
    duplicateKeys: []
  };
}

async function expectInvalidUpload(formData: FormData, message: string) {
  const state = await importBomProductData(idleState(), formData);

  expect(state).toEqual({
    status: "error",
    message,
    imported: 0,
    updated: 0,
    skipped: 0,
    summary: [],
    errors: [],
    duplicateKeys: []
  });
  expect(mockedRevalidatePath).not.toHaveBeenCalled();
}

async function seedCountryAndProduct(name: string, code: string) {
  const country = await seedCountry(name, code);
  const product = await prisma.product.create({
    data: {
      sku: "M3-TEST",
      name: "Hub M3",
      category: "Hub",
      capacity: null,
      status: "ACTIVE"
    }
  });

  return { country, product };
}

async function seedCountry(name: string, code: string) {
  return prisma.country.create({
    data: {
      name,
      code,
      vatRate: "0.20",
      currency: "EUR",
      status: "ACTIVE",
      effectiveDate: new Date("2026-01-01T00:00:00.000Z")
    }
  });
}

function uploadFormData(buffer: Buffer, name = "master-data.xlsx"): FormData {
  const formData = new FormData();
  formData.set(
    "file",
    new File([new Uint8Array(buffer)], name, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
  return formData;
}

type XlsxCell = number | string | null | undefined;

function createWorkbook(rows: XlsxCell[][]): Buffer {
  const sheetXml = createSheetXml(rows);
  const files = new Map<string, string>([
    [
      "[Content_Types].xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    ],
    [
      "_rels/.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    ],
    [
      "xl/workbook.xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    ],
    [
      "xl/_rels/workbook.xml.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    ],
    ["xl/worksheets/sheet1.xml", sheetXml]
  ]);

  return createZip(files);
}

function createWorkbookWithSheets(
  sheets: Array<{ name: string; rows: XlsxCell[][] }>
): Buffer {
  const files = new Map<string, string>([
    [
      "[Content_Types].xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("")}
</Types>`
    ],
    [
      "_rels/.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    ],
    [
      "xl/workbook.xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (sheet, index) =>
          `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
      )
      .join("")}
  </sheets>
</workbook>`
    ],
    [
      "xl/_rels/workbook.xml.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("")}
</Relationships>`
    ]
  ]);

  sheets.forEach((sheet, index) => {
    files.set(`xl/worksheets/sheet${index + 1}.xml`, createSheetXml(sheet.rows));
  });

  return createZip(files);
}

function createSheetXml(rows: XlsxCell[][]): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          if (cell === null || cell === undefined || cell === "") {
            return "";
          }

          const reference = `${columnName(columnIndex)}${rowNumber}`;
          if (typeof cell === "number") {
            return `<c r="${reference}"><v>${cell}</v></c>`;
          }

          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(
            cell
          )}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createZip(files: Map<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [path, contents] of files) {
    const name = Buffer.from(path);
    const data = Buffer.from(contents);
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.size, 8);
  endOfCentralDirectory.writeUInt16LE(files.size, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localFiles.length, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, endOfCentralDirectory]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function columnName(index: number): string {
  let name = "";
  let value = index;
  do {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return name;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xml(strings: TemplateStringsArray, ...values: string[]): string {
  return strings.reduce((result, segment, index) => {
    return `${result}${segment}${values[index] ?? ""}`;
  }, "");
}

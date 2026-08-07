import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const effectiveDate = new Date("2026-01-01T00:00:00.000Z");

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.scenarioResult.deleteMany();
  await prisma.scenarioInput.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.fdMargin.deleteMany();
  await prisma.channelMargin.deleteMany();
  await prisma.operationalMargin.deleteMany();
  await prisma.productCountryRrp.deleteMany();
  await prisma.logisticsCost.deleteMany();
  await prisma.bomCost.deleteMany();
  await prisma.product.deleteMany();
  await prisma.country.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Finance Admin",
      email: "finance.admin@example.com",
      role: "ADMIN"
    }
  });

  const [spain, france, germany, italy] = await Promise.all([
    prisma.country.create({
      data: {
        name: "Spain",
        code: "ES",
        vatRate: "0.21",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.country.create({
      data: {
        name: "France",
        code: "FR",
        vatRate: "0.20",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.country.create({
      data: {
        name: "Germany",
        code: "DE",
        vatRate: "0.19",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.country.create({
      data: {
        name: "Italy",
        code: "IT",
        vatRate: "0.22",
        currency: "EUR",
        effectiveDate
      }
    })
  ]);

  const [charger, powerBank, cable] = await Promise.all([
    prisma.product.create({
      data: {
        sku: "CHG-65W-EU",
        name: "65W GaN Fast Charger",
        category: "Charger",
        capacity: "Compact"
      }
    }),
    prisma.product.create({
      data: {
        sku: "PB-20K-45W",
        name: "20,000mAh 45W Power Bank",
        category: "Power Bank",
        capacity: "Large"
      }
    }),
    prisma.product.create({
      data: {
        sku: "CBL-C2C-240W",
        name: "USB-C to USB-C 240W Cable",
        category: "Cable",
        capacity: "Small"
      }
    })
  ]);

  await prisma.product.createMany({
    data: [
      {
        sku: "P61L-P2",
        name: "Pocket 10K 45W",
        category: "Power Bank",
        capacity: "Large",
        lifecycleStatus: "LAUNCHED",
        launchedAt: new Date("2026-01-15T00:00:00.000Z")
      },
      {
        sku: "P51L-P2",
        name: "Pocket 20K 45W",
        category: "Power Bank",
        capacity: "Large",
        lifecycleStatus: "LAUNCHED",
        launchedAt: new Date("2025-11-20T00:00:00.000Z")
      },
      {
        sku: "PX51",
        name: "MagPro Neo 10K Qi2.0",
        category: "Power Bank",
        capacity: "Large",
        lifecycleStatus: "UNLAUNCHED",
        plannedLaunchAt: new Date("2026-08-22T00:00:00.000Z")
      },
      {
        sku: "PM61-Black",
        name: "MagPro Slim 10K Qi2.2 - Black",
        category: "Power Bank",
        capacity: "Large",
        lifecycleStatus: "LAUNCHED",
        launchedAt: new Date("2025-09-10T00:00:00.000Z")
      },
      {
        sku: "WM321",
        name: "MagPro 3-in-1 Station",
        category: "Wireless Charger",
        capacity: "Desktop",
        lifecycleStatus: "UNLAUNCHED",
        plannedLaunchAt: new Date("2026-10-01T00:00:00.000Z")
      },
      {
        sku: "WAL101",
        name: "Leopard Fold Charger 100W - EU",
        category: "Charger",
        capacity: "Compact",
        lifecycleStatus: "UNLAUNCHED",
        plannedLaunchAt: new Date("2026-09-15T00:00:00.000Z")
      }
    ]
  });

  const platformProducts = new Map(
    (
      await prisma.product.findMany({
        where: {
          sku: {
            in: ["P61L-P2", "P51L-P2", "PX51", "PM61-Black", "WM321", "WAL101"]
          }
        }
      })
    ).map((product) => [product.sku, product])
  );
  const platformProduct = (sku: string) => {
    const product = platformProducts.get(sku);
    if (!product) throw new Error(`Missing seeded platform product ${sku}`);
    return product;
  };

  await Promise.all([
    prisma.bomCost.create({
      data: {
        productId: charger.id,
        bomCost: "18.50",
        bomCostRmb: "144.30",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.bomCost.create({
      data: {
        productId: powerBank.id,
        bomCost: "24.80",
        bomCostRmb: "193.44",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.bomCost.create({
      data: {
        productId: cable.id,
        bomCost: "3.20",
        bomCostRmb: "24.96",
        currency: "EUR",
        effectiveDate
      }
    })
  ]);

  await prisma.bomCost.createMany({
    data: [
      ["P61L-P2", "14.00", "109.20"],
      ["P51L-P2", "20.00", "156.00"],
      ["PX51", "18.00", "140.40"],
      ["PM61-Black", "15.00", "117.00"],
      ["WM321", "32.00", "249.60"],
      ["WAL101", "22.00", "171.60"]
    ].map(([sku, bomCost, bomCostRmb]) => ({
      productId: platformProduct(sku).id,
      bomCost,
      bomCostRmb,
      currency: "EUR",
      effectiveDate
    }))
  });

  await Promise.all([
    prisma.productCountryRrp.create({
      data: {
        productId: charger.id,
        countryId: spain.id,
        rrpLocal: "49.99",
        rrpEur: "49.99",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.productCountryRrp.create({
      data: {
        productId: powerBank.id,
        countryId: france.id,
        rrpLocal: "69.99",
        rrpEur: "69.99",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.productCountryRrp.create({
      data: {
        productId: cable.id,
        countryId: germany.id,
        rrpLocal: "19.99",
        rrpEur: "19.99",
        currency: "EUR",
        effectiveDate
      }
    })
  ]);

  await prisma.productCountryRrp.createMany({
    data: [
      ["P61L-P2", france.id, "FR", "39.99"],
      ["P51L-P2", france.id, "FR", "59.99"],
      ["PX51", france.id, "FR", "49.99"],
      ["PM61-Black", france.id, "FR", "39.99"],
      ["WM321", italy.id, "IT", "89.99"],
      ["WAL101", spain.id, "ES", "69.99"]
    ].map(([sku, countryId, _countryCode, rrp]) => ({
      productId: platformProduct(sku).id,
      countryId,
      rrpLocal: rrp,
      rrpEur: rrp,
      currency: "EUR",
      effectiveDate
    }))
  });

  await Promise.all([
    prisma.logisticsCost.create({
      data: {
        countryId: spain.id,
        category: "Charger",
        productSize: "Compact",
        logisticsCost: "2.10",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.logisticsCost.create({
      data: {
        countryId: france.id,
        category: "Power Bank",
        productSize: "Large",
        logisticsCost: "3.80",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.logisticsCost.create({
      data: {
        countryId: germany.id,
        category: "Cable",
        productSize: "Small",
        logisticsCost: "0.90",
        currency: "EUR",
        effectiveDate
      }
    }),
    prisma.logisticsCost.create({
      data: {
        countryId: italy.id,
        category: "Wireless Charger",
        productSize: "Desktop",
        logisticsCost: "4.50",
        currency: "EUR",
        effectiveDate
      }
    })
  ]);

  const [esRetail, frRetail, deOnline, itRetail] = await Promise.all([
    prisma.channelMargin.create({
      data: {
        countryId: spain.id,
        channelName: "Electronics Retail",
        kaName: "MediaMarkt ES",
        category: "Charger",
        normalFrontMargin: "0.30",
        normalBackMargin: "0.10",
        promoFrontMargin: "0.25",
        promoBackMargin: "0.08",
        effectiveDate
      }
    }),
    prisma.channelMargin.create({
      data: {
        countryId: france.id,
        channelName: "Electronics Retail",
        kaName: "Fnac Darty",
        category: "Power Bank",
        normalFrontMargin: "0.32",
        normalBackMargin: "0.11",
        promoFrontMargin: "0.27",
        promoBackMargin: "0.09",
        effectiveDate
      }
    }),
    prisma.channelMargin.create({
      data: {
        countryId: germany.id,
        channelName: "Online Marketplace",
        kaName: "Amazon DE",
        category: "Cable",
        normalFrontMargin: "0.26",
        normalBackMargin: "0.07",
        promoFrontMargin: "0.22",
        promoBackMargin: "0.05",
        effectiveDate
      }
    }),
    prisma.channelMargin.create({
      data: {
        countryId: italy.id,
        channelName: "Electronics Retail",
        kaName: "MediaWorld IT",
        category: "Wireless Charger",
        normalFrontMargin: "0.31",
        normalBackMargin: "0.10",
        promoFrontMargin: "0.27",
        promoBackMargin: "0.08",
        effectiveDate
      }
    })
  ]);

  const [esFd, frFd, deFd, itFd] = await Promise.all([
    prisma.fdMargin.create({
      data: {
        countryId: spain.id,
        fdName: "Iberia Distributor",
        channelName: esRetail.channelName,
        category: "Charger",
        normalFdMargin: "0.08",
        promoFdMargin: "0.06",
        effectiveDate
      }
    }),
    prisma.fdMargin.create({
      data: {
        countryId: france.id,
        fdName: "France Distributor",
        channelName: frRetail.channelName,
        category: "Power Bank",
        normalFdMargin: "0.09",
        promoFdMargin: "0.07",
        effectiveDate
      }
    }),
    prisma.fdMargin.create({
      data: {
        countryId: germany.id,
        fdName: "DACH Distributor",
        channelName: deOnline.channelName,
        category: "Cable",
        normalFdMargin: "0.07",
        promoFdMargin: "0.05",
        effectiveDate
      }
    }),
    prisma.fdMargin.create({
      data: {
        countryId: italy.id,
        fdName: "Italy Distributor",
        channelName: itRetail.channelName,
        category: "Wireless Charger",
        normalFdMargin: "0.08",
        promoFdMargin: "0.06",
        effectiveDate
      }
    })
  ]);

  await Promise.all([
    prisma.operationalMargin.create({
      data: {
        countryId: spain.id,
        retailerName: "MediaMarkt ES",
        fdName: "Iberia Distributor",
        incoterms: "DDP",
        category: "Charger",
        kaBuyingMargin: "0.30",
        kaFrontMargin: "0.30",
        kaBackMargin: "0.10",
        fdMargin: "0.08",
        effectiveDate
      }
    }),
    prisma.operationalMargin.create({
      data: {
        countryId: france.id,
        retailerName: "Fnac Darty",
        fdName: "France Distributor",
        incoterms: "DDP",
        category: "Power Bank",
        kaBuyingMargin: "0.42",
        kaFrontMargin: "0.32",
        kaBackMargin: "0.11",
        fdMargin: "0.09",
        effectiveDate
      }
    }),
    prisma.operationalMargin.create({
      data: {
        countryId: germany.id,
        retailerName: "Amazon DE",
        fdName: "DACH Distributor",
        incoterms: "DDP",
        category: "Cable",
        kaBuyingMargin: "0.26",
        kaFrontMargin: "0.26",
        kaBackMargin: "0.07",
        fdMargin: "0.07",
        effectiveDate
      }
    }),
    prisma.operationalMargin.create({
      data: {
        countryId: italy.id,
        retailerName: "MediaWorld IT",
        fdName: "Italy Distributor",
        incoterms: "DDP",
        category: "Wireless Charger",
        kaBuyingMargin: "0.31",
        kaFrontMargin: "0.31",
        kaBackMargin: "0.10",
        fdMargin: "0.08",
        effectiveDate
      }
    })
  ]);

  await prisma.scenario.create({
    data: {
      name: "Seed Spain 65W charger normal case",
      type: "NORMAL",
      countryId: spain.id,
      productId: charger.id,
      channelMarginId: esRetail.id,
      fdMarginId: esFd.id,
      settlementMode: "INVOICE_DISCOUNT",
      status: "DRAFT",
      createdById: admin.id,
      input: {
        create: {
          normalRrp: "49.99",
          vatRate: "0.21",
          normalFrontMargin: "0.30",
          normalBackMargin: "0.10",
          normalFdMargin: "0.08",
          bomCost: "18.50",
          logisticsCost: "2.10"
        }
      },
      result: {
        create: {
          rrpExVat: "41.31",
          priceAfterFrontMargin: "28.92",
          kaBuyingPrice: "26.03",
          fdBuyingPrice: "23.95",
          gp: "3.35",
          gpPercent: "0.1399",
          warningLevel: "CRITICAL"
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      entityType: "seed",
      entityId: "initial-data",
      fieldName: "database",
      newValue: "seeded",
      reason: "Initial MVP master data"
    }
  });

  const seededProducts = await prisma.product.findMany({
    orderBy: { sku: "asc" },
    select: { sku: true }
  });

  console.log("Seeded value-chain calculator data", {
    countries: [spain.code, france.code, germany.code, italy.code],
    products: seededProducts.map((product) => product.sku),
    fdMargins: [esFd.fdName, frFd.fdName, deFd.fdName, itFd.fdName]
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

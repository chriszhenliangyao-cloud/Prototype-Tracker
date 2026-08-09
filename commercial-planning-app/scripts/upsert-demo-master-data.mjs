import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const effectiveDate = new Date("2026-06-17T00:00:00.000Z");

const demoRows = [
  {
    country: {
      code: "ES",
      name: "Spain",
      vatRate: "0.21",
      currency: "EUR"
    },
    product: {
      sku: "CHG-65W-EU",
      name: "65W GaN Fast Charger",
      category: "Charger",
      capacity: "Compact"
    },
    rrp: {
      rrpLocal: "49.99",
      rrpEur: "49.99",
      currency: "EUR"
    },
    bom: {
      bomCost: "18.50",
      bomCostRmb: "144.30",
      currency: "EUR"
    },
    logistics: {
      productSize: "Compact",
      logisticsCost: "2.10",
      currency: "EUR"
    },
    channel: {
      channelName: "Electronics Retail",
      kaName: "MediaMarkt ES",
      normalFrontMargin: "0.30",
      normalBackMargin: "0.10",
      promoFrontMargin: "0.25",
      promoBackMargin: "0.08"
    },
    fd: {
      fdName: "Iberia Distributor",
      channelName: "Electronics Retail",
      normalFdMargin: "0.08",
      promoFdMargin: "0.06"
    },
    operational: {
      retailerName: "MediaMarkt ES",
      fdName: "Iberia Distributor",
      incoterms: "DDP",
      kaBuyingMargin: "0.30",
      kaFrontMargin: "0.30",
      kaBackMargin: "0.10",
      fdMargin: "0.08"
    }
  },
  {
    country: {
      code: "FR",
      name: "France",
      vatRate: "0.20",
      currency: "EUR"
    },
    product: {
      sku: "PB-20K-45W",
      name: "20,000mAh 45W Power Bank",
      category: "Power Bank",
      capacity: "Large"
    },
    rrp: {
      rrpLocal: "69.99",
      rrpEur: "69.99",
      currency: "EUR"
    },
    bom: {
      bomCost: "24.80",
      bomCostRmb: "193.44",
      currency: "EUR"
    },
    logistics: {
      productSize: "Large",
      logisticsCost: "3.80",
      currency: "EUR"
    },
    channel: {
      channelName: "Electronics Retail",
      kaName: "Fnac Darty",
      normalFrontMargin: "0.32",
      normalBackMargin: "0.11",
      promoFrontMargin: "0.27",
      promoBackMargin: "0.09"
    },
    fd: {
      fdName: "France Distributor",
      channelName: "Electronics Retail",
      normalFdMargin: "0.09",
      promoFdMargin: "0.07"
    },
    operational: {
      retailerName: "Fnac Darty",
      fdName: "France Distributor",
      incoterms: "DDP",
      kaBuyingMargin: "0.42",
      kaFrontMargin: "0.32",
      kaBackMargin: "0.11",
      fdMargin: "0.09"
    }
  }
];

async function main() {
  const results = [];

  for (const row of demoRows) {
    const country = await prisma.country.upsert({
      where: { code: row.country.code },
      update: {
        name: row.country.name,
        vatRate: row.country.vatRate,
        currency: row.country.currency,
        status: "ACTIVE"
      },
      create: {
        ...row.country,
        status: "ACTIVE",
        effectiveDate
      }
    });

    const product = await prisma.product.upsert({
      where: { sku: row.product.sku },
      update: {
        name: row.product.name,
        category: row.product.category,
        capacity: row.product.capacity,
        status: "ACTIVE"
      },
      create: {
        ...row.product,
        status: "ACTIVE"
      }
    });

    await upsertActiveBomCost(product.id, row.bom);
    await upsertActiveLogisticsCost(country.id, row.product.category, row.logistics);
    await upsertProductCountryRrp(product.id, country.id, row.rrp);
    await upsertChannelMargin(country.id, row.product.category, row.channel);
    await upsertFdMargin(country.id, row.product.category, row.fd);
    await upsertOperationalMargin(country.id, row.product.category, row.operational);

    results.push({
      country: country.code,
      sku: product.sku,
      product: product.name,
      retailer: row.operational.retailerName
    });
  }

  const [countries, products, rrps, bomCosts, logisticsCosts, margins] =
    await Promise.all([
      prisma.country.count({ where: { status: "ACTIVE" } }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.productCountryRrp.count({ where: { status: "ACTIVE" } }),
      prisma.bomCost.count({ where: { status: "ACTIVE" } }),
      prisma.logisticsCost.count({ where: { status: "ACTIVE" } }),
      prisma.operationalMargin.count({ where: { status: "ACTIVE" } })
    ]);

  console.log("Safely upserted demo master data", {
    rows: results,
    activeCounts: {
      countries,
      products,
      rrps,
      bomCosts,
      logisticsCosts,
      operationalMargins: margins
    }
  });
}

async function upsertActiveBomCost(productId, bom) {
  const existing = await prisma.bomCost.findFirst({
    where: { productId, status: "ACTIVE" },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const data = {
    bomCost: bom.bomCost,
    bomCostRmb: bom.bomCostRmb,
    currency: bom.currency,
    effectiveDate,
    status: "ACTIVE"
  };

  if (existing) {
    return prisma.bomCost.update({ where: { id: existing.id }, data });
  }

  return prisma.bomCost.create({
    data: {
      productId,
      ...data
    }
  });
}

async function upsertActiveLogisticsCost(countryId, category, logistics) {
  const existing = await prisma.logisticsCost.findFirst({
    where: {
      countryId,
      category,
      productSize: logistics.productSize,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const data = {
    logisticsCost: logistics.logisticsCost,
    currency: logistics.currency,
    effectiveDate,
    status: "ACTIVE"
  };

  if (existing) {
    return prisma.logisticsCost.update({ where: { id: existing.id }, data });
  }

  return prisma.logisticsCost.create({
    data: {
      countryId,
      category,
      productSize: logistics.productSize,
      ...data
    }
  });
}

async function upsertProductCountryRrp(productId, countryId, rrp) {
  return prisma.productCountryRrp.upsert({
    where: {
      productId_countryId_effectiveDate: {
        productId,
        countryId,
        effectiveDate
      }
    },
    update: {
      rrpLocal: rrp.rrpLocal,
      rrpEur: rrp.rrpEur,
      currency: rrp.currency,
      status: "ACTIVE"
    },
    create: {
      productId,
      countryId,
      rrpLocal: rrp.rrpLocal,
      rrpEur: rrp.rrpEur,
      currency: rrp.currency,
      effectiveDate,
      status: "ACTIVE"
    }
  });
}

async function upsertChannelMargin(countryId, category, channel) {
  const existing = await prisma.channelMargin.findFirst({
    where: {
      countryId,
      channelName: channel.channelName,
      kaName: channel.kaName,
      category,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const data = {
    normalFrontMargin: channel.normalFrontMargin,
    normalBackMargin: channel.normalBackMargin,
    promoFrontMargin: channel.promoFrontMargin,
    promoBackMargin: channel.promoBackMargin,
    effectiveDate,
    status: "ACTIVE"
  };

  if (existing) {
    return prisma.channelMargin.update({ where: { id: existing.id }, data });
  }

  return prisma.channelMargin.create({
    data: {
      countryId,
      category,
      channelName: channel.channelName,
      kaName: channel.kaName,
      ...data
    }
  });
}

async function upsertFdMargin(countryId, category, fd) {
  const existing = await prisma.fdMargin.findFirst({
    where: {
      countryId,
      fdName: fd.fdName,
      channelName: fd.channelName,
      category,
      status: "ACTIVE"
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const data = {
    normalFdMargin: fd.normalFdMargin,
    promoFdMargin: fd.promoFdMargin,
    effectiveDate,
    status: "ACTIVE"
  };

  if (existing) {
    return prisma.fdMargin.update({ where: { id: existing.id }, data });
  }

  return prisma.fdMargin.create({
    data: {
      countryId,
      category,
      fdName: fd.fdName,
      channelName: fd.channelName,
      ...data
    }
  });
}

async function upsertOperationalMargin(countryId, category, operational) {
  const margin = await prisma.operationalMargin.upsert({
    where: {
      countryId_retailerName_fdName_incoterms_category_effectiveDate: {
        countryId,
        retailerName: operational.retailerName,
        fdName: operational.fdName,
        incoterms: operational.incoterms,
        category,
        effectiveDate
      }
    },
    update: {
      kaBuyingMargin: operational.kaBuyingMargin,
      kaFrontMargin: operational.kaFrontMargin,
      kaBackMargin: operational.kaBackMargin,
      fdMargin: operational.fdMargin,
      status: "ACTIVE"
    },
    create: {
      countryId,
      retailerName: operational.retailerName,
      fdName: operational.fdName,
      incoterms: operational.incoterms,
      category,
      kaBuyingMargin: operational.kaBuyingMargin,
      kaFrontMargin: operational.kaFrontMargin,
      kaBackMargin: operational.kaBackMargin,
      fdMargin: operational.fdMargin,
      effectiveDate,
      status: "ACTIVE"
    }
  });

  await prisma.operationalMargin.updateMany({
    where: {
      countryId,
      retailerName: operational.retailerName,
      fdName: operational.fdName,
      incoterms: operational.incoterms,
      category,
      status: "ACTIVE",
      NOT: { id: margin.id }
    },
    data: { status: "INACTIVE" }
  });

  return margin;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

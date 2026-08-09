import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAddQuickSimulationToFormalList,
  canViewAllCountries
} from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  countryCodesForRole,
  hasCountryAccess
} from "@/lib/countryAccess";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import { createMasterDataArchive } from "@/lib/masterDataArchive";
import { prisma } from "@/lib/prisma";
import {
  buildSuggestedSku,
  inferCurrencyExchangeRateToEur,
  inferExchangeRateToEur,
  normalizeSku,
  roundCurrency,
  uniqueSuggestedSku
} from "@/lib/quickSimulation";

type QuickProductPayload = {
  countryCode?: unknown;
  countryCodes?: unknown;
  category?: unknown;
  productName?: unknown;
  model?: unknown;
  rrpEur?: unknown;
  bomEur?: unknown;
  bomRmb?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const [referenceData, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const { accessibleCountryCodes, role } = countryCodesForRole({
    accessRows,
    baseRole: session.role,
    countries: referenceData.countries,
    email: session.email
  });

  const canManageQuickSimulation = canAddQuickSimulationToFormalList(role);
  if (!canManageQuickSimulation) {
    return NextResponse.json(
      { message: "Only admins can add quick simulations to the formal list." },
      { status: 403 }
    );
  }

  const payload = (await request.json()) as QuickProductPayload;
  const productName = text(payload.productName);
  const category = text(payload.category);
  const requestedCountryCodes = countryCodesFromPayload(payload);
  const rrpEur = number(payload.rrpEur);
  const bomEurInput = number(payload.bomEur);
  const bomRmb = number(payload.bomRmb);

  if (!productName || !category || rrpEur <= 0 || (bomEurInput <= 0 && bomRmb <= 0)) {
    return NextResponse.json(
      { message: "Product name, category, RRP, and BOM are required." },
      { status: 400 }
    );
  }

  if (!canViewAllCountries(role) && accessibleCountryCodes.length === 0) {
    return NextResponse.json(
      { message: "No country access has been assigned for your account." },
      { status: 403 }
    );
  }

  const allowedRequestedCountryCodes =
    requestedCountryCodes.length === 0
      ? accessibleCountryCodes
      : requestedCountryCodes;
  const unauthorizedCountryCodes = allowedRequestedCountryCodes.filter(
    (countryCode) => !hasCountryAccess(role, countryCode, accessibleCountryCodes)
  );
  if (unauthorizedCountryCodes.length > 0) {
    return NextResponse.json(
      {
        message:
          "Selected countries include countries outside your assigned access."
      },
      { status: 403 }
    );
  }

  const selectedCountries = referenceData.countries.filter((country) => {
    if (country.status !== "ACTIVE") {
      return false;
    }
    return (
      allowedRequestedCountryCodes.length === 0 ||
      allowedRequestedCountryCodes.includes(country.code)
    );
  });
  if (selectedCountries.length === 0) {
    return NextResponse.json(
      { message: "No active country matched the selected countries." },
      { status: 400 }
    );
  }
  const rmbRate = inferCurrencyExchangeRateToEur(referenceData, "RMB");
  const bomEur =
    bomEurInput > 0
      ? roundCurrency(bomEurInput)
      : rmbRate > 0
        ? roundCurrency(bomRmb / rmbRate)
        : 0;
  if (bomEur <= 0) {
    return NextResponse.json(
      { message: "Missing RMB exchange rate for BOM conversion." },
      { status: 400 }
    );
  }

  const manualSku = text(payload.model);
  const sku = manualSku
    ? normalizeSku(manualSku)
    : uniqueSuggestedSku(
        buildSuggestedSku(productName),
        referenceData.products.map((product) => product.sku)
      );
  const roundedRrpEur = roundCurrency(rrpEur);

  const product = await prisma.product.upsert({
    where: { sku },
    update: {
      name: productName,
      category,
      lifecycleStatus: "UNLAUNCHED",
      status: "ACTIVE"
    },
    create: {
      sku,
      name: productName,
      category,
      lifecycleStatus: "UNLAUNCHED",
      status: "ACTIVE"
    }
  });

  await upsertLatestBom(product.id, bomEur, bomRmb > 0 ? bomRmb : null);
  for (const country of selectedCountries) {
    const exchangeRate = inferExchangeRateToEur(referenceData, country.code);
    await upsertLatestRrp({
      productId: product.id,
      countryId: country.id,
      rrpLocal: roundCurrency(roundedRrpEur * exchangeRate),
      rrpEur: roundedRrpEur,
      currency: country.currency
    });
  }

  revalidatePath("/master-data");
  revalidatePath("/");
  revalidatePath("/promotion");
  revalidatePath("/simulation");
  revalidatePath("/platform/system/master-data");
  revalidatePath("/platform/business/value-chain/on-sale");
  revalidatePath("/platform/business/value-chain/new-product");
  revalidatePath("/platform/business/bp");
  revalidatePath("/platform/collaboration/monthly-approvals");

  const archive = await createMasterDataArchive({
    source: "QUICK_SIMULATION",
    sourceReference: sku,
    title: "New Product Simulation added to formal list",
    message: `${sku} (${productName}) was added to the formal New Product Simulation list and Master Data was updated.`,
    createdByEmail: session.email
  });

  return NextResponse.json({
    status: "success",
    message: "Saved to New Product Simulation and Master Data.",
    sku,
    rrpEur: roundedRrpEur,
    exportUrl:
      canManageQuickSimulation
        ? `/api/master-data/export?source=quick-simulation&sku=${encodeURIComponent(
            sku
          )}`
        : null,
    archive: archive
      ? {
          id: archive.id,
          driveStatus: archive.driveStatus,
          driveUrl: canManageQuickSimulation ? archive.driveUrl : null,
          downloadUrl:
            canManageQuickSimulation
              ? `/api/master-data/archives/${archive.id}/download`
              : null
        }
      : null
  });
}

async function upsertLatestBom(
  productId: string,
  bomEur: number,
  bomRmb: number | null
) {
  const activeBomCosts = await prisma.bomCost.findMany({
    where: { productId, status: "ACTIVE" },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });

  if (activeBomCosts.length > 0) {
    const [latestBomCost, ...olderBomCosts] = activeBomCosts;
    await prisma.bomCost.update({
      where: { id: latestBomCost.id },
      data: {
        bomCost: bomEur.toString(),
        bomCostRmb: bomRmb === null ? null : bomRmb.toString(),
        currency: "EUR"
      }
    });
    await prisma.bomCost.updateMany({
      where: { id: { in: olderBomCosts.map((cost) => cost.id) } },
      data: { status: "INACTIVE" }
    });
    return;
  }

  await prisma.bomCost.create({
    data: {
      productId,
      bomCost: bomEur.toString(),
      bomCostRmb: bomRmb === null ? null : bomRmb.toString(),
      currency: "EUR",
      effectiveDate: new Date(),
      status: "ACTIVE"
    }
  });
}

async function upsertLatestRrp({
  productId,
  countryId,
  rrpLocal,
  rrpEur,
  currency
}: {
  productId: string;
  countryId: string;
  rrpLocal: number;
  rrpEur: number;
  currency: string;
}) {
  const activeRrps = await prisma.productCountryRrp.findMany({
    where: { productId, countryId, status: "ACTIVE" },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }]
  });
  const rrpData = {
    rrpLocal: rrpLocal.toString(),
    rrpEur: rrpEur.toString(),
    currency
  };

  if (activeRrps.length > 0) {
    const [latestRrp, ...olderRrps] = activeRrps;
    await prisma.productCountryRrp.update({
      where: { id: latestRrp.id },
      data: rrpData
    });
    await prisma.productCountryRrp.updateMany({
      where: { id: { in: olderRrps.map((rrp) => rrp.id) } },
      data: { status: "INACTIVE" }
    });
    return;
  }

  await prisma.productCountryRrp.create({
    data: {
      productId,
      countryId,
      ...rrpData,
      effectiveDate: new Date(),
      status: "ACTIVE"
    }
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function countryCodesFromPayload(payload: QuickProductPayload) {
  const rawValues = Array.isArray(payload.countryCodes)
    ? payload.countryCodes
    : payload.countryCodes === undefined
      ? [payload.countryCode]
      : [payload.countryCodes];

  return Array.from(
    new Set(
      rawValues
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

import { NextRequest, NextResponse } from "next/server";
import {
  calculateNormalValueChain,
  calculatePromotionValueChain,
  type SettlementMode
} from "@/lib/calculations/valueChain";
import { canSaveScenario } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  countryCodesForRole,
  hasCountryAccess
} from "@/lib/countryAccess";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import type { ScenarioType } from "@/lib/types";

type SaveScenarioPayload = {
  name: string;
  type: ScenarioType;
  countryId: string;
  productId: string;
  channelMarginId: string;
  fdMarginId: string;
  settlementMode?: SettlementMode;
  hasOverride: boolean;
  overrideReason?: string;
  input: {
    normalRrp?: number;
    promoRrp?: number;
    vatRate: number;
    normalFrontMargin: number;
    normalBackMargin: number;
    normalFdMargin: number;
    promoFrontMargin?: number;
    promoBackMargin?: number;
    promoFdMargin?: number;
    bomCost: number;
    logisticsCost: number;
    promoVolume?: number;
  };
};

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as SaveScenarioPayload;
  const validationError = validatePayload(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const [data, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const { accessibleCountryCodes, role } = countryCodesForRole({
    accessRows,
    baseRole: session.role,
    countries: data.countries,
    email: session.email
  });
  if (!canSaveScenario(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const country = data.countries.find((item) => item.id === payload.countryId);
  if (!country) {
    return NextResponse.json({ error: "Country not found." }, { status: 400 });
  }

  const [channelMargin, fdMargin] = await Promise.all([
    prisma.channelMargin.findUnique({
      where: { id: payload.channelMarginId },
      select: { countryId: true }
    }),
    prisma.fdMargin.findUnique({
      where: { id: payload.fdMarginId },
      select: { countryId: true }
    })
  ]);
  if (
    !channelMargin ||
    !fdMargin ||
    channelMargin.countryId !== country.id ||
    fdMargin.countryId !== country.id
  ) {
    return NextResponse.json(
      { error: "Scenario margin records do not match the selected country." },
      { status: 400 }
    );
  }

  if (!hasCountryAccess(role, country.code, accessibleCountryCodes)) {
    return NextResponse.json(
      { error: "You do not have access to this country." },
      { status: 403 }
    );
  }

  const user = await prisma.user.upsert({
    where: { email: session.email },
    update: {
      name: session.name,
      role
    },
    create: {
      name: session.name,
      email: session.email,
      role
    }
  });

  const savedScenario =
    payload.type === "NORMAL"
      ? await saveNormalScenario(payload, user.id)
      : await savePromotionScenario(payload, user.id);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "scenario",
      entityId: savedScenario.id,
      fieldName: "status",
      newValue: "DRAFT",
      reason: payload.overrideReason || "Scenario created from calculator"
    }
  });

  return NextResponse.json({
    id: savedScenario.id,
    name: savedScenario.name,
    status: savedScenario.status
  });
}

async function saveNormalScenario(payload: SaveScenarioPayload, userId: string) {
  const result = calculateNormalValueChain({
    rrp: payload.input.normalRrp ?? 0,
    vatRate: payload.input.vatRate,
    frontMargin: payload.input.normalFrontMargin,
    backMargin: payload.input.normalBackMargin,
    fdMargin: payload.input.normalFdMargin,
    bomCost: payload.input.bomCost,
    logisticsCost: payload.input.logisticsCost
  });

  return prisma.scenario.create({
    data: {
      name: payload.name,
      type: "NORMAL",
      countryId: payload.countryId,
      productId: payload.productId,
      channelMarginId: payload.channelMarginId,
      fdMarginId: payload.fdMarginId,
      settlementMode: "INVOICE_DISCOUNT",
      status: "DRAFT",
      createdById: userId,
      input: {
        create: {
          normalRrp: decimal(payload.input.normalRrp ?? 0),
          vatRate: decimal(payload.input.vatRate),
          normalFrontMargin: decimal(payload.input.normalFrontMargin),
          normalBackMargin: decimal(payload.input.normalBackMargin),
          normalFdMargin: decimal(payload.input.normalFdMargin),
          bomCost: decimal(payload.input.bomCost),
          logisticsCost: decimal(payload.input.logisticsCost),
          overrideReason: payload.overrideReason || null
        }
      },
      result: {
        create: {
          rrpExVat: decimal(result.rrpExVat),
          priceAfterFrontMargin: decimal(result.priceAfterFrontMargin),
          kaBuyingPrice: decimal(result.kaBuyingPrice),
          fdBuyingPrice: decimal(result.fdBuyingPrice),
          gp: decimal(result.gp),
          gpPercent: decimal(result.gpPercent),
          warningLevel: result.warningLevel
        }
      }
    }
  });
}

async function savePromotionScenario(
  payload: SaveScenarioPayload,
  userId: string
) {
  const settlementMode = payload.settlementMode ?? "INVOICE_DISCOUNT";
  const result = calculatePromotionValueChain({
    normalRrp: payload.input.normalRrp ?? 0,
    promoRrp: payload.input.promoRrp ?? 0,
    vatRate: payload.input.vatRate,
    normalFrontMargin: payload.input.normalFrontMargin,
    normalBackMargin: payload.input.normalBackMargin,
    normalFdMargin: payload.input.normalFdMargin,
    promoFrontMargin: payload.input.promoFrontMargin ?? 0,
    promoBackMargin: payload.input.promoBackMargin ?? 0,
    promoFdMargin: payload.input.promoFdMargin ?? 0,
    bomCost: payload.input.bomCost,
    logisticsCost: payload.input.logisticsCost,
    promoVolume: payload.input.promoVolume ?? 0,
    settlementMode
  });

  return prisma.scenario.create({
    data: {
      name: payload.name,
      type: "PROMOTION",
      countryId: payload.countryId,
      productId: payload.productId,
      channelMarginId: payload.channelMarginId,
      fdMarginId: payload.fdMarginId,
      settlementMode,
      status: "DRAFT",
      createdById: userId,
      input: {
        create: {
          normalRrp: decimal(payload.input.normalRrp ?? 0),
          promoRrp: decimal(payload.input.promoRrp ?? 0),
          vatRate: decimal(payload.input.vatRate),
          normalFrontMargin: decimal(payload.input.normalFrontMargin),
          normalBackMargin: decimal(payload.input.normalBackMargin),
          normalFdMargin: decimal(payload.input.normalFdMargin),
          promoFrontMargin: decimal(payload.input.promoFrontMargin ?? 0),
          promoBackMargin: decimal(payload.input.promoBackMargin ?? 0),
          promoFdMargin: decimal(payload.input.promoFdMargin ?? 0),
          bomCost: decimal(payload.input.bomCost),
          logisticsCost: decimal(payload.input.logisticsCost),
          promoVolume: Math.trunc(payload.input.promoVolume ?? 0),
          overrideReason: payload.overrideReason || null
        }
      },
      result: {
        create: {
          rrpExVat: decimal(result.normalRrpExVat),
          promoRrpExVat: decimal(result.promoRrpExVat),
          priceAfterFrontMargin: decimal(result.normalPriceAfterFrontMargin),
          kaBuyingPrice: decimal(result.normalKaBuyingPrice),
          fdBuyingPrice: decimal(result.normalFdBuyingPrice),
          promoPriceAfterFrontMargin: decimal(
            result.promoPriceAfterFrontMargin
          ),
          rebatePerUnit: decimal(result.rebatePerUnit),
          totalRebate: decimal(result.totalRebate),
          promoKaNewBuyingPrice: decimal(result.promoKaNewBuyingPrice),
          promoFdNetPrice: decimal(result.promoFdNetPrice),
          np: decimal(result.np),
          npPercent: decimal(result.npPercent),
          warningLevel: result.warningLevel
        }
      }
    }
  });
}

function validatePayload(payload: SaveScenarioPayload): string | null {
  if (!payload.name?.trim()) {
    return "Scenario name is required.";
  }

  if (!payload.countryId || !payload.productId) {
    return "Country and product are required.";
  }

  if (!payload.channelMarginId || !payload.fdMarginId) {
    return "Channel margin and FD margin are required.";
  }

  if (payload.hasOverride && !payload.overrideReason?.trim()) {
    return "Override reason is required when defaults are changed.";
  }

  if (payload.type === "PROMOTION" && !payload.settlementMode) {
    return "Settlement mode is required for promotion scenarios.";
  }

  return null;
}

function decimal(value: number) {
  return Number.isFinite(value) ? value.toFixed(8) : "0";
}

import type { PromotionPlanDealType } from "../types";

export type WarningLevel = "GOOD" | "WARNING" | "CRITICAL";
export type SettlementMode = "INVOICE_DISCOUNT" | "REBATE_CLAIM";

export type NormalValueChainInput = {
  rrp: number;
  vatRate: number;
  frontMargin: number;
  backMargin: number;
  fdMargin: number;
  logisticsCost: number;
  bomCost: number;
};

export type NormalValueChainResult = {
  rrp: number;
  rrpExVat: number;
  frontMarginAmount: number;
  priceAfterFrontMargin: number;
  backMarginAmount: number;
  kaBuyingPrice: number;
  fdMarginAmount: number;
  fdBuyingPrice: number;
  logisticsCost: number;
  bomCost: number;
  gp: number;
  gpPercent: number;
  warningLevel: WarningLevel;
};

export type PromotionValueChainInput = {
  normalRrp: number;
  promoRrp: number;
  vatRate: number;
  normalFrontMargin: number;
  normalBackMargin: number;
  normalFdMargin: number;
  promoFrontMargin: number;
  promoBackMargin: number;
  promoFdMargin: number;
  marginRebatePerUnit?: number;
  logisticsCost: number;
  bomCost: number;
  promoVolume: number;
  settlementMode: SettlementMode;
};

export type PromotionValueChainResult = {
  normalRrp: number;
  promoRrp: number;
  normalRrpExVat: number;
  promoRrpExVat: number;
  normalPriceAfterFrontMargin: number;
  promoPriceAfterFrontMargin: number;
  promoRebatePerUnit: number;
  marginRebatePerUnit: number;
  rebatePerUnit: number;
  totalRebate: number;
  normalKaBuyingPrice: number;
  normalFdBuyingPrice: number;
  promoKaNewBuyingPrice: number;
  promoFdNetPrice: number;
  logisticsCost: number;
  bomCost: number;
  np: number;
  npPercent: number;
  warningLevel: WarningLevel;
  highRebateWarning: boolean;
};

export type SettlementDirection = "REBATE_DUE" | "EVEN" | "OVER_RECOVERY";

export type MarginSettlementInput = {
  landingPrice: number;
  actualNetLandingPrice: number;
};

export type MarginSettlementResult = {
  marginRebate: number;
  settlementDirection: SettlementDirection;
};

export type WideNormalValueChainInput = {
  rrp: number;
  vatRate: number;
  kaBuyingMargin: number;
  fdMargin: number;
  actualFrontMargin: number;
  actualBackMargin: number;
  logisticsCost: number;
  bomCost: number;
};

export type WideNormalValueChainResult = {
  rrp: number;
  rrpExVat: number;
  kaBuyingMargin: number;
  landingPrice: number;
  fdMargin: number;
  fdMarginAmount: number;
  fdBuyingPrice: number;
  logisticsCost: number;
  shippingPrice: number;
  bomCost: number;
  gp: number;
  gpPercent: number;
  warningLevel: WarningLevel;
  actualFrontMargin: number;
  actualAfterFrontMargin: number;
  actualBackMargin: number;
  actualNetLandingPrice: number;
  marginRebate: number;
  settlementDirection: SettlementDirection;
};

export type WidePromotionValueChainInput = {
  normalRrp: number;
  promoRrp: number;
  vatRate: number;
  normalKaBuyingMargin: number;
  /**
   * Promo-period real channel front margin. The name is kept for compatibility
   * with existing callers, but this must not use the unified preset KA margin.
   */
  promoKaBuyingMargin: number;
  fdMargin: number;
  dealType?: PromotionPlanDealType;
  promoFdMargin?: number;
  actualFrontMargin: number;
  actualBackMargin: number;
  logisticsCost: number;
  bomCost: number;
  promoVolume: number;
  settlementMode: SettlementMode;
};

export type WidePromotionValueChainResult = PromotionValueChainResult & {
  normalLandingPrice: number;
  promoLandingPrice: number;
  dealType: PromotionPlanDealType;
  promoFdMargin: number;
  fdMarginImpact: number;
  adjustedShippingPrice: number;
  actualAfterFrontMargin: number;
  actualNetLandingPrice: number;
  marginRebate: number;
  settlementDirection: SettlementDirection;
};

const GP_GOOD_THRESHOLD = 0.3;
const GP_WARNING_THRESHOLD = 0.2;
const NP_GOOD_THRESHOLD = 0.2;
const NP_WARNING_THRESHOLD = 0.1;
const HIGH_REBATE_THRESHOLD = 0.15;

export function calculateNormalValueChain(
  input: NormalValueChainInput
): NormalValueChainResult {
  const rrp = finite(input.rrp);
  const vatRate = finite(input.vatRate);
  const frontMargin = finite(input.frontMargin);
  const backMargin = finite(input.backMargin);
  const fdMargin = finite(input.fdMargin);
  const logisticsCost = finite(input.logisticsCost);
  const bomCost = finite(input.bomCost);

  const rrpExVat = rrp / (1 + vatRate);
  const frontMarginAmount = rrpExVat * frontMargin;
  const priceAfterFrontMargin = rrpExVat * (1 - frontMargin);
  const backMarginAmount = priceAfterFrontMargin * backMargin;
  const kaBuyingPrice = priceAfterFrontMargin * (1 - backMargin);
  const fdMarginAmount = kaBuyingPrice * fdMargin;
  const fdBuyingPrice = kaBuyingPrice * (1 - fdMargin);
  const shippingPrice = fdBuyingPrice - logisticsCost;
  const gp = shippingPrice - bomCost;
  const gpPercent = divideOrZero(gp, shippingPrice);

  return {
    rrp,
    rrpExVat,
    frontMarginAmount,
    priceAfterFrontMargin,
    backMarginAmount,
    kaBuyingPrice,
    fdMarginAmount,
    fdBuyingPrice,
    logisticsCost,
    bomCost,
    gp,
    gpPercent,
    warningLevel: getGpWarningLevel(gpPercent)
  };
}

export function calculatePromotionValueChain(
  input: PromotionValueChainInput
): PromotionValueChainResult {
  const normalRrp = finite(input.normalRrp);
  const promoRrp = finite(input.promoRrp);
  const vatRate = finite(input.vatRate);
  const normalFrontMargin = finite(input.normalFrontMargin);
  const normalBackMargin = finite(input.normalBackMargin);
  const normalFdMargin = finite(input.normalFdMargin);
  const promoFrontMargin = finite(input.promoFrontMargin);
  const promoBackMargin = finite(input.promoBackMargin);
  const promoFdMargin = finite(input.promoFdMargin);
  const marginRebatePerUnit = finite(input.marginRebatePerUnit ?? 0);
  const logisticsCost = finite(input.logisticsCost);
  const bomCost = finite(input.bomCost);
  const promoVolume = finite(input.promoVolume);

  const normalRrpExVat = normalRrp / (1 + vatRate);
  const promoRrpExVat = promoRrp / (1 + vatRate);
  const normalPriceAfterFrontMargin =
    normalRrpExVat * (1 - normalFrontMargin);
  const promoPriceAfterFrontMargin = promoRrpExVat * (1 - promoFrontMargin);
  const promoRebatePerUnit = Math.max(
    0,
    normalPriceAfterFrontMargin - promoPriceAfterFrontMargin
  );
  const rebatePerUnit = promoRebatePerUnit + marginRebatePerUnit;
  const totalRebate = rebatePerUnit * promoVolume;
  const normalKaBuyingPrice =
    normalPriceAfterFrontMargin * (1 - normalBackMargin);
  const normalFdBuyingPrice = normalKaBuyingPrice * (1 - normalFdMargin);
  const promoKaNewBuyingPrice =
    promoPriceAfterFrontMargin * (1 - promoBackMargin);
  const promoFdNetPrice = promoKaNewBuyingPrice * (1 - promoFdMargin);

  const normalShippingPrice = normalFdBuyingPrice - logisticsCost;
  const npBase = normalShippingPrice - rebatePerUnit;
  const np = npBase - bomCost;
  const npPercent = divideOrZero(np, npBase);

  return {
    normalRrp,
    promoRrp,
    normalRrpExVat,
    promoRrpExVat,
    normalPriceAfterFrontMargin,
    promoPriceAfterFrontMargin,
    promoRebatePerUnit,
    marginRebatePerUnit,
    rebatePerUnit,
    totalRebate,
    normalKaBuyingPrice,
    normalFdBuyingPrice,
    promoKaNewBuyingPrice,
    promoFdNetPrice,
    logisticsCost,
    bomCost,
    np,
    npPercent,
    warningLevel: getNpWarningLevel(npPercent),
    highRebateWarning: isHighRebate(Math.max(0, rebatePerUnit), normalRrpExVat)
  };
}

export function calculateMarginSettlement(
  input: MarginSettlementInput
): MarginSettlementResult {
  const landingPrice = finite(input.landingPrice);
  const actualNetLandingPrice = finite(input.actualNetLandingPrice);
  const marginRebate = landingPrice - actualNetLandingPrice;

  return {
    marginRebate,
    settlementDirection:
      marginRebate === 0
        ? "EVEN"
        : marginRebate > 0
          ? "REBATE_DUE"
          : "OVER_RECOVERY"
  };
}

export function calculateWideNormalValueChain(
  input: WideNormalValueChainInput
): WideNormalValueChainResult {
  const rrp = finite(input.rrp);
  const vatRate = finite(input.vatRate);
  const kaBuyingMargin = finite(input.kaBuyingMargin);
  const fdMargin = finite(input.fdMargin);
  const actualFrontMargin = finite(input.actualFrontMargin);
  const actualBackMargin = finite(input.actualBackMargin);
  const logisticsCost = finite(input.logisticsCost);
  const bomCost = finite(input.bomCost);

  const rrpExVat = rrp / (1 + vatRate);
  const landingPrice = rrpExVat * (1 - kaBuyingMargin);
  const fdMarginAmount = landingPrice * fdMargin;
  const fdBuyingPrice = landingPrice * (1 - fdMargin);
  const shippingPrice = fdBuyingPrice - logisticsCost;
  const gp = shippingPrice - bomCost;
  const gpPercent = divideOrZero(gp, shippingPrice);
  const actualAfterFrontMargin = rrpExVat * (1 - actualFrontMargin);
  const actualNetLandingPrice =
    actualAfterFrontMargin * (1 - actualBackMargin);
  const settlement = calculateMarginSettlement({
    landingPrice,
    actualNetLandingPrice
  });

  return {
    rrp,
    rrpExVat,
    kaBuyingMargin,
    landingPrice,
    fdMargin,
    fdMarginAmount,
    fdBuyingPrice,
    logisticsCost,
    shippingPrice,
    bomCost,
    gp,
    gpPercent,
    warningLevel: getGpWarningLevel(gpPercent),
    actualFrontMargin,
    actualAfterFrontMargin,
    actualBackMargin,
    actualNetLandingPrice,
    marginRebate: settlement.marginRebate,
    settlementDirection: settlement.settlementDirection
  };
}

export function calculateWidePromotionValueChain(
  input: WidePromotionValueChainInput
): WidePromotionValueChainResult {
  const normalRrp = finite(input.normalRrp);
  const promoRrp = finite(input.promoRrp);
  const vatRate = finite(input.vatRate);
  const normalKaBuyingMargin = finite(input.normalKaBuyingMargin);
  const promoKaBuyingMargin = finite(input.promoKaBuyingMargin);
  const fdMargin = finite(input.fdMargin);
  const dealType = input.dealType ?? "NORMAL";
  const promoFdMargin =
    dealType === "NORMAL" ? fdMargin : finite(input.promoFdMargin ?? fdMargin);
  const actualFrontMargin = finite(input.actualFrontMargin);
  const actualBackMargin = finite(input.actualBackMargin);
  const logisticsCost = finite(input.logisticsCost);
  const bomCost = finite(input.bomCost);
  const promoVolume = finite(input.promoVolume);

  const normalRrpExVat = normalRrp / (1 + vatRate);
  const promoRrpExVat = promoRrp / (1 + vatRate);
  const normalLandingPrice = normalRrpExVat * (1 - normalKaBuyingMargin);
  const promoLandingPrice = promoRrpExVat * (1 - promoKaBuyingMargin);
  const actualAfterFrontMargin = normalRrpExVat * (1 - actualFrontMargin);
  const actualNetLandingPrice =
    actualAfterFrontMargin * (1 - actualBackMargin);
  const settlement = calculateMarginSettlement({
    landingPrice: normalLandingPrice,
    actualNetLandingPrice
  });
  const normalFdBuyingPrice = normalLandingPrice * (1 - fdMargin);
  const promoFdNetPrice = promoLandingPrice * (1 - promoFdMargin);
  const promoRebatePerUnit = Math.max(
    0,
    actualAfterFrontMargin - promoLandingPrice
  );
  const marginRebatePerUnit = settlement.marginRebate;
  const rebatePerUnit = promoRebatePerUnit + marginRebatePerUnit;
  const totalRebate = rebatePerUnit * promoVolume;
  const normalShippingPrice = normalFdBuyingPrice - logisticsCost;
  const adjustedFdBuyingPrice = normalLandingPrice * (1 - promoFdMargin);
  const adjustedShippingPrice = adjustedFdBuyingPrice - logisticsCost;
  const fdMarginImpact = adjustedShippingPrice - normalShippingPrice;
  const npBase = adjustedShippingPrice - rebatePerUnit;
  const np = npBase - bomCost;
  const npPercent = divideOrZero(np, npBase);

  return {
    normalRrp,
    promoRrp,
    normalRrpExVat,
    promoRrpExVat,
    normalPriceAfterFrontMargin: actualAfterFrontMargin,
    promoPriceAfterFrontMargin: promoLandingPrice,
    promoRebatePerUnit,
    marginRebatePerUnit,
    rebatePerUnit,
    totalRebate,
    normalKaBuyingPrice: normalLandingPrice,
    normalFdBuyingPrice,
    promoKaNewBuyingPrice: promoLandingPrice,
    promoFdNetPrice,
    logisticsCost,
    bomCost,
    np,
    npPercent,
    warningLevel: getNpWarningLevel(npPercent),
    highRebateWarning: isHighRebate(Math.max(0, rebatePerUnit), normalRrpExVat),
    normalLandingPrice,
    promoLandingPrice,
    dealType,
    promoFdMargin,
    fdMarginImpact,
    adjustedShippingPrice,
    actualAfterFrontMargin,
    actualNetLandingPrice,
    marginRebate: settlement.marginRebate,
    settlementDirection: settlement.settlementDirection
  };
}

export function getGpWarningLevel(gpPercent: number): WarningLevel {
  return getWarningLevel(
    gpPercent,
    GP_GOOD_THRESHOLD,
    GP_WARNING_THRESHOLD
  );
}

export function getNpWarningLevel(npPercent: number): WarningLevel {
  return getWarningLevel(
    npPercent,
    NP_GOOD_THRESHOLD,
    NP_WARNING_THRESHOLD
  );
}

export function isHighRebate(
  rebatePerUnit: number,
  normalRrpExVat: number
): boolean {
  return divideOrZero(rebatePerUnit, normalRrpExVat) > HIGH_REBATE_THRESHOLD;
}

function getWarningLevel(
  percent: number,
  goodThreshold: number,
  warningThreshold: number
): WarningLevel {
  if (percent >= goodThreshold) {
    return "GOOD";
  }

  if (percent >= warningThreshold) {
    return "WARNING";
  }

  return "CRITICAL";
}

function divideOrZero(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

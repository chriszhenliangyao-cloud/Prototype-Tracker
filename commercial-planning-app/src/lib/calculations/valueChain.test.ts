import { describe, expect, it } from "vitest";
import {
  calculateMarginSettlement,
  calculateNormalValueChain,
  calculatePromotionValueChain,
  calculateWideNormalValueChain,
  calculateWidePromotionValueChain,
  getGpWarningLevel,
  getNpWarningLevel
} from "./valueChain";

describe("value-chain calculations", () => {
  it("calculates VAT-exclusive price from tax-inclusive RRP", () => {
    const result = calculateNormalValueChain({
      rrp: 121,
      vatRate: 0.21,
      frontMargin: 0.3,
      backMargin: 0.1,
      fdMargin: 0.08,
      logisticsCost: 3,
      bomCost: 30
    });

    expect(result.rrpExVat).toBeCloseTo(100, 5);
  });

  it("calculates normal GP and GP percent from shipping price", () => {
    const result = calculateNormalValueChain({
      rrp: 121,
      vatRate: 0.21,
      frontMargin: 0.3,
      backMargin: 0.1,
      fdMargin: 0.08,
      logisticsCost: 3,
      bomCost: 30
    });

    expect(result.priceAfterFrontMargin).toBeCloseTo(70, 5);
    expect(result.kaBuyingPrice).toBeCloseTo(63, 5);
    expect(result.fdBuyingPrice).toBeCloseTo(57.96, 5);
    expect(result.gp).toBeCloseTo(24.96, 5);
    expect(result.gpPercent).toBeCloseTo(0.4541485, 5);
  });

  it("calculates promotion NP in invoice discount mode without double-counting rebate", () => {
    const result = calculatePromotionValueChain({
      normalRrp: 121,
      promoRrp: 96.8,
      vatRate: 0.21,
      normalFrontMargin: 0.3,
      normalBackMargin: 0.1,
      normalFdMargin: 0.08,
      promoFrontMargin: 0.25,
      promoBackMargin: 0.08,
      promoFdMargin: 0.06,
      logisticsCost: 3,
      bomCost: 30,
      promoVolume: 1000,
      settlementMode: "INVOICE_DISCOUNT"
    });

    expect(result.normalPriceAfterFrontMargin).toBeCloseTo(70, 5);
    expect(result.promoPriceAfterFrontMargin).toBeCloseTo(60, 5);
    expect(result.promoRebatePerUnit).toBeCloseTo(10, 5);
    expect(result.marginRebatePerUnit).toBeCloseTo(0, 5);
    expect(result.rebatePerUnit).toBeCloseTo(10, 5);
    expect(result.totalRebate).toBeCloseTo(10000, 5);
    expect(result.promoKaNewBuyingPrice).toBeCloseTo(55.2, 5);
    expect(result.promoFdNetPrice).toBeCloseTo(51.888, 5);
    expect(result.np).toBeCloseTo(14.96, 5);
    expect(result.npPercent).toBeCloseTo(0.3327402, 5);
  });

  it("calculates promotion NP in rebate claim mode by deducting real rebate from normal invoice price", () => {
    const result = calculatePromotionValueChain({
      normalRrp: 121,
      promoRrp: 96.8,
      vatRate: 0.21,
      normalFrontMargin: 0.3,
      normalBackMargin: 0.1,
      normalFdMargin: 0.08,
      promoFrontMargin: 0.25,
      promoBackMargin: 0.08,
      promoFdMargin: 0.06,
      logisticsCost: 3,
      bomCost: 30,
      promoVolume: 1000,
      settlementMode: "REBATE_CLAIM"
    });

    expect(result.normalKaBuyingPrice).toBeCloseTo(63, 5);
    expect(result.normalFdBuyingPrice).toBeCloseTo(57.96, 5);
    expect(result.promoRebatePerUnit).toBeCloseTo(10, 5);
    expect(result.marginRebatePerUnit).toBeCloseTo(0, 5);
    expect(result.rebatePerUnit).toBeCloseTo(10, 5);
    expect(result.np).toBeCloseTo(14.96, 5);
    expect(result.npPercent).toBeCloseTo(0.3327402, 5);
  });

  it("includes margin rebate in promotion NP while preserving rebate components", () => {
    const result = calculatePromotionValueChain({
      normalRrp: 121,
      promoRrp: 96.8,
      vatRate: 0.21,
      normalFrontMargin: 0.3,
      normalBackMargin: 0.1,
      normalFdMargin: 0.08,
      promoFrontMargin: 0.25,
      promoBackMargin: 0.08,
      promoFdMargin: 0.06,
      marginRebatePerUnit: 1.5,
      logisticsCost: 3,
      bomCost: 30,
      promoVolume: 1000,
      settlementMode: "REBATE_CLAIM"
    });

    expect(result.promoRebatePerUnit).toBeCloseTo(10, 5);
    expect(result.marginRebatePerUnit).toBeCloseTo(1.5, 5);
    expect(result.rebatePerUnit).toBeCloseTo(11.5, 5);
    expect(result.totalRebate).toBeCloseTo(11500, 5);
    expect(result.np).toBeCloseTo(13.46, 5);
    expect(result.npPercent).toBeCloseTo(0.3097101, 5);
  });

  it("does not allow rebate per unit to go below zero", () => {
    const result = calculatePromotionValueChain({
      normalRrp: 100,
      promoRrp: 120,
      vatRate: 0.2,
      normalFrontMargin: 0.2,
      normalBackMargin: 0.1,
      normalFdMargin: 0.08,
      promoFrontMargin: 0.1,
      promoBackMargin: 0.08,
      promoFdMargin: 0.06,
      logisticsCost: 2,
      bomCost: 20,
      promoVolume: 100,
      settlementMode: "REBATE_CLAIM"
    });

    expect(result.rebatePerUnit).toBe(0);
    expect(result.totalRebate).toBe(0);
  });

  it("classifies GP and NP warning levels from configured thresholds", () => {
    expect(getGpWarningLevel(0.3)).toBe("GOOD");
    expect(getGpWarningLevel(0.299)).toBe("WARNING");
    expect(getGpWarningLevel(0.199)).toBe("CRITICAL");
    expect(getNpWarningLevel(0.2)).toBe("GOOD");
    expect(getNpWarningLevel(0.199)).toBe("WARNING");
    expect(getNpWarningLevel(0.099)).toBe("CRITICAL");
  });

  it("wide normal calculation uses preset KA buying margin as unified landing price", () => {
    const result = calculateWideNormalValueChain({
      rrp: 39.99,
      vatRate: 0.21,
      kaBuyingMargin: 0.4,
      fdMargin: 0.13,
      actualFrontMargin: 0.2,
      actualBackMargin: 0.3,
      logisticsCost: 0.9,
      bomCost: 8.68
    });

    expect(result.rrpExVat).toBeCloseTo(33.05, 2);
    expect(result.landingPrice).toBeCloseTo(19.83, 2);
    expect(result.fdBuyingPrice).toBeCloseTo(17.25, 2);
    expect(result.actualAfterFrontMargin).toBeCloseTo(26.44, 2);
    expect(result.actualNetLandingPrice).toBeCloseTo(18.51, 2);
    expect(result.marginRebate).toBeCloseTo(1.32, 2);
    expect(result.gp).toBeCloseTo(7.67, 2);
  });

  it("margin settlement keeps negative deltas visible", () => {
    const result = calculateMarginSettlement({
      landingPrice: 21.75,
      actualNetLandingPrice: 22.5
    });

    expect(result.marginRebate).toBeCloseTo(-0.75, 2);
    expect(result.settlementDirection).toBe("OVER_RECOVERY");
  });

  it("margin settlement keeps tiny negative deltas visible", () => {
    const result = calculateMarginSettlement({
      landingPrice: 1,
      actualNetLandingPrice: 1.0000005
    });

    expect(result.marginRebate).toBeLessThan(0);
    expect(result.settlementDirection).toBe("OVER_RECOVERY");
  });

  it("wide promotion calculation uses manual RRPP and preset promo margin", () => {
    const result = calculateWidePromotionValueChain({
      normalRrp: 69.99,
      promoRrp: 59.99,
      vatRate: 0.2,
      normalKaBuyingMargin: 0.42,
      promoKaBuyingMargin: 0.42,
      fdMargin: 0.2,
      actualFrontMargin: 0.42,
      actualBackMargin: 0,
      logisticsCost: 0.9,
      bomCost: 18.08,
      promoVolume: 1000,
      settlementMode: "INVOICE_DISCOUNT"
    });

    expect(result.normalRrpExVat).toBe(69.99 / (1 + 0.2));
    expect(result.promoRrpExVat).toBe(59.99 / (1 + 0.2));
    expect(result.promoRebatePerUnit).toBeCloseTo(4.83, 2);
    expect(result.marginRebatePerUnit).toBeCloseTo(0, 2);
    expect(result.rebatePerUnit).toBeCloseTo(4.83, 2);
    expect(result.totalRebate).toBeCloseTo(4833, 0);
    expect(result.np).toBeCloseTo(3.249466666666674, 12);
    expect(result.npPercent).toBeCloseTo(0.15234636277825386, 12);
    expect(result.dealType).toBe("NORMAL");
    expect(result.fdMarginImpact).toBeCloseTo(0, 12);
    expect(result.adjustedShippingPrice).toBeCloseTo(26.1628, 4);
  });

  it("wide promotion calculation applies B2B or EOL FD margin cuts through adjusted shipping price", () => {
    const result = calculateWidePromotionValueChain({
      normalRrp: 69.99,
      promoRrp: 59.99,
      vatRate: 0.2,
      normalKaBuyingMargin: 0.42,
      promoKaBuyingMargin: 0.42,
      fdMargin: 0.2,
      dealType: "B2B_DEAL",
      promoFdMargin: 0.1,
      actualFrontMargin: 0.42,
      actualBackMargin: 0,
      logisticsCost: 0.9,
      bomCost: 18.08,
      promoVolume: 1000,
      settlementMode: "INVOICE_DISCOUNT"
    });

    expect(result.promoRebatePerUnit).toBeCloseTo(4.83, 2);
    expect(result.marginRebatePerUnit).toBeCloseTo(0, 2);
    expect(result.fdMarginImpact).toBeCloseTo(3.38285, 5);
    expect(result.adjustedShippingPrice).toBeCloseTo(29.54565, 5);
    expect(result.np).toBeCloseTo(6.632316666666675, 12);
  });

  it("wide promotion calculation passes rebate claim settlement mode and exposes settlement fields", () => {
    const input = {
      normalRrp: 69.99,
      promoRrp: 59.99,
      vatRate: 0.2,
      normalKaBuyingMargin: 0.42,
      promoKaBuyingMargin: 0.42,
      fdMargin: 0.2,
      actualFrontMargin: 0.35,
      actualBackMargin: 0.1,
      logisticsCost: 0.9,
      bomCost: 18.08,
      promoVolume: 1000,
      settlementMode: "REBATE_CLAIM" as const
    };

    const result = calculateWidePromotionValueChain(input);
    expect(result.promoRebatePerUnit).toBeCloseTo(8.91608333333333, 12);
    expect(result.marginRebatePerUnit).toBeCloseTo(-0.291625, 5);
    expect(result.rebatePerUnit).toBeCloseTo(8.624458333333333, 12);
    expect(result.totalRebate).toBeCloseTo(8624.458333333334, 9);
    expect(result.np).toBeCloseTo(-0.5416583333333271, 12);
    expect(result.npPercent).toBeCloseTo(-0.030884238865228723, 12);
    expect(result.warningLevel).toBe("CRITICAL");
    expect(result.normalLandingPrice).toBeCloseTo(33.8285, 5);
    expect(result.promoLandingPrice).toBeCloseTo(28.99516666666667, 5);
    expect(result.actualAfterFrontMargin).toBeCloseTo(37.91125, 5);
    expect(result.actualNetLandingPrice).toBeCloseTo(34.120125, 5);
    expect(result.marginRebate).toBeCloseTo(-0.291625, 5);
    expect(result.settlementDirection).toBe("OVER_RECOVERY");
  });
});

import { describe, expect, test } from "vitest";
import {
  marginRatioToPercentInput,
  percentInputToMarginRatio
} from "./marginInput";

describe("margin percentage inputs", () => {
  test("shows stored ratios as percentage numbers", () => {
    expect(marginRatioToPercentInput(0.3)).toBe("30");
    expect(marginRatioToPercentInput("0.375")).toBe("37.5");
    expect(marginRatioToPercentInput(0.333333)).toBe("33.3333");
    expect(marginRatioToPercentInput("")).toBe("");
  });

  test("converts percentage numbers back to stored ratios", () => {
    expect(percentInputToMarginRatio("30")).toBe("0.3");
    expect(percentInputToMarginRatio("37.5")).toBe("0.375");
    expect(percentInputToMarginRatio("33.3333")).toBe("0.333333");
    expect(percentInputToMarginRatio("")).toBe("");
  });
});

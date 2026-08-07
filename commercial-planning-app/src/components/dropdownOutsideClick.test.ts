import { describe, expect, test } from "vitest";
import { isOutsideDropdownTarget } from "./dropdownOutsideClick";

describe("isOutsideDropdownTarget", () => {
  test("only asks dropdowns to close when the pointer target is outside the root", () => {
    const insideTarget = {} as Node & EventTarget;
    const outsideTarget = {} as Node & EventTarget;
    const root = {
      contains: (target: Node | null) => target === insideTarget
    } satisfies Pick<Node, "contains">;

    expect(isOutsideDropdownTarget(root, insideTarget)).toBe(false);
    expect(isOutsideDropdownTarget(root, outsideTarget)).toBe(true);
    expect(isOutsideDropdownTarget(null, outsideTarget)).toBe(false);
  });
});

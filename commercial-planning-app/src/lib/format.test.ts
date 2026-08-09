import { describe, expect, test } from "vitest";
import { toInputDate } from "./format";

describe("toInputDate", () => {
  test("returns an empty input value for an absent or invalid date", () => {
    expect(toInputDate(null)).toBe("");
    expect(toInputDate(undefined)).toBe("");
    expect(toInputDate("")).toBe("");
    expect(toInputDate("not-a-date")).toBe("");
  });

  test("preserves valid date-only values", () => {
    expect(toInputDate("2026-08-15")).toBe("2026-08-15");
    expect(toInputDate(new Date("2026-08-15T00:00:00.000Z"))).toBe("2026-08-15");
  });
});

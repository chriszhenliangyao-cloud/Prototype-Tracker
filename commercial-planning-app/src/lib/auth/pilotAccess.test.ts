import { describe, expect, it } from "vitest";
import { getPilotAccessCookieMaxAge } from "./pilotAccess";

describe("pilot access cookie", () => {
  it("limits snapshot access to ten minutes", () => {
    expect(getPilotAccessCookieMaxAge(2000, 1000)).toBe(600);
  });

  it("never outlives the source session", () => {
    expect(getPilotAccessCookieMaxAge(1120, 1000)).toBe(120);
  });

  it("expires immediately when the source session has ended", () => {
    expect(getPilotAccessCookieMaxAge(900, 1000)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { readPlatformSessionToken } from "./platformSessionTokens";

describe("readPlatformSessionToken", () => {
  it("accepts short opaque refresh tokens", () => {
    expect(readPlatformSessionToken("refresh-token", 1)).toBe("refresh-token");
  });

  it("retains the access-token length sanity check", () => {
    expect(readPlatformSessionToken("short", 20)).toBe("");
    expect(readPlatformSessionToken("a".repeat(20), 20)).toBe("a".repeat(20));
  });

  it("rejects missing, blank, and oversized values", () => {
    expect(readPlatformSessionToken(undefined, 1)).toBe("");
    expect(readPlatformSessionToken("   ", 1)).toBe("");
    expect(readPlatformSessionToken("a".repeat(10000), 1)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { createCodeChallenge, createRandomToken } from "./pkce";

describe("PKCE helpers", () => {
  it("creates a S256 code challenge", () => {
    expect(createCodeChallenge("test-verifier")).toBe(
      "JBbiqONGWPaAmwXk_8bT6UnlPfrn65D32eZlJS-zGG0"
    );
  });

  it("creates URL-safe random tokens", () => {
    const token = createRandomToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43);
  });
});

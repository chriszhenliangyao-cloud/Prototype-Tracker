import { describe, expect, it } from "vitest";
import { isNavigationPrefetch } from "./requestIntent";

describe("navigation request intent", () => {
  it.each([
    ["next-router-prefetch", "1"],
    ["x-middleware-prefetch", "1"],
    ["purpose", "prefetch"],
    ["sec-purpose", "prefetch;prerender"]
  ])("recognizes %s requests as prefetches", (name, value) => {
    expect(isNavigationPrefetch(new Headers({ [name]: value }))).toBe(true);
  });

  it("keeps an ordinary browser navigation interactive", () => {
    expect(isNavigationPrefetch(new Headers({ "sec-fetch-mode": "navigate" }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAuthReturnTo } from "./returnTo";

describe("auth return target normalization", () => {
  it("keeps local module paths", () => {
    expect(normalizeAuthReturnTo("/promotion")).toBe("/promotion");
    expect(normalizeAuthReturnTo("/master-data?tab=imports")).toBe(
      "/master-data?tab=imports"
    );
  });

  it("rejects external or auth-loop targets", () => {
    expect(normalizeAuthReturnTo("https://example.com/promotion")).toBe("/");
    expect(normalizeAuthReturnTo("//example.com/promotion")).toBe("/");
    expect(normalizeAuthReturnTo("/auth/login")).toBe("/");
    expect(normalizeAuthReturnTo("")).toBe("/");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Master Data workbook upload route", () => {
  const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

  test("uses the unified request-scoped Supabase session path", () => {
    expect(source).toContain('import { getCurrentSession } from "@/lib/auth/server"');
    expect(source).toContain("const session = await getCurrentSession()");
    expect(source).not.toContain("getSessionFromCookieValue");
  });

  test("supports JSON publication without caching authenticated responses", () => {
    expect(source).toContain('includes("application/json")');
    expect(source).toContain('"Cache-Control": "private, no-store"');
  });
});

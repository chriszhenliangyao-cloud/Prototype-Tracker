import { describe, expect, it } from "vitest";
import { getSupabaseAuthCookieNames } from "./supabase";

describe("Supabase auth cookie cleanup", () => {
  it("selects all Supabase session chunks and PKCE cookies", () => {
    expect(getSupabaseAuthCookieNames([
      { name: "vc_session" },
      { name: "sb-project-auth-token" },
      { name: "sb-project-auth-token.0" },
      { name: "sb-project-auth-token.1" },
      { name: "sb-project-auth-token-code-verifier" }
    ])).toEqual([
      "sb-project-auth-token",
      "sb-project-auth-token.0",
      "sb-project-auth-token.1",
      "sb-project-auth-token-code-verifier"
    ]);
  });

  it("deduplicates cookie names and ignores unrelated cookies", () => {
    expect(getSupabaseAuthCookieNames([
      { name: "sb-project-auth-token" },
      { name: "sb-project-auth-token" },
      { name: "theme" }
    ])).toEqual(["sb-project-auth-token"]);
  });
});

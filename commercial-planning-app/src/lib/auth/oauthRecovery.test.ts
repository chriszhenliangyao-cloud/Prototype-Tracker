import { describe, expect, it } from "vitest";
import {
  hasRetriedAuthFlow,
  isRecoverableSupabaseExchangeError
} from "./oauthRecovery";

describe("Supabase OAuth recovery", () => {
  it("recovers from overwritten or missing PKCE verifier state", () => {
    expect(isRecoverableSupabaseExchangeError({ code: "bad_code_verifier" })).toBe(true);
    expect(isRecoverableSupabaseExchangeError({ code: "flow_state_not_found" })).toBe(true);
  });

  it("does not hide unrelated authentication failures", () => {
    expect(isRecoverableSupabaseExchangeError({ code: "unexpected_failure" })).toBe(false);
    expect(isRecoverableSupabaseExchangeError(null)).toBe(false);
  });

  it("limits automatic recovery to one retry", () => {
    expect(hasRetriedAuthFlow(new URLSearchParams())).toBe(false);
    expect(hasRetriedAuthFlow(new URLSearchParams("authRetry=1"))).toBe(true);
  });
});

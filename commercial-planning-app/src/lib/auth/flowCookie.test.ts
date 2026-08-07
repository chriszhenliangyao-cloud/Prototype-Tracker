import { describe, expect, it } from "vitest";
import {
  authFlowCookieName,
  createAuthFlowCookie,
  readAuthFlowCookie
} from "./flowCookie";

describe("OAuth flow cookies", () => {
  it("isolates each login flow by OAuth state", () => {
    expect(authFlowCookieName("state-a")).not.toBe(
      authFlowCookieName("state-b")
    );
  });

  it("round-trips verifier and return path for the expected state", () => {
    const value = createAuthFlowCookie({
      state: "state-a",
      verifier: "verifier-a",
      returnTo: "/promotion?request=123"
    });

    expect(readAuthFlowCookie(value, "state-a")).toEqual({
      state: "state-a",
      verifier: "verifier-a",
      returnTo: "/promotion?request=123"
    });
  });

  it("rejects a flow cookie for a different state", () => {
    const value = createAuthFlowCookie({
      state: "state-a",
      verifier: "verifier-a",
      returnTo: "/"
    });

    expect(readAuthFlowCookie(value, "state-b")).toBeNull();
  });

  it("normalizes unsafe return paths", () => {
    const value = createAuthFlowCookie({
      state: "state-a",
      verifier: "verifier-a",
      returnTo: "https://evil.example.com"
    });

    expect(readAuthFlowCookie(value, "state-a")?.returnTo).toBe("/");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

describe("platform session bridge", () => {
  const routeSource = readFileSync(
    new URL("../../app/auth/platform-session/route.ts", import.meta.url),
    "utf8"
  );
  const cloudSyncSource = readFileSync(
    new URL("../../../public/cloud-sync.js", import.meta.url),
    "utf8"
  );
  const serverAuthSource = readFileSync(
    new URL("./server.ts", import.meta.url),
    "utf8"
  );

  it("validates an access token without rotating or forwarding a refresh token", () => {
    expect(routeSource).toContain("getSupabaseAccessTokenAppSession");
    expect(routeSource).not.toContain("auth.setSession");
    expect(routeSource).not.toContain("refreshToken");
    expect(cloudSyncSource).toContain(
      "body: JSON.stringify({ accessToken: session.access_token })"
    );
    expect(cloudSyncSource).not.toContain("refreshToken: session.refresh_token");
    expect(serverAuthSource).not.toContain(
      'if (config.provider === "supabase") return null'
    );
  });

  it("stops terminal save failures and caps transient retries", () => {
    expect(cloudSyncSource).toContain("MAX_TRANSIENT_SAVE_ATTEMPTS = 3");
    expect(cloudSyncSource).toContain("classifyDocumentSaveError");
    expect(cloudSyncSource).toContain("retryStopped");
  });
});

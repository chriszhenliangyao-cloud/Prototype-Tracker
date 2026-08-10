import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSessionCookie: vi.fn(),
  createSupabaseRouteClient: vi.fn(),
  getAuthConfig: vi.fn(),
  getSupabaseAppSession: vi.fn(),
  verifySessionCookie: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  getAuthConfig: mocks.getAuthConfig
}));

vi.mock("@/lib/auth/sessionCookie", () => ({
  createSessionCookie: mocks.createSessionCookie,
  sessionCookieName: "vc_session",
  verifySessionCookie: mocks.verifySessionCookie
}));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseRouteClient: mocks.createSupabaseRouteClient,
  getSupabaseAppSession: mocks.getSupabaseAppSession
}));

import { proxy } from "./proxy";

const config = {
  enabled: true,
  provider: "supabase",
  appUrl: "https://operations-planning-hub.vercel.app",
  sessionSecret: "test-secret",
  cognitoDomain: "",
  cognitoIssuer: "",
  cognitoClientId: "",
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "publishable-key",
  emailRoleMap: {},
  sessionMaxAgeSeconds: 28800
};

const appSession = {
  email: "owner@example.com",
  name: "Owner",
  role: "OWNER",
  groups: ["OWNER"],
  expiresAt: Math.floor(Date.now() / 1000) + 3600
};

describe("static embedded module proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue(config);
    mocks.createSessionCookie.mockReturnValue("signed-platform-session");
    mocks.createSupabaseRouteClient.mockReturnValue({ auth: {} });
  });

  it("accepts an existing Supabase SSR session and mints the fast-path cookie", async () => {
    mocks.verifySessionCookie.mockReturnValue(null);
    mocks.getSupabaseAppSession.mockResolvedValue(appSession);

    const response = await proxy(new NextRequest(
      "https://operations-planning-hub.vercel.app/platform/index.html?embedded=1",
      { headers: { cookie: "sb-project-auth-token=existing-session" } }
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("vc_session")?.value)
      .toBe("signed-platform-session");
    expect(mocks.getSupabaseAppSession).toHaveBeenCalledOnce();
  });

  it("redirects only when neither signed nor Supabase session is valid", async () => {
    mocks.verifySessionCookie.mockReturnValue(null);
    mocks.getSupabaseAppSession.mockResolvedValue(null);

    const response = await proxy(new NextRequest(
      "https://operations-planning-hub.vercel.app/platform-native/index.html?embedded=1"
    ));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") || "");
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("platformEmbed")).toBe("1");
    expect(location.searchParams.get("returnTo"))
      .toBe("/platform-native/index.html?embedded=1");
  });

  it("keeps valid signed sessions on the fast path", async () => {
    mocks.verifySessionCookie.mockReturnValue(appSession);

    const response = await proxy(new NextRequest(
      "https://operations-planning-hub.vercel.app/platform/index.html?embedded=1"
    ));

    expect(response.status).toBe(200);
    expect(mocks.createSupabaseRouteClient).not.toHaveBeenCalled();
    expect(mocks.getSupabaseAppSession).not.toHaveBeenCalled();
  });
});

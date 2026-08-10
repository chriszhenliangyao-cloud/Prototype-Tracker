import { describe, expect, it, vi } from "vitest";
import { setPlatformSessionCookie } from "./platformSessionCookie";

describe("platform session cookie", () => {
  it("uses one short-lived, same-origin cookie policy for every auth bridge", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T07:00:00.000Z"));
    const set = vi.fn();

    setPlatformSessionCookie(
      { cookies: { set } },
      {
        email: "owner@example.com",
        name: "Owner",
        role: "OWNER",
        groups: ["OWNER"],
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      },
      {
        enabled: true,
        provider: "supabase",
        appUrl: "https://operations-planning-hub.vercel.app",
        sessionSecret: "test-secret",
        cognitoDomain: "",
        cognitoIssuer: "",
        cognitoClientId: "",
        supabaseUrl: "https://example.supabase.co",
        supabasePublishableKey: "publishable-key",
        emailRoleMap: {
          OWNER: [],
          GTM_LEADER: [],
          GM: [],
          ADMIN: [],
          FINANCE: [],
          SALES_MANAGER: [],
          KA_OWNER: [],
          VIEWER: []
        },
        sessionMaxAgeSeconds: 28800
      }
    );

    expect(set).toHaveBeenCalledOnce();
    expect(set.mock.calls[0]?.[0]).toBe("vc_session");
    expect(set.mock.calls[0]?.[2]).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });
    vi.useRealTimers();
  });
});

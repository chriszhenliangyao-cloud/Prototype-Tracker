import { describe, expect, it } from "vitest";
import { getAuthConfig, isAuthRequired } from "./config";

describe("auth config", () => {
  it("treats authentication as disabled unless explicitly required", () => {
    expect(isAuthRequired({})).toBe(false);
    expect(isAuthRequired({ AUTH_REQUIRED: "0" })).toBe(false);
    expect(isAuthRequired({ AUTH_REQUIRED: "1" })).toBe(true);
  });

  it("reads Cognito settings for an enabled production deployment", () => {
    expect(
      getAuthConfig({
        AUTH_REQUIRED: "1",
        APP_URL: "https://value-chain.example.com",
        AUTH_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
        COGNITO_DOMAIN: "https://value-chain.auth.eu-west-3.amazoncognito.com",
        COGNITO_ISSUER:
          "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_example",
        COGNITO_CLIENT_ID: "client-id"
      })
    ).toEqual({
      enabled: true,
      provider: "cognito",
      appUrl: "https://value-chain.example.com",
      sessionSecret: "0123456789abcdef0123456789abcdef",
      cognitoDomain: "https://value-chain.auth.eu-west-3.amazoncognito.com",
      cognitoIssuer:
        "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_example",
      cognitoClientId: "client-id",
      cognitoClientSecret: undefined,
      cognitoIdentityProvider: undefined,
      supabaseUrl: "",
      supabasePublishableKey: "",
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
    });
  });

  it("reads optional Google login and email role allowlists", () => {
    expect(
      getAuthConfig({
        AUTH_REQUIRED: "1",
        APP_URL: "https://value-chain.example.com/",
        AUTH_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
        COGNITO_DOMAIN: "https://value-chain.auth.eu-west-3.amazoncognito.com/",
        COGNITO_ISSUER:
          "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_example/",
        COGNITO_CLIENT_ID: "client-id",
        COGNITO_IDENTITY_PROVIDER: "Google",
        AUTH_OWNER_EMAILS: "owner@example.com",
        AUTH_GTM_LEADER_EMAILS: "gtm.leader@example.com",
        AUTH_GM_EMAILS: "gm@example.com",
        AUTH_ADMIN_EMAILS: "Payton.ppc@gmail.com, admin@example.com",
        AUTH_FINANCE_EMAILS: "finance@example.com sales-finance@example.com"
      })
    ).toMatchObject({
      cognitoIdentityProvider: "Google",
      emailRoleMap: {
        OWNER: ["owner@example.com"],
        GTM_LEADER: ["gtm.leader@example.com"],
        GM: ["gm@example.com"],
        ADMIN: ["payton.ppc@gmail.com", "admin@example.com"],
        FINANCE: ["finance@example.com", "sales-finance@example.com"],
        SALES_MANAGER: [],
        KA_OWNER: [],
        VIEWER: []
      }
    });
  });

  it("reports missing Cognito settings clearly", () => {
    expect(() =>
      getAuthConfig({
        AUTH_REQUIRED: "1",
        APP_URL: "https://value-chain.example.com",
        AUTH_SESSION_SECRET: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow(
      "Missing auth environment variables: COGNITO_DOMAIN, COGNITO_ISSUER, COGNITO_CLIENT_ID"
    );
  });

  it("reads Supabase settings for the copied platform application", () => {
    expect(
      getAuthConfig({
        AUTH_REQUIRED: "1",
        AUTH_PROVIDER: "supabase",
        APP_URL: "https://commercial.example.com/",
        AUTH_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
        SUPABASE_URL: "https://example.supabase.co/",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
      })
    ).toMatchObject({
      enabled: true,
      provider: "supabase",
      appUrl: "https://commercial.example.com",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_test"
    });
  });

  it("requires a signing secret for protected Supabase snapshot assets", () => {
    expect(() =>
      getAuthConfig({
        AUTH_REQUIRED: "1",
        AUTH_PROVIDER: "supabase",
        APP_URL: "https://commercial.example.com/",
        SUPABASE_URL: "https://example.supabase.co/",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
      })
    ).toThrow("Missing auth environment variables: AUTH_SESSION_SECRET");
  });
});

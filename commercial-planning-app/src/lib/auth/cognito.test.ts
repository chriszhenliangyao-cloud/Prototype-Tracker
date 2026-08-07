import { describe, expect, it } from "vitest";
import {
  applyTrustedEmailRolesToSession,
  buildAuthorizationUrl,
  buildLogoutUrl,
  cognitoClaimsToSession,
  createAppSession,
  exchangeAuthorizationCode,
  validateIdTokenClaims
} from "./cognito";
import type { AuthConfig } from "./config";
import type { UserRole } from "@/lib/types";

const config: AuthConfig = {
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
};

describe("Cognito OAuth helpers", () => {
  it("builds an authorization URL for hosted UI with PKCE", () => {
    const url = new URL(
      buildAuthorizationUrl(config, "state-123", "challenge-456")
    );

    expect(url.origin).toBe(config.cognitoDomain);
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://value-chain.example.com/auth/callback"
    );
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-456");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("can build an authorization URL that redirects straight to Google", () => {
    const googleConfig = {
      ...config,
      cognitoIdentityProvider: "Google"
    } as AuthConfig;
    const url = new URL(
      buildAuthorizationUrl(googleConfig, "state-123", "challenge-456")
    );

    expect(url.searchParams.get("identity_provider")).toBe("Google");
  });

  it("forwards account selection to Google through Cognito", () => {
    const googleConfig = {
      ...config,
      cognitoIdentityProvider: "Google"
    } as AuthConfig;
    const url = new URL(
      buildAuthorizationUrl(
        googleConfig,
        "state-123",
        "challenge-456",
        { prompt: "select_account" }
      )
    );

    expect(url.searchParams.get("identity_provider")).toBe("Google");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("builds a Cognito logout URL", () => {
    const url = new URL(buildLogoutUrl(config));

    expect(url.origin).toBe(config.cognitoDomain);
    expect(url.pathname).toBe("/logout");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("logout_uri")).toBe(
      "https://value-chain.example.com/auth/signed-out"
    );
  });

  it("issues an app session for the configured duration", () => {
    expect(
      createAppSession(
        {
          email: "finance@example.com",
          name: "Finance User",
          role: "FINANCE",
          groups: ["FINANCE"],
          expiresAt: 1700003600
        },
        28800,
        1700000000
      )
    ).toMatchObject({
      email: "finance@example.com",
      expiresAt: 1700028800
    });
  });

  it("exchanges an authorization code with PKCE verifier", async () => {
    const tokenResponse = await exchangeAuthorizationCode(
      config,
      "auth-code",
      "code-verifier",
      async (url, init) => {
        const body = new URLSearchParams(String(init?.body));

        expect(url).toBe(`${config.cognitoDomain}/oauth2/token`);
        expect(init?.method).toBe("POST");
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("client_id")).toBe("client-id");
        expect(body.get("code")).toBe("auth-code");
        expect(body.get("code_verifier")).toBe("code-verifier");
        expect(body.get("redirect_uri")).toBe(
          "https://value-chain.example.com/auth/callback"
        );

        return new Response(JSON.stringify({ id_token: "id-token" }), {
          status: 200
        });
      }
    );

    expect(tokenResponse).toEqual({ id_token: "id-token" });
  });

  it("maps valid id token claims to an app session", () => {
    const claims = {
      iss: config.cognitoIssuer,
      aud: config.cognitoClientId,
      token_use: "id",
      email: "finance@example.com",
      name: "Finance User",
      "cognito:groups": ["VIEWER", "FINANCE"],
      exp: 1800000000
    };

    expect(cognitoClaimsToSession(claims)).toEqual({
      email: "finance@example.com",
      name: "Finance User",
      role: "FINANCE",
      groups: ["VIEWER", "FINANCE"],
      expiresAt: 1800000000
    });
  });

  it("maps a trusted Google email to an app role even without Cognito groups", () => {
    const claims = {
      iss: config.cognitoIssuer,
      aud: config.cognitoClientId,
      token_use: "id",
      email: "Payton.ppc@gmail.com",
      name: "Payton",
      exp: 1800000000
    };
    const claimsToSessionWithEmailRoles = cognitoClaimsToSession as (
      claims: Record<string, unknown>,
      emailRoleMap: Partial<Record<UserRole, string[]>>
    ) => ReturnType<typeof cognitoClaimsToSession>;

    expect(
      claimsToSessionWithEmailRoles(claims, {
        ADMIN: ["payton.ppc@gmail.com"]
      })
    ).toMatchObject({
      email: "Payton.ppc@gmail.com",
      role: "ADMIN",
      groups: ["ADMIN"]
    });
  });

  it("maps a trusted Google owner email to the highest role", () => {
    const claims = {
      iss: config.cognitoIssuer,
      aud: config.cognitoClientId,
      token_use: "id",
      email: "julio.pu@iniushop.com",
      name: "Julio",
      exp: 1800000000
    };

    expect(
      cognitoClaimsToSession(claims, {
        GM: ["julio.pu@iniushop.com"],
        OWNER: ["julio.pu@iniushop.com"]
      })
    ).toMatchObject({
      email: "julio.pu@iniushop.com",
      role: "OWNER",
      groups: ["GM", "OWNER"]
    });
  });

  it("re-evaluates a signed session against the current trusted email roles", () => {
    expect(
      applyTrustedEmailRolesToSession(
        {
          email: "payton.ppc@gmail.com",
          name: "Payton",
          role: "ADMIN",
          groups: ["ADMIN"],
          expiresAt: 1800000000
        },
        {
          OWNER: ["payton.ppc@gmail.com"]
        }
      )
    ).toMatchObject({
      email: "payton.ppc@gmail.com",
      role: "OWNER",
      groups: ["ADMIN", "OWNER"]
    });
  });

  it("rejects token claims for the wrong issuer", () => {
    expect(() =>
      validateIdTokenClaims(
        {
          iss: "https://wrong.example.com",
          aud: config.cognitoClientId,
          token_use: "id",
          email: "finance@example.com",
          exp: 1800000000
        },
        config,
        1700000000
      )
    ).toThrow("Unexpected Cognito issuer.");
  });

  it("rejects expired token claims", () => {
    expect(() =>
      validateIdTokenClaims(
        {
          iss: config.cognitoIssuer,
          aud: config.cognitoClientId,
          token_use: "id",
          email: "finance@example.com",
          exp: 1600000000
        },
        config,
        1700000000
      )
    ).toThrow("Cognito ID token has expired.");
  });
});

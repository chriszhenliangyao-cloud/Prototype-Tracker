import { createSign, generateKeyPairSync } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCognitoIdToken } from "./cognito";
import type { AuthConfig } from "./config";

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

describe("Cognito JWT verification", () => {
  it("verifies an RS256 id token against JWKS", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const jwk = publicKey.export({ format: "jwk" });
    const token = signJwt(
      {
        alg: "RS256",
        kid: "test-key"
      },
      {
        iss: config.cognitoIssuer,
        aud: config.cognitoClientId,
        token_use: "id",
        email: "finance@example.com",
        name: "Finance User",
        "cognito:groups": ["FINANCE"],
        exp: 1800000000
      },
      privateKey
    );

    await expect(
      verifyCognitoIdToken(
        token,
        config,
        async () => ({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] }),
        1700000000
      )
    ).resolves.toEqual({
      email: "finance@example.com",
      name: "Finance User",
      role: "FINANCE",
      groups: ["FINANCE"],
      expiresAt: 1800000000
    });
  });

  it("rejects a token whose signature no longer matches", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const jwk = publicKey.export({ format: "jwk" });
    const token = signJwt(
      { alg: "RS256", kid: "test-key" },
      {
        iss: config.cognitoIssuer,
        aud: config.cognitoClientId,
        token_use: "id",
        email: "finance@example.com",
        exp: 1800000000
      },
      privateKey
    );
    const [header, payload, signature] = token.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decodedPayload, email: "admin@example.com" })
    ).toString("base64url");

    await expect(
      verifyCognitoIdToken(
        `${header}.${tamperedPayload}.${signature}`,
        config,
        async () => ({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] }),
        1700000000
      )
    ).rejects.toThrow("Cognito ID token signature is invalid.");
  });
});

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: KeyObject
) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKey)
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

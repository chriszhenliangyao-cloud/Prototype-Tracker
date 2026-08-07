import { createPublicKey, createVerify } from "node:crypto";
import type { AuthConfig, EmailRoleMap } from "./config";
import { mapCognitoGroupsToRole } from "./roles";
import type { AppSession } from "./types";

type CognitoClaims = Record<string, unknown>;
type JwtHeader = {
  alg?: string;
  kid?: string;
};
type Jwks = {
  keys: Array<Record<string, unknown>>;
};
type JwksFetcher = (jwksUrl: string) => Promise<Jwks>;
type TokenFetcher = (
  url: string,
  init: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

export function buildAuthorizationUrl(
  config: AuthConfig,
  state: string,
  codeChallenge: string,
  options: {
    prompt?: "select_account" | "login";
  } = {}
) {
  const url = new URL("/oauth2/authorize", config.cognitoDomain);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.cognitoClientId);
  url.searchParams.set("redirect_uri", callbackUrl(config));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  if (config.cognitoIdentityProvider) {
    url.searchParams.set("identity_provider", config.cognitoIdentityProvider);
  }
  if (options.prompt) {
    url.searchParams.set("prompt", options.prompt);
  }
  return url.toString();
}

export function buildLogoutUrl(
  config: AuthConfig,
  logoutPath = "/auth/signed-out"
) {
  const url = new URL("/logout", config.cognitoDomain);
  url.searchParams.set("client_id", config.cognitoClientId);
  url.searchParams.set("logout_uri", new URL(logoutPath, config.appUrl).toString());
  return url.toString();
}

export function createAppSession(
  identitySession: AppSession,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): AppSession {
  return {
    ...identitySession,
    expiresAt: nowSeconds + maxAgeSeconds
  };
}

export function callbackUrl(config: AuthConfig) {
  return `${config.appUrl}/auth/callback`;
}

export async function exchangeAuthorizationCode(
  config: AuthConfig,
  code: string,
  codeVerifier: string,
  tokenFetcher: TokenFetcher = fetch
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.cognitoClientId,
    code,
    redirect_uri: callbackUrl(config),
    code_verifier: codeVerifier
  });

  const headers: HeadersInit = {
    "content-type": "application/x-www-form-urlencoded"
  };

  if (config.cognitoClientSecret) {
    headers.authorization = `Basic ${Buffer.from(
      `${config.cognitoClientId}:${config.cognitoClientSecret}`
    ).toString("base64")}`;
  }

  const response = await tokenFetcher(`${config.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers,
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Cognito token exchange failed with status ${response.status}.`);
  }

  return (await response.json()) as { id_token?: string };
}

export function validateIdTokenClaims(
  claims: CognitoClaims,
  config: AuthConfig,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (claims.iss !== config.cognitoIssuer) {
    throw new Error("Unexpected Cognito issuer.");
  }

  if (claims.aud !== config.cognitoClientId) {
    throw new Error("Unexpected Cognito client.");
  }

  if (claims.token_use !== "id") {
    throw new Error("Expected a Cognito ID token.");
  }

  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
    throw new Error("Cognito ID token has expired.");
  }

  if (typeof claims.email !== "string" || !claims.email) {
    throw new Error("Cognito ID token is missing email.");
  }
}

export function cognitoClaimsToSession(
  claims: CognitoClaims,
  emailRoleMap: Partial<EmailRoleMap> = {}
): AppSession {
  const groups = Array.isArray(claims["cognito:groups"])
    ? claims["cognito:groups"].filter((group): group is string => typeof group === "string")
    : [];
  const email = String(claims.email);

  return applyTrustedEmailRolesToSession(
    {
      email,
      name:
        typeof claims.name === "string" && claims.name
          ? claims.name
          : email,
      role: mapCognitoGroupsToRole(groups),
      groups,
      expiresAt: Number(claims.exp)
    },
    emailRoleMap
  );
}

export function applyTrustedEmailRolesToSession(
  session: AppSession,
  emailRoleMap: Partial<EmailRoleMap> = {}
): AppSession {
  const groups = [...session.groups];
  const normalizedGroups = new Set(groups.map((group) => group.toUpperCase()));

  for (const role of rolesForTrustedEmail(session.email, emailRoleMap)) {
    if (!normalizedGroups.has(role)) {
      groups.push(role);
      normalizedGroups.add(role);
    }
  }

  return {
    ...session,
    name:
      session.name && session.name.trim()
        ? session.name
        : session.email,
    role: mapCognitoGroupsToRole(groups),
    groups
  };
}

export async function verifyCognitoIdToken(
  token: string,
  config: AuthConfig,
  fetchJwks: JwksFetcher = fetchCognitoJwks,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const { header, claims, signingInput, signature } = decodeJwt(token);

  if (header.alg !== "RS256") {
    throw new Error("Cognito ID token must use RS256.");
  }

  if (!header.kid) {
    throw new Error("Cognito ID token is missing key id.");
  }

  const jwks = await fetchJwks(`${config.cognitoIssuer}/.well-known/jwks.json`);
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("Cognito signing key was not found.");
  }

  if (!verifyJwtSignature(jwk, signingInput, signature)) {
    throw new Error("Cognito ID token signature is invalid.");
  }

  validateIdTokenClaims(claims, config, nowSeconds);
  return cognitoClaimsToSession(claims, config.emailRoleMap);
}

function rolesForTrustedEmail(
  email: string,
  emailRoleMap: Partial<EmailRoleMap>
) {
  const normalizedEmail = email.trim().toLowerCase();
  const roles = [
    "VIEWER",
    "KA_OWNER",
    "SALES_MANAGER",
    "FINANCE",
    "GM",
    "ADMIN",
    "GTM_LEADER",
    "OWNER"
  ] as const;

  return roles.filter((role) =>
    (emailRoleMap[role] || []).some(
      (trustedEmail) => trustedEmail.trim().toLowerCase() === normalizedEmail
    )
  );
}

async function fetchCognitoJwks(jwksUrl: string): Promise<Jwks> {
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error("Unable to fetch Cognito signing keys.");
  }
  return (await response.json()) as Jwks;
}

function decodeJwt(token: string): {
  header: JwtHeader;
  claims: CognitoClaims;
  signingInput: string;
  signature: string;
} {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Invalid Cognito ID token format.");
  }

  return {
    header: JSON.parse(base64UrlDecode(encodedHeader)) as JwtHeader,
    claims: JSON.parse(base64UrlDecode(encodedPayload)) as CognitoClaims,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature
  };
}

function verifyJwtSignature(
  jwk: Record<string, unknown>,
  signingInput: string,
  encodedSignature: string
) {
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  return createVerify("RSA-SHA256")
    .update(signingInput)
    .verify(publicKey, Buffer.from(encodedSignature, "base64url"));
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

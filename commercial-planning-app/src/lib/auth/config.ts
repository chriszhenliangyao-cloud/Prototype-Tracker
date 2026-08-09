import type { UserRole } from "@/lib/types";

type Env = Record<string, string | undefined>;

export type EmailRoleMap = Record<UserRole, string[]>;

export type AuthProvider = "local" | "cognito" | "supabase";

export type AuthConfig = {
  enabled: boolean;
  provider: AuthProvider;
  appUrl: string;
  sessionSecret: string;
  cognitoDomain: string;
  cognitoIssuer: string;
  cognitoClientId: string;
  cognitoClientSecret?: string;
  cognitoIdentityProvider?: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  emailRoleMap: EmailRoleMap;
  sessionMaxAgeSeconds: number;
};

const roleEmailEnvKeys: Record<UserRole, string> = {
  OWNER: "AUTH_OWNER_EMAILS",
  GTM_LEADER: "AUTH_GTM_LEADER_EMAILS",
  GM: "AUTH_GM_EMAILS",
  ADMIN: "AUTH_ADMIN_EMAILS",
  FINANCE: "AUTH_FINANCE_EMAILS",
  SALES_MANAGER: "AUTH_SALES_MANAGER_EMAILS",
  KA_OWNER: "AUTH_KA_OWNER_EMAILS",
  VIEWER: "AUTH_VIEWER_EMAILS"
};

const cognitoRequiredKeys = [
  "APP_URL",
  "AUTH_SESSION_SECRET",
  "COGNITO_DOMAIN",
  "COGNITO_ISSUER",
  "COGNITO_CLIENT_ID"
] as const;

const supabaseRequiredKeys = [
  "APP_URL",
  "AUTH_SESSION_SECRET",
  "SUPABASE_URL"
] as const;

export function isAuthRequired(env: Env = process.env) {
  return env.AUTH_REQUIRED === "1";
}

export function getAuthConfig(env: Env = process.env): AuthConfig {
  if (!isAuthRequired(env)) {
    return {
      enabled: false,
      provider: "local",
      appUrl: env.APP_URL || "http://localhost:3010",
      sessionSecret: env.AUTH_SESSION_SECRET || "local-development-secret",
      cognitoDomain: env.COGNITO_DOMAIN || "",
      cognitoIssuer: env.COGNITO_ISSUER || "",
      cognitoClientId: env.COGNITO_CLIENT_ID || "",
      cognitoClientSecret: env.COGNITO_CLIENT_SECRET,
      cognitoIdentityProvider: optionalValue(env.COGNITO_IDENTITY_PROVIDER),
      supabaseUrl: env.SUPABASE_URL || "",
      supabasePublishableKey:
        env.SUPABASE_PUBLISHABLE_KEY ||
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        "",
      emailRoleMap: parseEmailRoleMap(env),
      sessionMaxAgeSeconds: parseSessionMaxAge(env)
    };
  }

  const provider = parseAuthProvider(env.AUTH_PROVIDER);
  const missing: string[] = (provider === "supabase"
    ? supabaseRequiredKeys
    : cognitoRequiredKeys
  ).filter((key) => !env[key]);
  if (
    provider === "supabase" &&
    !env.SUPABASE_PUBLISHABLE_KEY &&
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    missing.push("SUPABASE_PUBLISHABLE_KEY");
  }
  if (missing.length > 0) {
    throw new Error(`Missing auth environment variables: ${missing.join(", ")}`);
  }

  return {
    enabled: true,
    provider,
    appUrl: stripTrailingSlash(env.APP_URL!),
    sessionSecret: env.AUTH_SESSION_SECRET || "supabase-session-managed",
    cognitoDomain: stripTrailingSlash(env.COGNITO_DOMAIN || ""),
    cognitoIssuer: stripTrailingSlash(env.COGNITO_ISSUER || ""),
    cognitoClientId: env.COGNITO_CLIENT_ID || "",
    cognitoClientSecret: env.COGNITO_CLIENT_SECRET,
    cognitoIdentityProvider: optionalValue(env.COGNITO_IDENTITY_PROVIDER),
    supabaseUrl: stripTrailingSlash(env.SUPABASE_URL || ""),
    supabasePublishableKey:
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "",
    emailRoleMap: parseEmailRoleMap(env),
    sessionMaxAgeSeconds: parseSessionMaxAge(env)
  };
}

function parseAuthProvider(value: string | undefined): Exclude<AuthProvider, "local"> {
  return value?.trim().toLowerCase() === "supabase" ? "supabase" : "cognito";
}

function parseEmailRoleMap(env: Env): EmailRoleMap {
  return {
    OWNER: parseEmailList(env[roleEmailEnvKeys.OWNER]),
    GTM_LEADER: parseEmailList(env[roleEmailEnvKeys.GTM_LEADER]),
    GM: parseEmailList(env[roleEmailEnvKeys.GM]),
    ADMIN: parseEmailList(env[roleEmailEnvKeys.ADMIN]),
    FINANCE: parseEmailList(env[roleEmailEnvKeys.FINANCE]),
    SALES_MANAGER: parseEmailList(env[roleEmailEnvKeys.SALES_MANAGER]),
    KA_OWNER: parseEmailList(env[roleEmailEnvKeys.KA_OWNER]),
    VIEWER: parseEmailList(env[roleEmailEnvKeys.VIEWER])
  };
}

function parseEmailList(value: string | undefined) {
  const seen = new Set<string>();

  for (const item of (value || "").split(/[,\s]+/)) {
    const email = item.trim().toLowerCase();
    if (email) {
      seen.add(email);
    }
  }

  return [...seen];
}

function parseSessionMaxAge(env: Env) {
  const value = Number(env.AUTH_SESSION_MAX_AGE_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 28800;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function optionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

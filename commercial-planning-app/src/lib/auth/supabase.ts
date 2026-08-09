import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { applyTrustedEmailRolesToSession } from "./cognito";
import type { AuthConfig, EmailRoleMap } from "./config";
import { isUserRole } from "./roles";
import type { AppSession } from "./types";

type CookieToSet = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export async function createSupabaseServerClient(config: AuthConfig) {
  const cookieStore = await cookies();
  return createServerClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can read refreshed cookies but cannot always write them.
          }
        }
      }
    }
  );
}

export function createSupabaseRouteClient(
  request: NextRequest,
  response: NextResponse,
  config: AuthConfig
) {
  return createServerClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );
}

export function clearSupabaseCodeVerifierCookies(
  request: NextRequest,
  response: NextResponse,
  config: AuthConfig
) {
  const expired = {
    httpOnly: true,
    secure: config.appUrl.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  };
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("code-verifier")) {
      response.cookies.set(cookie.name, "", expired);
    }
  }
}

export function createSupabaseAccessTokenClient(
  config: AuthConfig,
  accessToken: string
) {
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function getSupabaseAppSession(
  client: SupabaseClient,
  emailRoleMap: EmailRoleMap
): Promise<AppSession | null> {
  const userResult = await client.auth.getUser();
  const user = userResult.data.user;
  if (userResult.error || !user?.email) return null;

  const sessionResult = await client.auth.getSession();
  return buildSupabaseAppSession({
    client,
    user,
    email: user.email,
    emailRoleMap,
    expiresAt:
      sessionResult.data.session?.expires_at ||
      Math.floor(Date.now() / 1000) + 3600
  });
}

export async function getSupabaseAccessTokenAppSession(
  client: SupabaseClient,
  accessToken: string,
  emailRoleMap: EmailRoleMap
): Promise<AppSession | null> {
  const userResult = await client.auth.getUser(accessToken);
  const user = userResult.data.user;
  if (userResult.error || !user?.email) return null;

  return buildSupabaseAppSession({
    client,
    user,
    email: user.email,
    emailRoleMap,
    expiresAt: readJwtExpiry(accessToken) || Math.floor(Date.now() / 1000) + 600
  });
}

async function buildSupabaseAppSession({
  client,
  user,
  email,
  emailRoleMap,
  expiresAt
}: {
  client: SupabaseClient;
  user: User;
  email: string;
  emailRoleMap: EmailRoleMap;
  expiresAt: number;
}): Promise<AppSession | null> {
  const [accessResult, workspaceResult] = await Promise.all([
    client.rpc("get_commercial_planning_access"),
    client
      .from("workspaces")
      .select("id")
      .eq("slug", "operations-planning")
      .maybeSingle()
  ]);
  const access = Array.isArray(accessResult.data)
    ? accessResult.data[0]
    : accessResult.data;
  const workspaceId = workspaceResult.data?.id;
  if (accessResult.error || workspaceResult.error || !access || !workspaceId) {
    return null;
  }

  const permissionsResult = await client.rpc(
    "get_my_protected_module_permissions",
    { p_workspace_id: workspaceId }
  );
  if (permissionsResult.error) return null;

  const rawRole = String(access.app_role || "VIEWER");
  const role = isUserRole(rawRole) ? rawRole : "VIEWER";
  const identity: AppSession = {
    email: email.toLowerCase(),
    name:
      String(access.display_name || "").trim() ||
      String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
      email.split("@")[0],
    role,
    groups: [role, String(access.platform_role || "viewer").toUpperCase()],
    expiresAt,
    workspaceId,
    protectedModules: Object.fromEntries(
      (permissionsResult.data || []).map(
        (item: { module_key?: string; access_level?: string }) => [
          String(item.module_key || ""),
          normalizeProtectedModuleAccess(item.access_level)
        ]
      ).filter(([moduleKey]: [string, string]) => Boolean(moduleKey))
    )
  };

  return applyTrustedEmailRolesToSession(identity, emailRoleMap);
}

function normalizeProtectedModuleAccess(value: string | undefined) {
  return (["none", "view", "edit", "manage"] as const).find(
    (access) => access === value
  ) || "none";
}

function readJwtExpiry(accessToken: string) {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return 0;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const expiresAt = Number(parsed?.exp);
    return Number.isFinite(expiresAt) ? Math.trunc(expiresAt) : 0;
  } catch {
    return 0;
  }
}

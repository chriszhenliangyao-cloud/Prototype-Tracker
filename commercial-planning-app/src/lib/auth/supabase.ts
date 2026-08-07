import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function getSupabaseAppSession(
  client: SupabaseClient,
  emailRoleMap: EmailRoleMap
): Promise<AppSession | null> {
  const userResult = await client.auth.getUser();
  const user = userResult.data.user;
  if (userResult.error || !user?.email) return null;

  const accessResult = await client.rpc("get_commercial_planning_access");
  const access = Array.isArray(accessResult.data)
    ? accessResult.data[0]
    : accessResult.data;
  if (accessResult.error || !access) return null;

  const rawRole = String(access.app_role || "VIEWER");
  const role = isUserRole(rawRole) ? rawRole : "VIEWER";
  const sessionResult = await client.auth.getSession();
  const identity: AppSession = {
    email: user.email.toLowerCase(),
    name:
      String(access.display_name || "").trim() ||
      String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
      user.email.split("@")[0],
    role,
    groups: [role, String(access.platform_role || "viewer").toUpperCase()],
    expiresAt:
      sessionResult.data.session?.expires_at ||
      Math.floor(Date.now() / 1000) + 3600
  };

  return applyTrustedEmailRolesToSession(identity, emailRoleMap);
}

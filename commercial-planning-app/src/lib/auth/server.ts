import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { applyTrustedEmailRolesToSession } from "./cognito";
import { getAuthConfig } from "./config";
import { normalizeAuthReturnTo } from "./returnTo";
import { canEditMasterData, canSaveScenario } from "./roles";
import {
  createSessionCookie,
  sessionCookieName,
  verifySessionCookie
} from "./sessionCookie";
import type { AppSession } from "./types";
import {
  createSupabaseServerClient,
  getSupabaseAppSession
} from "./supabase";

export type ProtectedModuleKey =
  | "roadmap"
  | "master_data"
  | "system_config"
  | "permission_governance"
  | "audit";

export type ProtectedModuleAccess = "none" | "view" | "edit" | "manage";

const protectedModuleKeys: ProtectedModuleKey[] = [
  "roadmap",
  "master_data",
  "system_config",
  "permission_governance",
  "audit"
];

export const authStateCookieName = "vc_auth_state";
export const authVerifierCookieName = "vc_auth_verifier";
export const authReturnToCookieName = "vc_auth_return_to";

const localDevSession: AppSession = {
  email: "finance.admin@example.com",
  name: "Local Finance Admin",
  role: "ADMIN",
  groups: ["ADMIN"],
  expiresAt: 4102444800
};

type CookieWriter = {
  cookies: {
    set: (name: string, value: string, options: ReturnType<typeof authCookieOptions> & { expires?: Date }) => void;
  };
};

async function resolveCurrentSession(): Promise<AppSession | null> {
  const config = getAuthConfig();
  if (!config.enabled) {
    return localDevSession;
  }

  if (config.provider === "supabase") {
    const client = await createSupabaseServerClient(config);
    return getSupabaseAppSession(client, config.emailRoleMap);
  }

  const cookieStore = await cookies();
  const session = verifySessionCookie(
    cookieStore.get(sessionCookieName)?.value,
    config.sessionSecret
  );
  return session
    ? applyTrustedEmailRolesToSession(session, config.emailRoleMap)
    : null;
}

// A platform request can cross the root layout, native platform layout and page.
// Resolve the same session only once for that React server render.
export const getCurrentSession = cache(resolveCurrentSession);

export function getSessionFromCookieValue(
  cookieValue: string | undefined
): AppSession | null {
  const config = getAuthConfig();
  if (!config.enabled) {
    return localDevSession;
  }

  if (config.provider === "supabase") return null;

  const session = verifySessionCookie(cookieValue, config.sessionSecret);
  return session
    ? applyTrustedEmailRolesToSession(session, config.emailRoleMap)
    : null;
}

export async function requireUser(returnTo = "/") {
  const session = await getCurrentSession();
  if (!session) {
    redirect(
      `/auth/login?returnTo=${encodeURIComponent(
        normalizeAuthReturnTo(returnTo)
      )}`
    );
  }
  return session;
}

export async function requireMasterDataEditor(returnTo = "/") {
  const session = await requireUser(returnTo);
  if (!(await canCurrentSessionEditMasterData(session))) {
    redirect("/auth/forbidden");
  }
  return session;
}

export async function canCurrentSessionEditMasterData(session: AppSession) {
  const config = getAuthConfig();
  if (config.provider !== "supabase") return canEditMasterData(session.role);
  return (await getProtectedModulePermission("master_data")) === "manage";
}

export async function getProtectedModulePermission(
  moduleKey: ProtectedModuleKey
): Promise<ProtectedModuleAccess> {
  return (await getCurrentProtectedModulePermissions())[moduleKey] || "none";
}

export const getCurrentProtectedModulePermissions = cache(async (): Promise<
  Partial<Record<ProtectedModuleKey, ProtectedModuleAccess>>
> => {
  const config = getAuthConfig();
  if (!config.enabled) {
    return Object.fromEntries(
      protectedModuleKeys.map((key) => [key, "manage"])
    ) as Record<ProtectedModuleKey, ProtectedModuleAccess>;
  }
  if (config.provider !== "supabase") return {};

  const client = await createSupabaseServerClient(config);
  const membership = await client
    .from("workspace_members")
    .select("workspace_id")
    .limit(1)
    .maybeSingle();
  const workspaceId = membership.data?.workspace_id;
  if (membership.error || !workspaceId) return {};

  const response = await client.rpc("get_my_protected_module_permissions", {
    p_workspace_id: workspaceId
  });
  if (response.error) return {};
  return Object.fromEntries((response.data || []).map(
    (item: { module_key?: string; access_level?: string }) => {
      const access = String(item.access_level || "none");
      return [
        item.module_key,
        ["none", "view", "edit", "manage"].includes(access)
          ? access
          : "none"
      ];
    }
  )) as Partial<Record<ProtectedModuleKey, ProtectedModuleAccess>>;
});

export async function requireScenarioSaver() {
  const session = await requireUser();
  if (!canSaveScenario(session.role)) {
    return null;
  }
  return session;
}

export function makeSessionCookie(session: AppSession) {
  const config = getAuthConfig();
  return createSessionCookie(session, config.sessionSecret);
}

export function authCookieOptions(maxAge: number) {
  const config = getAuthConfig();
  return {
    httpOnly: true,
    secure: config.appUrl.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

export function clearAuthCookies(response: CookieWriter) {
  const expiredOptions = {
    ...authCookieOptions(0),
    expires: new Date(0)
  };

  for (const cookieName of [
    sessionCookieName,
    authStateCookieName,
    authVerifierCookieName,
    authReturnToCookieName
  ]) {
    response.cookies.set(cookieName, "", expiredOptions);
  }
}

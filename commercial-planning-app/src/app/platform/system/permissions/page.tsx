import { redirect } from "next/navigation";
import { normalizeAuthReturnTo } from "@/lib/auth/returnTo";
import { requireUser } from "@/lib/auth/server";
import type { AppSession } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

const permissionPath = "/platform/system/permissions";
const permissionFallback = "/platform/system/master-data";

function canManagePermissions(session: AppSession) {
  return session.governanceRole === "platform_owner"
    || session.governanceRole === "super_admin"
    || session.role === "OWNER"
    || session.role === "ADMIN";
}

function permissionReturnTo(rawValue: string | string[] | undefined) {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const normalized = normalizeAuthReturnTo(value);
  if (!normalized.startsWith("/platform/") || normalized === permissionPath) {
    return permissionFallback;
  }
  return normalized;
}

export default async function PlatformPermissionsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser(permissionPath);
  if (!canManagePermissions(session)) redirect("/auth/forbidden");

  const returnTo = permissionReturnTo((await searchParams).returnTo);
  const iframeSearch = new URLSearchParams({
    embedded: "1",
    permissions: "1",
    permissionsOnly: "1",
    returnTo
  });

  return (
    <iframe
      className="native-platform-module-frame native-platform-permissions-frame"
      src={`/platform/index.html?${iframeSearch.toString()}#module=projects`}
      title="权限管理"
      loading="eager"
      referrerPolicy="same-origin"
    />
  );
}

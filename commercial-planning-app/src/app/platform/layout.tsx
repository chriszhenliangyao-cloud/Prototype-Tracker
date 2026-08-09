import { PlatformShell } from "@/components/platform/PlatformShell";
import {
  getCurrentProtectedModulePermissions,
  getCurrentSession
} from "@/lib/auth/server";

export default async function NativePlatformLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // Pages own their login return paths so deep links survive authentication.
  const session = await getCurrentSession();
  const protectedModules = session
    ? await getCurrentProtectedModulePermissions()
    : {};
  const releaseId = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.NEXT_PUBLIC_PLATFORM_RELEASE
    || "local";
  return (
    <PlatformShell
      session={session}
      protectedModules={protectedModules}
      releaseId={releaseId}
    >
      {children}
    </PlatformShell>
  );
}

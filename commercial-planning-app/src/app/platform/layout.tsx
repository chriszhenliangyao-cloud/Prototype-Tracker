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
  return (
    <PlatformShell session={session} protectedModules={protectedModules}>
      {children}
    </PlatformShell>
  );
}

import { PlatformShell } from "@/components/platform/PlatformShell";
import { getCurrentSession } from "@/lib/auth/server";

export default async function NativePlatformLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // Pages own their login return paths so deep links survive authentication.
  const session = await getCurrentSession();
  return <PlatformShell session={session}>{children}</PlatformShell>;
}

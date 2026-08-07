import { PlatformShell } from "@/components/platform/PlatformShell";
import { requireUser } from "@/lib/auth/server";

export default async function NativePlatformLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireUser("/platform/workbench");
  return <PlatformShell session={session}>{children}</PlatformShell>;
}

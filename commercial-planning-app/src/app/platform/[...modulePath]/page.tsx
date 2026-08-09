import { notFound, redirect } from "next/navigation";
import { EmbeddedPlatformModule } from "@/components/platform/EmbeddedPlatformModule";
import {
  getCurrentProtectedModulePermissions,
  requireUser
} from "@/lib/auth/server";
import { findEmbeddedPlatformModule } from "@/lib/platform/modules";

export const dynamic = "force-dynamic";

export default async function EmbeddedPlatformModulePage({
  params,
  searchParams
}: {
  params: Promise<{ modulePath: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { modulePath } = await params;
  const pathname = `/platform/${modulePath.join("/")}`;
  const module = findEmbeddedPlatformModule(pathname);
  if (!module) notFound();

  await requireUser(pathname);
  if (module.protectedModule) {
    const permissions = await getCurrentProtectedModulePermissions();
    if (!permissions[module.protectedModule] || permissions[module.protectedModule] === "none") {
      redirect("/auth/forbidden");
    }
  }

  return (
    <EmbeddedPlatformModule
      module={module}
      searchParams={await searchParams}
    />
  );
}

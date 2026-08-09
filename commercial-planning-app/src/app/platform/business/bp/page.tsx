import { EmbeddedPlatformModule } from "@/components/platform/EmbeddedPlatformModule";
import { requireUser } from "@/lib/auth/server";
import { findEmbeddedPlatformModule } from "@/lib/platform/modules";

export const dynamic = "force-dynamic";

export default async function PlatformBusinessPlanPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/platform/business/bp");
  const module = findEmbeddedPlatformModule("/platform/business/bp");
  if (!module) return null;

  return (
    <EmbeddedPlatformModule
      module={module}
      searchParams={await searchParams}
    />
  );
}

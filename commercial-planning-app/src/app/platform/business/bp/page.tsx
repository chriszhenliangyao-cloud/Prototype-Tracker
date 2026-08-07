import { BusinessPlanWorkspace } from "@/app/business-plan/page";

export const dynamic = "force-dynamic";

export default function PlatformBusinessPlanPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return BusinessPlanWorkspace({
    searchParams,
    returnTo: "/platform/business/bp"
  });
}

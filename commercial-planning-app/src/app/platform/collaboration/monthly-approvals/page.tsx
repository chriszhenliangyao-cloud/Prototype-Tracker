import { PromotionWorkspace } from "@/app/promotion/page";

export const dynamic = "force-dynamic";

export default function PlatformMonthlyApprovalsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PromotionWorkspace({
    searchParams,
    returnTo: "/platform/collaboration/monthly-approvals"
  });
}

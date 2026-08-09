import { PromotionWorkspace } from "@/app/promotion/page";

export const dynamic = "force-dynamic";

export default async function OtherApprovalsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return PromotionWorkspace({
    searchParams: Promise.resolve({
      ...params,
      workspace: "other-approvals"
    }),
    returnTo: "/platform/collaboration/other-approvals"
  });
}

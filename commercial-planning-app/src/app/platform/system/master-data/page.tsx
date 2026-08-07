import { MasterDataWorkspace } from "@/app/master-data/page";

export const dynamic = "force-dynamic";

export default function PlatformMasterDataPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return MasterDataWorkspace({
    searchParams,
    returnTo: "/platform/system/master-data"
  });
}

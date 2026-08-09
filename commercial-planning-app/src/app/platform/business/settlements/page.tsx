import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function PlatformSettlementsPage() {
  await requireUser("/platform/business/settlements");

  return (
    <iframe
      className="native-platform-settlement-frame"
      src="/platform-native/settlement-ledger.html?embedded=1"
      title="结算台账"
    />
  );
}

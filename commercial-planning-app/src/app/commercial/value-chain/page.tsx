import { NormalCalculator } from "@/components/NormalCalculator";
import { requireUser } from "@/lib/auth/server";
import { getCountryScopedReferenceData } from "@/lib/countryAccess";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ValueChainWorkbenchPage() {
  return ValueChainWorkbench({ returnTo: "/commercial/value-chain" });
}

export async function ValueChainWorkbench({ returnTo }: { returnTo: string }) {
  const session = await requireUser(returnTo);
  const [data, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const scoped = getCountryScopedReferenceData({
    accessRows,
    baseRole: session.role,
    data,
    email: session.email
  });

  return <NormalCalculator data={scoped.data} userEmail={session.email} />;
}

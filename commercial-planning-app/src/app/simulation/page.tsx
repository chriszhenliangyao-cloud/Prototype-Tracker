import { SimulationCalculator } from "@/components/SimulationCalculator";
import { canAddQuickSimulationToFormalList } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/server";
import { getCountryScopedReferenceData } from "@/lib/countryAccess";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SimulationPage() {
  return SimulationWorkspace({ returnTo: "/simulation" });
}

export async function SimulationWorkspace({ returnTo }: { returnTo: string }) {
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

  return (
    <SimulationCalculator
      data={scoped.data}
      userEmail={session.email}
      canAddQuickSimulationToFormalList={canAddQuickSimulationToFormalList(
        session.role
      )}
    />
  );
}

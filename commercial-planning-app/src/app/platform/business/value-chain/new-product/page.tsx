import { SimulationWorkspace } from "@/app/simulation/page";

export const dynamic = "force-dynamic";

export default function PlatformNewProductSimulationPage() {
  return SimulationWorkspace({
    returnTo: "/platform/business/value-chain/new-product"
  });
}

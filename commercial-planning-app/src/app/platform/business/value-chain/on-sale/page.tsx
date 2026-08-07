import { ValueChainWorkbench } from "@/app/commercial/value-chain/page";

export const dynamic = "force-dynamic";

export default function PlatformValueChainPage() {
  return ValueChainWorkbench({
    returnTo: "/platform/business/value-chain/on-sale"
  });
}

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PlatformEntryPage() {
  redirect("/platform/workbench");
}

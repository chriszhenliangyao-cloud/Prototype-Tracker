import { NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getAuthConfig();
  return NextResponse.json(
    {
      supabaseUrl: config.supabaseUrl,
      supabasePublishableKey: config.supabasePublishableKey,
      commercialPlanningUrl: config.appUrl
    },
    {
      headers: { "cache-control": "no-store" }
    }
  );
}

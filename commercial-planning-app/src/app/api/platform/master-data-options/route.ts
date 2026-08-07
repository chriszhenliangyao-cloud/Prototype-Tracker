import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import { getCountryScopedReferenceData } from "@/lib/countryAccess";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import { buildPlatformMasterDataCatalog } from "@/lib/platformMasterData";

export const dynamic = "force-dynamic";

const defaultAllowedOrigins = [
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://operations-planning-hub.vercel.app"
];

export async function GET(request: NextRequest) {
  const headers = responseHeaders(request);
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { message: "Your session has expired." },
      { status: 401, headers }
    );
  }

  try {
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
    return NextResponse.json(buildPlatformMasterDataCatalog({
      ...scoped.data,
      // Product identity is global platform master data. Market, customer and
      // channel dimensions below remain constrained by the user's country scope.
      products: data.products
    }), {
      headers
    });
  } catch (error) {
    console.error("Failed to load platform master data", error);
    return NextResponse.json(
      { message: "Master data is temporarily unavailable." },
      { status: 500, headers }
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders(request)
  });
}

function responseHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    ...defaultAllowedOrigins,
    ...String(process.env.PLATFORM_TASK_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  ]);
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Origin"
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return headers;
}

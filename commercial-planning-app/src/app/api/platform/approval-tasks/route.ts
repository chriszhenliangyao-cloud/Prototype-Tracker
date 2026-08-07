import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import { getPlatformApprovalTaskInbox } from "@/lib/platformApprovalTasks";

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
    const inbox = await getPlatformApprovalTaskInbox(session);
    return NextResponse.json(inbox, { headers });
  } catch (error) {
    console.error("Failed to load platform approval tasks", error);
    return NextResponse.json(
      { message: "Approval tasks are temporarily unavailable." },
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

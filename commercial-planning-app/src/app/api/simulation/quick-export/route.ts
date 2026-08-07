import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import type { RrppSimulationTableRow } from "@/lib/calculatorRows";
import { buildQuickSimulationWorkbookBuffer } from "@/lib/exports/quickSimulationWorkbook";

export const dynamic = "force-dynamic";

type QuickExportPayload = {
  rows?: unknown;
};

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await readJsonPayload(request)) ?? {};
  const rows = parseRows(payload.rows);

  if (rows.length === 0) {
    return NextResponse.json(
      { message: "No simulation rows are available to export." },
      { status: 400 }
    );
  }

  const workbook = buildQuickSimulationWorkbookBuffer(rows);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Quick Simulation ${date}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}

async function readJsonPayload(
  request: NextRequest
): Promise<QuickExportPayload | null> {
  try {
    return (await request.json()) as QuickExportPayload;
  } catch {
    return null;
  }
}

function parseRows(value: unknown): RrppSimulationTableRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isExportableRow) as RrppSimulationTableRow[];
}

function isExportableRow(value: unknown): value is RrppSimulationTableRow {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.key === "string" &&
    typeof value.countryCode === "string" &&
    typeof value.channelName === "string" &&
    typeof value.model === "string" &&
    typeof value.category === "string" &&
    typeof value.productName === "string"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

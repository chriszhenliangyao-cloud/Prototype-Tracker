import { NextResponse, type NextRequest } from "next/server";
import { buildMasterDataWorkbookBuffer } from "@/lib/exports/masterDataWorkbook";
import { canEditMasterData } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { getMasterData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  if (!canEditMasterData(session.role)) {
    return NextResponse.json(
      { message: "You do not have Master Data access." },
      { status: 403 }
    );
  }

  const workbook = buildMasterDataWorkbookBuffer(await getMasterData());
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Master data ${date}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}

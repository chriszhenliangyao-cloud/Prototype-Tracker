import { NextResponse, type NextRequest } from "next/server";
import { buildMasterDataWorkbookBuffer } from "@/lib/exports/masterDataWorkbook";
import {
  canCurrentSessionEditMasterData,
  getCurrentSession
} from "@/lib/auth/server";
import { getMasterData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  if (!(await canCurrentSessionEditMasterData(session))) {
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

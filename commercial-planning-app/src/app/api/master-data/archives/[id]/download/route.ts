import { NextResponse, type NextRequest } from "next/server";
import {
  canCurrentSessionEditMasterData,
  getCurrentSession
} from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const archive = await prisma.masterDataArchive.findUnique({
    where: { id }
  });

  if (!archive) {
    return NextResponse.json(
      { message: "Master Data archive not found." },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(archive.workbookBytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${sanitizeFileName(
        archive.workbookFileName
      )}"`,
      "Cache-Control": "no-store"
    }
  });
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/"/g, "");
}

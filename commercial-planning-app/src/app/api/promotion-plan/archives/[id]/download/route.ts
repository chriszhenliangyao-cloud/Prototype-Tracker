import { NextResponse, type NextRequest } from "next/server";
import { canManageUserCountryAccess } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  if (!canManageUserCountryAccess(session.role)) {
    return NextResponse.json(
      { message: "Promotion Plan archive downloads are admin-only." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const archive = await prisma.promotionPlanArchive.findUnique({
    where: { id }
  });

  if (!archive) {
    return NextResponse.json(
      { message: "Promotion Plan archive not found." },
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

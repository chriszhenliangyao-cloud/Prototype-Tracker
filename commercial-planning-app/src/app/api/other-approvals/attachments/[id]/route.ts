import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { canViewAllCountries } from "@/lib/auth/roles";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { prisma } from "@/lib/prisma";
import { getOtherApprovalApiAccess } from "../../access";

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

  const { id } = await params;
  const attachment = await prisma.otherApprovalAttachment.findUnique({
    where: { id },
    include: { request: true }
  });
  if (!attachment) {
    return NextResponse.json({ message: "Attachment not found." }, { status: 404 });
  }

  const { accessibleCountryCodes, role } = await getOtherApprovalApiAccess(session);
  if (
    !canViewAllCountries(role) &&
    !accessibleCountryCodes.includes(attachment.request.countryCode)
  ) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  return new NextResponse(Buffer.from(attachment.fileBytes), {
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/["\r\n]/g, "_")}"`,
      "Cache-Control": "private, max-age=300"
    }
  });
}

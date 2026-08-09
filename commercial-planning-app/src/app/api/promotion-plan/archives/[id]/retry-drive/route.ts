import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { canBypassPromotionPlanLocks } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { getUserCountryAccesses } from "@/lib/data";
import {
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import { retryPromotionPlanArchiveDriveUpload } from "@/lib/promotionPlanArchive";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const accessRows = await getUserCountryAccesses();
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    accessRows
  );
  if (!canBypassPromotionPlanLocks(effectiveRole)) {
    return NextResponse.json(
      { message: "You do not have permission to retry archive delivery." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const archive = await retryPromotionPlanArchiveDriveUpload({ archiveId: id });
  if (!archive) {
    return NextResponse.json(
      { message: "Archive record was not found." },
      { status: 404 }
    );
  }

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");
  return NextResponse.json({
    status: archive.driveStatus === "UPLOADED" ? "success" : "error",
    message:
      archive.driveStatus === "UPLOADED"
        ? "Archive uploaded to Drive."
        : "Archive retry finished with a warning.",
    archive
  });
}

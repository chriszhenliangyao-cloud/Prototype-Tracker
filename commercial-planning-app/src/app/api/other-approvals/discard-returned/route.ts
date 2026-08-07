import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { discardReturnedOtherApprovalRequest } from "@/lib/otherApprovals";
import { getOtherApprovalApiAccess } from "../access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as { id?: unknown };
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) {
    return NextResponse.json({ message: "Approval request ID is required." }, { status: 400 });
  }

  const { accessibleCountryCodes, role } = await getOtherApprovalApiAccess(session);
  const result = await discardReturnedOtherApprovalRequest({
    accessibleCountryCodes,
    id,
    role,
    userEmail: session.email
  });
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/other-approvals");
  return NextResponse.json(result);
}

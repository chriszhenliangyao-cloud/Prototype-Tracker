import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { saveOtherApprovalRequest } from "@/lib/otherApprovals";
import { getOtherApprovalApiAccess } from "../access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    id?: unknown;
    title?: unknown;
    countryCode?: unknown;
    channelName?: unknown;
    feeType?: unknown;
    description?: unknown;
    tableData?: unknown;
    attachments?: unknown;
  };
  const { accessibleCountryCodes, role } = await getOtherApprovalApiAccess(session);
  const result = await saveOtherApprovalRequest({
    accessibleCountryCodes,
    input: {
      id: typeof payload.id === "string" ? payload.id : null,
      title: typeof payload.title === "string" ? payload.title : "",
      countryCode:
        typeof payload.countryCode === "string" ? payload.countryCode : "",
      channelName:
        typeof payload.channelName === "string" ? payload.channelName : "",
      feeType: typeof payload.feeType === "string" ? payload.feeType : "",
      description:
        typeof payload.description === "string" ? payload.description : "",
      tableData: typeof payload.tableData === "string" ? payload.tableData : "",
      attachments: parseAttachments(payload.attachments)
    },
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

function parseAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const candidate = item as Record<string, unknown>;
      return {
        fileName:
          typeof candidate.fileName === "string" ? candidate.fileName : "",
        contentType:
          typeof candidate.contentType === "string"
            ? candidate.contentType
            : "application/octet-stream",
        sizeBytes:
          typeof candidate.sizeBytes === "number" ? candidate.sizeBytes : 0,
        base64: typeof candidate.base64 === "string" ? candidate.base64 : ""
      };
    })
    .filter((item) => item.fileName && item.base64);
}

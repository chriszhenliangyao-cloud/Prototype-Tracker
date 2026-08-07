import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { editSubmittedOtherApprovalRequest } from "@/lib/otherApprovals";
import { getOtherApprovalApiAccess } from "../access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const { accessibleCountryCodes, approvalCapabilities } =
    await getOtherApprovalApiAccess(session);
  const result = await editSubmittedOtherApprovalRequest({
    accessibleCountryCodes,
    capabilities: approvalCapabilities,
    input: {
      id: stringValue(payload.id),
      title: stringValue(payload.title),
      countryCode: stringValue(payload.countryCode),
      channelName: stringValue(payload.channelName),
      feeType: stringValue(payload.feeType),
      description: stringValue(payload.description),
      tableData: stringValue(payload.tableData),
      editNote: stringValue(payload.editNote),
      attachments: parseAttachments(payload.attachments)
    },
    userEmail: session.email
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/other-approvals");
  return NextResponse.json(result);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const candidate = item as Record<string, unknown>;
      return {
        fileName: stringValue(candidate.fileName),
        contentType:
          typeof candidate.contentType === "string"
            ? candidate.contentType
            : "application/octet-stream",
        sizeBytes: typeof candidate.sizeBytes === "number" ? candidate.sizeBytes : 0,
        base64: stringValue(candidate.base64)
      };
    })
    .filter((item) => item.fileName && item.base64);
}

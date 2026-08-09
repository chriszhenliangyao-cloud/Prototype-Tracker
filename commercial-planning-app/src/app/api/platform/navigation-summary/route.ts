import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { getPlatformApprovalTaskInbox } from "@/lib/platformApprovalTasks";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireUser("/platform/workbench");
  const inbox = await getPlatformApprovalTaskInbox(session);

  return NextResponse.json(
    {
      badges: {
        "monthly-approvals": inbox.summary.monthlyPending,
        "other-approvals": inbox.summary.otherPending,
        tasks: inbox.summary.visibleApprovals
      },
      generatedAt: new Date().toISOString()
    },
    {
      headers: {
        "cache-control": "private, no-store"
      }
    }
  );
}

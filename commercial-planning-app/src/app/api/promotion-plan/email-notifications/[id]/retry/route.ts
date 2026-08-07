import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import { canBypassPromotionPlanLocks } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import {
  canApprovePromotionPlanWithCapabilities,
  getPromotionPlanApproverCapabilities
} from "@/lib/promotionPlanApprovalWorkflow";
import { retryBusinessPlanApprovalEmailNotification } from "@/lib/businessPlanApprovalEmail";
import { retryPromotionPlanApprovalEmailNotification } from "@/lib/promotionPlanApprovalEmail";

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

  const { id } = await params;
  const notification = await prisma.promotionPlanEmailNotification.findUnique({
    where: { id }
  });
  if (!notification) {
    return NextResponse.json(
      { message: "Approval email notification not found." },
      { status: 404 }
    );
  }

  const [data, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const effectiveRole = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    accessRows
  );
  const approvalCapabilities = getPromotionPlanApproverCapabilities({
    role: effectiveRole,
    email: session.email,
    accessRows
  });
  const accessibleCountryCodes = getAccessibleCountryCodes(
    effectiveRole,
    session.email,
    accessRows,
    data.countries
  );
  const canManagePromotionBackfill = canBypassPromotionPlanLocks(effectiveRole);

  if (
    !canManagePromotionBackfill &&
    (!canApprovePromotionPlanWithCapabilities(approvalCapabilities) ||
      !notificationCountryCodes(notification.countryCodes).every((countryCode) =>
        accessibleCountryCodes.includes(countryCode)
      ))
  ) {
    return NextResponse.json(
      { message: "You do not have permission to retry this approval email." },
      { status: 403 }
    );
  }

  try {
    const emailNotification =
      notification.planMonth === 0
        ? await retryBusinessPlanApprovalEmailNotification({
            notificationId: id
          })
        : await retryPromotionPlanApprovalEmailNotification({
            notificationId: id
          });
    revalidatePath("/promotion");
    revalidatePath("/platform/collaboration/monthly-approvals");
    revalidatePath("/platform/collaboration/other-approvals");
    return NextResponse.json({
      status: emailNotification.status === "SENT" ? "success" : "error",
      message:
        emailNotification.status === "SENT"
          ? "Approval email sent."
          : "Approval email retry finished with a warning.",
      emailNotification
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Approval email retry failed."
      },
      { status: 400 }
    );
  }
}

function notificationCountryCodes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

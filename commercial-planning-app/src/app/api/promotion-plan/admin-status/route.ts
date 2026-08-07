import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  applyPromotionPlanHistoryAdminAction,
  type PromotionPlanHistoryAdminAction
} from "@/lib/promotionPlanHistoryAdmin";
import type { PromotionPlanStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    action?: unknown;
    confirmation?: unknown;
    countryCodes?: unknown;
    notificationId?: unknown;
    notes?: unknown;
    planMonth?: unknown;
    planYear?: unknown;
    targetStatus?: unknown;
  };
  const planYear = toPlanYear(payload.planYear);
  const planMonth = toPlanMonth(payload.planMonth);
  const action = toAction(payload.action);
  if (!planYear || !planMonth || !action) {
    return NextResponse.json(
      { message: "Choose a valid approval history operation." },
      { status: 400 }
    );
  }

  const { statusCode, result } = await applyPromotionPlanHistoryAdminAction({
    action,
    confirmation:
      typeof payload.confirmation === "string" ? payload.confirmation : null,
    countryCodes: parseCountryCodes(payload.countryCodes),
    month: { year: planYear, month: planMonth },
    notificationId:
      typeof payload.notificationId === "string" ? payload.notificationId : null,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    session,
    targetStatus: toPromotionPlanStatus(payload.targetStatus)
  });
  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");
  return NextResponse.json(result, { status: statusCode });
}

function parseCountryCodes(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toAction(value: unknown): PromotionPlanHistoryAdminAction | null {
  return value === "set-status" || value === "delete-status" ? value : null;
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toPlanMonth(value: unknown) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function toPromotionPlanStatus(value: unknown): PromotionPlanStatus | null {
  return value === "DRAFT" ||
    value === "SUBMITTED" ||
    value === "FIRST_APPROVED" ||
    value === "APPROVED" ||
    value === "REJECTED"
    ? value
    : null;
}

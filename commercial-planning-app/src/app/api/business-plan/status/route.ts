import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  applyBusinessPlanStatusAction,
  type BusinessPlanStatusAction
} from "@/lib/businessPlanStatusActions";

export const dynamic = "force-dynamic";

type StatusPayload = {
  action?: unknown;
  planYear?: unknown;
  countryCodes?: unknown;
  notes?: unknown;
};

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as StatusPayload;
  const action = toStatusAction(payload.action);
  const planYear = toPlanYear(payload.planYear);
  const countryCodes = Array.isArray(payload.countryCodes)
    ? payload.countryCodes
        .map((value) => String(value).trim().toUpperCase())
        .filter(Boolean)
    : [];

  if (!action || !planYear || countryCodes.length === 0) {
    return NextResponse.json(
      { message: "Choose a BP action, year, and country." },
      { status: 400 }
    );
  }

  const { statusCode, result } = await applyBusinessPlanStatusAction({
    action,
    session,
    planYear,
    countryCodes,
    notes: typeof payload.notes === "string" ? payload.notes : null
  });

  revalidatePath("/business-plan");
  revalidatePath("/platform/business/bp");

  return NextResponse.json(result, { status: statusCode });
}

function toStatusAction(value: unknown): BusinessPlanStatusAction | null {
  return value === "submit" || value === "approve" || value === "reject"
    ? value
    : null;
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

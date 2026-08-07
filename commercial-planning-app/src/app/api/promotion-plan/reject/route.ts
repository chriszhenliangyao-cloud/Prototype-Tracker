import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { applyPromotionPlanStatusAction } from "@/lib/promotionPlanStatusActions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );
  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    planYear?: unknown;
    planMonth?: unknown;
    countryCodes?: unknown;
    notes?: unknown;
  };
  const planYear = toPlanYear(payload.planYear);
  const planMonth = toPlanMonth(payload.planMonth);
  if (!planYear || !planMonth) {
    return NextResponse.json(
      { message: "Choose a valid year and month." },
      { status: 400 }
    );
  }

  const { statusCode, result } = await applyPromotionPlanStatusAction({
    action: "reject",
    session,
    month: { year: planYear, month: planMonth },
    countryCodes: parseCountryCodes(payload.countryCodes),
    notes: typeof payload.notes === "string" ? payload.notes : null
  });
  revalidatePath("/promotion");
  revalidatePath("/platform/collaboration/monthly-approvals");
  return NextResponse.json(result, { status: statusCode });
}

function parseCountryCodes(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function toPlanYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
}

function toPlanMonth(value: unknown) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

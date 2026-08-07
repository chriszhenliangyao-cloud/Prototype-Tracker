import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  buildRrppSimulationRows,
  type CalculatorFilters,
  type RrppSimulationInputsByRow
} from "@/lib/calculatorRows";
import { getCountryScopedReferenceData } from "@/lib/countryAccess";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import { buildValueChainWorkbookBuffer } from "@/lib/exports/valueChainWorkbook";

export const dynamic = "force-dynamic";

type ExportPayload = {
  filters?: unknown;
  rrppInputsByRow?: unknown;
};

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }

  const payload = (await readJsonPayload(request)) ?? {};
  const [data, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const scoped = getCountryScopedReferenceData({
    accessRows,
    baseRole: session.role,
    data,
    email: session.email
  });

  if (scoped.data.countries.length === 0) {
    return NextResponse.json(
      { message: "No country access has been assigned for your account." },
      { status: 403 }
    );
  }

  const rows = buildRrppSimulationRows(
    scoped.data,
    parseRrppInputs(payload.rrppInputsByRow),
    parseFilters(payload.filters),
    { lifecycle: "VALUE_CHAIN" }
  );
  const workbook = buildValueChainWorkbookBuffer(rows);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="On-sale Product Simulation ${date}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}

async function readJsonPayload(request: NextRequest): Promise<ExportPayload | null> {
  try {
    return (await request.json()) as ExportPayload;
  } catch {
    return null;
  }
}

function parseFilters(value: unknown): CalculatorFilters {
  if (!isObject(value)) {
    return {};
  }

  return {
    countryCode: normalizedStringFilter(value.countryCode),
    channelName: normalizedStringFilter(value.channelName),
    retailerName: normalizedStringFilter(value.retailerName),
    fdName: normalizedStringFilter(value.fdName),
    model: normalizedStringFilter(value.model),
    category: normalizedStringFilter(value.category),
    productName: normalizedStringFilter(value.productName),
    kaBuyingMargin: normalizedNumberFilter(value.kaBuyingMargin)
  };
}

function parseRrppInputs(value: unknown): RrppSimulationInputsByRow {
  if (!isObject(value)) {
    return {};
  }

  const inputs: RrppSimulationInputsByRow = {};

  for (const [key, input] of Object.entries(value)) {
    if (key.trim() === "" || !isObject(input)) {
      continue;
    }

    inputs[key] = {
      rrppLocal: normalizedInput(input.rrppLocal),
      rrppEur: normalizedInput(input.rrppEur),
      kaBuyingMargin: normalizedInput(input.kaBuyingMargin),
      actualFrontMargin: normalizedInput(input.actualFrontMargin),
      promoFrontMargin: normalizedInput(input.promoFrontMargin),
      dealType: normalizedDealType(input.dealType),
      promoFdMargin: normalizedInput(input.promoFdMargin)
    };
  }

  return inputs;
}

function normalizedStringFilter(value: unknown) {
  if (Array.isArray(value)) {
    const values = value.filter((item): item is string => typeof item === "string");
    return values.length > 0 ? values : undefined;
  }

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function normalizedNumberFilter(value: unknown) {
  if (Array.isArray(value)) {
    const values = value.map(Number).filter(Number.isFinite);
    return values.length > 0 ? values : undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizedInput(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return undefined;
}

function normalizedDealType(value: unknown) {
  return value === "B2B_DEAL" || value === "EOL_DEAL" ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { NextRequest, NextResponse } from "next/server";
import {
  applyMasterDataWorkbookBuffer,
  type ImportActionState
} from "../actions";
import { canEditMasterData } from "@/lib/auth/roles";
import { getCurrentSession } from "@/lib/auth/server";
import { masterDataImportErrorMessage } from "@/lib/masterDataImportError";

type UploadedWorkbookFile = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  const wantsJson = request.headers.get("accept")?.includes("application/json");

  if (!session) {
    if (wantsJson) {
      return NextResponse.json(
        errorState("Your session has expired. Sign in again before publishing."),
        { status: 401, headers: noStoreHeaders() }
      );
    }
    return NextResponse.redirect(
      new URL("/auth/login?returnTo=%2Fmaster-data", request.url),
      303
    );
  }

  if (!canEditMasterData(session.role)) {
    const state = errorState("You do not have Master Data access.");
    return wantsJson
      ? NextResponse.json(state, { status: 403, headers: noStoreHeaders() })
      : redirectWithImportState(state, request);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedWorkbookFile(file) || file.size === 0) {
      const state = errorState("Upload an .xlsx file.");
      return wantsJson
        ? NextResponse.json(state, { status: 400, headers: noStoreHeaders() })
        : redirectWithImportState(state, request);
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      const state = errorState("Only .xlsx files are supported.");
      return wantsJson
        ? NextResponse.json(state, { status: 400, headers: noStoreHeaders() })
        : redirectWithImportState(state, request);
    }

    const result = await applyMasterDataWorkbookBuffer(
      Buffer.from(await file.arrayBuffer()),
      session.email
    );
    return wantsJson
      ? NextResponse.json(result, {
          status: result.status === "success" ? 200 : 422,
          headers: noStoreHeaders()
        })
      : redirectWithImportState(result, request);
  } catch (error) {
    const state = errorState(masterDataImportErrorMessage(error));
    return wantsJson
      ? NextResponse.json(state, { status: 500, headers: noStoreHeaders() })
      : redirectWithImportState(state, request);
  }
}

function redirectWithImportState(state: ImportActionState, request: NextRequest) {
  const url = new URL("/master-data", request.url);
  url.searchParams.set("importStatus", state.status);
  url.searchParams.set("message", state.message);
  url.searchParams.set("imported", String(state.imported));
  url.searchParams.set("updated", String(state.updated));
  url.searchParams.set("skipped", String(state.skipped));

  if (state.summary.length > 0) {
    url.searchParams.set("summary", JSON.stringify(state.summary));
  }

  for (const [index, error] of state.errors.slice(0, 4).entries()) {
    url.searchParams.set(
      `error${index}`,
      [error.sheet, error.rowNumber > 0 ? `Row ${error.rowNumber}` : "Workbook", error.field, error.message]
        .filter(Boolean)
        .join(" · ")
    );
  }

  return NextResponse.redirect(url, 303);
}

function noStoreHeaders() {
  return { "Cache-Control": "private, no-store" };
}

function isUploadedWorkbookFile(value: unknown): value is UploadedWorkbookFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<UploadedWorkbookFile>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function errorState(message: string): ImportActionState {
  return {
    status: "error",
    message,
    imported: 0,
    updated: 0,
    skipped: 0,
    summary: [],
    errors: [
      {
        rowNumber: 0,
        message
      }
    ],
    duplicateKeys: []
  };
}

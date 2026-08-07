import { NextRequest, NextResponse } from "next/server";
import {
  applyMasterDataWorkbookBuffer,
  type ImportActionState
} from "@/app/master-data/actions";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { canEditMasterData } from "@/lib/auth/roles";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { masterDataImportErrorMessage } from "@/lib/masterDataImportError";

type UploadedWorkbookFile = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = getSessionFromCookieValue(
    request.cookies.get(sessionCookieName)?.value
  );

  if (!session) {
    return NextResponse.json(errorState("Please sign in again."), {
      status: 401
    });
  }

  if (!canEditMasterData(session.role)) {
    return NextResponse.json(errorState("You do not have Master Data access."), {
      status: 403
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedWorkbookFile(file) || file.size === 0) {
      return NextResponse.json(errorState("Upload an .xlsx file."), {
        status: 400
      });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(errorState("Only .xlsx files are supported."), {
        status: 400
      });
    }

    const result = await applyMasterDataWorkbookBuffer(
      Buffer.from(await file.arrayBuffer()),
      session.email
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(errorState(masterDataImportErrorMessage(error)), {
      status: 500
    });
  }
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

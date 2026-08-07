import { NextRequest, NextResponse } from "next/server";
import { previewMasterDataWorkbookBuffer } from "@/app/master-data/actions";
import {
  canCurrentSessionEditMasterData,
  getCurrentSession
} from "@/lib/auth/server";

type UploadedWorkbookFile = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { message: "Your session has expired. Sign in again before validation." },
      { status: 401, headers: noStoreHeaders() }
    );
  }
  if (!(await canCurrentSessionEditMasterData(session))) {
    return NextResponse.json(
      { message: "You do not have Master Data access." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!isUploadedWorkbookFile(file) || file.size === 0) {
      return NextResponse.json(
        { message: "Upload an .xlsx file." },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { message: "Only .xlsx files are supported." },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const result = await previewMasterDataWorkbookBuffer(
      Buffer.from(await file.arrayBuffer())
    );
    return NextResponse.json(result, {
      status: result.status === "valid" ? 200 : 422,
      headers: noStoreHeaders()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown validation error";
    return NextResponse.json(
      { message: `Validation failed: ${message}` },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

function isUploadedWorkbookFile(value: unknown): value is UploadedWorkbookFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<UploadedWorkbookFile>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function noStoreHeaders() {
  return { "Cache-Control": "private, no-store" };
}

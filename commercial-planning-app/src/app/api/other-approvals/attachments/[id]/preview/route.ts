import { NextResponse, type NextRequest } from "next/server";
import { canViewAllCountries } from "@/lib/auth/roles";
import { getSessionFromCookieValue } from "@/lib/auth/server";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import { readWorkbookSheetNames, readWorksheetRows } from "@/lib/imports/xlsxLite";
import { prisma } from "@/lib/prisma";
import { getOtherApprovalApiAccess } from "../../../access";

export const dynamic = "force-dynamic";

const MAX_PREVIEW_SHEETS = 12;
const MAX_PREVIEW_ROWS = 500;
const MAX_PREVIEW_CELLS = 80;
const MAX_TEXT_BYTES = 80_000;

export async function GET(
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
  const attachment = await prisma.otherApprovalAttachment.findUnique({
    where: { id },
    include: { request: true }
  });
  if (!attachment) {
    return NextResponse.json({ message: "Attachment not found." }, { status: 404 });
  }

  const { accessibleCountryCodes, role } = await getOtherApprovalApiAccess(session);
  if (
    !canViewAllCountries(role) &&
    !accessibleCountryCodes.includes(attachment.request.countryCode)
  ) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const bytes = Buffer.from(attachment.fileBytes);
  const contentType = attachment.contentType || "application/octet-stream";
  if (request.nextUrl.searchParams.get("inline") === "1") {
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeFileName(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=300"
      }
    });
  }

  if (isXlsxFile(attachment.fileName, contentType)) {
    return NextResponse.json({
      kind: "spreadsheet",
      fileName: attachment.fileName,
      contentType,
      sizeBytes: attachment.sizeBytes,
      sheets: previewXlsx(bytes)
    });
  }

  if (isCsvFile(attachment.fileName, contentType)) {
    return NextResponse.json({
      kind: "spreadsheet",
      fileName: attachment.fileName,
      contentType,
      sizeBytes: attachment.sizeBytes,
      sheets: [
        {
          name: "CSV preview",
          ...previewCsv(bytes)
        }
      ]
    });
  }

  if (isTextFile(attachment.fileName, contentType)) {
    return NextResponse.json({
      kind: "text",
      fileName: attachment.fileName,
      contentType,
      sizeBytes: attachment.sizeBytes,
      text: bytes.subarray(0, MAX_TEXT_BYTES).toString("utf8")
    });
  }

  return NextResponse.json({
    kind: "unsupported",
    fileName: attachment.fileName,
    contentType,
    sizeBytes: attachment.sizeBytes,
    message: "Preview is available for Excel, CSV, text, PDF, and image files."
  });
}

function previewXlsx(bytes: Buffer) {
  const sheetNames = readWorkbookSheetNames(bytes).slice(0, MAX_PREVIEW_SHEETS);
  return sheetNames.map((sheetName) => {
    const sourceRows = readWorksheetRows(bytes, sheetName);
    const visibleRows = sourceRows.slice(0, MAX_PREVIEW_ROWS);
    const maxSourceColumnCount = Math.max(
      0,
      ...sourceRows.map((row) => row.cells.length)
    );
    const maxColumnCount = Math.min(maxSourceColumnCount, MAX_PREVIEW_CELLS);

    return {
      name: sheetName,
      rows: visibleRows.map((row) => ({
        rowNumber: row.rowNumber,
        cells: row.cells.slice(0, MAX_PREVIEW_CELLS).map(displayCell)
      })),
      maxColumnCount,
      truncatedRows: sourceRows.length > visibleRows.length,
      truncatedCells: maxSourceColumnCount > maxColumnCount
    };
  });
}

function previewCsv(bytes: Buffer) {
  const parsedRows = bytes
    .subarray(0, MAX_TEXT_BYTES)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line));
  const visibleRows = parsedRows.slice(0, MAX_PREVIEW_ROWS);
  const maxSourceColumnCount = Math.max(0, ...parsedRows.map((row) => row.length));
  const maxColumnCount = Math.min(maxSourceColumnCount, MAX_PREVIEW_CELLS);

  return {
    rows: visibleRows.map((row, index) => ({
      rowNumber: index + 1,
      cells: row.slice(0, MAX_PREVIEW_CELLS).map(displayCell)
    })),
    maxColumnCount,
    truncatedRows: parsedRows.length > visibleRows.length,
    truncatedCells: maxSourceColumnCount > maxColumnCount
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

function displayCell(value: string | undefined) {
  return String(value ?? "").trim();
}

function isXlsxFile(fileName: string, contentType: string) {
  return (
    /\.xlsx$/i.test(fileName) ||
    contentType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  );
}

function isCsvFile(fileName: string, contentType: string) {
  return /\.csv$/i.test(fileName) || contentType.includes("text/csv");
}

function isTextFile(fileName: string, contentType: string) {
  return (
    /\.txt$/i.test(fileName) ||
    /\.md$/i.test(fileName) ||
    contentType.startsWith("text/")
  );
}

function safeFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

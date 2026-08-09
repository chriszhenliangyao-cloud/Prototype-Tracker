import { buildMasterDataWorkbookBuffer } from "./exports/masterDataWorkbook";
import { getMasterData } from "./data";
import { prisma } from "./prisma";
import type { MasterDataArchiveOption } from "./types";

type ArchiveSource =
  | "QUICK_SIMULATION"
  | "MASTER_DATA_IMPORT"
  | "MASTER_DATA_MANUAL_CREATE"
  | "MASTER_DATA_MANUAL_UPDATE"
  | "MASTER_DATA_MANUAL_DELETE";

type CreateMasterDataArchiveInput = {
  source: ArchiveSource;
  sourceReference?: string;
  title: string;
  message: string;
  createdByEmail?: string | null;
};

type DriveUploadResult = {
  status: "NOT_CONFIGURED" | "UPLOADED" | "FAILED";
  fileId?: string | null;
  url?: string | null;
};

export async function createMasterDataArchive({
  source,
  sourceReference,
  title,
  message,
  createdByEmail
}: CreateMasterDataArchiveInput): Promise<MasterDataArchiveOption | null> {
  try {
    const workbook = buildMasterDataWorkbookBuffer(await getMasterData());
    const workbookFileName = buildArchiveFileName(source, sourceReference);

    const archive = await prisma.masterDataArchive.create({
      data: {
        source,
        sourceReference: sourceReference ?? null,
        title,
        message,
        workbookFileName,
        workbookBytes: new Uint8Array(workbook),
        createdByEmail: createdByEmail ?? null
      }
    });

    const driveUpload = await uploadArchiveToDriveWebhook({
      archiveId: archive.id,
      fileName: workbookFileName,
      title,
      message,
      source,
      sourceReference,
      workbook
    });

    const updatedArchive =
      driveUpload.status === "NOT_CONFIGURED"
        ? archive
        : await prisma.masterDataArchive.update({
            where: { id: archive.id },
            data: {
              driveStatus: driveUpload.status,
              driveFileId: driveUpload.fileId ?? null,
              driveUrl: driveUpload.url ?? null
            }
          });

    return serializeArchive(updatedArchive);
  } catch (error) {
    console.error("Failed to create master data archive", error);
    return null;
  }
}

function buildArchiveFileName(source: ArchiveSource, sourceReference?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reference = sourceReference
    ? `-${sourceReference.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 48)}`
    : "";

  return `Master data ${source.toLowerCase().replaceAll("_", "-")}${reference} ${timestamp}.xlsx`;
}

async function uploadArchiveToDriveWebhook({
  archiveId,
  fileName,
  title,
  message,
  source,
  sourceReference,
  workbook
}: {
  archiveId: string;
  fileName: string;
  title: string;
  message: string;
  source: ArchiveSource;
  sourceReference?: string;
  workbook: Buffer;
}): Promise<DriveUploadResult> {
  const webhookUrl = process.env.MASTER_DATA_ARCHIVE_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { status: "NOT_CONFIGURED" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MASTER_DATA_ARCHIVE_WEBHOOK_SECRET
          ? {
              Authorization: `Bearer ${process.env.MASTER_DATA_ARCHIVE_WEBHOOK_SECRET}`
            }
          : {})
      },
      body: JSON.stringify({
        archiveId,
        fileName,
        title,
        message,
        source,
        sourceReference,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileBase64: workbook.toString("base64")
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { status: "FAILED" };
    }

    const payload = (await safeJson(response)) as {
      fileId?: unknown;
      id?: unknown;
      url?: unknown;
      webViewLink?: unknown;
    };

    return {
      status: "UPLOADED",
      fileId: text(payload.fileId) || text(payload.id) || null,
      url: text(payload.url) || text(payload.webViewLink) || null
    };
  } catch (error) {
    console.error("Failed to upload master data archive to webhook", error);
    return { status: "FAILED" };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeArchive(archive: {
  id: string;
  source: string;
  sourceReference: string | null;
  title: string;
  message: string;
  workbookFileName: string;
  driveStatus: string;
  driveFileId: string | null;
  driveUrl: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MasterDataArchiveOption {
  return {
    id: archive.id,
    source: archive.source,
    sourceReference: archive.sourceReference,
    title: archive.title,
    message: archive.message,
    workbookFileName: archive.workbookFileName,
    driveStatus:
      archive.driveStatus === "UPLOADED" || archive.driveStatus === "FAILED"
        ? archive.driveStatus
        : "NOT_CONFIGURED",
    driveFileId: archive.driveFileId,
    driveUrl: archive.driveUrl,
    createdByEmail: archive.createdByEmail,
    createdAt: archive.createdAt.toISOString(),
    updatedAt: archive.updatedAt.toISOString()
  };
}

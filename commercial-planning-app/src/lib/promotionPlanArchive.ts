import { prisma } from "./prisma";
import { promotionPlanFileName, type PromotionPlanMonth } from "./promotionPlan";
import { recompressXlsxWorkbook } from "./exports/xlsxWorkbook";
import type {
  PromotionPlanArchiveDriveStatus,
  PromotionPlanArchiveOption
} from "./types";

export type PromotionPlanArchiveSource =
  | "PROMOTION_PLAN_SAVE"
  | "PROMOTION_PLAN_IMPORT"
  | "PROMOTION_PLAN_HISTORICAL_IMPORT"
  | "PROMOTION_PLAN_EXPORT"
  | "PROMOTION_PLAN_SUBMIT"
  | "PROMOTION_PLAN_APPROVE"
  | "PROMOTION_PLAN_REJECT"
  | "PROMOTION_PLAN_COPY"
  | "BUSINESS_PLAN_APPROVE";

type CreatePromotionPlanArchiveInput = {
  source: PromotionPlanArchiveSource;
  sourceReference: string;
  title: string;
  message: string;
  workbook: Buffer;
  month?: PromotionPlanMonth | null;
  planYear?: number | null;
  createdByEmail?: string | null;
  createdAt?: Date;
};

type DriveUploadResult = {
  status: PromotionPlanArchiveDriveStatus;
  fileId?: string | null;
  url?: string | null;
};

export async function createPromotionPlanArchive({
  source,
  sourceReference,
  title,
  message,
  workbook,
  month,
  planYear,
  createdByEmail,
  createdAt
}: CreatePromotionPlanArchiveInput): Promise<PromotionPlanArchiveOption | null> {
  try {
    const archivedWorkbook = recompressXlsxWorkbook(workbook);
    const workbookFileName = promotionPlanFileName(
      source.startsWith("BUSINESS_PLAN") ? "business-plan" : "promotion-plan",
      sourceReference,
      createdAt
    );
    const archive = await prisma.promotionPlanArchive.create({
      data: {
        planYear: month?.year ?? planYear ?? null,
        planMonth: month?.month ?? null,
        source,
        sourceReference,
        title,
        message,
        workbookFileName,
        workbookBytes: new Uint8Array(archivedWorkbook),
        createdByEmail: createdByEmail ?? null
      }
    });

    const driveUpload = await uploadPromotionPlanArchiveToDriveWebhook({
      archiveId: archive.id,
      fileName: workbookFileName,
      title,
      message,
      source,
      sourceReference,
      workbook: archivedWorkbook,
      month,
      planYear,
      createdByEmail
    });

    const updatedArchive =
      driveUpload.status === "NOT_CONFIGURED"
        ? archive
        : await prisma.promotionPlanArchive.update({
            where: { id: archive.id },
            data: {
              driveStatus: driveUpload.status,
              driveFileId: driveUpload.fileId ?? null,
              driveUrl: driveUpload.url ?? null
            }
          });

    return serializePromotionPlanArchive(updatedArchive);
  } catch (error) {
    console.error("Failed to create promotion plan archive", error);
    return null;
  }
}

export async function retryPromotionPlanArchiveDriveUpload({
  archiveId
}: {
  archiveId: string;
}): Promise<PromotionPlanArchiveOption | null> {
  const archive = await prisma.promotionPlanArchive.findUnique({
    where: { id: archiveId }
  });
  if (!archive) {
    return null;
  }

  const workbook = recompressXlsxWorkbook(Buffer.from(archive.workbookBytes));
  const driveUpload = await uploadPromotionPlanArchiveToDriveWebhook({
    archiveId: archive.id,
    fileName: archive.workbookFileName,
    title: archive.title,
    message: archive.message,
    source: archive.source as PromotionPlanArchiveSource,
    sourceReference: archive.sourceReference ?? archive.workbookFileName,
    workbook,
    month:
      archive.planYear && archive.planMonth
        ? { year: archive.planYear, month: archive.planMonth }
        : null,
    planYear: archive.planYear,
    createdByEmail: archive.createdByEmail
  });

  const updatedArchive = await prisma.promotionPlanArchive.update({
    where: { id: archive.id },
    data: {
      driveStatus: driveUpload.status,
      driveFileId: driveUpload.fileId ?? null,
      driveUrl: driveUpload.url ?? null,
      workbookBytes: new Uint8Array(workbook)
    }
  });

  return serializePromotionPlanArchive(updatedArchive);
}

export function serializePromotionPlanArchive(archive: {
  id: string;
  planYear: number | null;
  planMonth: number | null;
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
}): PromotionPlanArchiveOption {
  return {
    id: archive.id,
    planYear: archive.planYear,
    planMonth: archive.planMonth,
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

async function uploadPromotionPlanArchiveToDriveWebhook({
  archiveId,
  fileName,
  title,
  message,
  source,
  sourceReference,
  workbook,
  month,
  planYear,
  createdByEmail
}: {
  archiveId: string;
  fileName: string;
  title: string;
  message: string;
  source: PromotionPlanArchiveSource;
  sourceReference: string;
  workbook: Buffer;
  month?: PromotionPlanMonth | null;
  planYear?: number | null;
  createdByEmail?: string | null;
}): Promise<DriveUploadResult> {
  const webhookUrl = process.env.PROMOTION_PLAN_ARCHIVE_WEBHOOK_URL?.trim();
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
        ...(process.env.PROMOTION_PLAN_ARCHIVE_WEBHOOK_SECRET
          ? {
              Authorization: `Bearer ${process.env.PROMOTION_PLAN_ARCHIVE_WEBHOOK_SECRET}`
            }
          : {})
      },
      body: JSON.stringify({
        archiveType: source.startsWith("BUSINESS_PLAN")
          ? "BUSINESS_PLAN"
          : "PROMOTION_PLAN",
        archiveId,
        fileName,
        title,
        message,
        source,
        sourceReference,
        planYear: month?.year ?? planYear ?? null,
        planMonth: month?.month ?? null,
        createdByEmail: createdByEmail ?? null,
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
    console.error("Failed to upload promotion plan archive to webhook", error);
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

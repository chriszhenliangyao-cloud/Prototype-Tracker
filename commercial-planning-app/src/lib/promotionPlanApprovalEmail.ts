import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import {
  getPromotionPlanEntries,
  getPromotionPlanMonthStatuses,
  getReferenceData
} from "./data";
import { prisma } from "./prisma";
import { promotionPlanMonthKey, type PromotionPlanMonth } from "./promotionPlan";
import { buildPromotionPlanPromotionRows } from "./promotionPlanShared";
import { formatEuropeanDateTime } from "./format";
import {
  buildPromotionPlanApprovalReference,
  withApprovalReferenceFileName
} from "./approvalReference";
import type {
  PromotionPlanArchiveOption,
  PromotionPlanEmailNotificationOption,
  PromotionPlanEmailNotificationStatus,
  PromotionPlanEmailRecipientOption,
  PromotionPlanEntryOption,
  PromotionPlanMonthStatusOption
} from "./types";
import type { PromotionTableRow } from "./calculatorRows";

const APPROVAL_ATTACHMENT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const GLOBAL_RECIPIENT_COUNTRY_CODE = "GLOBAL";
const EMAIL_PROVIDER = "SES";
const MAX_SEND_ATTEMPTS = 3;

let sesClient: SESv2Client | null = null;

export type PromotionPlanApprovalEmailPayload = {
  event: "PROMOTION_PLAN_APPROVED";
  archiveId: string | null;
  reference: string;
  planYear: number;
  planMonth: number;
  monthKey: string;
  countryCodes: string[];
  countryLabels: string[];
  approvedByEmail: string | null;
  submittedByEmails: string[];
  submittedAt: string | null;
  firstApprovedByEmails: string[];
  firstApprovedAt: string | null;
  finalApprovedAt: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  summary: string;
  channelSummaries: PromotionPlanApprovalEmailChannelSummary[];
  attachment: {
    fileName: string;
    contentType: typeof APPROVAL_ATTACHMENT_CONTENT_TYPE;
    fileBase64: string;
  };
};

export type PromotionPlanApprovalEmailChannelSummary = {
  countryCode: string;
  countryLabel: string;
  retailerName: string;
  fdName: string;
  rowCount: number;
  productCount: number;
  currency: string;
  promoRebateTotal: number;
  marginRebateTotal: number;
  totalRebate: number;
};

export function resolvePromotionPlanApprovalEmailRecipients({
  countryCodes,
  approvedByEmail,
  statuses,
  entries,
  configuredRecipients
}: {
  countryCodes: string[];
  approvedByEmail: string | null;
  statuses: PromotionPlanMonthStatusOption[];
  entries: PromotionPlanEntryOption[];
  configuredRecipients: PromotionPlanEmailRecipientOption[];
}) {
  const allowedCountryCodes = new Set(
    countryCodes.map((countryCode) => countryCode.toUpperCase())
  );
  const statusSubmitters = uniqueEmails(
    statuses
      .filter((status) => allowedCountryCodes.has(status.countryCode.toUpperCase()))
      .map((status) => status.submittedByEmail)
  );
  const fallbackSubmitters = uniqueEmails(
    entries
      .filter((entry) => allowedCountryCodes.has(entry.countryCode.toUpperCase()))
      .map((entry) => entry.updatedByEmail ?? entry.createdByEmail)
  );
  const submittedByEmails =
    statusSubmitters.length > 0 ? statusSubmitters : fallbackSubmitters;
  const toEmails = uniqueEmails([...submittedByEmails, approvedByEmail]);
  const toEmailSet = new Set(toEmails.map(normalizeEmail));
  const ccEmails = uniqueEmails(
    configuredRecipients
      .filter((recipient) => recipient.status === "ACTIVE")
      .filter(
        (recipient) =>
          recipient.countryCode.toUpperCase() === GLOBAL_RECIPIENT_COUNTRY_CODE ||
          allowedCountryCodes.has(recipient.countryCode.toUpperCase())
      )
      .map((recipient) => recipient.email)
  ).filter((email) => !toEmailSet.has(normalizeEmail(email)));

  return { toEmails, ccEmails, submittedByEmails };
}

export function buildPromotionPlanApprovalEmailPayload({
  archiveId,
  fileName,
  workbook,
  month,
  countryCodes,
  approvedByEmail,
  submittedByEmails,
  toEmails,
  ccEmails,
  statuses = [],
  promotionRows = []
}: {
  archiveId: string | null;
  fileName: string;
  workbook: Buffer;
  month: PromotionPlanMonth;
  countryCodes: string[];
  approvedByEmail: string | null;
  submittedByEmails: string[];
  toEmails: string[];
  ccEmails: string[];
  statuses?: PromotionPlanMonthStatusOption[];
  promotionRows?: PromotionTableRow[];
}): PromotionPlanApprovalEmailPayload {
  const monthKey = promotionPlanMonthKey(month);
  const normalizedCountryCodes = countryCodes.map((code) => code.toUpperCase());
  const countryLabels = normalizedCountryCodes.map(countryMarketLabel);
  const countryLabel = countryLabels.join(", ");
  const reference = buildPromotionPlanApprovalReference({
    monthKey,
    countryCodes: normalizedCountryCodes
  });
  const approvalDates = approvalDatesFromStatuses(statuses);
  const firstApprovedByEmails = uniqueEmails(
    statuses.map((status) => status.firstApprovedByEmail)
  );
  const channelSummaries = buildChannelSummaries(promotionRows);

  return {
    event: "PROMOTION_PLAN_APPROVED",
    archiveId,
    reference,
    planYear: month.year,
    planMonth: month.month,
    monthKey,
    countryCodes: normalizedCountryCodes,
    countryLabels,
    approvedByEmail,
    submittedByEmails,
    submittedAt: approvalDates.submittedAt,
    firstApprovedByEmails,
    firstApprovedAt: approvalDates.firstApprovedAt,
    finalApprovedAt: approvalDates.finalApprovedAt,
    toEmails,
    ccEmails,
    subject: `Promotion Plan Approved · ${countryLabel || normalizedCountryCodes.join("/")} · ${monthKey} · Final Approval · Approval Ref ${reference}`,
    summary: [
      `Promotion Plan ${monthKey} has been final approved for ${countryLabel || normalizedCountryCodes.join(", ")}.`,
      `Approval Ref: ${reference}`,
      `Market: ${countryLabel || normalizedCountryCodes.join(", ")}`
    ].join(" "),
    channelSummaries,
    attachment: {
      fileName: withApprovalReferenceFileName(fileName, reference),
      contentType: APPROVAL_ATTACHMENT_CONTENT_TYPE,
      fileBase64: workbook.toString("base64")
    }
  };
}

export function buildPromotionPlanApprovalRawEmail({
  payload,
  fromEmail,
  replyToEmail
}: {
  payload: PromotionPlanApprovalEmailPayload;
  fromEmail: string;
  replyToEmail?: string | null;
}) {
  const boundary = `value-chain-approval-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const alternativeBoundary = `${boundary}-body`;
  const replyTo = replyToEmail?.trim();
  const textBody = approvalEmailPlainTextBody(payload);
  const htmlBody = approvalEmailHtmlBody(payload);
  const headers = [
    `From: ${fromEmail}`,
    ...(payload.toEmails.length > 0
      ? [`To: ${payload.toEmails.join(", ")}`]
      : []),
    ...(payload.ccEmails.length > 0
      ? [`Cc: ${payload.ccEmails.join(", ")}`]
      : []),
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeMimeHeader(payload.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];

  return [
    ...headers,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    textBody,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    "",
    `--${alternativeBoundary}--`,
    "",
    `--${boundary}`,
    `Content-Type: ${payload.attachment.contentType}; name="${escapeMimeFileName(
      payload.attachment.fileName
    )}"`,
    `Content-Disposition: attachment; filename="${escapeMimeFileName(
      payload.attachment.fileName
    )}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(payload.attachment.fileBase64),
    "",
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

export async function sendPromotionPlanApprovalEmail({
  archive,
  workbook,
  month,
  countryCodes,
  approvedByEmail,
  statuses,
  entries,
  promotionRows = []
}: {
  archive: PromotionPlanArchiveOption | null;
  workbook: Buffer;
  month: PromotionPlanMonth;
  countryCodes: string[];
  approvedByEmail: string | null;
  statuses: PromotionPlanMonthStatusOption[];
  entries: PromotionPlanEntryOption[];
  promotionRows?: PromotionTableRow[];
}): Promise<PromotionPlanEmailNotificationOption | null> {
  const configuredRecipients = await activeApprovalEmailRecipients(countryCodes);
  const recipients = resolvePromotionPlanApprovalEmailRecipients({
    countryCodes,
    approvedByEmail,
    statuses,
    entries,
    configuredRecipients
  });
  const payload = buildPromotionPlanApprovalEmailPayload({
    archiveId: archive?.id ?? null,
    fileName: archive?.workbookFileName ?? `promotion-plan-${promotionPlanMonthKey(month)}.xlsx`,
    workbook,
    month,
    countryCodes,
    approvedByEmail,
    submittedByEmails: recipients.submittedByEmails,
    toEmails: recipients.toEmails,
    ccEmails: recipients.ccEmails,
    statuses,
    promotionRows
  });
  const notification = await createNotification({
    archiveId: archive?.id ?? null,
    month,
    countryCodes,
    toEmails: recipients.toEmails,
    ccEmails: recipients.ccEmails,
    status: "PENDING",
    errorMessage: null,
    createdByEmail: approvedByEmail
  });

  return deliverNotificationEmail({
    notificationId: notification.id,
    payload
  });
}

export async function retryPromotionPlanApprovalEmailNotification({
  notificationId
}: {
  notificationId: string;
}) {
  const notification = await prisma.promotionPlanEmailNotification.findUnique({
    where: { id: notificationId }
  });
  if (!notification) {
    throw new Error("Approval email notification not found.");
  }
  if (!["FAILED", "PENDING", "NOT_CONFIGURED"].includes(notification.status)) {
    throw new Error("Only failed or pending approval emails can be retried.");
  }

  const archive = notification.archiveId
    ? await prisma.promotionPlanArchive.findUnique({
        where: { id: notification.archiveId }
      })
    : null;
  if (!archive) {
    const updated = await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        status: "FAILED",
        provider: EMAIL_PROVIDER,
        errorMessage: "Approval email archive workbook is missing.",
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 }
      }
    });
    return serializeNotificationRecord(updated);
  }

  const countryCodes = parseJsonStringArray(notification.countryCodes);
  const toEmails = parseJsonStringArray(notification.toEmails);
  const ccEmails = parseJsonStringArray(notification.ccEmails);
  const month = {
    year: notification.planYear,
    month: notification.planMonth
  };
  const [statuses, entries, referenceData] = await Promise.all([
    getPromotionPlanMonthStatuses({
      planYear: month.year,
      planMonth: month.month,
      countryCodes
    }),
    getPromotionPlanEntries(month.year, month.month, countryCodes),
    getReferenceData()
  ]);
  const promotionRows = buildPromotionPlanPromotionRows({
    data: referenceData,
    entries,
    lockedCountryCodes: countryCodes
  });
  const payload = buildPromotionPlanApprovalEmailPayload({
    archiveId: archive.id,
    fileName: archive.workbookFileName,
    workbook: Buffer.from(archive.workbookBytes),
    month,
    countryCodes,
    approvedByEmail: notification.createdByEmail,
    submittedByEmails: toEmails.filter(
      (email) => normalizeEmail(email) !== normalizeEmail(notification.createdByEmail ?? "")
    ),
    toEmails,
    ccEmails,
    statuses,
    promotionRows
  });

  await prisma.promotionPlanEmailNotification.update({
    where: { id: notificationId },
    data: {
      status: "PENDING",
      provider: EMAIL_PROVIDER,
      errorMessage: null,
      sentAt: null,
      messageId: null
    }
  });

  return deliverNotificationEmail({
    notificationId,
    payload
  });
}

async function activeApprovalEmailRecipients(countryCodes: string[]) {
  const countryScope = [
    GLOBAL_RECIPIENT_COUNTRY_CODE,
    ...countryCodes.map((countryCode) => countryCode.toUpperCase())
  ];
  return (
    await Promise.all([
      prisma.promotionPlanEmailRecipient.findMany({
        where: {
          status: "ACTIVE",
          countryCode: {
            in: countryScope
          }
        },
        orderBy: [{ countryCode: "asc" }, { email: "asc" }]
      }),
      prisma.userCountryAccess.findMany({
        where: {
          status: "ACTIVE",
          receivesPromotionPlanEmail: true,
          countryCode: {
            in: countryScope
          }
        },
        orderBy: [{ countryCode: "asc" }, { email: "asc" }]
      })
    ])
  ).flatMap((rows) =>
    rows.map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      label: recipient.label,
      countryCode: recipient.countryCode,
      status: recipient.status,
      createdByEmail: recipient.createdByEmail,
      createdAt: recipient.createdAt.toISOString(),
      updatedAt: recipient.updatedAt.toISOString()
    }))
  );
}

async function deliverNotificationEmail({
  notificationId,
  payload
}: {
  notificationId: string;
  payload: PromotionPlanApprovalEmailPayload;
}) {
  const fromEmail = approvalEmailFrom();
  if (!fromEmail) {
    const updated = await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        status: "NOT_CONFIGURED",
        provider: EMAIL_PROVIDER,
        errorMessage: "Approval email sender is not configured.",
        lastAttemptAt: new Date()
      }
    });
    return serializeNotificationRecord(updated);
  }
  if (payload.toEmails.length === 0 && payload.ccEmails.length === 0) {
    const updated = await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        status: "FAILED",
        provider: EMAIL_PROVIDER,
        errorMessage: "Approval email has no recipients.",
        lastAttemptAt: new Date()
      }
    });
    return serializeNotificationRecord(updated);
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    const attemptedAt = new Date();
    await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        status: "PENDING",
        provider: EMAIL_PROVIDER,
        attemptCount: { increment: 1 },
        lastAttemptAt: attemptedAt,
        errorMessage: null
      }
    });

    try {
      const replyToEmail = approvalEmailReplyTo(payload.approvedByEmail);
      const rawEmail = buildPromotionPlanApprovalRawEmail({
        payload,
        fromEmail,
        replyToEmail
      });
      const response = await getSesClient().send(
        new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: {
            ToAddresses: payload.toEmails,
            CcAddresses: payload.ccEmails
          },
          ReplyToAddresses: replyToEmail ? [replyToEmail] : undefined,
          Content: {
            Raw: {
              Data: Buffer.from(rawEmail)
            }
          }
        })
      );
      const updated = await prisma.promotionPlanEmailNotification.update({
        where: { id: notificationId },
        data: {
          status: "SENT",
          provider: EMAIL_PROVIDER,
          messageId: response.MessageId ?? null,
          errorMessage: null,
          sentAt: new Date()
        }
      });
      return serializeNotificationRecord(updated);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_SEND_ATTEMPTS) {
        await wait(300 * attempt);
      }
    }
  }

  console.error("Failed to send promotion plan approval email", lastError);
  const updated = await prisma.promotionPlanEmailNotification.update({
    where: { id: notificationId },
    data: {
      status: "FAILED",
      provider: EMAIL_PROVIDER,
      errorMessage: approvalEmailFailureMessage(lastError)
    }
  });
  return serializeNotificationRecord(updated);
}

async function createNotification({
  archiveId,
  month,
  countryCodes,
  toEmails,
  ccEmails,
  status,
  errorMessage,
  createdByEmail
}: {
  archiveId: string | null;
  month: PromotionPlanMonth;
  countryCodes: string[];
  toEmails: string[];
  ccEmails: string[];
  status: PromotionPlanEmailNotificationStatus;
  errorMessage: string | null;
  createdByEmail: string | null;
}) {
  const notification = await prisma.promotionPlanEmailNotification.create({
    data: {
      archiveId,
      planYear: month.year,
      planMonth: month.month,
      countryCodes: JSON.stringify(countryCodes),
      toEmails: JSON.stringify(toEmails),
      ccEmails: JSON.stringify(ccEmails),
      status,
      provider: EMAIL_PROVIDER,
      attemptCount: 0,
      errorMessage,
      sentAt: status === "SENT" ? new Date() : null,
      createdByEmail
    }
  });

  return serializeNotificationRecord(notification);
}

function serializeNotificationRecord(notification: {
  id: string;
  archiveId: string | null;
  planYear: number;
  planMonth: number;
  countryCodes: string;
  toEmails: string;
  ccEmails: string;
  status: string;
  provider: string;
  attemptCount: number;
  lastAttemptAt: Date | null;
  messageId: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromotionPlanEmailNotificationOption {
  return {
    id: notification.id,
    archiveId: notification.archiveId,
    planYear: notification.planYear,
    planMonth: notification.planMonth,
    countryCodes: parseJsonStringArray(notification.countryCodes),
    toEmails: parseJsonStringArray(notification.toEmails),
    ccEmails: parseJsonStringArray(notification.ccEmails),
    status: promotionPlanEmailNotificationStatus(notification.status),
    provider: notification.provider || EMAIL_PROVIDER,
    attemptCount: notification.attemptCount ?? 0,
    lastAttemptAt: notification.lastAttemptAt?.toISOString() ?? null,
    messageId: notification.messageId,
    errorMessage: notification.errorMessage,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdByEmail: notification.createdByEmail,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString()
  };
}

function getSesClient() {
  if (!sesClient) {
    sesClient = new SESv2Client({});
  }
  return sesClient;
}

function approvalEmailFrom() {
  return process.env.PROMOTION_PLAN_APPROVAL_EMAIL_FROM?.trim();
}

function approvalEmailReplyTo(approvedByEmail: string | null) {
  return (
    process.env.PROMOTION_PLAN_APPROVAL_EMAIL_REPLY_TO?.trim() ||
    approvedByEmail?.trim() ||
    null
  );
}

function approvalEmailFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `SES approval email failed: ${error.message}`;
  }
  return "SES approval email failed.";
}

function promotionPlanEmailNotificationStatus(
  status: string
): PromotionPlanEmailNotificationStatus {
  return status === "SENT" ||
    status === "FAILED" ||
    status === "PENDING" ||
    status === "NOT_CONFIGURED"
    ? status
    : "NOT_CONFIGURED";
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function uniqueEmails(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const value of values) {
    const email = String(value ?? "").trim();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || seen.has(normalizedEmail)) {
      continue;
    }
    seen.add(normalizedEmail);
    emails.push(email);
  }

  return emails;
}

function approvalDatesFromStatuses(statuses: PromotionPlanMonthStatusOption[]) {
  return {
    submittedAt: earliestIsoDate(statuses.map((status) => status.submittedAt)),
    firstApprovedAt: earliestIsoDate(
      statuses.map((status) => status.firstApprovedAt)
    ),
    finalApprovedAt: latestIsoDate(statuses.map((status) => status.approvedAt))
  };
}

function buildChannelSummaries(
  rows: PromotionTableRow[]
): PromotionPlanApprovalEmailChannelSummary[] {
  const summariesByKey = new Map<
    string,
    PromotionPlanApprovalEmailChannelSummary & { productSkus: Set<string> }
  >();

  for (const row of rows) {
    const currency = row.currency || "EUR";
    const key = [
      row.countryCode,
      row.retailerName,
      row.fdName,
      currency
    ].join("|");
    const current =
      summariesByKey.get(key) ??
      {
        countryCode: row.countryCode,
        countryLabel: countryMarketLabel(row.countryCode),
        retailerName: row.retailerName,
        fdName: row.fdName,
        rowCount: 0,
        productCount: 0,
        productSkus: new Set<string>(),
        currency,
        promoRebateTotal: 0,
        marginRebateTotal: 0,
        totalRebate: 0
      };
    const volume = parseFiniteNumber(row.promoVolume) ?? 0;
    const promoRebatePerUnit =
      row.promotionCalculation?.promoRebatePerUnit ?? 0;
    const marginRebatePerUnit =
      row.promotionCalculation?.marginRebatePerUnit ?? 0;
    const totalRebatePerUnit = row.promotionCalculation?.rebatePerUnit ?? 0;

    current.rowCount += 1;
    current.productSkus.add(row.model);
    current.productCount = current.productSkus.size;
    current.promoRebateTotal += promoRebatePerUnit * volume;
    current.marginRebateTotal += marginRebatePerUnit * volume;
    current.totalRebate += totalRebatePerUnit * volume;
    summariesByKey.set(key, current);
  }

  return [...summariesByKey.values()]
    .map(({ productSkus: _productSkus, ...summary }) => summary)
    .sort(
      (left, right) =>
        left.countryCode.localeCompare(right.countryCode) ||
        left.retailerName.localeCompare(right.retailerName) ||
        left.fdName.localeCompare(right.fdName)
    );
}

function approvalChannelSummaryLines(
  summaries: PromotionPlanApprovalEmailChannelSummary[]
) {
  if (summaries.length === 0) {
    return ["Channel summary", "-"];
  }

  const header = [
    "Market",
    "Channel",
    "FD",
    "Rows",
    "Products",
    "Promo rebate budget"
  ];
  const rows = summaries.map((summary) => [
    summary.countryLabel,
    summary.retailerName,
    summary.fdName,
    String(summary.rowCount),
    String(summary.productCount),
    formatPlainMoney(summary.promoRebateTotal, summary.currency)
  ]);
  const widths = header.map((label, columnIndex) =>
    Math.max(label.length, ...rows.map((row) => row[columnIndex].length))
  );
  const formatRow = (row: string[]) =>
    row.map((cell, columnIndex) => cell.padEnd(widths[columnIndex])).join("  ");

  return [
    "Channel summary",
    formatRow(header),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow)
  ];
}

function approvalEmailPlainTextBody(payload: PromotionPlanApprovalEmailPayload) {
  return [
    payload.summary,
    "",
    `Approval Ref: ${payload.reference}`,
    `Plan month: ${payload.monthKey}`,
    `Market: ${payload.countryLabels.join(", ") || payload.countryCodes.join(", ") || "-"}`,
    `Countries: ${payload.countryCodes.join(", ") || "-"}`,
    `Submitted by: ${payload.submittedByEmails.join(", ") || "-"}`,
    `Submitted at: ${formatEmailDateTime(payload.submittedAt)}`,
    `First approval by: ${payload.firstApprovedByEmails.join(", ") || "-"}`,
    `First approval at: ${formatEmailDateTime(payload.firstApprovedAt)}`,
    `Final approval by: ${payload.approvedByEmail ?? "-"}`,
    `Final approval at: ${formatEmailDateTime(payload.finalApprovedAt)}`,
    "",
    ...approvalChannelSummaryLines(payload.channelSummaries),
    "",
    "The attached workbook is the approval evidence."
  ].join("\r\n");
}

function approvalEmailHtmlBody(payload: PromotionPlanApprovalEmailPayload) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<style>",
    "body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.45;}",
    "table{border-collapse:collapse;width:100%;max-width:960px;margin:12px 0 24px 0;font-size:13px;}",
    "th,td{border:1px solid #d8e0ec;padding:8px 10px;text-align:left;vertical-align:top;}",
    "th{background:#eef4fb;color:#334155;font-weight:700;}",
    "td.number{text-align:right;white-space:nowrap;}",
    ".section-title{font-size:16px;font-weight:700;margin-top:22px;margin-bottom:8px;}",
    ".meta-table{max-width:720px;}",
    ".meta-table th{width:180px;}",
    ".muted{color:#64748b;}",
    "</style>",
    "</head>",
    "<body>",
    `<p>${escapeHtml(payload.summary)}</p>`,
    '<div class="section-title">Approval details</div>',
    '<table class="meta-table">',
    "<tbody>",
    approvalMetaHtmlRow("Approval Ref", payload.reference),
    approvalMetaHtmlRow("Plan month", payload.monthKey),
    approvalMetaHtmlRow(
      "Market",
      payload.countryLabels.join(", ") || payload.countryCodes.join(", ") || "-"
    ),
    approvalMetaHtmlRow("Countries", payload.countryCodes.join(", ") || "-"),
    approvalMetaHtmlRow(
      "Submitted by",
      payload.submittedByEmails.join(", ") || "-"
    ),
    approvalMetaHtmlRow("Submitted at", formatEmailDateTime(payload.submittedAt)),
    approvalMetaHtmlRow(
      "First approval by",
      payload.firstApprovedByEmails.join(", ") || "-"
    ),
    approvalMetaHtmlRow(
      "First approval at",
      formatEmailDateTime(payload.firstApprovedAt)
    ),
    approvalMetaHtmlRow("Final approval by", payload.approvedByEmail ?? "-"),
    approvalMetaHtmlRow(
      "Final approval at",
      formatEmailDateTime(payload.finalApprovedAt)
    ),
    "</tbody>",
    "</table>",
    '<div class="section-title">Channel summary</div>',
    approvalChannelSummaryTableHtml(payload.channelSummaries),
    '<p class="muted">The attached workbook is the approval evidence.</p>',
    "</body>",
    "</html>"
  ].join("\r\n");
}

function approvalMetaHtmlRow(label: string, value: string) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function approvalChannelSummaryTableHtml(
  summaries: PromotionPlanApprovalEmailChannelSummary[]
) {
  if (summaries.length === 0) {
    return '<p class="muted">No channel rows were included in this approval.</p>';
  }

  return [
    "<table>",
    "<thead>",
    "<tr>",
    "<th>Market</th>",
    "<th>Channel</th>",
    "<th>FD</th>",
    "<th>Rows</th>",
    "<th>Products</th>",
    "<th>Promo rebate budget</th>",
    "</tr>",
    "</thead>",
    "<tbody>",
    ...summaries.map((summary) =>
      [
        "<tr>",
        `<td>${escapeHtml(summary.countryLabel)}</td>`,
        `<td>${escapeHtml(summary.retailerName)}</td>`,
        `<td>${escapeHtml(summary.fdName)}</td>`,
        `<td class="number">${summary.rowCount}</td>`,
        `<td class="number">${summary.productCount}</td>`,
        `<td class="number">${escapeHtml(formatPlainMoney(summary.promoRebateTotal, summary.currency))}</td>`,
        "</tr>"
      ].join("")
    ),
    "</tbody>",
    "</table>"
  ].join("\r\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function earliestIsoDate(values: Array<string | null | undefined>) {
  const dates = values
    .map(parseDate)
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime());
  return dates[0]?.toISOString() ?? null;
}

function latestIsoDate(values: Array<string | null | undefined>) {
  const dates = values
    .map(parseDate)
    .filter((date): date is Date => date !== null)
    .sort((left, right) => right.getTime() - left.getTime());
  return dates[0]?.toISOString() ?? null;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEmailDateTime(value: string | null | undefined) {
  return value ? formatEuropeanDateTime(value) : "-";
}

function formatPlainMoney(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

function parseFiniteNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function countryMarketLabel(countryCode: string) {
  const normalizedCode = countryCode.toUpperCase();
  const countryName = COUNTRY_MARKET_NAMES[normalizedCode];
  return countryName ? `${normalizedCode} ${countryName}` : normalizedCode;
}

const COUNTRY_MARKET_NAMES: Record<string, string> = {
  CN: "China",
  CZ: "Czech Republic",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  HU: "Hungary",
  IT: "Italy",
  NL: "Netherlands",
  PL: "Poland",
  SE: "Sweden",
  SK: "Slovakia",
  UK: "United Kingdom"
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function encodeMimeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function escapeMimeFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

function wrapBase64(value: string) {
  return value.replace(/(.{1,76})/g, "$1\r\n").trim();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import {
  getBusinessPlanEntries,
  getBusinessPlanYearStatuses
} from "./data";
import {
  buildBusinessPlanApprovalReference,
  withApprovalReferenceFileName
} from "./approvalReference";
import { prisma } from "./prisma";
import type {
  BusinessPlanEntryOption,
  BusinessPlanYearStatusOption,
  PromotionPlanArchiveOption,
  PromotionPlanEmailNotificationOption,
  PromotionPlanEmailNotificationStatus,
  PromotionPlanEmailRecipientOption
} from "./types";

const APPROVAL_ATTACHMENT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EMAIL_PROVIDER = "SES";
const GLOBAL_RECIPIENT_COUNTRY_CODE = "GLOBAL";
const MAX_SEND_ATTEMPTS = 3;
const BUSINESS_PLAN_EMAIL_MONTH = 0;
const SES_RAW_EMAIL_LIMIT_BYTES = 40 * 1024 * 1024;

let sesClient: SESv2Client | null = null;

type BusinessPlanApprovalEmailPayload = {
  event: "BUSINESS_PLAN_APPROVED";
  archiveId: string | null;
  reference: string;
  planYear: number;
  countryCodes: string[];
  approvedByEmail: string | null;
  submittedByEmails: string[];
  firstApprovedByEmails: string[];
  submittedAt: string | null;
  firstApprovedAt: string | null;
  finalApprovedAt: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  summary: string;
  channelSummaries: BusinessPlanApprovalEmailChannelSummary[];
  archiveDownloadUrl: string | null;
  attachment: {
    fileName: string;
    contentType: typeof APPROVAL_ATTACHMENT_CONTENT_TYPE;
    fileBase64: string;
  } | null;
  attachmentNotice: string | null;
};

type BusinessPlanApprovalEmailChannelSummary = {
  countryCode: string;
  retailerName: string;
  fdName: string;
  rowCount: number;
  productCount: number;
  siUnits: number;
  soUnits: number;
};

export async function sendBusinessPlanApprovalEmail({
  approvedByEmail,
  archive,
  countryCodes,
  entries,
  planYear,
  statuses,
  workbook
}: {
  approvedByEmail: string | null;
  archive: PromotionPlanArchiveOption | null;
  countryCodes: string[];
  entries: BusinessPlanEntryOption[];
  planYear: number;
  statuses: BusinessPlanYearStatusOption[];
  workbook: Buffer;
}): Promise<PromotionPlanEmailNotificationOption | null> {
  const configuredRecipients = await activeApprovalEmailRecipients(countryCodes);
  const recipients = resolveBusinessPlanApprovalEmailRecipients({
    approvedByEmail,
    configuredRecipients,
    countryCodes,
    entries,
    statuses
  });
  const payload = buildBusinessPlanApprovalEmailPayload({
    archiveId: archive?.id ?? null,
    approvedByEmail,
    ccEmails: recipients.ccEmails,
    countryCodes,
    entries,
    fileName: archive?.workbookFileName ?? `business-plan-${planYear}.xlsx`,
    planYear,
    statuses,
    submittedByEmails: recipients.submittedByEmails,
    toEmails: recipients.toEmails,
    workbook,
    archiveDownloadUrl: archiveDownloadUrl(archive?.id ?? null)
  });
  const notification = await createNotification({
    archiveId: archive?.id ?? null,
    ccEmails: recipients.ccEmails,
    countryCodes,
    createdByEmail: approvedByEmail,
    errorMessage: null,
    planYear,
    status: "PENDING",
    toEmails: recipients.toEmails
  });

  return deliverNotificationEmail({
    notificationId: notification.id,
    payload
  });
}

function resolveBusinessPlanApprovalEmailRecipients({
  approvedByEmail,
  configuredRecipients,
  countryCodes,
  entries,
  statuses
}: {
  approvedByEmail: string | null;
  configuredRecipients: PromotionPlanEmailRecipientOption[];
  countryCodes: string[];
  entries: BusinessPlanEntryOption[];
  statuses: BusinessPlanYearStatusOption[];
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

  return { ccEmails, submittedByEmails, toEmails };
}

export function buildBusinessPlanApprovalEmailPayload({
  approvedByEmail,
  archiveId,
  ccEmails,
  countryCodes,
  entries,
  fileName,
  planYear,
  statuses,
  submittedByEmails,
  toEmails,
  workbook,
  archiveDownloadUrl
}: {
  approvedByEmail: string | null;
  archiveId: string | null;
  ccEmails: string[];
  countryCodes: string[];
  entries: BusinessPlanEntryOption[];
  fileName: string;
  planYear: number;
  statuses: BusinessPlanYearStatusOption[];
  submittedByEmails: string[];
  toEmails: string[];
  workbook: Buffer;
  archiveDownloadUrl?: string | null;
}): BusinessPlanApprovalEmailPayload {
  const normalizedCountryCodes = countryCodes.map((code) => code.toUpperCase());
  const countryLabel = normalizedCountryCodes.join(", ");
  const reference = buildBusinessPlanApprovalReference({
    planYear,
    countryCodes: normalizedCountryCodes
  });
  const approvalDates = approvalDatesFromStatuses(statuses);
  const firstApprovedByEmails = uniqueEmails(
    statuses.map((status) => status.firstApprovedByEmail)
  );

  return {
    event: "BUSINESS_PLAN_APPROVED",
    archiveId,
    reference,
    planYear,
    countryCodes: normalizedCountryCodes,
    approvedByEmail,
    submittedByEmails,
    submittedAt: approvalDates.submittedAt,
    firstApprovedByEmails,
    firstApprovedAt: approvalDates.firstApprovedAt,
    finalApprovedAt: approvalDates.finalApprovedAt,
    toEmails,
    ccEmails,
    subject: `BP Approved · ${countryLabel || "ALL"} · ${planYear} · Final Approval · Approval Ref ${reference}`,
    summary: [
      `BP ${planYear} has been final approved for ${countryLabel || "ALL"}.`,
      `Approval Ref: ${reference}`
    ].join(" "),
    channelSummaries: buildChannelSummaries(entries, normalizedCountryCodes),
    archiveDownloadUrl: archiveDownloadUrl ?? null,
    attachment: {
      fileName: withApprovalReferenceFileName(fileName, reference),
      contentType: APPROVAL_ATTACHMENT_CONTENT_TYPE,
      fileBase64: workbook.toString("base64")
    },
    attachmentNotice: null
  };
}

export async function retryBusinessPlanApprovalEmailNotification({
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
        attemptCount: { increment: 1 },
        errorMessage: "Approval email archive workbook is missing.",
        lastAttemptAt: new Date(),
        provider: EMAIL_PROVIDER,
        status: "FAILED"
      }
    });
    return serializeNotificationRecord(updated);
  }

  const countryCodes = parseJsonStringArray(notification.countryCodes);
  const toEmails = parseJsonStringArray(notification.toEmails);
  const ccEmails = parseJsonStringArray(notification.ccEmails);
  const [statuses, entries] = await Promise.all([
    getBusinessPlanYearStatuses({
      planYear: notification.planYear,
      countryCodes
    }),
    getBusinessPlanEntries(notification.planYear, countryCodes)
  ]);
  const payload = buildBusinessPlanApprovalEmailPayload({
    archiveId: archive.id,
    approvedByEmail: notification.createdByEmail,
    ccEmails,
    countryCodes,
    entries,
    fileName: archive.workbookFileName,
    planYear: notification.planYear,
    statuses,
    submittedByEmails: toEmails.filter(
      (email) => normalizeEmail(email) !== normalizeEmail(notification.createdByEmail)
    ),
    toEmails,
    workbook: Buffer.from(archive.workbookBytes),
    archiveDownloadUrl: archiveDownloadUrl(archive.id)
  });

  await prisma.promotionPlanEmailNotification.update({
    where: { id: notificationId },
    data: {
      errorMessage: null,
      messageId: null,
      provider: EMAIL_PROVIDER,
      sentAt: null,
      status: "PENDING"
    }
  });

  return deliverNotificationEmail({
    notificationId,
    payload
  });
}

export function buildBusinessPlanApprovalRawEmail({
  fromEmail,
  payload,
  replyToEmail
}: {
  fromEmail: string;
  payload: BusinessPlanApprovalEmailPayload;
  replyToEmail?: string | null;
}) {
  const boundary = `value-chain-bp-approval-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const alternativeBoundary = `${boundary}-body`;
  const replyTo = replyToEmail?.trim();
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

  const attachmentParts = payload.attachment
    ? [
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
        ""
      ]
    : [];

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
    approvalEmailPlainTextBody(payload),
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    approvalEmailHtmlBody(payload),
    "",
    `--${alternativeBoundary}--`,
    "",
    ...attachmentParts,
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

export function rawBusinessPlanApprovalEmailForSes({
  fromEmail,
  payload,
  replyToEmail
}: {
  fromEmail: string;
  payload: BusinessPlanApprovalEmailPayload;
  replyToEmail?: string | null;
}) {
  const rawEmail = buildBusinessPlanApprovalRawEmail({
    fromEmail,
    payload,
    replyToEmail
  });
  if (Buffer.byteLength(rawEmail) <= SES_RAW_EMAIL_LIMIT_BYTES) {
    return rawEmail;
  }

  return buildBusinessPlanApprovalRawEmail({
    fromEmail,
    payload: {
      ...payload,
      attachment: null,
      attachmentNotice: [
        "The BP workbook is too large to attach to the approval email.",
        payload.archiveDownloadUrl
          ? `Download the archived workbook from the system: ${payload.archiveDownloadUrl}`
          : "Download the archived workbook from Approval Center delivery status."
      ].join(" ")
    },
    replyToEmail
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
  payload: BusinessPlanApprovalEmailPayload;
}) {
  const fromEmail = approvalEmailFrom();
  if (!fromEmail) {
    const updated = await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        errorMessage: "Approval email sender is not configured.",
        lastAttemptAt: new Date(),
        provider: EMAIL_PROVIDER,
        status: "NOT_CONFIGURED"
      }
    });
    return serializeNotificationRecord(updated);
  }
  if (payload.toEmails.length === 0 && payload.ccEmails.length === 0) {
    const updated = await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        errorMessage: "Approval email has no recipients.",
        lastAttemptAt: new Date(),
        provider: EMAIL_PROVIDER,
        status: "FAILED"
      }
    });
    return serializeNotificationRecord(updated);
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    await prisma.promotionPlanEmailNotification.update({
      where: { id: notificationId },
      data: {
        attemptCount: { increment: 1 },
        errorMessage: null,
        lastAttemptAt: new Date(),
        provider: EMAIL_PROVIDER,
        status: "PENDING"
      }
    });

    try {
      const replyToEmail = approvalEmailReplyTo(payload.approvedByEmail);
      const rawEmail = rawBusinessPlanApprovalEmailForSes({
        fromEmail,
        payload,
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
          errorMessage: null,
          messageId: response.MessageId ?? null,
          provider: EMAIL_PROVIDER,
          sentAt: new Date(),
          status: "SENT"
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

  console.error("Failed to send BP approval email", lastError);
  const updated = await prisma.promotionPlanEmailNotification.update({
    where: { id: notificationId },
    data: {
      errorMessage: approvalEmailFailureMessage(lastError),
      provider: EMAIL_PROVIDER,
      status: "FAILED"
    }
  });
  return serializeNotificationRecord(updated);
}

async function createNotification({
  archiveId,
  ccEmails,
  countryCodes,
  createdByEmail,
  errorMessage,
  planYear,
  status,
  toEmails
}: {
  archiveId: string | null;
  ccEmails: string[];
  countryCodes: string[];
  createdByEmail: string | null;
  errorMessage: string | null;
  planYear: number;
  status: PromotionPlanEmailNotificationStatus;
  toEmails: string[];
}) {
  const notification = await prisma.promotionPlanEmailNotification.create({
    data: {
      archiveId,
      ccEmails: JSON.stringify(ccEmails),
      countryCodes: JSON.stringify(countryCodes),
      createdByEmail,
      errorMessage,
      planMonth: BUSINESS_PLAN_EMAIL_MONTH,
      planYear,
      provider: EMAIL_PROVIDER,
      status,
      toEmails: JSON.stringify(toEmails),
      attemptCount: 0,
      sentAt: status === "SENT" ? new Date() : null
    }
  });

  return serializeNotificationRecord(notification);
}

function buildChannelSummaries(
  entries: BusinessPlanEntryOption[],
  countryCodes: string[]
) {
  const allowedCountryCodes = new Set(countryCodes.map((code) => code.toUpperCase()));
  const summariesByKey = new Map<
    string,
    BusinessPlanApprovalEmailChannelSummary & { productSkus: Set<string> }
  >();

  for (const entry of entries) {
    if (!allowedCountryCodes.has(entry.countryCode.toUpperCase())) {
      continue;
    }
    const key = [entry.countryCode, entry.retailerName, entry.fdName].join("|");
    const current =
      summariesByKey.get(key) ??
      {
        countryCode: entry.countryCode,
        retailerName: entry.retailerName,
        fdName: entry.fdName,
        rowCount: 0,
        productCount: 0,
        productSkus: new Set<string>(),
        siUnits: 0,
        soUnits: 0
      };

    current.rowCount += 1;
    current.productSkus.add(entry.productSku);
    current.productCount = current.productSkus.size;
    current.siUnits += entry.siUnits;
    current.soUnits += entry.soUnits;
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

function approvalEmailPlainTextBody(payload: BusinessPlanApprovalEmailPayload) {
  return [
    payload.summary,
    "",
    `Approval Ref: ${payload.reference}`,
    `Year: ${payload.planYear}`,
    `Market: ${payload.countryCodes.join(", ")}`,
    `Submitted by: ${payload.submittedByEmails.join(", ") || "-"}`,
    `First approval by: ${payload.firstApprovedByEmails.join(", ") || "-"}`,
    `Final approval by: ${payload.approvedByEmail ?? "-"}`,
    `Submitted at: ${payload.submittedAt ?? "-"}`,
    `First approved at: ${payload.firstApprovedAt ?? "-"}`,
    `Final approved at: ${payload.finalApprovedAt ?? "-"}`,
    ...(payload.attachmentNotice ? ["", payload.attachmentNotice] : []),
    "",
    ...approvalChannelSummaryLines(payload.channelSummaries)
  ].join("\n");
}

function approvalEmailHtmlBody(payload: BusinessPlanApprovalEmailPayload) {
  return [
    "<!doctype html>",
    "<html><body>",
    `<p>${escapeHtmlText(payload.summary)}</p>`,
    "<table cellpadding=\"6\" cellspacing=\"0\" border=\"1\">",
    htmlRow("Approval Ref", payload.reference),
    htmlRow("Year", String(payload.planYear)),
    htmlRow("Market", payload.countryCodes.join(", ")),
    htmlRow("Submitted by", payload.submittedByEmails.join(", ") || "-"),
    htmlRow("First approval by", payload.firstApprovedByEmails.join(", ") || "-"),
    htmlRow("Final approval by", payload.approvedByEmail ?? "-"),
    htmlRow("Submitted at", payload.submittedAt ?? "-"),
    htmlRow("First approved at", payload.firstApprovedAt ?? "-"),
    htmlRow("Final approved at", payload.finalApprovedAt ?? "-"),
    "</table>",
    ...(payload.attachmentNotice
      ? [`<p><strong>${escapeHtmlText(payload.attachmentNotice)}</strong></p>`]
      : []),
    "<h3>Channel Summary</h3>",
    approvalChannelSummaryHtml(payload.channelSummaries),
    "</body></html>"
  ].join("");
}

function approvalChannelSummaryLines(
  summaries: BusinessPlanApprovalEmailChannelSummary[]
) {
  if (summaries.length === 0) {
    return ["Channel summary", "-"];
  }

  return [
    "Market | Channel | FD | Rows | Products | SI Units | SO Units",
    ...summaries.map((summary) =>
      [
        summary.countryCode,
        summary.retailerName,
        summary.fdName,
        summary.rowCount,
        summary.productCount,
        summary.siUnits,
        summary.soUnits
      ].join(" | ")
    )
  ];
}

function approvalChannelSummaryHtml(
  summaries: BusinessPlanApprovalEmailChannelSummary[]
) {
  if (summaries.length === 0) {
    return "<p>-</p>";
  }

  return [
    "<table cellpadding=\"6\" cellspacing=\"0\" border=\"1\">",
    "<thead><tr><th>Market</th><th>Channel</th><th>FD</th><th>Rows</th><th>Products</th><th>SI Units</th><th>SO Units</th></tr></thead><tbody>",
    ...summaries.map(
      (summary) =>
        `<tr><td>${escapeHtmlText(summary.countryCode)}</td><td>${escapeHtmlText(
          summary.retailerName
        )}</td><td>${escapeHtmlText(summary.fdName)}</td><td>${summary.rowCount}</td><td>${summary.productCount}</td><td>${summary.siUnits}</td><td>${summary.soUnits}</td></tr>`
    ),
    "</tbody></table>"
  ].join("");
}

function htmlRow(label: string, value: string) {
  return `<tr><th align="left">${escapeHtmlText(label)}</th><td>${escapeHtmlText(
    value
  )}</td></tr>`;
}

function approvalDatesFromStatuses(statuses: BusinessPlanYearStatusOption[]) {
  return {
    submittedAt: earliestIsoDate(statuses.map((status) => status.submittedAt)),
    firstApprovedAt: earliestIsoDate(
      statuses.map((status) => status.firstApprovedAt)
    ),
    finalApprovedAt: latestIsoDate(statuses.map((status) => status.approvedAt))
  };
}

function earliestIsoDate(values: Array<string | null>) {
  return sortedIsoDates(values)[0] ?? null;
}

function latestIsoDate(values: Array<string | null>) {
  return sortedIsoDates(values).at(-1) ?? null;
}

function sortedIsoDates(values: Array<string | null>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
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

function archiveDownloadUrl(archiveId: string | null) {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (!appUrl || !archiveId) {
    return null;
  }
  return `${appUrl}/api/promotion-plan/archives/${encodeURIComponent(
    archiveId
  )}/download`;
}

function approvalEmailFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `SES BP approval email failed: ${error.message}`;
  }
  return "SES BP approval email failed.";
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

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function escapeMimeFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

function wrapBase64(value: string) {
  return value.replace(/.{1,76}/g, "$&\r\n").trim();
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

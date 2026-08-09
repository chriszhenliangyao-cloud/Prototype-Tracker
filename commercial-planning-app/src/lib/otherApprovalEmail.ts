import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { prisma } from "@/lib/prisma";
import type { OtherApprovalRequestOption } from "@/lib/types";
import {
  buildOtherApprovalReference,
  withApprovalReferenceFileName
} from "./approvalReference";
import { formatEuropeanDateTime } from "./format";
import { displayOtherApprovalFeeType } from "./otherApprovalLabels";

const EMAIL_PROVIDER = "SES";
const GLOBAL_RECIPIENT_COUNTRY_CODE = "GLOBAL";
const MAX_SEND_ATTEMPTS = 3;

let sesClient: SESv2Client | null = null;

export type OtherApprovalEmailDelivery =
  | { status: "SENT"; messageId: string | null }
  | { status: "FAILED" | "NOT_CONFIGURED"; errorMessage: string };

export async function sendOtherApprovalApprovedEmail({
  request
}: {
  request: OtherApprovalRequestOption;
}): Promise<OtherApprovalEmailDelivery> {
  const fromEmail = approvalEmailFrom();
  if (!fromEmail) {
    return {
      status: "NOT_CONFIGURED",
      errorMessage: "Approval email sender is not configured."
    };
  }

  const recipients = await resolveOtherApprovalRecipients(request);
  if (recipients.toEmails.length === 0 && recipients.ccEmails.length === 0) {
    return {
      status: "FAILED",
      errorMessage: "Other approval email has no recipients."
    };
  }

  const attachmentRecords = await prisma.otherApprovalAttachment.findMany({
    where: { requestId: request.id },
    orderBy: { createdAt: "asc" }
  });
  const payload = buildOtherApprovalEmailPayload({
    request,
    toEmails: recipients.toEmails,
    ccEmails: recipients.ccEmails,
    attachments: attachmentRecords.map((attachment) => ({
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      fileBase64: Buffer.from(attachment.fileBytes).toString("base64")
    }))
  });

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      const replyToEmail = approvalEmailReplyTo(request.approvedByEmail);
      const rawEmail = buildOtherApprovalRawEmail({
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
      return { status: "SENT", messageId: response.MessageId ?? null };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_SEND_ATTEMPTS) {
        await wait(300 * attempt);
      }
    }
  }

  console.error("Failed to send other approval email", lastError);
  return {
    status: "FAILED",
    errorMessage:
      lastError instanceof Error && lastError.message
        ? `${EMAIL_PROVIDER} other approval email failed: ${lastError.message}`
        : `${EMAIL_PROVIDER} other approval email failed.`
  };
}

export async function sendOtherApprovalWorkflowEmail({
  actorEmail,
  eventLabel,
  note,
  request
}: {
  actorEmail: string | null;
  eventLabel: string;
  note?: string | null;
  request: OtherApprovalRequestOption;
}): Promise<OtherApprovalEmailDelivery> {
  const fromEmail = approvalEmailFrom();
  const recipient = request.submittedByEmail || request.createdByEmail;
  if (!fromEmail) {
    return {
      status: "NOT_CONFIGURED",
      errorMessage: "Approval email sender is not configured."
    };
  }
  if (!recipient) {
    return {
      status: "NOT_CONFIGURED",
      errorMessage: "Request creator email is not available."
    };
  }

  const subject = `${eventLabel} · Other Approval · ${request.countryCode} · ${request.title}`;
  const body = [
    `Other Approval: ${request.title}`,
    `Market: ${countryMarketLabel(request.countryCode)}`,
    `Channel: ${request.channelName || "-"}`,
    `Fee type: ${displayOtherApprovalFeeType(request.feeType)}`,
    `Status: ${eventLabel}`,
    `Updated by: ${actorEmail ?? "System"}`,
    ...(note?.trim() ? ["", `Note: ${note.trim()}`] : []),
    "",
    "Open the request in the system:",
    approvalSystemUrl(request.id)
  ].join("\n");

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      const response = await getSesClient().send(
        new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: { ToAddresses: [recipient] },
          ReplyToAddresses: actorEmail ? [actorEmail] : undefined,
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: { Text: { Data: body, Charset: "UTF-8" } }
            }
          }
        })
      );
      return { status: "SENT", messageId: response.MessageId ?? null };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_SEND_ATTEMPTS) await wait(300 * attempt);
    }
  }

  return {
    status: "FAILED",
    errorMessage:
      lastError instanceof Error && lastError.message
        ? `${EMAIL_PROVIDER} other approval workflow email failed: ${lastError.message}`
        : `${EMAIL_PROVIDER} other approval workflow email failed.`
  };
}

async function resolveOtherApprovalRecipients(request: OtherApprovalRequestOption) {
  const countryCode = request.countryCode.toUpperCase();
  const configuredRecipients = (
    await Promise.all([
      prisma.promotionPlanEmailRecipient.findMany({
        where: {
          status: "ACTIVE",
          countryCode: { in: [GLOBAL_RECIPIENT_COUNTRY_CODE, countryCode] }
        }
      }),
      prisma.userCountryAccess.findMany({
        where: {
          status: "ACTIVE",
          receivesPromotionPlanEmail: true,
          countryCode: { in: [GLOBAL_RECIPIENT_COUNTRY_CODE, countryCode] }
        }
      })
    ])
  ).flat();
  const toEmails = uniqueEmails([
    request.submittedByEmail,
    request.approvedByEmail
  ]);
  const toSet = new Set(toEmails.map(normalizeEmail));
  const ccEmails = uniqueEmails(
    configuredRecipients.map((recipient) => recipient.email)
  ).filter((email) => !toSet.has(normalizeEmail(email)));

  return { toEmails, ccEmails };
}

function buildOtherApprovalEmailPayload({
  request,
  toEmails,
  ccEmails,
  attachments
}: {
  request: OtherApprovalRequestOption;
  toEmails: string[];
  ccEmails: string[];
  attachments: Array<{
    fileName: string;
    contentType: string;
    fileBase64: string;
  }>;
}) {
  const reference = buildOtherApprovalReference({
    countryCode: request.countryCode,
    requestId: request.id
  });
  const feeTypeLabel = displayOtherApprovalFeeType(request.feeType);
  return {
    event: "OTHER_APPROVAL_APPROVED" as const,
    reference,
    countryCode: request.countryCode,
    market: countryMarketLabel(request.countryCode),
    title: request.title,
    channelName: request.channelName,
    feeType: feeTypeLabel,
    description: request.description,
    tableData: request.tableData,
    submittedByEmail: request.submittedByEmail,
    submittedAt: request.submittedAt,
    firstApprovedByEmail: request.firstApprovedByEmail,
    firstApprovedAt: request.firstApprovedAt,
    finalApprovedByEmail: request.approvedByEmail,
    finalApprovedAt: request.approvedAt,
    toEmails,
    ccEmails,
    subject: `Other Approval Approved · ${countryMarketLabel(request.countryCode)} · ${feeTypeLabel} · Approval Ref ${reference}`,
    summary: `Other approval "${request.title}" has been final approved for ${countryMarketLabel(request.countryCode)}.`,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      fileName: withApprovalReferenceFileName(attachment.fileName, reference)
    }))
  };
}

function buildOtherApprovalRawEmail({
  payload,
  fromEmail,
  replyToEmail
}: {
  payload: ReturnType<typeof buildOtherApprovalEmailPayload>;
  fromEmail: string;
  replyToEmail?: string | null;
}) {
  const boundary = `value-chain-other-approval-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const alternativeBoundary = `${boundary}-body`;
  const replyTo = replyToEmail?.trim();
  const textBody = otherApprovalPlainTextBody(payload);
  const htmlBody = otherApprovalHtmlBody(payload);
  const headers = [
    `From: ${fromEmail}`,
    ...(payload.toEmails.length > 0 ? [`To: ${payload.toEmails.join(", ")}`] : []),
    ...(payload.ccEmails.length > 0 ? [`Cc: ${payload.ccEmails.join(", ")}`] : []),
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeMimeHeader(payload.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];
  const attachmentParts = payload.attachments.flatMap((attachment) => [
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${escapeMimeFileName(
      attachment.fileName
    )}"`,
    `Content-Disposition: attachment; filename="${escapeMimeFileName(
      attachment.fileName
    )}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(attachment.fileBase64),
    ""
  ]);

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
    ...attachmentParts,
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

function otherApprovalPlainTextBody(
  payload: ReturnType<typeof buildOtherApprovalEmailPayload>
) {
  return [
    payload.summary,
    "",
    `Approval Ref: ${payload.reference}`,
    `Market: ${payload.market}`,
    `Channel: ${payload.channelName || "-"}`,
    `Fee type: ${payload.feeType}`,
    `Submitted by: ${payload.submittedByEmail ?? "-"}`,
    `Submitted at: ${formatEmailDateTime(payload.submittedAt)}`,
    `First approval by: ${payload.firstApprovedByEmail ?? "-"}`,
    `First approval at: ${formatEmailDateTime(payload.firstApprovedAt)}`,
    `Final approval by: ${payload.finalApprovedByEmail ?? "-"}`,
    `Final approval at: ${formatEmailDateTime(payload.finalApprovedAt)}`,
    "",
    "Description",
    payload.description || "-",
    "",
    "Approval table",
    payload.tableData || "-",
    "",
    "Attached files, if any, are approval evidence."
  ].join("\r\n");
}

function otherApprovalHtmlBody(
  payload: ReturnType<typeof buildOtherApprovalEmailPayload>
) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<style>",
    "body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.45;}",
    "table{border-collapse:collapse;width:100%;max-width:860px;margin:12px 0 24px 0;font-size:13px;}",
    "th,td{border:1px solid #d8e0ec;padding:8px 10px;text-align:left;vertical-align:top;}",
    "th{background:#eef4fb;color:#334155;font-weight:700;width:180px;}",
    "pre{white-space:pre-wrap;border:1px solid #d8e0ec;background:#f8fafc;padding:12px;max-width:860px;}",
    ".section-title{font-size:16px;font-weight:700;margin-top:22px;margin-bottom:8px;}",
    ".muted{color:#64748b;}",
    "</style>",
    "</head>",
    "<body>",
    `<p>${escapeHtml(payload.summary)}</p>`,
    '<div class="section-title">Approval details</div>',
    "<table><tbody>",
    htmlRow("Approval Ref", payload.reference),
    htmlRow("Market", payload.market),
    htmlRow("Channel", payload.channelName || "-"),
    htmlRow("Fee type", payload.feeType),
    htmlRow("Submitted by", payload.submittedByEmail ?? "-"),
    htmlRow("Submitted at", formatEmailDateTime(payload.submittedAt)),
    htmlRow("First approval by", payload.firstApprovedByEmail ?? "-"),
    htmlRow("First approval at", formatEmailDateTime(payload.firstApprovedAt)),
    htmlRow("Final approval by", payload.finalApprovedByEmail ?? "-"),
    htmlRow("Final approval at", formatEmailDateTime(payload.finalApprovedAt)),
    "</tbody></table>",
    '<div class="section-title">Description</div>',
    `<pre>${escapeHtml(payload.description || "-")}</pre>`,
    '<div class="section-title">Approval table</div>',
    `<pre>${escapeHtml(payload.tableData || "-")}</pre>`,
    '<p class="muted">Attached files, if any, are approval evidence.</p>',
    "</body>",
    "</html>"
  ].join("\r\n");
}

function htmlRow(label: string, value: string) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function approvalEmailFrom() {
  return process.env.PROMOTION_PLAN_APPROVAL_EMAIL_FROM?.trim();
}

function approvalSystemUrl(requestId: string) {
  const appUrl =
    process.env.APP_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3010";
  const params = new URLSearchParams({
    workspace: "other-approvals",
    requestId
  });
  return `${appUrl}/platform/collaboration/other-approvals?${params.toString()}`;
}

function approvalEmailReplyTo(approvedByEmail: string | null) {
  return (
    process.env.PROMOTION_PLAN_APPROVAL_EMAIL_REPLY_TO?.trim() ||
    approvedByEmail?.trim() ||
    null
  );
}

function getSesClient() {
  if (!sesClient) {
    sesClient = new SESv2Client({});
  }
  return sesClient;
}

function formatEmailDateTime(value: string | null | undefined) {
  return value ? formatEuropeanDateTime(value) : "-";
}

function countryMarketLabel(countryCode: string) {
  const normalizedCode = countryCode.toUpperCase();
  const countryName = COUNTRY_MARKET_NAMES[normalizedCode];
  return countryName ? `${normalizedCode} ${countryName}` : normalizedCode;
}

function uniqueEmails(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const value of values) {
    const email = String(value ?? "").trim();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || seen.has(normalizedEmail)) continue;
    seen.add(normalizedEmail);
    emails.push(email);
  }

  return emails;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

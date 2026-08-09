import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { prisma } from "./prisma";

const EMAIL_PROVIDER = "SES";
const GLOBAL_COUNTRY_CODE = "GLOBAL";
const REMINDER_DELAY_HOURS = 24;
const MAX_SEND_ATTEMPTS = 3;

let sesClient: SESv2Client | null = null;

export type ApprovalNotificationRequestType =
  | "PROMOTION_PLAN"
  | "BUSINESS_PLAN"
  | "OTHER_APPROVAL";

export type ApprovalNotificationStage = "FIRST_APPROVAL" | "FINAL_APPROVAL";

export type ApprovalRequiredNotificationResult =
  | {
      status: "SENT";
      id: string;
      messageId: string | null;
      toEmails: string[];
      ccEmails: string[];
    }
  | {
      status: "FAILED" | "NOT_CONFIGURED";
      id?: string | null;
      errorMessage: string;
      toEmails: string[];
      ccEmails: string[];
    };

export async function sendApprovalRequiredNotification({
  actionUrl,
  countryCodes,
  createdByEmail,
  requestId,
  requestType,
  planMonth,
  planYear,
  stage,
  subject,
  summaryLines,
  event = "APPROVAL_REQUIRED",
  messageTitle
}: {
  actionUrl: string;
  countryCodes: string[];
  createdByEmail: string | null;
  requestId?: string | null;
  requestType: ApprovalNotificationRequestType;
  planYear?: number | null;
  planMonth?: number | null;
  stage: ApprovalNotificationStage;
  subject: string;
  summaryLines: string[];
  event?: string;
  messageTitle?: string;
}): Promise<ApprovalRequiredNotificationResult> {
  try {
    return await sendApprovalRequiredNotificationUnsafe({
      actionUrl,
      countryCodes,
      createdByEmail,
      requestId,
      requestType,
      planMonth,
      planYear,
      stage,
      subject,
      summaryLines,
      event,
      messageTitle
    });
  } catch (error) {
    console.error("Failed to create approval notification", error);
    return {
      status: "FAILED",
      id: null,
      errorMessage:
        error instanceof Error && error.message
          ? `${EMAIL_PROVIDER} approval notification failed: ${error.message}`
          : `${EMAIL_PROVIDER} approval notification failed.`,
      toEmails: [],
      ccEmails: []
    };
  }
}

async function sendApprovalRequiredNotificationUnsafe({
  actionUrl,
  countryCodes,
  createdByEmail,
  requestId,
  requestType,
  planMonth,
  planYear,
  stage,
  subject,
  summaryLines,
  event,
  messageTitle
}: {
  actionUrl: string;
  countryCodes: string[];
  createdByEmail: string | null;
  requestId?: string | null;
  requestType: ApprovalNotificationRequestType;
  planYear?: number | null;
  planMonth?: number | null;
  stage: ApprovalNotificationStage;
  subject: string;
  summaryLines: string[];
  event: string;
  messageTitle?: string;
}): Promise<ApprovalRequiredNotificationResult> {
  const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
  const recipients = await resolveApprovalNotificationRecipients({
    countryCodes: normalizedCountryCodes,
    excludeEmail: createdByEmail,
    stage
  });
  const now = new Date();
  const remindAfterAt = new Date(
    now.getTime() + REMINDER_DELAY_HOURS * 60 * 60 * 1000
  );
  const notification = await prisma.approvalNotification.create({
    data: {
      requestType,
      requestId: requestId ?? null,
      planYear: planYear ?? null,
      planMonth: planMonth ?? null,
      countryCodes: normalizedCountryCodes.join(","),
      stage,
      event,
      toEmails: recipients.toEmails.join(","),
      ccEmails: recipients.ccEmails.join(","),
      status: "PENDING",
      createdByEmail,
      remindAfterAt,
      updatedAt: now
    }
  });

  if (recipients.toEmails.length === 0) {
    const errorMessage = `${stageLabel(stage)} approver email is not configured.`;
    await prisma.approvalNotification.update({
      where: { id: notification.id },
      data: {
        status: "NOT_CONFIGURED",
        errorMessage,
        lastAttemptAt: now
      }
    });
    return {
      status: "NOT_CONFIGURED",
      id: notification.id,
      errorMessage,
      toEmails: recipients.toEmails,
      ccEmails: recipients.ccEmails
    };
  }

  const fromEmail = approvalEmailFrom();
  if (!fromEmail) {
    const errorMessage = "Approval email sender is not configured.";
    await prisma.approvalNotification.update({
      where: { id: notification.id },
      data: {
        status: "NOT_CONFIGURED",
        errorMessage,
        lastAttemptAt: now
      }
    });
    return {
      status: "NOT_CONFIGURED",
      id: notification.id,
      errorMessage,
      toEmails: recipients.toEmails,
      ccEmails: recipients.ccEmails
    };
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    const attemptAt = new Date();
    try {
      const response = await getSesClient().send(
        new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: {
            ToAddresses: recipients.toEmails,
            CcAddresses: recipients.ccEmails
          },
          ReplyToAddresses: createdByEmail ? [createdByEmail] : undefined,
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: {
                Text: {
                  Data: approvalNotificationPlainText({
                    actionUrl,
                    stage,
                    summaryLines,
                    messageTitle
                  }),
                  Charset: "UTF-8"
                },
                Html: {
                  Data: approvalNotificationHtml({
                    actionUrl,
                    stage,
                    summaryLines,
                    messageTitle
                  }),
                  Charset: "UTF-8"
                }
              }
            }
          }
        })
      );
      await prisma.approvalNotification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          attemptCount: attempt,
          lastAttemptAt: attemptAt,
          messageId: response.MessageId ?? null,
          sentAt: new Date()
        }
      });
      return {
        status: "SENT",
        id: notification.id,
        messageId: response.MessageId ?? null,
        toEmails: recipients.toEmails,
        ccEmails: recipients.ccEmails
      };
    } catch (error) {
      lastError = error;
      await prisma.approvalNotification.update({
        where: { id: notification.id },
        data: {
          attemptCount: attempt,
          lastAttemptAt: attemptAt,
          errorMessage:
            error instanceof Error && error.message
              ? error.message
              : "Approval notification send failed."
        }
      });
      if (attempt < MAX_SEND_ATTEMPTS) {
        await wait(300 * attempt);
      }
    }
  }

  const errorMessage =
    lastError instanceof Error && lastError.message
      ? `${EMAIL_PROVIDER} approval notification failed: ${lastError.message}`
      : `${EMAIL_PROVIDER} approval notification failed.`;
  await prisma.approvalNotification.update({
    where: { id: notification.id },
    data: {
      status: "FAILED",
      errorMessage
    }
  });

  return {
    status: "FAILED",
    id: notification.id,
    errorMessage,
    toEmails: recipients.toEmails,
    ccEmails: recipients.ccEmails
  };
}

async function resolveApprovalNotificationRecipients({
  countryCodes,
  excludeEmail,
  stage
}: {
  countryCodes: string[];
  excludeEmail: string | null;
  stage: ApprovalNotificationStage;
}) {
  const approvalRole =
    stage === "FIRST_APPROVAL" ? "FIRST_APPROVER" : "FINAL_APPROVER";
  const scopedCountryCodes = [
    GLOBAL_COUNTRY_CODE,
    ...countryCodes.map((code) => code.toUpperCase())
  ];
  const rows = await prisma.userCountryAccess.findMany({
    where: {
      status: "ACTIVE",
      approvalRole,
      countryCode: { in: scopedCountryCodes }
    }
  });
  const exclude = normalizeEmail(excludeEmail);
  const databaseEmails = uniqueEmails(rows.map((row) => row.email)).filter(
    (email) => normalizeEmail(email) !== exclude
  );

  if (databaseEmails.length > 0) {
    return { toEmails: databaseEmails, ccEmails: [] };
  }

  const fallbackEmails = uniqueEmails(
    parseEnvEmailList(
      stage === "FIRST_APPROVAL"
        ? process.env.PROMOTION_PLAN_FIRST_APPROVER_EMAILS
        : process.env.PROMOTION_PLAN_FINAL_APPROVER_EMAILS
    )
  ).filter((email) => normalizeEmail(email) !== exclude);

  return { toEmails: fallbackEmails, ccEmails: [] };
}

function approvalNotificationPlainText({
  actionUrl,
  stage,
  summaryLines,
  messageTitle
}: {
  actionUrl: string;
  stage: ApprovalNotificationStage;
  summaryLines: string[];
  messageTitle?: string;
}) {
  return [
    messageTitle ?? `${stageLabel(stage)} is required.`,
    "",
    ...summaryLines,
    "",
    "Open the request in the system:",
    actionUrl
  ].join("\n");
}

function approvalNotificationHtml({
  actionUrl,
  stage,
  summaryLines,
  messageTitle
}: {
  actionUrl: string;
  stage: ApprovalNotificationStage;
  summaryLines: string[];
  messageTitle?: string;
}) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<body style=\"font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.45;\">",
    `<p><strong>${escapeHtml(messageTitle ?? `${stageLabel(stage)} is required.`)}</strong></p>`,
    "<ul>",
    ...summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    `<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:10px 14px;border-radius:6px;background:#020617;color:#ffffff;text-decoration:none;font-weight:700;">Open in system</a></p>`,
    `<p style="color:#64748b;">${escapeHtml(actionUrl)}</p>`,
    "</body>",
    "</html>"
  ].join("\n");
}

function approvalEmailFrom() {
  return process.env.PROMOTION_PLAN_APPROVAL_EMAIL_FROM?.trim();
}

function getAppUrl() {
  return (
    process.env.APP_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3010"
  );
}

export function approvalSystemUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppUrl()}${normalizedPath}`;
}

function getSesClient() {
  if (!sesClient) {
    sesClient = new SESv2Client({});
  }
  return sesClient;
}

function normalizeCountryCodes(countryCodes: string[]) {
  return uniqueStrings(
    countryCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)
  ).sort();
}

function parseEnvEmailList(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueEmails(values: string[]) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const value of values) {
    const email = value.trim();
    const normalized = normalizeEmail(email);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(email);
  }
  return emails;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function stageLabel(stage: ApprovalNotificationStage) {
  return stage === "FIRST_APPROVAL" ? "First approval" : "Final approval";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

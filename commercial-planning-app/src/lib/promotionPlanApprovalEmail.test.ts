import { describe, expect, test } from "vitest";
import {
  buildPromotionPlanApprovalEmailPayload,
  buildPromotionPlanApprovalRawEmail,
  resolvePromotionPlanApprovalEmailRecipients
} from "./promotionPlanApprovalEmail";
import type {
  PromotionPlanEmailRecipientOption,
  PromotionPlanEntryOption,
  PromotionPlanMonthStatusOption
} from "./types";

describe("promotion plan approval email", () => {
  test("builds an approval payload without Drive or archive links", () => {
    const payload = buildPromotionPlanApprovalEmailPayload({
      archiveId: "archive-1",
      fileName: "promotion-plan-2026-06.xlsx",
      workbook: Buffer.from("xlsx-bytes"),
      month: { year: 2026, month: 6 },
      countryCodes: ["FR", "ES"],
      approvedByEmail: "approver@example.com",
      submittedByEmails: ["submitter@example.com"],
      toEmails: ["submitter@example.com", "approver@example.com"],
      ccEmails: ["team@example.com"]
    });

    expect(payload).toMatchObject({
      event: "PROMOTION_PLAN_APPROVED",
      archiveId: "archive-1",
      planYear: 2026,
      planMonth: 6,
      countryCodes: ["FR", "ES"],
      toEmails: ["submitter@example.com", "approver@example.com"],
      ccEmails: ["team@example.com"],
      attachment: {
        fileName: "PP-2026-06-FR-ES-promotion-plan-2026-06.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileBase64: Buffer.from("xlsx-bytes").toString("base64")
      }
    });

    const serializedPayload = JSON.stringify(payload).toLowerCase();
    expect(serializedPayload).not.toContain("driveurl");
    expect(serializedPayload).not.toContain("drivefileid");
    expect(serializedPayload).not.toContain("drivelink");
    expect(serializedPayload).not.toContain("archiveurl");
    expect(serializedPayload).not.toContain("archivedownloadurl");
    expect(serializedPayload).not.toContain("downloadurl");
  });

  test("uses market, reference, and final approval stage in the email subject", () => {
    const payload = buildPromotionPlanApprovalEmailPayload({
      archiveId: "archive-1",
      fileName: "promotion-plan-2026-10-approved-ES.xlsx",
      workbook: Buffer.from("xlsx-bytes"),
      month: { year: 2026, month: 10 },
      countryCodes: ["ES"],
      approvedByEmail: "final.approver@example.com",
      submittedByEmails: ["submitter@example.com"],
      toEmails: ["submitter@example.com", "final.approver@example.com"],
      ccEmails: []
    });

    expect(payload.subject).toBe(
      "Promotion Plan Approved · ES Spain · 2026-10 · Final Approval · Approval Ref PP-2026-10-ES"
    );
    expect(payload.summary).toContain("Approval Ref: PP-2026-10-ES");
    expect(payload.summary).toContain("Market: ES Spain");
  });

  test("builds a SES raw email with attachment and no archive links", () => {
    const payload = buildPromotionPlanApprovalEmailPayload({
      archiveId: "archive-1",
      fileName: "promotion-plan-2026-06-approved-ES.xlsx",
      workbook: Buffer.from("xlsx-bytes"),
      month: { year: 2026, month: 6 },
      countryCodes: ["ES"],
      approvedByEmail: "approver@example.com",
      submittedByEmails: ["submitter@example.com"],
      toEmails: ["submitter@example.com", "approver@example.com"],
      ccEmails: ["team@example.com"]
    });
    const rawEmail = buildPromotionPlanApprovalRawEmail({
      payload,
      fromEmail: "no-reply@julioagents.org",
      replyToEmail: "approver@example.com"
    });

    expect(rawEmail).toContain("From: no-reply@julioagents.org");
    expect(rawEmail).toContain("To: submitter@example.com, approver@example.com");
    expect(rawEmail).toContain("Cc: team@example.com");
    expect(rawEmail).toContain("Reply-To: approver@example.com");
    expect(rawEmail).toContain("\r\n\r\n--value-chain-approval-");
    expect(
      rawEmail
        .split("\r\n\r\n")[0]
        .match(/^Content-Type:/gm)
    ).toHaveLength(1);
    expect(rawEmail).toContain(
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="PP-2026-06-ES-promotion-plan-2026-06-approved-ES.xlsx"'
    );
    expect(rawEmail).toContain(
      'Content-Disposition: attachment; filename="PP-2026-06-ES-promotion-plan-2026-06-approved-ES.xlsx"'
    );
    expect(rawEmail).toContain(Buffer.from("xlsx-bytes").toString("base64"));
    expect(rawEmail.toLowerCase()).not.toContain("drive");
    expect(rawEmail.toLowerCase()).not.toContain("archive link");
    expect(rawEmail.toLowerCase()).not.toContain("downloadurl");
  });

  test("renders approval chain and channel rebate summary in the email body", () => {
    const payload = {
      ...buildPromotionPlanApprovalEmailPayload({
        archiveId: "archive-1",
        fileName: "promotion-plan-2026-10-approved-ES.xlsx",
        workbook: Buffer.from("xlsx-bytes"),
        month: { year: 2026, month: 10 },
        countryCodes: ["ES"],
        approvedByEmail: "final.approver@example.com",
        submittedByEmails: ["submitter@example.com"],
        toEmails: ["submitter@example.com", "final.approver@example.com"],
        ccEmails: []
      }),
      submittedAt: "2026-09-20T08:15:00.000Z",
      firstApprovedByEmails: ["first.approver@example.com"],
      firstApprovedAt: "2026-09-21T09:30:00.000Z",
      finalApprovedAt: "2026-09-22T10:45:00.000Z",
      channelSummaries: [
        {
          countryCode: "ES",
          countryLabel: "ES Spain",
          retailerName: "BG",
          fdName: "Linku",
          rowCount: 2,
          productCount: 2,
          currency: "EUR",
          promoRebateTotal: 20,
          marginRebateTotal: 4,
          totalRebate: 24
        }
      ]
    };

    const rawEmail = buildPromotionPlanApprovalRawEmail({
      payload,
      fromEmail: "no-reply@julioagents.org",
      replyToEmail: "final.approver@example.com"
    });

    expect(rawEmail).toContain("Submitted by: submitter@example.com");
    expect(rawEmail).toContain("Submitted at: 20/09/2026");
    expect(rawEmail).toContain("First approval by: first.approver@example.com");
    expect(rawEmail).toContain("First approval at: 21/09/2026");
    expect(rawEmail).toContain("Final approval by: final.approver@example.com");
    expect(rawEmail).toContain("Final approval at: 22/09/2026");
    expect(rawEmail).toContain("Channel summary");
    expect(rawEmail).toContain("Content-Type: text/html");
    expect(rawEmail).toContain("<table");
    expect(rawEmail).toContain("<th>Market</th>");
    expect(rawEmail).toContain("<th>Channel</th>");
    expect(rawEmail).toContain("<th>FD</th>");
    expect(rawEmail).toContain("<th>Promo rebate budget</th>");
    expect(rawEmail).not.toContain("<th>Margin rebate</th>");
    expect(rawEmail).toContain("<td>ES Spain</td>");
    expect(rawEmail).toContain("<td>BG</td>");
    expect(rawEmail).toContain("<td>Linku</td>");
    expect(rawEmail).toContain('<td class="number">EUR 20.00</td>');
    expect(rawEmail).not.toContain('<td class="number">EUR 4.00</td>');
    expect(rawEmail).not.toContain("Margin rebate");
    expect(rawEmail).not.toContain("Total rebate");
  });

  test("sends approval to submitters and approver while CCing global and matching country recipients", () => {
    const recipients = resolvePromotionPlanApprovalEmailRecipients({
      countryCodes: ["FR"],
      approvedByEmail: "approver@example.com",
      statuses: [
        monthStatus({
          countryCode: "FR",
          submittedByEmail: "submitter@example.com"
        })
      ],
      entries: [
        entry({
          countryCode: "FR",
          createdByEmail: "fallback@example.com"
        })
      ],
      configuredRecipients: [
        emailRecipient("team@example.com", "GLOBAL"),
        emailRecipient("fr-lead@example.com", "FR"),
        emailRecipient("es-lead@example.com", "ES"),
        emailRecipient("submitter@example.com", "GLOBAL")
      ]
    });

    expect(recipients.toEmails).toEqual([
      "submitter@example.com",
      "approver@example.com"
    ]);
    expect(recipients.ccEmails).toEqual(["team@example.com", "fr-lead@example.com"]);
  });
});

function emailRecipient(
  email: string,
  countryCode: string
): PromotionPlanEmailRecipientOption {
  return {
    id: `${countryCode}-${email}`,
    email,
    label: null,
    countryCode,
    status: "ACTIVE",
    createdByEmail: "admin@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function monthStatus(
  overrides: Partial<PromotionPlanMonthStatusOption> = {}
): PromotionPlanMonthStatusOption {
  return {
    id: "status-fr-2026-06",
    planYear: 2026,
    planMonth: 6,
    countryCode: "FR",
    status: "SUBMITTED",
    submittedByEmail: null,
    firstApprovedByEmail: null,
    approvedByEmail: null,
    rejectedByEmail: null,
    submittedAt: null,
    firstApprovedAt: null,
    approvedAt: null,
    rejectedAt: null,
    notes: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function entry(
  overrides: Partial<PromotionPlanEntryOption> = {}
): PromotionPlanEntryOption {
  return {
    id: "entry-fr",
    planYear: 2026,
    planMonth: 6,
    countryCode: "FR",
    retailerName: "Boulanger",
    promotionName: null,
    fdName: "BBC",
    incoterms: "DDP",
    category: "Power bank",
    productSku: "P41L-P1",
    productName: "PowerPaw 10K",
    promoRrpLocal: 39.99,
    promoRrpEur: 39.99,
    promoFrontMargin: 0.38,
    dealType: "NORMAL",
    promoFdMargin: null,
    dealNote: null,
    promoVolume: 1200,
    promoStartDate: "2026-06-03",
    promoEndDate: "2026-06-16",
    snapshotCurrency: null,
    snapshotLifecycleStatus: null,
    snapshotRrpLocal: null,
    snapshotRrpEur: null,
    snapshotVatRate: null,
    snapshotBaseFrontMargin: null,
    snapshotKaBuyingMargin: null,
    snapshotKaBackMargin: null,
    snapshotFdMargin: null,
    snapshotTransportCost: null,
    snapshotBomCost: null,
    createdByEmail: "creator@example.com",
    updatedByEmail: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

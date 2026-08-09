import { describe, expect, test } from "vitest";
import {
  buildBusinessPlanApprovalEmailPayload,
  rawBusinessPlanApprovalEmailForSes
} from "./businessPlanApprovalEmail";
import type { BusinessPlanEntryOption, BusinessPlanYearStatusOption } from "./types";

describe("business plan approval email", () => {
  test("omits an oversized BP workbook attachment before sending through SES", () => {
    const payload = buildBusinessPlanApprovalEmailPayload({
      archiveId: "bp-archive-1",
      archiveDownloadUrl:
        "https://value-chain.example.com/api/promotion-plan/archives/bp-archive-1/download",
      approvedByEmail: "owner@example.com",
      ccEmails: ["manager@example.com"],
      countryCodes: ["FR"],
      entries: [entry()],
      fileName: "business-plan-2026-approved-FR.xlsx",
      planYear: 2026,
      statuses: [yearStatus()],
      submittedByEmails: ["ka@example.com"],
      toEmails: ["ka@example.com", "owner@example.com"],
      workbook: Buffer.alloc(31 * 1024 * 1024, "a")
    });

    const rawEmail = rawBusinessPlanApprovalEmailForSes({
      fromEmail: "no-reply@julioagents.org",
      payload,
      replyToEmail: "owner@example.com"
    });

    expect(Buffer.byteLength(rawEmail)).toBeLessThan(40 * 1024 * 1024);
    expect(rawEmail).toContain("The BP workbook is too large to attach");
    expect(rawEmail).toContain(
      "https://value-chain.example.com/api/promotion-plan/archives/bp-archive-1/download"
    );
    expect(rawEmail).not.toContain("Content-Disposition: attachment");
  });
});

function entry(
  overrides: Partial<BusinessPlanEntryOption> = {}
): BusinessPlanEntryOption {
  return {
    id: "bp-entry-fr",
    planYear: 2026,
    planMonth: 1,
    countryCode: "FR",
    retailerName: "Boulanger",
    fdName: "BBC",
    incoterms: "DDP",
    category: "Charger",
    productSku: "CHG-65W-EU",
    productName: "65W Charger",
    promoPriceLocal: 49.99,
    promoDiscountPercent: 0,
    siUnits: 100,
    soUnits: 80,
    createdByEmail: "ka@example.com",
    updatedByEmail: "ka@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function yearStatus(
  overrides: Partial<BusinessPlanYearStatusOption> = {}
): BusinessPlanYearStatusOption {
  return {
    id: "bp-status-fr",
    planYear: 2026,
    countryCode: "FR",
    status: "APPROVED",
    submittedByEmail: "ka@example.com",
    firstApprovedByEmail: "manager@example.com",
    approvedByEmail: "owner@example.com",
    rejectedByEmail: null,
    submittedAt: "2026-07-10T08:00:00.000Z",
    firstApprovedAt: "2026-07-11T08:00:00.000Z",
    approvedAt: "2026-07-12T08:00:00.000Z",
    rejectedAt: null,
    notes: null,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-12T08:00:00.000Z",
    ...overrides
  };
}

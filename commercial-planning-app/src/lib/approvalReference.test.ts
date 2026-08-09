import { describe, expect, test } from "vitest";
import {
  buildOtherApprovalReference,
  buildPromotionPlanApprovalReference,
  extractApprovalReferences,
  withApprovalReferenceFileName
} from "./approvalReference";

describe("approval reference helpers", () => {
  test("builds stable promotion and other approval references", () => {
    expect(
      buildPromotionPlanApprovalReference({
        monthKey: "2026-07",
        countryCodes: ["pl", " ES "]
      })
    ).toBe("PP-2026-07-PL-ES");
    expect(
      buildOtherApprovalReference({
        countryCode: "pl",
        requestId: "abcdef123456"
      })
    ).toBe("OA-PL-ABCDEF12");
  });

  test("extracts approval references from subjects and attachment names", () => {
    expect(
      extractApprovalReferences(
        "Claim for Approval Ref PP-2026-07-PL, attachment OA-PL-ABC12345-claim.xlsx"
      )
    ).toEqual(["PP-2026-07-PL", "OA-PL-ABC12345"]);
  });

  test("prefixes attachment names with the approval reference once", () => {
    expect(withApprovalReferenceFileName("claim.xlsx", "PP-2026-07-PL")).toBe(
      "PP-2026-07-PL-claim.xlsx"
    );
    expect(
      withApprovalReferenceFileName(
        "PP-2026-07-PL-claim.xlsx",
        "PP-2026-07-PL"
      )
    ).toBe("PP-2026-07-PL-claim.xlsx");
  });
});

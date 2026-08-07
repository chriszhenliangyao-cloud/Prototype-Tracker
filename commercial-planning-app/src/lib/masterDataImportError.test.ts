import { describe, expect, test } from "vitest";
import { masterDataImportErrorMessage } from "./masterDataImportError";

describe("masterDataImportErrorMessage", () => {
  test("turns expired Prisma transactions into a safe rollback message", () => {
    const message = masterDataImportErrorMessage(
      new Error("Transaction API error: Transaction not found; old closed transaction")
    );

    expect(message).toContain("fully rolled back");
    expect(message).toContain("No Master Data was changed");
    expect(message).not.toContain("Prisma");
  });

  test("does not expose unexpected database errors", () => {
    const message = masterDataImportErrorMessage(
      new Error("password authentication failed for database user")
    );

    expect(message).toContain("No Master Data was changed");
    expect(message).not.toContain("password");
  });
});

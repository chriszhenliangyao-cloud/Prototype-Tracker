export function masterDataImportErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("transaction not found") ||
    normalized.includes("old closed transaction") ||
    normalized.includes("transaction already closed") ||
    normalized.includes("transaction api error")
  ) {
    return "The database publish transaction expired and was fully rolled back. No Master Data was changed. Refresh the page and retry; contact the platform owner if it happens again.";
  }

  return "The workbook could not be published and the database transaction was rolled back. No Master Data was changed. Refresh the page and retry.";
}

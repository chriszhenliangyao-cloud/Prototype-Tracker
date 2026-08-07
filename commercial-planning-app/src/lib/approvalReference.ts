export function buildPromotionPlanApprovalReference({
  monthKey,
  countryCodes
}: {
  monthKey: string;
  countryCodes: string[];
}) {
  const countries = countryCodes
    .map((countryCode) => countryCode.trim().toUpperCase())
    .filter(Boolean)
    .join("-");
  return `PP-${monthKey}-${countries || "ALL"}`;
}

export function buildBusinessPlanApprovalReference({
  planYear,
  countryCodes
}: {
  planYear: number;
  countryCodes: string[];
}) {
  const countries = countryCodes
    .map((countryCode) => countryCode.trim().toUpperCase())
    .filter(Boolean)
    .join("-");
  return `BP-${planYear}-${countries || "ALL"}`;
}

export function buildOtherApprovalReference({
  countryCode,
  requestId
}: {
  countryCode: string;
  requestId: string;
}) {
  return `OA-${countryCode.trim().toUpperCase()}-${requestId.slice(0, 8).toUpperCase()}`;
}

export function withApprovalReferenceFileName(fileName: string, reference: string) {
  const normalizedReference = normalizeApprovalReference(reference);
  if (!normalizedReference) return fileName;
  if (extractApprovalReferences(fileName).includes(normalizedReference)) {
    return fileName;
  }
  const cleanedFileName = fileName.trim() || "approval-evidence";
  return `${normalizedReference}-${cleanedFileName}`;
}

export function extractApprovalReferences(value: string) {
  const matches = APPROVAL_REFERENCE_PATTERNS.flatMap(
    (pattern) => value.match(pattern) ?? []
  );
  return Array.from(new Set(matches.map(normalizeApprovalReference).filter(Boolean)));
}

export function hasSharedApprovalReference(left: string, right: string) {
  const leftReferences = new Set(extractApprovalReferences(left));
  if (leftReferences.size === 0) return false;
  return extractApprovalReferences(right).some((reference) =>
    leftReferences.has(reference)
  );
}

function normalizeApprovalReference(value: string) {
  return value.trim().replace(/[.,;:)]+$/g, "").toUpperCase();
}

const APPROVAL_REFERENCE_PATTERNS = [
  /\bPP-\d{4}-\d{2}(?:-(?:[A-Z]{2}|ALL))+\b/gi,
  /\bBP-\d{4}(?:-(?:[A-Z]{2}|ALL))+\b/gi,
  /\bOA-[A-Z]{2}-[A-Z0-9]{8}\b/gi,
  /\bAPP-[A-Z0-9]{5,20}\b/gi,
  /\bSETTLE-[A-Z0-9]{5,20}\b/gi
];

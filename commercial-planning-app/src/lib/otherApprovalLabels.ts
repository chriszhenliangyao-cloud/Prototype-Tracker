export const OTHER_APPROVAL_FEE_TYPES = [
  { value: "Samples", label: "FD stock for customer samples" },
  { value: "Special offer", label: "Special offer" },
  { value: "Co-marketing", label: "Co-marketing" },
  { value: "Retail activity", label: "Retail activity" },
  { value: "B2B deal", label: "B2B deal" },
  { value: "EOL deal", label: "EOL deal" },
  { value: "Other", label: "Other" }
] as const;

export function displayOtherApprovalFeeType(
  feeType: string | null | undefined
) {
  const value = feeType?.trim() ?? "";
  if (!value) {
    return "-";
  }

  const option = OTHER_APPROVAL_FEE_TYPES.find(
    (item) =>
      item.value.toLowerCase() === value.toLowerCase() ||
      item.label.toLowerCase() === value.toLowerCase()
  );

  return option?.label ?? value;
}

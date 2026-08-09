export type PromotionPlanPeriodCandidate = {
  scopeKey: string;
  countryCode: string;
  retailerName: string;
  fdName: string;
  productSku: string;
  promotionName?: string | null;
  promoStartDate: string | null | undefined;
  promoEndDate: string | null | undefined;
};

export type PromotionPlanPeriodOverlap = {
  scopeKey: string;
  first: PromotionPlanPeriodCandidate;
  second: PromotionPlanPeriodCandidate;
};

/**
 * Promotion dates are inclusive. Gaps are allowed and simply mean normal price
 * applies between promotion periods.
 */
export function findPromotionPlanPeriodOverlap(
  candidates: PromotionPlanPeriodCandidate[]
): PromotionPlanPeriodOverlap | null {
  const grouped = new Map<string, PromotionPlanPeriodCandidate[]>();

  for (const candidate of candidates) {
    if (!candidate.promoStartDate || !candidate.promoEndDate) {
      continue;
    }
    const group = grouped.get(candidate.scopeKey) ?? [];
    group.push(candidate);
    grouped.set(candidate.scopeKey, group);
  }

  for (const [scopeKey, group] of grouped) {
    const ordered = [...group].sort((left, right) =>
      left.promoStartDate!.localeCompare(right.promoStartDate!) ||
      left.promoEndDate!.localeCompare(right.promoEndDate!)
    );

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (current.promoStartDate! <= previous.promoEndDate!) {
        return { scopeKey, first: previous, second: current };
      }
    }
  }

  return null;
}

export function promotionPlanPeriodOverlapMessage(
  overlap: PromotionPlanPeriodOverlap
) {
  const firstLabel = describePromotionPlanPeriod(overlap.first);
  const secondLabel = describePromotionPlanPeriod(overlap.second);
  return `${overlap.first.countryCode} ${overlap.first.retailerName} ${overlap.first.productSku}: ${firstLabel} overlaps ${secondLabel}.`;
}

function describePromotionPlanPeriod(candidate: PromotionPlanPeriodCandidate) {
  const name = candidate.promotionName?.trim();
  const label = name ? `${name} ` : "";
  return `${label}(${candidate.promoStartDate} to ${candidate.promoEndDate})`;
}

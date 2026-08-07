import type { AppSession } from "@/lib/auth/types";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import {
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import {
  getPromotionPlanApproverCapabilities,
  type PromotionPlanApproverCapabilities
} from "@/lib/promotionPlanApprovalWorkflow";
import type { UserRole } from "@/lib/types";

export async function getOtherApprovalApiAccess(session: AppSession): Promise<{
  accessibleCountryCodes: string[];
  approvalCapabilities: PromotionPlanApproverCapabilities;
  role: UserRole;
}> {
  const [data, countryAccesses] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const role = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    countryAccesses
  );
  const accessibleCountryCodes = getAccessibleCountryCodes(
    role,
    session.email,
    countryAccesses,
    data.countries
  );
  const approvalCapabilities = getPromotionPlanApproverCapabilities({
    role,
    email: session.email,
    accessRows: countryAccesses
  });
  return { accessibleCountryCodes, approvalCapabilities, role };
}

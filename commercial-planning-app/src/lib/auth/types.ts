import type { UserRole } from "@/lib/types";

export type PlatformGovernanceRole = "platform_owner" | "super_admin";

export type AppSession = {
  email: string;
  name: string;
  role: UserRole;
  groups: string[];
  expiresAt: number;
  workspaceId?: string;
  governanceRole?: PlatformGovernanceRole;
  protectedModules?: Record<string, "none" | "view" | "edit" | "manage">;
};

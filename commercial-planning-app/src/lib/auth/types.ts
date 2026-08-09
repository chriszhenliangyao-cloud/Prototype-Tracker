import type { UserRole } from "@/lib/types";

export type AppSession = {
  email: string;
  name: string;
  role: UserRole;
  groups: string[];
  expiresAt: number;
  workspaceId?: string;
  protectedModules?: Record<string, "none" | "view" | "edit" | "manage">;
};

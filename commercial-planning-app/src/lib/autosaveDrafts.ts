export const AUTOSAVE_WORKSPACES = [
  "VALUE_CHAIN",
  "NEW_PRODUCT_FORMAL",
  "QUICK_NEW_PRODUCT",
  "BUSINESS_PLAN",
  "PROMOTION_PLAN",
  "OTHER_APPROVALS",
  "SETTLEMENT"
] as const;

export type AutosaveWorkspace = (typeof AUTOSAVE_WORKSPACES)[number];

export type AutosaveDraftSnapshot = Record<string, unknown>;

export type AutosaveDraftRecord = {
  workspace: AutosaveWorkspace;
  scope: string;
  snapshot: AutosaveDraftSnapshot;
  revision: number;
  updatedAt: string;
  expiresAt: string;
};

export const AUTOSAVE_RETENTION_DAYS = 30;
export const AUTOSAVE_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

export function isAutosaveWorkspace(value: unknown): value is AutosaveWorkspace {
  return typeof value === "string" && AUTOSAVE_WORKSPACES.includes(value as AutosaveWorkspace);
}

export function normalizeAutosaveScope(value: unknown) {
  if (typeof value !== "string") return null;
  const scope = value.trim();
  if (!scope || scope.length > 180) return null;
  return /^[A-Za-z0-9:,_-]+$/.test(scope) ? scope : null;
}

export function isAutosaveSnapshot(value: unknown): value is AutosaveDraftSnapshot {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function expiresAtFrom(now = new Date()) {
  return new Date(now.getTime() + AUTOSAVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function serializeAutosaveSnapshot(snapshot: AutosaveDraftSnapshot) {
  const payload = JSON.stringify(snapshot);
  if (new TextEncoder().encode(payload).byteLength > AUTOSAVE_MAX_PAYLOAD_BYTES) {
    throw new Error("Autosave draft is too large.");
  }
  return payload;
}

export function parseAutosaveSnapshot(payload: string): AutosaveDraftSnapshot | null {
  try {
    const snapshot = JSON.parse(payload) as unknown;
    return isAutosaveSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

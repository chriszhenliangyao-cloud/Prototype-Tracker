import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platformSource = readFileSync(
  new URL("../../public/platform/index.html", import.meta.url),
  "utf8"
);

const migrationSource = readFileSync(
  new URL("../../../supabase/migrations/20260807123000_platform_owner_governance.sql", import.meta.url),
  "utf8"
);

const superAdminControlSource = readFileSync(
  new URL("../../../supabase/migrations/20260807153000_platform_owner_super_admin_control.sql", import.meta.url),
  "utf8"
);

const cloudSyncSource = readFileSync(
  new URL("../../public/cloud-sync.js", import.meta.url),
  "utf8"
);

describe("platform owner governance", () => {
  it("places Platform Owner above Super Admin and protects elevated accounts", () => {
    expect(platformSource.indexOf('{ key: "platform_owner"')).toBeLessThan(
      platformSource.indexOf('{ key: "super_admin"')
    );
    expect(platformSource).toContain("isProtectedPlatformRole");
    expect(platformSource).toContain("只有平台所有者可以修改平台所有者或超级管理员的角色与状态");
    expect(platformSource).toContain("平台必须且只能保留一个启用状态的平台所有者");
  });

  it("scopes project view state and drafts to the signed-in identity", () => {
    expect(platformSource).toContain("projectPersonalStorageKey");
    expect(platformSource).toContain("projectPersonalStorageKey(PROJECT_STORAGE_KEY)");
    expect(platformSource).toContain("projectPersonalStorageKey(PROJECT_DRAFT_STORAGE_KEY)");
    expect(platformSource).toContain("projectPersonalStorageKey(PROJECT_FORM_DRAFT_STORAGE_KEY)");
  });

  it("enforces one owner and protects permission documents in Postgres", () => {
    expect(migrationSource).toContain("workspace_platform_roles_owner_idx");
    expect(migrationSource).toContain("where role = 'platform_owner'");
    expect(migrationSource).toContain("private.is_platform_owner");
    expect(migrationSource).toContain("protected_role_change_requires_owner");
    expect(migrationSource).toContain("p_document_key = 'projectTrackingAccess.v1'");
    expect(migrationSource).toContain("private.has_workspace_role(p_workspace_id, array['admin'])");
  });

  it("lets only the platform owner manage workspace super admins", () => {
    expect(superAdminControlSource).toContain("private.set_workspace_super_admin");
    expect(superAdminControlSource).toContain("platform_owner_permission_required");
    expect(superAdminControlSource).toContain("protected_account_change_requires_owner");
    expect(superAdminControlSource).toContain("requested_role = 'admin'");
    expect(superAdminControlSource).toContain("workspace_account_cannot_move");
    expect(superAdminControlSource).toContain("platform_owner_cannot_be_modified");
    expect(superAdminControlSource).toContain("platform_owner_cannot_be_demoted");
    expect(cloudSyncSource).toContain('supabase.rpc("set_workspace_super_admin"');
    expect(cloudSyncSource).toContain("superAdminManagementAvailable: true");
    expect(platformSource).toContain("canEditPermissionUser");
  });

  it("uses the protected access-document save path for permission changes", () => {
    expect(migrationSource).toContain("protected_role_change_requires_owner");
    expect(cloudSyncSource).toContain('supabase.rpc("save_workspace_document"');
    expect(cloudSyncSource).not.toContain('supabase.rpc("save_workspace_access_configuration"');
  });
});

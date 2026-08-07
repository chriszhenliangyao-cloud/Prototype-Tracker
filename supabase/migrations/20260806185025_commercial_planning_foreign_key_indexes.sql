CREATE INDEX IF NOT EXISTS "app_user_roles_assignedBy_idx"
  ON commercial_planning.app_user_roles("assignedBy");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx"
  ON commercial_planning.audit_logs("userId");
CREATE INDEX IF NOT EXISTS "copy_import_batches_createdBy_idx"
  ON commercial_planning.copy_import_batches("createdBy");
CREATE INDEX IF NOT EXISTS "product_country_rrps_countryId_idx"
  ON commercial_planning.product_country_rrps("countryId");
CREATE INDEX IF NOT EXISTS "scenarios_channelMarginId_idx"
  ON commercial_planning.scenarios("channelMarginId");
CREATE INDEX IF NOT EXISTS "scenarios_createdById_idx"
  ON commercial_planning.scenarios("createdById");
CREATE INDEX IF NOT EXISTS "scenarios_fdMarginId_idx"
  ON commercial_planning.scenarios("fdMarginId");
CREATE INDEX IF NOT EXISTS "scenarios_productId_idx"
  ON commercial_planning.scenarios("productId");

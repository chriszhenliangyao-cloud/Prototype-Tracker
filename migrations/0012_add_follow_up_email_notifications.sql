-- Track Follow Up email state per GTM product so page refreshes and scheduled
-- checks do not send duplicate notifications.
CREATE TABLE IF NOT EXISTS gtm_follow_up_notification (
  product_id TEXT PRIMARY KEY,
  stage_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  notification_sequence INTEGER NOT NULL DEFAULT 0,
  last_notified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES gtm_product(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gtm_follow_up_active
  ON gtm_follow_up_notification(is_active, updated_at);

INSERT OR IGNORE INTO d1_migrations (id, name, applied_at)
VALUES (12, '0012_add_follow_up_email_notifications.sql', CURRENT_TIMESTAMP);

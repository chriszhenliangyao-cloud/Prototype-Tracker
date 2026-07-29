-- GTM-only delay history. Kept fully isolated from ProtoTrack sample tables.
CREATE TABLE IF NOT EXISTS gtm_delay_record (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  task_name TEXT NOT NULL,
  original_deadline TEXT,
  delayed_until TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES gtm_product(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gtm_delay_product ON gtm_delay_record(product_id, original_deadline);

INSERT OR IGNORE INTO gtm_delay_record
  (id, product_id, stage_name, task_name, original_deadline, delayed_until, notes)
VALUES
  ('delay-p1-1','gtm-p61l-p1','Launch','Social Copy & PR Release','2026-07-31',NULL,'PR copy awaiting final approval'),
  ('delay-p1-2','gtm-p61l-p1','Mass Production','POSM','2026-07-28','2026-07-30','Final English version pending'),
  ('delay-p2-1','gtm-p61l-p2','Trial Production Start','Product & Packaging Images & Manual','2026-07-22',NULL,'Product photography rescheduled'),
  ('delay-p2-2','gtm-p61l-p2','Mass Production','Mass Production Sample','2026-07-27','2026-07-30','Sample shipment delayed'),
  ('delay-p51-1','gtm-p51l-p2','Trial Production Start','Preproduction Sample','2026-08-10',NULL,'Waiting for trial production slot'),
  ('delay-pm61-1','gtm-pm61-black','DVT2','Product Sheet','2026-08-17',NULL,'Specification confirmation pending');

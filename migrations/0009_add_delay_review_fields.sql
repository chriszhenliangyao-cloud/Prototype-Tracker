-- Add concise review fields and allow multiple DDL-change records for the same stage.
ALTER TABLE gtm_delay_record ADD COLUMN delay_reason TEXT;
ALTER TABLE gtm_delay_record ADD COLUMN schedule_impact TEXT;

DROP INDEX IF EXISTS idx_gtm_delay_task_history;

CREATE INDEX IF NOT EXISTS idx_gtm_delay_product_created
  ON gtm_delay_record(product_id, created_at, id);

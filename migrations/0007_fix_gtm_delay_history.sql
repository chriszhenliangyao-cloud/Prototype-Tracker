-- Delay records are created only when an incomplete task reaches its stage DDL.
-- Records remain as history after completion. Manual deletion is a soft delete
-- so an overdue task is not recreated by the automatic synchronizer.

ALTER TABLE gtm_delay_record ADD COLUMN deleted_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gtm_delay_task_history
  ON gtm_delay_record(product_id, stage_name, task_name, original_deadline);

-- Remove demo records that were seeded before their DDL. They can be created
-- normally by the synchronizer once their deadline is reached and still open.
DELETE FROM gtm_delay_record
 WHERE original_deadline IS NULL
    OR original_deadline > date('now');

INSERT OR IGNORE INTO gtm_delay_record
  (id, product_id, stage_name, task_name, original_deadline)
SELECT
  'delay-auto-' || t.id,
  t.product_id,
  t.stage_name,
  t.task_name,
  s.deadline
FROM gtm_project_task t
JOIN gtm_project_stage s
  ON s.product_id = t.product_id
 AND s.stage_name = t.stage_name
WHERE t.is_completed = 0
  AND s.deadline IS NOT NULL
  AND s.deadline <= date('now');

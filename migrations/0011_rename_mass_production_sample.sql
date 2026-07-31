UPDATE gtm_project_task
SET task_name = 'Mass Production'
WHERE task_name = 'Mass Production Sample';

UPDATE gtm_project_task
SET prototype_type = 'Mass Production'
WHERE prototype_type = 'Mass Production Sample';

UPDATE gtm_delay_record
SET task_name = 'Mass Production'
WHERE task_name = 'Mass Production Sample';

INSERT OR IGNORE INTO d1_migrations (id, name, applied_at)
VALUES (11, '0011_rename_mass_production_sample.sql', CURRENT_TIMESTAMP);

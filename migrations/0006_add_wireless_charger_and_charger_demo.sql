-- Add two GTM demo projects sourced from the existing SKU master data.
-- Product identity (model, name, category) is selected from sku rather than invented here.

INSERT OR IGNORE INTO gtm_product
  (id, model, name, category, launch_status, planned_launch_date, product_owner, marketing_project_manager)
SELECT 'gtm-wm321', code, name, category, 'UNLAUNCHED', '2026-10-16', 'Ivy', 'Ivy'
FROM sku WHERE code = 'WM321';

INSERT OR IGNORE INTO gtm_product
  (id, model, name, category, launch_status, planned_launch_date, product_owner, marketing_project_manager)
SELECT 'gtm-wal101', code, name, category, 'UNLAUNCHED', '2026-11-06', 'Ivy', 'Ivy'
FROM sku WHERE code = 'WAL101';

INSERT OR IGNORE INTO gtm_project_stage
  (id, product_id, stage_name, deadline, estimated_shipping_date)
VALUES
  ('s-wm321-1','gtm-wm321','Project Confirm to Start','2026-08-03',NULL),
  ('s-wm321-2','gtm-wm321','DVT1','2026-08-17',NULL),
  ('s-wm321-3','gtm-wm321','DVT2','2026-09-01',NULL),
  ('s-wm321-4','gtm-wm321','Trial Production Start','2026-09-15',NULL),
  ('s-wm321-5','gtm-wm321','Mass Production','2026-10-01','2026-10-05'),
  ('s-wm321-6','gtm-wm321','Launch','2026-10-16',NULL),
  ('s-wal101-1','gtm-wal101','Project Confirm to Start','2026-08-10',NULL),
  ('s-wal101-2','gtm-wal101','DVT1','2026-08-24',NULL),
  ('s-wal101-3','gtm-wal101','DVT2','2026-09-10',NULL),
  ('s-wal101-4','gtm-wal101','Trial Production Start','2026-09-28',NULL),
  ('s-wal101-5','gtm-wal101','Mass Production','2026-10-19','2026-10-23'),
  ('s-wal101-6','gtm-wal101','Launch','2026-11-06',NULL);

INSERT OR IGNORE INTO gtm_project_task
  (id, product_id, stage_name, task_name, owner_role, prototype_type, is_completed, sort_order)
VALUES
  ('wm321-t1','gtm-wm321','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('wm321-t2','gtm-wm321','DVT1','Engineering Sample','PRODUCT','Engineering Sample',1,20),
  ('wm321-t3','gtm-wm321','DVT1','Product Introduction Slides','MARKETING',NULL,1,30),
  ('wm321-t4','gtm-wm321','DVT2','Packaging Design Final Draft','MARKETING',NULL,1,40),
  ('wm321-t5','gtm-wm321','DVT2','Product Sheet','PRODUCT',NULL,0,50),
  ('wm321-t6','gtm-wm321','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',0,60),
  ('wm321-t7','gtm-wm321','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,0,70),
  ('wm321-t8','gtm-wm321','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',0,80),
  ('wm321-t9','gtm-wm321','Mass Production','POSM','MARKETING',NULL,0,90),
  ('wm321-t10','gtm-wm321','Launch','Social Copy & PR Release','MARKETING',NULL,0,100),
  ('wal101-t1','gtm-wal101','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('wal101-t2','gtm-wal101','DVT1','Engineering Sample','PRODUCT','Engineering Sample',1,20),
  ('wal101-t3','gtm-wal101','DVT1','Product Introduction Slides','MARKETING',NULL,0,30),
  ('wal101-t4','gtm-wal101','DVT2','Packaging Design Final Draft','MARKETING',NULL,0,40),
  ('wal101-t5','gtm-wal101','DVT2','Product Sheet','PRODUCT',NULL,0,50),
  ('wal101-t6','gtm-wal101','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',0,60),
  ('wal101-t7','gtm-wal101','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,0,70),
  ('wal101-t8','gtm-wal101','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',0,80),
  ('wal101-t9','gtm-wal101','Mass Production','POSM','MARKETING',NULL,0,90),
  ('wal101-t10','gtm-wal101','Launch','Social Copy & PR Release','MARKETING',NULL,0,100);

INSERT OR IGNORE INTO gtm_material_task
  (id, product_id, material_type, status, deadline, owner)
VALUES
  ('m-wm321-1','gtm-wm321','Product Introduction Slides','COMPLETED','2026-08-17','Ivy'),
  ('m-wm321-2','gtm-wm321','Packaging Design Final Draft','COMPLETED','2026-09-01','Ivy'),
  ('m-wm321-3','gtm-wm321','Product Sheet','NOT_COMPLETED','2026-09-01','Product'),
  ('m-wm321-4','gtm-wm321','Product & Packaging Images & Manual','NOT_COMPLETED','2026-09-15','Ivy'),
  ('m-wm321-5','gtm-wm321','POSM','NOT_COMPLETED','2026-10-01','Ivy'),
  ('m-wm321-6','gtm-wm321','Social Copy & PR Release','NOT_COMPLETED','2026-10-16','Ivy'),
  ('m-wal101-1','gtm-wal101','Product Introduction Slides','NOT_COMPLETED','2026-08-24','Ivy'),
  ('m-wal101-2','gtm-wal101','Packaging Design Final Draft','NOT_COMPLETED','2026-09-10','Ivy'),
  ('m-wal101-3','gtm-wal101','Product Sheet','NOT_COMPLETED','2026-09-10','Product'),
  ('m-wal101-4','gtm-wal101','Product & Packaging Images & Manual','NOT_COMPLETED','2026-09-28','Ivy'),
  ('m-wal101-5','gtm-wal101','POSM','NOT_COMPLETED','2026-10-19','Ivy'),
  ('m-wal101-6','gtm-wal101','Social Copy & PR Release','NOT_COMPLETED','2026-11-06','Ivy');

INSERT OR IGNORE INTO gtm_prototype_requirement
  (id, product_id, source_task_id, required_quantity, eta)
VALUES
  ('r-wm321-dummy','gtm-wm321','wm321-t1',2,'2026-08-03'),
  ('r-wm321-es','gtm-wm321','wm321-t2',4,'2026-08-17'),
  ('r-wm321-pps','gtm-wm321','wm321-t6',6,'2026-09-15'),
  ('r-wm321-mp','gtm-wm321','wm321-t8',8,'2026-10-01'),
  ('r-wal101-dummy','gtm-wal101','wal101-t1',2,'2026-08-10'),
  ('r-wal101-es','gtm-wal101','wal101-t2',4,'2026-08-24'),
  ('r-wal101-pps','gtm-wal101','wal101-t6',6,'2026-09-28'),
  ('r-wal101-mp','gtm-wal101','wal101-t8',8,'2026-10-19');

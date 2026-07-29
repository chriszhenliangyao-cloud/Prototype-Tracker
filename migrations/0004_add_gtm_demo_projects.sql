-- Three additional GTM-only demo projects.
-- Product names/models mirror existing SKU master data, but these records are
-- intentionally stored only in gtm_* tables and never modify prototype data.

INSERT OR IGNORE INTO gtm_product
  (id, model, name, category, launch_status, planned_launch_date, product_owner, marketing_project_manager)
VALUES
  ('gtm-p51l-p2', 'P51L-P2', 'Pocket 20K 45W', 'Power Bank', 'UNLAUNCHED', '2026-08-18', 'Ivy', 'Ivy'),
  ('gtm-pm61-black', 'PM61-Black', 'MagPro Slim 10K Qi2.2 - Black', 'Power Bank', 'UNLAUNCHED', '2026-09-05', 'Ivy', 'Ivy'),
  ('gtm-px51', 'PX51', 'MagPro Neo 10K Qi2.0', 'Power Bank', 'UNLAUNCHED', '2026-09-22', 'Ivy', 'Ivy');

INSERT OR IGNORE INTO gtm_project_stage (id, product_id, stage_name, deadline, estimated_shipping_date) VALUES
  ('s-p51-1','gtm-p51l-p2','Project Confirm to Start','2026-07-28',NULL),
  ('s-p51-2','gtm-p51l-p2','DVT1','2026-08-01',NULL),
  ('s-p51-3','gtm-p51l-p2','DVT2','2026-08-06',NULL),
  ('s-p51-4','gtm-p51l-p2','Trial Production Start','2026-08-10',NULL),
  ('s-p51-5','gtm-p51l-p2','Mass Production','2026-08-14','2026-08-16'),
  ('s-p51-6','gtm-p51l-p2','Launch','2026-08-18',NULL),
  ('s-pm61-1','gtm-pm61-black','Project Confirm to Start','2026-08-03',NULL),
  ('s-pm61-2','gtm-pm61-black','DVT1','2026-08-10',NULL),
  ('s-pm61-3','gtm-pm61-black','DVT2','2026-08-17',NULL),
  ('s-pm61-4','gtm-pm61-black','Trial Production Start','2026-08-24',NULL),
  ('s-pm61-5','gtm-pm61-black','Mass Production','2026-08-31','2026-09-02'),
  ('s-pm61-6','gtm-pm61-black','Launch','2026-09-05',NULL),
  ('s-px51-1','gtm-px51','Project Confirm to Start','2026-08-17',NULL),
  ('s-px51-2','gtm-px51','DVT1','2026-08-24',NULL),
  ('s-px51-3','gtm-px51','DVT2','2026-08-31',NULL),
  ('s-px51-4','gtm-px51','Trial Production Start','2026-09-07',NULL),
  ('s-px51-5','gtm-px51','Mass Production','2026-09-15','2026-09-18'),
  ('s-px51-6','gtm-px51','Launch','2026-09-22',NULL);

INSERT OR IGNORE INTO gtm_project_task
  (id, product_id, stage_name, task_name, owner_role, prototype_type, is_completed, sort_order)
VALUES
  ('p51-t1','gtm-p51l-p2','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('p51-t2','gtm-p51l-p2','DVT1','Engineering Sample','PRODUCT','Engineering Sample',1,10),
  ('p51-t3','gtm-p51l-p2','DVT1','Product Introduction Slides','MARKETING',NULL,1,20),
  ('p51-t4','gtm-p51l-p2','DVT2','Packaging Design Final Draft','MARKETING',NULL,1,10),
  ('p51-t5','gtm-p51l-p2','DVT2','Product Sheet','PRODUCT',NULL,1,20),
  ('p51-t6','gtm-p51l-p2','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',0,10),
  ('p51-t7','gtm-p51l-p2','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,0,20),
  ('p51-t8','gtm-p51l-p2','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',0,10),
  ('p51-t9','gtm-p51l-p2','Mass Production','POSM','MARKETING',NULL,0,20),
  ('p51-t10','gtm-p51l-p2','Launch','Social Copy & PR Release','MARKETING',NULL,0,10),
  ('pm61-t1','gtm-pm61-black','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('pm61-t2','gtm-pm61-black','DVT1','Engineering Sample','PRODUCT','Engineering Sample',1,10),
  ('pm61-t3','gtm-pm61-black','DVT1','Product Introduction Slides','MARKETING',NULL,1,20),
  ('pm61-t4','gtm-pm61-black','DVT2','Packaging Design Final Draft','MARKETING',NULL,0,10),
  ('pm61-t5','gtm-pm61-black','DVT2','Product Sheet','PRODUCT',NULL,0,20),
  ('pm61-t6','gtm-pm61-black','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',0,10),
  ('pm61-t7','gtm-pm61-black','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,0,20),
  ('pm61-t8','gtm-pm61-black','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',0,10),
  ('pm61-t9','gtm-pm61-black','Mass Production','POSM','MARKETING',NULL,0,20),
  ('pm61-t10','gtm-pm61-black','Launch','Social Copy & PR Release','MARKETING',NULL,0,10),
  ('px51-t1','gtm-px51','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('px51-t2','gtm-px51','DVT1','Engineering Sample','PRODUCT','Engineering Sample',0,10),
  ('px51-t3','gtm-px51','DVT1','Product Introduction Slides','MARKETING',NULL,0,20),
  ('px51-t4','gtm-px51','DVT2','Packaging Design Final Draft','MARKETING',NULL,0,10),
  ('px51-t5','gtm-px51','DVT2','Product Sheet','PRODUCT',NULL,0,20),
  ('px51-t6','gtm-px51','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',0,10),
  ('px51-t7','gtm-px51','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,0,20),
  ('px51-t8','gtm-px51','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',0,10),
  ('px51-t9','gtm-px51','Mass Production','POSM','MARKETING',NULL,0,20),
  ('px51-t10','gtm-px51','Launch','Social Copy & PR Release','MARKETING',NULL,0,10);

INSERT OR IGNORE INTO gtm_prototype_requirement
  (id, product_id, source_task_id, required_quantity, eta)
VALUES
  ('r-p51-dummy','gtm-p51l-p2','p51-t1',2,'2026-07-28'),
  ('r-p51-es','gtm-p51l-p2','p51-t2',4,'2026-08-01'),
  ('r-p51-pps','gtm-p51l-p2','p51-t6',6,'2026-08-10'),
  ('r-p51-mp','gtm-p51l-p2','p51-t8',8,'2026-08-14'),
  ('r-pm61-dummy','gtm-pm61-black','pm61-t1',2,'2026-08-03'),
  ('r-pm61-es','gtm-pm61-black','pm61-t2',4,'2026-08-10'),
  ('r-pm61-pps','gtm-pm61-black','pm61-t6',6,'2026-08-24'),
  ('r-pm61-mp','gtm-pm61-black','pm61-t8',8,'2026-08-31'),
  ('r-px51-dummy','gtm-px51','px51-t1',2,'2026-08-17'),
  ('r-px51-es','gtm-px51','px51-t2',4,'2026-08-24'),
  ('r-px51-pps','gtm-px51','px51-t6',6,'2026-09-07'),
  ('r-px51-mp','gtm-px51','px51-t8',8,'2026-09-15');

INSERT OR IGNORE INTO gtm_material_task (id, product_id, material_type, status, deadline, owner) VALUES
  ('m-p51-1','gtm-p51l-p2','Product Introduction Slides','COMPLETED','2026-08-01','Ivy'),
  ('m-p51-2','gtm-p51l-p2','Packaging Design Final Draft','COMPLETED','2026-08-06','Ivy'),
  ('m-p51-3','gtm-p51l-p2','Product Sheet','COMPLETED','2026-08-06','Product'),
  ('m-p51-4','gtm-p51l-p2','Product & Packaging Images & Manual','NOT_COMPLETED','2026-08-10','Ivy'),
  ('m-p51-5','gtm-p51l-p2','POSM','NOT_COMPLETED','2026-08-14','Ivy'),
  ('m-p51-6','gtm-p51l-p2','Social Copy & PR Release','NOT_COMPLETED','2026-08-18','Ivy'),
  ('m-p51-7','gtm-p51l-p2','Launch Assets Archive','NOT_REQUIRED',NULL,NULL),
  ('m-pm61-1','gtm-pm61-black','Product Introduction Slides','COMPLETED','2026-08-10','Ivy'),
  ('m-pm61-2','gtm-pm61-black','Packaging Design Final Draft','COMPLETED','2026-08-17','Ivy'),
  ('m-pm61-3','gtm-pm61-black','Product Sheet','NOT_COMPLETED','2026-08-17','Product'),
  ('m-pm61-4','gtm-pm61-black','Product & Packaging Images & Manual','NOT_COMPLETED','2026-08-24','Ivy'),
  ('m-pm61-5','gtm-pm61-black','POSM','NOT_COMPLETED','2026-08-31','Ivy'),
  ('m-pm61-6','gtm-pm61-black','Social Copy & PR Release','NOT_COMPLETED','2026-09-05','Ivy'),
  ('m-pm61-7','gtm-pm61-black','Launch Assets Archive','NOT_REQUIRED',NULL,NULL),
  ('m-px51-1','gtm-px51','Product Introduction Slides','COMPLETED','2026-08-24','Ivy'),
  ('m-px51-2','gtm-px51','Packaging Design Final Draft','NOT_COMPLETED','2026-08-31','Ivy'),
  ('m-px51-3','gtm-px51','Product Sheet','NOT_COMPLETED','2026-08-31','Product'),
  ('m-px51-4','gtm-px51','Product & Packaging Images & Manual','NOT_COMPLETED','2026-09-07','Ivy'),
  ('m-px51-5','gtm-px51','POSM','NOT_COMPLETED','2026-09-15','Ivy'),
  ('m-px51-6','gtm-px51','Social Copy & PR Release','NOT_COMPLETED','2026-09-22','Ivy'),
  ('m-px51-7','gtm-px51','Launch Assets Archive','NOT_REQUIRED',NULL,NULL);

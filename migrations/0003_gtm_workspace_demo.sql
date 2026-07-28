-- GTM Workspace demo data.
-- These tables are intentionally isolated from ProtoTrack's prototype tables.

CREATE TABLE IF NOT EXISTS gtm_product (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  launch_status TEXT NOT NULL DEFAULT 'UNLAUNCHED',
  planned_launch_date TEXT,
  product_owner TEXT,
  marketing_project_manager TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gtm_material_task (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  material_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  deadline TEXT,
  owner TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES gtm_product(id) ON DELETE CASCADE,
  UNIQUE(product_id, material_type)
);

CREATE TABLE IF NOT EXISTS gtm_project_stage (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  deadline TEXT,
  estimated_shipping_date TEXT,
  FOREIGN KEY (product_id) REFERENCES gtm_product(id) ON DELETE CASCADE,
  UNIQUE(product_id, stage_name)
);

CREATE TABLE IF NOT EXISTS gtm_project_task (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  task_name TEXT NOT NULL,
  owner_role TEXT NOT NULL DEFAULT 'PRODUCT',
  prototype_type TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES gtm_product(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gtm_prototype_requirement (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  source_task_id TEXT NOT NULL UNIQUE,
  required_quantity INTEGER NOT NULL DEFAULT 1,
  eta TEXT,
  FOREIGN KEY (product_id) REFERENCES gtm_product(id) ON DELETE CASCADE,
  FOREIGN KEY (source_task_id) REFERENCES gtm_project_task(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gtm_product_launch ON gtm_product(launch_status);
CREATE INDEX IF NOT EXISTS idx_gtm_material_product ON gtm_material_task(product_id);
CREATE INDEX IF NOT EXISTS idx_gtm_task_product_stage ON gtm_project_task(product_id, stage_name, sort_order);
CREATE INDEX IF NOT EXISTS idx_gtm_requirement_product ON gtm_prototype_requirement(product_id);

INSERT OR IGNORE INTO gtm_product
  (id, model, name, category, launch_status, planned_launch_date, product_owner, marketing_project_manager)
VALUES
  ('gtm-p61l-p1', 'P61L-P1', 'Pocket 10K', 'Power Bank', 'UNLAUNCHED', '2026-07-31', 'Ivy', 'Ivy'),
  ('gtm-p61l-p2', 'P61L-P2', 'Pocket 10K 45W', 'Power Bank', 'UNLAUNCHED', '2026-07-30', 'Ivy', 'Ivy');

INSERT OR IGNORE INTO gtm_project_stage (id, product_id, stage_name, deadline, estimated_shipping_date) VALUES
  ('s-p1-1','gtm-p61l-p1','Project Confirm to Start','2026-07-03',NULL),
  ('s-p1-2','gtm-p61l-p1','DVT1','2026-07-10',NULL),
  ('s-p1-3','gtm-p61l-p1','DVT2','2026-07-18',NULL),
  ('s-p1-4','gtm-p61l-p1','Trial Production Start','2026-07-23',NULL),
  ('s-p1-5','gtm-p61l-p1','Mass Production','2026-07-28','2026-07-29'),
  ('s-p1-6','gtm-p61l-p1','Launch','2026-07-31',NULL),
  ('s-p2-1','gtm-p61l-p2','Project Confirm to Start','2026-07-02',NULL),
  ('s-p2-2','gtm-p61l-p2','DVT1','2026-07-09',NULL),
  ('s-p2-3','gtm-p61l-p2','DVT2','2026-07-17',NULL),
  ('s-p2-4','gtm-p61l-p2','Trial Production Start','2026-07-22',NULL),
  ('s-p2-5','gtm-p61l-p2','Mass Production','2026-07-27','2026-07-29'),
  ('s-p2-6','gtm-p61l-p2','Launch','2026-07-30',NULL);

INSERT OR IGNORE INTO gtm_project_task
  (id, product_id, stage_name, task_name, owner_role, prototype_type, is_completed, sort_order)
VALUES
  ('p1-t1','gtm-p61l-p1','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('p1-t2','gtm-p61l-p1','DVT1','Product Introduction Slides','MARKETING',NULL,1,10),
  ('p1-t3','gtm-p61l-p1','DVT1','Engineering Sample','PRODUCT','Engineering Sample',1,20),
  ('p1-t4','gtm-p61l-p1','DVT2','Packaging Design Final Draft','MARKETING',NULL,1,10),
  ('p1-t5','gtm-p61l-p1','DVT2','Product Sheet','PRODUCT',NULL,1,20),
  ('p1-t6','gtm-p61l-p1','DVT2','Engineering Sample','PRODUCT','Engineering Sample',1,30),
  ('p1-t7','gtm-p61l-p1','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',1,10),
  ('p1-t8','gtm-p61l-p1','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,1,20),
  ('p1-t9','gtm-p61l-p1','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',1,10),
  ('p1-t10','gtm-p61l-p1','Launch','Social Copy & PR Release','MARKETING',NULL,0,10),
  ('p2-t1','gtm-p61l-p2','Project Confirm to Start','Dummy','PRODUCT','Dummy',1,10),
  ('p2-t2','gtm-p61l-p2','DVT1','Engineering Sample','PRODUCT','Engineering Sample',1,10),
  ('p2-t3','gtm-p61l-p2','DVT1','Product Introduction Slides','MARKETING',NULL,1,20),
  ('p2-t4','gtm-p61l-p2','DVT2','Packaging Design Final Draft','MARKETING',NULL,1,10),
  ('p2-t5','gtm-p61l-p2','DVT2','Product Sheet','PRODUCT',NULL,1,20),
  ('p2-t6','gtm-p61l-p2','Trial Production Start','Preproduction Sample','PRODUCT','Preproduction Sample',1,10),
  ('p2-t7','gtm-p61l-p2','Trial Production Start','Product & Packaging Images & Manual','MARKETING',NULL,0,20),
  ('p2-t8','gtm-p61l-p2','Mass Production','Mass Production Sample','PRODUCT','Mass Production Sample',0,10),
  ('p2-t9','gtm-p61l-p2','Mass Production','POSM','MARKETING',NULL,0,20),
  ('p2-t10','gtm-p61l-p2','Launch','Social Copy & PR Release','MARKETING',NULL,0,10);

INSERT OR IGNORE INTO gtm_prototype_requirement
  (id, product_id, source_task_id, required_quantity, eta)
VALUES
  ('r-p1-dummy','gtm-p61l-p1','p1-t1',2,'2026-07-03'),
  ('r-p1-es1','gtm-p61l-p1','p1-t3',4,'2026-07-10'),
  ('r-p1-es2','gtm-p61l-p1','p1-t6',4,'2026-07-18'),
  ('r-p1-pps','gtm-p61l-p1','p1-t7',6,'2026-07-23'),
  ('r-p1-mp','gtm-p61l-p1','p1-t9',8,'2026-07-28'),
  ('r-p2-dummy','gtm-p61l-p2','p2-t1',2,'2026-07-02'),
  ('r-p2-es','gtm-p61l-p2','p2-t2',4,'2026-07-09'),
  ('r-p2-pps','gtm-p61l-p2','p2-t6',6,'2026-07-22'),
  ('r-p2-mp','gtm-p61l-p2','p2-t8',8,'2026-07-27');

INSERT OR IGNORE INTO gtm_material_task (id, product_id, material_type, status, deadline, owner) VALUES
  ('m-p1-1','gtm-p61l-p1','Product Introduction Slides','COMPLETED','2026-07-10','Ivy'),
  ('m-p1-2','gtm-p61l-p1','Packaging Design Final Draft','COMPLETED','2026-07-18','Ivy'),
  ('m-p1-3','gtm-p61l-p1','Product Sheet','COMPLETED','2026-07-18','Product'),
  ('m-p1-4','gtm-p61l-p1','Product & Packaging Images & Manual','COMPLETED','2026-07-23','Ivy'),
  ('m-p1-5','gtm-p61l-p1','POSM','NOT_COMPLETED','2026-07-28','Ivy'),
  ('m-p1-6','gtm-p61l-p1','Social Copy & PR Release','NOT_COMPLETED','2026-07-31','Ivy'),
  ('m-p1-7','gtm-p61l-p1','Launch Assets Archive','NOT_REQUIRED',NULL,NULL),
  ('m-p2-1','gtm-p61l-p2','Product Introduction Slides','COMPLETED','2026-07-09','Ivy'),
  ('m-p2-2','gtm-p61l-p2','Packaging Design Final Draft','COMPLETED','2026-07-17','Ivy'),
  ('m-p2-3','gtm-p61l-p2','Product Sheet','COMPLETED','2026-07-17','Product'),
  ('m-p2-4','gtm-p61l-p2','Product & Packaging Images & Manual','NOT_COMPLETED','2026-07-22','Ivy'),
  ('m-p2-5','gtm-p61l-p2','POSM','NOT_COMPLETED','2026-07-27','Ivy'),
  ('m-p2-6','gtm-p61l-p2','Social Copy & PR Release','NOT_COMPLETED','2026-07-30','Ivy'),
  ('m-p2-7','gtm-p61l-p2','Launch Assets Archive','NOT_REQUIRED',NULL,NULL);

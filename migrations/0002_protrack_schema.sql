-- ProtoTrack 核心表（从 Google Apps Script + Sheet 迁移）
-- 真实数据已直接导入远程 D1；本文件用于版本管理与本地开发建表。

CREATE TABLE IF NOT EXISTS app_user (
  email TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  role  TEXT NOT NULL DEFAULT 'sales'   -- admin / sales
);

CREATE TABLE IF NOT EXISTS prototype (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sn          TEXT NOT NULL,
  model       TEXT,
  pname       TEXT,
  sample_type TEXT,
  owner       TEXT,
  customer    TEXT,
  country     TEXT,
  qty         INTEGER NOT NULL DEFAULT 0,
  co          TEXT,   -- dispatch date
  ret         TEXT,   -- return date
  status      TEXT NOT NULL DEFAULT 'In Stock',  -- In Stock/In Transit/On Loan/Returned/Gifted
  notes       TEXT,
  updated_at  TEXT,
  tracking_no TEXT,
  ship_date   TEXT,
  received    TEXT
);
CREATE INDEX IF NOT EXISTS idx_proto_owner  ON prototype(owner);
CREATE INDEX IF NOT EXISTS idx_proto_status ON prototype(status);
CREATE INDEX IF NOT EXISTS idx_proto_sn     ON prototype(sn);

CREATE TABLE IF NOT EXISTS proto_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     TEXT,
  sn     TEXT,
  action TEXT,
  actor  TEXT,
  note   TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_sn ON proto_log(sn);
CREATE INDEX IF NOT EXISTS idx_log_ts ON proto_log(ts);

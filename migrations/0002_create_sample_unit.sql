-- 样机管理 sample_unit：每一台样机一行，看板按 status 分列。
-- sku_code 关联到 sku.code（哪款产品的样机）。
CREATE TABLE IF NOT EXISTS sample_unit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_code   TEXT NOT NULL REFERENCES sku(code),
  serial_no  TEXT,
  status     TEXT NOT NULL DEFAULT 'in_stock',   -- to_receive / in_stock / lent_out / testing / returned / scrapped
  holder     TEXT,
  location   TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sample_unit_status ON sample_unit(status);
CREATE INDEX IF NOT EXISTS idx_sample_unit_sku ON sample_unit(sku_code);

-- 演示数据（本地开发即可看到看板；远程首次迁移也会插入这几条示例，之后可删）
INSERT INTO sample_unit (sku_code, serial_no, status, holder, location, notes) VALUES
('P75-P1-Black','SN-0001','in_stock','Chris','London Office','首批样机'),
('P76-P1-White','SN-0002','testing','Chris','Lab','跌落测试中'),
('PX11','SN-0003','lent_out','Bai','Client A','客户评估借出'),
('TAL101','SN-0004','to_receive',NULL,NULL,'工厂寄样中'),
('WM321','SN-0005','returned','Chris','London Office','已归还入库');

ALTER TABLE lessons ADD COLUMN teacher_id uuid,ADD COLUMN pay_mode text NOT NULL DEFAULT 'session',ADD COLUMN pay_value bigint NOT NULL DEFAULT 0;
UPDATE lessons l SET teacher_id=g.teacher_id,pay_mode=g.pay_mode,pay_value=g.pay_value FROM groups g WHERE g.id=l.group_id AND g.tenant_id=l.tenant_id;
ALTER TABLE lessons ADD FOREIGN KEY(tenant_id,teacher_id) REFERENCES users(tenant_id,id);
ALTER TABLE invoices ADD COLUMN teacher_id uuid,ADD COLUMN pay_percent_bp integer NOT NULL DEFAULT 0 CHECK(pay_percent_bp BETWEEN 0 AND 10000);
UPDATE invoices i SET teacher_id=g.teacher_id,pay_percent_bp=CASE WHEN g.pay_mode='percent' THEN g.pay_value ELSE 0 END FROM groups g WHERE g.id=i.group_id AND g.tenant_id=i.tenant_id;
ALTER TABLE invoices ADD FOREIGN KEY(tenant_id,teacher_id) REFERENCES users(tenant_id,id);

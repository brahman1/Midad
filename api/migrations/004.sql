CREATE TABLE school_closures (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), label text NOT NULL,
 starts_on date NOT NULL, ends_on date NOT NULL CHECK(ends_on>=starts_on),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE INDEX school_closures_dates ON school_closures(tenant_id,starts_on,ends_on);
CREATE TABLE lesson_series (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), group_id uuid NOT NULL,
 rule jsonb NOT NULL, fingerprint text NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id)
);
ALTER TABLE lessons ADD COLUMN series_id uuid, ADD FOREIGN KEY(tenant_id,series_id) REFERENCES lesson_series(tenant_id,id);
CREATE INDEX lessons_series ON lessons(tenant_id,series_id);

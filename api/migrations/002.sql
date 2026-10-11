CREATE UNIQUE INDEX payroll_reference ON payroll_payments(tenant_id,teacher_id,month,reference);
CREATE TABLE cash_openings(tenant_id uuid NOT NULL REFERENCES tenants(id),day date NOT NULL,amount_centimes bigint NOT NULL CHECK(amount_centimes>=0),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,day));
CREATE INDEX lessons_dates ON lessons(tenant_id,starts_at);
CREATE INDEX enrollments_students ON enrollments(tenant_id,student_id);
CREATE INDEX users_active ON users(tenant_id,active,role);
CREATE INDEX outbox_pending ON outbox(next_at) WHERE state IN('pending','sending');

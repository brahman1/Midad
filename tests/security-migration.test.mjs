import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { db } from "../api/dist/db.js";
test("Migration des sessions anciennes : aucun accès confirmé artificiellement", async () => {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const u = (
      await c.query("SELECT id FROM users ORDER BY created_at LIMIT 1")
    ).rows[0];
    assert.ok(u);
    const fingerprint = createHash("sha256").update(randomUUID()).digest("hex");
    await c.query(
      "INSERT INTO auth_sessions(token_hash,user_id,created_at,expires_at,reauthenticated_at,last_seen_at) SELECT $1,$2,applied_at-interval '1 day',now()+interval '7 days',applied_at,applied_at FROM schema_migrations WHERE version='005.sql'",
      [fingerprint, u.id],
    );
    await c.query(
      await readFile(
        new URL("../api/migrations/006.sql", import.meta.url),
        "utf8",
      ),
    );
    const session = (
      await c.query(
        "SELECT created_at,reauthenticated_at,last_seen_at FROM auth_sessions WHERE token_hash=$1",
        [fingerprint],
      )
    ).rows[0];
    assert.ok(session);
    assert.equal(
      session.reauthenticated_at.toISOString(),
      session.created_at.toISOString(),
    );
    assert.equal(
      session.last_seen_at.toISOString(),
      session.created_at.toISOString(),
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
    await db.end();
  }
});

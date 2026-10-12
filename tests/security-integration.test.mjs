import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../api/dist/db.js";
import { totp, maintainSecurity } from "../api/dist/protection.js";
const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4100/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3000";
const password = "Security-Midad-Test-2026!";
async function call(
  path,
  {
    token,
    cookie,
    method = "GET",
    body,
    expected = 200,
    extra = {},
    noOrigin = false,
  } = {},
) {
  const r = await fetch(base + "/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(!noOrigin ? { Origin: origin } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => null);
  assert.equal(r.status, expected, path + ":" + JSON.stringify(data));
  return { data, headers: r.headers };
}
test("Sécurité réelle : sessions, MFA, droits, confidentialité et limites", async (t) => {
  const suffix = Date.now().toString(36),
    slug = "security-" + suffix,
    email = "security-" + suffix + "@example.test";
  let owner, user, tenant, parent, parentToken, other, setup, recovery;
  try {
    const r = await call("auth/register", {
      method: "POST",
      body: {
        slug,
        school: "Centre sécurité fictif",
        name: "Direction fictive",
        email,
        password,
      },
      expected: 201,
    });
    owner = r.data.token;
    user = (await call("auth/me", { token: owner })).data;
    tenant = user.tenant_id;
    await db.query("UPDATE users SET verified=true WHERE id=$1", [user.id]);
    const s = await call("auth/register", {
      method: "POST",
      body: {
        slug: "other-" + suffix,
        school: "Autre centre fictif",
        name: "Autre direction",
        email: "other-" + email,
        password,
      },
      expected: 201,
    });
    other = s.data.token;
    parent = randomUUID();
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) SELECT $1,tenant_id,'Parent fictif',$2,password_hash,'PARENT',true FROM users WHERE id=$3",
      [parent, "parent-" + email, user.id],
    );
    parentToken = (
      await call("auth/login", {
        method: "POST",
        body: { slug, email: "parent-" + email, password },
        expected: 201,
      })
    ).data.token;
    const ownChild = randomUUID(),
      foreignChild = randomUUID();
    await db.query(
      "INSERT INTO students(id,tenant_id,name,parent_id) VALUES($1,$2,'Enfant lié',$3),($4,$2,'Enfant sans lien',NULL)",
      [ownChild, tenant, parent, foreignChild],
    );
    await t.test(
      "Web : cookie HttpOnly, sans jeton exposé et anti-CSRF strict",
      async () => {
        const r = await call("auth/login", {
          method: "POST",
          body: { slug, email, password, session_mode: "cookie" },
          expected: 201,
        });
        assert.equal(r.data.token, undefined);
        const cookie = r.headers.get("set-cookie").split(";")[0];
        assert.match(r.headers.get("set-cookie"), /HttpOnly/);
        assert.match(r.headers.get("cache-control"), /no-store/);
        await call("auth/logout", {
          cookie,
          method: "POST",
          body: {},
          noOrigin: true,
          extra: { Authorization: "invalid" },
          expected: 403,
        });
        await call("auth/logout", {
          cookie,
          method: "POST",
          body: {},
          extra: {
            Origin: "https://evil.example",
            Authorization: "Bearer " + owner,
          },
          expected: 403,
        });
        await call("auth/me", {
          cookie,
          extra: { Authorization: "invalid" },
          expected: 401,
        });
        await call("auth/logout", {
          cookie,
          method: "POST",
          body: {},
          expected: 201,
        });
      },
    );
    await t.test(
      "Export personnel limité aux enfants liés, droits et demandes isolés",
      async () => {
        const data = (await call("privacy/export", { token: parentToken }))
          .data;
        assert.deepEqual(
          data.students.map((x) => x.id),
          [ownChild],
        );
        assert.equal(data.profile.id, parent);
        assert.ok(!JSON.stringify(data).includes("password_hash"));
        assert.ok(!JSON.stringify(data).includes(owner));
        await call("privacy/admin", { token: parentToken, expected: 403 });
        await call("privacy/journal", { token: parentToken, expected: 403 });
        const request = (
          await call("privacy/requests", {
            token: parentToken,
            method: "POST",
            body: {
              kind: "rectification",
              message: "Corriger le prénom fictif du dossier.",
            },
            expected: 201,
          })
        ).data;
        assert.equal(
          (await call("privacy/admin", { token: owner })).data.requests[0].id,
          request.id,
        );
        await call("privacy/requests/" + request.id, {
          token: other,
          method: "PATCH",
          body: { status: "completed", response: "Réponse de test fictive" },
          expected: 404,
        });
        await call("privacy/requests/" + request.id, {
          token: owner,
          method: "PATCH",
          body: {
            status: "in_progress",
            response: "Votre demande fictive est prise en charge.",
          },
        });
        assert.equal(
          (await call("privacy/requests", { token: parentToken })).data[0]
            .status,
          "in_progress",
        );
        await call("privacy/profile", {
          token: owner,
          method: "POST",
          body: {
            privacy_contact: "privacy@example.test",
            dpo_name: "Délégué fictif",
            retention_policy:
              "Conservation à valider pour cet établissement fictif.",
            processing_basis:
              "Fondement juridique à valider pour les données fictives.",
          },
          expected: 201,
        });
        assert.equal(
          (await call("privacy/notice", { token: parentToken })).data.school
            .privacy_contact,
          "privacy@example.test",
        );
      },
    );
    await t.test(
      "Session inactive et confirmation récente, révocation d’un autre appareil",
      async () => {
        const fresh = (
          await call("auth/login", {
            method: "POST",
            body: { slug, email, password },
            expected: 201,
          })
        ).data.token;
        const expired = (
          await call("auth/login", {
            method: "POST",
            body: { slug, email, password },
            expected: 201,
          })
        ).data.token;
        const crypto = await import("node:crypto");
        const digest = (s) =>
          crypto.createHash("sha256").update(s).digest("hex");
        await db.query(
          "UPDATE auth_sessions SET last_seen_at=now()-interval '13 hours' WHERE token_hash=$1",
          [digest(expired)],
        );
        await call("auth/me", { token: expired, expected: 401 });
        await db.query(
          "UPDATE auth_sessions SET reauthenticated_at=now()-interval '11 minutes' WHERE token_hash=$1",
          [digest(owner)],
        );
        await call("export", { token: owner, expected: 428 });
        await call("security/reauthenticate", {
          token: owner,
          method: "POST",
          body: { current: password },
          expected: 201,
        });
        const account = (await call("security/account", { token: owner })).data;
        assert.ok(!JSON.stringify(account).includes("token_hash"));
        assert.ok(!JSON.stringify(account).includes(owner));
        const selected = account.sessions.find((x) => !x.current);
        assert.ok(selected);
        await call("security/sessions/revoke", {
          token: owner,
          method: "POST",
          body: { id: selected.id },
          expected: 201,
        });
        await call("auth/me", { token: fresh, expected: 401 });
      },
    );
    await t.test(
      "MFA : clé chiffrée, vérification, code non rejouable et secours à usage unique",
      async () => {
        setup = (
          await call("security/mfa/setup", {
            token: owner,
            method: "POST",
            body: { current: password },
            expected: 201,
          })
        ).data;
        assert.ok(setup.secret);
        const stored = (
          await db.query(
            "SELECT secret_encrypted FROM user_mfa WHERE user_id=$1",
            [user.id],
          )
        ).rows[0];
        assert.ok(!stored.secret_encrypted.includes(setup.secret));
        const counter = Math.floor(Date.now() / 30000);
        const enabled = (
          await call("security/mfa/enable", {
            token: owner,
            method: "POST",
            body: { current: password, code: totp(setup.secret, counter) },
            expected: 201,
          })
        ).data;
        recovery = enabled.recovery_codes;
        assert.equal(recovery.length, 8);
        await call("auth/me", { token: owner, expected: 401 });
        owner = enabled.token;
        assert.ok(owner);
        const without = (
          await call("auth/login", {
            method: "POST",
            body: { slug, email, password },
            expected: 201,
          })
        ).data;
        assert.equal(without.mfa_required, true);
        assert.equal(without.token, undefined);
        const replay = (
          await call("auth/login", {
            method: "POST",
            body: { slug, email, password, code: totp(setup.secret, counter) },
            expected: 201,
          })
        ).data;
        assert.equal(replay.token, undefined);
        const login = (
          await call("auth/login", {
            method: "POST",
            body: { slug, email, password, code: recovery[0] },
            expected: 201,
          })
        ).data;
        assert.ok(login.token);
        const repeated = (
          await call("auth/login", {
            method: "POST",
            body: { slug, email, password, code: recovery[0] },
            expected: 201,
          })
        ).data;
        assert.equal(repeated.token, undefined);
        const disabled = (
          await call("security/mfa/disable", {
            token: owner,
            method: "POST",
            body: { current: password, code: recovery[1] },
            expected: 201,
          })
        ).data;
        await call("auth/me", { token: owner, expected: 401 });
        owner = disabled.token;
        const journal = (await call("privacy/journal", { token: owner })).data;
        const serialized = JSON.stringify(journal);
        assert.ok(journal.some((x) => x.action === "auth.mfa.enable"));
        assert.ok(!serialized.includes(password));
        assert.ok(!serialized.includes(setup.secret));
        assert.ok(!serialized.includes(recovery[0]));
      },
    );
    await t.test(
      "Limitation par compte persistante et limites de requête",
      async () => {
        const target = "unknown-" + suffix + "@example.test";
        for (let i = 0; i < 12; i++)
          await call("auth/login", {
            method: "POST",
            body: { slug, email: target, password: "Wrong-password-2026!" },
            expected: 401,
          });
        await call("auth/login", {
          method: "POST",
          body: { slug, email: target, password: "Wrong-password-2026!" },
          expected: 429,
        });
        assert.ok(
          (await db.query("SELECT count(*) AS count FROM rate_buckets")).rows[0]
            .count > 0,
        );
        await call("public/contact", {
          method: "POST",
          body: { name: "x".repeat(300000) },
          expected: 413,
        });
        const bad = await fetch(base + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: "{broken",
        });
        assert.equal(bad.status, 400);
      },
    );
    await t.test(
      "Nettoyage des traces anciennes, maintien des dossiers métier",
      async () => {
        await db.query(
          "INSERT INTO security_events(tenant_id,user_id,action,outcome,created_at) VALUES($1,$2,'test.old','success',now()-interval '181 days')",
          [tenant, user.id],
        );
        await maintainSecurity();
        assert.equal(
          (
            await db.query(
              "SELECT 1 FROM security_events WHERE tenant_id=$1 AND action='test.old'",
              [tenant],
            )
          ).rowCount,
          0,
        );
        assert.equal(
          (
            await db.query("SELECT 1 FROM students WHERE tenant_id=$1", [
              tenant,
            ])
          ).rowCount,
          2,
        );
      },
    );
  } finally {
    await db.end();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
const host = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3000";
test("Web réel : CSP avec nonce neuf, scripts autorisés, absence de cache privé", async () => {
  const first = await fetch(host + "/auth"),
    second = await fetch(host + "/auth");
  assert.equal(first.status, 200);
  const csp = first.headers.get("content-security-policy");
  const nonce = csp.match(/'nonce-([^']+)'/)[1];
  assert.notEqual(
    nonce,
    second.headers.get("content-security-policy").match(/'nonce-([^']+)'/)[1],
  );
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /strict-dynamic/);
  assert.ok(
    !csp
      .split(";")
      .find((s) => s.trim().startsWith("script-src"))
      .includes("unsafe-inline"),
  );
  const html = await first.text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
  assert.ok(scripts.length > 0);
  assert.ok(scripts.every((s) => s[1].includes('nonce="' + nonce + '"')));
  assert.match(first.headers.get("cache-control"), /no-store/);
  assert.equal(first.headers.get("x-frame-options"), "DENY");
  assert.equal(first.headers.get("referrer-policy"), "no-referrer");
  assert.equal(first.headers.get("x-powered-by"), null);
  const health = await fetch(host + "/api/public/health");
  assert.equal(health.status, 200);
  assert.match(health.headers.get("cache-control"), /no-store/);
});

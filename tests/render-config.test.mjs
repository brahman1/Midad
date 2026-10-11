import { test } from "node:test";
import assert from "node:assert/strict";
import { demoConfig } from "../scripts/demo-config.mjs";
test("Les jeux fictifs refusent une production ordinaire et une base distante non autorisée", () => {
  assert.throws(() => demoConfig({ NODE_ENV: "production" }));
  assert.throws(() =>
    demoConfig({ DATABASE_URL: "postgres://user:pass@example.com/db" }),
  );
  assert.equal(demoConfig({}).cloud, false);
});
test("Le test Render exige une activation, une base et un secret distinct", () => {
  const env = {
    RENDER: "true",
    NODE_ENV: "production",
    MIDAD_DEMO_ENABLED: "true",
    DATABASE_URL: "postgres://user:pass@internal-render/db",
    MIDAD_DEMO_PASSWORD: "a-test-password-with-24-chars",
  };
  assert.equal(demoConfig(env).cloud, true);
  assert.throws(() => demoConfig({ ...env, RENDER: "false" }));
  assert.throws(() =>
    demoConfig({ ...env, MIDAD_DEMO_PASSWORD: "Midad-Local-2026!" }),
  );
  assert.throws(() => demoConfig({ ...env, DATABASE_URL: undefined }));
});

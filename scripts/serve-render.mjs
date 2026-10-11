import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { demoConfig } from "./demo-config.mjs";

const root = resolve(import.meta.dirname, "..");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL requis");
const publicUrl = process.env.RENDER_EXTERNAL_URL ?? process.env.WEB_URL;
if (!publicUrl) throw new Error("URL publique requise");
const env = {
  ...process.env,
  NODE_ENV: "production",
  WEB_URL: publicUrl,
  ALLOWED_ORIGINS: publicUrl,
};
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 8000).unref();
  process.exitCode = code;
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => stop());
function child(args, cwd = root, extra = {}, persistent = false) {
  const proc = spawn(process.execPath, args, {
    cwd,
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  children.add(proc);
  return new Promise((resolve, reject) => {
    proc.once("error", reject);
    proc.once("exit", (code, signal) => {
      children.delete(proc);
      if (persistent && !stopping) stop(code || 1);
      if (code === 0 || stopping) resolve();
      else reject(new Error(`Processus arrêté (${code ?? signal})`));
    });
  });
}
try {
  await child(
    [
      "-e",
      "const {migrate,db}=require('./dist/db.js'); migrate().then(()=>db.end()).catch(()=>{console.error('Migration impossible');process.exit(1)})",
    ],
    resolve(root, "api"),
  );
  if (env.MIDAD_DEMO_ENABLED === "true") {
    demoConfig(env);
    const db = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
    try {
      await db.query(
        "CREATE TABLE IF NOT EXISTS demo_initialization(version text PRIMARY KEY, initialized_at timestamptz NOT NULL DEFAULT now())",
      );
      if (
        !(
          await db.query(
            "SELECT 1 FROM demo_initialization WHERE version='render-v1'",
          )
        ).rowCount
      ) {
        if (
          (
            await db.query(
              "SELECT 1 FROM tenants WHERE slug <> 'midad-local' LIMIT 1",
            )
          ).rowCount
        )
          throw new Error(
            "Les données fictives exigent une base dédiée au test.",
          );
        await child(["scripts/demo.mjs"]);
        await child(["scripts/demo-showcase.mjs"]);
        await db.query(
          "INSERT INTO demo_initialization(version) VALUES('render-v1') ON CONFLICT DO NOTHING",
        );
      }
    } finally {
      await db.end();
    }
  }
  void child(
    ["dist/main.js"],
    resolve(root, "api"),
    { PORT: "4100", API_BIND: "127.0.0.1", TRUST_PROXY_HOPS: "2" },
    true,
  ).catch(() => stop(1));
  let ready = false;
  for (let i = 0; i < 60 && !stopping; i++) {
    try {
      ready = (
        await fetch("http://127.0.0.1:4100/api/public/health", {
          signal: AbortSignal.timeout(1500),
        })
      ).ok;
    } catch {}
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error("API indisponible au démarrage");
  await child(
    ["scripts/serve-web.mjs"],
    root,
    { MIDAD_BIND: "0.0.0.0", MIDAD_WEB_PORT: env.PORT ?? "10000" },
    true,
  );
} catch {
  console.error(
    "Démarrage Midad impossible. Vérifier la base, l'URL et la configuration de test.",
  );
  stop(1);
}

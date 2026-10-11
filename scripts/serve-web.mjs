import { cp, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
const standalone = resolve(root, "web/.next/standalone/web");
await access(resolve(standalone, "server.js"));
await mkdir(resolve(standalone, ".next"), { recursive: true });
await cp(
  resolve(root, "web/.next/static"),
  resolve(standalone, ".next/static"),
  { recursive: true },
);
await cp(resolve(root, "web/public"), resolve(standalone, "public"), {
  recursive: true,
});
process.env.HOSTNAME = process.env.MIDAD_BIND ?? "127.0.0.1";
process.env.PORT = process.env.MIDAD_WEB_PORT ?? "3000";
await import(pathToFileURL(resolve(standalone, "server.js")).href);

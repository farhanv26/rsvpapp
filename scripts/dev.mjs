#!/usr/bin/env node
/**
 * `npm run dev`: resolves DATABASE_URL exactly as `next dev` will (process env, then
 * .env.development.local, .env.local, .env.development, .env), refuses to start against a
 * non-local database unless ALLOW_REMOTE_DEV_DATABASE=1, makes sure the local database is
 * running and migrated, then starts `next dev` with any extra arguments.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_DB_PORT, migrate, start } from "./local-db.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalEnv = { ...process.env };
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");
const { loadedEnvFiles } = loadEnvConfig(ROOT, true, { info() {}, error: console.error });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
let target;
try {
  target = new URL(process.env.DATABASE_URL ?? "");
} catch {
  target = null;
}

const source = originalEnv.DATABASE_URL
  ? "the shell environment"
  : (loadedEnvFiles.find((f) => /^\s*DATABASE_URL\s*=/m.test(f.contents))?.path ?? "no file");

if (!target || !LOCAL_HOSTS.has(target.hostname)) {
  if (process.env.ALLOW_REMOTE_DEV_DATABASE === "1") {
    console.warn(`⚠ Using a non-local database (${target?.hostname ?? "unset"}) from ${source} because ALLOW_REMOTE_DEV_DATABASE=1.`);
  } else {
    console.error(
      [
        `The dev server would connect to ${target ? `a non-local database (${target.hostname})` : "no database"} — DATABASE_URL comes from ${source}.`,
        "Local development uses an isolated local database. Set it up once with:",
        "",
        "  npm run db:local:setup",
        "",
        "To deliberately run against another database, set ALLOW_REMOTE_DEV_DATABASE=1.",
      ].join("\n"),
    );
    process.exit(1);
  }
} else if (Number(target.port) === LOCAL_DB_PORT) {
  start();
  migrate({ quiet: true });
  console.log(`Database: local (127.0.0.1:${LOCAL_DB_PORT}${target.pathname}) from ${source}.`);
} else {
  console.log(`Database: local (${target.host}${target.pathname}) from ${source}.`);
}

const child = spawn(path.join(ROOT, "node_modules", ".bin", "next"), ["dev", ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  env: originalEnv,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

#!/usr/bin/env node
/**
 * `npm run dev`: resolves DATABASE_URL exactly as `next dev` will (process env, then
 * .env.development.local, .env.local, .env.development, .env), refuses to start against
 * any database except the explicitly isolated local workspace/demo database, makes sure it is
 * running and migrated, then starts `next dev` with any extra arguments.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_DEMO_DB_URL, migrate, start } from "./local-db.mjs";

import { assertDevelopmentDatabase } from "./local-target.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const demo = args.includes("--demo");
if (demo) {
  // `npm run dev:demo`: the fictional wedding in its own database, labelled as demo data in the UI.
  process.env.DATABASE_URL = LOCAL_DEMO_DB_URL;
  process.env.DIRECT_URL = LOCAL_DEMO_DB_URL;
}
process.env.VOWPAL_DEMO = demo ? "1" : "0";
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");
loadEnvConfig(ROOT, true, { info() {}, error: console.error });

// Validate both URLs before starting a database or running any migrations.
try {
  assertDevelopmentDatabase(process.env.DATABASE_URL, demo);
  assertDevelopmentDatabase(process.env.DIRECT_URL ?? process.env.DATABASE_URL, demo);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const target = new URL(process.env.DATABASE_URL);
start();
migrate({ quiet: true, url: target.toString() });
console.log(`Database: local 127.0.0.1:54330${target.pathname}.`);
console.log(demo ? "DEMO: fictional accounts and wedding data; normal accounts are on port 3000." : "Local development: your local accounts, no demo seed is run.");
const nextArgs = args.filter((a) => a !== "--demo");
if (!nextArgs.some((a) => a === "--port" || a === "-p" || a.startsWith("--port="))) nextArgs.push("--port", demo ? "3002" : "3000");
if (!nextArgs.some((a) => a === "--hostname" || a === "-H" || a.startsWith("--hostname="))) nextArgs.push("--hostname", "127.0.0.1");

const child = spawn(path.join(ROOT, "node_modules", ".bin", "next"), ["dev", ...nextArgs], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: target.toString(), DIRECT_URL: target.toString() },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

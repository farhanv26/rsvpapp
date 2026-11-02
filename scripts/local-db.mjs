#!/usr/bin/env node
/**
 * Persistent, isolated PostgreSQL for local development.
 *
 * Runs the PostgreSQL binaries shipped by the `embedded-postgres` dev dependency as a
 * background server with its data in `.local/postgres` (git-ignored). It only ever touches
 * that local server; hosted databases are never contacted.
 *
 *   node scripts/local-db.mjs setup     start, write .env.development.local, migrate
 *   node scripts/local-db.mjs start     start the server (creates the cluster on first run)
 *   node scripts/local-db.mjs stop      stop the server
 *   node scripts/local-db.mjs status    show server and migration status
 *   node scripts/local-db.mjs migrate   apply committed migrations (prisma migrate deploy)
 *   node scripts/local-db.mjs seed      (re)load the synthetic demo wedding
 *   node scripts/local-db.mjs remove-demo   delete the demo accounts and everything tied to them
 *   node scripts/local-db.mjs reset --yes   drop the local database and re-apply every migration
 *   node scripts/local-db.mjs import-users   copy sign-in accounts (names, roles, password hashes)
 *                                            from the database in .env.local; read-only there
 *   node scripts/local-db.mjs prisma <args>  run any Prisma CLI command against the local database
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_DIR = path.join(ROOT, ".local", "postgres");
const DATA_DIR = path.join(BASE_DIR, "data");
const LOG_FILE = path.join(BASE_DIR, "server.log");
const ENV_FILE = path.join(ROOT, ".env.development.local");

export const LOCAL_DB_PORT = Number(process.env.LOCAL_DB_PORT || 54330);
export const LOCAL_DB_NAME = "rsvp_dev";
export const LOCAL_DB_URL = `postgresql://postgres@127.0.0.1:${LOCAL_DB_PORT}/${LOCAL_DB_NAME}`;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const bin = (name) => path.join(ROOT, "node_modules", "@embedded-postgres", `${process.platform}-${process.arch}`, "native", "bin", name);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8", env: opts.env ?? process.env });
  if (res.error) throw res.error;
  return res;
}

function requireBinaries() {
  if (!existsSync(bin("pg_ctl"))) {
    console.error(
      `PostgreSQL binaries for ${process.platform}-${process.arch} were not found.\n` +
        "Run `npm install` (the `embedded-postgres` dev dependency provides them).",
    );
    process.exit(1);
  }
}

function prismaEnv() {
  return { ...process.env, DATABASE_URL: LOCAL_DB_URL, DIRECT_URL: LOCAL_DB_URL };
}

function prisma(args, opts = {}) {
  return run(path.join(ROOT, "node_modules", ".bin", "prisma"), args, { ...opts, env: prismaEnv() });
}

export function isRunning() {
  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) return false;
  return run(bin("pg_ctl"), ["status", "-D", DATA_DIR], { quiet: true }).status === 0;
}

function initCluster() {
  mkdirSync(BASE_DIR, { recursive: true });
  console.log(`Creating local PostgreSQL cluster in ${path.relative(ROOT, DATA_DIR)} …`);
  const res = run(bin("initdb"), ["-D", DATA_DIR, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"], { quiet: true });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    process.exit(1);
  }
  appendFileSync(
    path.join(DATA_DIR, "postgresql.conf"),
    [
      "",
      "# rsvpapp local development settings",
      `port = ${LOCAL_DB_PORT}`,
      "listen_addresses = '127.0.0.1'",
      "unix_socket_directories = ''",
      "fsync = on",
      "",
    ].join("\n"),
  );
}

export function start() {
  requireBinaries();
  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) initCluster();
  if (isRunning()) return false;
  const res = run(bin("pg_ctl"), ["start", "-D", DATA_DIR, "-l", LOG_FILE, "-w", "-t", "30"], { quiet: true });
  if (res.status !== 0) {
    console.error(`Local PostgreSQL failed to start. See ${path.relative(ROOT, LOG_FILE)}.`);
    console.error(res.stderr || res.stdout);
    process.exit(1);
  }
  console.log(`Local PostgreSQL running on 127.0.0.1:${LOCAL_DB_PORT}.`);
  return true;
}

function stop() {
  if (!isRunning()) {
    console.log("Local PostgreSQL is not running.");
    return;
  }
  run(bin("pg_ctl"), ["stop", "-D", DATA_DIR, "-m", "fast", "-w"], { quiet: true });
  console.log("Local PostgreSQL stopped.");
}

export function migrate({ quiet = false } = {}) {
  const res = prisma(["migrate", "deploy"], { quiet });
  if (res.status !== 0) {
    if (quiet) console.error(res.stdout + res.stderr);
    console.error("Applying migrations to the local database failed.");
    process.exit(res.status ?? 1);
  }
  if (quiet) {
    const applied = (res.stdout.match(/Applying migration `[^`]+`/g) ?? []).length;
    if (applied) console.log(`Applied ${applied} migration(s) to the local database.`);
  }
}

function seed() {
  const res = run(path.join(ROOT, "node_modules", ".bin", "tsx"), ["scripts/seed-demo.ts"], { env: prismaEnv() });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

/** Deletes the synthetic demo accounts (ids `demo_*`), their weddings and events, and every row tied to them. */
async function removeDemo() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: LOCAL_DB_URL } } });
  try {
    const users = await db.user.findMany({ where: { id: { startsWith: "demo_" } }, select: { id: true, name: true } });
    const userIds = users.map((u) => u.id);
    const weddings = await db.wedding.findMany({
      where: { OR: [{ backfillKey: { startsWith: "demo-" } }, { name: { startsWith: "[Demo]" } }] },
      select: { id: true, name: true, memberships: { select: { userId: true } } },
    });
    const realMembers = weddings.filter((w) => w.memberships.some((m) => !userIds.includes(m.userId)));
    if (realMembers.length) {
      console.error(`Refusing: ${realMembers.map((w) => w.name).join(", ")} also has non-demo members.`);
      process.exit(1);
    }
    const weddingIds = weddings.map((w) => w.id);
    const events = await db.event.findMany({
      where: { OR: [{ weddingId: { in: weddingIds } }, { ownerUserId: { in: userIds } }, { slug: { startsWith: "demo-" } }] },
      select: { id: true, weddingId: true },
    });
    const foreign = events.filter((e) => e.weddingId && !weddingIds.includes(e.weddingId));
    if (foreign.length) {
      console.error(`Refusing: ${foreign.length} demo-owned event(s) belong to a non-demo wedding.`);
      process.exit(1);
    }
    const eventIds = events.map((e) => e.id);
    const byEventOrUser = { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] };

    const removed = await db.$transaction(async (tx) => ({
      auditEntries: (await tx.auditActivity.deleteMany({ where: byEventOrUser })).count,
      notifications: (await tx.notification.deleteMany({ where: byEventOrUser })).count,
      // Guests first: Guest.allocationId is ON DELETE RESTRICT. RSVP activity and message logs cascade.
      guests: (await tx.guest.deleteMany({ where: { eventId: { in: eventIds } } })).count,
      budgetItems: (await tx.budgetItem.deleteMany({ where: { weddingId: { in: weddingIds } } })).count,
      vendors: (await tx.vendor.deleteMany({ where: { weddingId: { in: weddingIds } } })).count,
      events: (await tx.event.deleteMany({ where: { id: { in: eventIds } } })).count,
      weddings: (await tx.wedding.deleteMany({ where: { id: { in: weddingIds } } })).count,
      users: (await tx.user.deleteMany({ where: { id: { in: userIds } } })).count,
    }));
    console.log(`Removed demo data from the local database: ${users.map((u) => u.name).join(", ") || "no demo users"}.`);
    console.log(Object.entries(removed).map(([k, n]) => `${k}: ${n}`).join(", "));
  } finally {
    await db.$disconnect();
  }
}

/** Only SELECTs inside a READ ONLY transaction on the source; writes go to the local database only. */
async function importUsers() {
  const sourceFile = path.join(ROOT, ".env.local");
  if (!existsSync(sourceFile)) {
    console.error(".env.local not found; it should hold the DATABASE_URL to copy users from.");
    process.exit(1);
  }
  const { parse } = await import("dotenv");
  const sourceUrl = parse(readFileSync(sourceFile, "utf8")).DATABASE_URL ?? "";
  let sourceHost;
  try {
    sourceHost = new URL(sourceUrl).hostname;
  } catch {
    console.error(".env.local does not contain a valid DATABASE_URL.");
    process.exit(1);
  }
  if (LOCAL_HOSTS.has(sourceHost)) {
    console.error("DATABASE_URL in .env.local already points at a local database; nothing to import.");
    process.exit(1);
  }

  const { PrismaClient } = await import("@prisma/client");
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  let users;
  try {
    const [, rows] = await source.$transaction([
      source.$executeRawUnsafe("SET TRANSACTION READ ONLY"),
      source.$queryRawUnsafe(
        `SELECT id, name, "passwordHash", role, active, "createdAt", "updatedAt", "deletedAt" FROM "User" ORDER BY "createdAt"`,
      ),
    ]);
    users = rows;
  } finally {
    await source.$disconnect();
  }

  const local = new PrismaClient({ datasources: { db: { url: LOCAL_DB_URL } } });
  try {
    const skipped = [];
    for (const u of users) {
      // e.g. the placeholder "Farhan" (id seed_farhan) inserted by migration 20260414235500 on a fresh database.
      const clash = await local.user.findFirst({
        where: { name: u.name, id: { not: u.id } },
        select: {
          id: true,
          _count: { select: { events: true, weddingMemberships: true, eventRoles: true, eventAllocations: true, managedGuests: true, guestCommunicationLogs: true } },
        },
      });
      if (clash) {
        if (Object.values(clash._count).some((n) => n > 0)) {
          console.warn(`  ⚠ Skipped "${u.name}": local user ${clash.id} has the same name and owns local data.`);
          skipped.push(u.name);
          continue;
        }
        await local.user.delete({ where: { id: clash.id } });
        console.log(`  Replaced unused local user ${clash.id} ("${u.name}").`);
      }
      await local.user.upsert({ where: { id: u.id }, create: u, update: u });
    }
    users = users.filter((u) => !skipped.includes(u.name));
  } finally {
    await local.$disconnect();
  }
  console.log(`Copied ${users.length} user(s) from ${sourceHost} into the local database: ${users.map((u) => u.name).join(", ")}.`);
  console.log("Passwords are unchanged (the same hashes). No events, guests or other data were copied.");
}

function writeEnvFile() {
  const lines = [
    "# Local development database (see README → Local development).",
    "# `next dev` loads this file before .env.local, so the dev server never uses the hosted database.",
    `DATABASE_URL="${LOCAL_DB_URL}"`,
    `DIRECT_URL="${LOCAL_DB_URL}"`,
    "",
  ].join("\n");
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, lines);
    console.log("Wrote .env.development.local (local database URLs only).");
    return;
  }
  const current = readFileSync(ENV_FILE, "utf8");
  if (!current.includes(LOCAL_DB_URL)) {
    console.warn(
      ".env.development.local exists but does not point DATABASE_URL/DIRECT_URL at the local database.\n" +
        `Set both to ${LOCAL_DB_URL} to use it.`,
    );
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "start":
      if (!start()) console.log(`Local PostgreSQL already running on 127.0.0.1:${LOCAL_DB_PORT}.`);
      break;
    case "stop":
      stop();
      break;
    case "status":
      console.log(isRunning() ? `Running on 127.0.0.1:${LOCAL_DB_PORT}, database ${LOCAL_DB_NAME}.` : "Not running.");
      console.log(`Data directory: ${path.relative(ROOT, DATA_DIR)}`);
      if (isRunning()) prisma(["migrate", "status"]);
      break;
    case "migrate":
      start();
      migrate();
      break;
    case "seed":
      start();
      seed();
      break;
    case "setup":
      start();
      writeEnvFile();
      prisma(["generate"], { quiet: true });
      migrate();
      console.log(
        "Next: `npm run db:local:import-users` to sign in with your usual accounts, or `npm run db:local:seed` for a fictional demo wedding.",
      );
      break;
    case "reset":
      if (!rest.includes("--yes")) {
        console.error(`This deletes every row in the local database ${LOCAL_DB_NAME}. Re-run with --yes to continue.`);
        process.exit(1);
      }
      start();
      prisma(["migrate", "reset", "--force", "--skip-seed"]);
      console.log("Run `npm run db:local:import-users` to restore your own sign-in accounts.");
      break;
    case "remove-demo":
      start();
      await removeDemo();
      break;
    case "import-users":
      start();
      migrate({ quiet: true });
      await importUsers();
      break;
    case "prisma":
      start();
      process.exit(prisma(rest).status ?? 1);
      break;
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*?/, "").replace(/^ \* ?/gm, ""));
      process.exit(cmd ? 1 : 0);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

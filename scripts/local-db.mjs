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
 *   node scripts/local-db.mjs seed      (re)load the fictional demo wedding into the separate rsvp_demo database
 *   node scripts/local-db.mjs remove-demo [--yes]   report (or, with --yes, back up and delete) demo rows
 *                                            that an older version seeded into rsvp_dev
 *   node scripts/local-db.mjs restore-snapshot <dir>   put back a data directory snapshot from remove-demo
 *   node scripts/local-db.mjs reset --yes   drop the local database and re-apply every migration
 *   node scripts/local-db.mjs import-users   copy sign-in accounts (names, roles, password hashes)
 *                                            from the database in .env.local; read-only there
 *   node scripts/local-db.mjs prisma <args>  run any Prisma CLI command against the local database
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync, cpSync, renameSync, rmSync } from "node:fs";
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
/** The fictional demo wedding lives in its own database so it never mixes with real local accounts. */
export const LOCAL_DEMO_DB_NAME = "rsvp_demo";
export const LOCAL_DEMO_DB_URL = `postgresql://postgres@127.0.0.1:${LOCAL_DB_PORT}/${LOCAL_DEMO_DB_NAME}`;
const BACKUP_DIR = path.join(ROOT, ".local", "backups");

/** Fixed identifiers written by scripts/seed-demo.ts. Cleanup matches these only, never display names. */
const DEMO_FINGERPRINT = {
  userIds: ["demo_aisha", "demo_omar", "demo_platform_admin"],
  weddingBackfillKey: "demo-aisha-omar",
  eventSlugs: ["demo-mehndi", "demo-nikkah", "demo-reception"],
};
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

function prismaEnv(url = LOCAL_DB_URL) {
  return { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
}

function prisma(args, opts = {}) {
  return run(path.join(ROOT, "node_modules", ".bin", "prisma"), args, { ...opts, env: prismaEnv(opts.url) });
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

export function migrate({ quiet = false, url = LOCAL_DB_URL } = {}) {
  const res = prisma(["migrate", "deploy"], { quiet, url });
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

/** Creates the demo database if needed, applies migrations to it, and loads the fictional wedding there. */
async function seedDemo() {
  const { PrismaClient } = await import("./prisma-client.mjs");
  const admin = new PrismaClient({ datasources: { db: { url: LOCAL_DB_URL } } });
  try {
    const rows = await admin.$queryRawUnsafe(`SELECT 1 FROM pg_database WHERE datname = '${LOCAL_DEMO_DB_NAME}'`);
    if (rows.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE ${LOCAL_DEMO_DB_NAME}`);
      console.log(`Created the separate demo database ${LOCAL_DEMO_DB_NAME}.`);
    }
  } finally {
    await admin.$disconnect();
  }
  migrate({ quiet: true, url: LOCAL_DEMO_DB_URL });
  const res = run(path.join(ROOT, "node_modules", ".bin", "tsx"), ["scripts/seed-demo.ts"], { env: prismaEnv(LOCAL_DEMO_DB_URL) });
  if (res.status !== 0) process.exit(res.status ?? 1);
  console.log("Start the app on the demo database with `npm run dev:demo`.");
}

/** Every row the demo seed created, found by its fixed identifiers, plus anything that points at them. */
async function demoInventory(db) {
  const users = await db.user.findMany({ where: { id: { in: DEMO_FINGERPRINT.userIds } }, select: { id: true, name: true } });
  const userIds = users.map((u) => u.id);
  const wedding = await db.wedding.findUnique({
    where: { backfillKey: DEMO_FINGERPRINT.weddingBackfillKey },
    select: { id: true, name: true, memberships: { select: { userId: true } } },
  });
  const weddingIds = wedding ? [wedding.id] : [];
  const events = await db.event.findMany({
    where: { OR: [{ weddingId: { in: weddingIds } }, { slug: { in: DEMO_FINGERPRINT.eventSlugs } }, { ownerUserId: { in: userIds } }] },
    select: { id: true, title: true, slug: true, weddingId: true },
  });
  const eventIds = events.map((e) => e.id);
  const byEventOrUser = { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] };
  const blockers = [];
  if (wedding?.memberships.some((m) => !userIds.includes(m.userId))) blockers.push(`wedding "${wedding.name}" has members who are not demo accounts`);
  for (const e of events) {
    if (!DEMO_FINGERPRINT.eventSlugs.includes(e.slug)) blockers.push(`event "${e.title}" (${e.slug}) was not created by the demo seed`);
    if (e.weddingId && !weddingIds.includes(e.weddingId)) blockers.push(`event "${e.title}" belongs to a non-demo wedding`);
  }
  const realMemberships = await db.weddingMembership.count({ where: { userId: { in: userIds }, weddingId: { notIn: weddingIds } } });
  if (realMemberships) blockers.push(`${realMemberships} demo account membership(s) in non-demo weddings`);
  const guestsManagedByReal = await db.guest.count({ where: { eventId: { in: eventIds }, managedByUserId: { notIn: userIds, not: null } } });
  if (guestsManagedByReal) blockers.push(`${guestsManagedByReal} household(s) in demo events are managed by non-demo accounts`);

  const rows = {
    users: await db.user.findMany({ where: { id: { in: userIds } } }),
    weddings: await db.wedding.findMany({ where: { id: { in: weddingIds } } }),
    weddingMemberships: await db.weddingMembership.findMany({ where: { weddingId: { in: weddingIds } } }),
    events: await db.event.findMany({ where: { id: { in: eventIds } } }),
    eventRoles: await db.eventRole.findMany({ where: { eventId: { in: eventIds } } }),
    eventAllocations: await db.eventAllocation.findMany({ where: { eventId: { in: eventIds } } }),
    guests: await db.guest.findMany({ where: { eventId: { in: eventIds } } }),
    rsvpActivities: await db.rsvpActivity.findMany({ where: { eventId: { in: eventIds } } }),
    guestCommunicationLogs: await db.guestCommunicationLog.findMany({ where: { eventId: { in: eventIds } } }),
    vendors: await db.vendor.findMany({ where: { weddingId: { in: weddingIds } } }),
    budgetItems: await db.budgetItem.findMany({ where: { weddingId: { in: weddingIds } } }),
    budgetPayments: await db.budgetPayment.findMany({ where: { budgetItem: { weddingId: { in: weddingIds } } } }),
    auditActivities: await db.auditActivity.findMany({ where: byEventOrUser }),
    notifications: await db.notification.findMany({ where: byEventOrUser }),
  };
  // Audit rows written by real accounts about demo records (for example "moved Demo Aisha to trash") are kept.
  const removedAuditIds = new Set(rows.auditActivities.map((a) => a.id));
  const keptAudit = (await db.auditActivity.findMany({ where: { entityId: { in: [...userIds, ...eventIds] } }, select: { id: true } })).filter(
    (a) => !removedAuditIds.has(a.id),
  ).length;
  return { users, wedding, events, userIds, weddingIds, eventIds, byEventOrUser, rows, blockers, keptAudit };
}

/** Dry run by default. With --yes: snapshot the data directory, export the rows as JSON, then delete them. */
async function removeDemo({ apply }) {
  const { PrismaClient } = await import("./prisma-client.mjs");
  let db = new PrismaClient({ datasources: { db: { url: LOCAL_DB_URL } } });
  let inv;
  try {
    inv = await demoInventory(db);
  } finally {
    await db.$disconnect();
  }
  console.log(`Demo data in ${LOCAL_DB_NAME} (matched by seed identifiers only):`);
  for (const [k, list] of Object.entries(inv.rows)) console.log(`  ${k.padEnd(24)} ${list.length}`);
  console.log(`  accounts: ${inv.users.map((u) => `${u.name} (${u.id})`).join(", ") || "none"}`);
  console.log(`  wedding:  ${inv.wedding ? `${inv.wedding.name} (${inv.wedding.id})` : "none"}`);
  console.log(`  kept: ${inv.keptAudit} audit entr${inv.keptAudit === 1 ? "y" : "ies"} written by non-demo accounts about demo records`);
  if (inv.blockers.length) {
    console.error(`Refusing to remove anything:\n  - ${inv.blockers.join("\n  - ")}`);
    process.exit(1);
  }
  const total = Object.values(inv.rows).reduce((s, l) => s + l.length, 0);
  if (total === 0) {
    console.log("Nothing to remove.");
    return;
  }
  if (!apply) {
    console.log("Dry run only. Re-run with --yes to back up and remove these rows.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(BACKUP_DIR, { recursive: true });
  const jsonFile = path.join(BACKUP_DIR, `demo-cleanup-${stamp}.json`);
  writeFileSync(jsonFile, JSON.stringify({ database: LOCAL_DB_NAME, createdAt: new Date().toISOString(), rows: inv.rows }, null, 2));
  const snapshotDir = path.join(BACKUP_DIR, `pgdata-before-demo-cleanup-${stamp}`);
  stop();
  cpSync(DATA_DIR, snapshotDir, { recursive: true });
  start();
  console.log(`Backed up to ${path.relative(ROOT, snapshotDir)} (full data directory) and ${path.relative(ROOT, jsonFile)} (removed rows).`);

  db = new PrismaClient({ datasources: { db: { url: LOCAL_DB_URL } } });
  try {
    const { eventIds, weddingIds, userIds, byEventOrUser } = inv;
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
    console.log(`Removed: ${Object.entries(removed).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
    console.log(`To undo: npm run db:local -- restore-snapshot ${path.relative(ROOT, snapshotDir)}`);
  } finally {
    await db.$disconnect();
  }
}

/** Replaces the live data directory with a snapshot taken by remove-demo (the current one is kept aside). */
function restoreSnapshot(dir) {
  const source = path.resolve(ROOT, dir ?? "");
  if (!dir || !existsSync(path.join(source, "PG_VERSION"))) {
    console.error("Pass a snapshot directory created by remove-demo, e.g. .local/backups/pgdata-before-demo-cleanup-…");
    process.exit(1);
  }
  stop();
  const aside = `${DATA_DIR}-replaced-${Date.now()}`;
  renameSync(DATA_DIR, aside);
  cpSync(source, DATA_DIR, { recursive: true });
  rmSync(path.join(DATA_DIR, "postmaster.pid"), { force: true });
  start();
  console.log(`Restored ${path.relative(ROOT, source)}. The previous data directory is at ${path.relative(ROOT, aside)}.`);
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

  const { PrismaClient } = await import("./prisma-client.mjs");
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
    case "seed-demo":
      start();
      await seedDemo();
      break;
    case "restore-snapshot":
      restoreSnapshot(rest[0]);
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
      await removeDemo({ apply: rest.includes("--yes") });
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

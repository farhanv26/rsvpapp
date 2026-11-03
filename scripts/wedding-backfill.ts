/**
 * Legacy → wedding workspace backfill.
 *
 * This script never reads .env files. Pass the target database explicitly, e.g.
 *   DATABASE_URL="postgresql://…" npx tsx scripts/wedding-backfill.ts report --out report.json --draft mapping.draft.json
 *   DATABASE_URL="postgresql://…" npx tsx scripts/wedding-backfill.ts validate --mapping mapping.json
 *   DATABASE_URL="postgresql://…" npx tsx scripts/wedding-backfill.ts apply --mapping mapping.json            (dry run)
 *   DATABASE_URL="postgresql://…" BACKFILL_CONFIRM_DB_HOST=<host> npx tsx scripts/wedding-backfill.ts apply --mapping mapping.json --execute
 *   DATABASE_URL="postgresql://…" npx tsx scripts/wedding-backfill.ts repair-shared-guests --out repair.json   (dry run)
 *   DATABASE_URL="postgresql://…" BACKFILL_CONFIRM_DB_HOST=<host> npx tsx scripts/wedding-backfill.ts repair-shared-guests --execute
 *
 * Every command is a dry run unless --execute is given, and --execute additionally requires
 * BACKFILL_CONFIRM_DB_HOST to equal the host in DATABASE_URL. Report files contain event titles
 * and account names: keep them out of git.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "./prisma-client.mjs";
import {
  buildBackfillReport,
  planBackfillApply,
  planSharedGuestRepair,
  validateMapping,
  type WeddingMappingFile,
} from "../lib/wedding-backfill";
import {
  applyBackfillPlan,
  applySharedGuestRepair,
  loadBackfillState,
  loadRepairInputs,
} from "../lib/wedding-backfill-runner";

type Flags = Map<string, string | true>;

function parseArgs(argv: string[]): { command: string; flags: Flags } {
  const [command = "help", ...rest] = argv;
  const flags: Flags = new Map();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]!;
    if (!token.startsWith("--")) continue;
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(token.slice(2), next);
      i += 1;
    } else {
      flags.set(token.slice(2), true);
    }
  }
  return { command, flags };
}

function databaseHost(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) throw new Error("DATABASE_URL is not set. Pass the target database explicitly.");
  try {
    return new URL(raw).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
}

function writeJson(path: string | true | undefined, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  if (typeof path === "string") {
    writeFileSync(path, `${text}\n`);
    console.log(`Wrote ${path}`);
  } else {
    console.log(text);
  }
}

function readMapping(flags: Flags): WeddingMappingFile {
  const path = flags.get("mapping");
  if (typeof path !== "string") throw new Error("--mapping <file.json> is required.");
  return JSON.parse(readFileSync(path, "utf8")) as WeddingMappingFile;
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "help" || flags.has("help")) {
    console.log("Commands: report | validate | apply | repair-shared-guests. See header of scripts/wedding-backfill.ts.");
    return;
  }

  const host = databaseHost();
  const execute = flags.get("execute") === true;
  console.log(`Target database host: ${host}${execute ? " (EXECUTE)" : " (dry run)"}`);
  if (execute && process.env.BACKFILL_CONFIRM_DB_HOST !== host) {
    throw new Error(`Refusing to write: set BACKFILL_CONFIRM_DB_HOST=${host} to confirm the target database.`);
  }

  const prisma = new PrismaClient();
  try {
    if (command === "report") {
      const report = buildBackfillReport(await loadBackfillState(prisma));
      const t = report.totals;
      console.log(
        `Events: ${t.events} · assigned: ${t.alreadyAssigned} · unassigned: ${t.unassigned} · needing review: ${t.unassignedNeedingReview} · unowned: ${t.unowned}`,
      );
      writeJson(flags.get("out"), { totals: report.totals, events: report.events });
      if (flags.has("draft")) writeJson(flags.get("draft"), report.draftMapping);
      return;
    }

    if (command === "validate" || command === "apply") {
      const state = await loadBackfillState(prisma);
      const mapping = readMapping(flags);
      const validation = validateMapping(mapping, state, { requireApproval: command === "apply" });
      for (const issue of validation.issues) {
        console.log(`${issue.level === "error" ? "ERROR  " : "warning"} [${issue.code}] ${issue.message}`);
      }
      if (!validation.ok) {
        process.exitCode = 1;
        console.log("Mapping is NOT valid. Nothing was written.");
        return;
      }
      const plan = planBackfillApply(validation.resolved, state);
      console.log(
        `Plan: create ${plan.createWeddings.length} wedding(s), ${plan.createMemberships.length} membership(s), assign ${plan.assignEvents.length} event(s).`,
      );
      writeJson(flags.get("out"), plan);
      if (command === "validate" || !execute) {
        console.log("Dry run only. Nothing was written.");
        return;
      }
      await applyBackfillPlan(prisma, plan, validation.resolved, mapping.approvedBy ?? null);
      console.log("Backfill applied. Re-run `apply` to confirm the plan is now empty.");
      return;
    }

    if (command === "repair-shared-guests") {
      const inputs = await loadRepairInputs(prisma);
      const plan = planSharedGuestRepair(inputs.guests, inputs.events);
      console.log(
        `Repair: ${plan.changes.length} guest(s) to fix; ${plan.skippedUnassigned.length} guest(s) in unassigned events skipped (map them first); ${plan.needsReview.length} incomplete record(s) need review.`,
      );
      writeJson(flags.get("out"), plan);
      if (!execute) {
        console.log("Dry run only. Nothing was written.");
        return;
      }
      const result = await applySharedGuestRepair(prisma, plan);
      console.log(`Repair applied to ${result.applied} guest(s); ${result.conflicts} skipped because they changed since planning.`);
      return;
    }

    throw new Error(`Unknown command "${command}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

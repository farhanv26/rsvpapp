/**
 * Database executor for the wedding backfill. Used by scripts/wedding-backfill.ts and the
 * integration tests. Planning rules live in lib/wedding-backfill.ts.
 */
import type { PrismaClient } from "@prisma/client";
import type {
  BackfillPlan,
  BackfillState,
  RepairGuest,
  ResolvedMappingWedding,
  SharedGuestRepairPlan,
} from "./wedding-backfill";

export async function loadBackfillState(prisma: PrismaClient): Promise<BackfillState> {
  const [events, users, weddings, memberships] = await Promise.all([
    prisma.event.findMany({
      select: { id: true, title: true, coupleNames: true, ownerUserId: true, weddingId: true, deletedAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ select: { id: true, name: true, role: true, active: true, deletedAt: true } }),
    prisma.wedding.findMany({ select: { id: true, name: true, backfillKey: true } }),
    prisma.weddingMembership.findMany({ select: { weddingId: true, userId: true, role: true } }),
  ]);
  return { events, users, weddings, memberships };
}

/** Applies a validated plan in one transaction; any concurrent change rolls everything back. */
export async function applyBackfillPlan(
  prisma: PrismaClient,
  plan: BackfillPlan,
  resolved: ResolvedMappingWedding[],
  approvedBy: string | null,
) {
  await prisma.$transaction(
    async (tx) => {
      for (const w of plan.createWeddings) {
        await tx.wedding.create({ data: { name: w.name, backfillKey: w.key } });
      }
      const keys = Array.from(new Set(resolved.map((w) => w.key)));
      const rows = await tx.wedding.findMany({ where: { backfillKey: { in: keys } }, select: { id: true, backfillKey: true } });
      const idByKey = new Map(rows.map((r) => [r.backfillKey!, r.id]));
      if (plan.createMemberships.length > 0) {
        await tx.weddingMembership.createMany({
          data: plan.createMemberships.map((m) => ({ weddingId: idByKey.get(m.key)!, userId: m.userId, role: m.role })),
          skipDuplicates: true,
        });
      }
      for (const key of keys) {
        const eventIds = plan.assignEvents.filter((a) => a.key === key).map((a) => a.eventId);
        if (eventIds.length === 0) continue;
        const result = await tx.event.updateMany({
          where: { id: { in: eventIds }, weddingId: null },
          data: { weddingId: idByKey.get(key)! },
        });
        if (result.count !== eventIds.length) {
          throw new Error(`Concurrent change detected for wedding ${key}; rolled back. Re-run validate.`);
        }
        await tx.auditActivity.create({
          data: {
            userName: "System (wedding backfill)",
            actionType: "wedding_backfill_applied",
            entityType: "Wedding",
            entityId: idByKey.get(key)!,
            entityName: key,
            message: `Backfill assigned ${eventIds.length} legacy event(s) to wedding "${key}".`,
            metadata: { eventIds, approvedBy },
          },
        });
      }
    },
    { timeout: 60_000 },
  );
}

const repairSelect = {
  id: true,
  eventId: true,
  createdAt: true,
  deletedAt: true,
  sharedGuestKey: true,
  countOwnerEventId: true,
  excludeFromTotals: true,
  excludeReason: true,
  excludedGuestCount: true,
  excludedMenCount: true,
  excludedWomenCount: true,
  excludedKidsCount: true,
  menCount: true,
  womenCount: true,
  kidsCount: true,
  maxGuests: true,
} as const;

/** Guests with a count-owner pointer, plus every guest sharing one of their keys (potential in-wedding matches). */
export async function loadRepairInputs(prisma: PrismaClient): Promise<{
  guests: RepairGuest[];
  events: { id: string; weddingId: string | null }[];
}> {
  const [pointing, events] = await Promise.all([
    prisma.guest.findMany({ where: { countOwnerEventId: { not: null } }, select: repairSelect }),
    prisma.event.findMany({ select: { id: true, weddingId: true } }),
  ]);
  const keys = Array.from(new Set(pointing.map((g) => g.sharedGuestKey).filter((k): k is string => Boolean(k))));
  const others = keys.length
    ? await prisma.guest.findMany({ where: { sharedGuestKey: { in: keys }, countOwnerEventId: null }, select: repairSelect })
    : [];
  return { guests: [...pointing, ...others], events };
}

/** Writes each change only if the guest still matches the planned "before" state. */
export async function applySharedGuestRepair(prisma: PrismaClient, plan: SharedGuestRepairPlan) {
  let applied = 0;
  let conflicts = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const change of plan.changes) {
        const result = await tx.guest.updateMany({
          where: {
            id: change.guestId,
            countOwnerEventId: change.before.countOwnerEventId,
            excludeReason: change.before.excludeReason,
          },
          data: change.after,
        });
        if (result.count === 1) applied += 1;
        else conflicts += 1;
      }
    },
    { timeout: 60_000 },
  );
  return { applied, conflicts };
}

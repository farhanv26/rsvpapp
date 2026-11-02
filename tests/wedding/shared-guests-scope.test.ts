import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildSharedGuestKey,
  buildSharedGuestMatchWhere,
  buildSharedGuestSiblingsWhere,
  resolveSharedGuestState,
  sanitizeCountOwnerEventId,
} from "@/lib/shared-guests";

type Row = Record<string, unknown>;

/** Minimal evaluator for the Prisma filters used by lib/shared-guests.ts. */
function matches(row: Row, where: Row, events: Row[]): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "event") {
      const ev = events.find((e) => e.id === row.eventId);
      return Boolean(ev) && matches(ev!, cond as Row, events);
    }
    const value = row[key];
    if (cond !== null && typeof cond === "object" && "not" in (cond as Row)) {
      return value !== (cond as Row).not;
    }
    return value === cond;
  });
}

function fakePrisma(events: Row[], guests: Row[]) {
  return {
    event: {
      findUnique: async ({ where }: { where: Row }) => events.find((e) => e.id === where.id) ?? null,
      findFirst: async ({ where }: { where: Row }) => events.find((e) => matches(e, where, events)) ?? null,
    },
    guest: {
      findFirst: async ({ where }: { where: Row }) =>
        [...guests]
          .sort((a, b) => (a.createdAt as number) - (b.createdAt as number))
          .find((g) => matches(g, where, events)) ?? null,
    },
  } as unknown as PrismaClient;
}

const events = [
  { id: "a-mehndi", weddingId: "w-a" },
  { id: "a-walima", weddingId: "w-a" },
  { id: "b-nikkah", weddingId: "w-b" },
  { id: "legacy-1", weddingId: null },
  { id: "legacy-2", weddingId: null },
];
const khanKey = buildSharedGuestKey({ guestName: "The Khan Family" })!;

describe("shared-guest match filters", () => {
  it("are always bounded to the event's wedding", () => {
    expect(buildSharedGuestMatchWhere({ eventId: "a-walima", weddingId: "w-a" }, khanKey, "g1")).toEqual({
      sharedGuestKey: khanKey,
      deletedAt: null,
      eventId: { not: "a-walima" },
      event: { weddingId: "w-a" },
      id: { not: "g1" },
    });
    expect(buildSharedGuestSiblingsWhere({ eventId: "a-walima", weddingId: "w-a" }, khanKey, "g1")).toMatchObject({
      event: { weddingId: "w-a" },
    });
  });

  it("disable cross-event matching for events not yet assigned to a wedding", () => {
    expect(buildSharedGuestMatchWhere({ eventId: "legacy-1", weddingId: null }, khanKey)).toBeNull();
    expect(buildSharedGuestSiblingsWhere({ eventId: "legacy-1", weddingId: null }, khanKey, "g1")).toBeNull();
  });
});

describe("resolveSharedGuestState across two weddings with identically named households", () => {
  const guests = [
    { id: "ga1", eventId: "a-mehndi", sharedGuestKey: khanKey, countOwnerEventId: null, deletedAt: null, createdAt: 1 },
    { id: "gl1", eventId: "legacy-1", sharedGuestKey: khanKey, countOwnerEventId: null, deletedAt: null, createdAt: 2 },
  ];
  const prisma = fakePrisma(events, guests);

  it("never matches a household in another wedding", async () => {
    const state = await resolveSharedGuestState(prisma, { eventId: "b-nikkah", guestName: "The Khan Family" });
    expect(state).toMatchObject({
      sharedGuestKey: khanKey,
      isSharedAcrossEvents: false,
      countOwnerEventId: null,
      shouldExcludeFromTotals: false,
    });
  });

  it("detects the same household within a wedding without excluding it from either event", async () => {
    const state = await resolveSharedGuestState(prisma, { eventId: "a-walima", guestName: "The Khan Family" });
    expect(state).toMatchObject({
      isSharedAcrossEvents: true,
      countOwnerEventId: null,
      shouldExcludeFromTotals: false,
      defaultExcludeReason: null,
    });
  });

  it("never matches between unassigned legacy events, even with the same owner", async () => {
    const state = await resolveSharedGuestState(prisma, { eventId: "legacy-2", guestName: "The Khan Family" });
    expect(state.isSharedAcrossEvents).toBe(false);
    expect(state.shouldExcludeFromTotals).toBe(false);
  });

  it("never adopts a contaminated count-owner pointer that leaves the wedding", async () => {
    const contaminated = fakePrisma(events, [
      { id: "ga1", eventId: "a-mehndi", sharedGuestKey: khanKey, countOwnerEventId: "b-nikkah", deletedAt: null, createdAt: 1 },
    ]);
    const state = await resolveSharedGuestState(contaminated, { eventId: "a-walima", guestName: "The Khan Family" });
    expect(state.countOwnerEventId).toBeNull();
    expect(state.shouldExcludeFromTotals).toBe(false);
  });

  it("rejects a scope that does not match the target event", async () => {
    await expect(
      resolveSharedGuestState(prisma, { eventId: "a-walima", guestName: "x" }, { eventId: "b-nikkah", weddingId: "w-b" }),
    ).rejects.toThrow();
  });
});

describe("sanitizeCountOwnerEventId", () => {
  const prisma = fakePrisma(events, []);
  it("accepts the event itself or another event in the same wedding", async () => {
    expect(await sanitizeCountOwnerEventId(prisma, { eventId: "a-walima", weddingId: "w-a" }, "a-walima")).toBe("a-walima");
    expect(await sanitizeCountOwnerEventId(prisma, { eventId: "a-walima", weddingId: "w-a" }, "a-mehndi")).toBe("a-mehndi");
  });
  it("rejects events from another wedding or unknown ids", async () => {
    expect(await sanitizeCountOwnerEventId(prisma, { eventId: "a-walima", weddingId: "w-a" }, "b-nikkah")).toBeNull();
    expect(await sanitizeCountOwnerEventId(prisma, { eventId: "a-walima", weddingId: "w-a" }, "nope")).toBeNull();
    expect(await sanitizeCountOwnerEventId(prisma, { eventId: "legacy-1", weddingId: null }, "legacy-2")).toBeNull();
    expect(await sanitizeCountOwnerEventId(prisma, { eventId: "a-walima", weddingId: "w-a" }, "  ")).toBeNull();
  });
});

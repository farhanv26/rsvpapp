import { describe, expect, it } from "vitest";
import {
  buildBackfillReport,
  planBackfillApply,
  planSharedGuestRepair,
  validateMapping,
  type BackfillState,
  type RepairGuest,
  type WeddingMappingFile,
} from "@/lib/wedding-backfill";

const t = (n: number) => new Date(Date.UTC(2026, 0, n));

/**
 * Synthetic legacy data (fictional):
 * - Sara owns two events for two *different* weddings (couple names differ).
 * - Yusuf and Hana own one event each for the *same* wedding (same couple names).
 * - Omar owns a single, unambiguous event.
 * - One event has no owner; one is owned by a deactivated account; one is soft-deleted.
 */
function legacyState(): BackfillState {
  return {
    users: [
      { id: "u-sara", name: "Sara", role: "event_creator", active: true, deletedAt: null },
      { id: "u-yusuf", name: "Yusuf", role: "event_creator", active: true, deletedAt: null },
      { id: "u-hana", name: "Hana", role: "event_creator", active: true, deletedAt: null },
      { id: "u-omar", name: "Omar", role: "event_creator", active: true, deletedAt: null },
      { id: "u-old", name: "Old Planner", role: "event_creator", active: false, deletedAt: null },
      { id: "u-gone", name: "Gone", role: "event_creator", active: false, deletedAt: t(3) },
    ],
    events: [
      { id: "e-sara-1", title: "Mehndi", coupleNames: "Amna & Bilal", ownerUserId: "u-sara", weddingId: null, deletedAt: null, createdAt: t(1) },
      { id: "e-sara-2", title: "Walima", coupleNames: "Zara & Imran", ownerUserId: "u-sara", weddingId: null, deletedAt: null, createdAt: t(2) },
      { id: "e-yusuf", title: "Nikkah", coupleNames: "Layla and Noor", ownerUserId: "u-yusuf", weddingId: null, deletedAt: null, createdAt: t(3) },
      { id: "e-hana", title: "Reception", coupleNames: "Noor & Layla", ownerUserId: "u-hana", weddingId: null, deletedAt: null, createdAt: t(4) },
      { id: "e-omar", title: "Wedding", coupleNames: "Mina & Omar", ownerUserId: "u-omar", weddingId: null, deletedAt: null, createdAt: t(5) },
      { id: "e-unowned", title: "Old event", coupleNames: null, ownerUserId: null, weddingId: null, deletedAt: null, createdAt: t(6) },
      { id: "e-inactive", title: "Dholki", coupleNames: "Rania & Sami", ownerUserId: "u-old", weddingId: null, deletedAt: null, createdAt: t(7) },
      { id: "e-deleted", title: "Trial", coupleNames: "Mina & Omar", ownerUserId: "u-omar", weddingId: null, deletedAt: t(8), createdAt: t(8) },
    ],
    weddings: [],
    memberships: [],
  };
}

describe("buildBackfillReport", () => {
  const report = buildBackfillReport(legacyState());
  const row = (id: string) => report.events.find((e) => e.eventId === id)!;

  it("flags an owner with events for different couples instead of merging them", () => {
    expect(row("e-sara-1").flags).toEqual(
      expect.arrayContaining(["owner_has_multiple_unassigned_events", "couple_names_differ_within_owner"]),
    );
    expect(row("e-sara-1").needsReview).toBe(true);
  });

  it("flags the same couple appearing under different owners instead of splitting them silently", () => {
    expect(row("e-yusuf").flags).toContain("couple_names_shared_with_other_owner");
    expect(row("e-hana").flags).toContain("couple_names_shared_with_other_owner");
  });

  it("flags unowned, inactive-owner and deleted events", () => {
    expect(row("e-unowned").flags).toEqual(expect.arrayContaining(["unowned", "missing_couple_names"]));
    expect(row("e-inactive").flags).toContain("owner_inactive");
    expect(row("e-deleted").flags).toContain("deleted");
    expect(report.totals.unowned).toBe(1);
  });

  it("produces an unapproved draft that never auto-places unowned events", () => {
    const draft = report.draftMapping;
    expect(draft.approved).toBe(false);
    expect(draft.leaveUnassigned).toContain("e-unowned");
    const sara = draft.weddings.filter((w) => w.members.some((m) => m.userId === "u-sara"));
    expect(sara).toHaveLength(2);
    expect(sara.every((w) => w.needsReview)).toBe(true);
    const omar = draft.weddings.find((w) => w.eventIds.includes("e-omar"))!;
    expect(omar.eventIds).toEqual(expect.arrayContaining(["e-omar", "e-deleted"]));
  });

  it("refuses the raw draft until it is reviewed and approved", () => {
    const result = validateMapping(report.draftMapping, legacyState(), { requireApproval: true });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["not_approved", "needs_review"]));
  });
});

function approvedMapping(): WeddingMappingFile {
  return {
    version: 1,
    approved: true,
    approvedBy: "ops-review",
    weddings: [
      { key: "amna-bilal", name: "Amna & Bilal", members: [{ userId: "u-sara", role: "owner" }], eventIds: ["e-sara-1"] },
      { key: "zara-imran", name: "Zara & Imran", members: [{ userId: "u-sara", role: "owner" }], eventIds: ["e-sara-2"] },
      {
        key: "layla-noor",
        name: "Layla & Noor",
        members: [
          { userId: "u-yusuf", role: "owner" },
          { userName: "Hana", role: "owner" },
        ],
        eventIds: ["e-yusuf", "e-hana"],
      },
      { key: "mina-omar", name: "Mina & Omar", members: [{ userId: "u-omar", role: "owner" }], eventIds: ["e-omar", "e-deleted"] },
      {
        key: "rania-sami",
        name: "Rania & Sami",
        members: [
          { userId: "u-old", role: "owner" },
          { userId: "u-omar", role: "member" },
        ],
        eventIds: ["e-inactive"],
      },
    ],
    leaveUnassigned: ["e-unowned"],
  };
}

describe("validateMapping", () => {
  it("accepts a reviewed, approved mapping and keeps every legacy owner's access", () => {
    const result = validateMapping(approvedMapping(), legacyState(), { requireApproval: true });
    expect(result.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => i.code)).toContain("inactive_user");
  });

  it("rejects mappings where a legacy owner would lose access", () => {
    const mapping = approvedMapping();
    mapping.weddings[2]!.members = [{ userId: "u-yusuf", role: "owner" }];
    const result = validateMapping(mapping, legacyState());
    expect(result.ok).toBe(false);
    expect(result.issues.find((i) => i.code === "owner_would_lose_access")?.message).toContain("e-hana");
  });

  it("rejects events claimed twice, weddings without an owner, unknown and deleted users", () => {
    const mapping = approvedMapping();
    mapping.weddings[0]!.eventIds.push("e-sara-2");
    mapping.weddings[1]!.members = [{ userId: "u-sara", role: "member" }];
    mapping.weddings[3]!.members.push({ userId: "u-gone", role: "member" }, { userName: "Nobody", role: "member" });
    const codes = validateMapping(mapping, legacyState()).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["event_claimed_twice", "no_owner", "deleted_user", "unknown_user"]));
  });

  it("warns about unassigned events left out of the mapping", () => {
    const mapping = approvedMapping();
    mapping.leaveUnassigned = [];
    const result = validateMapping(mapping, legacyState());
    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({ level: "warning", code: "unmapped_event" }));
  });
});

describe("planBackfillApply", () => {
  it("is idempotent: once applied, re-planning yields nothing", () => {
    const state = legacyState();
    const { resolved } = validateMapping(approvedMapping(), state, { requireApproval: true });
    const first = planBackfillApply(resolved, state);
    expect(first.createWeddings).toHaveLength(5);
    expect(first.assignEvents.map((a) => a.eventId).sort()).toEqual(
      ["e-deleted", "e-hana", "e-inactive", "e-omar", "e-sara-1", "e-sara-2", "e-yusuf"].sort(),
    );

    const applied: BackfillState = {
      ...state,
      weddings: first.createWeddings.map((w) => ({ id: `id-${w.key}`, name: w.name, backfillKey: w.key })),
      memberships: first.createMemberships.map((m) => ({ weddingId: `id-${m.key}`, userId: m.userId, role: m.role })),
      events: state.events.map((e) => {
        const a = first.assignEvents.find((x) => x.eventId === e.id);
        return a ? { ...e, weddingId: `id-${a.key}` } : e;
      }),
    };
    const revalidated = validateMapping(approvedMapping(), applied, { requireApproval: true });
    expect(revalidated.ok).toBe(true);
    expect(planBackfillApply(revalidated.resolved, applied)).toEqual({ createWeddings: [], createMemberships: [], assignEvents: [] });
  });

  it("never reassigns an event that already belongs to a different wedding", () => {
    const state = legacyState();
    state.weddings = [{ id: "w-other", name: "Other", backfillKey: null }];
    state.events = state.events.map((e) => (e.id === "e-omar" ? { ...e, weddingId: "w-other" } : e));
    const result = validateMapping(approvedMapping(), state);
    expect(result.issues.map((i) => i.code)).toContain("event_already_assigned");
  });
});

describe("planSharedGuestRepair", () => {
  const events = [
    { id: "a-mehndi", weddingId: "w-a" },
    { id: "a-walima", weddingId: "w-a" },
    { id: "b-nikkah", weddingId: "w-b" },
    { id: "legacy", weddingId: null },
  ];
  const base = {
    deletedAt: null,
    sharedGuestKey: "n:the khan family",
    excludeFromTotals: false,
    excludeReason: null,
    excludedGuestCount: 0,
    excludedMenCount: 0,
    excludedWomenCount: 0,
    excludedKidsCount: 0,
    menCount: 2,
    womenCount: 2,
    kidsCount: 0,
    maxGuests: 4,
  };
  const autoExcluded = {
    excludeFromTotals: true,
    excludeReason: "Duplicate guest in another event",
    excludedGuestCount: 4,
    excludedMenCount: 2,
    excludedWomenCount: 2,
    excludedKidsCount: 0,
  };

  it("clears an automatic whole-household exclusion that points at an unrelated wedding", () => {
    const guests: RepairGuest[] = [
      { ...base, id: "ga", eventId: "a-mehndi", createdAt: t(1), countOwnerEventId: null },
      { ...base, ...autoExcluded, id: "gb", eventId: "b-nikkah", createdAt: t(2), countOwnerEventId: "a-mehndi" },
    ];
    const plan = planSharedGuestRepair(guests, events);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({
      guestId: "gb",
      after: { countOwnerEventId: null, excludeFromTotals: false, excludedGuestCount: 0, excludeReason: null },
    });
  });

  it("keeps manual exclusion counts, only dropping the cross-wedding pointer", () => {
    const guests: RepairGuest[] = [
      { ...base, ...autoExcluded, excludeReason: "Seated at family table", id: "gb", eventId: "b-nikkah", createdAt: t(2), countOwnerEventId: "a-mehndi" },
    ];
    const plan = planSharedGuestRepair(guests, events);
    expect(plan.changes[0]!.after).toMatchObject({ countOwnerEventId: null, excludeFromTotals: true, excludedGuestCount: 4, excludeReason: "Seated at family table" });
  });

  it("flags incomplete automatic records for review instead of rewriting them", () => {
    const partial = { ...autoExcluded, excludedGuestCount: 2, excludedMenCount: 2, excludedWomenCount: 0 };
    const guests: RepairGuest[] = [
      { ...base, ...partial, id: "gb", eventId: "b-nikkah", createdAt: t(2), countOwnerEventId: "a-mehndi" },
    ];
    const plan = planSharedGuestRepair(guests, events);
    expect(plan.changes).toEqual([]);
    expect(plan.needsReview).toEqual([{ guestId: "gb", eventId: "b-nikkah" }]);
  });

  it("leaves in-wedding pointers and unassigned events alone", () => {
    const guests: RepairGuest[] = [
      { ...base, ...autoExcluded, id: "ga2", eventId: "a-walima", createdAt: t(3), countOwnerEventId: "a-mehndi" },
      { ...base, ...autoExcluded, id: "gl", eventId: "legacy", createdAt: t(4), countOwnerEventId: "a-mehndi" },
    ];
    const plan = planSharedGuestRepair(guests, events);
    expect(plan.changes).toEqual([]);
    expect(plan.skippedUnassigned).toEqual([{ guestId: "gl", eventId: "legacy" }]);
  });
});

/**
 * Pure planning logic for assigning legacy events/users to wedding workspaces.
 * No database access here: scripts/wedding-backfill.ts loads rows, calls these functions and
 * executes the resulting plan. Keeping it pure lets the rules be tested on synthetic records.
 *
 * Principles:
 * - Nothing is inferred silently. Ownership never implies "same wedding", and different owners
 *   never imply "different weddings". The report only proposes a draft for human review.
 * - The mapping file is the approval: it must be marked `approved: true` and contain no
 *   wedding still flagged `needsReview`.
 * - Applying is additive and idempotent: weddings are keyed by `backfillKey`, memberships are
 *   only created (never downgraded or removed), and events are only assigned while unassigned.
 */
import { classifyExclusion } from "./attendance";

export type BackfillEvent = {
  id: string;
  title: string;
  coupleNames: string | null;
  ownerUserId: string | null;
  weddingId: string | null;
  deletedAt: Date | string | null;
  createdAt: Date | string;
};

export type BackfillUser = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  deletedAt: Date | string | null;
};

export type BackfillWedding = { id: string; name: string; backfillKey: string | null };
export type BackfillMembership = { weddingId: string; userId: string; role: string };

export type BackfillState = {
  events: BackfillEvent[];
  users: BackfillUser[];
  weddings: BackfillWedding[];
  memberships: BackfillMembership[];
};

export type MappingMember = { userId?: string; userName?: string; role: "owner" | "member" };

export type MappingWedding = {
  key: string;
  name: string;
  members: MappingMember[];
  eventIds: string[];
  needsReview?: boolean;
  reviewReasons?: string[];
  notes?: string;
};

export type WeddingMappingFile = {
  version: 1;
  approved: boolean;
  approvedBy?: string;
  weddings: MappingWedding[];
  /** Events deliberately left unassigned (they stay reachable only by their legacy owner). */
  leaveUnassigned?: string[];
};

export type EventReviewFlag =
  | "unowned"
  | "owner_missing"
  | "owner_inactive"
  | "owner_has_multiple_unassigned_events"
  | "couple_names_differ_within_owner"
  | "couple_names_shared_with_other_owner"
  | "missing_couple_names"
  | "deleted";

const AMBIGUOUS_FLAGS: ReadonlySet<EventReviewFlag> = new Set([
  "unowned",
  "owner_missing",
  "owner_inactive",
  "owner_has_multiple_unassigned_events",
  "couple_names_differ_within_owner",
  "couple_names_shared_with_other_owner",
]);

export type EventReportRow = {
  eventId: string;
  title: string;
  coupleNames: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  deleted: boolean;
  flags: EventReviewFlag[];
  needsReview: boolean;
};

export type BackfillReport = {
  totals: {
    events: number;
    alreadyAssigned: number;
    unassigned: number;
    unassignedNeedingReview: number;
    unowned: number;
  };
  events: EventReportRow[];
  draftMapping: WeddingMappingFile;
};

export function normalizeCoupleNames(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&|\band\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function isLiveUser(u: BackfillUser | undefined): u is BackfillUser {
  return Boolean(u && !u.deletedAt);
}

export function buildBackfillReport(state: BackfillState): BackfillReport {
  const usersById = new Map(state.users.map((u) => [u.id, u]));
  const unassigned = state.events.filter((e) => !e.weddingId);

  const byOwner = new Map<string, BackfillEvent[]>();
  const ownersByCouple = new Map<string, Set<string>>();
  for (const e of unassigned) {
    if (e.ownerUserId) {
      byOwner.set(e.ownerUserId, [...(byOwner.get(e.ownerUserId) ?? []), e]);
    }
    const couple = normalizeCoupleNames(e.coupleNames);
    if (couple) {
      const owners = ownersByCouple.get(couple) ?? new Set<string>();
      owners.add(e.ownerUserId ?? "__unowned__");
      ownersByCouple.set(couple, owners);
    }
  }

  const rows: EventReportRow[] = unassigned.map((e) => {
    const flags: EventReviewFlag[] = [];
    const owner = e.ownerUserId ? usersById.get(e.ownerUserId) : undefined;
    if (!e.ownerUserId) flags.push("unowned");
    else if (!owner) flags.push("owner_missing");
    else if (!owner.active || owner.deletedAt) flags.push("owner_inactive");

    const siblings = e.ownerUserId ? byOwner.get(e.ownerUserId) ?? [] : [];
    if (siblings.length > 1) {
      flags.push("owner_has_multiple_unassigned_events");
      const couples = new Set(siblings.map((s) => normalizeCoupleNames(s.coupleNames)));
      if (couples.size > 1) flags.push("couple_names_differ_within_owner");
    }
    const couple = normalizeCoupleNames(e.coupleNames);
    if (!couple) flags.push("missing_couple_names");
    else if ((ownersByCouple.get(couple)?.size ?? 0) > 1) flags.push("couple_names_shared_with_other_owner");
    if (e.deletedAt) flags.push("deleted");

    return {
      eventId: e.id,
      title: e.title,
      coupleNames: e.coupleNames,
      ownerUserId: e.ownerUserId,
      ownerName: owner?.name ?? null,
      deleted: Boolean(e.deletedAt),
      flags,
      needsReview: flags.some((f) => AMBIGUOUS_FLAGS.has(f)),
    };
  });

  return {
    totals: {
      events: state.events.length,
      alreadyAssigned: state.events.length - unassigned.length,
      unassigned: unassigned.length,
      unassignedNeedingReview: rows.filter((r) => r.needsReview).length,
      unowned: rows.filter((r) => r.flags.includes("unowned")).length,
    },
    events: rows,
    draftMapping: buildDraftMapping(rows, usersById),
  };
}

/**
 * Proposes one wedding per (owner, couple names) group, or per event when couple names are
 * missing. Every flagged group is marked needsReview; unowned events are left out entirely and
 * listed in leaveUnassigned so an operator must decide where they belong.
 */
function buildDraftMapping(rows: EventReportRow[], usersById: Map<string, BackfillUser>): WeddingMappingFile {
  const groups = new Map<string, EventReportRow[]>();
  const leaveUnassigned: string[] = [];
  for (const row of rows) {
    if (!row.ownerUserId || !isLiveUser(usersById.get(row.ownerUserId))) {
      leaveUnassigned.push(row.eventId);
      continue;
    }
    const couple = normalizeCoupleNames(row.coupleNames);
    const groupKey = `${row.ownerUserId}::${couple || `event:${row.eventId}`}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }

  const usedKeys = new Set<string>();
  const weddings: MappingWedding[] = [];
  for (const [, members] of groups) {
    const first = members[0]!;
    const base = `legacy-${slugPart(first.coupleNames || first.title) || "wedding"}-${first.ownerUserId!.slice(-6)}`;
    let key = base;
    for (let i = 2; usedKeys.has(key); i += 1) key = `${base}-${i}`;
    usedKeys.add(key);
    const reasons = Array.from(new Set(members.flatMap((m) => m.flags.filter((f) => AMBIGUOUS_FLAGS.has(f)))));
    weddings.push({
      key,
      name: first.coupleNames?.trim() || first.title,
      members: [{ userId: first.ownerUserId!, role: "owner" }],
      eventIds: members.map((m) => m.eventId),
      needsReview: reasons.length > 0,
      reviewReasons: reasons,
    });
  }

  return { version: 1, approved: false, weddings, leaveUnassigned };
}

export type ValidationIssue = { level: "error" | "warning"; code: string; message: string };

export type ResolvedMappingWedding = {
  key: string;
  name: string;
  members: { userId: string; role: "owner" | "member" }[];
  eventIds: string[];
};

export type MappingValidation = {
  ok: boolean;
  issues: ValidationIssue[];
  resolved: ResolvedMappingWedding[];
};

export function validateMapping(
  mapping: WeddingMappingFile,
  state: BackfillState,
  options: { requireApproval?: boolean } = {},
): MappingValidation {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ level: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ level: "warning", code, message });

  if (!mapping || mapping.version !== 1 || !Array.isArray(mapping.weddings)) {
    err("invalid_file", "Mapping must have version: 1 and a weddings array.");
    return { ok: false, issues, resolved: [] };
  }
  if (options.requireApproval && mapping.approved !== true) {
    err("not_approved", "Mapping is not approved. Set approved: true (and approvedBy) after review.");
  }

  const eventsById = new Map(state.events.map((e) => [e.id, e]));
  const usersById = new Map(state.users.map((u) => [u.id, u]));
  const liveUsersByName = new Map<string, BackfillUser[]>();
  for (const u of state.users) {
    if (u.deletedAt) continue;
    liveUsersByName.set(u.name, [...(liveUsersByName.get(u.name) ?? []), u]);
  }
  const weddingsById = new Map(state.weddings.map((w) => [w.id, w]));
  const weddingsByKey = new Map(state.weddings.filter((w) => w.backfillKey).map((w) => [w.backfillKey!, w]));
  const membershipKey = (weddingId: string, userId: string) => `${weddingId}::${userId}`;
  const existingMemberships = new Map(state.memberships.map((m) => [membershipKey(m.weddingId, m.userId), m]));

  const seenKeys = new Set<string>();
  const eventClaims = new Map<string, string>();
  const resolved: ResolvedMappingWedding[] = [];

  for (const leftId of mapping.leaveUnassigned ?? []) {
    if (!eventsById.has(leftId)) err("unknown_event", `leaveUnassigned references unknown event ${leftId}.`);
    eventClaims.set(leftId, "(leaveUnassigned)");
  }

  for (const w of mapping.weddings) {
    const label = w?.key ? `wedding "${w.key}"` : "a wedding entry";
    if (!w?.key?.trim()) err("missing_key", "Every wedding needs a stable, unique key.");
    if (!w?.name?.trim()) err("missing_name", `${label} needs a name.`);
    if (w?.key && seenKeys.has(w.key)) err("duplicate_key", `Duplicate wedding key "${w.key}".`);
    if (w?.key) seenKeys.add(w.key);
    if (w?.needsReview) err("needs_review", `${label} is still marked needsReview. Review it and set needsReview: false.`);

    const existingWedding = w?.key ? weddingsByKey.get(w.key) : undefined;
    if (existingWedding && existingWedding.name !== w.name) {
      warn("name_differs", `${label} already exists as "${existingWedding.name}"; its name will not be changed.`);
    }

    const members: ResolvedMappingWedding["members"] = [];
    const memberIds = new Set<string>();
    for (const m of w?.members ?? []) {
      if (m.role !== "owner" && m.role !== "member") {
        err("invalid_role", `${label} has a member with invalid role "${String(m.role)}".`);
        continue;
      }
      let user: BackfillUser | undefined;
      if (m.userId) {
        user = usersById.get(m.userId);
        if (!user) err("unknown_user", `${label} references unknown user id ${m.userId}.`);
      } else if (m.userName) {
        const matches = liveUsersByName.get(m.userName) ?? [];
        if (matches.length === 0) err("unknown_user", `${label} references unknown user name "${m.userName}".`);
        else if (matches.length > 1) err("ambiguous_user", `${label}: user name "${m.userName}" matches several accounts; use userId.`);
        else user = matches[0];
      } else {
        err("invalid_member", `${label} has a member without userId or userName.`);
      }
      if (!user) continue;
      if (user.deletedAt) {
        err("deleted_user", `${label} includes deleted user ${user.name}.`);
        continue;
      }
      if (!user.active) warn("inactive_user", `${label} includes inactive user ${user.name}; they cannot sign in until reactivated.`);
      if (memberIds.has(user.id)) {
        err("duplicate_member", `${label} lists ${user.name} more than once.`);
        continue;
      }
      memberIds.add(user.id);
      members.push({ userId: user.id, role: m.role });
      if (existingWedding) {
        const existing = existingMemberships.get(membershipKey(existingWedding.id, user.id));
        if (existing && existing.role !== m.role) {
          warn("role_differs", `${label}: ${user.name} is already ${existing.role}; existing roles are never changed by the backfill.`);
        }
      }
    }
    const hasOwner =
      members.some((m) => m.role === "owner") ||
      (existingWedding ? state.memberships.some((m) => m.weddingId === existingWedding.id && m.role === "owner") : false);
    if (!hasOwner) err("no_owner", `${label} must have at least one owner.`);

    const eventIds: string[] = [];
    for (const eventId of w?.eventIds ?? []) {
      const event = eventsById.get(eventId);
      if (!event) {
        err("unknown_event", `${label} references unknown event ${eventId}.`);
        continue;
      }
      const prior = eventClaims.get(eventId);
      if (prior) {
        err("event_claimed_twice", `Event ${eventId} is listed in both ${prior} and ${label}.`);
        continue;
      }
      eventClaims.set(eventId, label);
      if (event.weddingId) {
        const current = weddingsById.get(event.weddingId);
        if (!current || current.backfillKey !== w.key) {
          err("event_already_assigned", `Event ${eventId} already belongs to another wedding (${current?.name ?? event.weddingId}).`);
          continue;
        }
      }
      if (event.ownerUserId) {
        const owner = usersById.get(event.ownerUserId);
        const ownerKeepsAccess =
          memberIds.has(event.ownerUserId) ||
          (existingWedding ? existingMemberships.has(membershipKey(existingWedding.id, event.ownerUserId)) : false);
        if (isLiveUser(owner) && !ownerKeepsAccess) {
          err(
            "owner_would_lose_access",
            `Event ${eventId} ("${event.title}") is owned by ${owner.name}, who is not a member of ${label}.`,
          );
        }
      }
      eventIds.push(eventId);
    }
    if (eventIds.length === 0 && (w?.eventIds ?? []).length === 0) {
      warn("no_events", `${label} has no events.`);
    }

    resolved.push({ key: w.key, name: w.name, members, eventIds });
  }

  for (const e of state.events) {
    if (!e.weddingId && !eventClaims.has(e.id)) {
      warn("unmapped_event", `Event ${e.id} ("${e.title}") is not in the mapping; it stays unassigned (legacy owner access only).`);
    }
  }

  return { ok: !issues.some((i) => i.level === "error"), issues, resolved };
}

export type BackfillPlan = {
  createWeddings: { key: string; name: string }[];
  createMemberships: { key: string; userId: string; role: "owner" | "member" }[];
  assignEvents: { key: string; eventId: string }[];
};

/** Operations still needed to reach the mapping. Re-running after a successful apply yields an empty plan. */
export function planBackfillApply(resolved: ResolvedMappingWedding[], state: BackfillState): BackfillPlan {
  const weddingsByKey = new Map(state.weddings.filter((w) => w.backfillKey).map((w) => [w.backfillKey!, w]));
  const eventsById = new Map(state.events.map((e) => [e.id, e]));
  const memberships = new Set(state.memberships.map((m) => `${m.weddingId}::${m.userId}`));
  const plan: BackfillPlan = { createWeddings: [], createMemberships: [], assignEvents: [] };

  for (const w of resolved) {
    const existing = weddingsByKey.get(w.key);
    if (!existing) plan.createWeddings.push({ key: w.key, name: w.name });
    for (const m of w.members) {
      if (!existing || !memberships.has(`${existing.id}::${m.userId}`)) {
        plan.createMemberships.push({ key: w.key, userId: m.userId, role: m.role });
      }
    }
    for (const eventId of w.eventIds) {
      const event = eventsById.get(eventId);
      if (event && !event.weddingId) plan.assignEvents.push({ key: w.key, eventId });
    }
  }
  return plan;
}

export type RepairGuest = {
  id: string;
  eventId: string;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  sharedGuestKey: string | null;
  countOwnerEventId: string | null;
  excludeFromTotals: boolean;
  excludeReason: string | null;
  excludedGuestCount: number;
  excludedMenCount: number;
  excludedWomenCount: number;
  excludedKidsCount: number;
  menCount: number | null;
  womenCount: number | null;
  kidsCount: number | null;
  maxGuests: number | null;
};

export type RepairChange = {
  guestId: string;
  eventId: string;
  reason: "count_owner_outside_wedding";
  before: Pick<RepairGuest, "countOwnerEventId" | "excludeFromTotals" | "excludeReason" | "excludedGuestCount" | "excludedMenCount" | "excludedWomenCount" | "excludedKidsCount">;
  after: RepairChange["before"];
};

export type SharedGuestRepairPlan = {
  changes: RepairChange[];
  skippedUnassigned: { guestId: string; eventId: string }[];
  /** Cross-wedding pointers on incomplete exclusion records: left untouched for a person to decide. */
  needsReview: { guestId: string; eventId: string }[];
};

/**
 * Finds guests whose count-owner pointer crosses a wedding boundary (left over from the old
 * platform-wide matching) and re-derives it using only same-wedding matches. Manual exclusions
 * keep their counts; only automatic shared-guest exclusions are cleared when no in-wedding
 * match remains. Guests in still-unassigned events are reported, not changed.
 */
export function planSharedGuestRepair(
  guests: RepairGuest[],
  events: { id: string; weddingId: string | null }[],
): SharedGuestRepairPlan {
  const weddingByEvent = new Map(events.map((e) => [e.id, e.weddingId]));
  const live = guests
    .filter((g) => !g.deletedAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));

  const changes: RepairChange[] = [];
  const skippedUnassigned: SharedGuestRepairPlan["skippedUnassigned"] = [];
  const needsReview: SharedGuestRepairPlan["needsReview"] = [];

  for (const g of live) {
    if (!g.countOwnerEventId || g.countOwnerEventId === g.eventId) continue;
    const weddingId = weddingByEvent.get(g.eventId) ?? null;
    const ownerWeddingId = weddingByEvent.get(g.countOwnerEventId) ?? null;
    if (!weddingId) {
      skippedUnassigned.push({ guestId: g.id, eventId: g.eventId });
      continue;
    }
    if (ownerWeddingId === weddingId) continue;

    const kind = classifyExclusion({ ...g, menCount: g.menCount ?? 0, womenCount: g.womenCount ?? 0, kidsCount: g.kidsCount ?? 0, maxGuests: g.maxGuests ?? 0 });
    if (kind === "ambiguous") {
      needsReview.push({ guestId: g.id, eventId: g.eventId });
      continue;
    }

    const before: RepairChange["before"] = {
      countOwnerEventId: g.countOwnerEventId,
      excludeFromTotals: g.excludeFromTotals,
      excludeReason: g.excludeReason,
      excludedGuestCount: g.excludedGuestCount,
      excludedMenCount: g.excludedMenCount,
      excludedWomenCount: g.excludedWomenCount,
      excludedKidsCount: g.excludedKidsCount,
    };
    const after: RepairChange["before"] = kind === "legacy_automatic"
      ? {
          countOwnerEventId: null,
          excludeFromTotals: false,
          excludeReason: null,
          excludedGuestCount: 0,
          excludedMenCount: 0,
          excludedWomenCount: 0,
          excludedKidsCount: 0,
        }
      : { ...before, countOwnerEventId: null };

    changes.push({ guestId: g.id, eventId: g.eventId, reason: "count_owner_outside_wedding", before, after });
  }

  return { changes, skippedUnassigned, needsReview };
}

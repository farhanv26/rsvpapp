/**
 * Follow-up / invite pipeline state for guests (invited vs responded).
 * Uses: invitedAt, respondedAt.
 */

export type GuestFollowUpInput = {
  invitedAt: string | null;
  respondedAt: string | null;
};

export type GuestFollowUpId = "invited_no_response" | "responded" | "not_invited_yet";

export type GuestFollowUpState = {
  id: GuestFollowUpId;
  label: string;
};

/**
 * Priority: any RSVP response → Responded; else if invited → Invited, No Response; else Not Invited Yet.
 */
export function getGuestFollowUpState(g: GuestFollowUpInput): GuestFollowUpState {
  if (g.respondedAt) {
    return { id: "responded", label: "Responded" };
  }
  if (g.invitedAt) {
    return { id: "invited_no_response", label: "Invited, No Response" };
  }
  return { id: "not_invited_yet", label: "Not Invited Yet" };
}

const followUpBadgeBase =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight";

export function followUpBadgeClass(id: GuestFollowUpId): string {
  switch (id) {
    case "invited_no_response":
      return `${followUpBadgeBase} border border-amber-300/80 bg-amber-50 text-amber-950`;
    case "responded":
      return `${followUpBadgeBase} bg-violet-100 text-violet-900`;
    case "not_invited_yet":
      return `${followUpBadgeBase} bg-zinc-100 text-zinc-600`;
    default:
      return `${followUpBadgeBase} bg-zinc-100 text-zinc-700`;
  }
}

export function matchesFollowUpFilter(
  g: GuestFollowUpInput,
  filter: GuestFollowUpId | "all",
): boolean {
  if (filter === "all") return true;
  return getGuestFollowUpState(g).id === filter;
}

/** Invited at least once but no RSVP yet — primary follow-up cohort. */
export function isInvitedAwaitingRsvp(g: GuestFollowUpInput): boolean {
  return Boolean(g.invitedAt) && !g.respondedAt;
}

export function countInvitedAwaitingRsvp(guests: GuestFollowUpInput[]): number {
  return guests.filter(isInvitedAwaitingRsvp).length;
}

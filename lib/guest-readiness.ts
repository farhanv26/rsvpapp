/**
 * Derived guest readiness / contact health for ops (invites, follow-up).
 * Uses: respondedAt, invitedAt, phone, email.
 */

export type GuestReadinessInput = {
  respondedAt: string | null;
  invitedAt: string | null;
  phone: string | null;
  email: string | null;
};

export type GuestReadinessId =
  | "responded"
  | "already_invited"
  | "missing_contact"
  | "missing_phone"
  | "missing_email"
  | "ready";

export type GuestReadiness = {
  id: GuestReadinessId;
  /** Short label for badges and filters */
  label: string;
};

function hasPhone(g: GuestReadinessInput): boolean {
  return Boolean(g.phone?.trim());
}

function hasEmail(g: GuestReadinessInput): boolean {
  return Boolean(g.email?.trim());
}

/**
 * Priority: Responded → Already invited (awaiting RSVP) → contact health for not-yet-invited flows.
 */
export function getGuestReadiness(g: GuestReadinessInput): GuestReadiness {
  if (g.respondedAt) {
    return { id: "responded", label: "Responded" };
  }
  if (g.invitedAt) {
    return { id: "already_invited", label: "Already Invited" };
  }
  if (!hasPhone(g) && !hasEmail(g)) {
    return { id: "missing_contact", label: "Missing Contact Info" };
  }
  if (!hasPhone(g) && hasEmail(g)) {
    return { id: "missing_phone", label: "Missing Phone" };
  }
  if (hasPhone(g) && !hasEmail(g)) {
    return { id: "missing_email", label: "Missing Email" };
  }
  return { id: "ready", label: "Ready to Send" };
}

const readinessBadgeBase =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight";

export function readinessBadgeClass(id: GuestReadinessId): string {
  switch (id) {
    case "responded":
      return `${readinessBadgeBase} bg-violet-100 text-violet-900`;
    case "already_invited":
      return `${readinessBadgeBase} border border-amber-200/80 bg-amber-50 text-amber-950`;
    case "missing_contact":
      return `${readinessBadgeBase} bg-rose-100 text-rose-900`;
    case "missing_phone":
      return `${readinessBadgeBase} bg-orange-50 text-orange-900 ring-1 ring-orange-200/70`;
    case "missing_email":
      return `${readinessBadgeBase} bg-cyan-50 text-cyan-950 ring-1 ring-cyan-200/70`;
    case "ready":
      return `${readinessBadgeBase} bg-emerald-100 text-emerald-950`;
    default:
      return `${readinessBadgeBase} bg-zinc-100 text-zinc-700`;
  }
}

export type ReadinessSummaryCounts = {
  readyToSend: number;
  missingContact: number;
  missingPhone: number;
  missingEmail: number;
  alreadyInvited: number;
  responded: number;
};

export function summarizeReadinessGuestCounts(guests: GuestReadinessInput[]): ReadinessSummaryCounts {
  const out: ReadinessSummaryCounts = {
    readyToSend: 0,
    missingContact: 0,
    missingPhone: 0,
    missingEmail: 0,
    alreadyInvited: 0,
    responded: 0,
  };
  for (const g of guests) {
    const { id } = getGuestReadiness(g);
    switch (id) {
      case "ready":
        out.readyToSend += 1;
        break;
      case "missing_contact":
        out.missingContact += 1;
        break;
      case "missing_phone":
        out.missingPhone += 1;
        break;
      case "missing_email":
        out.missingEmail += 1;
        break;
      case "already_invited":
        out.alreadyInvited += 1;
        break;
      case "responded":
        out.responded += 1;
        break;
      default:
        break;
    }
  }
  return out;
}

export function matchesReadinessFilter(g: GuestReadinessInput, filter: GuestReadinessId | "all"): boolean {
  if (filter === "all") return true;
  return getGuestReadiness(g).id === filter;
}

import { getGuestFollowUpState } from "@/lib/guest-followup";
import { getGuestReadiness, type GuestReadinessId } from "@/lib/guest-readiness";
import { buildGuestEventReminderMessage, buildGuestWhatsAppInviteMessage, getSmsInviteUrlForGuest, getWhatsAppInviteUrlForGuest } from "@/lib/whatsapp";

export type GuestPanelGuest = {
  id: string;
  guestName: string;
  greeting: string;
  menCount: number;
  womenCount: number;
  kidsCount: number;
  maxGuests: number;
  token: string;
  attending: boolean | null;
  attendingCount: number | null;
  respondedAt: string | null;
  group: string | null;
  tableName: string | null;
  notes: string | null;
  hostMessage: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  email: string | null;
  invitedAt: string | null;
  inviteChannelLastUsed: string | null;
  inviteCount: number;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  isFamilyInvite: boolean;
  excludeFromTotals: boolean;
  excludeReason: string | null;
  excludedGuestCount: number;
  excludedMenCount: number;
  excludedWomenCount: number;
  excludedKidsCount: number;
  sharedGuestKey: string | null;
  countOwnerEventId: string | null;
  isSharedGuest: boolean;
  exclusionKind?: "none" | "manual" | "legacy_automatic" | "ambiguous";
  managedByUserId?: string | null;
  canEdit?: boolean;
};

export type GuestStatus = "attending" | "declined" | "invited" | "not_invited";

export function totalGuestCount(g: Pick<GuestPanelGuest, "menCount" | "womenCount" | "kidsCount" | "maxGuests">) {
  const computed = (g.menCount ?? 0) + (g.womenCount ?? 0) + (g.kidsCount ?? 0);
  return computed > 0 ? computed : g.maxGuests;
}

export function guestEffectiveExcludedTotal(g: Pick<GuestPanelGuest, "excludedMenCount" | "excludedWomenCount" | "excludedKidsCount" | "excludedGuestCount">) {
  const catSum = (g.excludedMenCount ?? 0) + (g.excludedWomenCount ?? 0) + (g.excludedKidsCount ?? 0);
  return catSum > 0 ? catSum : (g.excludedGuestCount ?? 0);
}

export function countedGuestContribution(
  g: Pick<GuestPanelGuest, "menCount" | "womenCount" | "kidsCount" | "maxGuests" | "excludedGuestCount" | "excludedMenCount" | "excludedWomenCount" | "excludedKidsCount">,
) {
  const excMen = g.excludedMenCount ?? 0;
  const excWomen = g.excludedWomenCount ?? 0;
  const excKids = g.excludedKidsCount ?? 0;
  if (excMen + excWomen + excKids > 0) {
    return Math.max((g.menCount ?? 0) - excMen, 0) + Math.max((g.womenCount ?? 0) - excWomen, 0) + Math.max((g.kidsCount ?? 0) - excKids, 0);
  }
  return Math.max(totalGuestCount(g) - (g.excludedGuestCount ?? 0), 0);
}

/** Men/women/kids that count toward this event, matching the dashboard totals. */
export function countedBreakdownOf(g: GuestPanelGuest) {
  const excMen = g.excludedMenCount ?? 0;
  const excWomen = g.excludedWomenCount ?? 0;
  const excKids = g.excludedKidsCount ?? 0;
  if (excMen + excWomen + excKids > 0) {
    return {
      men: Math.max((g.menCount ?? 0) - excMen, 0),
      women: Math.max((g.womenCount ?? 0) - excWomen, 0),
      kids: Math.max((g.kidsCount ?? 0) - excKids, 0),
    };
  }
  if ((g.excludedGuestCount ?? 0) === 0) return { men: g.menCount ?? 0, women: g.womenCount ?? 0, kids: g.kidsCount ?? 0 };
  return { men: 0, women: 0, kids: 0 };
}

export function guestPrimaryStatus(g: GuestPanelGuest): GuestStatus {
  if (g.respondedAt && g.attending === true) return "attending";
  if (g.respondedAt && g.attending !== true) return "declined";
  if (g.invitedAt) return "invited";
  return "not_invited";
}

export function statusLabel(status: GuestStatus) {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Declined";
  if (status === "invited") return "No reply";
  return "Not invited";
}

/** Status wording used in CSV exports since before the redesign; kept stable for spreadsheets. */
export function exportStatusLabel(status: GuestStatus) {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Declined";
  if (status === "invited") return "Invited";
  return "Not Invited";
}

export function partyLabel(g: Pick<GuestPanelGuest, "menCount" | "womenCount" | "kidsCount" | "maxGuests">) {
  const parts: string[] = [];
  if (g.menCount) parts.push(`${g.menCount} ${g.menCount === 1 ? "man" : "men"}`);
  if (g.womenCount) parts.push(`${g.womenCount} ${g.womenCount === 1 ? "woman" : "women"}`);
  if (g.kidsCount) parts.push(`${g.kidsCount} ${g.kidsCount === 1 ? "kid" : "kids"}`);
  return parts.length ? parts.join(", ") : `${totalGuestCount(g)} ${totalGuestCount(g) === 1 ? "place" : "places"}`;
}

export function channelLabel(channel: string | null | undefined): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "email";
  if (channel === "imessage") return "text message";
  if (channel === "manual") return "marked by hand";
  return channel ?? "";
}

/** Legacy badge text kept for search and CSV exports. */
export function inviteBadgeLabel(g: GuestPanelGuest): string {
  if (!g.invitedAt) return "Not Sent";
  const ch = g.inviteChannelLastUsed;
  if (ch === "whatsapp") return "WhatsApp Sent";
  if (ch === "email") return "Email Sent";
  if (ch === "imessage") return "Message Sent";
  if (ch === "manual") return "Marked";
  return "Invited";
}

export const shortDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso)) : "";

export const fullDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "-";

export function guestRsvpUrl(siteUrl: string, token: string) {
  const path = `/rsvp/${token}`;
  if (!siteUrl) return path;
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

export type MessageContext = {
  siteUrl: string;
  eventTitle: string;
  eventCoupleNames?: string | null;
  inviteMessageIntro?: string | null;
  inviteMessageLineOverride?: string | null;
  hasItinerary: boolean;
  eventVenue?: string | null;
  eventTime?: string | null;
};

export function buildGuestMessages(guest: GuestPanelGuest, ctx: MessageContext) {
  const link = guestRsvpUrl(ctx.siteUrl, guest.token);
  const inviteMessage = buildGuestWhatsAppInviteMessage({
    guestId: guest.id,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: ctx.eventTitle,
    coupleNames: ctx.eventCoupleNames,
    rsvpLink: link,
    customIntroLine: ctx.inviteMessageIntro,
    customLineOverride: ctx.inviteMessageLineOverride,
  });
  const reminderMessage = buildGuestEventReminderMessage({
    guestId: guest.id,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: ctx.eventTitle,
    coupleNames: ctx.eventCoupleNames,
    rsvpLink: link,
    hasItinerary: ctx.hasItinerary,
    venue: ctx.eventVenue,
    eventTime: ctx.eventTime,
  });
  const st = guestPrimaryStatus(guest);
  // Attending guests get the event reminder; everyone else gets the invitation.
  const activeMessage = st === "attending" ? reminderMessage : inviteMessage;
  return {
    link,
    inviteMessage,
    reminderMessage,
    status: st,
    whatsappUrl: getWhatsAppInviteUrlForGuest(guest.phone, activeMessage, guest.phoneCountryCode),
    smsUrl: getSmsInviteUrlForGuest(guest.phone, activeMessage, guest.phoneCountryCode),
  };
}

// ── Filters ──────────────────────────────────────────────────────────────

export type StatusFilter = "all" | GuestStatus;
export type AdvancedFilters = {
  channel: "all" | "whatsapp" | "imessage" | "email" | "manual";
  contact: "all" | Extract<GuestReadinessId, "ready" | "missing_phone" | "missing_email" | "missing_contact">;
  duplicates: "all" | "has_duplicates" | "clean";
  counting: "all" | "counted" | "excluded" | "shared" | "counted_here" | "counted_elsewhere";
  group: string;
  table: string;
  manager: string;
};

export const EMPTY_ADVANCED: AdvancedFilters = {
  channel: "all",
  contact: "all",
  duplicates: "all",
  counting: "all",
  group: "all",
  table: "all",
  manager: "all",
};

export function countActiveAdvanced(f: AdvancedFilters) {
  return (Object.keys(f) as (keyof AdvancedFilters)[]).filter((k) => f[k] !== "all").length;
}

export function guestIsCountedHere(g: GuestPanelGuest, eventId: string): boolean {
  if (guestEffectiveExcludedTotal(g) >= totalGuestCount(g) && totalGuestCount(g) > 0) return false;
  if (!g.countOwnerEventId) return true;
  return g.countOwnerEventId === eventId;
}

export function matchesAdvanced(g: GuestPanelGuest, f: AdvancedFilters, eventId: string, duplicateOf: (id: string) => "none" | "weak" | "strong") {
  if (f.channel !== "all" && !(g.invitedAt && g.inviteChannelLastUsed === f.channel)) return false;
  if (f.contact !== "all" && getGuestReadiness(g).id !== f.contact) return false;
  if (f.duplicates === "has_duplicates" && duplicateOf(g.id) === "none") return false;
  if (f.duplicates === "clean" && duplicateOf(g.id) !== "none") return false;
  if (f.counting !== "all") {
    const excluded = guestEffectiveExcludedTotal(g) > 0;
    if (f.counting === "counted" && excluded) return false;
    if (f.counting === "excluded" && !excluded) return false;
    if (f.counting === "shared" && !g.isSharedGuest) return false;
    if (f.counting === "counted_here" && !guestIsCountedHere(g, eventId)) return false;
    if (f.counting === "counted_elsewhere" && !(g.countOwnerEventId && g.countOwnerEventId !== eventId)) return false;
  }
  if (f.group !== "all") {
    const gr = g.group?.trim() ?? "";
    if (f.group === "__none__" ? gr.length > 0 : gr !== f.group) return false;
  }
  if (f.table !== "all") {
    const tb = g.tableName?.trim() ?? "";
    if (f.table === "unassigned" && tb.length > 0) return false;
    if (f.table === "assigned" && tb.length === 0) return false;
    if (!["unassigned", "assigned"].includes(f.table) && tb !== f.table) return false;
  }
  if (f.manager !== "all" && (g.managedByUserId ?? "") !== (f.manager === "__none__" ? "" : f.manager)) return false;
  return true;
}

export function searchHaystack(g: GuestPanelGuest) {
  return [
    g.guestName,
    g.greeting,
    g.group,
    g.notes,
    g.phone,
    g.email,
    g.tableName,
    statusLabel(guestPrimaryStatus(g)),
    inviteBadgeLabel(g),
    getGuestReadiness(g).label,
    getGuestFollowUpState(g).label,
    g.excludeReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export type SortKey = "nameAsc" | "status" | "maxGuestsDesc" | "updatedDesc" | "groupAsc" | "tableAsc";

export function sortGuests(list: GuestPanelGuest[], sort: SortKey) {
  const order: Record<GuestStatus, number> = { attending: 0, declined: 1, invited: 2, not_invited: 3 };
  const by = (a: string | null, b: string | null) => (a?.trim() || "").toLowerCase().localeCompare((b?.trim() || "").toLowerCase());
  return [...list].sort((a, b) => {
    switch (sort) {
      case "nameAsc":
        return a.guestName.localeCompare(b.guestName);
      case "groupAsc":
        return by(a.group, b.group) || a.guestName.localeCompare(b.guestName);
      case "tableAsc":
        return by(a.tableName, b.tableName) || a.guestName.localeCompare(b.guestName);
      case "status":
        return order[guestPrimaryStatus(a)] - order[guestPrimaryStatus(b)] || a.guestName.localeCompare(b.guestName);
      case "maxGuestsDesc":
        return totalGuestCount(b) - totalGuestCount(a);
      case "updatedDesc":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
}

// ── CSV ──────────────────────────────────────────────────────────────────

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function guestExportRows(source: GuestPanelGuest[], eventId: string, duplicateLabel: (id: string) => string) {
  return [
    [
      "Guest Name", "Men", "Women", "Kids", "Total Guests", "Greeting", "Category (group)", "Table", "RSVP Status", "Readiness",
      "Follow-up", "Duplicate", "Attending Count", "Response Time", "Message to host", "Email", "Phone", "Phone country code", "Notes",
      "Invited At", "Invite channel", "Family invite", "Excl. men", "Excl. women", "Excl. kids", "Excluded total", "Exclude reason",
      "Shared guest", "Count owner",
    ],
    ...source.map((g) => [
      g.guestName,
      String(g.menCount ?? 0),
      String(g.womenCount ?? 0),
      String(g.kidsCount ?? 0),
      String(totalGuestCount(g)),
      g.greeting || "Assalamu Alaikum",
      g.group ?? "",
      g.tableName ?? "",
      exportStatusLabel(guestPrimaryStatus(g)),
      getGuestReadiness(g).label,
      getGuestFollowUpState(g).label,
      duplicateLabel(g.id),
      String(g.attendingCount ?? 0),
      fullDate(g.respondedAt),
      g.hostMessage ?? "",
      g.email ?? "",
      g.phone ?? "",
      g.phoneCountryCode ?? "",
      g.notes ?? "",
      g.invitedAt ? fullDate(g.invitedAt) : "",
      g.inviteChannelLastUsed ?? "",
      g.isFamilyInvite ? "Yes" : "No",
      String(g.excludedMenCount ?? 0),
      String(g.excludedWomenCount ?? 0),
      String(g.excludedKidsCount ?? 0),
      String(guestEffectiveExcludedTotal(g)),
      g.excludeReason ?? "",
      g.isSharedGuest ? "Yes" : "No",
      g.countOwnerEventId === eventId ? "This event" : g.countOwnerEventId ? "Another event" : "",
    ]),
  ];
}

export function rsvpDatasetRows(source: GuestPanelGuest[], eventId: string, siteUrl: string) {
  return [
    [
      "Guest Name", "Men", "Women", "Kids", "Total Guests", "Greeting", "Token", "RSVP Link", "Category", "Table", "Attending (true/false)",
      "Attending Count", "Responded At (ISO)", "Last Updated (ISO)", "Message to host", "Email", "Phone", "Phone country code", "Notes",
      "Invited At (ISO)", "Invite channel", "Family invite (true/false)", "Excl. men", "Excl. women", "Excl. kids", "Excluded total",
      "Exclude reason", "Shared guest", "Count owner",
    ],
    ...source.map((g) => [
      g.guestName,
      String(g.menCount ?? 0),
      String(g.womenCount ?? 0),
      String(g.kidsCount ?? 0),
      String(totalGuestCount(g)),
      g.greeting || "Assalamu Alaikum",
      g.token,
      guestRsvpUrl(siteUrl, g.token),
      g.group ?? "",
      g.tableName ?? "",
      String(guestPrimaryStatus(g) === "attending"),
      String(g.attendingCount ?? 0),
      g.respondedAt ?? "",
      g.updatedAt,
      g.hostMessage ?? "",
      g.email ?? "",
      g.phone ?? "",
      g.phoneCountryCode ?? "",
      g.notes ?? "",
      g.invitedAt ?? "",
      g.inviteChannelLastUsed ?? "",
      String(g.isFamilyInvite),
      String(g.excludedMenCount ?? 0),
      String(g.excludedWomenCount ?? 0),
      String(g.excludedKidsCount ?? 0),
      String(guestEffectiveExcludedTotal(g)),
      g.excludeReason ?? "",
      String(g.isSharedGuest),
      g.countOwnerEventId === eventId ? "this_event" : g.countOwnerEventId ? "other_event" : "",
    ]),
  ];
}

export function confirmedAttendeeRows(source: GuestPanelGuest[]) {
  return [
    ["Guest Name", "Men", "Women", "Kids", "Total Guests", "Greeting", "Category", "Table", "RSVP Status", "Attending Count", "Response Time", "Message to host", "Email", "Phone", "Phone country code", "Notes"],
    ...source
      .filter((g) => guestPrimaryStatus(g) === "attending")
      .map((g) => [
        g.guestName,
        String(g.menCount ?? 0),
        String(g.womenCount ?? 0),
        String(g.kidsCount ?? 0),
        String(totalGuestCount(g)),
        g.greeting || "Assalamu Alaikum",
        g.group ?? "",
        g.tableName ?? "",
        exportStatusLabel(guestPrimaryStatus(g)),
        String(g.attendingCount ?? 0),
        fullDate(g.respondedAt),
        g.hostMessage ?? "",
        g.email ?? "",
        g.phone ?? "",
        g.phoneCountryCode ?? "",
        g.notes ?? "",
      ]),
  ];
}

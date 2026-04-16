"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkDeleteGuestsAction,
  bulkUpdateGuestPlanningAction,
  deleteGuestAction,
  logBulkWhatsappPreparedAction,
  logGuestWhatsappPreparedAction,
  markGuestsInvitedAction,
  recordGuestManualRsvpAction,
  sendBulkGuestInviteEmailsAction,
  sendGuestInviteEmailAction,
  updateGuestAction,
} from "@/app/admin/events/actions";
import { ReviewDuplicatesModal } from "@/components/admin/review-duplicates-modal";
import { SendInvitesModal } from "@/components/admin/send-invites-modal";
import {
  getGuestFollowUpState,
  isInvitedAwaitingRsvp,
  matchesFollowUpFilter,
  type GuestFollowUpId,
} from "@/lib/guest-followup";
import {
  buildDuplicateStrengthMap,
  countDuplicateClusters,
  countGuestsInDuplicateClusters,
  matchesDuplicateStrengthFilter,
  type DuplicateFilterId,
  type DuplicateStrength,
} from "@/lib/guest-duplicates";
import {
  getGuestReadiness,
  matchesReadinessFilter,
  type GuestReadinessId,
} from "@/lib/guest-readiness";
import {
  buildGuestWhatsAppInviteMessage,
  getWhatsAppInviteUrlForGuest,
  normalizePhoneForWhatsApp,
} from "@/lib/whatsapp";
import { CommunicationPreviewModal } from "@/components/admin/communication-preview-modal";
import { GuestCommunicationHistoryModal } from "@/components/admin/guest-communication-history-modal";
import { GuestInviteCardPreviewModal } from "@/components/admin/guest-invite-card-preview-modal";
import { inviteCardUsingLabel, resolveInviteCardImage, type InviteCardEventInput } from "@/lib/invite-card-resolution";
import { getSafeImageSrc } from "@/lib/utils";

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
  email: string | null;
  invitedAt: string | null;
  inviteChannelLastUsed: string | null;
  inviteCount: number;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  isFamilyInvite: boolean;
};

function totalGuestCount(guest: Pick<GuestPanelGuest, "menCount" | "womenCount" | "kidsCount" | "maxGuests">) {
  const computed = (guest.menCount ?? 0) + (guest.womenCount ?? 0) + (guest.kidsCount ?? 0);
  return computed > 0 ? computed : guest.maxGuests;
}

type Props = {
  eventId: string;
  eventTitle: string;
  eventCoupleNames?: string | null;
  inviteMessageIntro?: string | null;
  inviteMessageLineOverride?: string | null;
  guests: GuestPanelGuest[];
  siteUrl: string;
  inviteCardEvent: InviteCardEventInput;
  /** Latest communication log per guest (from server) for subtle table hints */
  communicationLastByGuest?: Record<string, { channel: string; at: string }>;
};

function guestPrimaryStatus(g: GuestPanelGuest): "attending" | "declined" | "invited" | "not_invited" {
  if (g.respondedAt && g.attending === true) return "attending";
  if (g.respondedAt && g.attending !== true) return "declined";
  if (g.invitedAt) return "invited";
  return "not_invited";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusLabel(status: ReturnType<typeof guestPrimaryStatus>) {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Declined";
  if (status === "invited") return "Invited";
  return "Not Invited";
}

const filterTabs: {
  id: "all" | "attending" | "declined" | "invited" | "not_invited";
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "attending", label: "Attending" },
  { id: "declined", label: "Declined" },
  { id: "invited", label: "Invited" },
  { id: "not_invited", label: "Not Invited" },
];

type InviteFilterId = "all" | "not_invited" | "invited" | "invited_whatsapp" | "invited_email";

const inviteFilterTabs: { id: InviteFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_invited", label: "Not Invited Yet" },
  { id: "invited", label: "Invited" },
  { id: "invited_whatsapp", label: "WhatsApp" },
  { id: "invited_email", label: "Email" },
];

type ReadinessFilterId = "all" | GuestReadinessId;

const readinessFilterTabs: { id: ReadinessFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready to Send" },
  { id: "missing_phone", label: "Missing Phone" },
  { id: "missing_email", label: "Missing Email" },
  { id: "missing_contact", label: "Missing Contact" },
  { id: "already_invited", label: "Already Invited" },
  { id: "responded", label: "Responded" },
];

type FollowUpFilterId = "all" | GuestFollowUpId;

const followUpFilterTabs: { id: FollowUpFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "invited_no_response", label: "Invited, No Response" },
  { id: "responded", label: "Responded" },
  { id: "not_invited_yet", label: "Not Invited Yet" },
];

const duplicateFilterTabs: { id: DuplicateFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "has_duplicates", label: "Duplicates / Possible" },
  { id: "clean", label: "Clean" },
];

function duplicateBadgeClass(strength: DuplicateStrength): string | null {
  if (strength === "none") return null;
  const base =
    "mt-1 inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight";
  if (strength === "strong") return `${base} border border-rose-200/90 bg-rose-50 text-rose-900`;
  return `${base} border border-orange-200/80 bg-orange-50/90 text-orange-950`;
}

function duplicateBadgeLabel(strength: DuplicateStrength): string | null {
  if (strength === "none") return null;
  if (strength === "strong") return "Duplicate";
  return "Possible duplicate";
}

function guestMatchesPlanningFilters(
  g: GuestPanelGuest,
  planningGroupFilter: string,
  planningTableFilter: string,
): boolean {
  if (planningGroupFilter !== "all") {
    const gr = g.group?.trim() ?? "";
    if (planningGroupFilter === "__none__") {
      if (gr.length > 0) return false;
    } else if (gr !== planningGroupFilter) {
      return false;
    }
  }
  if (planningTableFilter !== "all") {
    const tb = g.tableName?.trim() ?? "";
    if (planningTableFilter === "unassigned") {
      if (tb.length > 0) return false;
    } else if (planningTableFilter === "assigned") {
      if (tb.length === 0) return false;
    } else if (tb !== planningTableFilter) {
      return false;
    }
  }
  return true;
}

function inviteBadgeLabel(g: GuestPanelGuest): string {
  if (!g.invitedAt) return "Not Sent";
  const ch = g.inviteChannelLastUsed;
  if (ch === "whatsapp") return "WhatsApp Sent";
  if (ch === "email") return "Email Sent";
  if (ch === "manual") return "Marked";
  return "Invited";
}

function lastCommChannelLabel(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "Email";
  if (channel === "manual") return "Manual";
  return channel;
}

function inviteBadgeClass(g: GuestPanelGuest): string {
  const base =
    "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight";
  if (!g.invitedAt) return `${base} bg-zinc-100 text-zinc-700`;
  const ch = g.inviteChannelLastUsed;
  if (ch === "whatsapp") return `${base} bg-emerald-100 text-emerald-900`;
  if (ch === "email") return `${base} bg-sky-100 text-sky-900`;
  if (ch === "manual") return `${base} border border-[#e2d4bf] bg-[#f9f3e8] text-[#5c4a33]`;
  return `${base} border border-[#e2d4bf] bg-[#f9f3e8] text-[#6a5434]`;
}

function compactStatusBadgeClass(kind: "status" | "invite" | "warning" | "meta" | "duplicate"): string {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (kind === "status") return `${base} bg-violet-100 text-violet-900`;
  if (kind === "invite") return `${base} bg-emerald-100 text-emerald-900`;
  if (kind === "warning") return `${base} bg-amber-100 text-amber-900`;
  if (kind === "duplicate") return `${base} bg-rose-100 text-rose-900`;
  return `${base} bg-zinc-100 text-zinc-700`;
}

function guestRsvpUrl(siteUrl: string, token: string) {
  const path = `/rsvp/${token}`;
  if (!siteUrl) return path;
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.11 17.44c-.26-.13-1.51-.75-1.75-.83-.23-.09-.4-.13-.57.13-.17.26-.66.83-.81 1-.15.17-.3.2-.56.07-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.29-1.54-1.44-1.8-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.57-1.36-.78-1.86-.21-.5-.42-.43-.57-.43l-.48-.01c-.17 0-.45.06-.68.32-.23.26-.9.88-.9 2.14 0 1.26.92 2.48 1.05 2.65.13.17 1.8 2.75 4.37 3.86.61.26 1.08.42 1.45.54.61.19 1.17.16 1.61.1.49-.07 1.51-.62 1.72-1.22.21-.6.21-1.11.15-1.22-.06-.11-.23-.17-.49-.3Z"
      />
      <path
        fill="currentColor"
        d="M16.02 5.33c-5.88 0-10.67 4.78-10.67 10.67 0 1.89.5 3.74 1.45 5.37L5.33 26.7l5.46-1.43c1.57.85 3.33 1.3 5.22 1.3 5.88 0 10.67-4.78 10.67-10.67S21.9 5.33 16.02 5.33Zm0 19.35c-1.68 0-3.33-.45-4.77-1.3l-.34-.2-3.24.85.86-3.16-.22-.33c-.92-1.43-1.41-3.08-1.41-4.78 0-4.95 4.03-8.98 8.98-8.98S25 10.81 25 15.76s-4.03 8.92-8.98 8.92Z"
      />
    </svg>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: string[][]) {
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

export function EventGuestsPanel({
  eventId,
  eventTitle,
  eventCoupleNames,
  inviteMessageIntro,
  inviteMessageLineOverride,
  guests,
  siteUrl,
  inviteCardEvent,
  communicationLastByGuest = {},
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filterTabs)[number]["id"]>("all");
  const [inviteFilter, setInviteFilter] = useState<InviteFilterId>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilterId>("all");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilterId>("all");
  const [duplicateFilter, setDuplicateFilter] = useState<DuplicateFilterId>("all");
  const [planningGroupFilter, setPlanningGroupFilter] = useState<string>("all");
  const [planningTableFilter, setPlanningTableFilter] = useState<string>("all");
  const [reviewDuplicatesOpen, setReviewDuplicatesOpen] = useState(false);
  const [sendInvitesScopeOverride, setSendInvitesScopeOverride] = useState<GuestPanelGuest[] | null>(null);
  const [sendInvitesScopeMode, setSendInvitesScopeMode] = useState<null | "remaining" | "ready">(null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpScopeOverride, setFollowUpScopeOverride] = useState<GuestPanelGuest[] | null>(null);
  const [followUpNonce, setFollowUpNonce] = useState(0);
  const [sort, setSort] = useState<
    "nameAsc" | "status" | "maxGuestsDesc" | "updatedDesc" | "groupAsc" | "tableAsc"
  >("updatedDesc");
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedMessageGuestId, setCopiedMessageGuestId] = useState<string | null>(null);
  const [copiedBulkLinks, setCopiedBulkLinks] = useState(false);
  const [copiedBulkInvites, setCopiedBulkInvites] = useState(false);
  const [emailSendingGuestId, setEmailSendingGuestId] = useState<string | null>(null);
  const [emailSentGuestId, setEmailSentGuestId] = useState<string | null>(null);
  const [bulkEmailStatus, setBulkEmailStatus] = useState<string | null>(null);
  const [sendInvitesOpen, setSendInvitesOpen] = useState(false);
  const [sendInvitesNonce, setSendInvitesNonce] = useState(0);
  const [previewGuestId, setPreviewGuestId] = useState<string | null>(null);
  const [communicationPreviewGuestId, setCommunicationPreviewGuestId] = useState<string | null>(null);
  const [communicationBulkMeta, setCommunicationBulkMeta] = useState<{ count: number } | null>(null);
  const [commHistoryGuest, setCommHistoryGuest] = useState<{ id: string; name: string } | null>(null);
  const [manualRsvpGuestId, setManualRsvpGuestId] = useState<string | null>(null);
  const [manualRsvpAttending, setManualRsvpAttending] = useState<"yes" | "no">("yes");
  const [manualRsvpCount, setManualRsvpCount] = useState<string>("1");
  const [manualRsvpAttendeeNames, setManualRsvpAttendeeNames] = useState("");
  const [manualRsvpNote, setManualRsvpNote] = useState("");
  const [manualRsvpMarkInvited, setManualRsvpMarkInvited] = useState(true);
  const [manualRsvpSaving, setManualRsvpSaving] = useState(false);
  const [manualRsvpError, setManualRsvpError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [guestEditError, setGuestEditError] = useState<string | null>(null);
  const [guestEditPending, setGuestEditPending] = useState(false);

  const editingGuest = useMemo(
    () => (editingGuestId ? guests.find((g) => g.id === editingGuestId) ?? null : null),
    [guests, editingGuestId],
  );

  useEffect(() => {
    if (!editingGuestId) {
      setGuestEditError(null);
      return;
    }
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [editingGuestId]);

  useEffect(() => {
    if (!editingGuestId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingGuestId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editingGuestId]);

  const inviteCardPreviewByGuest = useMemo(() => {
    const map = new Map<string, { safeSrc: string | null; usingLine: string }>();
    for (const g of guests) {
      const r = resolveInviteCardImage(inviteCardEvent, {
        maxGuests: totalGuestCount(g),
        isFamilyInvite: g.isFamilyInvite,
      });
      map.set(g.id, {
        safeSrc: getSafeImageSrc(r.rawPath),
        usingLine: inviteCardUsingLabel(r),
      });
    }
    return map;
  }, [guests, inviteCardEvent]);

  const duplicateStrengthMap = useMemo(() => buildDuplicateStrengthMap(guests), [guests]);

  const duplicateGuestCount = useMemo(() => countGuestsInDuplicateClusters(guests), [guests]);
  const duplicateClusterCount = useMemo(() => countDuplicateClusters(guests), [guests]);

  const uniqueGroupLabels = useMemo(() => {
    const s = new Set<string>();
    for (const g of guests) {
      const v = g.group?.trim();
      if (v) s.add(v);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [guests]);

  const uniqueTableLabels = useMemo(() => {
    const s = new Set<string>();
    for (const g of guests) {
      const v = g.tableName?.trim();
      if (v) s.add(v);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [guests]);

  const withoutInviteFilter = useMemo(() => {
    let list = [...guests];
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((g) => {
        const r = getGuestReadiness(g);
        const hay = [
          g.guestName,
          g.greeting,
          g.group,
          g.notes,
          g.phone,
          g.email,
          g.tableName,
          statusLabel(guestPrimaryStatus(g)),
          g.invitedAt ? "invited" : "not sent",
          inviteBadgeLabel(g),
          r.label,
          r.id,
          getGuestFollowUpState(g).label,
          getGuestFollowUpState(g).id,
          duplicateBadgeLabel(duplicateStrengthMap.get(g.id) ?? "none"),
          "duplicate",
          "possible duplicate",
          "invited",
          "not invited",
          "not sent",
          "whatsapp sent",
          "email sent",
          "marked",
          "ready",
          "responded",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }

    if (filter !== "all") {
      list = list.filter((g) => guestPrimaryStatus(g) === filter);
    }

    return list;
  }, [guests, q, filter, duplicateStrengthMap]);

  const afterInviteFilter = useMemo(() => {
    let list = [...withoutInviteFilter];

    if (inviteFilter === "not_invited") {
      list = list.filter((g) => !g.invitedAt);
    } else if (inviteFilter === "invited") {
      list = list.filter((g) => Boolean(g.invitedAt));
    } else if (inviteFilter === "invited_whatsapp") {
      list = list.filter((g) => Boolean(g.invitedAt) && g.inviteChannelLastUsed === "whatsapp");
    } else if (inviteFilter === "invited_email") {
      list = list.filter((g) => Boolean(g.invitedAt) && g.inviteChannelLastUsed === "email");
    }

    return list;
  }, [withoutInviteFilter, inviteFilter]);

  const afterReadinessFilter = useMemo(() => {
    if (readinessFilter === "all") {
      return afterInviteFilter;
    }
    return afterInviteFilter.filter((g) => matchesReadinessFilter(g, readinessFilter));
  }, [afterInviteFilter, readinessFilter]);

  const afterFollowUpFilter = useMemo(() => {
    if (followUpFilter === "all") {
      return afterReadinessFilter;
    }
    return afterReadinessFilter.filter((g) => matchesFollowUpFilter(g, followUpFilter));
  }, [afterReadinessFilter, followUpFilter]);

  const afterDuplicateFilter = useMemo(() => {
    if (duplicateFilter === "all") {
      return afterFollowUpFilter;
    }
    return afterFollowUpFilter.filter((g) =>
      matchesDuplicateStrengthFilter(duplicateStrengthMap.get(g.id) ?? "none", duplicateFilter),
    );
  }, [afterFollowUpFilter, duplicateFilter, duplicateStrengthMap]);

  const afterPlanningFilter = useMemo(() => {
    return afterDuplicateFilter.filter((g) =>
      guestMatchesPlanningFilters(g, planningGroupFilter, planningTableFilter),
    );
  }, [afterDuplicateFilter, planningGroupFilter, planningTableFilter]);

  const filtered = useMemo(() => {
    const list = [...afterPlanningFilter];
    list.sort((a, b) => {
      switch (sort) {
        case "nameAsc":
          return a.guestName.localeCompare(b.guestName);
        case "groupAsc": {
          const ga = (a.group?.trim() || "").toLowerCase();
          const gb = (b.group?.trim() || "").toLowerCase();
          const c = ga.localeCompare(gb);
          if (c !== 0) return c;
          return a.guestName.localeCompare(b.guestName);
        }
        case "tableAsc": {
          const ta = (a.tableName?.trim() || "").toLowerCase();
          const tb = (b.tableName?.trim() || "").toLowerCase();
          const c = ta.localeCompare(tb);
          if (c !== 0) return c;
          return a.guestName.localeCompare(b.guestName);
        }
        case "status": {
          const order: Record<ReturnType<typeof guestPrimaryStatus>, number> = {
            attending: 0,
            declined: 1,
            invited: 2,
            not_invited: 3,
          };
          const statusDiff = order[guestPrimaryStatus(a)] - order[guestPrimaryStatus(b)];
          if (statusDiff !== 0) return statusDiff;
          return a.guestName.localeCompare(b.guestName);
        }
        case "maxGuestsDesc":
          return totalGuestCount(b) - totalGuestCount(a);
        case "updatedDesc":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return list;
  }, [afterPlanningFilter, sort]);

  const selectedGuests = useMemo(
    () => filtered.filter((guest) => selectedIds.has(guest.id)),
    [filtered, selectedIds],
  );
  const selectedCount = selectedGuests.length;
  const selectedWithEmail = useMemo(
    () => selectedGuests.filter((guest) => Boolean(guest.email?.trim())),
    [selectedGuests],
  );
  const hasGuests = guests.length > 0;
  const trueEmpty = !hasGuests;
  const filteredEmpty = hasGuests && filtered.length === 0;
  const searchOrRsvpEmpty = hasGuests && withoutInviteFilter.length === 0;
  const inviteFilterOnlyEmpty =
    hasGuests &&
    withoutInviteFilter.length > 0 &&
    afterInviteFilter.length === 0 &&
    inviteFilter !== "all";
  const readinessFilterOnlyEmpty =
    hasGuests &&
    afterInviteFilter.length > 0 &&
    afterReadinessFilter.length === 0 &&
    readinessFilter !== "all";
  const followUpFilterOnlyEmpty =
    hasGuests &&
    afterReadinessFilter.length > 0 &&
    afterFollowUpFilter.length === 0 &&
    followUpFilter !== "all";
  const duplicateFilterOnlyEmpty =
    hasGuests &&
    afterFollowUpFilter.length > 0 &&
    afterDuplicateFilter.length === 0 &&
    duplicateFilter !== "all";
  const planningFilterOnlyEmpty =
    hasGuests &&
    afterDuplicateFilter.length > 0 &&
    afterPlanningFilter.length === 0 &&
    (planningGroupFilter !== "all" || planningTableFilter !== "all");
  const allVisibleSelected = filtered.length > 0 && filtered.every((guest) => selectedIds.has(guest.id));

  const notInvitedCount = useMemo(
    () => guests.filter((g) => !g.invitedAt).length,
    [guests],
  );

  const remainingNotInvitedGuests = useMemo(
    () => guests.filter((g) => !g.invitedAt),
    [guests],
  );

  const readyToSendGuests = useMemo(
    () => guests.filter((g) => getGuestReadiness(g).id === "ready"),
    [guests],
  );

  const readyToSendCount = readyToSendGuests.length;

  const missingContactGuests = useMemo(
    () => guests.filter((g) => getGuestReadiness(g).id === "missing_contact"),
    [guests],
  );

  const pendingFollowUpGuests = useMemo(
    () => guests.filter((g) => isInvitedAwaitingRsvp(g)),
    [guests],
  );

  const followUpModalGuests = useMemo(() => {
    if (followUpScopeOverride) return followUpScopeOverride;
    if (selectedCount > 0) return selectedGuests.filter((g) => isInvitedAwaitingRsvp(g));
    return filtered.filter((g) => isInvitedAwaitingRsvp(g));
  }, [followUpScopeOverride, selectedCount, selectedGuests, filtered]);

  const followUpScopeDescription = useMemo(() => {
    if (followUpScopeOverride) {
      return `${followUpScopeOverride.length} guest${followUpScopeOverride.length === 1 ? "" : "s"} invited — awaiting RSVP`;
    }
    if (selectedCount > 0) {
      const n = selectedGuests.filter((g) => isInvitedAwaitingRsvp(g)).length;
      return `${n} selected guest${n === 1 ? "" : "s"} eligible for reminders (invited, no response)`;
    }
    const n = filtered.filter((g) => isInvitedAwaitingRsvp(g)).length;
    return `${n} guest${n === 1 ? "" : "s"} in current view (invited, no response yet)`;
  }, [followUpScopeOverride, selectedCount, selectedGuests, filtered]);

  const showSendRemindersThisViewButton = useMemo(() => {
    const eligibleInView = filtered.filter((g) => isInvitedAwaitingRsvp(g)).length;
    const viewIsNarrowed =
      q.trim() !== "" ||
      filter !== "all" ||
      inviteFilter !== "all" ||
      readinessFilter !== "all" ||
      followUpFilter !== "all" ||
      duplicateFilter !== "all" ||
      planningGroupFilter !== "all" ||
      planningTableFilter !== "all" ||
      selectedCount > 0;
    return eligibleInView > 0 && viewIsNarrowed;
  }, [
    filtered,
    q,
    filter,
    inviteFilter,
    readinessFilter,
    followUpFilter,
    duplicateFilter,
    planningGroupFilter,
    planningTableFilter,
    selectedCount,
  ]);

  const inviteScopeGuests = useMemo(() => {
    if (sendInvitesScopeOverride) return sendInvitesScopeOverride;
    if (selectedCount > 0) return selectedGuests;
    return filtered;
  }, [sendInvitesScopeOverride, selectedCount, selectedGuests, filtered]);

  const inviteScopeDescription =
    sendInvitesScopeOverride && sendInvitesScopeMode === "remaining"
      ? `${sendInvitesScopeOverride.length} guest${sendInvitesScopeOverride.length === 1 ? "" : "s"} not invited yet (remaining)`
      : sendInvitesScopeOverride && sendInvitesScopeMode === "ready"
        ? `${sendInvitesScopeOverride.length} guest${sendInvitesScopeOverride.length === 1 ? "" : "s"} ready to send (phone & email on file)`
        : selectedCount > 0
          ? `${selectedCount} selected guest${selectedCount === 1 ? "" : "s"}`
          : `${filtered.length} guest${filtered.length === 1 ? "" : "s"} in current view (no rows selected — using filtered list)`;

  const manualRsvpGuest = useMemo(
    () => guests.find((g) => g.id === manualRsvpGuestId) ?? null,
    [guests, manualRsvpGuestId],
  );

  function clearFilters() {
    setQ("");
    setFilter("all");
    setInviteFilter("all");
    setReadinessFilter("all");
    setFollowUpFilter("all");
    setDuplicateFilter("all");
    setPlanningGroupFilter("all");
    setPlanningTableFilter("all");
    setSort("updatedDesc");
  }

  function openManualRsvpModal(guest: GuestPanelGuest) {
    setManualRsvpGuestId(guest.id);
    setManualRsvpAttending("yes");
    setManualRsvpCount(String(Math.max(1, guest.attendingCount ?? 1)));
    setManualRsvpAttendeeNames("");
    setManualRsvpNote("");
    setManualRsvpMarkInvited(!guest.invitedAt);
    setManualRsvpError(null);
  }

  function toggleAllVisible() {
    setSelectedIds(() => {
      if (allVisibleSelected) return new Set();
      const next = new Set<string>();
      filtered.forEach((guest) => next.add(guest.id));
      return next;
    });
  }

  function toggleGuestSelection(guestId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(guestId);
      else next.delete(guestId);
      return next;
    });
  }

  function buildGuestExportRows(source: GuestPanelGuest[]) {
    return [
      [
        "Guest Name",
        "Men",
        "Women",
        "Kids",
        "Total Guests",
        "Greeting",
        "Category (group)",
        "Table",
        "RSVP Status",
        "Readiness",
        "Follow-up",
        "Duplicate",
        "Attending Count",
        "Response Time",
        "Message to host",
        "Email",
        "Phone",
        "Notes",
        "Invited At",
        "Invite channel",
        "Family invite",
      ],
      ...source.map((guest) => {
        return [
          guest.guestName,
          String(guest.menCount ?? 0),
          String(guest.womenCount ?? 0),
          String(guest.kidsCount ?? 0),
          String(totalGuestCount(guest)),
          guest.greeting || "Assalamu Alaikum",
          guest.group ?? "",
          guest.tableName ?? "",
          statusLabel(guestPrimaryStatus(guest)),
          getGuestReadiness(guest).label,
          getGuestFollowUpState(guest).label,
          duplicateBadgeLabel(duplicateStrengthMap.get(guest.id) ?? "none") ?? "",
          String(guest.attendingCount ?? 0),
          formatDate(guest.respondedAt),
          guest.hostMessage ?? "",
          guest.email ?? "",
          guest.phone ?? "",
          guest.notes ?? "",
          guest.invitedAt ? formatDate(guest.invitedAt) : "",
          guest.inviteChannelLastUsed ?? "",
          guest.isFamilyInvite ? "Yes" : "No",
        ];
      }),
    ];
  }

  function exportGuests(mode: "all" | "filtered" | "selected") {
    const source =
      mode === "all" ? guests : mode === "filtered" ? filtered : filtered.filter((g) => selectedIds.has(g.id));
    const suffix = mode === "all" ? "all" : mode === "filtered" ? "filtered" : "selected";
    downloadCsv(`guests-${suffix}.csv`, buildGuestExportRows(source));
  }

  function exportGuestsWithoutTable() {
    const source = guests.filter((g) => !g.tableName?.trim());
    downloadCsv("guests-no-table.csv", buildGuestExportRows(source));
  }

  function exportGuestsForTableLabel(tableLabel: string) {
    const source = guests.filter((g) => (g.tableName?.trim() ?? "") === tableLabel);
    const safe = tableLabel.replace(/[^\w\-]+/g, "_").slice(0, 40) || "table";
    downloadCsv(`guests-table-${safe}.csv`, buildGuestExportRows(source));
  }

  function exportGuestsForGroupLabel(groupLabel: string) {
    const source = guests.filter((g) => (g.group?.trim() ?? "") === groupLabel);
    const safe = groupLabel.replace(/[^\w\-]+/g, "_").slice(0, 40) || "group";
    downloadCsv(`guests-group-${safe}.csv`, buildGuestExportRows(source));
  }

  async function copyBulkLinks() {
    if (selectedCount === 0) return;
    const lines = selectedGuests.map((guest) => `${guest.guestName}: ${guestRsvpUrl(siteUrl, guest.token)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedBulkLinks(true);
      setTimeout(() => setCopiedBulkLinks(false), 1800);
    } catch {
      setCopiedBulkLinks(false);
    }
  }

  async function copyBulkWhatsAppInvites() {
    if (selectedCount === 0) return;
    const bundles = selectedGuests.map((guest) => {
      const link = guestRsvpUrl(siteUrl, guest.token);
      const message = buildGuestWhatsAppInviteMessage({
        guestId: guest.id,
        greeting: guest.greeting,
        guestName: guest.guestName,
        eventTitle,
        coupleNames: eventCoupleNames,
        rsvpLink: link,
        customIntroLine: inviteMessageIntro,
        customLineOverride: inviteMessageLineOverride,
      });
      return `${guest.guestName}\n${message}`;
    });
    try {
      await navigator.clipboard.writeText(bundles.join("\n\n---\n\n"));
      setCopiedBulkInvites(true);
      setTimeout(() => setCopiedBulkInvites(false), 1800);
      void logBulkWhatsappPreparedAction(eventId, selectedGuests.map((guest) => guest.id));
    } catch {
      setCopiedBulkInvites(false);
    }
  }

  async function sendBulkEmailInvites() {
    if (selectedWithEmail.length === 0) return;
    setBulkEmailStatus("Sending...");
    try {
      const result = await sendBulkGuestInviteEmailsAction(
        eventId,
        selectedWithEmail.map((guest) => guest.id),
      );
      setBulkEmailStatus(
        `Sent ${result.sent}. Skipped ${result.skippedMissingEmail}. Failed ${result.failed}.`,
      );
      router.refresh();
    } catch {
      setBulkEmailStatus("Could not send bulk email invites right now.");
    }
  }

  return (
    <div id="event-guests" className="app-card scroll-mt-24 p-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-zinc-900">
            Guests <span className="text-base font-medium text-zinc-500">({guests.length} famil{guests.length === 1 ? "y" : "ies"})</span>
          </h2>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guest name, group, notes, status..."
            className="input-luxe mt-0 w-full py-2.5 text-sm sm:w-80"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={filtered.length === 0}
              onClick={() => {
                setSendInvitesScopeOverride(null);
                setSendInvitesScopeMode(null);
                setSendInvitesNonce((n) => n + 1);
                setSendInvitesOpen(true);
              }}
            >
              Send invites
            </button>
            {notInvitedCount > 0 ? (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setSendInvitesScopeOverride(remainingNotInvitedGuests);
                  setSendInvitesScopeMode("remaining");
                  setSendInvitesNonce((n) => n + 1);
                  setSendInvitesOpen(true);
                }}
              >
                Send to remaining
              </button>
            ) : null}
            {missingContactGuests.length > 0 ? (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setReadinessFilter("missing_contact");
                  setInviteFilter("all");
                }}
              >
                Missing contact ({missingContactGuests.length})
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-2xl border border-[#dccfbb] bg-white px-3 py-2.5 text-sm font-medium text-zinc-800"
              aria-label="Sort guests"
            >
              <option value="updatedDesc">Last updated (latest)</option>
              <option value="nameAsc">Name (A-Z)</option>
              <option value="groupAsc">Category (A-Z)</option>
              <option value="tableAsc">Table (A-Z)</option>
              <option value="status">RSVP status</option>
              <option value="maxGuestsDesc">Total guests (high to low)</option>
            </select>
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {readyToSendCount > 0 ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setSendInvitesScopeOverride(readyToSendGuests);
              setSendInvitesScopeMode("ready");
              setSendInvitesNonce((n) => n + 1);
              setSendInvitesOpen(true);
            }}
          >
            Send to ready guests
          </button>
        ) : null}
        {readyToSendCount > 0 ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setReadinessFilter("ready");
              setInviteFilter("all");
            }}
          >
            Show ready only
          </button>
        ) : null}
        {pendingFollowUpGuests.length > 0 ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setFollowUpScopeOverride(pendingFollowUpGuests);
              setFollowUpNonce((n) => n + 1);
              setFollowUpModalOpen(true);
            }}
          >
            Follow up with pending guests
          </button>
        ) : null}
        {showSendRemindersThisViewButton ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setFollowUpScopeOverride(null);
              setFollowUpNonce((n) => n + 1);
              setFollowUpModalOpen(true);
            }}
          >
            Send reminders (this view)
          </button>
        ) : null}
        {pendingFollowUpGuests.length > 0 ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setFollowUpFilter("invited_no_response");
              setInviteFilter("all");
            }}
          >
            Show invited, no response
          </button>
        ) : null}
        {duplicateGuestCount > 0 ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setDuplicateFilter("has_duplicates");
              setInviteFilter("all");
            }}
          >
            Show duplicates only
          </button>
        ) : null}
        {duplicateClusterCount > 0 ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setReviewDuplicatesOpen(true)}
          >
            Review duplicates ({duplicateClusterCount})
          </button>
        ) : null}
      </div>

      <section className="mt-4 rounded-2xl border border-[#e7dccb] bg-[#fffdfa] p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">RSVP status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {filterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    filter === t.id ? "bg-[#3f2f1f] text-white" : "bg-[#f5efe4] text-zinc-700 hover:bg-[#ede3d1]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Invite status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {inviteFilterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInviteFilter(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    inviteFilter === t.id
                      ? "bg-[#5c4a33] text-white"
                      : "bg-[#f0e8da] text-zinc-600 hover:bg-[#e8dcc8]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Readiness</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {readinessFilterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setReadinessFilter(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    readinessFilter === t.id
                      ? "bg-[#2f4a3c] text-white"
                      : "bg-[#e8efe9] text-zinc-600 hover:bg-[#d7e5da]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-[#efe4d4] pt-3">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setShowAdvancedFilters((curr) => !curr)}
          >
            {showAdvancedFilters ? "Hide advanced filters" : "More filters"}
          </button>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Follow-up</span>
              <div className="flex flex-wrap gap-2">
                {followUpFilterTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFollowUpFilter(t.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      followUpFilter === t.id
                        ? "bg-[#4a3d5c] text-white"
                        : "bg-[#ebe6f2] text-zinc-600 hover:bg-[#ded8e8]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Duplicates</span>
              <div className="flex flex-wrap gap-2">
                {duplicateFilterTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDuplicateFilter(t.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      duplicateFilter === t.id
                        ? "bg-[#6b2d3c] text-white"
                        : "bg-[#f5e8eb] text-zinc-600 hover:bg-[#ebd0d6]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Seating</span>
              <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <span className="shrink-0">Category</span>
                <select
                  value={planningGroupFilter}
                  onChange={(e) => setPlanningGroupFilter(e.target.value)}
                  className="max-w-[12rem] rounded-full border border-[#dccfbb] bg-white px-3 py-1.5 text-xs font-medium text-zinc-800"
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  <option value="__none__">No category</option>
                  {uniqueGroupLabels.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <span className="shrink-0">Table</span>
                <select
                  value={planningTableFilter}
                  onChange={(e) => setPlanningTableFilter(e.target.value)}
                  className="max-w-[12rem] rounded-full border border-[#dccfbb] bg-white px-3 py-1.5 text-xs font-medium text-zinc-800"
                  aria-label="Filter by table"
                >
                  <option value="all">All tables</option>
                  <option value="unassigned">No table</option>
                  <option value="assigned">Has table</option>
                  {uniqueTableLabels.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      {hasGuests && notInvitedCount > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          {notInvitedCount} guest{notInvitedCount === 1 ? " has" : "s have"} not been invited yet.
        </p>
      ) : null}
      {hasGuests && readyToSendCount > 0 ? (
        <p className="mt-1 text-xs text-zinc-500">
          {readyToSendCount} guest{readyToSendCount === 1 ? " is" : "s are"} ready to send (phone and email on file).
        </p>
      ) : null}
      {hasGuests && missingContactGuests.length > 0 ? (
        <p className="mt-1 text-xs text-zinc-500">
          {missingContactGuests.length} guest{missingContactGuests.length === 1 ? " has" : "s have"} no phone or email — add
          contact to send invites.
        </p>
      ) : null}
      {hasGuests && duplicateGuestCount > 0 ? (
        <p className="mt-1 text-xs text-zinc-500">
          {duplicateGuestCount} guest{duplicateGuestCount === 1 ? "" : "s"} in {duplicateClusterCount} duplicate
          group{duplicateClusterCount === 1 ? "" : "s"} (same name, phone, or email).
        </p>
      ) : null}

      <div className="mt-3 text-sm text-zinc-500">
        Showing {filtered.length} of {guests.length}
        {inviteFilter !== "all" ? (
          <span className="text-zinc-400"> · invite filter active</span>
        ) : null}
        {readinessFilter !== "all" ? (
          <span className="text-zinc-400"> · readiness filter active</span>
        ) : null}
        {followUpFilter !== "all" ? (
          <span className="text-zinc-400"> · follow-up filter active</span>
        ) : null}
        {duplicateFilter !== "all" ? (
          <span className="text-zinc-400"> · duplicate filter active</span>
        ) : null}
        {planningGroupFilter !== "all" || planningTableFilter !== "all" ? (
          <span className="text-zinc-400"> · seating filter active</span>
        ) : null}
      </div>

      {selectedCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9ccb6] bg-[#f8f1e5] px-4 py-3">
          <p className="text-sm font-medium text-zinc-800">{selectedCount} selected</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={copyBulkLinks}>
              {copiedBulkLinks ? "Copied links!" : "Copy links"}
            </button>
            <button type="button" className="btn-secondary" onClick={copyBulkWhatsAppInvites}>
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                {copiedBulkInvites ? "Copied WhatsApp invites!" : "Copy WhatsApp invites"}
              </span>
            </button>
            <button type="button" className="btn-secondary" onClick={() => exportGuests("selected")}>
              Export selected CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                await markGuestsInvitedAction(eventId, [...selectedIds], "manual");
                router.refresh();
              }}
              disabled={selectedCount === 0}
            >
              Mark selected invited
            </button>
            <button
              type="button"
              className="btn-secondary"
              title="Preview message for the first selected guest (each guest gets individualized text)"
              onClick={() => {
                const first = [...selectedIds][0];
                if (first) {
                  setCommunicationBulkMeta({ count: selectedCount });
                  setCommunicationPreviewGuestId(first);
                }
              }}
            >
              Preview message ({selectedCount} selected)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={sendBulkEmailInvites}
              disabled={selectedWithEmail.length === 0}
              title={selectedWithEmail.length === 0 ? "No selected guests have an email address" : undefined}
            >
              Send email invites ({selectedWithEmail.length})
            </button>
            <form action={bulkUpdateGuestPlanningAction} className="flex flex-wrap items-center gap-1">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="guestIds" value={[...selectedIds].join(",")} />
              <input type="hidden" name="mode" value="assignGroup" />
              <input
                name="value"
                type="text"
                placeholder="Category"
                className="w-28 rounded-xl border border-[#dccfbb] bg-white px-2 py-1.5 text-xs"
                aria-label="Category to assign"
              />
              <button type="submit" className="btn-secondary text-xs">
                Set category
              </button>
            </form>
            <form action={bulkUpdateGuestPlanningAction} className="flex flex-wrap items-center gap-1">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="guestIds" value={[...selectedIds].join(",")} />
              <input type="hidden" name="mode" value="assignTable" />
              <input
                name="value"
                type="text"
                placeholder="Table"
                className="w-28 rounded-xl border border-[#dccfbb] bg-white px-2 py-1.5 text-xs"
                aria-label="Table to assign"
              />
              <button type="submit" className="btn-secondary text-xs">
                Set table
              </button>
            </form>
            <form
              action={bulkUpdateGuestPlanningAction}
              onSubmit={(e) => {
                if (!confirm(`Clear category for ${selectedCount} guest(s)?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="guestIds" value={[...selectedIds].join(",")} />
              <input type="hidden" name="mode" value="clearGroup" />
              <button type="submit" className="btn-secondary text-xs">
                Clear category
              </button>
            </form>
            <form
              action={bulkUpdateGuestPlanningAction}
              onSubmit={(e) => {
                if (!confirm(`Clear table for ${selectedCount} guest(s)?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="guestIds" value={[...selectedIds].join(",")} />
              <input type="hidden" name="mode" value="clearTable" />
              <button type="submit" className="btn-secondary text-xs">
                Clear table
              </button>
            </form>
            <form
              action={bulkDeleteGuestsAction}
              onSubmit={(e) => {
                if (!confirm(`Delete ${selectedCount} selected guest(s)? This cannot be undone.`)) {
                  e.preventDefault();
                  return;
                }
                setSelectedIds(new Set());
              }}
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="guestIds" value={[...selectedIds].join(",")} />
              <button type="submit" className="btn-secondary border-red-200 bg-white text-red-600 hover:bg-red-50">
                Delete selected
              </button>
            </form>
            <button type="button" className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </button>
          </div>
          {bulkEmailStatus ? <p className="w-full text-xs text-zinc-600">{bulkEmailStatus}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => exportGuests("all")}>
          Export all CSV
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const source = filtered;
            const rows = [
              [
                "Guest Name",
                "Men",
                "Women",
                "Kids",
                "Total Guests",
                "Greeting",
                "Token",
                "RSVP Link",
                "Category",
                "Table",
                "Attending (true/false)",
                "Attending Count",
                "Responded At (ISO)",
                "Last Updated (ISO)",
                "Message to host",
                "Email",
                "Phone",
                "Notes",
                "Invited At (ISO)",
                "Invite channel",
                "Family invite (true/false)",
              ],
              ...source.map((guest) => {
                const st = guestPrimaryStatus(guest);
                const link = guestRsvpUrl(siteUrl, guest.token);
                const attendingBool = st === "attending";
                return [
                  guest.guestName,
                  String(guest.menCount ?? 0),
                  String(guest.womenCount ?? 0),
                  String(guest.kidsCount ?? 0),
                  String(totalGuestCount(guest)),
                  guest.greeting || "Assalamu Alaikum",
                  guest.token,
                  link,
                  guest.group ?? "",
                  guest.tableName ?? "",
                  String(attendingBool),
                  String(guest.attendingCount ?? 0),
                  guest.respondedAt ?? "",
                  guest.updatedAt,
                  guest.hostMessage ?? "",
                  guest.email ?? "",
                  guest.phone ?? "",
                  guest.notes ?? "",
                  guest.invitedAt ?? "",
                  guest.inviteChannelLastUsed ?? "",
                  String(guest.isFamilyInvite),
                ];
              }),
            ];
            downloadCsv("rsvp-dataset.csv", rows);
          }}
        >
          Export RSVP dataset
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const confirmed = filtered.filter((g) => guestPrimaryStatus(g) === "attending");
            const rows = [
              [
                "Guest Name",
                "Men",
                "Women",
                "Kids",
                "Total Guests",
                "Greeting",
                "Category",
                "Table",
                "RSVP Status",
                "Attending Count",
                "Response Time",
                "Message to host",
                "Email",
                "Phone",
                "Notes",
              ],
              ...confirmed.map((guest) => [
                guest.guestName,
                String(guest.menCount ?? 0),
                String(guest.womenCount ?? 0),
                String(guest.kidsCount ?? 0),
                String(totalGuestCount(guest)),
                guest.greeting || "Assalamu Alaikum",
                guest.group ?? "",
                guest.tableName ?? "",
                statusLabel(guestPrimaryStatus(guest)),
                String(guest.attendingCount ?? 0),
                formatDate(guest.respondedAt),
                guest.hostMessage ?? "",
                guest.email ?? "",
                guest.phone ?? "",
                guest.notes ?? "",
              ]),
            ];
            downloadCsv("guests-confirmed-attendees.csv", rows);
          }}
        >
          Export confirmed attendees
        </button>
        <button type="button" className="btn-secondary" onClick={() => exportGuests("filtered")}>
          Export filtered CSV
        </button>
        <button type="button" className="btn-secondary" onClick={exportGuestsWithoutTable}>
          Export no table
        </button>
        {uniqueTableLabels.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-zinc-500">By table:</span>
            {uniqueTableLabels.slice(0, 6).map((t) => (
              <button
                key={t}
                type="button"
                className="btn-secondary text-xs py-1"
                onClick={() => exportGuestsForTableLabel(t)}
              >
                {t.length > 14 ? `${t.slice(0, 14)}…` : t}
              </button>
            ))}
            {uniqueTableLabels.length > 6 ? (
              <span className="text-xs text-zinc-400">+{uniqueTableLabels.length - 6} more</span>
            ) : null}
          </span>
        ) : null}
        {uniqueGroupLabels.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-zinc-500">By category:</span>
            {uniqueGroupLabels.slice(0, 4).map((g) => (
              <button
                key={g}
                type="button"
                className="btn-secondary text-xs py-1"
                onClick={() => exportGuestsForGroupLabel(g)}
              >
                {g.length > 12 ? `${g.slice(0, 12)}…` : g}
              </button>
            ))}
            {uniqueGroupLabels.length > 4 ? (
              <span className="text-xs text-zinc-400">+{uniqueGroupLabels.length - 4} more</span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {trueEmpty ? (
          <p className="app-card-muted border border-dashed px-4 py-8 text-center text-sm text-zinc-600">
            No guests have been added yet.
          </p>
        ) : filteredEmpty ? (
          <div className="app-card-muted border border-dashed px-4 py-8 text-center text-sm text-zinc-600">
            <p>
              {searchOrRsvpEmpty
                ? "No guests matched your search criteria."
                : inviteFilterOnlyEmpty
                  ? "No guests matched your current invite filter."
                  : readinessFilterOnlyEmpty
                    ? "No guests matched your current readiness filter."
                    : followUpFilterOnlyEmpty
                      ? followUpFilter === "invited_no_response"
                        ? "No guests currently need follow-up."
                        : "No guests matched your current follow-up filter."
                      : duplicateFilterOnlyEmpty
                        ? "No guests matched your current duplicate filter."
                        : planningFilterOnlyEmpty
                          ? "No guests matched your current seating or category filters."
                          : "No guests matched your search criteria."}
            </p>
            <button type="button" onClick={clearFilters} className="btn-secondary mt-4">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e7dccb]">
            <div className="max-h-[34rem] overflow-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#f7efe2]">
                  <tr className="border-b border-[#e1d5c3] text-xs uppercase tracking-[0.12em] text-zinc-600">
                    <th className="w-[36%] px-3 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          aria-label="Select all visible guests"
                        />
                        <span>Guest</span>
                      </label>
                    </th>
                    <th className="w-[24%] px-3 py-3">Status</th>
                    <th className="w-[18%] px-3 py-3">Invite</th>
                    <th className="w-[22%] px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filtered.map((guest) => {
                    const link = guestRsvpUrl(siteUrl, guest.token);
                    const inviteMessage = buildGuestWhatsAppInviteMessage({
                      guestId: guest.id,
                      greeting: guest.greeting,
                      guestName: guest.guestName,
                      eventTitle,
                      coupleNames: eventCoupleNames,
                      rsvpLink: link,
                      customIntroLine: inviteMessageIntro,
                      customLineOverride: inviteMessageLineOverride,
                    });
                    const whatsappDirectUrl = getWhatsAppInviteUrlForGuest(guest.phone, inviteMessage);
                    const st = guestPrimaryStatus(guest);
                    const readiness = getGuestReadiness(guest);
                    const isEditing = editingGuestId === guest.id;
                    const statusBadges = [
                      { label: statusLabel(st).toUpperCase(), kind: "status" as const },
                      ...(readiness.id === "missing_contact"
                        ? [{ label: "MISSING CONTACT", kind: "warning" as const }]
                        : []),
                      ...(readiness.id === "missing_email"
                        ? [{ label: "MISSING EMAIL", kind: "warning" as const }]
                        : []),
                      ...(readiness.id === "missing_phone"
                        ? [{ label: "MISSING PHONE", kind: "warning" as const }]
                        : []),
                    ];
                    const visibleStatusBadges = statusBadges.slice(0, 4);
                    const hiddenStatusCount = Math.max(0, statusBadges.length - visibleStatusBadges.length);

                    return (
                      <tr
                        key={guest.id}
                        className="border-b border-[#f0e7d9] text-sm text-zinc-700 transition hover:bg-[#fcf8f1]"
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(guest.id)}
                              onChange={(e) => toggleGuestSelection(guest.id, e.target.checked)}
                              aria-label={`Select ${guest.guestName}`}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-zinc-900">{guest.guestName}</p>
                              <p className="mt-1 text-xs text-zinc-600">
                                Men {guest.menCount ?? 0} · Women {guest.womenCount ?? 0} · Kids {guest.kidsCount ?? 0} ·{" "}
                                Total {totalGuestCount(guest)}
                              </p>
                              {(guest.phone || guest.email) ? (
                                <p className="mt-1 truncate text-[11px] text-zinc-500">
                                  {[guest.phone, guest.email].filter(Boolean).join(" · ")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {visibleStatusBadges.map((badge) => (
                              <span key={badge.label} className={compactStatusBadgeClass(badge.kind)}>
                                {badge.label}
                              </span>
                            ))}
                            {hiddenStatusCount > 0 ? (
                              <span className={compactStatusBadgeClass("meta")}>+{hiddenStatusCount} more</span>
                            ) : null}
                          </div>
                          {st === "invited" && guest.lastReminderAt ? (
                            <span className="mt-1 block text-[10px] text-zinc-400">
                              Reminder {formatDate(guest.lastReminderAt)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={inviteBadgeClass(guest)} title={guest.invitedAt ?? undefined}>
                            {inviteBadgeLabel(guest)}
                          </span>
                          {guest.invitedAt ? (
                            <span className="mt-0.5 block text-[10px] text-zinc-400">
                              {guest.inviteCount > 1 ? `${guest.inviteCount} sends · ` : null}
                              {formatDate(guest.invitedAt)}
                            </span>
                          ) : null}
                          {communicationLastByGuest[guest.id] ? (
                            <span className="mt-0.5 block text-[10px] text-zinc-400" title="Most recent logged communication action">
                              Last log: {lastCommChannelLabel(communicationLastByGuest[guest.id].channel)} ·{" "}
                              {formatDate(communicationLastByGuest[guest.id].at)}
                            </span>
                          ) : null}
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e7dccb] bg-[#fcf8f1] text-zinc-600 transition hover:border-[#d4c4a8] hover:bg-[#f5ecdd] hover:text-zinc-900"
                              title={inviteCardPreviewByGuest.get(guest.id)?.usingLine ?? "Resolved invite card"}
                              aria-label="Resolved invite card preview"
                              onClick={() => setPreviewGuestId(guest.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                                <path
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e7dccb] bg-[#fcf8f1] text-zinc-600 transition hover:border-[#d4c4a8] hover:bg-[#f5ecdd] hover:text-zinc-900"
                              title="Open guest RSVP page"
                              aria-label="Preview guest RSVP page"
                              onClick={() => {
                                const url = `${guestRsvpUrl(siteUrl, guest.token)}?preview=1`;
                                window.open(url, "_blank", "noopener,noreferrer");
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                                <path
                                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5a2.25 2.25 0 002.25-2.25V10.5M10.5 13.5L21 3m0 0h-6.75M21 3v6.75"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              title="View communication history for this guest"
                              onClick={() => setCommHistoryGuest({ id: guest.id, name: guest.guestName })}
                            >
                              Comm history
                            </button>
                            {!guest.invitedAt ? (
                              <button
                                type="button"
                                className="btn-secondary px-3 py-1.5 text-xs"
                                onClick={async () => {
                                  await markGuestsInvitedAction(eventId, [guest.id], "manual");
                                  router.refresh();
                                }}
                              >
                                Mark invited
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              onClick={() => openManualRsvpModal(guest)}
                            >
                              Record RSVP
                            </button>
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              title="Preview WhatsApp & email text for this guest"
                              aria-label="Preview message"
                              onClick={() => {
                                setCommunicationBulkMeta(null);
                                setCommunicationPreviewGuestId(guest.id);
                              }}
                            >
                              Preview message
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(link);
                                } catch {
                                  // no-op
                                }
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              Copy link
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(inviteMessage);
                                  setCopiedMessageGuestId(guest.id);
                                  void logGuestWhatsappPreparedAction(eventId, guest.id);
                                  setTimeout(() => {
                                    setCopiedMessageGuestId(null);
                                  }, 1800);
                                } catch {
                                  setCopiedMessageGuestId(null);
                                }
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              {copiedMessageGuestId === guest.id ? "Copied!" : "Copy invite"}
                            </button>
                            {guest.email ? (
                              <button
                                type="button"
                                className="btn-secondary px-3 py-1.5 text-xs"
                                disabled={emailSendingGuestId === guest.id}
                                onClick={async () => {
                                  setEmailSendingGuestId(guest.id);
                                  setEmailSentGuestId(null);
                                  try {
                                    const result = await sendGuestInviteEmailAction(eventId, guest.id);
                                    if (result.ok && !result.skipped) {
                                      setEmailSentGuestId(guest.id);
                                      setTimeout(() => setEmailSentGuestId(null), 1800);
                                      router.refresh();
                                    }
                                  } finally {
                                    setEmailSendingGuestId(null);
                                  }
                                }}
                              >
                                {emailSendingGuestId === guest.id
                                  ? "Sending..."
                                  : emailSentGuestId === guest.id
                                    ? "Email sent!"
                                    : "Send email"}
                              </button>
                            ) : null}
                            {whatsappDirectUrl ? (
                              <a
                                href={whatsappDirectUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary px-3 py-1.5 text-xs"
                                aria-label="Send via WhatsApp"
                                title="Opens WhatsApp to this guest with the invite prefilled"
                                onClick={() => {
                                  void logGuestWhatsappPreparedAction(eventId, guest.id);
                                }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </span>
                              </a>
                            ) : (
                              <span
                                className="btn-secondary inline-flex cursor-not-allowed items-center px-3 py-1.5 text-xs opacity-50"
                                title="Add a phone number with country code (no leading 0) for direct WhatsApp."
                                aria-disabled="true"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </span>
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              onClick={() => setEditingGuestId((curr) => (curr === guest.id ? null : guest.id))}
                            >
                              {isEditing ? "Close edit" : "Edit"}
                            </button>
                            <form action={deleteGuestAction}>
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="guestId" value={guest.id} />
                              <button
                                type="submit"
                                className="btn-secondary border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editingGuest ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-edit-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close guest editor"
            onClick={() => {
              if (!guestEditPending) setEditingGuestId(null);
            }}
          />
          <div className="relative z-10 flex max-h-[min(92vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa] shadow-xl">
            <div className="shrink-0 border-b border-[#efe4d4] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Edit guest</p>
                  <h3 id="guest-edit-title" className="mt-1 text-lg font-semibold text-zinc-900">
                    {editingGuest.guestName}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  disabled={guestEditPending}
                  onClick={() => setEditingGuestId(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {guestEditError ? (
                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {guestEditError}
                </p>
              ) : null}
              <form
                key={editingGuest.id}
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setGuestEditError(null);
                  setGuestEditPending(true);
                  try {
                    const fd = new FormData(e.currentTarget);
                    await updateGuestAction(fd);
                    setEditingGuestId(null);
                    router.refresh();
                  } catch (err) {
                    setGuestEditError(err instanceof Error ? err.message : "Could not save guest.");
                  } finally {
                    setGuestEditPending(false);
                  }
                }}
              >
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="guestId" value={editingGuest.id} />
                <input
                  type="text"
                  name="guestName"
                  defaultValue={editingGuest.guestName}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  required
                  placeholder="Guest name"
                />
                <input
                  type="number"
                  name="menCount"
                  min={0}
                  defaultValue={editingGuest.menCount ?? 0}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  required
                  placeholder="Men"
                />
                <input
                  type="number"
                  name="womenCount"
                  min={0}
                  defaultValue={editingGuest.womenCount ?? 0}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  required
                  placeholder="Women"
                />
                <input
                  type="number"
                  name="kidsCount"
                  min={0}
                  defaultValue={editingGuest.kidsCount ?? 0}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  required
                  placeholder="Kids"
                />
                <select
                  name="greetingPreset"
                  defaultValue={
                    ["Assalamu Alaikum", "Hello", "Hi", "Dear"].includes(editingGuest.greeting)
                      ? editingGuest.greeting
                      : "Assalamu Alaikum"
                  }
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                >
                  <option value="Assalamu Alaikum">Assalamu Alaikum</option>
                  <option value="Hello">Hello</option>
                  <option value="Hi">Hi</option>
                  <option value="Dear">Dear</option>
                </select>
                <input
                  type="text"
                  name="greetingCustom"
                  defaultValue={
                    ["Assalamu Alaikum", "Hello", "Hi", "Dear"].includes(editingGuest.greeting)
                      ? ""
                      : editingGuest.greeting
                  }
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  placeholder="Custom greeting (optional)"
                />
                <input
                  type="text"
                  name="group"
                  defaultValue={editingGuest.group ?? ""}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  placeholder="Category / group"
                />
                <input
                  type="text"
                  name="tableName"
                  defaultValue={editingGuest.tableName ?? ""}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  placeholder="Table"
                />
                <input
                  type="text"
                  name="phone"
                  defaultValue={editingGuest.phone ?? ""}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  placeholder="Phone (international, e.g. +65…)"
                  autoComplete="tel"
                />
                <input
                  type="email"
                  name="email"
                  defaultValue={editingGuest.email ?? ""}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  placeholder="Email"
                />
                {editingGuest.phone?.trim() && normalizePhoneForWhatsApp(editingGuest.phone) === null ? (
                  <p className="sm:col-span-2 text-xs text-amber-900">
                    This number may not open WhatsApp directly. Use a country code and drop a national leading 0 (for
                    example <span className="font-mono">+65 9123 4567</span>).
                  </p>
                ) : null}
                <input
                  type="text"
                  name="notes"
                  defaultValue={editingGuest.notes ?? ""}
                  className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                  placeholder="Notes"
                />
                <label className="flex items-start gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="isFamilyInvite"
                    value="true"
                    defaultChecked={editingGuest.isFamilyInvite}
                    className="mt-1 h-4 w-4 rounded border-[#dccfbb] text-zinc-900"
                  />
                  <span className="text-xs text-zinc-700">
                    Family invite — use the family invite card when no size-specific card applies (see event settings).
                  </span>
                </label>
                <div className="sm:col-span-2 rounded-xl border border-[#e7dccb] bg-[#fbf8f2] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Resolved invite card (saved guest)
                  </p>
                  <p className="mt-1 text-xs text-zinc-700">
                    {inviteCardPreviewByGuest.get(editingGuest.id)?.usingLine ?? "Using: Default Card"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Save changes after editing max guests or family invite to refresh this preview.
                  </p>
                  {inviteCardPreviewByGuest.get(editingGuest.id)?.safeSrc ? (
                    <div className="relative mt-2 h-36 w-full max-w-xs overflow-hidden rounded-lg border border-[#e7dccb] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element -- small admin preview */}
                      <img
                        src={inviteCardPreviewByGuest.get(editingGuest.id)?.safeSrc ?? ""}
                        alt=""
                        className="h-full w-full object-contain object-center"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">No image for this variant.</p>
                  )}
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button type="submit" className="btn-secondary px-3 py-1.5 text-sm" disabled={guestEditPending}>
                    {guestEditPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {manualRsvpGuest ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close manual RSVP dialog"
            onClick={() => {
              if (!manualRsvpSaving) setManualRsvpGuestId(null);
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e7dccb] bg-[#fffdfa] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Record RSVP</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">{manualRsvpGuest.guestName}</h3>
                <p className="mt-1 text-xs text-zinc-600">
                  Admin-recorded response for offline replies (phone, family, in-person).
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={manualRsvpSaving}
                onClick={() => setManualRsvpGuestId(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-zinc-700">
                Decision
                <select
                  value={manualRsvpAttending}
                  onChange={(e) => setManualRsvpAttending(e.target.value as "yes" | "no")}
                  className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                >
                  <option value="yes">Attending</option>
                  <option value="no">Declining</option>
                </select>
              </label>
              <label className="text-sm text-zinc-700">
                Attending count
                <input
                  type="number"
                  min={0}
                  max={manualRsvpGuest.maxGuests}
                  value={manualRsvpAttending === "yes" ? manualRsvpCount : "0"}
                  disabled={manualRsvpAttending === "no"}
                  onChange={(e) => setManualRsvpCount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="sm:col-span-2 text-sm text-zinc-700">
                Attendee names (optional)
                <input
                  type="text"
                  value={manualRsvpAttendeeNames}
                  onChange={(e) => setManualRsvpAttendeeNames(e.target.value)}
                  placeholder="e.g. Ahmad, Aisyah, Grandma"
                  className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="sm:col-span-2 text-sm text-zinc-700">
                Notes (optional)
                <textarea
                  value={manualRsvpNote}
                  onChange={(e) => setManualRsvpNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Confirmed by phone call."
                  className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                />
              </label>
              {!manualRsvpGuest.invitedAt ? (
                <label className="sm:col-span-2 inline-flex items-start gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={manualRsvpMarkInvited}
                    onChange={(e) => setManualRsvpMarkInvited(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#dccfbb]"
                  />
                  Also mark as invited (manual)
                </label>
              ) : null}
            </div>

            {manualRsvpError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {manualRsvpError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={manualRsvpSaving}
                onClick={async () => {
                  setManualRsvpError(null);
                  setManualRsvpSaving(true);
                  try {
                    await recordGuestManualRsvpAction({
                      eventId,
                      guestId: manualRsvpGuest.id,
                      attending: manualRsvpAttending,
                      attendingCount: manualRsvpAttending === "yes" ? Number(manualRsvpCount || "0") : 0,
                      attendeeNames: manualRsvpAttendeeNames,
                      note: manualRsvpNote,
                      markInvitedIfMissing: manualRsvpMarkInvited,
                    });
                    setManualRsvpGuestId(null);
                    router.refresh();
                  } catch (error) {
                    setManualRsvpError(error instanceof Error ? error.message : "Could not record RSVP.");
                  } finally {
                    setManualRsvpSaving(false);
                  }
                }}
              >
                {manualRsvpSaving ? "Saving..." : "Save RSVP"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CommunicationPreviewModal
        open={communicationPreviewGuestId !== null}
        onClose={() => {
          setCommunicationPreviewGuestId(null);
          setCommunicationBulkMeta(null);
        }}
        eventId={eventId}
        guestId={communicationPreviewGuestId}
        bulkSampleNote={Boolean(communicationBulkMeta && communicationBulkMeta.count > 1)}
        selectedCount={communicationBulkMeta?.count}
      />

      <GuestInviteCardPreviewModal
        open={Boolean(previewGuestId)}
        onClose={() => setPreviewGuestId(null)}
        safeSrc={
          previewGuestId ? inviteCardPreviewByGuest.get(previewGuestId)?.safeSrc ?? null : null
        }
        usingLine={
          previewGuestId ? inviteCardPreviewByGuest.get(previewGuestId)?.usingLine ?? "" : ""
        }
        guestName={previewGuestId ? guests.find((g) => g.id === previewGuestId)?.guestName ?? "" : ""}
      />

      <ReviewDuplicatesModal
        open={reviewDuplicatesOpen}
        onClose={() => setReviewDuplicatesOpen(false)}
        eventId={eventId}
        eventTitle={eventTitle}
        guests={guests}
        onRequestEditGuest={(id) => {
          setEditingGuestId(id);
          setReviewDuplicatesOpen(false);
        }}
      />

      <SendInvitesModal
        key={sendInvitesNonce}
        open={sendInvitesOpen}
        onClose={() => {
          setSendInvitesOpen(false);
          setSendInvitesScopeOverride(null);
          setSendInvitesScopeMode(null);
        }}
        eventId={eventId}
        eventTitle={eventTitle}
        eventCoupleNames={eventCoupleNames}
        inviteMessageIntro={inviteMessageIntro}
        inviteMessageLineOverride={inviteMessageLineOverride}
        siteUrl={siteUrl}
        scopeDescription={inviteScopeDescription}
        guests={inviteScopeGuests.map((g) => ({
          id: g.id,
          guestName: g.guestName,
          greeting: g.greeting,
          token: g.token,
          phone: g.phone,
          email: g.email,
        }))}
      />

      <GuestCommunicationHistoryModal
        open={commHistoryGuest !== null}
        onClose={() => setCommHistoryGuest(null)}
        eventId={eventId}
        guestId={commHistoryGuest?.id ?? null}
        guestName={commHistoryGuest?.name ?? ""}
      />

      <SendInvitesModal
        key={`followup-${followUpNonce}`}
        mode="reminder"
        open={followUpModalOpen}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpScopeOverride(null);
        }}
        eventId={eventId}
        eventTitle={eventTitle}
        eventCoupleNames={eventCoupleNames}
        inviteMessageIntro={inviteMessageIntro}
        inviteMessageLineOverride={inviteMessageLineOverride}
        siteUrl={siteUrl}
        scopeDescription={followUpScopeDescription}
        guests={followUpModalGuests.map((g) => ({
          id: g.id,
          guestName: g.guestName,
          greeting: g.greeting,
          token: g.token,
          phone: g.phone,
          email: g.email,
        }))}
      />
    </div>
  );
}

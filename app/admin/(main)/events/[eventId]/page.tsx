import Link from "next/link";
import { redirect } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { EventRsvpShare } from "@/components/admin/event-rsvp-share";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { EventGuestsPanel } from "@/components/admin/event-guests-panel";
import { normalizeGuestNameKey } from "@/lib/csv-guests";
import { EventDashboardScrollReset } from "@/components/admin/event-dashboard-scroll-reset";
import { RsvpPreviewModal } from "@/components/admin/rsvp-preview-modal";
import { GuestListAccess, type GuestListMember, type HeldDeclinedGuest } from "@/components/admin/guest-list-access";
import { Menu, MenuItem } from "@/components/admin/ui/menu";
import { AllowanceRegister, EmptyState } from "@/components/admin/planning-ui";
import { EventRegister } from "@/components/admin/event-register";
import { ItineraryTimeline, type ItineraryItem } from "@/components/itinerary-timeline";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { getEventAccess } from "@/lib/wedding-access";
import { allocationUsage, getGuestListPermission } from "@/lib/guest-allocation";
import { canEditGuest, canSeeAllGuests, guestScopeWhere, invitationPlaces } from "@/lib/guest-permissions";
import { countedBreakdown, effectiveExclusionFields, summarizeEventAttendance } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { isGuestEmailConfigured } from "@/lib/rsvp-email";
import { summarizeReadinessGuestCounts } from "@/lib/guest-readiness";
import { getPublicSiteUrl, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";
import type { InviteCardEventInput } from "@/lib/invite-card-resolution";

const TABS = [
  { id: "guests", label: "Guests" },
  { id: "invitation", label: "Invitations" },
  { id: "allowances", label: "Allowances" },
  { id: "schedule", label: "Schedule" },
  { id: "settings", label: "Settings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{
    tab?: string;
    q?: string;
    invite?: string;
    send?: string;
    activityQ?: string;
    activityAction?: string;
    managedBy?: string;
    gl_ok?: string;
    gl_error?: string;
  }>;
};

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const ACTIVITY_ACTIONS = [
  "all",
  "event_updated",
  "guest_created",
  "guest_updated",
  "guest_deleted",
  "guest_bulk_deleted",
  "guest_bulk_imported",
  "rsvp_submitted",
  "rsvp_updated",
  "communication_email_queued",
  "communication_email_sent",
  "communication_email_failed",
  "communication_email_guest_sent",
  "communication_email_guest_failed",
  "communication_email_guest_skipped",
  "communication_whatsapp_prepared",
  "communication_whatsapp_bulk_prepared",
  "communication_imessage_prepared",
  "guest_invite_marked",
  "guest_invite_cleared",
  "communication_email_guest_reminder_sent",
  "guest_reminder_recorded",
  "guest_shared_detected",
  "guest_excluded_from_totals",
  "guest_count_owner_changed",
];

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function EventDashboardPage({ params, searchParams }: Props) {
  const admin = await requireCurrentAdminUser();
  const { eventId } = await params;
  const sp = searchParams ? await searchParams : {};
  const requestedTab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "guests";
  const tab: TabId = requestedTab === "settings" && (sp.gl_ok || sp.gl_error) ? "allowances" : requestedTab;
  const activityQ = sp.activityQ?.trim() || "";
  const activityAction = sp.activityAction?.trim() || "all";

  const access = await getEventAccess(admin, eventId);
  if (access.status === "forbidden") {
    redirect("/admin/events");
  }
  const perm = access.status === "ok" ? await getGuestListPermission(admin, eventId) : null;
  const managedByFilter = perm && canSeeAllGuests(perm) && sp.managedBy?.trim() ? sp.managedBy.trim() : null;
  const event =
    access.status !== "ok" || !perm
      ? null
      : await prisma.event.findFirst({
          where: { id: eventId, deletedAt: null },
          include: {
            guests: {
              where: { deletedAt: null, ...guestScopeWhere(perm), ...(managedByFilter ? { managedByUserId: managedByFilter } : {}) },
              orderBy: { createdAt: "desc" },
            },
          },
        });

  if (!event || !perm) {
    return (
      <main className="app-shell">
        <EmptyState
          title="Event not found"
          action={
            <Link href="/admin/events" className="btn-secondary">
              Back to events
            </Link>
          }
        >
          It may have been deleted, or you may not have access.
        </EmptyState>
      </main>
    );
  }

  const isOrganizer = perm.level === "organizer";
  const usage = await allocationUsage(event.id);
  const weddingMembers = event.weddingId
    ? await prisma.weddingMembership.findMany({
        where: { weddingId: event.weddingId },
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { name: true } } },
      })
    : [];
  const eventRoles = await prisma.eventRole.findMany({ where: { eventId: event.id } });
  const memberNameById = new Map(weddingMembers.map((m) => [m.userId, m.user.name]));
  const guestListMembers: GuestListMember[] = weddingMembers.map((m) => {
    const role = eventRoles.find((r) => r.userId === m.userId);
    const alloc = usage.allocations.find((a) => a.userId === m.userId);
    return {
      userId: m.userId,
      name: m.user.name,
      role: role?.role === "contributor" ? "contributor" : role?.role === "organizer" ? "organizer" : null,
      canManageAllGuests: Boolean(role?.canManageAllGuests),
      allocation: alloc ? { places: alloc.places, used: alloc.used, remaining: alloc.remaining, households: alloc.households, declinedPlaces: alloc.declinedPlaces } : null,
    };
  });
  const declinedHolding: HeldDeclinedGuest[] = event.guests
    .filter((g) => g.allocationId && g.attending === false)
    .slice(0, 25)
    .map((g) => ({ id: g.id, guestName: g.guestName, places: invitationPlaces(g), managerName: g.managedByUserId ? (memberNameById.get(g.managedByUserId) ?? null) : null }));
  const wedding = event.weddingId ? await prisma.wedding.findUnique({ where: { id: event.weddingId }, select: { defaultGreeting: true } }) : null;
  const defaultGreeting = wedding?.defaultGreeting || "Assalamu Alaikum";
  const myAllocation = perm.allocation ? usage.allocations.find((a) => a.id === perm.allocation!.id) : null;

  const attendance = summarizeEventAttendance(event.guests);
  const countedGuests = event.guests.filter((g) => countedBreakdown(g).total > 0);
  const readiness = summarizeReadinessGuestCounts(
    countedGuests.map((g) => ({ respondedAt: g.respondedAt?.toISOString() ?? null, invitedAt: g.invitedAt?.toISOString() ?? null, phone: g.phone, email: g.email })),
  );
  const deadlineMeta = getRsvpDeadlineMeta(event.rsvpDeadline);
  const itinerary = Array.isArray(event.itinerary) ? (event.itinerary as ItineraryItem[]) : [];
  const emailConfigured = isGuestEmailConfigured();
  const siteUrl = getPublicSiteUrl();

  const sharedKeyCandidates = [...new Set(event.guests.map((g) => g.sharedGuestKey).filter((k): k is string => Boolean(k)))];
  const sharedKeysInOtherEvents = new Set(
    (event.weddingId && sharedKeyCandidates.length > 0
      ? await prisma.guest.findMany({
          where: { deletedAt: null, eventId: { not: event.id }, event: { weddingId: event.weddingId }, sharedGuestKey: { in: sharedKeyCandidates } },
          select: { sharedGuestKey: true },
        })
      : []
    )
      .map((g) => g.sharedGuestKey)
      .filter((k): k is string => Boolean(k)),
  );

  // Sequential queries to stay within the connection pool limit.
  const commLogs = await prisma.guestCommunicationLog.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: 8000,
    select: { guestId: true, channel: true, createdAt: true, actionKey: true },
  });
  const eventReminderSentGuestIds = [...new Set(commLogs.filter((l) => l.actionKey === "event_reminder_sent").map((l) => l.guestId))];
  const communicationLastByGuest: Record<string, { channel: string; at: string }> = {};
  for (const row of commLogs) {
    if (!communicationLastByGuest[row.guestId]) communicationLastByGuest[row.guestId] = { channel: row.channel, at: row.createdAt.toISOString() };
  }

  const deletedGuestsSummary = await prisma.guest.findMany({
    where: { eventId: event.id, deletedAt: { not: null }, ...guestScopeWhere(perm) },
    orderBy: { deletedAt: "desc" },
    take: 40,
    select: { id: true, guestName: true, deletedAt: true },
  });

  const guestsSerialized = event.guests.map((g) => {
    const effective = effectiveExclusionFields(g);
    const legacy = effective.exclusionKind === "legacy_automatic";
    return {
      id: g.id,
      guestName: g.guestName,
      greeting: g.greeting ?? "Assalamu Alaikum",
      menCount: g.menCount ?? 0,
      womenCount: g.womenCount ?? 0,
      kidsCount: g.kidsCount ?? 0,
      maxGuests: g.maxGuests,
      token: g.token,
      attending: g.attending,
      attendingCount: g.attendingCount,
      respondedAt: g.respondedAt?.toISOString() ?? null,
      group: g.group,
      tableName: g.tableName ?? null,
      notes: g.notes,
      hostMessage: g.hostMessage ?? null,
      phone: g.phone,
      phoneCountryCode: g.phoneCountryCode,
      email: g.email,
      invitedAt: g.invitedAt?.toISOString() ?? null,
      inviteChannelLastUsed: g.inviteChannelLastUsed ?? null,
      inviteCount: g.inviteCount ?? 0,
      lastReminderAt: g.lastReminderAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      isFamilyInvite: g.isFamilyInvite,
      ...effective,
      excludeReason: legacy ? null : g.excludeReason,
      countOwnerEventId: legacy ? null : g.countOwnerEventId,
      sharedGuestKey: g.sharedGuestKey,
      isSharedGuest: g.sharedGuestKey ? sharedKeysInOtherEvents.has(g.sharedGuestKey) : false,
      managedByUserId: g.managedByUserId,
      canEdit: canEditGuest(perm, g),
    };
  });

  const inviteCardEvent: InviteCardEventInput = {
    imagePath: event.imagePath,
    genericCardImage: event.genericCardImage,
    cardImage1: event.cardImage1,
    cardImage2: event.cardImage2,
    cardImage3: event.cardImage3,
    cardImage4: event.cardImage4,
    familyCardImage: event.familyCardImage,
  };

  const dateLine = [event.eventDate ? dateFmt.format(event.eventDate) : null, event.eventTime, event.venue].filter(Boolean).join(" · ");
  const deadlineText = event.rsvpDeadline
    ? deadlineMeta?.status === "closed"
      ? `Replies closed ${shortFmt.format(event.rsvpDeadline)}`
      : deadlineMeta?.status === "closes_today"
        ? "Replies close today"
        : `Replies close ${shortFmt.format(event.rsvpDeadline)}${deadlineMeta?.status === "closing_soon" ? ` (in ${plural(deadlineMeta.daysRemaining, "day")})` : ""}`
    : null;
  const tabHref = (id: TabId) => `/admin/events/${event.id}${id === "guests" ? "" : `?tab=${id}`}`;
  const contributors = guestListMembers.filter((m) => m.allocation && m.role === "contributor");
  const visibleTabs = TABS.filter((t) => t.id !== "allowances" || event.weddingId);
  let awaitingPlaces = 0;
  let notInvitedPlaces = 0;
  for (const g of event.guests) {
    const places = countedBreakdown(g).total;
    if (places <= 0) continue;
    if (!g.invitedAt) notInvitedPlaces += places;
    else if (!g.respondedAt) awaitingPlaces += places;
  }
  const showRegister = attendance.households > 0 && (tab === "guests" || tab === "invitation");

  return (
    <main className="app-shell">
      <EventDashboardScrollReset eventId={event.id} />

      <header>
        <Link href="/admin/events" className="mb-1.5 inline-flex min-h-8 items-center gap-1 text-sm text-[var(--muted-text)] hover:text-[var(--foreground)]">
          <span aria-hidden>←</span> Events
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title">{event.title}</h1>
            <p className="page-meta">{dateLine || "Date and venue not set"}</p>
          </div>
          <div className="flex items-center gap-2">
            <RsvpPreviewModal eventId={event.id} triggerClassName="btn-secondary" />
            <Menu label="More event actions" summaryClassName="btn-secondary px-2.5" trigger={<Ellipsis className="h-4 w-4" aria-hidden />}>
              {isOrganizer ? <MenuItem href={`/admin/events/${event.id}/edit`}>Edit event</MenuItem> : null}
              <MenuItem href={`/admin/events/${event.id}/report`}>Host summary</MenuItem>
            </Menu>
          </div>
        </div>
      </header>

      <nav className="tab-list mt-5" aria-label="Event sections">
        {visibleTabs.map((t) => (
          <Link key={t.id} href={tabHref(t.id)} scroll={false} className="tab" aria-current={tab === t.id ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="pt-5">
        {showRegister ? (
          <div className="mb-6">
            <EventRegister
              placesOnList={attendance.invitedPeople}
              coming={attendance.confirmedPeople}
              awaitingPlaces={awaitingPlaces}
              notInvitedPlaces={notInvitedPlaces}
              repliedHouseholds={attendance.respondedHouseholds}
              households={countedGuests.length}
              deadline={deadlineText ? { text: deadlineText, urgent: deadlineMeta?.status === "closing_soon" || deadlineMeta?.status === "closes_today" } : null}
            />
          </div>
        ) : null}

        {tab === "guests" ? (
          <>
            {perm.level === "contributor" ? (
              <div className="mb-6">
                {myAllocation ? (
                  <AllowanceRegister name="Your allowance" used={myAllocation.used} places={myAllocation.places} declinedPlaces={myAllocation.declinedPlaces} />
                ) : (
                  <p className="notice-warning">You don&apos;t have an allowance for this event yet. Ask an organizer to set one before adding households.</p>
                )}
              </div>
            ) : contributors.length > 0 ? (
              <section aria-label="Allowances" className="mb-6">
                <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {contributors.map((m) => (
                    <li key={m.userId}>
                      <AllowanceRegister
                        compact
                        name={m.name}
                        href={`${tabHref("guests")}?managedBy=${encodeURIComponent(m.userId)}`}
                        used={m.allocation!.used}
                        places={m.allocation!.places}
                        declinedPlaces={m.allocation!.declinedPlaces}
                      />
                    </li>
                  ))}
                </ul>
                {isOrganizer ? (
                  <Link href={tabHref("allowances")} className="text-link mt-2 inline-block text-sm">
                    Manage allowances
                  </Link>
                ) : null}
              </section>
            ) : null}
            {managedByFilter ? (
              <p className="notice-info mb-4">
                Showing {memberNameById.get(managedByFilter) ?? "one member"}&apos;s list only.{" "}
                <Link href={tabHref("guests")} className="text-link">
                  Show everyone
                </Link>
              </p>
            ) : null}
            {attendance.legacyAutomaticIgnored > 0 ? (
              <p className="mb-4 text-xs text-[var(--muted-text)]">
                {plural(attendance.legacyAutomaticIgnored, "household")} also invited to another event now {attendance.legacyAutomaticIgnored === 1 ? "counts" : "count"} here too.
              </p>
            ) : null}
            <EventGuestsPanel
              eventId={event.id}
              eventTitle={event.title}
              eventCoupleNames={event.coupleNames}
              inviteMessageIntro={event.inviteMessageIntro}
              inviteMessageLineOverride={event.inviteMessageLineOverride}
              guests={guestsSerialized}
              deletedGuestsSummary={deletedGuestsSummary.map((g) => ({ id: g.id, guestName: g.guestName, deletedAt: g.deletedAt!.toISOString() }))}
              siteUrl={siteUrl}
              inviteCardEvent={inviteCardEvent}
              communicationLastByGuest={communicationLastByGuest}
              hasItinerary={itinerary.length > 0}
              eventReminderSentGuestIds={eventReminderSentGuestIds}
              eventVenue={event.venue}
              eventTime={event.eventTime}
              addEvent={
                isOrganizer || perm.allocation
                  ? { id: event.id, title: event.title, allowance: perm.level === "contributor" && myAllocation ? { places: myAllocation.places, used: myAllocation.used } : null }
                  : null
              }
              defaultGreeting={defaultGreeting}
              managers={perm.rolesConfigured ? weddingMembers.map((m) => ({ id: m.userId, name: m.user.name })) : []}
              currentUserId={admin.id}
              existingGuestNameKeys={event.guests.map((g) => normalizeGuestNameKey(g.guestName))}
              emailConfigured={emailConfigured}
              initialQuery={sp.q?.slice(0, 80) ?? ""}
              initialInviteIds={sp.invite ? sp.invite.split(",").filter(Boolean).slice(0, 500) : []}
              initialAction={sp.send === "invite" ? "invite" : sp.send === "remind" ? "remind" : null}
            />
          </>
        ) : null}

        {tab === "invitation" ? (
          <InvitationTab
            event={event}
            dateLine={dateLine}
            isOrganizer={isOrganizer}
            readiness={readiness}
            notInvited={attendance.notInvitedHouseholds}
            awaiting={attendance.awaitingReplyHouseholds}
            replied={attendance.respondedHouseholds}
            emailConfigured={emailConfigured}
            shareGuests={guestsSerialized.map((g) => ({ id: g.id, guestName: g.guestName, token: g.token, greeting: g.greeting, phone: g.phone, phoneCountryCode: g.phoneCountryCode }))}
            tabHref={tabHref}
          />
        ) : null}

        {tab === "schedule" ? (
          <section className="max-w-3xl">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="section-heading">Running order</h2>
                {isOrganizer ? (
                  <Link href={`/admin/events/${event.id}/edit#running-order`} className="btn-secondary btn-sm">
                    Edit schedule
                  </Link>
                ) : null}
              </div>
              {itinerary.length > 0 ? (
                <ItineraryTimeline items={itinerary} planner />
              ) : (
                <EmptyState title="No running order yet">Add timings so guests know when to arrive. Private items stay hidden from guests.</EmptyState>
              )}
            </div>
          </section>
        ) : null}

        {tab === "allowances" && event.weddingId ? (
          <div className="max-w-4xl">
            <GuestListAccess
              eventId={event.id}
              perm={perm}
              members={guestListMembers}
              unallocatedPlaces={usage.unallocatedPlaces}
              declinedHolding={isOrganizer ? declinedHolding : []}
              managedByFilter={managedByFilter}
              message={sp.gl_ok ?? null}
              error={sp.gl_error ?? null}
            />
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="max-w-3xl space-y-10">
            {isOrganizer ? (
              <section aria-labelledby="details-heading" className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="details-heading" className="section-heading">
                    Event details
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--muted-text)]">Date, venue, invitation wording, cards and running order</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/events/${event.id}/report`} className="btn-ghost">
                    Host summary
                  </Link>
                  <Link href={`/admin/events/${event.id}/edit`} className="btn-secondary">
                    Edit event
                  </Link>
                </div>
              </section>
            ) : null}

            <ActivitySection eventId={event.id} adminId={admin.id} seesAll={canSeeAllGuests(perm)} q={activityQ} action={activityAction} />

            {isOrganizer ? (
              <section aria-labelledby="danger-heading" className="mt-16 border-t border-[var(--border-strong)] pt-6">
                <h2 id="danger-heading" className="section-heading">
                  Delete event
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-text)]">Guests&apos; invitation links stop working. You can restore the event from Events → Deleted.</p>
                <DeleteEventButton eventId={event.id} redirectToListOnSuccess className="btn-danger-quiet mt-3" />
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function InvitationTab({
  event,
  dateLine,
  isOrganizer,
  readiness,
  notInvited,
  awaiting,
  replied,
  emailConfigured,
  shareGuests,
  tabHref,
}: {
  event: {
    id: string;
    title: string;
    coupleNames: string | null;
    imagePath: string | null;
    welcomeMessage: string | null;
    eventSubtitle: string | null;
    inviteMessageIntro: string | null;
    inviteMessageLineOverride: string | null;
  };
  dateLine: string;
  isOrganizer: boolean;
  readiness: ReturnType<typeof summarizeReadinessGuestCounts>;
  notInvited: number;
  awaiting: number;
  replied: number;
  emailConfigured: boolean;
  shareGuests: { id: string; guestName: string; token: string; greeting: string; phone: string | null; phoneCountryCode: string | null }[];
  tabHref: (id: TabId) => string;
}) {
  const imageSrc = getSafeImageSrc(event.imagePath);
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="inv-send-heading" className="lg:order-2">
        <h2 id="inv-send-heading" className="section-heading mb-3">
          Send
        </h2>
        <ul className="list-rows text-sm">
          <SendRow count={notInvited} label="not invited yet">
            {notInvited > 0 ? (
              <Link href={`${tabHref("guests")}?send=invite`} className="btn-primary btn-sm">
                Send invitations
              </Link>
            ) : null}
          </SendRow>
          <SendRow count={awaiting} label="awaiting reply">
            {awaiting > 0 ? (
              <Link href={`${tabHref("guests")}?send=remind`} className="btn-secondary btn-sm">
                Send reminders
              </Link>
            ) : null}
          </SendRow>
          <SendRow count={replied} label="replied" />
          {readiness.missingContact > 0 ? (
            <li className="px-4 py-2.5 text-[13px] text-[var(--warning)]">
              {plural(readiness.missingContact, "household")} not yet invited {readiness.missingContact === 1 ? "has" : "have"} no phone or email
            </li>
          ) : null}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted-text)]">
          WhatsApp and text messages open on your phone and you press send. Mark households invited afterwards so the counts stay right.
          {emailConfigured ? "" : " Email sending isn't set up."}
        </p>
        <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
          <EventRsvpShare
            eventTitle={event.title}
            eventCoupleNames={event.coupleNames}
            inviteMessageIntro={event.inviteMessageIntro}
            inviteMessageLineOverride={event.inviteMessageLineOverride}
            guests={shareGuests}
            triggerClassName="btn-sm"
          />
        </div>
      </section>

      <section aria-labelledby="inv-preview-heading" className="lg:order-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="inv-preview-heading" className="section-heading">
            What guests see
          </h2>
          {isOrganizer ? (
            <Link href={`/admin/events/${event.id}/edit`} className="btn-secondary btn-sm">
              Edit wording
            </Link>
          ) : null}
        </div>
        <div className="paper-sheet overflow-hidden">
          {imageSrc ? (
            <div className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              <EventImageLightbox src={imageSrc} alt={`${event.title} invitation`} hintText="View full size" previewHeightClassName="h-64 sm:h-80" />
            </div>
          ) : null}
          <div className="px-6 py-9 text-center">
            {event.coupleNames ? (
              <p className="font-[family-name:var(--font-wedding-serif)] text-[2rem] leading-tight text-[var(--foreground)]">{event.coupleNames}</p>
            ) : null}
            <p className="mt-2 text-sm font-medium tracking-wide text-[var(--muted-text)]">{event.eventSubtitle || event.title}</p>
            {dateLine ? <p className="mt-1 text-sm text-[var(--muted-text)]">{dateLine}</p> : null}
            {event.welcomeMessage ? <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed whitespace-pre-line">{event.welcomeMessage}</p> : null}
            {!imageSrc && !event.welcomeMessage ? <p className="mt-4 text-sm text-[var(--muted-text)]">No invitation card or welcome message yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function SendRow({ count, label, children }: { count: number; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
      <span className="tabular-nums">
        <span className="text-base font-bold">{count}</span> <span className="text-[var(--muted-text)]">{count === 1 ? "household" : "households"}</span> {label}
      </span>
      {children}
    </li>
  );
}

async function ActivitySection({ eventId, adminId, seesAll, q, action }: { eventId: string; adminId: string; seesAll: boolean; q: string; action: string }) {
  const rows = await prisma.auditActivity.findMany({
    where: {
      eventId,
      ...(seesAll ? {} : { userId: adminId }),
      ...(action !== "all" ? { actionType: action } : {}),
      ...(q
        ? {
            OR: [
              { message: { contains: q, mode: "insensitive" } },
              { userName: { contains: q, mode: "insensitive" } },
              { entityName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="section-heading">
        Activity
      </h2>
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="settings" />
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search activity</span>
          <input name="activityQ" defaultValue={q} placeholder="Search activity" className="input-luxe mt-0" />
        </label>
        <label>
          <span className="sr-only">Action type</span>
          <select name="activityAction" defaultValue={action} className="input-luxe mt-0 w-auto">
            {ACTIVITY_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "All actions" : formatActionLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted-text)]">{q || action !== "all" ? "No activity matches these filters." : "No activity yet."}</p>
      ) : (
        <ul className="list-rows mt-3 max-h-[32rem] overflow-y-auto">
          {rows.map((a) => (
            <li key={a.id} className="px-4 py-2.5">
              <p className="text-sm">{a.message}</p>
              <p className="text-xs text-[var(--muted-text)]">
                {a.userName} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(a.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatActionLabel(value: string) {
  const s = value.split("_").filter(Boolean).join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

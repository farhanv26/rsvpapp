import Link from "next/link";
import { redirect } from "next/navigation";
import { createGuestAction } from "@/app/admin/events/actions";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { EventRsvpShare } from "@/components/admin/event-rsvp-share";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { GuestPhoneFields } from "@/components/admin/guest-phone-fields";
import { EventGuestsPanel } from "@/components/admin/event-guests-panel";
import { GuestCsvImport } from "@/components/admin/guest-csv-import";
import { normalizeGuestNameKey } from "@/lib/csv-guests";
import { EventSectionNav } from "@/components/admin/event-section-nav";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { EventDashboardScrollReset } from "@/components/admin/event-dashboard-scroll-reset";
import { ScrollToGuestsControl } from "@/components/admin/scroll-to-guests-control";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { countInvitedAwaitingRsvp } from "@/lib/guest-followup";
import { countDuplicateClusters, countGuestsInDuplicateClusters } from "@/lib/guest-duplicates";
import { summarizeReadinessGuestCounts } from "@/lib/guest-readiness";
import { getPublicSiteUrl, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";
import type { InviteCardEventInput } from "@/lib/invite-card-resolution";

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ activityQ?: string; activityAction?: string }>;
};

export const dynamic = "force-dynamic";

export default async function EventDashboardPage({ params, searchParams }: Props) {
  const admin = await requireCurrentAdminUser();
  const { eventId } = await params;
  const activityParams = searchParams ? await searchParams : undefined;
  const activityQ = activityParams?.activityQ?.trim() || "";
  const activityAction = activityParams?.activityAction?.trim() || "all";

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    include: {
      guests: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      rsvpActivities: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          guest: {
            select: { guestName: true },
          },
        },
      },
    },
  });

  if (!event) {
    return (
      <main className="min-h-screen bg-[#faf8f3]">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <p className="rounded-3xl bg-white p-6 text-zinc-700 shadow-sm ring-1 ring-amber-900/10">
            Event not found.
          </p>
        </div>
      </main>
    );
  }
  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    redirect("/admin/events");
  }

  const totalFamilies = event.guests.length;
  const guestCountedBreakdown = (g: (typeof event.guests)[number]) => {
    const excMen = g.excludedMenCount ?? 0;
    const excWomen = g.excludedWomenCount ?? 0;
    const excKids = g.excludedKidsCount ?? 0;
    const catSum = excMen + excWomen + excKids;
    const rawMen = g.menCount ?? 0;
    const rawWomen = g.womenCount ?? 0;
    const rawKids = g.kidsCount ?? 0;
    const rawTotal = rawMen + rawWomen + rawKids > 0 ? rawMen + rawWomen + rawKids : g.maxGuests;
    if (catSum > 0) {
      const cMen = Math.max(rawMen - excMen, 0);
      const cWomen = Math.max(rawWomen - excWomen, 0);
      const cKids = Math.max(rawKids - excKids, 0);
      return { men: cMen, women: cWomen, kids: cKids, total: cMen + cWomen + cKids };
    }
    const legacyExcluded = g.excludedGuestCount ?? 0;
    return {
      men: legacyExcluded === 0 ? rawMen : 0,
      women: legacyExcluded === 0 ? rawWomen : 0,
      kids: legacyExcluded === 0 ? rawKids : 0,
      total: Math.max(rawTotal - legacyExcluded, 0),
    };
  };
  const guestEffectiveExcludedTotal = (g: (typeof event.guests)[number]) => {
    const catSum = (g.excludedMenCount ?? 0) + (g.excludedWomenCount ?? 0) + (g.excludedKidsCount ?? 0);
    return catSum > 0 ? catSum : (g.excludedGuestCount ?? 0);
  };
  const countedGuests = event.guests.filter((g) => guestCountedBreakdown(g).total > 0);
  const excludedGuests = totalFamilies - countedGuests.length;
  const totalMaximumInvited = event.guests.reduce((sum, g) => sum + guestCountedBreakdown(g).total, 0);
  const totalMen = event.guests.reduce((sum, g) => sum + guestCountedBreakdown(g).men, 0);
  const totalWomen = event.guests.reduce((sum, g) => sum + guestCountedBreakdown(g).women, 0);
  const totalKids = event.guests.reduce((sum, g) => sum + guestCountedBreakdown(g).kids, 0);
  const totalResponded = countedGuests.filter((guest) => guest.respondedAt).length;
  const invitedFamilies = countedGuests.filter((guest) => guest.invitedAt).length;
  const totalPending = countedGuests.filter((guest) => !guest.respondedAt).length;
  const totalAttendingFamilies = countedGuests.filter((guest) => guest.attending === true).length;
  const totalDeclinedFamilies = countedGuests.filter((guest) => guest.attending === false).length;
  const totalConfirmedAttendees = countedGuests.reduce(
    (sum, guest) => sum + (guest.attendingCount ?? 0),
    0,
  );
  const responseRate = countedGuests.length > 0 ? totalResponded / countedGuests.length : 0;
  const attendanceRate = totalMaximumInvited > 0 ? totalConfirmedAttendees / totalMaximumInvited : 0;

  const duplicateFamiliesCount = event.guests.filter((g) => guestEffectiveExcludedTotal(g) > 0).length;
  const duplicatePeopleCount = event.guests.reduce((sum, g) => sum + guestEffectiveExcludedTotal(g), 0);

  const readinessOverview = summarizeReadinessGuestCounts(
    countedGuests.map((g) => ({
      respondedAt: g.respondedAt?.toISOString() ?? null,
      invitedAt: g.invitedAt?.toISOString() ?? null,
      phone: g.phone,
      email: g.email,
    })),
  );

  const needsFollowUpCount = countInvitedAwaitingRsvp(
    countedGuests.map((g) => ({
      invitedAt: g.invitedAt?.toISOString() ?? null,
      respondedAt: g.respondedAt?.toISOString() ?? null,
    })),
  );

  const duplicateDetectionInput = event.guests.map((g) => ({
    id: g.id,
    guestName: g.guestName,
    phone: g.phone,
    phoneCountryCode: g.phoneCountryCode,
    email: g.email,
  }));
  const duplicateGuestsDetected = countGuestsInDuplicateClusters(duplicateDetectionInput);
  const duplicateGroupsCount = countDuplicateClusters(duplicateDetectionInput);

  const distinctGroupCategories = new Set(
    event.guests.map((g) => g.group?.trim()).filter((s): s is string => Boolean(s)),
  ).size;
  const distinctTables = new Set(
    event.guests.map((g) => g.tableName?.trim()).filter((s): s is string => Boolean(s)),
  ).size;
  const guestsWithoutTable = event.guests.filter((g) => !g.tableName?.trim()).length;
  const guestsWithoutGroup = event.guests.filter((g) => !g.group?.trim()).length;

  const sharedKeyCandidates = Array.from(
    new Set(event.guests.map((g) => g.sharedGuestKey).filter((key): key is string => Boolean(key))),
  );
  const sharedKeysInOtherEvents = new Set(
    (
      await prisma.guest.findMany({
        where: {
          deletedAt: null,
          eventId: { not: event.id },
          sharedGuestKey: { in: sharedKeyCandidates.length > 0 ? sharedKeyCandidates : ["__none__"] },
        },
        select: { sharedGuestKey: true },
      })
    )
      .map((g) => g.sharedGuestKey)
      .filter((key): key is string => Boolean(key)),
  );

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [commLogsForHints, commTotalLogs, commDistinctGuests, commWeekLogs] = await Promise.all([
    prisma.guestCommunicationLog.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 8000,
      select: { guestId: true, channel: true, createdAt: true },
    }),
    prisma.guestCommunicationLog.count({ where: { eventId: event.id } }),
    prisma.guestCommunicationLog.groupBy({
      by: ["guestId"],
      where: { eventId: event.id },
    }),
    prisma.guestCommunicationLog.count({
      where: { eventId: event.id, createdAt: { gte: weekAgo } },
    }),
  ]);
  const communicationLastByGuest: Record<string, { channel: string; at: string }> = {};
  for (const row of commLogsForHints) {
    if (communicationLastByGuest[row.guestId]) continue;
    communicationLastByGuest[row.guestId] = {
      channel: row.channel,
      at: row.createdAt.toISOString(),
    };
  }
  const communicationStats = {
    totalLogs: commTotalLogs,
    guestsWithLogs: commDistinctGuests.length,
    guestsWithNoLogs: Math.max(0, totalFamilies - commDistinctGuests.length),
    weekLogs: commWeekLogs,
  };

  const deletedGuestsSummary = await prisma.guest.findMany({
    where: { eventId: event.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 40,
    select: { id: true, guestName: true, deletedAt: true },
  });

  const guestsSerialized = event.guests.map((g) => ({
    id: g.id,
    guestName: g.guestName,
    greeting: (g as unknown as { greeting?: string | null }).greeting ?? "Assalamu Alaikum",
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
    hostMessage: (g as unknown as { hostMessage?: string | null }).hostMessage ?? null,
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
    excludeFromTotals: g.excludeFromTotals,
    excludeReason: g.excludeReason,
    excludedGuestCount: g.excludedGuestCount ?? 0,
    excludedMenCount: g.excludedMenCount ?? 0,
    excludedWomenCount: g.excludedWomenCount ?? 0,
    excludedKidsCount: g.excludedKidsCount ?? 0,
    sharedGuestKey: g.sharedGuestKey,
    countOwnerEventId: g.countOwnerEventId,
    isSharedGuest: g.sharedGuestKey ? sharedKeysInOtherEvents.has(g.sharedGuestKey) : false,
  }));

  const inviteCardEvent: InviteCardEventInput = {
    imagePath: event.imagePath,
    genericCardImage: event.genericCardImage,
    cardImage1: event.cardImage1,
    cardImage2: event.cardImage2,
    cardImage3: event.cardImage3,
    cardImage4: event.cardImage4,
    familyCardImage: event.familyCardImage,
  };
  const safeImageSrc = getSafeImageSrc(event.imagePath);
  console.info("[event-image] admin detail render src", {
    eventId: event.id,
    rawImagePath: event.imagePath,
    safeImageSrc,
  });
  const deadlineMeta = getRsvpDeadlineMeta(event.rsvpDeadline);
  const eventAuditActivity = await prisma.auditActivity.findMany({
    where: {
      eventId: event.id,
      ...(activityAction !== "all" ? { actionType: activityAction } : {}),
      ...(activityQ
        ? {
            OR: [
              { message: { contains: activityQ, mode: "insensitive" } },
              { userName: { contains: activityQ, mode: "insensitive" } },
              { entityName: { contains: activityQ, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const eventActivityActionOptions = [
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
    "guest_invite_marked",
    "guest_invite_cleared",
    "communication_email_guest_reminder_sent",
    "guest_reminder_recorded",
    "guest_shared_detected",
    "guest_excluded_from_totals",
    "guest_count_owner_changed",
  ];
  const sectionStoragePrefix = `${admin.id}:${event.id}`;

  return (
    <main className="min-h-screen">
      <EventDashboardScrollReset eventId={event.id} />
      <div className="app-shell max-w-6xl space-y-6">

        {/* ── Event header ── */}
        <header className="overflow-hidden rounded-3xl border border-[#e7dccb] bg-[#fffdfa] shadow-[0_20px_60px_-36px_rgba(71,52,29,0.45)]">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#b28944]/40 to-transparent" />
          <div className="flex flex-col gap-0 lg:flex-row lg:items-stretch">

            {/* Left: event info */}
            <div className="flex-1 p-6 sm:p-8">
              <Link
                href="/admin/events"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:text-zinc-700"
              >
                <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden>
                  <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Events
              </Link>

              <h1 className="headline-display mt-4 text-3xl lg:text-[2.25rem] lg:leading-[1.12] lg:tracking-tight">
                {event.coupleNames?.trim() || event.title}
              </h1>
              {event.coupleNames?.trim() ? (
                <p className="mt-1.5 text-base font-normal text-zinc-500">{event.title}</p>
              ) : null}
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{event.slug}</p>

              {(event.eventDate || event.eventTime || event.venue) ? (
                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {event.eventDate ? (
                    <span className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <CalendarIcon />
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.eventDate)}
                      {event.eventTime ? ` · ${event.eventTime}` : null}
                    </span>
                  ) : null}
                  {event.venue ? (
                    <span className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <LocationIcon />
                      {event.venue}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-5 text-sm text-zinc-400">No ceremony details added yet.</p>
              )}

              {event.rsvpDeadline ? (
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#ece4d4] pt-4">
                  <span className="text-xs text-zinc-500">
                    RSVP deadline{" "}
                    <strong className="font-semibold text-zinc-800">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.rsvpDeadline)}
                    </strong>
                  </span>
                  <span
                    className={
                      deadlineMeta?.status === "closed"
                        ? "badge-neutral"
                        : deadlineMeta?.status === "closes_today"
                          ? "badge-danger"
                          : deadlineMeta?.status === "closing_soon"
                            ? "badge-warning"
                            : "badge-success"
                    }
                  >
                    {deadlineMeta?.status === "closed"
                      ? "Closed"
                      : deadlineMeta?.status === "closes_today"
                        ? "Closes today"
                        : deadlineMeta?.status === "closing_soon"
                          ? `${deadlineMeta.daysRemaining}d left`
                          : "Open"}
                  </span>
                </div>
              ) : null}

              {/* ── Primary KPI strip ── */}
              {totalFamilies > 0 ? (
                <div className="mt-5 grid grid-cols-3 divide-x divide-[#ece4d4] overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fdf9f4]">
                  <KpiCell
                    label="Confirmed"
                    value={totalConfirmedAttendees}
                    sub={`of ${totalMaximumInvited}`}
                    accent="emerald"
                  />
                  <KpiCell
                    label="Response rate"
                    value={`${Math.round(responseRate * 100)}%`}
                    sub={`${totalResponded}/${countedGuests.length}`}
                  />
                  <KpiCell
                    label="Pending"
                    value={totalPending}
                    accent={totalPending > 0 ? "amber" : undefined}
                  />
                </div>
              ) : null}
            </div>

            {/* Right: actions */}
            <div className="flex shrink-0 flex-col border-t border-[#e7dccb] p-5 lg:w-56 lg:border-l lg:border-t-0 lg:p-6">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Actions</p>
              <div className="flex flex-wrap gap-2 lg:flex-col">
                <ScrollToGuestsControl className="lg:w-full lg:justify-center" />
                <Link
                  href={`/admin/events/${event.id}/edit`}
                  className="btn-secondary shrink-0 lg:w-full lg:justify-center"
                >
                  Edit event
                </Link>
                <Link
                  href={`/admin/events/${event.id}/report`}
                  className="btn-secondary shrink-0 lg:w-full lg:justify-center"
                >
                  Host summary
                </Link>
                <EventRsvpShare
                  eventTitle={event.title}
                  eventCoupleNames={event.coupleNames}
                  inviteMessageIntro={event.inviteMessageIntro}
                  inviteMessageLineOverride={event.inviteMessageLineOverride}
                  guests={guestsSerialized.map((g) => ({
                    id: g.id,
                    guestName: g.guestName,
                    token: g.token,
                    greeting: g.greeting,
                    phone: g.phone,
                    phoneCountryCode: g.phoneCountryCode,
                  }))}
                  triggerClassName="shrink-0 lg:w-full lg:justify-center"
                />
                <DeleteEventButton
                  eventId={event.id}
                  redirectToListOnSuccess
                  className="btn-secondary shrink-0 border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 lg:w-full lg:justify-center"
                />
              </div>
            </div>
          </div>
        </header>

        {/* ── Section nav ── */}
        <EventSectionNav
          items={[
            { id: "dashboard-overview", label: "Overview" },
            { id: "dashboard-stats", label: "Stats" },
            { id: "dashboard-tools", label: "Invite tools" },
            { id: "event-guests", label: "Guests" },
            { id: "dashboard-activity", label: "Activity" },
            { id: "dashboard-followup", label: "Follow-up" },
            { id: "dashboard-readiness", label: "Readiness" },
            { id: "dashboard-seating", label: "Seating" },
            { id: "dashboard-hygiene", label: "List hygiene" },
            { id: "dashboard-communications", label: "Comms" },
          ]}
        />

        {/* ── Overview ── */}
        <CollapsibleSection
          id="dashboard-overview"
          title="Overview"
          storageKey={`${sectionStoragePrefix}:overview`}
          className="scroll-mt-24"
        >
          <div className="app-card overflow-hidden">
            {safeImageSrc ? (
              <div className="p-5 sm:p-6">
                <EventImageLightbox
                  src={safeImageSrc}
                  alt={event.title}
                  hintText="View full invitation"
                  previewHeightClassName="h-[18rem] sm:h-[28rem]"
                />
              </div>
            ) : (
              <div className="flex h-36 w-full items-center justify-center bg-[#f7f1e8] text-sm text-zinc-400">
                No invitation image
              </div>
            )}
            {(event.eventSubtitle || event.welcomeMessage || event.description) ? (
              <div className="space-y-2 border-t border-[#ece4d4] p-5 text-sm leading-relaxed text-zinc-700 sm:p-6">
                {event.eventSubtitle ? <p className="font-medium text-zinc-800">{event.eventSubtitle}</p> : null}
                {event.welcomeMessage ? <p>{event.welcomeMessage}</p> : null}
                {event.description ? <p className="text-zinc-500">{event.description}</p> : null}
              </div>
            ) : null}
          </div>
        </CollapsibleSection>

        {/* ── Stats ── */}
        <CollapsibleSection
          id="dashboard-stats"
          title="Stats"
          storageKey={`${sectionStoragePrefix}:stats`}
          className="scroll-mt-24"
          defaultOpen={false}
        >
          <div className="space-y-3">
            {/* Primary KPIs */}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Confirmed attendees"
                value={totalConfirmedAttendees}
                sub={`of ${totalMaximumInvited} max invited`}
                accent="emerald"
                large
              />
              <StatCard
                label="Response rate"
                value={`${Math.round(responseRate * 100)}%`}
                sub={`${totalResponded} of ${countedGuests.length} responded`}
                progress={responseRate}
                accent="blue"
                large
              />
              <StatCard
                label="Attendance rate"
                value={`${Math.round(attendanceRate * 100)}%`}
                sub={`${totalConfirmedAttendees} confirmed`}
                progress={attendanceRate}
                accent="violet"
                large
              />
            </div>

            {/* Families breakdown */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total families" value={totalFamilies} sub={excludedGuests > 0 ? `${excludedGuests} excluded` : undefined} />
              <StatCard label="Counted families" value={countedGuests.length} />
              <StatCard label="Invited families" value={invitedFamilies} />
              <StatCard label="Pending RSVP" value={totalPending} accent={totalPending > 0 ? "amber" : undefined} />
            </div>

            {/* Responses */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Attending families" value={totalAttendingFamilies} sub={`${totalDeclinedFamilies} declined`} />
              <StatCard label="Declined families" value={totalDeclinedFamilies} />
              <StatCard label="Men (counted)" value={totalMen} />
              <StatCard label="Women (counted)" value={totalWomen} />
            </div>

            {/* Misc */}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Kids (counted)" value={totalKids} />
              <StatCard label="Duplicate families" value={duplicateFamiliesCount} sub="with excluded count > 0" accent={duplicateFamiliesCount > 0 ? "rose" : undefined} />
              <StatCard label="Duplicate people" value={duplicatePeopleCount} sub="sum of excluded counts" />
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Invite tools ── */}
        <CollapsibleSection
          id="dashboard-tools"
          title="Invite tools"
          storageKey={`${sectionStoragePrefix}:tools`}
          className="scroll-mt-24"
        >
          <div className="space-y-4">
            <div className="app-card p-6 sm:p-7">
              <h3 className="text-base font-semibold text-zinc-900">Add one guest</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Optional: category, table, contact details, and notes.
              </p>
              <form action={createGuestAction} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="eventId" value={event.id} />
                <label className="block text-sm font-medium text-zinc-700 sm:col-span-2">
                  Guest / family name <span className="text-zinc-400">*</span>
                  <input
                    name="guestName"
                    type="text"
                    placeholder="The Valli Family"
                    className="input-luxe"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Men
                  <input name="menCount" type="number" min={0} defaultValue={0} className="input-luxe" required />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Women
                  <input name="womenCount" type="number" min={0} defaultValue={0} className="input-luxe" required />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Kids
                  <input name="kidsCount" type="number" min={0} defaultValue={0} className="input-luxe" required />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Greeting
                  <select name="greetingPreset" defaultValue="Assalamu Alaikum" className="input-luxe">
                    <option value="Assalamu Alaikum">Assalamu Alaikum</option>
                    <option value="Hello">Hello</option>
                    <option value="Hi">Hi</option>
                    <option value="Dear">Dear</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Custom greeting
                  <input
                    name="greetingCustom"
                    type="text"
                    className="input-luxe"
                    placeholder="Override greeting"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Group / category
                  <input name="group" type="text" className="input-luxe" placeholder="Family, VIP, Bride side…" />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Table
                  <input name="tableName" type="text" className="input-luxe" placeholder="Table 1, A, VIP…" />
                </label>
                <div className="sm:col-span-2 lg:col-span-3 grid gap-4 sm:grid-cols-2">
                  <GuestPhoneFields
                    variant="page"
                    defaultCountryCode={null}
                    defaultNationalDigits=""
                    legacyPhone={null}
                    showWhatsAppPreview
                  />
                  <label className="block min-w-0 text-sm font-medium text-zinc-700">
                    Email
                    <input name="email" type="email" className="input-luxe" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 lg:col-span-3">
                  Notes
                  <input name="notes" type="text" className="input-luxe" />
                </label>
                <label className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
                  <input
                    type="checkbox"
                    name="isFamilyInvite"
                    value="true"
                    className="mt-1 h-4 w-4 rounded border-[#dccfbb] text-zinc-900"
                  />
                  <span className="text-sm text-zinc-600">
                    Family invite — uses the family card variant if one is uploaded.
                  </span>
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <button type="submit" className="btn-primary w-full sm:w-auto">
                    Add guest &amp; generate link
                  </button>
                </div>
              </form>
            </div>

            <GuestCsvImport
              eventId={event.id}
              existingGuestNameKeys={event.guests.map((g) => normalizeGuestNameKey(g.guestName))}
            />
          </div>
        </CollapsibleSection>

        {/* ── Guests ── */}
        <CollapsibleSection
          id="event-guests"
          title="Guests"
          storageKey={`${sectionStoragePrefix}:guests`}
          className="scroll-mt-24"
        >
          <EventGuestsPanel
            eventId={event.id}
            eventTitle={event.title}
            eventCoupleNames={event.coupleNames}
            inviteMessageIntro={event.inviteMessageIntro}
            inviteMessageLineOverride={event.inviteMessageLineOverride}
            guests={guestsSerialized}
            deletedGuestsSummary={deletedGuestsSummary.map((g) => ({
              id: g.id,
              guestName: g.guestName,
              deletedAt: g.deletedAt!.toISOString(),
            }))}
            siteUrl={getPublicSiteUrl()}
            inviteCardEvent={inviteCardEvent}
            communicationLastByGuest={communicationLastByGuest}
          />
        </CollapsibleSection>

        {/* ── Activity ── */}
        <CollapsibleSection
          id="dashboard-activity"
          title="Activity"
          storageKey={`${sectionStoragePrefix}:activity`}
          className="scroll-mt-24"
          defaultOpen={false}
        >
          <div className="app-card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900">
                {eventAuditActivity.length} event{" "}
                {eventAuditActivity.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            <form method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                name="activityQ"
                defaultValue={activityQ}
                placeholder="Search activity…"
                className="input-luxe mt-0"
              />
              <select name="activityAction" defaultValue={activityAction} className="input-luxe mt-0">
                {eventActivityActionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All actions" : formatActionLabel(option)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary">Filter</button>
            </form>
            {eventAuditActivity.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-5 text-sm text-zinc-500">
                No activity matched.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-[#ece4d4] overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa]">
                {eventAuditActivity.map((activity) => (
                  <div key={activity.id} className="px-4 py-3 sm:px-5">
                    <p className="text-sm text-zinc-800">{activity.message}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {activity.userName} · {formatActionLabel(activity.actionType)} ·{" "}
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(activity.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Follow-up ── */}
        {totalFamilies > 0 ? (
          <CollapsibleSection
            id="dashboard-followup"
            title="Follow-up"
            storageKey={`${sectionStoragePrefix}:followup`}
            className="scroll-mt-24"
            defaultOpen={false}
          >
            <div
              className={`app-card p-5 sm:p-6 ${
                needsFollowUpCount > 0 ? "border-amber-200/80 bg-amber-50/40" : ""
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Needs follow-up</p>
              <p className="mt-1 text-sm text-zinc-600">Invited guests who haven't RSVP'd — nudge from the guest list.</p>
              <p className={`mt-3 text-3xl font-semibold tabular-nums ${needsFollowUpCount > 0 ? "text-amber-950" : "text-zinc-400"}`}>
                {needsFollowUpCount}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">invited, awaiting response</p>
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── Readiness ── */}
        {totalFamilies > 0 ? (
          <CollapsibleSection
            id="dashboard-readiness"
            title="Readiness"
            storageKey={`${sectionStoragePrefix}:readiness`}
            className="scroll-mt-24"
            defaultOpen={false}
          >
            <div className="app-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contact &amp; invite readiness</p>
              <p className="mt-1 text-sm text-zinc-500">Who can be invited, who needs contact info, and who's responded.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReadinessCell color="emerald" label="Ready to send" value={readinessOverview.readyToSend} sub="Phone & email, not invited" />
                <ReadinessCell color="rose" label="Missing contact" value={readinessOverview.missingContact} sub="No phone or email yet" />
                <ReadinessCell color="amber" label="Already invited" value={readinessOverview.alreadyInvited} sub="Awaiting RSVP" />
                <ReadinessCell color="violet" label="Responded" value={readinessOverview.responded} sub="RSVP submitted" />
              </div>
              {(readinessOverview.missingPhone > 0 || readinessOverview.missingEmail > 0) ? (
                <p className="mt-3 text-xs text-zinc-400">
                  Partial: {readinessOverview.missingPhone} missing phone (email only),{" "}
                  {readinessOverview.missingEmail} missing email (phone only).
                </p>
              ) : null}
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── Seating & grouping ── */}
        {totalFamilies > 0 ? (
          <CollapsibleSection
            id="dashboard-seating"
            title="Seating & grouping"
            storageKey={`${sectionStoragePrefix}:seating`}
            className="scroll-mt-24"
            defaultOpen={false}
          >
            <div className="app-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Seating &amp; groups</p>
              <p className="mt-1 text-sm text-zinc-500">Categories, table labels, and who still needs assignment.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReadinessCell color="sky" label="Categories" value={distinctGroupCategories} sub="Distinct group labels" />
                <ReadinessCell color="indigo" label="Tables" value={distinctTables} sub="Distinct table names" />
                <ReadinessCell color="amber" label="No table yet" value={guestsWithoutTable} sub="Families not assigned" />
                <ReadinessCell color="zinc" label="No category" value={guestsWithoutGroup} sub="No group label" />
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── List hygiene ── */}
        {totalFamilies > 0 ? (
          <CollapsibleSection
            id="dashboard-hygiene"
            title="List hygiene"
            storageKey={`${sectionStoragePrefix}:hygiene`}
            className="scroll-mt-24"
            defaultOpen={false}
          >
            <div className="app-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">List hygiene</p>
              <p className="mt-1 text-sm text-zinc-500">Duplicate signals, missing contact, and send-ready families.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ReadinessCell
                  color={duplicateGuestsDetected > 0 ? "rose" : "zinc"}
                  label="Possible duplicates"
                  value={duplicateGuestsDetected}
                  sub={`${duplicateGroupsCount} group${duplicateGroupsCount === 1 ? "" : "s"} (name/phone/email)`}
                />
                <ReadinessCell color="rose" label="Missing contact" value={readinessOverview.missingContact} sub="No phone or email" />
                <ReadinessCell color="emerald" label="Send-ready" value={readinessOverview.readyToSend} sub="Phone & email, not invited" />
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── Communications ── */}
        {totalFamilies > 0 ? (
          <CollapsibleSection
            id="dashboard-communications"
            title="Communications"
            storageKey={`${sectionStoragePrefix}:communications`}
            className="scroll-mt-24"
            defaultOpen={false}
          >
            <div className="app-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Communications (logged)</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CommStat label="Total actions" value={communicationStats.totalLogs} />
                <CommStat label="Guests with history" value={communicationStats.guestsWithLogs} />
                <CommStat label="Last 7 days" value={communicationStats.weekLogs} />
                <CommStat label="No comm log" value={communicationStats.guestsWithNoLogs} />
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                Open any guest row to see their full communication timeline.
              </p>
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── RSVP deadline banner (closing/closed) ── */}
        {deadlineMeta?.status === "closing_soon" || deadlineMeta?.status === "closes_today" || deadlineMeta?.status === "closed" ? (
          <CollapsibleSection
            id="dashboard-deadline"
            title="RSVP deadline"
            storageKey={`${sectionStoragePrefix}:deadline`}
            className="scroll-mt-24"
          >
            <div
              className={`app-card p-5 ${
                deadlineMeta.status === "closed"
                  ? "border-zinc-300 bg-zinc-100/60"
                  : deadlineMeta.status === "closes_today"
                    ? "border-rose-200 bg-rose-50"
                    : "border-amber-200 bg-amber-50"
              }`}
            >
              <p className="text-sm font-semibold text-zinc-900">
                {deadlineMeta.status === "closed"
                  ? "RSVP is closed for this event."
                  : deadlineMeta.status === "closes_today"
                    ? "RSVP closes today."
                    : `RSVP closes in ${deadlineMeta.daysRemaining} day${deadlineMeta.daysRemaining === 1 ? "" : "s"}.`}
              </p>
            </div>
          </CollapsibleSection>
        ) : null}

      </div>
    </main>
  );
}

function formatActionLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function KpiCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "emerald" | "amber";
}) {
  return (
    <div className="px-4 py-3 text-center">
      <p className={`text-xl font-semibold tabular-nums ${accent === "emerald" ? "text-emerald-800" : accent === "amber" ? "text-amber-800" : "text-zinc-900"}`}>
        {value}
      </p>
      {sub ? <p className="text-[10px] text-zinc-400">{sub}</p> : null}
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  large,
  progress,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "emerald" | "blue" | "violet" | "amber" | "rose";
  large?: boolean;
  progress?: number;
}) {
  const accentBg: Record<string, string> = {
    emerald: "bg-emerald-50/70 border-emerald-200/60",
    blue: "bg-blue-50/60 border-blue-200/60",
    violet: "bg-violet-50/60 border-violet-200/60",
    amber: "bg-amber-50/60 border-amber-200/60",
    rose: "bg-rose-50/60 border-rose-200/60",
  };
  const accentValue: Record<string, string> = {
    emerald: "text-emerald-950",
    blue: "text-blue-950",
    violet: "text-violet-950",
    amber: "text-amber-950",
    rose: "text-rose-950",
  };
  const accentBar: Record<string, string> = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };

  const cardBase = accent ? accentBg[accent] : "bg-[var(--surface)] border-[var(--border-soft)]";
  const valueColor = accent ? accentValue[accent] : "text-zinc-900";
  const barColor = accent ? accentBar[accent] : "bg-zinc-400";

  return (
    <div className={`rounded-3xl border p-4 shadow-[0_2px_12px_-8px_rgba(71,52,29,0.2)] ${cardBase} ${large ? "sm:p-5" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`mt-2 font-semibold tabular-nums ${large ? "text-3xl" : "text-2xl"} ${valueColor}`}>{value}</p>
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/8">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.round(Math.min(progress, 1) * 100)}%` }}
          />
        </div>
      ) : null}
      {sub ? <p className="mt-1.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function ReadinessCell({
  color,
  label,
  value,
  sub,
}: {
  color: "emerald" | "rose" | "amber" | "violet" | "sky" | "indigo" | "zinc";
  label: string;
  value: number;
  sub: string;
}) {
  const palettes: Record<string, { wrap: string; label: string; value: string; sub: string }> = {
    emerald: { wrap: "border-emerald-200/70 bg-emerald-50/60", label: "text-emerald-800/90", value: "text-emerald-950", sub: "text-emerald-900/80" },
    rose: { wrap: "border-rose-200/70 bg-rose-50/50", label: "text-rose-900/80", value: "text-rose-950", sub: "text-rose-900/75" },
    amber: { wrap: "border-amber-200/80 bg-amber-50/70", label: "text-amber-950/90", value: "text-amber-950", sub: "text-amber-950/80" },
    violet: { wrap: "border-violet-200/70 bg-violet-50/60", label: "text-violet-900/85", value: "text-violet-950", sub: "text-violet-900/80" },
    sky: { wrap: "border-sky-200/80 bg-sky-50/50", label: "text-sky-950/85", value: "text-sky-950", sub: "text-sky-950/75" },
    indigo: { wrap: "border-indigo-200/80 bg-indigo-50/50", label: "text-indigo-950/85", value: "text-indigo-950", sub: "text-indigo-950/75" },
    zinc: { wrap: "border-zinc-200/90 bg-zinc-50/80", label: "text-zinc-600", value: "text-zinc-900", sub: "text-zinc-600" },
  };
  const p = palettes[color];
  return (
    <div className={`rounded-2xl border px-4 py-3 ${p.wrap}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${p.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${p.value}`}>{value}</p>
      <p className={`mt-0.5 text-xs ${p.sub}`}>{sub}</p>
    </div>
  );
}

function CommStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#e7dccb] bg-[#fdf9f4] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden>
      <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.5h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden>
      <path
        d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5c0 2.5 3.5 7 3.5 7s3.5-4.5 3.5-7c0-1.93-1.57-3.5-3.5-3.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="5" r="1.2" fill="currentColor" />
    </svg>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createGuestAction } from "@/app/admin/events/actions";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { EventRsvpShare } from "@/components/admin/event-rsvp-share";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { EventGuestsPanel } from "@/components/admin/event-guests-panel";
import { GuestCsvImport } from "@/components/admin/guest-csv-import";
import { EventSectionNav } from "@/components/admin/event-section-nav";
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

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      guests: {
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
  const totalMaximumInvited = event.guests.reduce(
    (sum, guest) => sum + ((guest.menCount ?? 0) + (guest.womenCount ?? 0) + (guest.kidsCount ?? 0) || guest.maxGuests),
    0,
  );
  const totalResponded = event.guests.filter((guest) => guest.respondedAt).length;
  const totalPending = event.guests.filter((guest) => !guest.respondedAt).length;
  const totalAttendingFamilies = event.guests.filter((guest) => guest.attending === true).length;
  const totalDeclinedFamilies = event.guests.filter((guest) => guest.attending === false).length;
  const totalConfirmedAttendees = event.guests.reduce(
    (sum, guest) => sum + (guest.attendingCount ?? 0),
    0,
  );
  const responseRate = totalFamilies > 0 ? totalResponded / totalFamilies : 0;
  const attendanceRate = totalMaximumInvited > 0 ? totalConfirmedAttendees / totalMaximumInvited : 0;

  const readinessOverview = summarizeReadinessGuestCounts(
    event.guests.map((g) => ({
      respondedAt: g.respondedAt?.toISOString() ?? null,
      invitedAt: g.invitedAt?.toISOString() ?? null,
      phone: g.phone,
      email: g.email,
    })),
  );

  const needsFollowUpCount = countInvitedAwaitingRsvp(
    event.guests.map((g) => ({
      invitedAt: g.invitedAt?.toISOString() ?? null,
      respondedAt: g.respondedAt?.toISOString() ?? null,
    })),
  );

  const duplicateDetectionInput = event.guests.map((g) => ({
    id: g.id,
    guestName: g.guestName,
    phone: g.phone,
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

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
    email: g.email,
    invitedAt: g.invitedAt?.toISOString() ?? null,
    inviteChannelLastUsed: g.inviteChannelLastUsed ?? null,
    inviteCount: g.inviteCount ?? 0,
    lastReminderAt: g.lastReminderAt?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    isFamilyInvite: g.isFamilyInvite,
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
    "communication_email_guest_reminder_sent",
    "guest_reminder_recorded",
  ];

  return (
    <main className="min-h-screen">
      <div className="app-shell max-w-6xl space-y-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="app-card p-6 sm:p-7 lg:flex-1">
            <Link href="/admin/events" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              ← Events
            </Link>
            <h1 className="headline-display mt-3 text-3xl">
              {event.coupleNames?.trim() || event.title}
            </h1>
            {event.coupleNames?.trim() ? (
              <p className="mt-1 text-lg text-zinc-600">{event.title}</p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-zinc-500">{event.slug}</p>
            {(event.eventDate || event.eventTime || event.venue) ? (
              <p className="mt-4 text-sm text-zinc-600">
                {event.eventDate
                  ? new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(event.eventDate)
                  : null}
                {event.eventDate && event.eventTime ? " · " : null}
                {event.eventTime ?? null}
                {(event.eventDate || event.eventTime) && event.venue ? " · " : null}
                {event.venue ?? null}
              </p>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">No ceremony details added yet.</p>
            )}
            {event.rsvpDeadline ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <p className="uppercase tracking-[0.18em] text-zinc-500">
                  RSVP deadline{" "}
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.rsvpDeadline)}
                </p>
                <span
                  className={`${
                    deadlineMeta?.status === "closed"
                      ? "badge-neutral"
                      : deadlineMeta?.status === "closes_today"
                        ? "badge-danger"
                        : deadlineMeta?.status === "closing_soon"
                          ? "badge-warning"
                          : "badge-success"
                  }`}
                >
                  {deadlineMeta?.status === "closed"
                    ? "Closed"
                    : deadlineMeta?.status === "closes_today"
                      ? "Closes Today"
                      : deadlineMeta?.status === "closing_soon"
                        ? "Closing Soon"
                        : "Open"}
                </span>
                {typeof deadlineMeta?.daysRemaining === "number" && deadlineMeta.daysRemaining > 0 ? (
                  <span className="text-zinc-500">
                    {deadlineMeta.daysRemaining} day{deadlineMeta.daysRemaining === 1 ? "" : "s"} remaining
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="#event-guests"
              className="btn-secondary inline-flex shrink-0"
              title="Jump to guest list — use Preview guest RSVP on any row"
            >
              Guest RSVP preview
            </Link>
            <Link
              href={`/admin/events/${event.id}/report`}
              className="btn-secondary inline-flex shrink-0"
            >
              Host summary
            </Link>
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="btn-secondary inline-flex shrink-0"
            >
              Edit event
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
              }))}
            />
            <DeleteEventButton
              eventId={event.id}
              redirectToListOnSuccess
              className="btn-secondary border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            />
          </div>
        </header>

        <EventSectionNav
          items={[
            { id: "dashboard-overview", label: "Overview" },
            { id: "dashboard-readiness", label: "Readiness" },
            { id: "dashboard-seating", label: "Seating" },
            { id: "dashboard-activity", label: "Activity" },
            { id: "dashboard-communications", label: "Communications" },
            { id: "event-guests", label: "Guests" },
            { id: "dashboard-report", label: "Report" },
          ]}
        />

        <section id="dashboard-overview" className="app-card scroll-mt-24 overflow-hidden">
          {safeImageSrc ? (
            <div className="p-5 sm:p-7">
              <EventImageLightbox
                src={safeImageSrc}
                alt={event.title}
                hintText="View full invitation"
                previewHeightClassName="h-[18rem] sm:h-[30rem]"
              />
            </div>
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-[#f7f1e8] text-sm text-zinc-500">
              No invitation image uploaded
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-[#efe4d4] px-5 py-3 sm:px-7">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Invite cards:</span>
            {getSafeImageSrc(event.imagePath) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                Default
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-400">
                Default (none)
              </span>
            )}
            {getSafeImageSrc(event.genericCardImage) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                Generic
              </span>
            ) : null}
            {getSafeImageSrc(event.cardImage1) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                1 guest
              </span>
            ) : null}
            {getSafeImageSrc(event.cardImage2) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                2 guest
              </span>
            ) : null}
            {getSafeImageSrc(event.cardImage3) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                3 guest
              </span>
            ) : null}
            {getSafeImageSrc(event.cardImage4) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                4 guest
              </span>
            ) : null}
            {getSafeImageSrc(event.familyCardImage) ? (
              <span className="rounded-full border border-[#e3d8c7] bg-[#fbf8f2] px-2.5 py-0.5 text-xs text-zinc-700">
                Family
              </span>
            ) : null}
          </div>
          <div className="space-y-3 p-6 text-sm leading-relaxed text-zinc-700 sm:p-8">
            {event.eventSubtitle ? <p className="text-zinc-600">{event.eventSubtitle}</p> : null}
            {event.welcomeMessage ? <p>{event.welcomeMessage}</p> : null}
            {event.description ? <p className="text-zinc-600">{event.description}</p> : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Invited families" value={totalFamilies} />
          <StatCard label="Max invited" value={totalMaximumInvited} />
          <StatCard label="Responded families" value={totalResponded} sub={`${totalPending} pending`} />
          <StatCard label="Confirmed attendees" value={totalConfirmedAttendees} />
          <StatCard label="Declined families" value={totalDeclinedFamilies} />
          <StatCard
            label="Attending families"
            value={totalAttendingFamilies}
            sub={`${totalDeclinedFamilies} declined`}
          />
          <StatCard label="Response rate" value={`${Math.round(responseRate * 100)}%`} />
          <StatCard label="Attendance rate" value={`${Math.round(attendanceRate * 100)}%`} />
        </section>

        {totalFamilies > 0 ? (
          <section
            className={`app-card p-5 sm:p-6 ${
              needsFollowUpCount > 0 ? "border-amber-200/80 bg-amber-50/40" : ""
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Needs follow-up</p>
            <p className="mt-1 text-sm text-zinc-700">
              Invited guests who have not RSVP&apos;d yet — nudge them from the guest list when you&apos;re ready.
            </p>
            <p
              className={`mt-3 text-3xl font-semibold tabular-nums ${
                needsFollowUpCount > 0 ? "text-amber-950" : "text-zinc-400"
              }`}
            >
              {needsFollowUpCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">invited, awaiting response</p>
          </section>
        ) : null}

        {totalFamilies > 0 ? (
          <section id="dashboard-readiness" className="app-card scroll-mt-24 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contact &amp; invite readiness</p>
            <p className="mt-1 text-sm text-zinc-600">
              Who can be invited now, who still needs contact details, and who has already responded.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/90">Ready to send</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-950">
                  {readinessOverview.readyToSend}
                </p>
                <p className="mt-1 text-xs text-emerald-900/80">Phone &amp; email on file, not invited</p>
              </div>
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-900/80">Missing contact</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-950">
                  {readinessOverview.missingContact}
                </p>
                <p className="mt-1 text-xs text-rose-900/75">No phone or email yet</p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950/90">Already invited</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-950">
                  {readinessOverview.alreadyInvited}
                </p>
                <p className="mt-1 text-xs text-amber-950/80">Awaiting RSVP</p>
              </div>
              <div className="rounded-2xl border border-violet-200/70 bg-violet-50/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-900/85">Responded</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-violet-950">
                  {readinessOverview.responded}
                </p>
                <p className="mt-1 text-xs text-violet-900/80">RSVP submitted</p>
              </div>
            </div>
            {(readinessOverview.missingPhone > 0 || readinessOverview.missingEmail > 0) ? (
              <p className="mt-3 text-xs text-zinc-500">
                Partial contact: {readinessOverview.missingPhone} missing phone (email only),{" "}
                {readinessOverview.missingEmail} missing email (phone only).
              </p>
            ) : null}
          </section>
        ) : null}

        {totalFamilies > 0 ? (
          <section id="dashboard-seating" className="app-card scroll-mt-24 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Seating &amp; groups</p>
            <p className="mt-1 text-sm text-zinc-600">
              Categories, table labels, and who still needs assignments.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-950/85">Categories used</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950">{distinctGroupCategories}</p>
                <p className="mt-1 text-xs text-sky-950/75">Distinct group labels</p>
              </div>
              <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-950/85">Tables used</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-indigo-950">{distinctTables}</p>
                <p className="mt-1 text-xs text-indigo-950/75">Distinct table names</p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950/90">No table yet</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-950">{guestsWithoutTable}</p>
                <p className="mt-1 text-xs text-amber-950/80">Families not assigned</p>
              </div>
              <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">No category yet</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{guestsWithoutGroup}</p>
                <p className="mt-1 text-xs text-zinc-600">No group label</p>
              </div>
            </div>
          </section>
        ) : null}

        {totalFamilies > 0 ? (
          <section className="app-card p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">List hygiene</p>
            <p className="mt-1 text-sm text-zinc-600">
              Duplicate signals, missing contact, and families ready for a first invite.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  duplicateGuestsDetected > 0
                    ? "border-rose-200/80 bg-rose-50/50"
                    : "border-zinc-200/80 bg-zinc-50/50"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Possible duplicates</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    duplicateGuestsDetected > 0 ? "text-rose-950" : "text-zinc-400"
                  }`}
                >
                  {duplicateGuestsDetected}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  {duplicateGroupsCount} group{duplicateGroupsCount === 1 ? "" : "s"} (same name, phone, or email)
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-900/80">Missing contact</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-950">
                  {readinessOverview.missingContact}
                </p>
                <p className="mt-1 text-xs text-rose-900/75">No phone or email</p>
              </div>
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/90">Send-ready</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-950">
                  {readinessOverview.readyToSend}
                </p>
                <p className="mt-1 text-xs text-emerald-900/80">Phone &amp; email, not invited</p>
              </div>
            </div>
          </section>
        ) : null}

        {deadlineMeta?.status === "closing_soon" || deadlineMeta?.status === "closes_today" || deadlineMeta?.status === "closed" ? (
          <section
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
                  : `RSVP closes soon (${deadlineMeta.daysRemaining} day${
                      deadlineMeta.daysRemaining === 1 ? "" : "s"
                    } remaining).`}
            </p>
          </section>
        ) : null}

        <section id="dashboard-report" className="app-card scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900">Add one guest</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Optional: category (e.g. Bride side), table, contact, and notes.
          </p>
          <form action={createGuestAction} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="block text-sm font-medium text-zinc-700 sm:col-span-2">
              Guest / family name
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
              Custom greeting (optional)
              <input
                name="greetingCustom"
                type="text"
                className="input-luxe"
                placeholder="Override greeting if needed"
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
            <label className="block text-sm font-medium text-zinc-700">
              Phone
              <input name="phone" type="text" className="input-luxe" />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Email
              <input name="email" type="email" className="input-luxe" />
            </label>
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
              <span className="text-sm text-zinc-700">
                Family invite — use the family invite card when no size-specific card applies (configure under Edit
                event → Advanced invite card variants).
              </span>
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Add guest &amp; generate link
              </button>
            </div>
          </form>
        </section>

        <GuestCsvImport eventId={event.id} />

        <section id="dashboard-activity" className="app-card scroll-mt-24 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-zinc-900">Event activity</h2>
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{eventAuditActivity.length} items</span>
          </div>
          <form method="get" className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              name="activityQ"
              defaultValue={activityQ}
              placeholder="Search activity..."
              className="input-luxe mt-0"
            />
            <select name="activityAction" defaultValue={activityAction} className="input-luxe mt-0">
              {eventActivityActionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </form>
          {eventAuditActivity.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-6 text-sm text-zinc-600">
              No activity matched your filters yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {deadlineMeta?.status === "closing_soon" || deadlineMeta?.status === "closes_today" || deadlineMeta?.status === "closed" ? (
                <article className="rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
                  <p className="text-sm font-medium text-zinc-900">
                    {deadlineMeta.status === "closed"
                      ? "Reminder · RSVP closed today"
                      : deadlineMeta.status === "closes_today"
                        ? "Reminder · RSVP closes today"
                        : `Reminder · RSVP closes in ${deadlineMeta.daysRemaining} day${
                            deadlineMeta.daysRemaining === 1 ? "" : "s"
                          }`}
                  </p>
                </article>
              ) : null}
              {eventAuditActivity.map((activity) => (
                <article
                  key={activity.id}
                  className="rounded-2xl border border-[#e7dccb] bg-[#fffdfa] px-4 py-3"
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {activity.message}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    {activity.userName} · {formatActionLabel(activity.actionType)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(activity.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {totalFamilies > 0 ? (
          <section id="dashboard-communications" className="app-card scroll-mt-24 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Communications (logged)</p>
            <p className="mt-2 text-sm text-zinc-700">
              <span className="font-semibold tabular-nums text-zinc-900">{communicationStats.totalLogs}</span> actions
              logged ·{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{communicationStats.guestsWithLogs}</span>{" "}
              guests with history ·{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{communicationStats.weekLogs}</span> in the
              last 7 days ·{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{communicationStats.guestsWithNoLogs}</span>{" "}
              guests with no comm log yet
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Open any row&apos;s communication history for the full timeline (WhatsApp, email, manual marks,
              reminders).
            </p>
          </section>
        ) : null}

        <EventGuestsPanel
          eventId={event.id}
          eventTitle={event.title}
          eventCoupleNames={event.coupleNames}
          inviteMessageIntro={event.inviteMessageIntro}
          inviteMessageLineOverride={event.inviteMessageLineOverride}
          guests={guestsSerialized}
          siteUrl={getPublicSiteUrl()}
          inviteCardEvent={inviteCardEvent}
          communicationLastByGuest={communicationLastByGuest}
        />
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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="app-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

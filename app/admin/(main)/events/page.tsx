import Link from "next/link";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { SafeEventImage } from "@/components/safe-event-image";
import { CreatorRealtimeFilters, SuperAdminOwnerFilter } from "@/components/admin/admin-events-filters";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdminEventsPageProps = {
  searchParams?: Promise<{ deleted?: string; owner?: string; q?: string; status?: string; error?: string }>;
};

export default async function AdminEventsPage({ searchParams }: AdminEventsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const showDeletedNotice = params?.deleted === "1";
  const showForbiddenNotice = params?.error === "forbidden";
  const ownerFilter = params?.owner?.trim() || "all";
  const liveQuery = params?.q?.trim().toLowerCase() || "";
  const creatorStatusFilter = ["all", "open", "closing_soon", "closes_today", "closed"].includes(
    params?.status ?? "",
  )
    ? (params?.status as "all" | "open" | "closing_soon" | "closes_today" | "closed")
    : "all";
  const admin = await requireCurrentAdminUser();
  const currentAdminName = admin.name;
  const isSuper = isSuperAdmin(admin);
  let creatorFilterNames: string[] = [];
  let totalCreatorsStat = 0;
  if (isSuper) {
    const [nameRows, creatorCount] = await Promise.all([
      prisma.user.findMany({
        where: { active: true, deletedAt: null },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.user.count({ where: { active: true, deletedAt: null, role: "event_creator" } }),
    ]);
    creatorFilterNames = nameRows.map((row) => row.name);
    totalCreatorsStat = creatorCount;
  }
  const events: Array<{
    ownerUserId: string | null;
    owner: { name: string } | null;
    id: string;
    title: string | null;
    theme: string | null;
    slug: string | null;
    coupleNames: string | null;
    imagePath: string | null;
    eventDate: Date | null;
    rsvpDeadline: Date | null;
    eventTime: string | null;
    venue: string | null;
    _count: { guests: number };
    guests: Array<{
      attending: boolean | null;
      attendingCount: number | null;
      maxGuests: number;
      respondedAt: Date | null;
      invitedAt: Date | null;
    }>;
  }> = [];
  let loadError: null | { message: string; stack?: string } = null;
  let recentActivity: Array<{
    id: string;
    message: string;
    createdAt: Date;
    userName: string;
    actionType: string;
  }> = [];
  let creatorRecentActivity: Array<{
    id: string;
    message: string;
    createdAt: Date;
    userName: string;
    actionType: string;
  }> = [];

  try {
    console.info("[admin/events] loading events");
    const results = await prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(isSuper ? {} : { ownerUserId: admin.id }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true } },
        _count: { select: { guests: { where: { deletedAt: null } } } },
        guests: {
          where: { deletedAt: null },
          select: {
            attending: true,
            attendingCount: true,
            maxGuests: true,
            respondedAt: true,
            invitedAt: true,
          },
        },
      },
    });
    if (Array.isArray(results)) events.push(...results);
    if (isSuper) {
      recentActivity = await prisma.auditActivity.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      });
    } else if (results.length > 0) {
      creatorRecentActivity = await prisma.auditActivity.findMany({
        where: { eventId: { in: results.map((event) => event.id) } },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
    }
    console.info("[admin/events] events loaded", { eventCount: events.length });
    if (events.length > 0) {
      const first = events[0];
      console.info("[admin/events] first event shape", {
        id: first?.id ?? null,
        titleType: typeof first?.title,
        slugType: typeof first?.slug,
        coupleNamesType: typeof first?.coupleNames,
        imagePathType: typeof first?.imagePath,
        eventDateType: first?.eventDate instanceof Date ? "date" : typeof first?.eventDate,
        venueType: typeof first?.venue,
        guestsIsArray: Array.isArray(first?.guests),
        guestsCount: Array.isArray(first?.guests) ? first.guests.length : null,
        firstGuestKeys:
          Array.isArray(first?.guests) && first.guests.length > 0
            ? Object.keys(first.guests[0] ?? {})
            : [],
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    loadError = { message, stack };
    console.error("[admin/events] failed to load events", {
      message,
      stack,
      code: errorCode,
      name: error instanceof Error ? error.name : "UnknownError",
      error,
    });
  }

  const ownerLabelOf = (event: (typeof events)[number]) => {
    const eventAny = event as unknown as { owner?: { name?: string | null }; ownerName?: string | null };
    return eventAny.owner?.name || eventAny.ownerName || "Unassigned";
  };
  const visibleEventsRaw =
    isSuper && ownerFilter !== "all"
      ? events.filter((event) => ownerLabelOf(event) === ownerFilter)
      : events;
  const visibleEvents = visibleEventsRaw.filter((event) => {
    if (!liveQuery) return true;
    const title = event.title?.toLowerCase() ?? "";
    const couple = event.coupleNames?.toLowerCase() ?? "";
    const slug = event.slug?.toLowerCase() ?? "";
    const owner = ownerLabelOf(event).toLowerCase();
    return (
      title.includes(liveQuery) ||
      couple.includes(liveQuery) ||
      slug.includes(liveQuery) ||
      owner.includes(liveQuery)
    );
  });
  const creatorFilteredEvents = !isSuper
    ? visibleEvents.filter((event) => {
        const safeTitle = event.title?.toLowerCase() ?? "";
        const safeCouple = event.coupleNames?.toLowerCase() ?? "";
        const matchesQuery = liveQuery
          ? safeTitle.includes(liveQuery) || safeCouple.includes(liveQuery)
          : true;
        const status = getRsvpDeadlineMeta(event.rsvpDeadline)?.status ?? "open";
        const matchesStatus = creatorStatusFilter === "all" ? true : status === creatorStatusFilter;
        return matchesQuery && matchesStatus;
      })
    : visibleEvents;
  const renderedEvents = isSuper ? visibleEvents : creatorFilteredEvents;
  const totalEventsInScope = events.length;
  const isTrueEmptyList = totalEventsInScope === 0;
  const isFilteredEmptyList = totalEventsInScope > 0 && renderedEvents.length === 0;
  const hasActiveCreatorFilters = Boolean(liveQuery) || creatorStatusFilter !== "all";
  const hasActiveSuperOwnerFilter = isSuper && ownerFilter !== "all";
  const invitedFamilies = visibleEvents.reduce(
    (sum, event) => sum + (Array.isArray(event.guests) ? event.guests.filter((g) => Boolean(g.invitedAt)).length : 0),
    0,
  );
  const respondedFamilies = visibleEvents.reduce(
    (sum, event) => sum + (Array.isArray(event.guests) ? event.guests.filter((g) => Boolean(g.respondedAt)).length : 0),
    0,
  );
  const confirmedAttendees = visibleEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.reduce((s, g) => s + (g.attendingCount ?? 0), 0) : 0),
    0,
  );
  const totalMaxInvitedAll = visibleEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.reduce((s, g) => s + (g.maxGuests ?? 0), 0) : 0),
    0,
  );
  const pendingResponses = visibleEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.filter((g) => !g.respondedAt).length : 0),
    0,
  );
  const responseRate = invitedFamilies > 0 ? respondedFamilies / invitedFamilies : 0;
  const attendanceRate = totalMaxInvitedAll > 0 ? confirmedAttendees / totalMaxInvitedAll : 0;
  const closingSoonCount = visibleEvents.filter((event) => {
    const meta = getRsvpDeadlineMeta(event.rsvpDeadline);
    return meta?.status === "closing_soon" || meta?.status === "closes_today";
  }).length;
  const noResponsesCount = visibleEvents.filter(
    (event) =>
      (Array.isArray(event.guests) ? event.guests.filter((g) => Boolean(g.respondedAt)).length : 0) === 0,
  ).length;
  const missingCardCount = visibleEvents.filter((event) => !getSafeImageSrc(event.imagePath)).length;
  const creatorInvitedFamilies = creatorFilteredEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.filter((g) => Boolean(g.invitedAt)).length : 0),
    0,
  );
  const creatorConfirmed = creatorFilteredEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.reduce((s, g) => s + (g.attendingCount ?? 0), 0) : 0),
    0,
  );
  const creatorPending = creatorFilteredEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.filter((g) => !g.respondedAt).length : 0),
    0,
  );

  const activityItems = isSuper ? recentActivity : creatorRecentActivity;

  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-6">

        {/* ── Alert: forbidden ── */}
        {showForbiddenNotice ? (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            You don&apos;t have access to that page.
          </div>
        ) : null}

        {/* ── 1. Header ── */}
        <div className="app-card overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#b28944]/40 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-5 p-6 sm:p-8">
            <div>
              <p className="section-title">Wedding Operations</p>
              <h1 className="headline-display mt-2">Events overview</h1>
              {isSuper ? (
                <>
                  <p className="mt-3 text-[1.05rem] font-semibold text-zinc-900">
                    Welcome back, {currentAdminName}
                  </p>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500">
                    Full access to all events, creators, and RSVP activity.
                  </p>
                </>
              ) : (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                  Welcome back, {currentAdminName}. Manage your events and track RSVP responses.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSuper ? (
                <span className="rounded-xl border border-[#e2d4bf] bg-[#f9f3e8] px-3 py-1.5 text-xs font-medium text-[#6a5434]">
                  Full-control mode
                </span>
              ) : null}
              <Link href="/admin/events/deleted" className="btn-secondary">
                Deleted events
              </Link>
              <Link href="/admin/events/new" className="btn-primary">
                + New event
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2. Filters bar ── */}
        {!isTrueEmptyList ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              {renderedEvents.length === 0
                ? "No matching events"
                : `${renderedEvents.length} event${renderedEvents.length === 1 ? "" : "s"}`}
              {liveQuery ? (
                <span className="ml-1 text-zinc-400">&thinsp;· matching &ldquo;{liveQuery}&rdquo;</span>
              ) : null}
            </p>
            <div>
              {isSuper ? (
                <SuperAdminOwnerFilter owner={ownerFilter} q={liveQuery} ownerOptions={creatorFilterNames} />
              ) : (
                <CreatorRealtimeFilters q={liveQuery} status={creatorStatusFilter} />
              )}
            </div>
          </div>
        ) : null}

        {/* ── Alert: deleted ── */}
        {showDeletedNotice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Event deleted successfully.
          </div>
        ) : null}

        {/* ── 3. Events list — PRIMARY FOCUS ── */}
        {loadError ? (
          <div className="app-card border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
            <h2 className="text-lg font-semibold">Could not load events</h2>
            <p className="mt-2 text-sm">
              The admin page is reachable, but fetching event data failed. Check server logs for details.
            </p>
            <Link href="/admin/events" className="btn-secondary mt-4 border-red-300 text-red-900">
              Retry loading events
            </Link>
          </div>
        ) : isFilteredEmptyList ? (
          <div className="app-card p-8 text-center sm:p-12">
            <p className="section-title">No matches</p>
            <h2 className="headline-display mt-3 text-2xl sm:text-3xl">No events matched your search</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              {hasActiveSuperOwnerFilter ? (
                <>
                  No events are owned by{" "}
                  <span className="font-semibold text-zinc-800">{ownerFilter}</span>. Try another owner or view all
                  events.
                </>
              ) : hasActiveCreatorFilters ? (
                <>
                  None of your events match the current search or status filter. Clear filters to see all events.
                </>
              ) : (
                <>We couldn&apos;t find any events matching your criteria. Try widening your search.</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/admin/events" className="btn-primary">
                Clear filters
              </Link>
              <Link href="/admin/events/new" className="btn-secondary">
                Create new event
              </Link>
            </div>
          </div>
        ) : isTrueEmptyList ? (
          <div className="app-card p-8 text-center sm:p-12">
            <p className="section-title">No events yet</p>
            <h2 className="headline-display mt-3 text-2xl sm:text-3xl">
              {isSuper ? "Start your first celebration" : "You haven't created any events yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              {isSuper
                ? "Create your first event to generate private guest links, track responses, and keep all RSVP activity organized."
                : "Create your first event to start inviting guests and tracking RSVP responses."}
            </p>
            <div className="mt-6">
              <Link href="/admin/events/new" className="btn-primary">
                Create your first event
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {renderedEvents.map((event) => {
              const guests = Array.isArray(event.guests) ? event.guests : [];
              const safeTitle =
                typeof event.title === "string" && event.title.trim()
                  ? event.title.trim()
                  : "Untitled event";
              const coupleNames =
                typeof event.coupleNames === "string" && event.coupleNames.trim()
                  ? event.coupleNames.trim()
                  : null;
              const deadlineMeta = getRsvpDeadlineMeta(event.rsvpDeadline);
              const safeImageSrc = getSafeImageSrc(event.imagePath);
              if (event.imagePath) {
                console.info("[event-image] admin list render src", {
                  eventId: event.id,
                  rawImagePath: event.imagePath,
                  safeImageSrc,
                });
              }
              const deadlineLabel = deadlineMeta
                ? deadlineMeta.status === "closed"
                  ? "Closed"
                  : deadlineMeta.status === "closes_today"
                    ? "Closes Today"
                    : deadlineMeta.status === "closing_soon"
                      ? "Closing Soon"
                      : "Open"
                : null;
              const deadlineClass =
                deadlineMeta?.status === "closed"
                  ? "badge-neutral"
                  : deadlineMeta?.status === "closes_today"
                    ? "badge-danger"
                    : deadlineMeta?.status === "closing_soon"
                      ? "badge-warning"
                      : "badge-success";

              let responded = 0;
              let attendingFamilies = 0;
              let declinedFamilies = 0;
              let confirmedAttendees = 0;
              let pendingFamilies = 0;

              try {
                responded = guests.filter((g) => Boolean(g.respondedAt)).length;
                attendingFamilies = guests.filter((g) => g.attending === true).length;
                declinedFamilies = guests.filter((g) => g.attending === false).length;
                confirmedAttendees = guests.reduce(
                  (sum, g) =>
                    sum +
                    (typeof g.attendingCount === "number" && Number.isFinite(g.attendingCount)
                      ? g.attendingCount
                      : 0),
                  0,
                );
                pendingFamilies = Math.max(0, guests.length - responded);
                console.info("[admin/events] event stats generated", {
                  eventId: event.id,
                  guests: guests.length,
                  responded,
                  attendingFamilies,
                  declinedFamilies,
                  confirmedAttendees,
                  pendingFamilies,
                });
              } catch (e) {
                console.error("[admin/events] failed generating event stats", { eventId: event.id, error: e });
              }

              const rsvpRate = guests.length > 0 ? responded / guests.length : 0;

              return (
                <article
                  key={event.id ?? safeTitle}
                  className="app-card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-38px_rgba(71,52,29,0.48)]"
                >
                  {/* Image thumbnail */}
                  {safeImageSrc ? (
                    <div className="relative h-28 overflow-hidden border-b border-[#e7dccb] bg-[#f7f2e9]">
                      <SafeEventImage
                        src={safeImageSrc}
                        alt={safeTitle}
                        fill
                        sizes="(max-width: 1024px) 92vw, 30rem"
                        className="object-contain object-center"
                        fallbackLabel="Invitation image unavailable"
                      />
                    </div>
                  ) : null}

                  <div className="p-5 sm:p-6">
                    {/* Top row: badges + owner */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="badge-soft">
                          {event._count?.guests ?? guests.length}{" "}
                          {(event._count?.guests ?? guests.length) === 1 ? "family" : "families"}
                        </span>
                        {deadlineLabel ? (
                          <span className={deadlineClass}>{deadlineLabel}</span>
                        ) : null}
                      </div>
                      {isSuper ? (
                        <span className="text-xs text-zinc-400">{ownerLabelOf(event)}</span>
                      ) : null}
                    </div>

                    {/* Title */}
                    <div className="mt-3">
                      <h2 className="text-xl font-semibold leading-tight text-zinc-900">
                        {coupleNames ?? safeTitle}
                      </h2>
                      {coupleNames ? (
                        <p className="mt-0.5 text-sm text-zinc-500">{safeTitle}</p>
                      ) : null}
                    </div>

                    {/* Date + venue */}
                    {event.eventDate || event.venue ? (
                      <div className="mt-3 space-y-1.5 text-sm text-zinc-600">
                        {event.eventDate ? (
                          <div className="flex items-center gap-2">
                            <EventCalIcon />
                            <span>
                              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.eventDate)}
                              {event.eventTime ? ` · ${event.eventTime}` : null}
                            </span>
                          </div>
                        ) : null}
                        {event.venue ? (
                          <div className="flex items-center gap-2">
                            <EventLocIcon />
                            <span className="line-clamp-1">{event.venue}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-400">Date and venue not set yet.</p>
                    )}

                    {/* RSVP progress bar */}
                    {guests.length > 0 ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Response rate</span>
                          <span className="tabular-nums font-medium">
                            {responded}&thinsp;/&thinsp;{guests.length}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ece5d6]">
                          <div
                            className="h-full rounded-full bg-[#b28944]"
                            style={{ width: `${Math.round(rsvpRate * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Mini stats row */}
                    <div className="mt-4 grid grid-cols-3 divide-x divide-[#ece5d6] overflow-hidden rounded-2xl border border-[#ece5d6] bg-[#fdf9f4]">
                      <EventMiniStat label="Confirmed" value={confirmedAttendees} />
                      <EventMiniStat label="Attending" value={attendingFamilies} />
                      <EventMiniStat label="Pending" value={pendingFamilies} highlight={pendingFamilies > 0} />
                    </div>

                    {/* Deadline line */}
                    {event.rsvpDeadline ? (
                      <p className="mt-3 text-xs text-zinc-400">
                        RSVP deadline{" "}
                        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.rsvpDeadline)}
                        {deadlineMeta?.status === "closing_soon" && deadlineMeta.daysRemaining > 0
                          ? ` · ${deadlineMeta.daysRemaining} day${deadlineMeta.daysRemaining === 1 ? "" : "s"} left`
                          : ""}
                      </p>
                    ) : null}
                  </div>

                  {/* Actions footer */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#e7dccb] bg-[#fdf9f4] px-5 py-3.5 sm:px-6">
                    <Link
                      href={`/admin/events/${event.id ?? ""}`}
                      className="btn-primary shrink-0 text-sm"
                    >
                      Open dashboard
                    </Link>
                    <Link
                      href={`/admin/events/${event.id ?? ""}/edit`}
                      className="btn-secondary shrink-0 text-sm"
                    >
                      Edit
                    </Link>
                    <DeleteEventButton
                      eventId={event.id}
                      label="Delete"
                      className="btn-secondary ml-auto shrink-0 border-rose-200 bg-rose-50 text-sm text-rose-800 hover:bg-rose-100"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── 4. Stats — collapsed by default ── */}
        {!isTrueEmptyList ? (
          <CollapsibleSection
            id="overview-stats"
            title="Overview stats"
            storageKey="overview:stats"
            defaultOpen={false}
            className="scroll-mt-20"
          >
            <div className="space-y-3">
              {isSuper ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <OverviewStat label="Total events" value={visibleEvents.length} />
                  <OverviewStat label="Creators" value={totalCreatorsStat} />
                  <OverviewStat label="Invited families" value={invitedFamilies} />
                  <OverviewStat label="Confirmed" value={confirmedAttendees} />
                  <OverviewStat label="Pending" value={pendingResponses} />
                  <OverviewStat label="Closing soon" value={closingSoonCount} />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <OverviewStat label="My events" value={creatorFilteredEvents.length} />
                  <OverviewStat label="Invited families" value={creatorInvitedFamilies} />
                  <OverviewStat label="Confirmed" value={creatorConfirmed} />
                  <OverviewStat label="Pending" value={creatorPending} />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OverviewStat label="Response rate" value={`${Math.round(responseRate * 100)}%`} />
                <OverviewStat label="Attendance rate" value={`${Math.round(attendanceRate * 100)}%`} />
                <OverviewStat label="Responded" value={respondedFamilies} />
                <OverviewStat label="Max invited" value={totalMaxInvitedAll} />
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── 5. Needs attention — collapsed by default ── */}
        {!isTrueEmptyList ? (
          <CollapsibleSection
            id="overview-attention"
            title="Needs attention"
            storageKey="overview:attention"
            defaultOpen={false}
            className="scroll-mt-20"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <AttentionCard
                count={closingSoonCount}
                label={closingSoonCount === 1 ? "event closing soon" : "events closing soon"}
                status={closingSoonCount > 0 ? "warning" : "ok"}
              />
              <AttentionCard
                count={noResponsesCount}
                label={noResponsesCount === 1 ? "event with no responses" : "events with no responses"}
                status={noResponsesCount > 0 ? "neutral" : "ok"}
              />
              <AttentionCard
                count={missingCardCount}
                label={missingCardCount === 1 ? "event missing invite card" : "events missing invite card"}
                status={missingCardCount > 0 ? "neutral" : "ok"}
              />
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ── 6. Recent activity — collapsed by default ── */}
        {!isTrueEmptyList ? (
          <CollapsibleSection
            id="overview-activity"
            title="Recent activity"
            storageKey="overview:activity"
            defaultOpen={false}
            className="scroll-mt-20"
          >
            {activityItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-6 text-center text-sm text-zinc-500">
                No recent activity on your events yet.
              </p>
            ) : (
              <div className="divide-y divide-[#ece5d6] overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa]">
                {activityItems.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e7dccb] bg-[#fbf8f2]">
                      <svg viewBox="0 0 8 8" fill="currentColor" className="h-1.5 w-1.5 text-[#b28944]" aria-hidden>
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-zinc-800">{activity.message}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {activity.userName} · {formatActionLabel(activity.actionType)} ·{" "}
                        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                          activity.createdAt,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        ) : null}

      </div>
    </main>
  );
}

function OverviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="app-card-muted px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function EventMiniStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <p className={`text-base font-semibold tabular-nums ${highlight ? "text-amber-700" : "text-zinc-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
    </div>
  );
}

function AttentionCard({
  count,
  label,
  status,
}: {
  count: number;
  label: string;
  status: "warning" | "neutral" | "ok";
}) {
  const styles = {
    warning: { wrap: "border-amber-200 bg-amber-50/70", count: "text-amber-800", text: "text-amber-700" },
    neutral: { wrap: "border-zinc-200 bg-zinc-50", count: "text-zinc-700", text: "text-zinc-500" },
    ok: { wrap: "border-emerald-200 bg-emerald-50/70", count: "text-emerald-800", text: "text-emerald-700" },
  }[status];
  return (
    <div className={`rounded-2xl border ${styles.wrap} p-4`}>
      <p className={`text-3xl font-semibold tabular-nums ${styles.count}`}>{count}</p>
      <p className={`mt-1.5 text-sm ${styles.text}`}>{label}</p>
    </div>
  );
}

function EventCalIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden>
      <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.5h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function EventLocIcon() {
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

function formatActionLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

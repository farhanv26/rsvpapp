import Link from "next/link";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { SafeEventImage } from "@/components/safe-event-image";
import { CreatorRealtimeFilters, SuperAdminOwnerFilter } from "@/components/admin/admin-events-filters";
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
        where: { active: true },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.user.count({ where: { active: true, role: "event_creator" } }),
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
    }>;
  }> = [];
  let loadError: null | {
    message: string;
    stack?: string;
  } = null;
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
      where: isSuper ? undefined : { ownerUserId: admin.id },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true } },
        _count: { select: { guests: true } },
        guests: {
          select: {
            attending: true,
            attendingCount: true,
            maxGuests: true,
            respondedAt: true,
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
        where: {
          eventId: {
            in: results.map((event) => event.id),
          },
        },
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
  const invitedFamilies = visibleEvents.reduce((sum, event) => sum + (event._count?.guests ?? 0), 0);
  const respondedFamilies = visibleEvents.reduce(
    (sum, event) => sum + (Array.isArray(event.guests) ? event.guests.filter((guest) => Boolean(guest.respondedAt)).length : 0),
    0,
  );
  const confirmedAttendees = visibleEvents.reduce(
    (sum, event) =>
      sum +
      (Array.isArray(event.guests)
        ? event.guests.reduce((guestSum, guest) => guestSum + (guest.attendingCount ?? 0), 0)
        : 0),
    0,
  );
  const totalMaxInvitedAll = visibleEvents.reduce(
    (sum, event) =>
      sum +
      (Array.isArray(event.guests)
        ? event.guests.reduce((guestSum, guest) => guestSum + (guest.maxGuests ?? 0), 0)
        : 0),
    0,
  );
  const pendingResponses = visibleEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.filter((guest) => !guest.respondedAt).length : 0),
    0,
  );
  const responseRate = invitedFamilies > 0 ? respondedFamilies / invitedFamilies : 0;
  const attendanceRate = totalMaxInvitedAll > 0 ? confirmedAttendees / totalMaxInvitedAll : 0;
  const closingSoonCount = visibleEvents.filter((event) => {
    const meta = getRsvpDeadlineMeta(event.rsvpDeadline);
    return meta?.status === "closing_soon" || meta?.status === "closes_today";
  }).length;
  const noResponsesCount = visibleEvents.filter((event) =>
    (Array.isArray(event.guests) ? event.guests.filter((guest) => Boolean(guest.respondedAt)).length : 0) === 0,
  ).length;
  const missingCardCount = visibleEvents.filter((event) => !getSafeImageSrc(event.imagePath)).length;
  const creatorInvitedFamilies = creatorFilteredEvents.reduce((sum, event) => sum + (event._count?.guests ?? 0), 0);
  const creatorConfirmed = creatorFilteredEvents.reduce(
    (sum, event) =>
      sum +
      (Array.isArray(event.guests)
        ? event.guests.reduce((guestSum, guest) => guestSum + (guest.attendingCount ?? 0), 0)
        : 0),
    0,
  );
  const creatorPending = creatorFilteredEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.filter((guest) => !guest.respondedAt).length : 0),
    0,
  );

  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-8">
        {showForbiddenNotice ? (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            You don&apos;t have access to that page.
          </div>
        ) : null}
        <div className="app-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="section-title">Wedding Operations</p>
              <h1 className="headline-display mt-2">Events overview</h1>
              {isSuper ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-zinc-900">Welcome back, {currentAdminName}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                    You have full access to all events, creators, and RSVP activity.
                  </p>
                </>
              ) : (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                  Welcome back, {currentAdminName}. Manage your events, guest lists, and RSVP updates.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSuper ? (
                <div className="rounded-2xl border border-[#e2d4bf] bg-[#f9f3e8] px-3 py-2 text-xs text-zinc-700">
                  Full-control mode
                </div>
              ) : null}
              <Link href="/admin/events/new" className="btn-primary">
                Create new event
              </Link>
            </div>
          </div>
        </div>

        {isSuper ? (
          <div className="app-card-muted grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <OverviewStat label="Total events" value={visibleEvents.length} compact />
            <OverviewStat label="Total creators" value={totalCreatorsStat} compact />
            <OverviewStat label="Invited families" value={invitedFamilies} compact />
            <OverviewStat label="Confirmed attendees" value={confirmedAttendees} compact />
            <OverviewStat label="Pending responses" value={pendingResponses} compact />
            <OverviewStat label="Events closing soon" value={closingSoonCount} compact />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewStat label="My events" value={creatorFilteredEvents.length} />
            <OverviewStat label="Invited families" value={creatorInvitedFamilies} />
            <OverviewStat label="Confirmed attendees" value={creatorConfirmed} />
            <OverviewStat label="Pending responses" value={creatorPending} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStat label="Response rate" value={`${Math.round(responseRate * 100)}%`} />
          <OverviewStat label="Attendance rate" value={`${Math.round(attendanceRate * 100)}%`} />
          <OverviewStat label="Responded families" value={respondedFamilies} />
          <OverviewStat label="Max invited" value={totalMaxInvitedAll} />
        </div>

        {isSuper ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-title">Creator filter</p>
              <p className="mt-1 text-sm text-zinc-600">Filter all events by creator owner.</p>
            </div>
            <SuperAdminOwnerFilter owner={ownerFilter} q={liveQuery} ownerOptions={creatorFilterNames} />
          </div>
        ) : null}

        {!isSuper ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="section-title">My events</p>
                <p className="mt-1 text-sm text-zinc-600">Find and manage your events quickly.</p>
              </div>
              <CreatorRealtimeFilters q={liveQuery} status={creatorStatusFilter} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="app-card p-5">
                <p className="section-title">Needs attention</p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-900">Your priority items</h2>
                <div className="mt-4 space-y-2 text-sm text-zinc-700">
                  <p>
                    <span className="font-semibold">{closingSoonCount}</span> of your events are closing soon.
                  </p>
                  <p>
                    <span className="font-semibold">{noResponsesCount}</span> of your events still have no responses.
                  </p>
                  <p>
                    <span className="font-semibold">{missingCardCount}</span> of your events are missing invite cards.
                  </p>
                </div>
              </section>
              <section className="app-card p-5">
                <p className="section-title">Your recent activity</p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-900">Latest RSVP changes</h2>
                {creatorRecentActivity.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-600">No recent updates on your events yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {creatorRecentActivity.map((activity) => (
                      <article
                        key={activity.id}
                        className="rounded-2xl border border-[#e7dccb] bg-[#fffdfa] px-4 py-3"
                      >
                        <p className="text-sm text-zinc-800">{activity.message}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                          {activity.userName} · {formatActionLabel(activity.actionType)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                            activity.createdAt,
                          )}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}

        {isSuper ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="app-card p-5">
              <p className="section-title">Needs attention</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-900">Operational highlights</h2>
              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                <p>
                  <span className="font-semibold">{closingSoonCount}</span> events have RSVP deadlines closing soon.
                </p>
                <p>
                  <span className="font-semibold">{noResponsesCount}</span> events still have no responses.
                </p>
                <p>
                  <span className="font-semibold">{missingCardCount}</span> events are missing an invite card image.
                </p>
              </div>
            </section>
            <section className="app-card p-5">
              <p className="section-title">Recent activity</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-900">Across all events</h2>
              {recentActivity.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No recent updates yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentActivity.map((activity) => (
                    <article key={activity.id} className="rounded-2xl border border-[#e7dccb] bg-[#fffdfa] px-4 py-3">
                      <p className="text-sm text-zinc-800">
                        {activity.message}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                        {activity.userName} · {formatActionLabel(activity.actionType)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                          activity.createdAt,
                        )}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {showDeletedNotice ? (
          <div className="app-card border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Event deleted successfully.
          </div>
        ) : null}

        {loadError ? (
          <div className="app-card border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
            <h2 className="text-lg font-semibold">We could not load events</h2>
            <p className="mt-2 text-sm">
              The admin page is reachable, but fetching event data failed. Check server logs for
              details and try again.
            </p>
            <Link href="/admin/events" className="btn-secondary mt-4 border-red-300 text-red-900">
              Retry loading events
            </Link>
          </div>
        ) : isFilteredEmptyList ? (
          <div className="app-card p-8 text-center sm:p-12">
            <p className="section-title">No matches</p>
            <h2 className="headline-display mt-3 text-2xl sm:text-3xl">No events matched your criteria</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              {hasActiveSuperOwnerFilter ? (
                <>
                  You still have events in the workspace, but none are owned by{" "}
                  <span className="font-semibold text-zinc-800">{ownerFilter}</span>. Try another owner or view all
                  events.
                </>
              ) : hasActiveCreatorFilters ? (
                <>
                  You still have events on your account, but none match your current search or RSVP status filters.
                  Clear filters to see everything again.
                </>
              ) : (
                <>
                  We couldn&apos;t find any events matching your current filters. Try widening your criteria or reset
                  to the full list.
                </>
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
              {isSuper ? "Start your first celebration" : "You haven’t created any events yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base">
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
                typeof event.title === "string" && event.title.trim().length > 0
                  ? event.title.trim()
                  : "Untitled event";
              const safeSlug =
                typeof event.slug === "string" && event.slug.trim().length > 0
                  ? event.slug.trim()
                  : "no-slug";
              const coupleNames =
                typeof event.coupleNames === "string" && event.coupleNames.trim().length > 0
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

              let responded = 0;
              let attendingFamilies = 0;
              let declinedFamilies = 0;
              let confirmedAttendees = 0;
              let totalMaxInvited = 0;
              let pendingFamilies = 0;

              try {
                responded = guests.filter((guest) => Boolean(guest.respondedAt)).length;
                attendingFamilies = guests.filter((guest) => guest.attending === true).length;
                declinedFamilies = guests.filter((guest) => guest.attending === false).length;
                confirmedAttendees = guests.reduce(
                  (sum, guest) =>
                    sum +
                    (typeof guest.attendingCount === "number" &&
                    Number.isFinite(guest.attendingCount)
                      ? guest.attendingCount
                      : 0),
                  0,
                );
                totalMaxInvited = guests.reduce(
                  (sum, guest) =>
                    sum +
                    (typeof guest.maxGuests === "number" && Number.isFinite(guest.maxGuests)
                      ? guest.maxGuests
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
                  totalMaxInvited,
                });
              } catch (error) {
                console.error("[admin/events] failed generating event stats", {
                  eventId: event.id,
                  error,
                });
              }

              return (
                <article
                  key={event.id ?? `${safeSlug}-${safeTitle}`}
                  className="app-card p-6 transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-38px_rgba(71,52,29,0.48)] sm:p-7"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="section-title">Event</p>
                      <h2 className="mt-2 text-2xl font-semibold text-zinc-900">{coupleNames ?? safeTitle}</h2>
                      {coupleNames ? <p className="mt-1 text-sm text-zinc-600">{safeTitle}</p> : null}
                      {isSuper ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                          Owner: {ownerLabelOf(event)}
                        </p>
                      ) : null}
                      <p className="mt-2 font-mono text-xs text-zinc-500">{safeSlug}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="badge-soft">{event._count?.guests ?? guests.length} families</span>
                      {deadlineLabel ? (
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
                          {deadlineLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {(event.eventDate || event.eventTime || event.venue) ? (
                    <p className="mt-4 text-sm text-zinc-600">
                      {event.eventDate
                        ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.eventDate)
                        : null}
                      {event.eventDate && event.eventTime ? " · " : null}
                      {event.eventTime ?? null}
                      {(event.eventDate || event.eventTime) && event.venue ? " · " : null}
                      {event.venue ?? null}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-500">Date and venue details not set yet.</p>
                  )}
                  {safeImageSrc ? (
                    <div className="mt-4 rounded-2xl border border-[#e7dccb] bg-[#f7f2e9] p-3">
                      <div className="relative h-40 w-full overflow-hidden rounded-xl border border-[#e7dccb] bg-[#fffdfa]">
                        <SafeEventImage
                          src={safeImageSrc}
                          alt={safeTitle}
                          fill
                          sizes="(max-width: 1024px) 92vw, 30rem"
                          className="object-contain object-center"
                          fallbackLabel="Invitation image unavailable"
                        />
                      </div>
                    </div>
                  ) : null}
                  {event.rsvpDeadline ? (
                    <p className="mt-2 text-xs text-zinc-600">
                      RSVP deadline{" "}
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(event.rsvpDeadline)}
                      {deadlineMeta?.status === "closing_soon" && deadlineMeta.daysRemaining > 0
                        ? ` · ${deadlineMeta.daysRemaining} day${deadlineMeta.daysRemaining === 1 ? "" : "s"} left`
                        : ""}
                    </p>
                  ) : null}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <MiniStat label="Responded" value={responded} />
                    <MiniStat label="Pending" value={pendingFamilies} />
                    <MiniStat label="Confirmed" value={confirmedAttendees} />
                    <MiniStat label="Max Invited" value={totalMaxInvited} />
                  </div>

                  <p className="mt-4 text-sm text-zinc-600">
                    {responded === 0
                      ? "No RSVPs yet"
                      : `RSVP summary: ${attendingFamilies} attending · ${declinedFamilies} declined`}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link href={`/admin/events/${event.id ?? ""}`} className="btn-primary">
                      Open dashboard
                    </Link>
                    <Link href={`/admin/events/${event.id ?? ""}/edit`} className="btn-secondary">
                      Edit
                    </Link>
                    <DeleteEventButton
                      eventId={event.id}
                      label="Delete"
                      className="btn-secondary border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function OverviewStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className={`app-card ${compact ? "p-4" : "p-5"}`}>
      <p className="section-title">{label}</p>
      <p className={`mt-3 font-semibold text-zinc-900 tabular-nums ${compact ? "text-2xl" : "text-3xl"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="app-card-muted px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function formatActionLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

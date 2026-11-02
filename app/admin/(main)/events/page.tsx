import Link from "next/link";
import { Ellipsis, Plus } from "lucide-react";
import { CreatorRealtimeFilters, SuperAdminOwnerFilter } from "@/components/admin/admin-events-filters";
import { EmptyState, PageHeader, PlaceRegister, Stat, StatStrip } from "@/components/admin/planning-ui";
import { Menu, MenuItem } from "@/components/admin/ui/menu";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getRsvpDeadlineMeta } from "@/lib/utils";
import { resolveActiveWorkspace } from "@/lib/wedding-access";
import { summarizeEventAttendance } from "@/lib/attendance";
import { eventsInScopeWhere } from "@/lib/wedding-policy";

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
  const isSuper = isSuperAdmin(admin);
  const workspace = await resolveActiveWorkspace(admin);
  const scope = workspace.scope;
  const hasNoWorkspace = scope.kind === "none";
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
      id: string;
      sharedGuestKey: string | null;
      attending: boolean | null;
      attendingCount: number | null;
      maxGuests: number;
      respondedAt: Date | null;
      invitedAt: Date | null;
      menCount: number;
      womenCount: number;
      kidsCount: number;
      excludedGuestCount: number;
      excludedMenCount: number;
      excludedWomenCount: number;
      excludedKidsCount: number;
      excludeFromTotals: boolean;
      excludeReason: string | null;
    }>;
  }> = [];
  let loadError: null | { message: string; stack?: string } = null;

  try {
    const results = hasNoWorkspace ? [] : await prisma.event.findMany({
      where: {
        AND: [{ deletedAt: null }, eventsInScopeWhere(admin, scope)],
      },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true } },
        _count: { select: { guests: { where: { deletedAt: null } } } },
        guests: {
          where: { deletedAt: null },
          select: {
            id: true,
            sharedGuestKey: true,
            attending: true,
            attendingCount: true,
            maxGuests: true,
            respondedAt: true,
            invitedAt: true,
            menCount: true,
            womenCount: true,
            kidsCount: true,
            excludedGuestCount: true,
            excludedMenCount: true,
            excludedWomenCount: true,
            excludedKidsCount: true,
            excludeFromTotals: true,
            excludeReason: true,
          },
        },
      },
    });
    if (Array.isArray(results)) events.push(...results);
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
  const hasActiveSuperOwnerFilter = isSuper && ownerFilter !== "all";
  const invitedFamilies = visibleEvents.reduce(
    (sum, event) => sum + (Array.isArray(event.guests) ? event.guests.filter((g) => Boolean(g.invitedAt)).length : 0),
    0,
  );
  const confirmedAttendees = visibleEvents.reduce(
    (sum, event) =>
      sum + (Array.isArray(event.guests) ? event.guests.reduce((s, g) => s + (g.attendingCount ?? 0), 0) : 0),
    0,
  );
  const closingSoonCount = visibleEvents.filter((event) => {
    const meta = getRsvpDeadlineMeta(event.rsvpDeadline);
    return meta?.status === "closing_soon" || meta?.status === "closes_today";
  }).length;

  const newEventHref = hasNoWorkspace ? "/admin/weddings" : "/admin/events/new";
  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const byDate = [...renderedEvents].sort(
    (x, y) => (x.eventDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (y.eventDate?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );
  const rows = byDate.map((event) => {
    const guests = Array.isArray(event.guests) ? event.guests : [];
    const a = summarizeEventAttendance(guests);
    const meta = getRsvpDeadlineMeta(event.rsvpDeadline);
    const deadline = event.rsvpDeadline
      ? meta?.status === "closed"
        ? { text: `Replies closed ${shortFmt.format(event.rsvpDeadline)}`, short: `Closed ${shortFmt.format(event.rsvpDeadline)}`, tone: "muted" as const }
        : meta?.status === "closes_today"
          ? { text: "Replies close today", short: "Today", tone: "warn" as const }
          : meta?.status === "closing_soon"
            ? {
                text: `Replies close in ${meta.daysRemaining} ${meta.daysRemaining === 1 ? "day" : "days"}`,
                short: `In ${meta.daysRemaining} ${meta.daysRemaining === 1 ? "day" : "days"}`,
                tone: "warn" as const,
              }
            : { text: `Replies close ${shortFmt.format(event.rsvpDeadline)}`, short: shortFmt.format(event.rsvpDeadline), tone: "muted" as const }
      : null;
    return {
      event,
      a,
      title: event.title?.trim() || "Untitled event",
      when: [event.eventDate ? dateFmt.format(event.eventDate) : null, event.eventTime].filter(Boolean).join(" · "),
      deadline,
    };
  });

  return (
    <main className="app-shell">
      {showForbiddenNotice ? (
        <p className="notice-warning mb-4" role="status">
          You don&apos;t have access to that page.
        </p>
      ) : null}
      {showDeletedNotice ? (
        <p className="notice-success mb-4" role="status">
          Event deleted. You can restore it from Deleted events.
        </p>
      ) : null}

      <PageHeader
        title="Events"
        meta={
          isTrueEmptyList
            ? undefined
            : scope.kind === "all"
              ? `${totalEventsInScope} events across all weddings`
              : `${totalEventsInScope} ${totalEventsInScope === 1 ? "event" : "events"}`
        }
        actions={
          <>
            <Link href="/admin/events/deleted" className="btn-ghost text-[var(--muted-text)]">
              Deleted
            </Link>
            <Link href={newEventHref} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              New event
            </Link>
          </>
        }
      />

      {isSuper && scope.kind === "all" && !isTrueEmptyList ? (
        <div className="mb-5">
          <StatStrip columns={5}>
            <Stat label="events" value={visibleEvents.length} />
            <Stat label="creators" value={totalCreatorsStat} />
            <Stat label="households invited" value={invitedFamilies} />
            <Stat label="people confirmed" value={confirmedAttendees} />
            <Stat label="closing soon" value={closingSoonCount} />
          </StatStrip>
        </div>
      ) : null}

      {!isTrueEmptyList ? (
        <div className="mb-3">
          {isSuper ? (
            <SuperAdminOwnerFilter owner={ownerFilter} q={liveQuery} ownerOptions={creatorFilterNames} />
          ) : (
            <CreatorRealtimeFilters q={liveQuery} status={creatorStatusFilter} />
          )}
        </div>
      ) : null}

      {loadError ? (
        <EmptyState
          title="Events couldn't be loaded"
          action={
            <Link href="/admin/events" className="btn-secondary">
              Try again
            </Link>
          }
        >
          Something went wrong fetching events. The details are in the server log.
        </EmptyState>
      ) : hasNoWorkspace ? (
        <EmptyState
          title="Create your wedding first"
          action={
            <Link href="/admin/weddings" className="btn-primary">
              Create a wedding
            </Link>
          }
        >
          A wedding holds all of its events. You can invite your partner to plan with you.
        </EmptyState>
      ) : isTrueEmptyList ? (
        <EmptyState
          title="No events yet"
          action={
            <Link href="/admin/events/new" className="btn-primary">
              Add your first event
            </Link>
          }
        >
          Add each function separately, for example the Mehndi, Nikkah and reception.
        </EmptyState>
      ) : isFilteredEmptyList ? (
        <EmptyState
          title={hasActiveSuperOwnerFilter ? `No events owned by ${ownerFilter}` : "No events match"}
          action={
            <Link href="/admin/events" className="btn-secondary">
              Clear filters
            </Link>
          }
        />
      ) : (
        <>
          <ul className="list-rows md:hidden" aria-label="Events">
            {rows.map(({ event, a, title, when, deadline }) => (
              <li key={event.id}>
                <Link href={`/admin/events/${event.id}`} className="block px-4 py-3">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-[var(--muted-text)]">{[when, event.venue].filter(Boolean).join(" · ") || "Date and venue not set"}</p>
                  <p className="mt-1 text-sm">
                    {a.households === 0 ? (
                      <span className="text-[var(--muted-text)]">No guests yet</span>
                    ) : (
                      <>
                        {a.confirmedPeople} of {a.invitedPeople} coming · {a.respondedHouseholds} of {a.countedHouseholds} replied
                      </>
                    )}
                  </p>
                  {deadline || isSuper ? (
                    <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                      {[isSuper ? ownerLabelOf(event) : null, deadline?.text].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="app-card hidden overflow-x-auto md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="text-right">
                    Replied
                  </th>
                  <th scope="col" className="w-48">
                    Coming
                  </th>
                  <th scope="col">Replies close</th>
                  <th scope="col" className="w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ event, a, title, when, deadline }) => (
                  <tr key={event.id}>
                    <td className="max-w-[18rem]">
                      <Link href={`/admin/events/${event.id}`} className="font-medium hover:underline">
                        {title}
                      </Link>
                      <p className="text-xs text-[var(--muted-text)]">
                        {[isSuper ? ownerLabelOf(event) : null, event.venue].filter(Boolean).join(" · ") || "Venue not set"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">{when || <span className="text-[var(--muted-text)]">Not set</span>}</td>
                    <td className="text-right tabular-nums">{a.households === 0 ? "—" : `${a.respondedHouseholds} of ${a.countedHouseholds}`}</td>
                    <td className="tabular-nums">
                      {a.households === 0 ? (
                        "—"
                      ) : (
                        <>
                          <span className="font-semibold">{a.confirmedPeople}</span> of {a.invitedPeople}
                          {a.invitedPeople > 0 ? (
                            <div className="mt-1.5 w-40">
                              <PlaceRegister
                                total={a.invitedPeople}
                                segments={[{ places: a.confirmedPeople, tone: "ink", label: "Coming" }]}
                                label={`${a.confirmedPeople} of ${a.invitedPeople} coming`}
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      {deadline ? (
                        <span className={`status ${deadline.tone === "warn" ? "status-warning" : "status-muted"}`}>{deadline.short}</span>
                      ) : (
                        <span className="text-[var(--muted-text)]">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Menu label={`Actions for ${title}`} trigger={<Ellipsis className="h-4 w-4" aria-hidden />}>
                        <MenuItem href={`/admin/events/${event.id}`}>Open</MenuItem>
                        <MenuItem href={`/admin/events/${event.id}/edit`}>Edit event</MenuItem>
                        <MenuItem href={`/admin/events/${event.id}?tab=settings`}>Settings and delete</MenuItem>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}


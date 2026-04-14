import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events: Array<{
    id: string;
    title: string | null;
    slug: string | null;
    coupleNames: string | null;
    imagePath: string | null;
    eventDate: Date | null;
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

  try {
    console.info("[admin/events] loading events");
    const results = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
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

  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-8">
        <div className="app-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="section-title">Wedding Operations</p>
              <h1 className="headline-display mt-2">Events overview</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                Manage every celebration in one place, track RSVP progress, and move quickly from
                planning to guest confirmations.
              </p>
            </div>
            <Link href="/admin/events/new" className="btn-primary">
              Create new event
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStat label="Total events" value={events.length} />
          <OverviewStat
            label="Invited families"
            value={events.reduce((sum, event) => sum + (event._count?.guests ?? 0), 0)}
          />
          <OverviewStat
            label="Confirmed attendees"
            value={events.reduce(
              (sum, event) =>
                sum +
                (Array.isArray(event.guests)
                  ? event.guests.reduce((guestSum, guest) => guestSum + (guest.attendingCount ?? 0), 0)
                  : 0),
              0,
            )}
          />
          <OverviewStat
            label="Pending invites"
            value={events.reduce(
              (sum, event) =>
                sum +
                (Array.isArray(event.guests)
                  ? event.guests.filter((guest) => !guest.respondedAt).length
                  : 0),
              0,
            )}
          />
        </div>

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
        ) : events.length === 0 ? (
          <div className="app-card p-8 text-center sm:p-12">
            <p className="section-title">No events yet</p>
            <h2 className="headline-display mt-3 text-2xl sm:text-3xl">Start your first celebration</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Create your first event to generate private guest links, track responses, and keep
              all RSVP activity organized.
            </p>
            <div className="mt-6">
              <Link href="/admin/events/new" className="btn-primary">
                Create your first event
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {events.map((event) => {
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
                      <p className="mt-2 font-mono text-xs text-zinc-500">{safeSlug}</p>
                    </div>
                    <span className="badge-soft shrink-0">
                      {event._count?.guests ?? guests.length} families
                    </span>
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

function OverviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="app-card p-5">
      <p className="section-title">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-zinc-900 tabular-nums">{value}</p>
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

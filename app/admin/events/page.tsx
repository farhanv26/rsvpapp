import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events: Array<{
    id: string;
    title: string;
    slug: string;
    coupleNames: string | null;
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
    if (Array.isArray(results)) {
      events.push(...results);
    } else {
      console.error("[admin/events] unexpected non-array result from prisma.event.findMany", {
        resultType: typeof results,
      });
      loadError = {
        message: "Unexpected query result type from database",
      };
    }

    console.info("[admin/events] events loaded", { eventCount: events.length });
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
      error,
    });
  }

  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Wedding RSVP</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-3xl">Events</h1>
          </div>
          <Link
            href="/admin/events/new"
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            New Event
          </Link>
        </div>

        {loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
            <h2 className="text-lg font-semibold">We could not load events</h2>
            <p className="mt-2 text-sm">
              The admin page is reachable, but fetching event data failed. Check server logs for
              details and try again.
            </p>
            <p className="mt-2 text-xs font-mono text-red-700">{loadError.message}</p>
            <Link
              href="/admin/events"
              className="mt-4 inline-flex rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900"
            >
              Retry loading events
            </Link>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-amber-900/10">
            <h2 className="text-lg font-semibold text-zinc-900">No events yet</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Create your first event to begin sending RSVP links.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {events.map((event) => {
              const guests = Array.isArray(event.guests) ? event.guests : [];

              let responded = 0;
              let attendingFamilies = 0;
              let declinedFamilies = 0;
              let confirmedAttendees = 0;
              let totalMaxInvited = 0;

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

              const coupleNames =
                typeof event.coupleNames === "string" && event.coupleNames.trim().length > 0
                  ? event.coupleNames.trim()
                  : null;

              return (
                <article
                  key={event.id}
                  className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-amber-900/10"
                >
                  <h2 className="text-xl font-semibold text-zinc-900">{coupleNames ?? event.title}</h2>
                  {coupleNames ? <p className="mt-1 text-sm text-zinc-600">{event.title}</p> : null}
                  <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{event.slug}</p>
                  <div className="mt-4 space-y-1.5 text-sm text-zinc-700">
                    <p>Guest families: {event._count?.guests ?? guests.length}</p>
                    <p>Families responded: {responded}</p>
                    <p>Families attending: {attendingFamilies}</p>
                    <p>Families declined: {declinedFamilies}</p>
                    <p>Max invited people: {totalMaxInvited}</p>
                    <p>Confirmed attendees: {confirmedAttendees}</p>
                  </div>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="mt-5 inline-flex rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-2.5 text-sm font-medium text-zinc-800"
                  >
                    Open dashboard
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

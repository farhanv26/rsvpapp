import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await prisma.event.findMany({
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

      {events.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-amber-900/10">
          <h2 className="text-lg font-semibold text-zinc-900">No events yet</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Create your first event to begin sending RSVP links.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {events.map((event) => {
            const responded = event.guests.filter((guest) => guest.respondedAt).length;
            const attendingFamilies = event.guests.filter((guest) => guest.attending === true).length;
            const declinedFamilies = event.guests.filter((guest) => guest.attending === false).length;
            const confirmedAttendees = event.guests.reduce(
              (sum, guest) => sum + (guest.attendingCount ?? 0),
              0,
            );
            const totalMaxInvited = event.guests.reduce((sum, guest) => sum + guest.maxGuests, 0);

            return (
              <article
                key={event.id}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-amber-900/10"
              >
                <h2 className="text-xl font-semibold text-zinc-900">
                  {event.coupleNames?.trim() || event.title}
                </h2>
                {event.coupleNames?.trim() ? (
                  <p className="mt-1 text-sm text-zinc-600">{event.title}</p>
                ) : null}
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{event.slug}</p>
                <div className="mt-4 space-y-1.5 text-sm text-zinc-700">
                  <p>Guest families: {event._count.guests}</p>
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

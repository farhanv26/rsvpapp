import Image from "next/image";
import Link from "next/link";
import { createGuestAction } from "@/app/admin/events/actions";
import { EventGuestsPanel } from "@/components/admin/event-guests-panel";
import { GuestCsvImport } from "@/components/admin/guest-csv-import";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/utils";

type Props = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EventDashboardPage({ params }: Props) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      guests: {
        orderBy: { createdAt: "desc" },
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

  const totalFamilies = event.guests.length;
  const totalMaximumInvited = event.guests.reduce((sum, guest) => sum + guest.maxGuests, 0);
  const totalResponded = event.guests.filter((guest) => guest.respondedAt).length;
  const totalPending = event.guests.filter((guest) => !guest.respondedAt).length;
  const totalAttendingFamilies = event.guests.filter((guest) => guest.attending === true).length;
  const totalDeclinedFamilies = event.guests.filter((guest) => guest.attending === false).length;
  const totalConfirmedAttendees = event.guests.reduce(
    (sum, guest) => sum + (guest.attendingCount ?? 0),
    0,
  );

  const guestsSerialized = event.guests.map((g) => ({
    id: g.id,
    guestName: g.guestName,
    maxGuests: g.maxGuests,
    token: g.token,
    attending: g.attending,
    attendingCount: g.attendingCount,
    respondedAt: g.respondedAt?.toISOString() ?? null,
    group: g.group,
    notes: g.notes,
    phone: g.phone,
    email: g.email,
    createdAt: g.createdAt.toISOString(),
  }));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf8f3_0%,#f5f0e8_100%)]">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/admin/events" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              ← Events
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
              {event.coupleNames?.trim() || event.title}
            </h1>
            {event.coupleNames?.trim() ? (
              <p className="mt-1 text-lg text-zinc-600">{event.title}</p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-zinc-400">{event.slug}</p>
          </div>
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm"
          >
            Edit event
          </Link>
        </header>

        <section className="overflow-hidden rounded-3xl border border-amber-900/10 bg-white shadow-[0_24px_60px_-40px_rgba(60,40,20,0.15)]">
          {event.imagePath ? (
            <div className="relative h-48 w-full sm:h-64">
              <Image src={event.imagePath} alt={event.title} fill className="object-cover" priority />
            </div>
          ) : null}
          <div className="space-y-3 p-6 text-sm leading-relaxed text-zinc-700 sm:p-8">
            {event.eventSubtitle ? <p className="text-zinc-600">{event.eventSubtitle}</p> : null}
            {event.eventDate || event.eventTime || event.venue ? (
              <p className="text-zinc-600">
                {event.eventDate
                  ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(event.eventDate)
                  : null}
                {event.eventDate && event.eventTime ? " · " : null}
                {event.eventTime ?? null}
                {(event.eventDate || event.eventTime) && event.venue ? " · " : null}
                {event.venue ?? null}
              </p>
            ) : null}
            {event.welcomeMessage ? <p>{event.welcomeMessage}</p> : null}
            {event.description ? <p className="text-zinc-600">{event.description}</p> : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Invited families" value={totalFamilies} accent="bg-white" />
          <StatCard label="Max headcount" value={totalMaximumInvited} accent="bg-white" />
          <StatCard label="Responded" value={totalResponded} sub={`${totalPending} pending`} accent="bg-white" />
          <StatCard
            label="Attending / Declined"
            value={`${totalAttendingFamilies} / ${totalDeclinedFamilies}`}
            sub={`${totalConfirmedAttendees} guests`}
            accent="bg-white"
          />
        </section>

        <section className="rounded-3xl border border-amber-900/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900">Add one guest</h2>
          <p className="mt-1 text-sm text-zinc-600">Optional: group, contact, notes — helpful for your records only.</p>
          <form action={createGuestAction} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="block text-sm font-medium text-zinc-700 sm:col-span-2">
              Guest / family name
              <input
                name="guestName"
                type="text"
                placeholder="The Valli Family"
                className="mt-1.5 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-base"
                required
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Max guests
              <input
                name="maxGuests"
                type="number"
                min={1}
                defaultValue={1}
                className="mt-1.5 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-base"
                required
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Group / side
              <input name="group" type="text" className="mt-1.5 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base" />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Phone
              <input name="phone" type="text" className="mt-1.5 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base" />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Email
              <input name="email" type="email" className="mt-1.5 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base" />
            </label>
            <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 lg:col-span-3">
              Notes
              <input name="notes" type="text" className="mt-1.5 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base" />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="w-full rounded-2xl bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-white shadow-sm sm:w-auto"
              >
                Add guest &amp; generate link
              </button>
            </div>
          </form>
        </section>

        <GuestCsvImport eventId={event.id} />

        <EventGuestsPanel eventId={event.id} guests={guestsSerialized} siteUrl={getPublicSiteUrl()} />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className={`rounded-3xl border border-amber-900/10 p-5 shadow-sm ${accent}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

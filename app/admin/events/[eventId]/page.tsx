import Link from "next/link";
import { createGuestAction } from "@/app/admin/events/actions";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { EventImageLightbox } from "@/components/event-image-lightbox";
import { EventGuestsPanel } from "@/components/admin/event-guests-panel";
import { GuestCsvImport } from "@/components/admin/guest-csv-import";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl, getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";

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
  const safeImageSrc = getSafeImageSrc(event.imagePath);
  console.info("[event-image] admin detail render src", {
    eventId: event.id,
    rawImagePath: event.imagePath,
    safeImageSrc,
  });
  const deadlineMeta = getRsvpDeadlineMeta(event.rsvpDeadline);

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
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    deadlineMeta?.status === "closed"
                      ? "bg-zinc-200 text-zinc-800"
                      : deadlineMeta?.status === "closes_today"
                        ? "bg-rose-100 text-rose-800"
                        : deadlineMeta?.status === "closing_soon"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-900"
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
              href={`/admin/events/${event.id}/edit`}
              className="btn-secondary inline-flex shrink-0"
            >
              Edit event
            </Link>
            <DeleteEventButton
              eventId={event.id}
              redirectToListOnSuccess
              className="btn-secondary border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            />
          </div>
        </header>

        <section className="app-card overflow-hidden">
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
        </section>

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

        <section className="app-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900">Add one guest</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Optional: group, contact, and notes for your internal planning.
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
              Max guests
              <input
                name="maxGuests"
                type="number"
                min={1}
                defaultValue={1}
                className="input-luxe"
                required
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Group / side
              <input name="group" type="text" className="input-luxe" />
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
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Add guest &amp; generate link
              </button>
            </div>
          </form>
        </section>

        <GuestCsvImport eventId={event.id} />

        <section className="app-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-zinc-900">Recent RSVP updates</h2>
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              {event.rsvpActivities.length} items
            </span>
          </div>
          {event.rsvpActivities.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-6 text-sm text-zinc-600">
              No RSVP updates yet.
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
              {event.rsvpActivities.map((activity) => (
                <article
                  key={activity.id}
                  className="rounded-2xl border border-[#e7dccb] bg-[#fffdfa] px-4 py-3"
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {activity.guest?.guestName ?? "Guest"} · {activity.description}
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

        <EventGuestsPanel
          eventId={event.id}
          eventTitle={event.title}
          guests={guestsSerialized}
          siteUrl={getPublicSiteUrl()}
        />
      </div>
    </main>
  );
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

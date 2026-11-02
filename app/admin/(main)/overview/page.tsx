import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState, NoWeddingSelected, PageHeader, PlaceRegister, Stat, StatStrip } from "@/components/admin/planning-ui";
import { summarizeEventAttendance } from "@/lib/attendance";
import { summarizeBudget } from "@/lib/budget";
import { formatMinor } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getRsvpDeadlineMeta } from "@/lib/utils";
import { summarizeWeddingGuests } from "@/lib/wedding-guest-summary";
import { loadPlanningPage } from "@/lib/workspace-page";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function OverviewPage() {
  const { workspace, wedding } = await loadPlanningPage();
  if (!wedding) {
    return (
      <main className="app-shell">
        <PageHeader title="Overview" />
        <NoWeddingSelected hasWeddings={workspace.weddings.length > 0} />
      </main>
    );
  }

  const [events, budgetItems, memberCount] = await Promise.all([
    prisma.event.findMany({
      where: { weddingId: wedding.id, deletedAt: null },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, title: true, eventDate: true, eventTime: true, venue: true, rsvpDeadline: true, imagePath: true,
        guests: {
          where: { deletedAt: null },
          select: {
            id: true, eventId: true, sharedGuestKey: true, menCount: true, womenCount: true, kidsCount: true, maxGuests: true,
            excludeFromTotals: true, excludeReason: true, excludedGuestCount: true, excludedMenCount: true, excludedWomenCount: true,
            excludedKidsCount: true, attending: true, attendingCount: true, respondedAt: true, invitedAt: true,
          },
        },
      },
    }),
    prisma.budgetItem.findMany({
      where: { weddingId: wedding.id, deletedAt: null },
      select: { id: true, label: true, eventId: true, estimateMinor: true, agreedMinor: true, perPersonMinor: true, perPersonBasis: true, nextPaymentDueAt: true, payments: { where: { deletedAt: null }, select: { amountMinor: true } } },
    }),
    prisma.weddingMembership.count({ where: { weddingId: wedding.id } }),
  ]);

  const perEvent = events.map((e) => ({ event: e, a: summarizeEventAttendance(e.guests) }));
  const wide = summarizeWeddingGuests(events.flatMap((e) => e.guests));
  const today = new Date();
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const upcoming = perEvent.filter(({ event }) => !event.eventDate || event.eventDate.getTime() >= startOfToday);
  const next = upcoming.find(({ event }) => event.eventDate);
  const daysToNext = next?.event.eventDate ? Math.round((next.event.eventDate.getTime() - startOfToday) / 86400000) : null;
  const awaiting = perEvent.reduce((s, { a }) => s + a.awaitingReplyHouseholds, 0);
  const headcounts = new Map(perEvent.map(({ event, a }) => [event.id, { invited: a.invitedPeople, confirmed: a.confirmedPeople }]));
  const budget = summarizeBudget(budgetItems, headcounts);

  const actions: { text: string; href: string; tone?: "warn" }[] = [];
  if (memberCount < 2) actions.push({ text: "Add your partner so you can plan together", href: `/admin/weddings?w=${wedding.id}#members` });
  if (events.length === 0) actions.push({ text: "Add your first event (Mehndi, Nikkah, reception…)", href: "/admin/events/new" });
  for (const { event, a } of perEvent) {
    if (a.households === 0) actions.push({ text: `Add guests to ${event.title}`, href: `/admin/events/${event.id}` });
    if (a.notInvitedHouseholds > 0) actions.push({ text: `${plural(a.notInvitedHouseholds, "household")} at ${event.title} ${a.notInvitedHouseholds === 1 ? "hasn't" : "haven't"} been sent an invitation`, href: `/admin/events/${event.id}?tab=invitation` });
    const deadline = getRsvpDeadlineMeta(event.rsvpDeadline);
    if (a.awaitingReplyHouseholds > 0 && deadline && (deadline.status === "closing_soon" || deadline.status === "closes_today")) {
      actions.push({ text: `${plural(a.awaitingReplyHouseholds, "household")} ${a.awaitingReplyHouseholds === 1 ? "hasn't" : "haven't"} replied to ${event.title}; replies close ${deadline.status === "closes_today" ? "today" : `in ${plural(deadline.daysRemaining, "day")}`}`, href: `/admin/events/${event.id}?tab=invitation`, tone: "warn" });
    }
    if (a.needsReview > 0) actions.push({ text: `${plural(a.needsReview, "household")} at ${event.title} ${a.needsReview === 1 ? "needs" : "need"} a counting decision`, href: `/admin/events/${event.id}?tab=guests`, tone: "warn" });
    if (!event.eventDate || !event.venue) actions.push({ text: `Add the ${!event.eventDate ? "date" : "venue"} for ${event.title}`, href: `/admin/events/${event.id}/edit` });
  }
  for (const item of budgetItems) {
    const f = budget.figures.get(item.id)!;
    if (!item.nextPaymentDueAt || f.balanceMinor === 0) continue;
    const days = Math.round((item.nextPaymentDueAt.getTime() - startOfToday) / 86400000);
    if (days < 0) actions.push({ text: `Review the payment reminder for ${item.label} (${dateFmt.format(item.nextPaymentDueAt)})`, href: `/admin/budget/${item.id}` });
    else if (days <= 14) actions.push({ text: `Payment reminder for ${item.label}: ${days === 0 ? "today" : dateFmt.format(item.nextPaymentDueAt)}`, href: `/admin/budget/${item.id}` });
  }

  const upcomingRows = upcoming.length > 0 ? upcoming : perEvent;

  return (
    <main className="app-shell">
      <PageHeader
        title={wedding.name}
        meta={
          next?.event.eventDate
            ? `${next.event.title} ${daysToNext === 0 ? "is today" : daysToNext === 1 ? "is tomorrow" : `in ${daysToNext} days`} · ${dateFmt.format(next.event.eventDate)}`
            : events.length > 0
              ? "No upcoming dates set"
              : undefined
        }
        actions={
          events.length > 0 ? (
            <Link href="/admin/events/new" className="btn-secondary">
              Add event
            </Link>
          ) : null
        }
      />

      {events.length > 0 ? (
        <StatStrip columns={4}>
          <Stat label="households" value={wide.uniqueHouseholds} hint={wide.householdsInMultipleEvents ? `${wide.householdsInMultipleEvents} at more than one event` : undefined} />
          <Stat label="people coming" value={wide.uniqueConfirmedAttendees} hint={`${wide.confirmedAcrossEvents} across all events`} />
          <Stat label={awaiting === 1 ? "household awaiting reply" : "households awaiting reply"} value={awaiting} />
          <Stat
            label="paid"
            value={formatMinor(budget.total.paidMinor, wedding.currency)}
            hint={budget.total.balanceDueMinor > 0 ? `${formatMinor(budget.total.balanceDueMinor, wedding.currency)} still due` : undefined}
          />
        </StatStrip>
      ) : null}

      <section aria-labelledby="next-actions" className="mt-8">
        <h2 id="next-actions" className="section-heading">
          Needs attention
        </h2>
        {actions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted-text)]">Nothing needs attention right now.</p>
        ) : (
          <ul className="list-rows mt-3">
            {actions.slice(0, 10).map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="group flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-muted)]">
                  <span className={a.tone === "warn" ? "status status-warning font-medium whitespace-normal" : ""}>{a.text}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-text)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="events-heading" className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 id="events-heading" className="section-heading">
            {upcoming.length > 0 ? "Upcoming events" : "Events"}
          </h2>
          {events.length > 0 ? (
            <Link href="/admin/events" className="text-link text-sm">
              All events
            </Link>
          ) : null}
        </div>
        {events.length === 0 ? (
          <div className="mt-3">
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
          </div>
        ) : (
          <>
            <ul className="list-rows mt-3 sm:hidden">
              {upcomingRows.map(({ event, a }) => (
                <li key={event.id}>
                  <Link href={`/admin/events/${event.id}`} className="block px-4 py-3 text-sm">
                    <span className="font-medium">{event.title}</span>
                    <span className="block text-[var(--muted-text)]">
                      {event.eventDate ? `${dateFmt.format(event.eventDate)}${event.eventTime ? ` · ${event.eventTime}` : ""}` : "Date not set"}
                    </span>
                    <span className="mt-1.5 block tabular-nums">
                      <span className="font-semibold">{a.confirmedPeople}</span> of {a.invitedPeople} coming · {a.awaitingReplyHouseholds} awaiting reply
                    </span>
                    {a.invitedPeople > 0 ? (
                      <div className="mt-1.5">
                        <PlaceRegister
                          total={a.invitedPeople}
                          segments={[{ places: a.confirmedPeople, tone: "ink", label: "Coming" }]}
                          label={`${a.confirmedPeople} of ${a.invitedPeople} coming`}
                        />
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="app-card mt-3 hidden overflow-x-auto sm:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="text-right">
                      Replied
                    </th>
                    <th scope="col" className="text-right">
                      Awaiting reply
                    </th>
                    <th scope="col" className="w-56">
                      Coming
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingRows.map(({ event, a }) => (
                    <tr key={event.id}>
                      <td>
                        <Link href={`/admin/events/${event.id}`} className="font-medium hover:underline">
                          {event.title}
                        </Link>
                        {event.venue ? <p className="text-xs text-[var(--muted-text)]">{event.venue}</p> : null}
                      </td>
                      <td className="whitespace-nowrap">
                        {event.eventDate ? `${dateFmt.format(event.eventDate)}${event.eventTime ? ` · ${event.eventTime}` : ""}` : <span className="text-[var(--muted-text)]">Not set</span>}
                      </td>
                      <td className="text-right tabular-nums">
                        {a.respondedHouseholds} of {a.households}
                      </td>
                      <td className="text-right tabular-nums">{a.awaitingReplyHouseholds}</td>
                      <td className="tabular-nums">
                        <span className="font-semibold">{a.confirmedPeople}</span> of {a.invitedPeople}
                        {a.invitedPeople > 0 ? (
                          <div className="mt-1.5">
                            <PlaceRegister
                              total={a.invitedPeople}
                              segments={[{ places: a.confirmedPeople, tone: "ink", label: "Coming" }]}
                              label={`${a.confirmedPeople} of ${a.invitedPeople} coming`}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

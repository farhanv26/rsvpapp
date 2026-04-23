import Link from "next/link";
import { redirect } from "next/navigation";
import { EventReportPrintButton } from "@/components/admin/event-report-print-button";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { buildDuplicateStrengthMap, type DuplicateStrength } from "@/lib/guest-duplicates";
import { countInvitedAwaitingRsvp } from "@/lib/guest-followup";
import { getGuestReadiness, type GuestReadinessInput } from "@/lib/guest-readiness";
import { prisma } from "@/lib/prisma";
import { getRsvpDeadlineMeta, getSafeImageSrc } from "@/lib/utils";

type Props = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

function formatDateOnly(iso: Date | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(iso);
}

function readinessInput(g: {
  respondedAt: Date | null;
  invitedAt: Date | null;
  phone: string | null;
  email: string | null;
}): GuestReadinessInput {
  return {
    respondedAt: g.respondedAt?.toISOString() ?? null,
    invitedAt: g.invitedAt?.toISOString() ?? null,
    phone: g.phone,
    email: g.email,
  };
}

function duplicateLabel(strength: DuplicateStrength): string | null {
  if (strength === "none") return null;
  if (strength === "strong") return "Duplicate (same phone/email)";
  return "Possible duplicate (same name)";
}

function rsvpLabel(g: { attending: boolean | null; respondedAt: Date | null }): string {
  if (!g.respondedAt) return "Pending";
  if (g.attending === true) return "Attending";
  if (g.attending === false) return "Declined";
  return "Responded";
}

type GuestRow = {
  id: string;
  guestName: string;
  group: string | null;
  tableName: string | null;
  maxGuests: number;
  attending: boolean | null;
  respondedAt: Date | null;
  invitedAt: Date | null;
  phone: string | null;
  email: string | null;
  excludeFromTotals: boolean;
  excludeReason: string | null;
};

function GuestTable({ guests }: { guests: GuestRow[] }) {
  if (guests.length === 0) {
    return <p className="text-sm text-zinc-500">None.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 print:border-zinc-300">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 print:bg-zinc-100">
            <th className="px-3 py-2 font-semibold">Guest / family</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 font-semibold">Table</th>
            <th className="px-3 py-2 font-semibold">Max</th>
            <th className="px-3 py-2 font-semibold">RSVP</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((g) => (
            <tr key={g.id} className="border-b border-zinc-100">
              <td className="px-3 py-2 font-medium text-zinc-900">{g.guestName}</td>
              <td className="px-3 py-2 text-zinc-700">{g.group?.trim() || "—"}</td>
              <td className="px-3 py-2 text-zinc-700">{g.tableName?.trim() || "—"}</td>
              <td className="px-3 py-2 tabular-nums text-zinc-700">{g.maxGuests}</td>
              <td className="px-3 py-2 text-zinc-700">{rsvpLabel(g)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuestTableWithDuplicate({
  guests,
  dupLabels,
}: {
  guests: GuestRow[];
  dupLabels: Map<string, string>;
}) {
  if (guests.length === 0) {
    return <p className="text-sm text-zinc-500">None.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 print:border-zinc-300">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 print:bg-zinc-100">
            <th className="px-3 py-2 font-semibold">Guest / family</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 font-semibold">Table</th>
            <th className="px-3 py-2 font-semibold">Max</th>
            <th className="px-3 py-2 font-semibold">RSVP</th>
            <th className="px-3 py-2 font-semibold">Duplicate check</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((g) => (
            <tr key={g.id} className="border-b border-zinc-100">
              <td className="px-3 py-2 font-medium text-zinc-900">{g.guestName}</td>
              <td className="px-3 py-2 text-zinc-700">{g.group?.trim() || "—"}</td>
              <td className="px-3 py-2 text-zinc-700">{g.tableName?.trim() || "—"}</td>
              <td className="px-3 py-2 tabular-nums text-zinc-700">{g.maxGuests}</td>
              <td className="px-3 py-2 text-zinc-700">{rsvpLabel(g)}</td>
              <td className="px-3 py-2 text-zinc-600">{dupLabels.get(g.id) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EventReportPage({ params }: Props) {
  const admin = await requireCurrentAdminUser();
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    include: {
      owner: { select: { name: true } },
      guests: {
        where: { deletedAt: null },
        orderBy: { guestName: "asc" },
      },
    },
  });

  if (!event) {
    return (
      <main className="min-h-screen bg-white px-4 py-10">
        <p className="text-zinc-700">Event not found.</p>
      </main>
    );
  }

  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    redirect("/admin/events");
  }

  const guests = event.guests;
  const countedGuests = guests.filter((g) => !g.excludeFromTotals);
  const generatedAt = new Date();

  const totalFamilies = guests.length;
  const totalMaximumInvited = countedGuests.reduce((s, g) => s + g.maxGuests, 0);
  const invitedFamilies = countedGuests.filter((g) => g.invitedAt).length;
  const totalResponded = countedGuests.filter((g) => g.respondedAt).length;
  const attendingFamilies = countedGuests.filter((g) => g.attending === true);
  const declinedFamilies = countedGuests.filter((g) => g.attending === false);
  const totalConfirmedAttendees = countedGuests.reduce((s, g) => s + (g.attendingCount ?? 0), 0);
  const notInvitedYet = countedGuests.filter((g) => !g.invitedAt);
  const invitedNoResponse = countedGuests.filter((g) => g.invitedAt && !g.respondedAt);
  const missingContact = countedGuests.filter((g) => getGuestReadiness(readinessInput(g)).id === "missing_contact");
  const withoutTable = countedGuests.filter((g) => !g.tableName?.trim());

  const dupInputs = countedGuests.map((g) => ({
    id: g.id,
    guestName: g.guestName,
    phone: g.phone,
    email: g.email,
  }));
  const dupMap = buildDuplicateStrengthMap(dupInputs);
  const dupLabels = new Map<string, string>();
  for (const g of countedGuests) {
    const lab = duplicateLabel(dupMap.get(g.id) ?? "none");
    if (lab) dupLabels.set(g.id, lab);
  }
  const duplicateGuests = countedGuests.filter((g) => dupMap.get(g.id) !== "none");

  const needsFollowUpCount = countInvitedAwaitingRsvp(
    countedGuests.map((g) => ({
      invitedAt: g.invitedAt?.toISOString() ?? null,
      respondedAt: g.respondedAt?.toISOString() ?? null,
    })),
  );

  const byTable = new Map<string, GuestRow[]>();
  for (const g of guests) {
    const key = g.tableName?.trim() || "";
    const row: GuestRow = {
      id: g.id,
      guestName: g.guestName,
      group: g.group,
      tableName: g.tableName,
      maxGuests: g.maxGuests,
      attending: g.attending,
      respondedAt: g.respondedAt,
      invitedAt: g.invitedAt,
      phone: g.phone,
      email: g.email,
      excludeFromTotals: g.excludeFromTotals,
      excludeReason: g.excludeReason,
    };
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key)!.push(row);
  }
  const tableKeys = Array.from(byTable.keys()).sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  const byCategory = new Map<string, GuestRow[]>();
  for (const g of guests) {
    const key = g.group?.trim() || "";
    const row: GuestRow = {
      id: g.id,
      guestName: g.guestName,
      group: g.group,
      tableName: g.tableName,
      maxGuests: g.maxGuests,
      attending: g.attending,
      respondedAt: g.respondedAt,
      invitedAt: g.invitedAt,
      phone: g.phone,
      email: g.email,
      excludeFromTotals: g.excludeFromTotals,
      excludeReason: g.excludeReason,
    };
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(row);
  }
  const categoryKeys = Array.from(byCategory.keys()).sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  const deadlineMeta = getRsvpDeadlineMeta(event.rsvpDeadline);
  const safeImageSrc = getSafeImageSrc(event.imagePath);

  const guestRows = (list: typeof guests): GuestRow[] =>
    list.map((g) => ({
      id: g.id,
      guestName: g.guestName,
      group: g.group,
      tableName: g.tableName,
      maxGuests: g.maxGuests,
      attending: g.attending,
      respondedAt: g.respondedAt,
      invitedAt: g.invitedAt,
      phone: g.phone,
      email: g.email,
      excludeFromTotals: g.excludeFromTotals,
      excludeReason: g.excludeReason,
    }));

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.55in; size: auto; }
          .report-no-print { display: none !important; }
          .report-sheet {
            background: white !important;
            box-shadow: none !important;
          }
          .report-break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <main className="min-h-screen bg-[#f4f1ea] print:bg-white">
        <div className="report-no-print mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={`/admin/events/${event.id}`} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Event dashboard
          </Link>
          <div className="flex flex-wrap gap-2">
            <EventReportPrintButton />
          </div>
        </div>

        <article className="report-sheet mx-auto max-w-4xl px-4 pb-16 print:max-w-none print:px-0 print:pb-0">
          <header className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Host summary</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 print:text-xl">
              {event.coupleNames?.trim() || event.title}
            </h1>
            {event.coupleNames?.trim() ? (
              <p className="mt-1 text-lg text-zinc-600">{event.title}</p>
            ) : null}

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {event.eventDate ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Date</dt>
                  <dd className="mt-0.5 text-zinc-900">{formatDateOnly(event.eventDate)}</dd>
                </div>
              ) : null}
              {event.eventTime ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Time</dt>
                  <dd className="mt-0.5 text-zinc-900">{event.eventTime}</dd>
                </div>
              ) : null}
              {event.venue ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Venue</dt>
                  <dd className="mt-0.5 text-zinc-900">{event.venue}</dd>
                </div>
              ) : null}
              {event.rsvpDeadline ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">RSVP deadline</dt>
                  <dd className="mt-0.5 text-zinc-900">
                    {formatDateOnly(event.rsvpDeadline)}
                    {deadlineMeta?.status === "closed" ? (
                      <span className="ml-2 text-zinc-500">(closed)</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {isSuperAdmin(admin) && event.owner ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Event owner</dt>
                  <dd className="mt-0.5 text-zinc-900">{event.owner.name}</dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-6 text-xs text-zinc-500">
              Report generated{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(generatedAt)}
            </p>

            {safeImageSrc ? (
              <div className="report-break-inside-avoid mt-6 max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-2 print:bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- report may use any stored invitation URL */}
                <img
                  src={safeImageSrc}
                  alt=""
                  className="mx-auto max-h-44 w-auto object-contain object-center print:max-h-36"
                />
              </div>
            ) : null}
          </header>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Metrics</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric label="Guest records (families)" value={String(totalFamilies)} />
              <Metric label="Counted in totals" value={String(countedGuests.length)} />
              <Metric label="Max invited (capacity)" value={String(totalMaximumInvited)} />
              <Metric label="Families invited (tracked)" value={String(invitedFamilies)} />
              <Metric label="Families responded" value={String(totalResponded)} />
              <Metric label="Attending families" value={String(attendingFamilies.length)} />
              <Metric label="Declined families" value={String(declinedFamilies.length)} />
              <Metric label="Confirmed attendees (heads)" value={String(totalConfirmedAttendees)} />
              <Metric label="Not invited yet" value={String(notInvitedYet.length)} />
              <Metric label="Invited, no response yet" value={String(needsFollowUpCount)} />
              <Metric label="Missing phone & email" value={String(missingContact.length)} />
              <Metric label="Duplicate warnings (guests)" value={String(duplicateGuests.length)} />
              <Metric label="No table assigned" value={String(withoutTable.length)} />
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">Attending</h2>
            <p className="mt-1 text-sm text-zinc-600">Families who accepted the invitation.</p>
            <div className="mt-4">
              <GuestTable guests={guestRows(attendingFamilies)} />
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">Declined</h2>
            <p className="mt-1 text-sm text-zinc-600">Families who declined.</p>
            <div className="mt-4">
              <GuestTable guests={guestRows(declinedFamilies)} />
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">Invited — awaiting RSVP</h2>
            <p className="mt-1 text-sm text-zinc-600">Marked invited but no response yet.</p>
            <div className="mt-4">
              <GuestTable guests={guestRows(invitedNoResponse)} />
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">Not invited yet</h2>
            <p className="mt-1 text-sm text-zinc-600">No invite recorded in the app.</p>
            <div className="mt-4">
              <GuestTable guests={guestRows(notInvitedYet)} />
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">Missing contact</h2>
            <p className="mt-1 text-sm text-zinc-600">No phone and no email on file.</p>
            <div className="mt-4">
              <GuestTable guests={guestRows(missingContact)} />
            </div>
          </section>

          {duplicateGuests.length > 0 ? (
            <section className="report-break-inside-avoid mb-8 rounded-2xl border border-rose-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
              <h2 className="text-base font-semibold text-zinc-900">Duplicate warnings</h2>
              <p className="mt-1 text-sm text-zinc-600">Review these rows in the guest list before sending.</p>
              <div className="mt-4">
                <GuestTableWithDuplicate guests={guestRows(duplicateGuests)} dupLabels={dupLabels} />
              </div>
            </section>
          ) : null}

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">No table assignment</h2>
            <p className="mt-1 text-sm text-zinc-600">Guests without a table label.</p>
            <div className="mt-4">
              <GuestTable guests={guestRows(withoutTable)} />
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">By table</h2>
            <p className="mt-1 text-sm text-zinc-600">Grouped for seating and day-of coordination.</p>
            <div className="mt-6 space-y-6">
              {tableKeys.map((key) => {
                const label = key === "" ? "Unassigned" : key;
                const rows = byTable.get(key) ?? [];
                return (
                  <div key={key || "none"}>
                    <h3 className="text-sm font-semibold text-zinc-800">{label}</h3>
                    <div className="mt-2">
                      <GuestTable guests={rows} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="report-break-inside-avoid mb-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none">
            <h2 className="text-base font-semibold text-zinc-900">By category</h2>
            <p className="mt-1 text-sm text-zinc-600">Group labels (e.g. family, VIP).</p>
            <div className="mt-6 space-y-6">
              {categoryKeys.map((key) => {
                const label = key === "" ? "Uncategorized" : key;
                const rows = byCategory.get(key) ?? [];
                return (
                  <div key={key || "uncat"}>
                    <h3 className="text-sm font-semibold text-zinc-800">{label}</h3>
                    <div className="mt-2">
                      <GuestTable guests={rows} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </article>
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 print:border-zinc-200 print:bg-white">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

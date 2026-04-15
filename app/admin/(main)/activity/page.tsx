import { requireSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{ user?: string; action?: string; event?: string; q?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }: Props) {
  await requireSuperAdmin();
  const params = searchParams ? await searchParams : undefined;
  const userFilter = params?.user?.trim() || "all";
  const actionFilter = params?.action?.trim() || "all";
  const eventFilter = params?.event?.trim() || "all";
  const q = params?.q?.trim() || "";

  const [users, events] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true } }),
  ]);

  const activities = await prisma.auditActivity.findMany({
    where: {
      ...(userFilter !== "all" ? { userId: userFilter } : {}),
      ...(actionFilter !== "all" ? { actionType: actionFilter } : {}),
      ...(eventFilter !== "all" ? { eventId: eventFilter } : {}),
      ...(q
        ? {
            OR: [
              { userName: { contains: q, mode: "insensitive" } },
              { message: { contains: q, mode: "insensitive" } },
              { entityName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const actionOptions = [
    "event_created",
    "event_updated",
    "event_deleted",
    "guest_created",
    "guest_updated",
    "guest_deleted",
    "guest_bulk_deleted",
    "guest_bulk_imported",
    "rsvp_submitted",
    "rsvp_updated",
    "communication_email_queued",
    "communication_email_sent",
    "communication_email_failed",
    "communication_email_guest_sent",
    "communication_email_guest_failed",
    "communication_email_guest_skipped",
    "communication_whatsapp_prepared",
    "communication_whatsapp_bulk_prepared",
    "guest_invite_marked",
    "user_created",
    "user_role_updated",
    "user_password_reset",
    "user_deactivated",
    "user_deleted",
    "event_ownership_transferred",
  ];

  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-6">
        <section className="app-card p-6 sm:p-8">
          <p className="section-title">Audit Trail</p>
          <h1 className="headline-display mt-2">System activity</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Review who performed key actions across users, events, guests, and RSVP updates.
          </p>
          <p className="mt-3 rounded-xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3 text-xs text-zinc-600">
            Per-guest <span className="font-medium text-zinc-800">communication history</span> (WhatsApp prepared,
            email send/skip/fail, manual invite marks, reminders) is stored separately from this audit list. Open an
            event → guest list → <span className="font-medium text-zinc-800">Comm history</span> on a row to see the
            full timeline for that guest.
          </p>
        </section>

        <section className="app-card p-5">
          <form method="get" className="grid gap-3 md:grid-cols-4">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search activity text..."
              className="input-luxe mt-0 md:col-span-4"
            />
            <select name="user" defaultValue={userFilter} className="input-luxe mt-0">
              <option value="all">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select name="action" defaultValue={actionFilter} className="input-luxe mt-0">
              <option value="all">All actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <select name="event" defaultValue={eventFilter} className="input-luxe mt-0">
              <option value="all">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary w-full">
                Apply
              </button>
              <a href="/admin/activity" className="btn-secondary w-full text-center">
                Reset
              </a>
            </div>
          </form>
        </section>

        <section className="app-card overflow-hidden">
          <div className="border-b border-[#ebe4d6] px-5 py-4 text-sm text-zinc-600">{activities.length} recent items</div>
          {activities.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-600">No activity matched your filters.</p>
          ) : (
            <ul className="divide-y divide-[#ebe4d6]">
              {activities.map((activity) => (
                <li key={activity.id} className="px-5 py-4">
                  <p className="text-sm font-medium text-zinc-900">{activity.message}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {activity.userName} · {formatActionLabel(activity.actionType)} · {activity.entityType}
                    {activity.entityName ? ` · ${activity.entityName}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                      activity.createdAt,
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function formatActionLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

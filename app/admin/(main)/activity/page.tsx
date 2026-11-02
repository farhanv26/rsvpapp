import { EmptyState, PageHeader } from "@/components/admin/planning-ui";
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
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.event.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
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

  const filtered = userFilter !== "all" || actionFilter !== "all" || eventFilter !== "all" || Boolean(q);

  return (
    <main className="app-shell">
      <PageHeader title="Activity" meta={`${activities.length} most recent${filtered ? " matching" : ""} · newest first`} />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
        <label className="sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search activity</span>
          <input name="q" defaultValue={q} placeholder="Search activity" className="input-luxe mt-0" />
        </label>
        <label>
          <span className="sr-only">User</span>
            <select name="user" defaultValue={userFilter} className="input-luxe mt-0">
              <option value="all">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
        </label>
        <label>
          <span className="sr-only">Action</span>
            <select name="action" defaultValue={actionFilter} className="input-luxe mt-0">
              <option value="all">All actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {formatActionLabel(action)}
                </option>
              ))}
            </select>
        </label>
        <label>
          <span className="sr-only">Event</span>
            <select name="event" defaultValue={eventFilter} className="input-luxe mt-0">
              <option value="all">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-secondary flex-1">
            Filter
          </button>
          {filtered ? (
            <a href="/admin/activity" className="btn-ghost">
              Clear
            </a>
          ) : null}
        </div>
      </form>

      {activities.length === 0 ? (
        <EmptyState title={filtered ? "No activity matches these filters" : "No activity yet"} />
      ) : (
        <ul className="list-rows">
          {activities.map((activity) => (
            <li key={activity.id} className="grid gap-x-6 gap-y-0.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <div className="min-w-0">
                <p className="text-sm break-words">{activity.message}</p>
                <p className="mt-0.5 text-[13px] text-[var(--muted-text)]">
                  {activity.userName} · {formatActionLabel(activity.actionType)}
                  {activity.entityName ? ` · ${activity.entityName}` : ""}
                </p>
              </div>
              <p className="text-[13px] text-[var(--muted-text)] tabular-nums sm:text-right">
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(activity.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
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

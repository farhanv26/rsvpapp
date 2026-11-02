import { restoreEventAction } from "@/app/admin/events/actions";
import { EmptyState, PageHeader } from "@/components/admin/planning-ui";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { accessibleEventsWhere } from "@/lib/wedding-policy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeletedEventsPage() {
  const admin = await requireCurrentAdminUser();
  const deleted = await prisma.event.findMany({
    where: {
      AND: [{ deletedAt: { not: null } }, accessibleEventsWhere(admin)],
    },
    orderBy: { deletedAt: "desc" },
    take: 80,
    select: {
      id: true,
      title: true,
      coupleNames: true,
      slug: true,
      deletedAt: true,
      owner: { select: { name: true } },
      wedding: { select: { name: true } },
    },
  });

  return (
    <main className="app-shell">
      <div className="max-w-3xl">
        <PageHeader title="Deleted events" back={{ href: "/admin/events", label: "Events" }} meta="Restoring an event makes its guests' invitation links work again." />
        {deleted.length === 0 ? (
          <EmptyState title="No deleted events" />
        ) : (
          <ul className="list-rows">
            {deleted.map((ev) => (
              <li key={ev.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{ev.title}</p>
                  <p className="text-[13px] text-[var(--muted-text)]">
                    Deleted {ev.deletedAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(ev.deletedAt) : "—"}
                    {ev.wedding?.name ? ` · ${ev.wedding.name}` : ev.coupleNames?.trim() ? ` · ${ev.coupleNames.trim()}` : null}
                    {ev.owner?.name ? ` · Created by ${ev.owner.name}` : null}
                  </p>
                </div>
                <form action={restoreEventAction} className="shrink-0">
                  <input type="hidden" name="eventId" value={ev.id} />
                  <button type="submit" className="btn-secondary btn-sm">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

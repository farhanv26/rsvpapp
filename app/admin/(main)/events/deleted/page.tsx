import Link from "next/link";
import { restoreEventAction } from "@/app/admin/events/actions";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeletedEventsPage() {
  const admin = await requireCurrentAdminUser();
  const deleted = await prisma.event.findMany({
    where: {
      deletedAt: { not: null },
      ...(isSuperAdmin(admin) ? {} : { ownerUserId: admin.id }),
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
    },
  });

  return (
    <main className="min-h-screen">
      <div className="app-shell max-w-3xl space-y-6">
        <div>
          <Link href="/admin/events" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Events
          </Link>
          <h1 className="headline-display mt-3 text-2xl text-zinc-900">Deleted events</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Events you moved to trash stay here until you restore them. Guest data is retained while the event exists.
          </p>
        </div>
        {deleted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-8 text-center text-sm text-zinc-600">
            No deleted events.
          </p>
        ) : (
          <ul className="space-y-3">
            {deleted.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#e7dccb] bg-[#fffdfa] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900">{ev.coupleNames?.trim() || ev.title}</p>
                  <p className="text-xs text-zinc-500">
                    Deleted{" "}
                    {ev.deletedAt
                      ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                          ev.deletedAt,
                        )
                      : "—"}
                    {ev.owner?.name ? ` · Owner: ${ev.owner.name}` : null}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400">{ev.slug}</p>
                </div>
                <form action={restoreEventAction} className="shrink-0">
                  <input type="hidden" name="eventId" value={ev.id} />
                  <button type="submit" className="btn-primary text-sm">
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

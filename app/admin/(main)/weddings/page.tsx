import Link from "next/link";
import {
  addWeddingMemberAction,
  createWeddingAction,
  removeWeddingMemberAction,
  selectActiveWeddingAction,
  updateWeddingMemberRoleAction,
} from "@/app/admin/weddings/actions";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getWeddingAccess, resolveActiveWorkspace } from "@/lib/wedding-access";
import { canManageWeddingMembers } from "@/lib/wedding-policy";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ w?: string; error?: string; saved?: string; notice?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: "Enter a wedding name (up to 120 characters).",
  invalid_member: "Enter an account name and choose a role.",
  owner_required: "Only a wedding owner can manage members.",
  user_not_found: "No active account has that exact name. Ask a platform admin to create the account first.",
  already_member: "That account is already a member of this wedding.",
  member_not_found: "That membership no longer exists.",
  last_owner: "A wedding must keep at least one owner.",
};

const SAVED_MESSAGES: Record<string, string> = {
  member_added: "Member added.",
  role_updated: "Role updated.",
  member_removed: "Member removed.",
};

export default async function WeddingsPage({ searchParams }: Props) {
  const admin = await requireCurrentAdminUser();
  const params = searchParams ? await searchParams : undefined;
  const workspace = await resolveActiveWorkspace(admin);

  const weddingIds = workspace.weddings.map((w) => w.id);
  const counts =
    weddingIds.length > 0
      ? await prisma.wedding.findMany({
          where: { id: { in: weddingIds } },
          select: {
            id: true,
            _count: { select: { memberships: true, events: { where: { deletedAt: null } } } },
          },
        })
      : [];
  const countById = new Map(counts.map((c) => [c.id, c._count]));

  const selectedId = params?.w?.trim() || workspace.activeWedding?.id || "";
  const selectedAccess = selectedId ? await getWeddingAccess(admin, selectedId) : null;
  const selected = selectedAccess?.status === "ok" ? selectedAccess : null;
  const canManage = selected ? canManageWeddingMembers(admin, selected.membershipRole) : false;
  const members = selected
    ? await prisma.weddingMembership.findMany({
        where: { weddingId: selected.wedding.id },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, role: true, userId: true, user: { select: { name: true, active: true } } },
      })
    : [];

  const errorMessage = params?.error ? ERROR_MESSAGES[params.error] ?? "Something went wrong." : null;
  const savedMessage = params?.saved ? SAVED_MESSAGES[params.saved] ?? null : null;

  return (
    <main className="min-h-screen">
      <div className="app-shell max-w-4xl space-y-6">
        <div className="app-card overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#b28944]/40 to-transparent" />
          <div className="p-6 sm:p-8">
            <Link href="/admin/events" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              ← Events
            </Link>
            <p className="section-title mt-4">Workspaces</p>
            <h1 className="headline-display mt-2">Wedding workspaces</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              Each wedding holds its own events, guests and RSVPs. Members of a wedding can manage all of its events;
              only owners can add or remove members.
            </p>
          </div>
        </div>

        {params?.notice === "create_first" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            Create a wedding workspace before adding events.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {savedMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            {savedMessage}
          </div>
        ) : null}

        <section className="app-card p-6 sm:p-7">
          <h2 className="text-base font-semibold text-zinc-900">Your weddings</h2>
          {workspace.weddings.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-6 text-center text-sm text-zinc-500">
              You are not part of a wedding workspace yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#ece4d4] overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa]">
              {workspace.weddings.map((w) => {
                const c = countById.get(w.id);
                const isActive = workspace.activeWedding?.id === w.id;
                return (
                  <li key={w.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900">
                        {w.name}
                        {isActive ? <span className="badge-success ml-2 align-middle">Active</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {w.role === "owner" ? "Owner" : w.role === "member" ? "Member" : "Platform access"}
                        {c ? ` · ${c.events} event${c.events === 1 ? "" : "s"} · ${c.memberships} member${c.memberships === 1 ? "" : "s"}` : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!isActive ? (
                        <form action={selectActiveWeddingAction}>
                          <input type="hidden" name="weddingId" value={w.id} />
                          <input type="hidden" name="returnTo" value="/admin/events" />
                          <button type="submit" className="btn-primary text-sm">
                            Open
                          </button>
                        </form>
                      ) : (
                        <Link href="/admin/events" className="btn-primary text-sm">
                          Open
                        </Link>
                      )}
                      <Link href={`/admin/weddings?w=${encodeURIComponent(w.id)}`} className="btn-secondary text-sm">
                        Members
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selected ? (
          <section className="app-card p-6 sm:p-7" id="members">
            <h2 className="text-base font-semibold text-zinc-900">Members · {selected.wedding.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {canManage
                ? "Add your partner or planner by their account name. Owners can manage members; members can manage events."
                : "Only owners can change members of this wedding."}
            </p>
            <ul className="mt-4 divide-y divide-[#ece4d4] overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa]">
              {members.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {m.user.name}
                      {m.userId === admin.id ? <span className="ml-1 text-zinc-400">(you)</span> : null}
                      {!m.user.active ? <span className="badge-neutral ml-2 align-middle">Inactive</span> : null}
                    </p>
                    <p className="text-xs text-zinc-500">{m.role === "owner" ? "Owner" : "Member"}</p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <form action={updateWeddingMemberRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select
                          name="role"
                          defaultValue={m.role}
                          className="input-luxe mt-0 w-32 py-2 text-sm"
                          aria-label={`Role for ${m.user.name}`}
                        >
                          <option value="owner">Owner</option>
                          <option value="member">Member</option>
                        </select>
                        <button type="submit" className="btn-secondary text-sm">
                          Save
                        </button>
                      </form>
                      <form action={removeWeddingMemberAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button
                          type="submit"
                          className="btn-secondary border-rose-200 bg-rose-50 text-sm text-rose-800 hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canManage ? (
              <form action={addWeddingMemberAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <input type="hidden" name="weddingId" value={selected.wedding.id} />
                <label className="block text-sm font-medium text-zinc-700">
                  Account name
                  <input name="userName" type="text" required maxLength={80} className="input-luxe" placeholder="Exact login name" />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Role
                  <select name="role" defaultValue="member" className="input-luxe">
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary">
                  Add member
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className="app-card p-6 sm:p-7">
          <h2 className="text-base font-semibold text-zinc-900">Create a wedding workspace</h2>
          <p className="mt-1 text-sm text-zinc-500">You will be its owner. Events you create next will belong to it.</p>
          <form action={createWeddingAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm font-medium text-zinc-700">
              Wedding name
              <input name="name" type="text" required maxLength={120} className="input-luxe" placeholder="Aisha & Omar" />
            </label>
            <button type="submit" className="btn-primary">
              Create wedding
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

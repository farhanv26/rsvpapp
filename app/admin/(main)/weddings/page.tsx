import Link from "next/link";
import {
  addWeddingMemberAction,
  createWeddingAction,
  removeWeddingMemberAction,
  selectActiveWeddingAction,
  updateWeddingMemberRoleAction,
} from "@/app/admin/weddings/actions";
import { EmptyState, Feedback, PageHeader } from "@/components/admin/planning-ui";
import { ConfirmSubmit } from "@/components/admin/ui/dialog-trigger";
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
    <main className="app-shell">
      <div className="max-w-3xl">
        <PageHeader title="Weddings" back={{ href: "/admin/settings", label: "Settings" }} />

        {params?.notice === "create_first" ? (
          <p className="notice-warning mb-4" role="status">
            Create a wedding before adding events.
          </p>
        ) : null}
        <Feedback saved={savedMessage} error={errorMessage} />

        <section aria-labelledby="your-weddings">
          <h2 id="your-weddings" className="section-heading">
            Your weddings
          </h2>
          {workspace.weddings.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="You're not part of a wedding yet">Create one below, or ask an owner to add you by your account name.</EmptyState>
            </div>
          ) : (
            <ul className="list-rows mt-3">
              {workspace.weddings.map((w) => {
                const c = countById.get(w.id);
                const isActive = workspace.activeWedding?.id === w.id;
                return (
                  <li key={w.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">
                        {w.name}
                        {isActive ? <span className="ml-2 text-[13px] font-medium text-[var(--accent)]">Open now</span> : null}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--muted-text)] tabular-nums">
                        {w.role === "owner" ? "Owner" : w.role === "member" ? "Member" : "Platform access"}
                        {c ? ` · ${c.events} event${c.events === 1 ? "" : "s"} · ${c.memberships} member${c.memberships === 1 ? "" : "s"}` : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/admin/weddings?w=${encodeURIComponent(w.id)}#members`} className="btn-ghost btn-sm">
                        Members
                      </Link>
                      {!isActive ? (
                        <form action={selectActiveWeddingAction}>
                          <input type="hidden" name="weddingId" value={w.id} />
                          <input type="hidden" name="returnTo" value="/admin/overview" />
                          <button type="submit" className="btn-secondary btn-sm">
                            Switch to this wedding
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selected ? (
          <section className="mt-10 scroll-mt-20" id="members" aria-labelledby="members-heading">
            <h2 id="members-heading" className="section-heading">
              Members of {selected.wedding.name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted-text)]">
              {canManage ? "Owners add and remove members. Members plan everything else." : "Only owners can change members."}
            </p>
            <ul className="list-rows mt-3">
              {members.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold break-words">
                      {m.user.name}
                      {m.userId === admin.id ? <span className="ml-1 font-normal text-[var(--muted-text)]">(you)</span> : null}
                      {!m.user.active ? <span className="badge-neutral ml-2 align-middle">Inactive</span> : null}
                    </p>
                    <p className="text-[13px] text-[var(--muted-text)]">{m.role === "owner" ? "Owner" : "Member"}</p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <form action={updateWeddingMemberRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input-luxe mt-0 w-32" aria-label={`Role for ${m.user.name}`}>
                          <option value="owner">Owner</option>
                          <option value="member">Member</option>
                        </select>
                        <button type="submit" className="btn-secondary btn-sm">
                          Save role
                        </button>
                      </form>
                      <form action={removeWeddingMemberAction} className="sm:ml-3">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <ConfirmSubmit message={`Remove ${m.user.name} from ${selected.wedding.name}?`} className="btn-danger-quiet btn-sm" ariaLabel={`Remove ${m.user.name}`}>
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canManage ? (
              <form action={addWeddingMemberAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                <input type="hidden" name="weddingId" value={selected.wedding.id} />
                <label className="form-label">
                  Account name
                  <input name="userName" type="text" required maxLength={80} className="input-luxe" placeholder="Exactly as they sign in" />
                </label>
                <label className="form-label">
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

        <section className="mt-10 border-t border-[var(--border-strong)] pt-6" aria-labelledby="create-heading">
          <h2 id="create-heading" className="section-heading">
            Create a wedding
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted-text)]">You&apos;ll be its owner, and new events will belong to it.</p>
          <form action={createWeddingAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="form-label flex-1">
              Wedding name
              <input name="name" type="text" required maxLength={120} className="input-luxe" placeholder="Aisha & Omar" />
            </label>
            <button type="submit" className="btn-secondary">
              Create wedding
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

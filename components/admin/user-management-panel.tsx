"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createUserAction,
  deactivateUserAction,
  deleteUserAction,
  restoreUserFromTrashFormAction,
  transferEventsAction,
  updateUserAction,
  type UserManageResult,
} from "@/lib/admin-user-management-actions";
import { formatAdminRoleLabel } from "@/lib/admin-roles";

export type UserRowSerialized = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  /** Events not yet in any wedding (the only events that still follow their creator). */
  _count: { events: number };
  weddingCount?: number;
  soleOwnerOf?: string[];
};

function SoleOwnerNotice({ user }: { user: UserRowSerialized }) {
  if (!user.soleOwnerOf?.length) return null;
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
      {user.name} is the only owner of {user.soleOwnerOf.map((n) => `"${n}"`).join(", ")}. Make another member an owner
      first, or this will be refused.
    </p>
  );
}

function WeddingAccessNote({ user }: { user: UserRowSerialized }) {
  const count = user.weddingCount ?? 0;
  if (count === 0) return null;
  return (
    <p className="text-sm text-zinc-600">
      {user.name} belongs to {count} wedding{count === 1 ? "" : "s"}. Those events stay with the wedding and its other
      members keep their access.
    </p>
  );
}

export type TrashUserRow = {
  id: string;
  name: string;
  role: string;
  deletedAt: string;
  eventsCount: number;
};

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e7dccb] bg-[#fffcf6] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-zinc-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-700">{messages[0]}</p>;
}

export function UserManagementPanel({
  initialUsers,
  trashUsers = [],
}: {
  initialUsers: UserRowSerialized[];
  trashUsers?: TrashUserRow[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRowSerialized | null>(null);
  const [transferUser, setTransferUser] = useState<UserRowSerialized | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserRowSerialized | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRowSerialized | null>(null);

  const [createState, createAction] = useActionState(createUserAction, undefined as UserManageResult | undefined);
  const [updateState, updateAction] = useActionState(updateUserAction, undefined as UserManageResult | undefined);
  const [transferState, transferAction] = useActionState(transferEventsAction, undefined as UserManageResult | undefined);
  const [deactivateState, deactivateAction] = useActionState(
    deactivateUserAction,
    undefined as UserManageResult | undefined,
  );
  const [deleteState, deleteAction] = useActionState(deleteUserAction, undefined as UserManageResult | undefined);

  useEffect(() => {
    if (createState?.ok) {
      router.refresh();
      setCreateOpen(false);
    }
  }, [createState, router]);

  useEffect(() => {
    if (updateState?.ok) {
      router.refresh();
      setEditUser(null);
    }
  }, [updateState, router]);

  useEffect(() => {
    if (transferState?.ok) {
      router.refresh();
      setTransferUser(null);
    }
  }, [transferState, router]);

  useEffect(() => {
    if (deactivateState?.ok) {
      router.refresh();
      setDeactivateUser(null);
    }
  }, [deactivateState, router]);

  useEffect(() => {
    if (deleteState?.ok) {
      router.refresh();
      setDeleteTarget(null);
    }
  }, [deleteState, router]);

  const activeUsers = useMemo(() => initialUsers.filter((u) => u.active), [initialUsers]);
  const totalEventsOwned = useMemo(
    () => initialUsers.reduce((sum, u) => sum + u._count.events, 0),
    [initialUsers],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-meta">
            {initialUsers.length} accounts · {activeUsers.length} active
            {totalEventsOwned > 0 ? ` · ${totalEventsOwned} events outside any wedding` : ""}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          Add user
        </button>
      </div>

      <div className="app-card overflow-hidden">
        <ul className="divide-y divide-[var(--border-soft)]">
          {initialUsers.map((u) => (
            <li
              key={u.id}
              className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${!u.active ? "bg-[var(--surface-muted)]" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-xs font-semibold text-white" aria-hidden>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-[var(--muted-text)]">
                      {formatAdminRoleLabel(u.role)}
                      {" · "}
                      {u.weddingCount ?? 0} {u.weddingCount === 1 ? "wedding" : "weddings"}
                      {u._count.events > 0 ? ` · ${u._count.events} event${u._count.events === 1 ? "" : "s"} outside a wedding` : ""}
                      {" · added "}
                      {new Date(u.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!u.active ? (
                    <span className="status status-muted">Inactive</span>
                  ) : (
                    <span className="status status-success">Active</span>
                  )}
                </div>
              </div>
              {u.active ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setEditUser(u)}>
                    Edit
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setTransferUser(u)}>
                    Transfer events
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setDeactivateUser(u)}>
                    Deactivate
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-[var(--danger)]"
                    onClick={() => setDeleteTarget(u)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {createOpen ? (
        <Modal title="Add user" onClose={() => setCreateOpen(false)}>
          <form action={createAction} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="create-name">
                Name
              </label>
              <input id="create-name" name="name" required className="input-luxe mt-1.5 w-full" placeholder="Unique display name" />
              <FieldError messages={createState && !createState.ok ? createState.fieldErrors?.name : undefined} />
            </div>
            <p className="rounded-xl border border-[#ebe4d6] bg-[#f9f4eb]/70 px-3 py-2 text-xs text-zinc-600">
              Password is auto-set to this user&apos;s lowercase first name (for example, Aisha → aisha).
            </p>
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="create-role">
                Role
              </label>
              <select id="create-role" name="role" className="input-luxe mt-1.5 w-full" required>
                <option value="event_creator">Event Creator</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            {createState && !createState.ok && createState.error ? (
              <p className="text-sm text-rose-700">{createState.error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editUser ? (
        <Modal title={`Edit ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="id" value={editUser.id} />
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="edit-name">
                Name
              </label>
              <input
                id="edit-name"
                name="name"
                required
                defaultValue={editUser.name}
                className="input-luxe mt-1.5 w-full"
              />
              <FieldError messages={updateState && !updateState.ok ? updateState.fieldErrors?.name : undefined} />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="edit-role">
                Role
              </label>
              <select
                id="edit-role"
                name="role"
                defaultValue={editUser.role}
                className="input-luxe mt-1.5 w-full"
                required
              >
                <option value="event_creator">Event Creator</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <p className="rounded-xl border border-[#ebe4d6] bg-[#f9f4eb]/70 px-3 py-2 text-xs text-zinc-600">
              Passwords use lowercase first-name format.
            </p>
            <button
              type="submit"
              name="resetPassword"
              value="1"
              className="btn-secondary mt-2 text-xs"
            >
              Reset password to lowercase first name
            </button>
            {updateState && !updateState.ok && updateState.error ? (
              <p className="text-sm text-rose-700">{updateState.error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditUser(null)}>
                Close
              </button>
              <button type="submit" className="btn-primary">
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {transferUser ? (
        <Modal title={`Transfer events from ${transferUser.name}`} onClose={() => setTransferUser(null)}>
          <form action={transferAction} className="space-y-4">
            <input type="hidden" name="fromUserId" value={transferUser.id} />
            <p className="text-sm text-zinc-600">
              {transferUser._count.events === 0
                ? `${transferUser.name} has no unassigned events to move.`
                : `Moves ${transferUser._count.events} unassigned event${transferUser._count.events === 1 ? "" : "s"} (not in any wedding) to the account you choose. Guests and RSVPs stay with each event.`}
            </p>
            <p className="text-sm text-zinc-600">
              This doesn&apos;t give anyone access to a wedding. To share a wedding, add the person as a member of that
              wedding instead.
            </p>
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="transfer-to">
                Destination user
              </label>
              <select id="transfer-to" name="toUserId" className="input-luxe mt-1.5 w-full" required>
                <option value="">Select…</option>
                {activeUsers
                  .filter((u) => u.id !== transferUser.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({formatAdminRoleLabel(u.role)})
                    </option>
                  ))}
              </select>
            </div>
            {transferState && !transferState.ok ? <p className="text-sm text-rose-700">{transferState.error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setTransferUser(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={transferUser._count.events === 0}>
                Move events
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deactivateUser ? (
        <Modal title={`Deactivate ${deactivateUser.name}`} onClose={() => setDeactivateUser(null)}>
          <form action={deactivateAction} className="space-y-4">
            <input type="hidden" name="userId" value={deactivateUser.id} />
            <p className="text-sm text-zinc-600">Inactive accounts can&apos;t sign in.</p>
            <WeddingAccessNote user={deactivateUser} />
            <SoleOwnerNotice user={deactivateUser} />
            {deactivateUser._count.events > 0 ? (
              <div>
                <label className="text-sm font-medium text-zinc-700" htmlFor="deactivate-transfer">
                  Move {deactivateUser._count.events} unassigned event{deactivateUser._count.events === 1 ? "" : "s"} to
                </label>
                <select
                  id="deactivate-transfer"
                  name="transferToUserId"
                  className="input-luxe mt-1.5 w-full"
                  required={deactivateUser._count.events > 0}
                >
                  <option value="">Select…</option>
                  {activeUsers
                    .filter((u) => u.id !== deactivateUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
            {deactivateState && !deactivateState.ok ? (
              <p className="text-sm text-rose-700">{deactivateState.error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setDeactivateUser(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Confirm deactivate
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {trashUsers.length > 0 ? (
        <div className="mt-8">
          <h2 className="section-heading">Deleted users</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Restoring an account lets it sign in again and brings back the unassigned events deleted with it.
          </p>
          <ul className="mt-4 divide-y divide-[#ebe4d6] rounded-2xl border border-[#ebe4d6]">
            {trashUsers.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatAdminRoleLabel(u.role)} · {u.eventsCount} event{u.eventsCount === 1 ? "" : "s"} · Deleted{" "}
                    {new Date(u.deletedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <form action={restoreUserFromTrashFormAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button type="submit" className="btn-secondary text-sm">
                    Restore user
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {deleteTarget ? (
        <Modal title={`Move ${deleteTarget.name} to trash?`} onClose={() => setDeleteTarget(null)}>
          <form action={deleteAction} className="space-y-4">
            <input type="hidden" name="userId" value={deleteTarget.id} />
            <p className="text-sm leading-relaxed text-zinc-700">
              This moves <span className="font-semibold text-zinc-900">{deleteTarget.name}</span> to trash
              {deleteTarget._count.events > 0
                ? `, along with ${deleteTarget._count.events} unassigned event${deleteTarget._count.events === 1 ? "" : "s"} only they can open`
                : ""}
              . Restoring the account brings those events back.
            </p>
            <WeddingAccessNote user={deleteTarget} />
            <SoleOwnerNotice user={deleteTarget} />
            <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5 text-sm text-rose-950">
              <input type="checkbox" name="confirmDelete" value="1" className="mt-0.5 h-4 w-4 rounded border-rose-300" required />
              <span>I understand this account will be hidden until restored from trash.</span>
            </label>
            {deleteTarget.role === "super_admin" ? (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" name="allowSuperAdminDelete" value="1" />
                I understand this deletes a super admin account.
              </label>
            ) : null}
            {deleteState && !deleteState.ok ? <p className="text-sm text-rose-700">{deleteState.error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-danger px-4 py-2 text-sm font-semibold">
                Move user to trash
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

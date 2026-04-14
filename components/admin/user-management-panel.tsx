"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createUserAction,
  deactivateUserAction,
  deleteUserAction,
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
  _count: { events: number };
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

export function UserManagementPanel({ initialUsers }: { initialUsers: UserRowSerialized[] }) {
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
      <div className="app-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-title">Super admin</p>
            <h1 className="headline-display mt-2">User management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
              Add, edit, and safely deactivate team accounts. Event ownership can be transferred before removing access.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            Add user
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#ebe4d6] bg-[#f9f4eb]/80 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total users</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{initialUsers.length}</p>
          </div>
          <div className="rounded-2xl border border-[#ebe4d6] bg-[#f9f4eb]/80 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{activeUsers.length}</p>
          </div>
          <div className="rounded-2xl border border-[#ebe4d6] bg-[#f9f4eb]/80 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Events (all)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{totalEventsOwned}</p>
          </div>
        </div>
      </div>

      <div className="app-card p-0">
        <div className="border-b border-[#ebe4d6] px-5 py-4 sm:px-6">
          <p className="section-title">Directory</p>
          <p className="mt-1 text-sm text-zinc-600">Names and roles come from the database and power the sign-in list.</p>
        </div>
        <ul className="divide-y divide-[#ebe4d6]">
          {initialUsers.map((u) => (
            <li
              key={u.id}
              className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${!u.active ? "bg-zinc-50/80" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#c9a66b]/90 to-[#8b6914]/90 text-sm font-semibold text-white">
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900">{u.name}</p>
                    <p className="text-sm text-zinc-600">
                      {formatAdminRoleLabel(u.role)}
                      {" · "}
                      {u._count.events} event{u._count.events === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Added {new Date(u.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!u.active ? (
                    <span className="inline-flex rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                      Inactive
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      Active
                    </span>
                  )}
                </div>
              </div>
              {u.active ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setEditUser(u)}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => setTransferUser(u)}>
                    Transfer events
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => setDeactivateUser(u)}>
                    Deactivate
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 transition hover:bg-rose-100"
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
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="create-password">
                Password
              </label>
              <input
                id="create-password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="input-luxe mt-1.5 w-full"
                placeholder="At least 8 characters"
              />
              <FieldError messages={createState && !createState.ok ? createState.fieldErrors?.password : undefined} />
            </div>
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
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="edit-password">
                New password (optional)
              </label>
              <input
                id="edit-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                className="input-luxe mt-1.5 w-full"
                placeholder="Leave blank to keep current"
              />
              <FieldError messages={updateState && !updateState.ok ? updateState.fieldErrors?.newPassword : undefined} />
            </div>
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
              Moves all events owned by this user to another active account. Guests, RSVPs, and images stay with each
              event.
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
              <button type="submit" className="btn-primary">
                Transfer all
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deactivateUser ? (
        <Modal title={`Deactivate ${deactivateUser.name}`} onClose={() => setDeactivateUser(null)}>
          <form action={deactivateAction} className="space-y-4">
            <input type="hidden" name="userId" value={deactivateUser.id} />
            <p className="text-sm text-zinc-600">
              Inactive users cannot sign in. If this user still owns events, pick who should receive them first.
            </p>
            {deactivateUser._count.events > 0 ? (
              <div>
                <label className="text-sm font-medium text-zinc-700" htmlFor="deactivate-transfer">
                  Transfer {deactivateUser._count.events} event{deactivateUser._count.events === 1 ? "" : "s"} to
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

      {deleteTarget ? (
        <Modal title={`Delete ${deleteTarget.name}?`} onClose={() => setDeleteTarget(null)}>
          <form action={deleteAction} className="space-y-4">
            <input type="hidden" name="userId" value={deleteTarget.id} />
            <p className="text-sm text-zinc-600">
              Deleting removes the account from the database permanently. Only allowed when the user owns no events.
            </p>
            {deleteState && !deleteState.ok ? <p className="text-sm text-rose-700">{deleteState.error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                Delete user
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

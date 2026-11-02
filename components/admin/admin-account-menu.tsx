"use client";

import { LogOut } from "lucide-react";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { formatAdminRoleLabel } from "@/lib/admin-roles";
import { Menu } from "@/components/admin/ui/menu";

type AdminUserChip = {
  name: string;
  role: string;
};

export function AdminAccountMenu({
  user,
  placement = "bottom-end",
  showName = false,
}: {
  user: AdminUserChip;
  placement?: "bottom-end" | "top-start";
  showName?: boolean;
}) {
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <Menu
      label={`Account: ${user.name}`}
      placement={placement}
      panelClassName="w-64"
      summaryClassName={`flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 text-left transition-colors hover:bg-[var(--surface-muted)] sm:min-h-10 ${showName ? "w-full" : ""}`}
      className={showName ? "w-full" : ""}
      trigger={
        <>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-xs font-semibold text-white" aria-hidden>
            {initial}
          </span>
          {showName ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-[var(--muted-text)]">{formatAdminRoleLabel(user.role)}</span>
            </span>
          ) : null}
        </>
      }
    >
      <div className="px-2.5 py-2">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-xs text-[var(--muted-text)]">{formatAdminRoleLabel(user.role)}</p>
      </div>
      <div className="my-1 h-px bg-[var(--border-soft)]" role="separator" />
      <form action={logoutAdminAction}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-[var(--surface-muted)] sm:min-h-9"
        >
          <LogOut className="h-4 w-4 text-[var(--muted-text)]" aria-hidden />
          Sign out
        </button>
      </form>
    </Menu>
  );
}

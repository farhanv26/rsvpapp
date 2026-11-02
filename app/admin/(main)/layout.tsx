import { AdminShell } from "@/components/admin/admin-shell";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { resolveActiveWorkspace } from "@/lib/wedding-access";
import { buildWorkspaceSwitcherOptions, workspaceScopeValue } from "@/lib/wedding-policy";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wedding planner" };

export default async function AdminMainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentAdminUser();
  const workspace = await resolveActiveWorkspace(user);
  const switcher = {
    value: workspaceScopeValue(workspace.scope),
    options: buildWorkspaceSwitcherOptions({
      actor: user,
      weddings: workspace.weddings,
      hasUnassignedEvents: workspace.hasUnassignedEvents,
    }),
  };
  return (
    <AdminShell user={user} switcher={switcher}>
      {children}
    </AdminShell>
  );
}

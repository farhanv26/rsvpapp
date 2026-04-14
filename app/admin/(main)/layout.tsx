import { AdminShell } from "@/components/admin/admin-shell";
import { requireCurrentAdminUser } from "@/lib/admin-auth";

export default async function AdminMainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentAdminUser();
  return <AdminShell user={user}>{children}</AdminShell>;
}

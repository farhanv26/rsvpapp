import { UserManagementPanel, type UserRowSerialized } from "@/components/admin/user-management-panel";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
  });
  const initialUsers: UserRowSerialized[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    _count: { events: u._count.events },
  }));

  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-8">
        <UserManagementPanel initialUsers={initialUsers} />
      </div>
    </main>
  );
}

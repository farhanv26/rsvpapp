import { UserManagementPanel, type UserRowSerialized } from "@/components/admin/user-management-panel";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { events: { where: { deletedAt: null } } } },
    },
  });
  const deletedUsers = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 40,
    select: {
      id: true,
      name: true,
      role: true,
      deletedAt: true,
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
  const trashUsers = deletedUsers.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    deletedAt: u.deletedAt!.toISOString(),
    eventsCount: u._count.events,
  }));

  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-8">
        <UserManagementPanel initialUsers={initialUsers} trashUsers={trashUsers} />
      </div>
    </main>
  );
}

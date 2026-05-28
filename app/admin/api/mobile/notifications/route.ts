import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileAdminUser, isMobileSuperAdmin, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const admin = await getMobileAdminUser(req);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const takeRaw = Number(searchParams.get("take") || "20");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(50, takeRaw)) : 20;
  const where = isMobileSuperAdmin(admin) ? undefined : { userId: admin.id };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        entityType: true,
        entityId: true,
        eventId: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { ...(where ?? {}), read: false },
    }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    unreadCount,
  });
}

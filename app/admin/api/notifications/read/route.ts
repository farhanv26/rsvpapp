import { NextResponse } from "next/server";
import { getCurrentAdminUserFromApi } from "@/lib/admin-api-auth";
import { isSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const admin = await getCurrentAdminUserFromApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean };
  const canSeeAll = isSuperAdmin(admin);

  if (body.all) {
    await prisma.notification.updateMany({
      where: canSeeAll ? { read: false } : { userId: admin.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  const target = await prisma.notification.findUnique({
    where: { id: body.id },
    select: { id: true, userId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
  if (!canSeeAll && target.userId !== admin.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.notification.update({
    where: { id: target.id },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}

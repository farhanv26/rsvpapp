import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileAdminUser, isMobileSuperAdmin, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const admin = await getMobileAdminUser(req);
  if (!admin) return unauthorizedResponse();

  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  const canSeeAll = isMobileSuperAdmin(admin);

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

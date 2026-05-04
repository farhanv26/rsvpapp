import type { NextRequest } from "next/server";
import { getMobileAdminUser, isMobileSuperAdmin, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** GET /admin/api/mobile/events */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const where = {
    deletedAt: null,
    ...(isMobileSuperAdmin(user) ? {} : { ownerUserId: user.id }),
  };

  try {
    const events = await withReconnect(() =>
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          coupleNames: true,
          eventDate: true,
          venue: true,
          theme: true,
          imagePath: true,
          createdAt: true,
          _count: { select: { guests: { where: { deletedAt: null } } } },
        },
      })
    );

    return Response.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        coupleNames: e.coupleNames,
        eventDate: e.eventDate?.toISOString() ?? null,
        venue: e.venue,
        theme: e.theme,
        imagePath: e.imagePath ?? null,
        createdAt: e.createdAt.toISOString(),
        guestCount: e._count.guests,
      })),
    });
  } catch (err) {
    console.error("[mobile/events GET]", err);
    return Response.json({ error: "Failed to load events" }, { status: 500 });
  }
}

/** POST /admin/api/mobile/events */
export async function POST(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title as string | undefined)?.trim();
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  try {
    const baseSlug = slugify(title);
    const slugCandidate = baseSlug || `event-${Date.now()}`;

    const event = await withReconnect(async () => {
      const existing = await prisma.event.findFirst({ where: { slug: slugCandidate } });
      const slug = existing ? `${slugCandidate}-${Date.now().toString(36)}` : slugCandidate;
      return prisma.event.create({
        data: {
          title,
          slug,
          ownerUserId: user.id,
          coupleNames: (body.coupleNames as string | undefined)?.trim() || null,
          venue: (body.venue as string | undefined)?.trim() || null,
          eventDate: body.eventDate ? new Date(body.eventDate as string) : null,
          rsvpDeadline: body.rsvpDeadline ? new Date(body.rsvpDeadline as string) : null,
        },
        select: { id: true, title: true, slug: true },
      });
    });

    return Response.json({ event }, { status: 201 });
  } catch (err) {
    console.error("[mobile/events POST]", err);
    return Response.json({ error: "Failed to create event" }, { status: 500 });
  }
}

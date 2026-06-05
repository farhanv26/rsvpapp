import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/utils";

/** GET /admin/api/mobile/events/[eventId]/preview-url — returns a time-limited preview URL for the RSVP page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await withReconnect(() =>
    prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    }),
  );

  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  // Extract the raw Bearer token so the preview page can validate it directly
  const auth = req.headers.get("Authorization") ?? "";
  const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  const siteUrl = getPublicSiteUrl() ?? "https://farhanrafiya.vercel.app";
  const previewUrl = bearerToken
    ? `${siteUrl}/rsvp/preview/${eventId}?mt=${encodeURIComponent(bearerToken)}`
    : `${siteUrl}/rsvp/preview/${eventId}`;

  return Response.json({ previewUrl });
}

import type { NextRequest } from "next/server";
import { authorizeMobileEvent, getMobileAdminUser, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { getPublicSiteUrl } from "@/lib/utils";
import { createEventPreviewToken, PREVIEW_TOKEN_TTL_SECONDS } from "@/lib/preview-token";

/** GET /admin/api/mobile/events/[eventId]/preview-url — returns a time-limited preview URL for the RSVP page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const authz = await authorizeMobileEvent(user, eventId);
  if (authz.error) return authz.error;

  // Never put the login token in a URL: issue a 10-minute, single-event preview grant instead.
  const previewToken = await createEventPreviewToken({ userId: user.id, eventId });
  const siteUrl = getPublicSiteUrl() || new URL(req.url).origin;
  const previewUrl = `${siteUrl}/rsvp/preview/${eventId}?pt=${encodeURIComponent(previewToken)}`;

  return Response.json({ previewUrl, expiresInSeconds: PREVIEW_TOKEN_TTL_SECONDS });
}

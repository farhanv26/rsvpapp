import type { NextRequest } from "next/server";
import { getMobileAdminUser, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { withReconnect } from "@/lib/prisma";
import { hasUnassignedEvents, listWorkspaceOptions } from "@/lib/wedding-access";

/** GET /admin/api/mobile/weddings — weddings the user can choose when listing or creating events. */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();
  const [weddings, legacy] = await withReconnect(() => Promise.all([listWorkspaceOptions(user), hasUnassignedEvents(user)]));
  return Response.json({
    weddings: weddings.map((w) => ({ id: w.id, name: w.name, role: w.role })),
    hasUnassignedEvents: legacy,
  });
}

import "server-only";

import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspace } from "@/lib/wedding-access";
import { canManageWeddingMembers } from "@/lib/wedding-policy";

/** Loads the signed-in user and the active wedding for a planning page (null when none is selected). */
export async function loadPlanningPage() {
  const admin = await requireCurrentAdminUser();
  const workspace = await resolveActiveWorkspace(admin);
  const wedding = workspace.activeWedding
    ? await prisma.wedding.findUnique({
        where: { id: workspace.activeWedding.id },
        select: { id: true, name: true, currency: true, plannedBudgetMinor: true, timezone: true, defaultGreeting: true },
      })
    : null;
  return {
    admin,
    workspace,
    wedding,
    isOwner: wedding ? canManageWeddingMembers(admin, workspace.activeWedding?.role) : false,
  };
}

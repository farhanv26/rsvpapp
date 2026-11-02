"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getWeddingAccess } from "@/lib/wedding-access";

function back(path: string, params: Record<string, string>): never {
  revalidatePath(path);
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

/** Budget, vendors and settings follow wedding membership (independent of per-event guest roles). */
async function memberContext(formData: FormData, path: string, require: "member" | "owner" = "member") {
  const admin = await requireCurrentAdminUser();
  const weddingId = String(formData.get("weddingId") ?? "");
  const access = await getWeddingAccess(admin, weddingId, { require });
  if (access.status !== "ok") back(path, { error: require === "owner" ? "Only wedding owners can change settings." : "You can't edit this wedding." });
  const wedding = await prisma.wedding.findUniqueOrThrow({ where: { id: weddingId }, select: { id: true, name: true, currency: true } });
  return { admin, wedding };
}

function text(formData: FormData, key: string, max = 200): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

export async function saveWeddingSettingsAction(formData: FormData) {
  const path = "/admin/settings";
  const { admin, wedding } = await memberContext(formData, path, "owner");
  const name = text(formData, "name", 120);
  if (!name) back(path, { error: "The wedding needs a name." });
  const currency = String(formData.get("currency") ?? wedding.currency).toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) back(path, { error: "Choose a supported currency." });
  const timezone = text(formData, "timezone", 64);
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      back(path, { error: "Choose a valid timezone." });
    }
  }
  if (currency !== wedding.currency) {
    const amounts = await prisma.budgetItem.count({ where: { weddingId: wedding.id } });
    const quotedVendors = await prisma.vendor.count({ where: { weddingId: wedding.id, quoteMinor: { not: null } } });
    const configuredBudget = await prisma.wedding.findUnique({ where: { id: wedding.id }, select: { plannedBudgetMinor: true } });
    if (amounts > 0 || quotedVendors > 0 || configuredBudget?.plannedBudgetMinor !== null) back(path, { error: "Currency can't change once budget lines exist; amounts would be misread." });
  }
  await prisma.wedding.update({
    where: { id: wedding.id },
    data: { name, currency, timezone, defaultGreeting: text(formData, "defaultGreeting", 80) },
  });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "wedding_settings_updated",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: name,
    message: `${admin.name} updated settings for "${name}".`,
  });
  back(path, { saved: "Settings saved." });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { parseMoneyToMinor, SUPPORTED_CURRENCIES } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getWeddingAccess } from "@/lib/wedding-access";

const VENDOR_STATUSES = ["considering", "quoted", "booked", "declined"] as const;

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

function optionalMoney(formData: FormData, key: string, currency: string, path: string, label: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const minor = parseMoneyToMinor(raw, currency);
  if (minor === null) back(path, { error: `${label}: enter an amount like 1250 or 1,250.50.` });
  return minor;
}

async function eventInWedding(weddingId: string, eventId: string | null, path: string) {
  if (!eventId) return null;
  const ev = await prisma.event.findFirst({ where: { id: eventId, weddingId, deletedAt: null }, select: { id: true } });
  if (!ev) back(path, { error: "That event isn't part of this wedding." });
  return ev.id;
}

async function vendorInWedding(weddingId: string, vendorId: string | null, path: string) {
  if (!vendorId) return null;
  const v = await prisma.vendor.findFirst({ where: { id: vendorId, weddingId, deletedAt: null }, select: { id: true } });
  if (!v) back(path, { error: "That vendor isn't part of this wedding." });
  return v.id;
}

function budgetFields(formData: FormData, currency: string, path: string) {
  const label = text(formData, "label", 120);
  if (!label) back(path, { error: "Give the expense a name." });
  const perPersonMinor = optionalMoney(formData, "perPerson", currency, path, "Per-person estimate");
  const basis = String(formData.get("perPersonBasis") ?? "invited") === "confirmed" ? "confirmed" : "invited";
  const due = String(formData.get("nextPaymentDueAt") ?? "").trim();
  const dueDate = due ? new Date(`${due}T12:00:00Z`) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) back(path, { error: "Enter a valid due date." });
  return {
    label,
    category: text(formData, "category", 60) ?? "Other",
    estimateMinor: optionalMoney(formData, "estimate", currency, path, "Estimate") ?? 0,
    agreedMinor: optionalMoney(formData, "agreed", currency, path, "Agreed price"),
    perPersonMinor,
    perPersonBasis: perPersonMinor !== null ? basis : null,
    nextPaymentDueAt: dueDate,
    notes: text(formData, "notes", 1000),
  };
}

export async function saveBudgetItemAction(formData: FormData) {
  const path = "/admin/budget";
  const { admin, wedding } = await memberContext(formData, path);
  const fields = budgetFields(formData, wedding.currency, path);
  const eventId = await eventInWedding(wedding.id, text(formData, "eventId", 40), path);
  if (fields.perPersonMinor !== null && !eventId) back(path, { error: "Per-person estimates need an event, so the right headcount is used." });
  const vendorId = await vendorInWedding(wedding.id, text(formData, "vendorId", 40), path);
  const itemId = text(formData, "itemId", 40);
  if (itemId) {
    const updated = await prisma.budgetItem.updateMany({ where: { id: itemId, weddingId: wedding.id, deletedAt: null }, data: { ...fields, eventId, vendorId } });
    if (updated.count === 0) back(path, { error: "That expense no longer exists." });
  } else {
    await prisma.budgetItem.create({ data: { ...fields, eventId, vendorId, weddingId: wedding.id } });
  }
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: itemId ? "budget_item_updated" : "budget_item_created",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: fields.label,
    message: `${admin.name} ${itemId ? "updated" : "added"} budget line "${fields.label}".`,
  });
  back(path, { saved: itemId ? "Expense updated." : "Expense added." });
}

export async function deleteBudgetItemAction(formData: FormData) {
  const path = "/admin/budget";
  const { wedding } = await memberContext(formData, path);
  const itemId = text(formData, "itemId", 40) ?? "";
  await prisma.budgetItem.updateMany({ where: { id: itemId, weddingId: wedding.id, deletedAt: null }, data: { deletedAt: new Date() } });
  back(path, { saved: "Expense removed." });
}

export async function recordPaymentAction(formData: FormData) {
  const path = "/admin/budget";
  const { admin, wedding } = await memberContext(formData, path);
  const itemId = text(formData, "itemId", 40) ?? "";
  const item = await prisma.budgetItem.findFirst({ where: { id: itemId, weddingId: wedding.id, deletedAt: null }, select: { id: true, label: true } });
  if (!item) back(path, { error: "That expense no longer exists." });
  const amountMinor = parseMoneyToMinor(String(formData.get("amount") ?? ""), wedding.currency);
  if (!amountMinor) back(path, { error: "Payment: enter an amount above zero." });
  const paid = String(formData.get("paidAt") ?? "").trim();
  const paidAt = paid ? new Date(`${paid}T12:00:00Z`) : new Date();
  if (Number.isNaN(paidAt.getTime())) back(path, { error: "Enter a valid payment date." });
  await prisma.budgetPayment.create({ data: { budgetItemId: item.id, amountMinor, paidAt, note: text(formData, "note", 200) } });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "budget_payment_recorded",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: item.label,
    message: `${admin.name} recorded a payment for "${item.label}".`,
  });
  back(path, { saved: "Payment recorded." });
}

export async function deletePaymentAction(formData: FormData) {
  const path = "/admin/budget";
  const { wedding } = await memberContext(formData, path);
  const paymentId = text(formData, "paymentId", 40) ?? "";
  await prisma.budgetPayment.deleteMany({ where: { id: paymentId, budgetItem: { weddingId: wedding.id } } });
  back(path, { saved: "Payment removed." });
}

export async function saveVendorAction(formData: FormData) {
  const path = "/admin/vendors";
  const { admin, wedding } = await memberContext(formData, path);
  const name = text(formData, "name", 120);
  if (!name) back(path, { error: "Give the vendor a name." });
  const status = String(formData.get("status") ?? "considering");
  if (!(VENDOR_STATUSES as readonly string[]).includes(status)) back(path, { error: "Choose a status." });
  const email = text(formData, "email", 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back(path, { error: "That email address doesn't look right." });
  const data = {
    name,
    category: text(formData, "category", 60) ?? "Other",
    contactName: text(formData, "contactName", 120),
    email,
    phone: text(formData, "phone", 40),
    website: text(formData, "website", 200),
    status,
    quoteMinor: optionalMoney(formData, "quote", wedding.currency, path, "Quote"),
    notes: text(formData, "notes", 2000),
  };
  const vendorId = text(formData, "vendorId", 40);
  if (vendorId) {
    const updated = await prisma.vendor.updateMany({ where: { id: vendorId, weddingId: wedding.id, deletedAt: null }, data });
    if (updated.count === 0) back(path, { error: "That vendor no longer exists." });
  } else {
    await prisma.vendor.create({ data: { ...data, weddingId: wedding.id } });
  }
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: vendorId ? "vendor_updated" : "vendor_created",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: name,
    message: `${admin.name} ${vendorId ? "updated" : "added"} vendor "${name}".`,
  });
  back(path, { saved: vendorId ? "Vendor updated." : "Vendor added." });
}

export async function deleteVendorAction(formData: FormData) {
  const path = "/admin/vendors";
  const { wedding } = await memberContext(formData, path);
  const vendorId = text(formData, "vendorId", 40) ?? "";
  await prisma.vendor.updateMany({ where: { id: vendorId, weddingId: wedding.id, deletedAt: null }, data: { deletedAt: new Date() } });
  back(path, { saved: "Vendor removed. Its budget lines were kept." });
}

/** Creates one budget line for a vendor (once): the vendor's cost then lives only in the budget. */
export async function addVendorToBudgetAction(formData: FormData) {
  const path = "/admin/vendors";
  const { wedding } = await memberContext(formData, path);
  const vendorId = text(formData, "vendorId", 40) ?? "";
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, weddingId: wedding.id, deletedAt: null },
    select: { id: true, name: true, category: true, status: true, quoteMinor: true, _count: { select: { budgetItems: { where: { deletedAt: null } } } } },
  });
  if (!vendor) back(path, { error: "That vendor no longer exists." });
  if (vendor._count.budgetItems > 0) back(path, { error: `${vendor.name} is already in the budget.` });
  await prisma.budgetItem.create({
    data: {
      weddingId: wedding.id,
      vendorId: vendor.id,
      label: vendor.name,
      category: vendor.category,
      estimateMinor: vendor.quoteMinor ?? 0,
      agreedMinor: vendor.status === "booked" ? vendor.quoteMinor : null,
    },
  });
  back(path, { saved: `${vendor.name} was added to the budget.` });
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
    const amounts = await prisma.budgetItem.count({ where: { weddingId: wedding.id, deletedAt: null } });
    if (amounts > 0) back(path, { error: "Currency can't change once budget lines exist; amounts would be misread." });
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

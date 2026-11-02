// @vitest-environment node
/**
 * Per-event contributor allowances against a real, disposable Postgres database.
 * Skipped unless WEDDING_TEST_DATABASE_URL points at a localhost database whose name contains "test".
 * Fictional people: Farhan organizes the reception and gives Rafiya 75 places.
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => {
  const url = process.env.WEDDING_TEST_DATABASE_URL ?? "";
  let enabled = false;
  try {
    const parsed = new URL(url);
    enabled = ["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.pathname.includes("test");
  } catch {
    enabled = false;
  }
  process.env.DATABASE_URL = enabled ? url : "postgresql://disabled@127.0.0.1:1/disabled_test";
  process.env.ADMIN_AUTH_SECRET = "integration-test-secret-0123456789";
  delete process.env.RESEND_API_KEY;
  return { enabled };
});

const auth = vi.hoisted(() => ({ actor: null as null | { id: string; name: string; role: string } }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: vi.fn() }) }));
vi.mock("@/lib/rsvp-email", () => ({
  sendEventOwnerNotificationEmail: vi.fn(async () => undefined),
  sendRsvpNotificationEmail: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireCurrentAdminUser: async () => {
    if (!auth.actor) throw new Error("REDIRECT:/admin/login");
    return auth.actor;
  },
  getOptionalAdminUser: async () => auth.actor,
  isSuperAdmin: (u: { role: string }) => u.role === "super_admin",
  requireSuperAdmin: async () => auth.actor,
}));
vi.mock("@/lib/admin-api-auth", () => ({ getCurrentAdminUserFromApi: async () => auth.actor }));

import { prisma } from "@/lib/prisma";
import { createAdminSessionToken } from "@/lib/admin-session";
import {
  bulkDeleteGuestsAction,
  createGuestAction,
  deleteGuestAction,
  restoreGuestAction,
  updateEventAction,
  updateGuestAction,
} from "@/app/admin/events/actions";
import { importGuestCsvRowsAction } from "@/app/admin/events/csv-import-actions";
import {
  releaseGuestPlacesAction,
  setEventGuestRoleAction,
  setGuestAllowanceAction,
} from "@/app/admin/events/guest-list-actions";
import { submitRsvpAction } from "@/app/rsvp/[token]/actions";
import { GET as listMobileGuests, POST as createMobileGuest } from "@/app/admin/api/mobile/events/[eventId]/guests/route";
import { PUT as putMobileGuest } from "@/app/admin/api/mobile/events/[eventId]/guests/[guestId]/route";
import { POST as bulkMobileGuests } from "@/app/admin/api/mobile/events/[eventId]/guests/bulk/route";
import { PUT as putMobileEvent } from "@/app/admin/api/mobile/events/[eventId]/route";

type Actor = { id: string; name: string; role: string };
const farhan: Actor = { id: "ga_farhan", name: "GA Farhan", role: "event_creator" };
const rafiya: Actor = { id: "ga_rafiya", name: "GA Rafiya", role: "event_creator" };
const W = "ga_wedding";
const E = "ga_reception";

function as(actor: Actor | null) {
  auth.actor = actor;
}
function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
async function mobile(actor: Actor, path: string, init: { method?: string; body?: unknown } = {}) {
  const token = await createAdminSessionToken({ userId: actor.id, name: actor.name, userRole: "event_creator" });
  return new NextRequest(`http://localhost/admin/api/mobile${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const household = (name: string, men: number, women = 0, kids = 0) =>
  form({ eventId: E, guestName: name, menCount: String(men), womenCount: String(women), kidsCount: String(kids) });

async function rafiyaUsed() {
  const rows = await prisma.guest.findMany({
    where: { eventId: E, deletedAt: null, allocation: { userId: rafiya.id } },
    select: { maxGuests: true, menCount: true, womenCount: true, kidsCount: true },
  });
  return rows.reduce((s, g) => s + Math.max(g.maxGuests, g.menCount + g.womenCount + g.kidsCount), 0);
}
async function expectRedirect(p: Promise<unknown>, contains: string) {
  await expect(p).rejects.toThrow(new RegExp(`REDIRECT:.*${contains}`));
}

describe.skipIf(!env.enabled)("per-event guest allowances (real Postgres)", () => {
  let farhanGuestId = "";

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "EventAllocation","EventRole","WeddingMembership","Wedding","GuestCommunicationLog","RsvpActivity","Guest","Notification","AuditActivity","Event","User" CASCADE`,
    );
    await prisma.user.createMany({
      data: [farhan, rafiya].map((p) => ({ id: p.id, name: p.name, role: p.role, passwordHash: "x", active: true })),
    });
    await prisma.wedding.create({
      data: {
        id: W,
        name: "Farhan & Rafiya (test)",
        memberships: { create: [{ userId: farhan.id, role: "owner" }, { userId: rafiya.id, role: "owner" }] },
      },
    });
    await prisma.event.create({ data: { id: E, title: "Reception", slug: "ga-reception", weddingId: W, ownerUserId: farhan.id } });
    as(farhan);
    await createGuestAction(household("The Ahmed Family", 2, 2));
    farhanGuestId = (await prisma.guest.findFirstOrThrow({ where: { eventId: E, guestName: "The Ahmed Family" } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("before any roles are set, every member keeps full guest editing (no inferred managers)", async () => {
    as(rafiya);
    await updateGuestAction(form({ eventId: E, guestId: farhanGuestId, guestName: "The Ahmed Family", menCount: "2", womenCount: "3", kidsCount: "0" }));
    const g = await prisma.guest.findUniqueOrThrow({ where: { id: farhanGuestId } });
    expect(g.womenCount).toBe(3);
    expect(g.allocationId).toBeNull();
  });

  it("organizer sets Rafiya as contributor with 75 places; she cannot change her own allowance or role", async () => {
    as(farhan);
    await expectRedirect(setEventGuestRoleAction(form({ eventId: E, userId: rafiya.id, role: "contributor" })), "gl_ok");
    await expectRedirect(setGuestAllowanceAction(form({ eventId: E, userId: rafiya.id, places: "75" })), "gl_ok");

    as(rafiya);
    await expectRedirect(setGuestAllowanceAction(form({ eventId: E, userId: rafiya.id, places: "200" })), "gl_error");
    await expectRedirect(setEventGuestRoleAction(form({ eventId: E, userId: rafiya.id, role: "none" })), "gl_error");
    expect((await prisma.eventAllocation.findFirstOrThrow({ where: { eventId: E, userId: rafiya.id } })).places).toBe(75);
  });

  it("Rafiya can allocate exactly 75 places (CSV + web + mobile, children and reserved seats included)", async () => {
    as(rafiya);
    const rows = Array.from({ length: 13 }, (_, i) => ({ guestName: `CSV Household ${i + 1}`, menCount: 2, womenCount: 2, kidsCount: 1 }));
    const imported = await importGuestCsvRowsAction(E, rows);
    expect(imported).toMatchObject({ error: null, created: 13 });
    expect(await rafiyaUsed()).toBe(65);

    await createGuestAction(household("The Khan Family", 2, 2, 1));
    const res = await createMobileGuest(
      await mobile(rafiya, `/events/${E}/guests`, { method: "POST", body: { guestName: "The Siddiqui Family", menCount: 2, womenCount: 1, maxGuests: 5 } }),
      params({ eventId: E }),
    );
    expect(res.status).toBe(201);
    expect(await rafiyaUsed()).toBe(75);
  });

  it("the 76th place is refused through every route", async () => {
    as(rafiya);
    await expect(createGuestAction(household("One More", 1))).rejects.toThrow(/used up/);
    expect(await importGuestCsvRowsAction(E, [{ guestName: "CSV Extra", menCount: 1 }])).toMatchObject({ created: 0, error: expect.stringMatching(/used up/) });
    const mobileCreate = await createMobileGuest(
      await mobile(rafiya, `/events/${E}/guests`, { method: "POST", body: { guestName: "Mobile Extra", menCount: 1 } }),
      params({ eventId: E }),
    );
    expect(mobileCreate.status).toBe(409);
    expect((await mobileCreate.json()).code).toBe("allowance_exceeded");

    const khan = await prisma.guest.findFirstOrThrow({ where: { eventId: E, guestName: "The Khan Family" } });
    await expect(
      updateGuestAction(form({ eventId: E, guestId: khan.id, guestName: "The Khan Family", menCount: "3", womenCount: "2", kidsCount: "1" })),
    ).rejects.toThrow(/used up|left/);
    const mobileEdit = await putMobileGuest(
      await mobile(rafiya, `/events/${E}/guests/${khan.id}`, { method: "PUT", body: { maxGuests: 6 } }),
      params({ eventId: E, guestId: khan.id }),
    );
    expect(mobileEdit!.status).toBe(409);

    // Deleting frees places; re-adding fills them; restoring the deleted household would exceed → refused.
    await deleteGuestAction(form({ eventId: E, guestId: khan.id }));
    await createGuestAction(household("The Rahman Family", 5));
    await expectRedirect(restoreGuestAction(form({ eventId: E, guestId: khan.id })), "restore=guest_allowance");
    expect(await rafiyaUsed()).toBe(75);
  });

  it("Rafiya cannot see or edit Farhan's households or the event settings", async () => {
    as(rafiya);
    await expect(
      updateGuestAction(form({ eventId: E, guestId: farhanGuestId, guestName: "Hijack", menCount: "1", womenCount: "0", kidsCount: "0" })),
    ).rejects.toThrow(/not found/i);
    await bulkDeleteGuestsAction(form({ eventId: E, guestIds: farhanGuestId }));
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: farhanGuestId } })).deletedAt).toBeNull();
    const mobileEdit = await putMobileGuest(
      await mobile(rafiya, `/events/${E}/guests/${farhanGuestId}`, { method: "PUT", body: { notes: "x" } }),
      params({ eventId: E, guestId: farhanGuestId }),
    );
    expect(mobileEdit!.status).toBe(404);
    const mobileBulk = await bulkMobileGuests(
      await mobile(rafiya, `/events/${E}/guests/bulk`, { method: "POST", body: { action: "delete", guestIds: [farhanGuestId] } }),
      params({ eventId: E }),
    );
    expect(mobileBulk.status).toBe(404);

    const list = await (await listMobileGuests(await mobile(rafiya, `/events/${E}/guests?limit=200`), params({ eventId: E }))).json();
    expect(list.guests.some((g: { id: string }) => g.id === farhanGuestId)).toBe(false);

    await expect(
      updateEventAction(form({ eventId: E, title: "Renamed", theme: "modern", eventDate: "2099-06-01", rsvpDeadline: "2099-05-01", eventTime: "18:00" })),
    ).rejects.toThrow(/organizers/);
    expect((await putMobileEvent(await mobile(rafiya, `/events/${E}`, { method: "PUT", body: { title: "Renamed" } }), params({ eventId: E }))).status).toBe(403);
  });

  it("Farhan sees the combined list, cannot shrink below usage, and must explicitly release declined places", async () => {
    const list = await (await listMobileGuests(await mobile(farhan, `/events/${E}/guests?limit=200`), params({ eventId: E }))).json();
    // Ahmed (Farhan's) + 13 imported + Siddiqui + Rahman; Khan was deleted above.
    expect(list.pagination.total).toBe(1 + 13 + 1 + 1);

    as(farhan);
    await expectRedirect(setGuestAllowanceAction(form({ eventId: E, userId: rafiya.id, places: "70" })), "gl_error");

    const rahman = await prisma.guest.findFirstOrThrow({ where: { eventId: E, guestName: "The Rahman Family" } });
    as(null);
    await submitRsvpAction(form({ token: rahman.token, attending: "no" }));
    expect(await rafiyaUsed()).toBe(75);
    as(rafiya);
    await expect(createGuestAction(household("After Decline", 1))).rejects.toThrow(/used up/);

    as(farhan);
    await expectRedirect(releaseGuestPlacesAction(form({ eventId: E, guestId: rahman.id })), "gl_ok");
    as(rafiya);
    await createGuestAction(household("After Release", 5));
    expect(await rafiyaUsed()).toBe(75);
  });

  it("broader editing is an explicit grant", async () => {
    as(farhan);
    await expectRedirect(setEventGuestRoleAction(form({ eventId: E, userId: rafiya.id, role: "contributor", canManageAllGuests: "on" })), "gl_ok");
    as(rafiya);
    await updateGuestAction(form({ eventId: E, guestId: farhanGuestId, guestName: "The Ahmed Family", menCount: "2", womenCount: "2", kidsCount: "0" }));
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: farhanGuestId } })).womenCount).toBe(2);
    await expect(
      updateEventAction(form({ eventId: E, title: "Renamed", theme: "modern", eventDate: "2099-06-01", rsvpDeadline: "2099-05-01", eventTime: "18:00" })),
    ).rejects.toThrow(/organizers/);
  });

  it("simultaneous requests cannot exceed an allowance", async () => {
    as(farhan);
    await expectRedirect(setGuestAllowanceAction(form({ eventId: E, userId: rafiya.id, places: "80" })), "gl_ok");
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        mobile(rafiya, `/events/${E}/guests`, { method: "POST", body: { guestName: `Race ${i}`, menCount: 1 } }).then((req) =>
          createMobileGuest(req, params({ eventId: E })),
        ),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(await rafiyaUsed()).toBe(80);
  });
});

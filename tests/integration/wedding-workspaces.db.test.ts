// @vitest-environment node
/**
 * End-to-end workspace isolation checks against a real, disposable Postgres database.
 *
 * Skipped unless WEDDING_TEST_DATABASE_URL points at a localhost database whose name contains
 * "test" (the suite TRUNCATEs every table). Prepare it with:
 *   DATABASE_URL=$WEDDING_TEST_DATABASE_URL DIRECT_URL=$WEDDING_TEST_DATABASE_URL npx prisma migrate deploy
 * All people and weddings below are fictional.
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));
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
vi.mock("@/lib/admin-api-auth", () => ({
  getCurrentAdminUserFromApi: async () => auth.actor,
}));

import { prisma } from "@/lib/prisma";
import { authenticateAdminCredentials } from "@/lib/login-credentials";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { POST as uploadContract } from '@/app/admin/api/vendors/[vendorId]/contracts/route';
import { GET as downloadContract, DELETE as removeContract } from '@/app/admin/api/vendors/[vendorId]/contracts/[contractId]/route';
import { createAdminSessionToken } from "@/lib/admin-session";
import {
  createGuestAction,
  getGuestCommunicationHistoryAction,
  markGuestsInvitedAction,
  restoreEventAction,
  setGuestCountOwnershipAction,
  updateEventAction,
  updateGuestAction,
} from "@/app/admin/events/actions";
import { previewGuestCsvAction } from "@/app/admin/events/csv-import-actions";
import {
  addWeddingMemberAction,
  removeWeddingMemberAction,
  updateWeddingMemberRoleAction,
} from "@/app/admin/weddings/actions";
import { submitRsvpAction } from "@/app/rsvp/[token]/actions";
import { GET as listMobileEvents, POST as createMobileEvent } from "@/app/admin/api/mobile/events/route";
import { GET as getMobileEvent, PUT as putMobileEvent } from "@/app/admin/api/mobile/events/[eventId]/route";
import { GET as listMobileGuests } from "@/app/admin/api/mobile/events/[eventId]/guests/route";
import { PUT as putMobileGuest } from "@/app/admin/api/mobile/events/[eventId]/guests/[guestId]/route";
import { POST as bulkMobileGuests } from "@/app/admin/api/mobile/events/[eventId]/guests/bulk/route";
import { POST as recordMobileRsvp } from "@/app/admin/api/mobile/events/[eventId]/guests/[guestId]/record-rsvp/route";
import { GET as mobilePreviewUrl } from "@/app/admin/api/mobile/events/[eventId]/preview-url/route";
import { GET as mobileNotifications } from "@/app/admin/api/mobile/notifications/route";
import { GET as rsvpMetadata } from "@/app/admin/api/rsvp-metadata/route";
import { summarizeWeddingGuests } from "@/lib/wedding-guest-summary";

type Actor = { id: string; name: string; role: string };
const people: Record<"super" | "aOwner" | "aMember" | "bOwner" | "legacy", Actor> = {
  super: { id: "it_super", name: "IT Platform Admin", role: "super_admin" },
  aOwner: { id: "it_a_owner", name: "IT Aisha", role: "event_creator" },
  aMember: { id: "it_a_member", name: "IT Omar", role: "event_creator" },
  bOwner: { id: "it_b_owner", name: "IT Bina", role: "event_creator" },
  legacy: { id: "it_legacy", name: "IT Legacy Owner", role: "event_creator" },
};
const ids = {
  weddingA: "it_w_a",
  weddingB: "it_w_b",
  aMehndi: "it_ev_a_mehndi",
  aWalima: "it_ev_a_walima",
  aTrashed: "it_ev_a_trashed",
  bNikkah: "it_ev_b_nikkah",
  legacyEvent: "it_ev_legacy",
};

function as(actor: Actor) {
  auth.actor = actor;
}

async function expectRedirect(promise: Promise<unknown>, contains: string) {
  await expect(promise).rejects.toThrow(new RegExp(`REDIRECT:.*${contains.replace(/[?]/g, "\\?")}`));
}

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

async function bearer(actor: Actor) {
  const token = await createAdminSessionToken({
    userId: actor.id,
    name: actor.name,
    userRole: actor.role as "super_admin" | "event_creator",
  });
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function mobile(actor: Actor, path: string, init: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost/admin/api/mobile${path}`, {
    method: init.method ?? "GET",
    headers: await bearer(actor),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function addKhan(actor: Actor, eventId: string, men: number, women: number) {
  as(actor);
  await createGuestAction(
    form({ eventId, guestName: "The Khan Family", menCount: String(men), womenCount: String(women), kidsCount: "0" }),
  );
  return prisma.guest.findFirstOrThrow({ where: { eventId, guestName: "The Khan Family", deletedAt: null } });
}

describe.skipIf(!env.enabled)("wedding workspaces (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "WeddingMembership","Wedding","GuestCommunicationLog","RsvpActivity","Guest","Notification","AuditActivity","Event","User" CASCADE`,
    );
    await prisma.user.createMany({
      data: Object.values(people).map((p) => ({ id: p.id, name: p.name, role: p.role, passwordHash: "x", active: true })),
    });
    await prisma.wedding.create({
      data: {
        id: ids.weddingA,
        name: "Aisha & Omar",
        memberships: {
          create: [
            { userId: people.aOwner.id, role: "owner" },
            { userId: people.aMember.id, role: "member" },
          ],
        },
      },
    });
    await prisma.wedding.create({
      data: { id: ids.weddingB, name: "Bina & Karim", memberships: { create: [{ userId: people.bOwner.id, role: "owner" }] } },
    });
    await prisma.event.createMany({
      data: [
        { id: ids.aMehndi, title: "Mehndi", slug: "it-mehndi", weddingId: ids.weddingA, ownerUserId: people.aOwner.id, createdAt: new Date("2026-01-01") },
        { id: ids.aWalima, title: "Walima", slug: "it-walima", weddingId: ids.weddingA, ownerUserId: people.aOwner.id, createdAt: new Date("2026-01-02") },
        { id: ids.aTrashed, title: "Trashed", slug: "it-trashed", weddingId: ids.weddingA, ownerUserId: people.aOwner.id, deletedAt: new Date() },
        { id: ids.bNikkah, title: "Nikkah", slug: "it-nikkah", weddingId: ids.weddingB, ownerUserId: people.bOwner.id },
        { id: ids.legacyEvent, title: "Legacy", slug: "it-legacy", weddingId: null, ownerUserId: people.legacy.id },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    auth.actor = null;
  });

  describe("identically named households in two weddings", () => {
    it("never match across weddings and keep per-event totals independent", async () => {
      const aKhan = await addKhan(people.aOwner, ids.aMehndi, 2, 2);
      const bKhan = await addKhan(people.bOwner, ids.bNikkah, 1, 1);

      expect(bKhan.sharedGuestKey).toBe(aKhan.sharedGuestKey);
      expect(bKhan).toMatchObject({ excludeFromTotals: false, excludedGuestCount: 0, countOwnerEventId: null });
      expect(await prisma.guest.findUniqueOrThrow({ where: { id: aKhan.id } })).toMatchObject({
        excludeFromTotals: false,
        countOwnerEventId: null,
      });

      const aWalimaKhan = await addKhan(people.aMember, ids.aWalima, 2, 2);
      expect(aWalimaKhan).toMatchObject({ excludeFromTotals: false, excludedGuestCount: 0, countOwnerEventId: null });
      const walimaDetail = await (await getMobileEvent(await mobile(people.aMember, `/events/${ids.aWalima}`), params({ eventId: ids.aWalima }))).json();
      expect(walimaDetail.stats).toMatchObject({ countedFamilies: 1, totalMaxInvited: 4 });

      as(people.bOwner);
      const bDetail = await (await getMobileEvent(await mobile(people.bOwner, `/events/${ids.bNikkah}`), params({ eventId: ids.bNikkah }))).json();
      expect(bDetail.stats).toMatchObject({ totalFamilies: 1, countedFamilies: 1, totalMaxInvited: 2 });
      const aDetail = await (await getMobileEvent(await mobile(people.aOwner, `/events/${ids.aMehndi}`), params({ eventId: ids.aMehndi }))).json();
      expect(aDetail.stats).toMatchObject({ totalFamilies: 1, countedFamilies: 1, totalMaxInvited: 4 });
    });

    it("re-assigning count ownership in one wedding never touches the other wedding", async () => {
      const bKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.bNikkah } });
      const before = await prisma.guest.findMany({ where: { event: { weddingId: ids.weddingA } }, orderBy: { id: "asc" } });
      as(people.bOwner);
      await setGuestCountOwnershipAction({ eventId: ids.bNikkah, guestId: bKhan.id, mode: "count_here" });
      const after = await prisma.guest.findMany({ where: { event: { weddingId: ids.weddingA } }, orderBy: { id: "asc" } });
      expect(after.map((g) => [g.id, g.countOwnerEventId, g.excludeFromTotals, g.updatedAt.getTime()])).toEqual(
        before.map((g) => [g.id, g.countOwnerEventId, g.excludeFromTotals, g.updatedAt.getTime()]),
      );
    });

    it("a forged countOwnerEventId from another wedding is ignored", async () => {
      const walimaKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.aWalima } });
      as(people.aOwner);
      await updateGuestAction(
        form({
          eventId: ids.aWalima,
          guestId: walimaKhan.id,
          guestName: "The Khan Family",
          menCount: "2",
          womenCount: "2",
          kidsCount: "0",
          countOwnerEventId: ids.bNikkah,
        }),
      );
      const updated = await prisma.guest.findUniqueOrThrow({ where: { id: walimaKhan.id } });
      expect(updated.countOwnerEventId).not.toBe(ids.bNikkah);
      expect(updated.countOwnerEventId).toBe(ids.aWalima);
    });

    it("wedding-wide deduplicated totals are a separate figure per wedding", async () => {
      const guestsA = await prisma.guest.findMany({ where: { deletedAt: null, event: { weddingId: ids.weddingA, deletedAt: null } } });
      expect(summarizeWeddingGuests(guestsA)).toMatchObject({ invitationRecords: 2, uniqueHouseholds: 1, householdsInMultipleEvents: 1 });
      const guestsB = await prisma.guest.findMany({ where: { deletedAt: null, event: { weddingId: ids.weddingB } } });
      expect(summarizeWeddingGuests(guestsB)).toMatchObject({ uniqueHouseholds: 1, uniqueInvitedPeople: 2 });
    });
  });

  describe("two members of one wedding", () => {
    it("can both read and manage the wedding's events", async () => {
      as(people.aMember);
      await expectRedirect(
        updateEventAction(
          form({
            eventId: ids.aMehndi,
            title: "Mehndi Night",
            theme: "modern",
            eventDate: "2099-06-01",
            rsvpDeadline: "2099-05-01",
            eventTime: "18:00",
          }),
        ),
        `/admin/events/${ids.aMehndi}`,
      );
      expect((await prisma.event.findUniqueOrThrow({ where: { id: ids.aMehndi } })).title).toBe("Mehndi Night");

      const listed = await (await listMobileEvents(await mobile(people.aMember, "/events"))).json();
      expect(listed.events.map((e: { id: string }) => e.id).sort()).toEqual([ids.aMehndi, ids.aWalima].sort());
      expect(listed.events[0]).toHaveProperty("weddingId", ids.weddingA);

      const aKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.aMehndi } });
      as(people.aOwner);
      expect(await markGuestsInvitedAction(ids.aMehndi, [aKhan.id], "whatsapp")).toEqual({ ok: true, updated: 1 });

      const res = await putMobileGuest(
        await mobile(people.aMember, `/events/${ids.aMehndi}/guests/${aKhan.id}`, { method: "PUT", body: { notes: "Partner edit" } }),
        params({ eventId: ids.aMehndi, guestId: aKhan.id }),
      );
      expect(res!.status).toBe(200);
    });

    it("both partners receive event notifications; the other wedding does not", async () => {
      const recipients = await prisma.notification.findMany({ where: { eventId: ids.aMehndi }, select: { userId: true } });
      const userIds = new Set(recipients.map((r) => r.userId));
      expect(userIds.has(people.aOwner.id)).toBe(true);
      expect(userIds.has(people.aMember.id)).toBe(true);
      expect(userIds.has(people.bOwner.id)).toBe(false);

      const bFeed = await (await mobileNotifications(await mobile(people.bOwner, "/notifications?take=50"))).json();
      expect(bFeed.items.every((n: { eventId: string | null }) => n.eventId !== ids.aMehndi && n.eventId !== ids.aWalima)).toBe(true);
    });
  });

  describe("a member of another wedding", () => {
    it("is denied through mobile API routes using direct IDs", async () => {
      const aKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.aMehndi } });
      const b = people.bOwner;
      const statuses = [
        (await getMobileEvent(await mobile(b, `/events/${ids.aMehndi}`), params({ eventId: ids.aMehndi }))).status,
        (await putMobileEvent(await mobile(b, `/events/${ids.aMehndi}`, { method: "PUT", body: { title: "pwned" } }), params({ eventId: ids.aMehndi }))).status,
        (await listMobileGuests(await mobile(b, `/events/${ids.aMehndi}/guests`), params({ eventId: ids.aMehndi }))).status,
        (await putMobileGuest(await mobile(b, `/events/${ids.aMehndi}/guests/${aKhan.id}`, { method: "PUT", body: { notes: "x" } }), params({ eventId: ids.aMehndi, guestId: aKhan.id })))!.status,
        (await bulkMobileGuests(await mobile(b, `/events/${ids.aMehndi}/guests/bulk`, { method: "POST", body: { action: "delete", guestIds: [aKhan.id] } }), params({ eventId: ids.aMehndi }))).status,
        (await recordMobileRsvp(await mobile(b, `/events/${ids.aMehndi}/guests/${aKhan.id}/record-rsvp`, { method: "POST", body: { attending: false } }), params({ eventId: ids.aMehndi, guestId: aKhan.id }))).status,
        (await mobilePreviewUrl(await mobile(b, `/events/${ids.aMehndi}/preview-url`), params({ eventId: ids.aMehndi }))).status,
      ];
      expect(statuses).toEqual([403, 403, 403, 403, 403, 403, 403]);

      const listed = await (await listMobileEvents(await mobile(b, `/events?weddingId=${ids.weddingA}`))).json();
      expect(listed.events).toEqual([]);
      const unchanged = await prisma.guest.findUniqueOrThrow({ where: { id: aKhan.id } });
      expect(unchanged.deletedAt).toBeNull();
      expect((await prisma.event.findUniqueOrThrow({ where: { id: ids.aMehndi } })).title).toBe("Mehndi Night");
    });

    it("is denied through server actions, imports and previews, and cannot smuggle foreign guest IDs", async () => {
      const aKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.aMehndi } });
      as(people.bOwner);
      await expect(
        updateGuestAction(form({ eventId: ids.aMehndi, guestId: aKhan.id, guestName: "x", menCount: "1", womenCount: "0", kidsCount: "0" })),
      ).rejects.toThrow("not allowed");
      await expect(getGuestCommunicationHistoryAction(ids.aMehndi, aKhan.id)).rejects.toThrow("not allowed");
      expect((await previewGuestCsvAction(ids.aMehndi, "guestName\nX")).preview).toBeNull();
      await expectRedirect(restoreEventAction(form({ eventId: ids.aTrashed })), "restore=forbidden");

      const logsBefore = await prisma.guestCommunicationLog.count({ where: { guestId: aKhan.id } });
      expect(await markGuestsInvitedAction(ids.bNikkah, [aKhan.id], "manual")).toEqual({ ok: true, updated: 0 });
      expect(await prisma.guestCommunicationLog.count({ where: { guestId: aKhan.id } })).toBe(logsBefore);

      const meta = await rsvpMetadata(new Request(`http://localhost/admin/api/rsvp-metadata?token=${aKhan.token}`));
      expect(meta.status).toBe(404);
      as(people.aMember);
      expect((await rsvpMetadata(new Request(`http://localhost/admin/api/rsvp-metadata?token=${aKhan.token}`))).status).toBe(200);
    });

    it("cannot create events in a wedding they do not belong to", async () => {
      const res = await createMobileEvent(await mobile(people.bOwner, "/events", { method: "POST", body: { title: "Sneaky", weddingId: ids.weddingA } }));
      expect(res.status).toBe(403);
      const ok = await createMobileEvent(await mobile(people.bOwner, "/events", { method: "POST", body: { title: "Mayun" } }));
      expect(ok.status).toBe(201);
      const created = (await ok.json()).event;
      expect((await prisma.event.findUniqueOrThrow({ where: { id: created.id } })).weddingId).toBe(ids.weddingB);
    });
  });

  describe("membership administration", () => {
    it("is restricted to owners and always keeps one owner", async () => {
      as(people.aMember);
      await expectRedirect(addWeddingMemberAction(form({ weddingId: ids.weddingA, userName: people.legacy.name, role: "member" })), "owner_required");

      as(people.aOwner);
      await expectRedirect(addWeddingMemberAction(form({ weddingId: ids.weddingA, userName: people.legacy.name, role: "member" })), "member_added");
      const added = await prisma.weddingMembership.findUniqueOrThrow({ where: { weddingId_userId: { weddingId: ids.weddingA, userId: people.legacy.id } } });
      await expectRedirect(removeWeddingMemberAction(form({ membershipId: added.id })), "member_removed");

      const ownerRow = await prisma.weddingMembership.findUniqueOrThrow({ where: { weddingId_userId: { weddingId: ids.weddingA, userId: people.aOwner.id } } });
      await expectRedirect(updateWeddingMemberRoleAction(form({ membershipId: ownerRow.id, role: "member" })), "last_owner");
      await expectRedirect(removeWeddingMemberAction(form({ membershipId: ownerRow.id })), "last_owner");

      as(people.bOwner);
      await expectRedirect(removeWeddingMemberAction(form({ membershipId: ownerRow.id })), "owner_required");
    });
  });

  describe("legacy and platform access", () => {
    it("keeps unassigned legacy events reachable only by their legacy owner; super admin sees everything", async () => {
      expect((await getMobileEvent(await mobile(people.legacy, `/events/${ids.legacyEvent}`), params({ eventId: ids.legacyEvent }))).status).toBe(200);
      expect((await getMobileEvent(await mobile(people.aOwner, `/events/${ids.legacyEvent}`), params({ eventId: ids.legacyEvent }))).status).toBe(403);
      const all = await (await listMobileEvents(await mobile(people.super, "/events"))).json();
      expect(all.events.map((e: { id: string }) => e.id)).toEqual(expect.arrayContaining([ids.aMehndi, ids.bNikkah, ids.legacyEvent]));
    });
  });

  describe("public RSVP by invitation token", () => {
    it("still works with existing tokens and only touches the invited guest", async () => {
      const aKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.aMehndi } });
      const bKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.bNikkah } });
      auth.actor = null;
      await submitRsvpAction(form({ token: aKhan.token, attending: "yes", attendingCount: "3" }));
      const after = await prisma.guest.findUniqueOrThrow({ where: { id: aKhan.id } });
      expect(after).toMatchObject({ token: aKhan.token, attending: true, attendingCount: 3 });
      expect(await prisma.guest.findUniqueOrThrow({ where: { id: bKhan.id } })).toMatchObject({ attending: null, token: bKhan.token });
      await expect(submitRsvpAction(form({ token: "not-a-real-token", attending: "no" }))).rejects.toThrow("Invalid RSVP link");
    });

    it("blocks preview-mode submissions only for members of that wedding", async () => {
      const aKhan = await prisma.guest.findFirstOrThrow({ where: { eventId: ids.aMehndi } });
      as(people.aMember);
      await expect(submitRsvpAction(form({ token: aKhan.token, attending: "no", previewMode: "1" }))).rejects.toThrow("preview mode");
    });
  });
  describe('private vendor contracts (real Postgres)', () => {
    it('stores private bytes, enforces wedding access and removes recoverably', async () => {
      const vendor = await prisma.vendor.create({data:{weddingId:ids.weddingA,name:'Fictional catering contract test',category:'Caterer'}});
      const url = `http://localhost/admin/api/vendors/${vendor.id}/contracts`;
      const body = new FormData(); body.set('file',new File(['%PDF-1.7\nSynthetic test contract'],'agreement.pdf',{type:'application/pdf'}));
      as(people.aMember);
      const uploaded = await uploadContract(new Request(url,{method:'POST',headers:{origin:'http://localhost'},body}),params({vendorId:vendor.id}));
      expect(uploaded.status).toBe(201);
      const {id} = await uploaded.json();
      const context = params({vendorId:vendor.id,contractId:id});
      const read = await downloadContract(new Request(url),context);
      expect(await read.text()).toBe('%PDF-1.7\nSynthetic test contract');
      expect(read.headers.get('cache-control')).toBe('private, no-store');
      as(people.bOwner);
      expect((await downloadContract(new Request(url),context)).status).toBe(404);
      expect((await removeContract(new Request(url,{method:'DELETE',headers:{origin:'http://localhost'}}),context)).status).toBe(404);
      as(people.aOwner);
      expect((await removeContract(new Request(url,{method:'DELETE',headers:{origin:'http://localhost'}}),context)).status).toBe(204);
      expect((await downloadContract(new Request(url),context)).status).toBe(404);
      expect((await prisma.vendorContract.findUniqueOrThrow({where:{id}})).deletedAt).not.toBeNull();
    });
    it('enables RLS with no public policies on the attachment table',async()=>{
      const rows = await prisma.$queryRaw<Array<{relrowsecurity:boolean}>>`SELECT relrowsecurity FROM pg_class WHERE oid = '"VendorContract"'::regclass`;
      expect(rows[0].relrowsecurity).toBe(true);
      const policies = await prisma.$queryRaw<Array<{count:bigint}>>`SELECT count(*) FROM pg_policies WHERE tablename = 'VendorContract'`;
      expect(Number(policies[0].count)).toBe(0);
    });
  });

  it('authenticates a real local bcrypt account and rejects inactive/deleted accounts', async () => {
    const secret = randomBytes(24).toString('base64url');
    const user = await prisma.user.create({data:{name:'Local Auth Regression',role:'event_creator',passwordHash:await hash(secret,4)}});
    expect(await authenticateAdminCredentials('  local AUTH regression  ',secret)).toEqual({id:user.id,name:user.name,role:user.role});
    expect(await authenticateAdminCredentials(user.name,` ${secret}`)).toBeNull();
    await prisma.user.update({where:{id:user.id},data:{active:false}});
    expect(await authenticateAdminCredentials(user.name,secret)).toBeNull();
    await prisma.user.update({where:{id:user.id},data:{active:true,deletedAt:new Date()}});
    expect(await authenticateAdminCredentials(user.name,secret)).toBeNull();
  });

});

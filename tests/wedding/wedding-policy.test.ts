import { describe, expect, it } from "vitest";
import {
  accessibleEventsWhere,
  buildWorkspaceSwitcherOptions,
  canAccessEventRecord,
  canManageWeddingMembers,
  eventsInScopeWhere,
  resolveActiveWorkspaceScope,
  sanitizeAdminReturnPath,
  wouldLeaveWeddingWithoutOwner,
} from "@/lib/wedding-policy";

const superAdmin = { id: "u-super", role: "super_admin" };
const partnerA = { id: "u-a1", role: "event_creator" };
const outsider = { id: "u-b1", role: "event_creator" };

describe("canAccessEventRecord", () => {
  const weddingEvent = { ownerUserId: "u-a1", weddingId: "w-a" };
  const legacyEvent = { ownerUserId: "u-a1", weddingId: null };

  it("platform super admin keeps full access", () => {
    expect(canAccessEventRecord(superAdmin, weddingEvent, null)).toBe(true);
    expect(canAccessEventRecord(superAdmin, legacyEvent, null)).toBe(true);
  });

  it("wedding events require a membership (owner or member)", () => {
    expect(canAccessEventRecord(partnerA, weddingEvent, "owner")).toBe(true);
    expect(canAccessEventRecord({ id: "u-a2", role: "event_creator" }, weddingEvent, "member")).toBe(true);
    expect(canAccessEventRecord(outsider, weddingEvent, null)).toBe(false);
  });

  it("legacy ownership does not grant access once the event belongs to a wedding", () => {
    expect(canAccessEventRecord(partnerA, weddingEvent, null)).toBe(false);
  });

  it("ignores unknown membership roles", () => {
    expect(canAccessEventRecord(outsider, weddingEvent, "admin")).toBe(false);
  });

  it("unassigned legacy events stay reachable only by their legacy owner", () => {
    expect(canAccessEventRecord(partnerA, legacyEvent, null)).toBe(true);
    expect(canAccessEventRecord(outsider, legacyEvent, null)).toBe(false);
    expect(canAccessEventRecord(outsider, { ownerUserId: null, weddingId: null }, null)).toBe(false);
  });
});

describe("membership administration", () => {
  it("is restricted to owners and platform super admins", () => {
    expect(canManageWeddingMembers(partnerA, "owner")).toBe(true);
    expect(canManageWeddingMembers(partnerA, "member")).toBe(false);
    expect(canManageWeddingMembers(outsider, null)).toBe(false);
    expect(canManageWeddingMembers(superAdmin, null)).toBe(true);
  });

  it("never leaves a wedding without an owner", () => {
    const members = [
      { id: "m1", userId: "u-a1", role: "owner" },
      { id: "m2", userId: "u-a2", role: "member" },
    ];
    expect(wouldLeaveWeddingWithoutOwner(members, { membershipId: "m1", nextRole: "member" })).toBe(true);
    expect(wouldLeaveWeddingWithoutOwner(members, { membershipId: "m1", nextRole: null })).toBe(true);
    expect(wouldLeaveWeddingWithoutOwner(members, { membershipId: "m2", nextRole: null })).toBe(false);
    expect(wouldLeaveWeddingWithoutOwner(members, { membershipId: "m2", nextRole: "owner" })).toBe(false);
  });
});

describe("list scoping", () => {
  it("super admin is unrestricted; others see member weddings plus own unassigned events", () => {
    expect(accessibleEventsWhere(superAdmin)).toEqual({});
    expect(accessibleEventsWhere(partnerA)).toEqual({
      OR: [
        { weddingId: { not: null }, wedding: { memberships: { some: { userId: "u-a1" } } } },
        { weddingId: null, ownerUserId: "u-a1" },
      ],
    });
  });

  it("active-wedding scope is always intersected with access", () => {
    expect(eventsInScopeWhere(partnerA, { kind: "wedding", weddingId: "w-b" })).toEqual({
      AND: [accessibleEventsWhere(partnerA), { weddingId: "w-b" }],
    });
    expect(eventsInScopeWhere(partnerA, { kind: "all" })).toEqual({ id: "__no_access__" });
    expect(eventsInScopeWhere(partnerA, { kind: "none" })).toEqual({ id: "__no_access__" });
  });
});

describe("resolveActiveWorkspaceScope", () => {
  const weddings = [
    { id: "w-a", name: "A", role: "owner" as const },
    { id: "w-c", name: "C", role: "member" as const },
  ];

  it("honours a cookie only for weddings the user belongs to", () => {
    expect(resolveActiveWorkspaceScope({ actor: partnerA, cookieValue: "w-c", weddings, hasUnassignedEvents: false })).toEqual({
      kind: "wedding",
      weddingId: "w-c",
    });
    expect(resolveActiveWorkspaceScope({ actor: partnerA, cookieValue: "w-b", weddings, hasUnassignedEvents: false })).toEqual({
      kind: "wedding",
      weddingId: "w-a",
    });
  });

  it("does not let non-super users select the platform-wide view", () => {
    expect(resolveActiveWorkspaceScope({ actor: partnerA, cookieValue: "all", weddings, hasUnassignedEvents: false }).kind).toBe(
      "wedding",
    );
  });

  it("falls back to legacy unassigned events, then to none", () => {
    expect(resolveActiveWorkspaceScope({ actor: outsider, cookieValue: null, weddings: [], hasUnassignedEvents: true })).toEqual({
      kind: "unassigned",
    });
    expect(resolveActiveWorkspaceScope({ actor: outsider, cookieValue: null, weddings: [], hasUnassignedEvents: false })).toEqual({
      kind: "none",
    });
  });

  it("defaults super admins to the existing platform-wide view", () => {
    expect(resolveActiveWorkspaceScope({ actor: superAdmin, cookieValue: undefined, weddings, hasUnassignedEvents: false })).toEqual({
      kind: "all",
    });
  });

  it("builds switcher options per role", () => {
    expect(buildWorkspaceSwitcherOptions({ actor: partnerA, weddings, hasUnassignedEvents: false }).map((o) => o.value)).toEqual([
      "w-a",
      "w-c",
    ]);
    expect(buildWorkspaceSwitcherOptions({ actor: superAdmin, weddings, hasUnassignedEvents: false }).map((o) => o.value)).toEqual([
      "all",
      "w-a",
      "w-c",
      "unassigned",
    ]);
  });
});

describe("sanitizeAdminReturnPath", () => {
  it("only allows internal admin paths", () => {
    expect(sanitizeAdminReturnPath("/admin/weddings")).toBe("/admin/weddings");
    expect(sanitizeAdminReturnPath("https://evil.example")).toBe("/admin/events");
    expect(sanitizeAdminReturnPath("//evil.example/admin/")).toBe("/admin/events");
    expect(sanitizeAdminReturnPath("/rsvp/x")).toBe("/admin/events");
    expect(sanitizeAdminReturnPath(null)).toBe("/admin/events");
  });
});

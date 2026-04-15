import { describe, expect, it } from "vitest";
import { inviteCardUsingLabel, resolveInviteCardImage } from "@/lib/invite-card-resolution";

const baseEvent = {
  imagePath: "/default.png",
  genericCardImage: null as string | null,
  cardImage1: null as string | null,
  cardImage2: null as string | null,
  cardImage3: null as string | null,
  cardImage4: null as string | null,
  familyCardImage: null as string | null,
};

describe("resolveInviteCardImage", () => {
  it("uses size-specific card when maxGuests matches 1–4 and image exists", () => {
    const r = resolveInviteCardImage(
      { ...baseEvent, cardImage2: "/two.png" },
      { maxGuests: 2, isFamilyInvite: false },
    );
    expect(r.source).toBe("maxGuests");
    expect(r.rawPath).toBe("/two.png");
    expect(inviteCardUsingLabel(r)).toBe("Using: 2 Guest Card");
  });

  it("uses family card when flagged and no size match (or slot empty)", () => {
    const r = resolveInviteCardImage(
      { ...baseEvent, familyCardImage: "/fam.png" },
      { maxGuests: 6, isFamilyInvite: true },
    );
    expect(r.source).toBe("family");
    expect(r.rawPath).toBe("/fam.png");
  });

  it("prefers exact maxGuests slot over family when both exist", () => {
    const r = resolveInviteCardImage(
      {
        ...baseEvent,
        cardImage1: "/one.png",
        familyCardImage: "/fam.png",
      },
      { maxGuests: 1, isFamilyInvite: true },
    );
    expect(r.source).toBe("maxGuests");
    expect(r.rawPath).toBe("/one.png");
  });

  it("falls back to generic then default", () => {
    const g = resolveInviteCardImage(
      { ...baseEvent, genericCardImage: "/gen.png" },
      { maxGuests: 6, isFamilyInvite: false },
    );
    expect(g.source).toBe("generic");
    expect(g.rawPath).toBe("/gen.png");

    const d = resolveInviteCardImage(
      { ...baseEvent },
      { maxGuests: 6, isFamilyInvite: false },
    );
    expect(d.source).toBe("default");
    expect(d.rawPath).toBe("/default.png");
  });
});

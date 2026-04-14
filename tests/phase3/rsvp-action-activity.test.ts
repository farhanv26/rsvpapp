import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitRsvpAction } from "@/app/rsvp/[token]/actions";

const prismaMock = vi.hoisted(() => ({
  guest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  rsvpActivity: {
    create: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("Phase 3 - RSVP activity logging", () => {
  beforeEach(() => {
    prismaMock.guest.findUnique.mockReset();
    prismaMock.guest.update.mockReset();
    prismaMock.rsvpActivity.create.mockReset();
  });

  it("logs accepted activity for first-time RSVP", async () => {
    prismaMock.guest.findUnique.mockResolvedValue({
      id: "g1",
      maxGuests: 3,
      respondedAt: null,
      eventId: "e1",
      guestName: "Valli Family",
      attending: null,
      attendingCount: null,
      event: { rsvpDeadline: null },
    });
    prismaMock.guest.update.mockResolvedValue({});
    prismaMock.rsvpActivity.create.mockResolvedValue({});

    const formData = new FormData();
    formData.set("token", "tok");
    formData.set("attending", "yes");
    formData.set("attendingCount", "2");

    await submitRsvpAction(formData);

    expect(prismaMock.rsvpActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "e1",
        guestId: "g1",
        type: "accepted",
      }),
    });
  });

  it("logs attendee count update for edited RSVP", async () => {
    prismaMock.guest.findUnique.mockResolvedValue({
      id: "g1",
      maxGuests: 3,
      respondedAt: new Date(),
      eventId: "e1",
      guestName: "Valli Family",
      attending: true,
      attendingCount: 1,
      event: { rsvpDeadline: null },
    });
    prismaMock.guest.update.mockResolvedValue({});
    prismaMock.rsvpActivity.create.mockResolvedValue({});

    const formData = new FormData();
    formData.set("token", "tok");
    formData.set("attending", "yes");
    formData.set("attendingCount", "3");

    await submitRsvpAction(formData);

    expect(prismaMock.rsvpActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "updated_attendee_count",
      }),
    });
  });
});

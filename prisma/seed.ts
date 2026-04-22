import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { generateSecureToken } from "../lib/security";
import { BOOTSTRAP_SUPER_ADMIN } from "../lib/admin-identities";

const prisma = new PrismaClient();

function firstNamePassword(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.toLowerCase();
}

async function main() {
  const identity = BOOTSTRAP_SUPER_ADMIN;
  const passwordHash = await hash(firstNamePassword(identity.name), 12);
  const existingUser = await prisma.user.findFirst({
    where: { name: identity.name, deletedAt: null },
  });
  const farhan = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: identity.role,
          active: true,
          passwordHash,
        },
      })
    : await prisma.user.create({
        data: {
          name: identity.name,
          role: identity.role,
          active: true,
          passwordHash,
        },
      });

  await prisma.$executeRawUnsafe(
    `UPDATE "Event" SET "ownerUserId" = $1 WHERE "ownerUserId" IS NULL`,
    farhan.id,
  );

  const slug = "spring-garden-party";
  const existingEvent = await prisma.event.findFirst({
    where: { slug, deletedAt: null },
  });
  const event = existingEvent
    ? await prisma.event.update({
        where: { id: existingEvent.id },
        data: { ownerUserId: farhan.id },
      })
    : await prisma.event.create({
        data: {
          ownerUserId: farhan.id,
          coupleNames: "Ava & Noah",
          title: "Spring Garden Party",
          slug,
          eventSubtitle: "Together with their families",
          eventDate: new Date("2026-05-16"),
          eventTime: "4:30 PM",
          venue: "Rosewood Estate, Napa Valley",
          welcomeMessage: "Your presence will make our day even more meaningful.",
          description: "Join us for an evening of food, music, and celebration.",
          guests: {
            create: [
              {
                guestName: "The Valli Family",
                maxGuests: 4,
                group: "Family",
                token: generateSecureToken(),
              },
              {
                guestName: "Jordan & Alex",
                maxGuests: 2,
                token: generateSecureToken(),
              },
            ],
          },
        },
      });

  console.log(`Seeded event: ${event.title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

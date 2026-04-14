import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { generateSecureToken } from "../lib/security";
import { ADMIN_IDENTITIES } from "../lib/admin-identities";

const prisma = new PrismaClient();

async function main() {
  const users = await Promise.all(
    ADMIN_IDENTITIES.map(async (identity) =>
      prisma.user.upsert({
        where: { name: identity.name },
        update: {
          role: identity.role,
          passwordHash: await hash(identity.name.toLowerCase(), 12),
        },
        create: {
          name: identity.name,
          role: identity.role,
          passwordHash: await hash(identity.name.toLowerCase(), 12),
        },
      }),
    ),
  );

  const farhan = users.find((user) => user.name === "Farhan");
  if (!farhan) {
    throw new Error("Farhan user seed failed.");
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Event" SET "ownerUserId" = $1 WHERE "ownerUserId" IS NULL`,
    farhan.id,
  );

  const event = await prisma.event.upsert({
    where: { slug: "spring-garden-party" },
    update: {
      ownerUserId: farhan.id,
    },
    create: {
      ownerUserId: farhan.id,
      coupleNames: "Ava & Noah",
      title: "Spring Garden Party",
      slug: "spring-garden-party",
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

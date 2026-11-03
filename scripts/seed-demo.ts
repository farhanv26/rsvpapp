/**
 * Fictional demo wedding for local visual and flow testing. Every name is invented and every
 * record is labelled "[Demo]". Runs only against a local database whose name contains "demo"
 * (normally rsvp_demo), so demo accounts never mix with real local accounts.
 *   npm run db:demo:seed
 */
import { PrismaClient } from "./prisma-client.mjs";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid@invalid/invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  console.error(`Refusing to seed demo data into ${url.hostname}. Use a local database.`);
  process.exit(1);
}
if (!url.pathname.replace(/^\//, "").includes("demo")) {
  console.error(`Refusing to seed demo data into "${url.pathname.slice(1)}". Demo data goes only into a database named like rsvp_demo.`);
  process.exit(1);
}

const prisma = new PrismaClient();
const token = () => randomBytes(24).toString("base64url");
const days = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

const FAMILIES = [
  "Khan", "Siddiqui", "Rahman", "Qureshi", "Chaudhry", "Malik", "Sheikh", "Ansari", "Hussain", "Iqbal",
  "Patel", "Shah", "Mehta", "Gill", "Sandhu", "Ahmed", "Farooq", "Mirza", "Baig", "Zaidi",
  "Kapoor", "Rizvi", "Nasir", "Haider", "Yusuf", "Saleem", "Aziz", "Bhatti", "Butt", "Raza",
];

async function main() {
  const passwordHash = await hash("demo-local-only", 10);
  const [aisha, omar] = await Promise.all(
    [
      { id: "demo_aisha", name: "Demo Aisha" },
      { id: "demo_omar", name: "Demo Omar" },
    ].map((u) =>
      prisma.user.upsert({
        where: { id: u.id },
        create: { ...u, passwordHash, role: "event_creator", active: true },
        update: { passwordHash, active: true, deletedAt: null },
      }),
    ),
  );

  await prisma.user.upsert({
    where: { id: "demo_platform_admin" },
    create: { id: "demo_platform_admin", name: "Demo Platform Admin", passwordHash, role: "super_admin", active: true },
    update: { passwordHash, active: true, deletedAt: null },
  });

  await prisma.event.deleteMany({ where: { slug: { startsWith: "demo-" } } });
  await prisma.wedding.deleteMany({ where: { backfillKey: "demo-aisha-omar" } });

  const wedding = await prisma.wedding.create({
    data: {
      name: "[Demo] Aisha & Omar",
      backfillKey: "demo-aisha-omar",
      currency: "USD",
      timezone: "America/Toronto",
      defaultGreeting: "Assalamu Alaikum",
      memberships: { create: [{ userId: aisha.id, role: "owner" }, { userId: omar.id, role: "owner" }] },
    },
  });

  const mk = (slug: string, title: string, inDays: number, time: string, venue: string, itinerary: object[]) =>
    prisma.event.create({
      data: {
        slug: `demo-${slug}`,
        title,
        weddingId: wedding.id,
        ownerUserId: aisha.id,
        coupleNames: "Aisha & Omar",
        eventDate: days(inDays),
        rsvpDeadline: days(inDays - 14),
        eventTime: time,
        venue,
        welcomeMessage: "We would love to celebrate with you.",
        itinerary,
      },
    });
  const mehndi = await mk("mehndi", "Mehndi", 30, "18:00", "Khan Family Residence, Mississauga", [
    { startTime: "6:00 PM", title: "Guests arrive", icon: "MapPin", visibility: "guests" },
    { startTime: "7:00 PM", title: "Mehndi and dholki", icon: "Flower2", visibility: "guests", description: "Henna artists until 9 PM" },
    { startTime: "5:00 PM", title: "Decor team setup", icon: "Sparkles", visibility: "private", privateNotes: "Gate code 4412 — do not share" },
  ]);
  const nikkah = await mk("nikkah", "Nikkah", 31, "15:00", "Masjid Al-Noor Hall", [
    { startTime: "3:00 PM", title: "Nikkah ceremony", icon: "Heart", visibility: "guests" },
    { startTime: "4:00 PM", title: "Tea and sweets", icon: "Coffee", visibility: "guests" },
  ]);
  const reception = await mk("reception", "Reception (Walima)", 32, "19:00", "The Grand Pavilion, Toronto", [
    { startTime: "7:00 PM", title: "Entrance and welcome", icon: "Handshake", visibility: "guests" },
    { startTime: "8:00 PM", title: "Dinner", icon: "Utensils", visibility: "guests" },
    { startTime: "6:15 PM", title: "Vendor arrival", icon: "Car", visibility: "private", privateNotes: "Caterer brings 40 chairs" },
  ]);

  // Omar organizes nothing on the reception; Aisha is organizer and gives Omar 75 places there.
  await prisma.eventRole.create({ data: { eventId: reception.id, userId: omar.id, role: "contributor" } });
  const omarAllocation = await prisma.eventAllocation.create({ data: { eventId: reception.id, userId: omar.id, places: 75 } });

  let n = 0;
  for (const family of FAMILIES) {
    n += 1;
    const name = n === 7 ? `The ${family} Family (Dr. Sameer & Dr. Nadia ${family} and their three children from Brampton)` : `The ${family} Family`;
    const men = 1 + (n % 2);
    const women = 1 + ((n + 1) % 2);
    const kids = n % 3;
    const key = `n:the ${family.toLowerCase()} family`;
    const replied = n % 4 !== 0;
    const attending = replied ? n % 5 !== 0 : null;
    const base = {
      guestName: name,
      sharedGuestKey: key,
      menCount: men,
      womenCount: women,
      kidsCount: kids,
      maxGuests: men + women + kids,
      phoneCountryCode: "+1",
      phone: `41655${String(1000 + n).slice(-4)}${n % 10}`.slice(0, 10),
      greeting: "Assalamu Alaikum",
      group: n % 2 ? "Bride's family" : "Groom's family",
    };
    const status = (offset: number) =>
      replied
        ? { invitedAt: days(-10), respondedAt: days(-offset), attending, attendingCount: attending ? men + women + kids - (n % 2) : null }
        : n % 8 === 0
          ? {}
          : { invitedAt: days(-7) };
    if (n <= 22) await prisma.guest.create({ data: { ...base, ...status(3), eventId: mehndi.id, token: token(), managedByUserId: aisha.id } });
    if (n % 3 === 0) await prisma.guest.create({ data: { ...base, ...status(2), eventId: nikkah.id, token: token(), managedByUserId: aisha.id } });
    const omarSide = n > 18;
    await prisma.guest.create({
      data: {
        ...base,
        ...status(1),
        eventId: reception.id,
        token: token(),
        managedByUserId: omarSide ? omar.id : aisha.id,
        allocationId: omarSide ? omarAllocation.id : null,
      },
    });
  }

  const caterer = await prisma.vendor.create({
    data: { weddingId: wedding.id, name: "[Demo] Noor Kitchen Catering", category: "Caterer", status: "booked", quoteMinor: 1450000, contactName: "Sana", phone: "416-555-0142", notes: "Wants final headcount 10 days before" },
  });
  await prisma.vendor.create({ data: { weddingId: wedding.id, name: "[Demo] Lumen Photography", category: "Photographer", status: "quoted", quoteMinor: 420000 } });
  await prisma.vendor.create({ data: { weddingId: wedding.id, name: "[Demo] Henna by Zara", category: "Mehndi artist", status: "considering" } });

  const catering = await prisma.budgetItem.create({
    data: { weddingId: wedding.id, eventId: reception.id, vendorId: caterer.id, category: "Catering", label: "Reception dinner", agreedMinor: 1450000, nextPaymentDueAt: days(5) },
  });
  await prisma.budgetPayment.create({ data: { budgetItemId: catering.id, amountMinor: 300000, paidAt: days(-20), note: "Deposit" } });
  await prisma.budgetItem.create({
    data: { weddingId: wedding.id, eventId: mehndi.id, category: "Catering", label: "Mehndi snacks", perPersonMinor: 1800, perPersonBasis: "invited" },
  });
  await prisma.budgetItem.create({ data: { weddingId: wedding.id, category: "Attire & jewellery", label: "Outfits (both families)", estimateMinor: 600000 } });
  await prisma.budgetItem.create({ data: { weddingId: wedding.id, eventId: nikkah.id, category: "Venue", label: "Masjid hall booking", agreedMinor: 50000, nextPaymentDueAt: days(-2) } });

  console.log(`Seeded ${wedding.name}: 3 events, ${FAMILIES.length} households, 3 vendors, 4 budget lines.`);
  console.log(
    "Sign in as 'Demo Aisha' (organizer), 'Demo Omar' (reception contributor, 75 places) or 'Demo Platform Admin' with password demo-local-only.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

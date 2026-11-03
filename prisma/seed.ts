/**
 * Bootstrap only: creates the first platform administrator on an empty database.
 * It never changes existing accounts and never creates sample events or guests.
 *   BOOTSTRAP_ADMIN_PASSWORD='…' npm run db:seed
 * Not registered as Prisma's automatic seed, so `prisma migrate` never runs it implicitly.
 */
import { PrismaClient } from "../scripts/prisma-client.mjs";
import { hash } from "bcryptjs";
import { BOOTSTRAP_SUPER_ADMIN } from "../lib/admin-identities";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`This database already has ${existing} account(s); nothing was changed.`);
    return;
  }
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (password.length < 12) {
    console.error("Set BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters) to create the first administrator.");
    process.exit(1);
  }
  const user = await prisma.user.create({
    data: { name: BOOTSTRAP_SUPER_ADMIN.name, role: BOOTSTRAP_SUPER_ADMIN.role, active: true, passwordHash: await hash(password, 12) },
  });
  console.log(`Created the first administrator "${user.name}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

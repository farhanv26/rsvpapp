import "server-only";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** Names ignore surrounding whitespace and case; passwords are verified byte-for-byte. */
export async function authenticateAdminCredentials(identifier: string, password: string) {
  const name = identifier.trim();
  if (!name || name.length > 80 || !password || Buffer.byteLength(password, "utf8") > 72) return null;
  const users = await prisma.user.findMany({
    where: { name: { equals: name, mode: "insensitive" }, active: true, deletedAt: null },
    select: { id: true, name: true, role: true, passwordHash: true },
    take: 2,
  });
  // Fail closed if legacy accounts differ only by case.
  if (users.length !== 1 || !/^\$2[aby]\$\d\d\$/.test(users[0].passwordHash)) return null;
  const user = users[0];
  if (!await compare(password, user.passwordHash)) return null;
  return { id: user.id, name: user.name, role: user.role };
}

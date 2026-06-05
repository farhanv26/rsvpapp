import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPrismaClient(): PrismaClient {
  const isDev = process.env.NODE_ENV === "development";
  const log = (isDev ? ["warn", "error"] : ["error"]) as ("warn" | "error")[];

  if (!isDev) {
    return new PrismaClient({ log });
  }

  // In development the Next.js dev server handles concurrent requests inside a single
  // long-running process, so all requests share one PrismaClient. A connection_limit of 1
  // (typical for Supabase's PgBouncer pooler URL) means any two simultaneous requests
  // exhaust the pool. Bump to 5 for the local dev process only — production Lambda
  // instances each get their own client, so connection_limit=1 stays correct there.
  const rawUrl = process.env.DATABASE_URL ?? "";
  let url = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const current = Number(parsed.searchParams.get("connection_limit") ?? "0");
    if (current > 0 && current < 5) {
      parsed.searchParams.set("connection_limit", "5");
      url = parsed.toString();
    }
  } catch {
    // non-parseable URL — leave as-is
  }

  return new PrismaClient({ log, datasources: { db: { url } } });
}

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Retry a Prisma call once after reconnecting when the connection was closed
// by the database server (common on Vercel cold/warm-start with Supabase).
export async function withReconnect<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Closed") || msg.includes("connection") || msg.includes("ECONNRESET")) {
      await prisma.$connect();
      return fn();
    }
    throw err;
  }
}
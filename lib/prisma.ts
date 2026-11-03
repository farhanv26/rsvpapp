import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { runtimeSecret, workerContext } from './runtime-env';
import { requestResource } from './worker-database-lifetime';

function buildPrismaClient(worker = false): PrismaClient {
  const connectionString = runtimeSecret('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL runtime secret is required.');
  const adapter = new PrismaPg({
    connectionString,
    max: worker ? 2 : 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  // pg owns pooling; Prisma connection_limit URL parameters do not configure pg.
  return new PrismaClient({ adapter, log: [] });
}

const nodeGlobal = globalThis as typeof globalThis & { vowpalNodePrisma?: PrismaClient };
function currentClient(): PrismaClient {
  const context = workerContext();
  if (context) {
    return requestResource(context.ctx, () => {
      const client = buildPrismaClient(true);
      return { client, close: () => client.$disconnect() };
    }).client;
  }
  // Long-lived Node processes safely share a pool, including across development HMR.
  return nodeGlobal.vowpalNodePrisma ??= buildPrismaClient();
}

// Lazy facade owns no sockets. Native PrismaPromises and both transaction forms are preserved.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = currentClient();
    const value = Reflect.get(client, property);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/** Execute once: a lost reply may follow a committed write. Never replay arbitrary callbacks. */
export async function withReconnect<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

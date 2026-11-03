// Node-only maintenance/test scripts also need an adapter after engineType=client.
import { PrismaClient as GeneratedClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
export class PrismaClient extends GeneratedClient {
  constructor(options = {}) {
    const { datasources, ...rest } = options;
    const connectionString = datasources?.db?.url ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required.');
    super({ ...rest, adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 10000 }) });
  }
}

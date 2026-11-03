import { PrismaClient as GeneratedClient, Prisma } from '@prisma/client';
export class PrismaClient extends GeneratedClient {
  constructor(options?: Omit<Prisma.PrismaClientOptions, 'adapter' | 'datasources'> & {
    datasources?: { db?: { url?: string } };
  });
}

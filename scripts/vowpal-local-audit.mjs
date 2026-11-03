import { PrismaClient } from './prisma-client.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const db = new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_dev'}}});
try {
  const tables = await db.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  const backup = {};
  for (const {tablename} of tables) backup[tablename] = await db.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM "${tablename.replaceAll('"','""')}" t`);
  mkdirSync('.local/vowpal-backups',{recursive:true});
  const file = `.local/vowpal-backups/database-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(backup, (_,v)=> typeof v === 'bigint' ? v.toString() : v), {mode:0o600});
  console.log(`Local read-only snapshot: ${file}; ${tables.length} tables. Contains private data; ignored by git.`);
} finally {await db.$disconnect();}

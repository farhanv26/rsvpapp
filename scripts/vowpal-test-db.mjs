/** Fresh isolated database for destructive integration suites; never resets rsvp_dev. */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
const name = `rsvp_vowpal_test_${Date.now()}`;
const url = `postgresql://postgres@127.0.0.1:54330/${name}`;
const admin = new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/postgres'}}});
await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);await admin.$disconnect();
const env={...process.env,DATABASE_URL:url,DIRECT_URL:url,WEDDING_TEST_DATABASE_URL:url};
for (const args of [['prisma','migrate','deploy'],['prisma','migrate','diff','--from-url',url,'--to-schema-datamodel','prisma/schema.prisma','--exit-code'],['vitest','run']]) {
 console.log(`Isolated ${name}: ${args.slice(0,3).join(' ')}`);
 const result=spawnSync('node_modules/.bin/'+args[0],args.slice(1),{stdio:'inherit',env});
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Retained isolated database ${name} for inspection. Development data untouched.`);

# Prisma 6 / OpenNext Cloudflare runtime fix

## Diagnosis

The inspected installation was Prisma CLI/client 6.19.3, Next 16.2.3, OpenNext Cloudflare
1.20.15 and Wrangler 4.156.2. The generator selected the default engine, production used
`new PrismaClient({ log })` without an adapter, and an exported module singleton owned the
client. That is incompatible with the requested engine-free Worker/TCP driver architecture.
A `singleLoader` / `_executeRequest` stack alone does not establish the exact production
exception; no authenticated production logs were available. The runtime mismatch is verified
in source, and the replacement was verified in actual local workerd, not just `next build`.

References read before implementation:

- [Prisma v6 Cloudflare deployment](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/edge/deploy-to-cloudflare)
- [OpenNext database guidance](https://opennext.js.org/cloudflare/howtos/db)
- [OpenNext custom Worker entry](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [OpenNext environment variables](https://opennext.js.org/cloudflare/howtos/env-vars)

## Implementation

- Pin `prisma`, `@prisma/client` and `@prisma/adapter-pg` to **6.19.3**. Install pg 8.23.1
  and its types. Set `engineType = "client"` and regenerate. No database schema changes.
- `lib/prisma.ts` exports a lazy facade, not a TCP-owning singleton in Workers. It resolves
  one PrismaPg/client per request context. Native PrismaPromises, array transactions and
  interactive transactions remain intact. pg controls pooling; Prisma URL `connection_limit`
  is not used to configure it. Worker pools have max 2 connections; Node pools max 5.
- `worker.ts` delegates to OpenNext's generated handler with a unique context per request.
  The pool remains available through streamed rendering and registered `waitUntil` work,
  then `$disconnect()` closes the adapter-owned pool. Error/cancel paths also close it.
  The shared WeakMap registry owns no cross-request TCP pool.
- Long-lived Node development/server processes retain a shared lazy client, including HMR.
  Maintenance/test/seed scripts use a Node-only adapter wrapper so generation does not break
  existing local tooling. No seed/backfill/import/reset was executed.
- Reviewed `withReconnect` callers, including mobile event creation. The compatibility wrapper
  now executes **once**, never automatically reconnecting and replaying arbitrary callbacks.
  Financial writes retain their explicit request-key/version/transaction protections.
- `runtime-env.ts`, session signing and middleware read Worker request bindings. Missing Worker
  bindings never fall back to build-time/Node secrets. Outside Workers, Node reads process.env.
- `nodejs_compat` remains enabled. Wrangler now points to `worker.ts`; do not bypass this entry.
- Removed plaintext database URLs/legacy password from Wrangler vars. OpenNext also compiled
  local environment values into a fallback module; `build:cloudflare` now removes private
  database/auth fallbacks after bundling. Preview uses that same build command.
- Generated OpenNext/Wrangler output and `.dev.vars*` are ignored. Lint excludes generated output.
  Added the missing testing-library DOM peer dependency required by existing tests.

## Verification

Commands (no migrations, database reset or deployment):

```sh
npx tsc --noEmit
npm test
npm run lint
npm run build:cloudflare
npm run test:worker
```

The Worker test uses the **existing** isolated local database
`127.0.0.1:54330/rsvp_vowpal_test_1793655880473`; it does not create/migrate/reset the database.
It creates and removes only its temporary synthetic account/wedding. Password/session secrets
are random in-memory values, never printed or passed as shell arguments. Servers stop afterward.

Verified in local workerd on port 8788:

- Actual web server-action login repeated three times, JWT identity checked, concurrent protected
  overview requests rendered, invalid password rejected, and no account directory exposed.
- Runtime DATABASE_URL and ADMIN_AUTH_SECRET supplied as local preview bindings, with bundled
  private fallbacks removed. A missing binding is covered by a fail-closed unit test.
- Real Worker financial transaction: simultaneous identical expense creates and payment records
  deduplicated correctly; database amounts/record counts checked.
- Adapter array transactions and an interactive transaction rollback checked without resets.
- A separate Node server on port 3003 passed actual web login/protected overview with the same
  temporary account. No Farhan password or hosted account was changed.
- Lifetime tests cover request isolation, shared per-request resources, streaming, cancellation,
  failure and background-work completion. Retry test verifies a connection failure invokes a
  possibly committed write exactly once.

TypeScript and Cloudflare build passed. **125 tests passed across 24 files; 32 tests in three
existing database suites were skipped.** Those suites
are intentionally skipped because their setup truncates tables. They were not enabled under the
no-reset instruction. Targeted database-backed checks above ran instead. Lint has zero errors and
four existing warnings (image-test markup and unused Supabase middleware variables).
An empty stale generated `.next/dev/types/routes.d.ts` initially broke type checking; its generated
directory was preserved under `.local/stale-next-dev-types-worker-fix`, then types passed.

Logs are private under `.local/worker-{build,types,tests,lint,preview}.txt`.

## Remaining deployment steps — not executed

Deployed **secret presence is unverified**. Read-only `wrangler secret list` was attempted,
but Cloudflare authentication was unavailable. Local preview bindings are not evidence of
deployed secrets. In an authenticated terminal, check names only:

```sh
npx wrangler secret list --name vowpal
```

Confirm DATABASE_URL and ADMIN_AUTH_SECRET are secret bindings for the correct Worker/environment.
If absent, set them through hidden/interactive Cloudflare secret entry (never paste values into chat
or command arguments). Use the intended existing hosted database URL; do not deploy a local URL.
Do not change the existing auth secret casually: that invalidates existing sessions.
DIRECT_URL is CLI-only and is not required by the running Worker.

The old Wrangler file contained database credentials in source and an initial diagnostic read
exposed them in tool output. Those literals were removed from the working file, but history and
prior output remain. Rotate them separately with explicit authorization; this task did not change
database/account passwords or rewrite history.

When deployment is separately authorized, use the tested npm build, preserve the custom entry,
confirm runtime secret names, deploy, then repeat login against the deployed Worker. No push,
deployment, production database connection, schema migration or real message occurred here.

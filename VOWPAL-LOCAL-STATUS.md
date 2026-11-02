# VowPal local implementation — 2026-11-02

Work remains on `dev`, uncommitted. No production database access, push, deployment, messages or paid API calls were performed by this session. Existing work and concurrent demo setup changes were preserved.

## Implemented

- Impeccable 4.8.0 was available in the runtime catalog; SKILL.md was read and its context command completed once. Hook configuration exists in `.codex/hooks.json`; project-hook approval is not observable through this tool surface. A manual detector pass found only documentation advisories, which were passed to the documenter.
- VowPal branding, white navigation/work panels, cool neutrals, deep-teal primary/selected states, icon/text desktop navigation, retained phone navigation, and neutral controls throughout the planning screens. Existing household/allowance/role behavior remains. Couple-authored invitation content and the scoped guest invitation style remain intact.
- Public homepage with household/event examples explicitly marked illustrative, supported feature descriptions and sign-in/open-planner links. No signup, pricing or fabricated customer claims.
- Private vendor attachments in the Edit vendor dialog: PDF/PNG/JPEG, signature/extension validation, streamed request size limit, maximum 5 MB per file, authenticated download, same-origin writes, wedding access checks and recoverable removal. Downloads are attachments with no-store, nosniff and sandbox headers. Bytes live in PostgreSQL `VendorContract.content`, outside public uploads; no cloud bucket or paid storage service was configured.
- Two local migrations add attachments and deny Supabase Data API access with RLS/revoked grants. Prisma continues to authorize server-side. No hosted migrations were applied.
- Corrected local request origin validation after an actual upload smoke test exposed Next's normalized internal hostname.
- Local dev wrapper now checks DIRECT_URL before starting/migrating. Normal and demo startup now reject hosted or mismatched targets, and pin ports 3000 and 3002 respectively.
- React lint issues addressed in derived date errors, scheduling interactions, action-completion handling, saved section state, envelope lifecycle and scroll reveal. Reduced-motion envelope opening skips animation; collapsed sections are inert.
- Source-derived DESIGN.md and `.impeccable/design.json` updated by the Impeccable documenter. Guest invitation tokens remain separately scoped.

## Verified

- Actual local PostgreSQL listener: 127.0.0.1:54330. Development database: `rsvp_dev`. Current schema includes Event.itinerary and all Guest.excluded*Count fields.
- All 29 migrations replayed successfully into a newly created isolated test database. Prisma migrate diff reports no schema difference. No database was reset.
- Final suite: 138 tests passed across 23 files, including real allowance/workspace isolation and real contract upload/read/remove/RLS tests. Final log: `.local/account-tests-full.txt`.
- TypeScript passed. ESLint passed with two existing warnings in the Next Image test mock. Build passed with DATABASE_URL and DIRECT_URL explicitly pinned to local Postgres. The build still reports the existing middleware-to-proxy deprecation.
- Local production HTTP smoke check: homepage, login, Overview, Guests, Events, event creation/detail/edit, Budget, Vendors, Settings, Weddings, Users and Activity returned 200. A guest invitation response excluded private schedule notes. Synthetic contract upload/download/remove/removed-download returned 201/200/204/404. Report: `.impeccable/review/vowpal/http-results.json`.

## Demo cleanup and backups

A concurrent session changed `scripts/local-db.mjs`, `scripts/dev.mjs`, `scripts/seed-demo.ts`, `prisma/seed.ts`, `prisma.config.ts` and package scripts to separate demo data and clean old demo rows. Those changes were preserved. This session did not repeat its deletion. A subsequent read-only cleanup inventory confirmed zero demo users/weddings/events/guests/vendors/budget records in `rsvp_dev`; the three real accounts and real wedding remained.

- Existing cleanup backups: `.local/backups/demo-cleanup-2026-11-02T20-29-12-380Z.json` and `.local/backups/pgdata-before-demo-cleanup-2026-11-02T20-29-12-380Z/`.
- Additional private snapshot taken before this session's data work: `.local/vowpal-backups/database-1793651399562.json` (mode 0600).
- Original working diff: `.local/vowpal-backups/before-vowpal.patch`.
- Backups contain private data and remain git-ignored. Do not upload them.
- Do not restore the full cluster snapshot over newer work without review; it predates the attachment migrations. The separate row snapshot also remains available.

## Start locally

For the real local workspace:

```sh
npm run dev -- --hostname 127.0.0.1
```

For fictional demo data, the preserved setup provides:

```sh
npm run db:demo:seed
npm run dev:demo -- --hostname 127.0.0.1
```

The canonical normal development app is `http://127.0.0.1:3000/admin/login` on `rsvp_dev`.
The old unlabelled port-3001 demo preview was stopped. Explicit `npm run dev:demo` uses port 3002,
`rsvp_demo`, a visible demo banner, a separate cookie and `.next-demo` cache. No demo seed runs
on normal startup. See `LOCAL-ACCOUNT-ACCESS.md` for the account investigation and hidden password setup.

Fresh isolated test replay (creates a new test database and retains it for inspection):

```sh
node scripts/vowpal-test-db.mjs
```

`vowpal-http-smoke.mjs` now targets the explicit port-3002 demo with its separate cookie; it is not part of normal startup. For authentication regression checks, use the isolated synthetic test:

```sh
node scripts/test-local-sign-in.mjs
```

## Still open

**Visual verification is blocked, not passed.** The browser access host is unavailable; native Chrome access timed out twice. A request to use local terminal Playwright is pending. Existing PNGs in `.impeccable/review/` belong to the old paper/plum design. They are not after screenshots. The independent finish reviewer returned **disposition: recapture**, requiring current 1440px desktop and 390px mobile captures of planning routes and contract states before a full visual review. No browser interaction or mobile layout result is claimed from HTTP checks.

The handoff did not contain the original detailed screen/contract specification; clarification is pending. Contract permissions currently follow the existing wedding-member/platform-administrator model. Verify any more restrictive original requirement before calling the entire original scope complete.

**Credential rotation remains external.** The working-tree copy scan found password-bearing database URLs only in the intended ignored `.env.local`. A scan of all files in committed HEAD found four actual password-bearing URLs in `.claude/settings.json`; the working settings have already removed them. Git history still exposes that credential. The service owner must rotate the affected hosted Postgres password and update dependent DATABASE_URL/DIRECT_URL values in local environments, deployment environments and any database tooling. No credentials were printed, no history was rewritten, and no remote service was changed.

Attachments use database storage. Account for retained soft-deleted bytes in backup/storage capacity. Upload validation checks type, extension and magic bytes; no malware scanner was added. Production suitability, hosted migration execution and storage capacity remain unverified and outside this local-only run.

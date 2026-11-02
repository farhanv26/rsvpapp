# RSVP Event App

Mobile-first wedding RSVP app: Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL.

## Stack

- Next.js 16 App Router
- TypeScript · Tailwind CSS · Zod
- Prisma ORM · **PostgreSQL**
- Server Actions
- Admin routes protected by **per-account bcrypt password + signed session cookie** (`ADMIN_AUTH_SECRET`, `jose` JWT)

## Features

- Multi-event admin at `/admin/events` (password required)
- Event CRUD, optional invitation image, wedding fields
- Guest CRUD + CSV import, filters, search, RSVP links with copy
- Public RSVP at `/rsvp/[token]` with one-time lock (unchanged logic)

## Environment variables

Copy `.env.example` to `.env.local` and set (for local development the database URLs are overridden by `.env.development.local`, see below):

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | **Runtime Prisma Client URL** (Supabase pooler `:6543`) with `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | **Prisma CLI URL** for migrations/introspection (direct DB host `:5432`) |
| `NEXT_PUBLIC_APP_URL` | Public site URL for **absolute RSVP links** in admin (e.g. `https://your-app.vercel.app`) |
| `ADMIN_AUTH_SECRET` | **At least 16 characters** — signs the admin session JWT cookie |
| `SUPABASE_URL` | Supabase project URL used for Storage uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key used to upload invite cards to Supabase Storage |
| `SUPABASE_STORAGE_BUCKET` | Optional Storage bucket name (default: `event-invites`) |

**Optional:** On Vercel, `VERCEL_URL` is set automatically. `getPublicSiteUrl()` uses it as a fallback if `NEXT_PUBLIC_APP_URL` is unset (server-side). For consistent copy/paste links, set `NEXT_PUBLIC_APP_URL` to your canonical domain.

## Local development

Normal development uses only PostgreSQL at `127.0.0.1:54330/rsvp_dev`, stored under
`.local/postgres` (git-ignored). It does not synchronize with hosted accounts or copy hosted guest data.

### First time and local password setup

```sh
npm install
npm run db:local:setup
npm run dev
```

Leave that server running. In a second terminal in this project:

```sh
npm run local:account
```

Choose and confirm your local password at the hidden terminal prompts. Do not place it in a
command argument, environment variable, file or chat. The command refuses piped input and
production/CI use. It targets only `127.0.0.1:54330/rsvp_dev`, ignoring inherited database URLs.
It preserves an existing Farhan account's ID, role, memberships and data; if absent, it creates
one local Farhan administrator. An inactive/deleted local Farhan is restored under the same ID.
It verifies the hash and attempts an actual HTTP login plus protected overview request, explicitly
reporting whether sign-in passed. No password or session cookie is logged or saved.

Canonical URL: `http://127.0.0.1:3000/admin/login`. Account name: `Farhan`.
Names ignore surrounding whitespace and case. Passwords retain whitespace and case.
The login page has no account-name directory. Local credentials are independent of hosted credentials.
Historical migration `20260414235500` can create `seed_farhan` with an unusable placeholder hash;
this interactive command fixes that local placeholder without replacing its identity.

### Every day

```sh
npm run dev
```

The wrapper checks both database URLs before starting Postgres or applying migrations. It permits
only the named local database on port 54330, pins port 3000 explicitly, and never seeds demos.
It fails if that port is occupied instead of silently switching to another port. Do not use raw
`dev:next` as the normal entry point: it bypasses these wrapper checks.

Next's environment-file precedence still applies, but a hosted/mismatched URL makes the wrapper
refuse startup. `next build` and `next start` do not load `.env.development.local`; explicitly pin
both database URLs when running local build/production-mode tests.

### Fictional demo environment (optional)

```sh
npm run db:demo:seed
npm run dev:demo
```

Only this explicit seed command populates `rsvp_demo`. Demo startup uses port 3002, a separate
`.next-demo` cache, a visible fictional-data banner and a separate session cookie. It never uses
normal Farhan credentials. Port 3001 is not the normal development environment.
Do not run demo seeding during ordinary startup. It is not registered as an automatic Prisma seed.

### Local database maintenance

- `npm run db:local:status`: local listener and migration status.
- `npm run db:local:start` / `npm run db:local:stop`: start/stop the persistent local server.
- `npm run db:local:migrate`: apply committed migrations locally.
- `node scripts/local-access-audit.mjs`: safe local account/port/seed inventory; no passwords or hashes.
- `npm run db:local:remove-demo`: read-only inventory by exact known seed identifiers. Review ownership
  and ambiguity before using its explicit mutation option. Recoverable backups are required before removal.
- `npm run db:local -- prisma <args>`: Prisma commands explicitly targeting the local workspace.
- `node scripts/vowpal-test-db.mjs`: replay migrations and run tests in a new disposable local database.

The legacy `db:local:import-users` command contacts the source database in `.env.local`; it is not
part of local account setup and is not needed. Do not run it for this local-only workflow.
Database resets are destructive and are not part of normal startup or account repair.

### Schema changes

Create migrations with `npm run db:local -- prisma migrate dev --name <change>` and commit the
generated folder. A fresh database must be reproducible from committed migrations alone:
`npm run db:local:reset -- --yes` followed by
`npm run db:local -- prisma migrate diff --from-url postgresql://postgres@127.0.0.1:54330/rsvp_dev --to-schema-datamodel prisma/schema.prisma --exit-code`
should report no difference. Do not use `prisma db push` against shared databases.

### Production scripts

- `npm run db:deploy` — apply migrations in CI/production (`prisma migrate deploy`, uses `DIRECT_URL` from the environment)
- `npm run db:seed` — manually invoked bootstrap script; never automatic and not the local password-setup flow

## Moving from SQLite (older clones)

If you still have `file:./dev.db` and SQLite migrations:

1. Export data if needed, then switch `DATABASE_URL` to PostgreSQL.
2. Run `npx prisma migrate deploy` against the new database.
3. Remove old `prisma/dev.db` locally if present.

Current migrations target **PostgreSQL** only (`prisma/migrations/.../init_postgres`).

## Admin authentication

- All routes under `/admin` except `/admin/login` require a valid **HTTP-only cookie** (`admin_session`) with a signed JWT.
- **Sign out** clears the cookie (top bar on admin pages).
- Do not commit real passwords; use strong values in production.

## Absolute RSVP links

- **`NEXT_PUBLIC_APP_URL`** should match your live site (including `https://` and no trailing slash).
- The event dashboard passes `getPublicSiteUrl()` into the guest list so **Copy link** uses the correct origin on the server.
- Fallback order: `NEXT_PUBLIC_APP_URL` → `VERCEL_URL` (server) → relative `/rsvp/...` if neither is set.

## Uploads

Invite card uploads use **Supabase Storage** and store the durable public URL in `Event.imagePath`.
Local filesystem fallback has been removed to keep production-safe behavior on serverless platforms.

Rendering is defensive: if image URL/path is missing or malformed, admin and RSVP pages show a graceful placeholder instead of crashing.

## CSV bulk import

Sample file: `public/samples/guests-import.csv`.

**Required columns:** `guestName`, `maxGuests`. **Optional:** `group`, `notes`, `phone`, `email`.

1. Open an event dashboard → **Import guests from CSV** → paste or upload → **Preview** → **Import**.  
2. Invalid rows show errors. Names already on the guest list are **skipped**; duplicate names in the file only import the **first** row.

## Deploying to Vercel (private live test)

### 1. Create a hosted Postgres database

Examples: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app). Copy the connection string (usually with `?sslmode=require`).

### 2. Push the project to GitHub and import in Vercel

Connect the repo; leave defaults or set **Root** if the app lives in a subfolder.

### 3. Environment variables in Vercel

In **Project → Settings → Environment Variables**, add for **Production** (and Preview if you want):

- `DATABASE_URL` — **Supabase pooler URL** on port `6543` with `?pgbouncer=true&connection_limit=1&sslmode=require`  
- `DIRECT_URL` — **direct DB URL** on port `5432` (for Prisma migrate/introspect)  
- `NEXT_PUBLIC_APP_URL` — `https://<your-deployment>.vercel.app` or your custom domain  
- `ADMIN_AUTH_SECRET` — long random string (32+ characters)  

Do **not** rely on `VERCEL_URL` alone for links if you use a custom domain — set `NEXT_PUBLIC_APP_URL` to that domain.

### 4. Build & deploy settings

Default **Install Command:** `npm install` (runs `postinstall` → `prisma generate`).

**Build Command** — use migrations before Next build:

```bash
npx prisma migrate deploy && npm run build
```

Or: `npm run db:deploy && npm run build` (same idea).

**Start Command:** `npm start` (default).

### 5. First deploy

After the first successful deploy, open your site URL, go to `/admin/login`, sign in, and create an event.

### 6. Smoke test

1. Create event + guest.  
2. Copy RSVP link — should start with `https://` and your `NEXT_PUBLIC_APP_URL`.  
3. Open `/rsvp/[token]` in a private window and submit RSVP.  
4. Confirm admin dashboard updates.

## Local test flow (RSVP)

1. `/admin/login` → `/admin/events` → create event.  
2. Add a guest; copy link.  
3. Open `/rsvp/[token]`; submit RSVP.  
4. Confirm dashboard stats.

## Guest metadata (admin only)

Optional fields `group`, `notes`, `phone`, `email` on guests are for admin use and are not shown on the public RSVP page unless you add that later.

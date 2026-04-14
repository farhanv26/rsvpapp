# RSVP Event App

Mobile-first wedding RSVP app: Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL.

## Stack

- Next.js 16 App Router
- TypeScript · Tailwind CSS · Zod
- Prisma ORM · **PostgreSQL**
- Server Actions
- Admin routes protected by **password + signed session cookie** (`ADMIN_PASSWORD`, `ADMIN_AUTH_SECRET`, `jose` JWT)

## Features

- Multi-event admin at `/admin/events` (password required)
- Event CRUD, optional invitation image, wedding fields
- Guest CRUD + CSV import, filters, search, RSVP links with copy
- Public RSVP at `/rsvp/[token]` with one-time lock (unchanged logic)

## Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | **Runtime Prisma Client URL** (Supabase pooler `:6543`) with `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | **Prisma CLI URL** for migrations/introspection (direct DB host `:5432`) |
| `NEXT_PUBLIC_APP_URL` | Public site URL for **absolute RSVP links** in admin (e.g. `https://your-app.vercel.app`) |
| `ADMIN_PASSWORD` | Shared password for all `/admin/*` routes (except `/admin/login`) |
| `ADMIN_AUTH_SECRET` | **At least 16 characters** — signs the admin session JWT cookie |
| `SUPABASE_URL` | Supabase project URL used for Storage uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key used to upload invite cards to Supabase Storage |
| `SUPABASE_STORAGE_BUCKET` | Optional Storage bucket name (default: `event-invites`) |

**Optional:** On Vercel, `VERCEL_URL` is set automatically. `getPublicSiteUrl()` uses it as a fallback if `NEXT_PUBLIC_APP_URL` is unset (server-side). For consistent copy/paste links, set `NEXT_PUBLIC_APP_URL` to your canonical domain.

## Local development

### 1. PostgreSQL

Use Docker (example):

```bash
docker run --name rsvp-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvpapp -p 5432:5432 -d postgres:16
```

Point both `DATABASE_URL` and `DIRECT_URL` at that instance (for local Postgres they can be the same URL).

### 2. Install and migrate

```bash
cp .env.example .env
# Edit .env: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_APP_URL, ADMIN_PASSWORD, ADMIN_AUTH_SECRET

npm install
npx prisma migrate deploy
npm run db:seed   # optional
npm run dev
```

Open `http://localhost:3000`. Admin: `http://localhost:3000/admin/login` → then `/admin/events`.

### 3. Scripts

- `npm run db:migrate` — create/apply migrations in dev (`prisma migrate dev`)
- `npm run db:deploy` — apply migrations in CI/production (`prisma migrate deploy`)
- `npm run db:seed` — seed data

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
- `ADMIN_PASSWORD` — strong shared password  
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

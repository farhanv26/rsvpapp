# Local account access — 2026-11-02

The canonical URL is **http://127.0.0.1:3000/admin/login**. The exact account name is **Farhan**.
The app is running locally. Leave it running and use a second terminal in this project:

```sh
npm run local:account
```

Choose and confirm a local password at the hidden prompts. Nothing is echoed; passwords are
never placed in chat, arguments, environment variables, files or logs. The command requires
an interactive terminal, rejects production/CI, and targets only `127.0.0.1:54330/rsvp_dev`.
It ignores inherited database URLs and cannot change a hosted account. It preserves Farhan's
existing ID, name, role, memberships and wedding/guest data. It updates the local hash and restores
a disabled/deleted local Farhan if needed. If Farhan is absent, it creates one local administrator;
ambiguous case-colliding records cause refusal. No setup runs automatically during app startup.

After saving the chosen password it checks bcrypt and performs the actual local login-form POST,
then requests the protected overview with the resulting in-memory cookie. It reports explicitly
whether that sign-in test passed. A saved hash alone is not reported as successful sign-in.

## What caused the failure

Both ports originally served `/Users/farhanv/Development/projects/rsvpapp`:

- Port 3000, process 72385 at investigation time: Postgres `127.0.0.1:54330/rsvp_dev`.
- Port 3001, process 93554 at investigation time: Postgres `127.0.0.1:54330/rsvp_demo`.

These targets were verified by correlating each process's TCP client ports with Postgres
`pg_stat_activity`, not merely by reading environment files. Only safe host/port/database details
were emitted. Process IDs change when servers restart.

Port 3001's Farhan was **seed_farhan**, created by historical migration `20260414235500` to backfill
ownership. It was active and not deleted, but had an unusable placeholder hash. It is not the
existing real local Farhan identity and cannot authenticate with a usual password. Demo account
names on that login page were actual query results from `rsvp_demo`, not hard-coded options.
The homepage separately contains a labelled illustrative wedding example.

The normal database's Farhan is **cmnz2ukhp0001u3d0guakrj2x**, active, not deleted, and already
`super_admin`. It has a valid bcrypt hash, zero direct wedding memberships and zero directly owned
events/managed guests; its existing platform-admin role already permits review access. Its hash
matches the private pre-cleanup local snapshot. No Farhan password, role, membership or data was
changed during this investigation. The secure interactive command awaits your chosen password.

Local accounts are independent database records, not a live connection to hosted authentication.
The demo placeholder never acquired hosted credentials. The existing normal local hash may reflect
an earlier local import/snapshot; its current equality to the hosted hash was not checked, because
no hosted database was contacted. No conclusion that your usual password is wrong is warranted.

## Login behavior fixed

Previously the public login page queried and listed all active account names. It now renders a
plain typed account-name field and does not query or serialize an account directory.

Identifiers are trimmed and matched case-insensitively. Passwords are never trimmed or lowercased;
bcrypt comparison preserves their case and whitespace. Empty/invalid hashes, inactive/deleted
accounts, unknown names and ambiguous case-colliding accounts fail without a session. Errors are
generic and do not echo submitted names in URLs. Existing account roles and authorization rules remain.

Normal development binds port 3000 explicitly and refuses a hosted, wrong-port or wrong-database
URL before migration/startup. It cannot silently fall back to port 3001. Both database URLs are
passed explicitly to the Next child process. The obsolete remote-development override is no longer
accepted by this guarded local entry point.

## Demo inventory and preservation

The known seed is identified by the three exact demo account IDs, wedding key `demo-aisha-omar`
and exact `demo-mehndi`, `demo-nikkah`, `demo-reception` slugs. Source and ownership were inspected;
no prefix-based deletion was performed.

The normal `rsvp_dev` inventory contains zero seed users, weddings, events, household invitations,
vendors, budget lines or payments. Therefore no additional cleanup deletion was necessary. Genuine
accounts and the genuine local wedding were preserved. The earlier cleanup's recoverable backups remain:

- `.local/backups/demo-cleanup-2026-11-02T20-29-12-380Z.json`
- `.local/backups/pgdata-before-demo-cleanup-2026-11-02T20-29-12-380Z/`
- `.local/vowpal-backups/database-1793651399562.json` (private pre-cleanup snapshot)

The separate `rsvp_demo` retains three seed users, one wedding, three events, 62 household-event
invitations, three vendors, four budget lines and one payment. Three soft-deleted synthetic contract
rows came from the earlier local smoke checks, not the seed. These preview records were retained
in their separate environment. Uncertain records were not deleted.

The unlabelled port-3001 server was stopped. Explicit `npm run dev:demo` now uses port 3002 with
a fictional-data banner, separate session cookie and `.next-demo` cache. Neither normal nor demo
startup calls the seed. The only seed entry point is an explicit demo seed command, and it refuses
normal/hosted databases. The demo is optional; use the canonical URL above for your own account.

## Evidence and remaining step

- 138 tests passed across 23 files in a disposable local test database, including real bcrypt,
  inactive/deleted accounts, identifier normalization, generic rejection and session creation.
- A separate built HTTP test passed actual form submission and protected overview access using
  a disposable account/random in-memory secret in that test database. It also rejected a changed
  password and an inactive account. It never touched or signed in Farhan.
- TypeScript and build passed. ESLint has no errors and two existing image-test warnings.
- Runtime HTTP checks show no account directory on the normal or demo login page. Normal has no
  demo banner; the explicit demo has its fictional-data banner.
- Non-interactive password setup and production-mode worker invocation were verified to refuse.

**Your Farhan sign-in has not been confirmed.** Run `npm run local:account` to choose the local
password; the command tests and reports the result. No production connection, guest-data copy,
hosted password change, push or deployment occurred. Redesign work is paused while access is resolved.

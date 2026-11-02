# VowPal restart handoff — 2026-11-02

The full VowPal request in this conversation remains the scope. Installation is complete; application development has not started. Preserve all pre-existing uncommitted Cursor work and stay on `dev`. Do not push, deploy, contact production databases, send messages, use paid APIs, reset databases, or discard work.

## Verified this session

- Read root AGENTS.md and Next 16.2.3's installed environment-variable guide. Read relevant installed framework guides before each code change.
- Inspected initial git status: substantial modified/untracked UI files, PRODUCT.md, DESIGN.md, .impeccable, Claude skills and agent files already existed. No initial Codex Impeccable skill or hook.
- Read https://impeccable.style/docs/ and https://github.com/pbakaus/impeccable. Installed using the official command `npx impeccable install --providers=codex --scope=project --yes` (network permission approved).
- Installer reports skill 4.8.0 and engine 0.1.18 for darwin-arm64. Installed `.agents/skills/impeccable/` and `.codex/hooks.json`; other agent configurations were preserved. Read installed SKILL.md; launcher `--version` returns 4.8.0. Runtime skill discovery and hook activation require verification after reload. Official README explicitly says reload, and Codex `/hooks` requires project-hook approval.
- Current HEAD `.claude/settings.json` contains four password-bearing Postgres URL occurrences and references hosted Supabase. Working settings already contain zero password-bearing Postgres URLs: Cursor removed them before this session. Never print the secret. Rotation is still required; history retains it. Other tracked copies and affected services remain to investigate.
- Used `@next/env` in development mode without printing credentials: DATABASE_URL and DIRECT_URL resolve to host 127.0.0.1, port 54330, database /rsvp_dev, from `.env.development.local` before `.env.local`. This proves current environment resolution only, NOT active Next process connection, database availability/schema, or test/Prisma targets.
- Read scripts/dev.mjs and first part of scripts/local-db.mjs. Dev wrapper guards remote DATABASE_URL but allows an explicit override, and starts/migrates embedded local Postgres. Review DIRECT_URL handling and all CLI/test targets before running database commands. Raw Prisma commands may load different env files.
- Existing remove-demo implementation uses name/slug/id prefixes; it is NOT verified safe. Do not run it. Need exact seed provenance, dry run, recoverable backup, protection for genuine/ambiguous records, then scoped cleanup.

## Restart

Exit this Codex session, then in this project run `codex resume --last`. Open `/skills` and confirm `impeccable`; open `/hooks` and approve the project's Impeccable hook. Then send: `$impeccable Continue the full VowPal task from VOWPAL-HANDOFF.md. Verify the local baseline before UI changes.`

## Progress checklist

- [x] Inspect branch/working tree and initial instructions.
- [x] Install official project-scoped Codex Impeccable and read instructions; verify launcher.
- [ ] After restart, verify runtime discovery and hook approval; run skill context once, read required workflow references.
- [ ] Verify actual processes, isolated database use for Next/Prisma/tests, migrations and fresh replay/schema comparison (especially Event.itinerary and Guest.excluded*Count); run baseline checks.
- [ ] Complete secret-copy scan without outputting credentials; document rotation and services.
- [ ] Audit seed provenance; backup and dry-run cleanup, remove only proven disposable local records; fix login directory.
- [ ] Inspect rendered app; replace rejected paper/plum identity with VowPal's white/neutral/deep-teal design, beginning with shell and Guests; update context/configuration.
- [ ] Complete all requested screens and business-rule/security verification.
- [ ] Inspect existing private-contract implementation, complete storage/permissions/validation/UI and isolated tests.
- [ ] Homepage with truthful feature claims and working calls to action.
- [ ] Desktop/mobile before/after screenshots, per-screen critique/correction, meaningful tests, typecheck, lint and build.
- [ ] Final exact startup instructions, cleanup results, rotation/storage requirements and remaining defects/unverified behavior.

No tests, browser verification, migrations, cleanup or UI edits were performed this session. Existing screenshots under `.impeccable/review` belong to previous work and are not current verification.

## Continuation update — 2026-11-02

The installation-only status above is historical. Implementation, local migration replay, private contracts, homepage and tests have now been completed locally; see `VOWPAL-LOCAL-STATUS.md` for exact evidence and startup instructions. Final tests: 130 passed. TypeScript, lint (two existing test warnings) and build passed. All planning route HTTP smoke checks passed. No production/push/deploy occurred.

Current visual finish disposition is **recapture**, not ship: browser host unavailable, native Chrome timed out, local Playwright permission pending. Old screenshots are not current verification. Capture 1440px/390px planning screens and contract states, then return to the finish reviewer. Credential rotation and original detailed requirements also remain outstanding as documented in the local status file.

## Account-access correction — 2026-11-02

Port 3001 was the isolated demo database, whose Farhan is the migration placeholder with an invalid
hash. Normal `rsvp_dev` has the existing active Farhan super admin, preserved unchanged. The old
3001 server is stopped. Canonical local login: http://127.0.0.1:3000/admin/login, identifier Farhan.
Run `npm run local:account` in an interactive terminal for hidden, local-only password setup and an
automatic real HTTP sign-in check. Login no longer exposes an account-name directory. Explicit demo
startup uses port 3002, a banner, separate cookie and cache; no normal startup seeds demos.
See `LOCAL-ACCOUNT-ACCESS.md`. 138 isolated tests and synthetic HTTP sign-in passed; Farhan's own
sign-in awaits the user-chosen local password and has not been claimed successful. No hosted access.


## Connected finance update — 2026-11-02

See VOWPAL-FINANCE-STATUS.md for the current focused implementation and evidence. Canonical port 3000/rsvp_dev now has connected vendor/expense/payment pages, coral/neutral shared tokens and 10 MB private contracts. Additive migration applied locally; all 30 migrations replayed, 149 tests passed, TypeScript/lint/build passed (two existing lint warnings). Fifty pre-existing rows remained unchanged. Synthetic CAD scenario and real file-byte operations passed. Visual acceptance remains recapture: Chrome control times out and alternative browser automation permission is unanswered. No current finance before/after captures exist. Older teal direction and older completion claims above are historical, superseded for this scope. No push/deploy/production access.

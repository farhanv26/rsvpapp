# Connected finance — 2026-11-02

Implemented and verified locally, including rendered desktop (1440×1000) and phone (390×844) walkthroughs.
The independent Impeccable reviewer requested two fixes, then returned **ship** for both resolved fixes.
Before screenshots are explicitly reconstructed from preserved source; after screenshots use the canonical app.

## Local review

- Canonical app: http://127.0.0.1:3000/admin/vendors
- Database: Postgres `127.0.0.1:54330/rsvp_dev`. No hosted database contacted.
- Login: `Farhan`. Secure hidden local password setup and HTTP sign-in check:
  `npm run local:account` in an interactive terminal. See LOCAL-ACCOUNT-ACCESS.md.
- Review wedding: **[Fixture] VowPal finance**, selected through Weddings. These synthetic records
  are isolated from genuine weddings and are never seeded during startup.
- Vogue: `/admin/vendors/cmvzsg56s000167h3y5s252ff`.
- Linked expense: `/admin/budget/cmvzsg57o000667h3j65vru3g`.
- Optional demo port 3002 is not the acceptance environment.

## Verified causes and fixes

1. Old vendor dialogs lived inside a `text-right` table cell and inherited its alignment.
   Shared dialogs now use logical `text-start`, preserving legitimate RTL support.
2. One tall form combined contacts, quotes, notes and contracts beneath Save. Dedicated vendor
   details now separate compact edit, cost, payment and saved-vendor upload tasks.
3. Old Add to budget silently copied a booked vendor's quote into agreed cost. Reproduced through
   the actual canonical app before replacement: `.local/finance-before/reproduction.json`.
   Booking and quote edits now change no expense amounts; cost confirmation/linking is explicit.
4. Old math clamped overpayments to zero. Signed balances now surface overpayments; recording
   or editing an overpayment requires confirmation.
5. Old payments lacked editing, recoverable removal, version checks and request idempotency.
   The new API checks versions and locks the wedding during financial mutations.
6. Contract UI/API/storage enforced 5 MB. All now enforce 10 MB; Next's multipart proxy buffer is
   11 MB so an exact 10 MB file plus form overhead reaches route validation intact.

## Financial model and mapping

`BudgetItem` remains the canonical expense, optionally linked to Vendor/Event. Existing
`BudgetPayment` rows stay linked to that same expense. Both pages read the same active payments.
No new duplicate financial table or quote-to-expense backfill was introduced. Money stays in
integer minor units.

- Planned budget: separate nullable wedding amount.
- Expected cost: agreed cost when present, otherwise estimate, preserving existing per-person math.
- Paid: active recorded payments; recording does not process a bank/card transfer.
- Outstanding: expected minus paid, including negative overpayments.
- Remaining budget: planned budget minus expected cost.
- Existing due dates are reminders. There is no installment schedule in the current schema;
  the UI does not claim these are overdue scheduled debts.

The simple one-vendor/one-expense flow confirms an existing estimate in place. Multiple services,
events and non-vendor expenses remain supported. Similar expense links and suspected legacy
quote-derived agreements are flagged conservatively for review, never merged/deleted automatically.
Deliberately reviewing/saving an expense clears the legacy marker; existing values remain preserved.

Local additive migration: `20261102210000_connected_finance`. Adds planned budget, versions,
request keys, payment metadata/soft removal and contract digest keys; updates the size constraint.
It does not rewrite existing IDs, links or amounts. All 30 migrations replayed and schema comparison
passed. Private recoverable backup: `.local/vowpal-backups/database-1793654509310.json`.
Final comparison checked **50 pre-existing rows: zero changed values**, excluding new columns.
All unrelated uncommitted work remains in place.

## Contracts and forms

Private database byte storage and authenticated wedding-scoped routes remain. Server validation
checks MIME/signature/extension/size. Preview/download access was not broadened. Upload supports
picker/drop, pending/error/retry, filename/size/date and actions. Vendor/content digests deduplicate
retries; removal is recoverable.

Finance dialogs retain entered values after failures, synchronously block duplicate submissions,
close on success and confirm dirty Cancel/Escape. Native dialogs provide focus management,
bounded body scrolling and reachable footer actions. Unrelated screens retain their old submit
wrapper; finance no longer uses its premature auto-close behavior.

Shared planning tokens now use charcoal, white/light neutrals and warm coral/vermilion. Invitation
styling remains separately scoped. The shipped documenter updated DESIGN.md and its sidecar from
actual source without claiming rendered acceptance.

## Checks actually run

- Final full suite: **149 passed, 25 files, zero skipped**, disposable Postgres database
  `rsvp_vowpal_test_1793655880473`. Covers concurrency, stale versions, changed-payload retries,
  payment edits/removal, invalid amounts/dates, overpayment, cross-wedding denials, contracts and
  dialog value retention/failure/duplicate-submit behavior.
- Canonical HTTP CAD scenario: budget 20,000; Vogue agreed 5,500; payment 1,000; agreed edited
  to 5,800; separate clothing estimate 200. Final expected **6,000**, paid **1,000**, outstanding
  **5,000**, remaining budget **14,000**; Vogue remaining **4,800**. Payment edited to 1,200,
  both pages recalculated, then restored to 1,000. Existing-fixture verification rerun passed.
- Real canonical PDF/JPG/PNG upload/preview/download byte round-trips passed and retries retained
  one active record per digest. Images decoded; synthetic PDF one-page structure verified.
  **Browser PDF rendering remains uninspected.**
- Built HTTP boundary test on disposable database/port 3003: exact 10 MB upload/download matched,
  retry deduplicated, 10 MB + 1 byte rejected. Temporary server stopped.
- TypeScript and final build passed. Lint: zero errors, two existing image-test warnings.
  Build reports the existing middleware-to-proxy deprecation warning.
- One Impeccable detector pass: no primary findings, palette/type advisories against the old docs.
  Independent finish reviewer: **recapture**, because required finance captures are missing.
- Reports: `.impeccable/review/finance/`; logs: `.local/finance-*.txt`.

## Historical visual blocker — resolved below

Native Chrome control repeatedly timed out, including a final retry; browser-host control is
unavailable. Permission for terminal Playwright/Chrome remains unanswered; it was not run.
The temporary Finder window used for recovery was closed.

Capture Vendor detail, Budget, open Record payment and Contracts before/after at widths 1440 and
390. Old guest-screen screenshots are invalid for this task. Original source was preserved in
`.local/finance-before/`; label any reconstructed baseline honestly. Inspect mobile reachability,
keyboard focus, long filenames, empty/error/upload states and rendered preview, then submit the
complete capture set to the independent reviewer. Do not mark visual acceptance complete first.

No production changes, pushes, deployments, real payments or messages occurred.

## Redesign continuation after Prisma runtime correction (earlier source checks)

Canonical development was restarted on port 3000 with both database URLs explicitly pinned to
local rsvp_dev and message API keys disabled, without running migrations. Existing Prisma/Worker
changes were preserved. The existing CAD fixture was checked read-only through the current app:
expected CAD 6,000, paid CAD 1,000, outstanding CAD 5,000, remaining budget CAD 14,000;
Vogue remaining CAD 4,800. Existing synthetic PDF/JPG/PNG byte round-trips passed again.

Fixed a newly verified payment-date mismatch: the form used the UTC day while the server checked
the wedding timezone. New payments now default to and are bounded by the same wedding calendar
day as server validation. Existing recorded dates retain their calendar date. Regression tests
cover Toronto after UTC midnight and daylight-saving boundaries.

Fixed removed-contract retry behavior: an old upload retry cannot resurrect a subsequently removed
contract. Deliberately choosing the file again may restore it, while enforcing the same 20-file
limit. The upload feedback distinguishes an existing saved file from a new upload or restoration.

Current unit/UI run: 129 passed, 32 skipped in database suites that truncate tables. Those suites
were not enabled under the preserved no-reset instruction. TypeScript passed; lint has zero errors
and four existing warnings. The OpenNext Cloudflare build passed, including removal of private
environment fallbacks; nothing was deployed. Current logs: `.local/redesign-{types,tests,lint,build,files}.txt`.

Rendered acceptance remains **recapture**. The browser host is unavailable and native Chrome
control timed out again. Explicit approval for terminal Playwright/Chrome was requested and is
still pending. No visual review, screenshot comparison or browser PDF rendering is claimed.


## Final browser verification — explicit permission received

The user explicitly authorized local Playwright/Chrome. Browser tools were installed only in ignored
`.local/browser-tools/`; no production browser, database or deployment was used. Canonical acceptance
ran on **http://127.0.0.1:3000**, `rsvp_dev`. A temporary port-3004 source reconstruction was used
only for clearly labelled before captures, blocked mutating browser requests, and has been stopped.

Actual rendering found and corrected phone money overflow/decimal wrapping. Mobile vendor cost strips
now stack label/amount pairs; budget figures remain readable without horizontal scrolling. Event
filters disappear when there are no useful event choices. Source-only checks had missed those defects.
Native Chrome keyboard tests also found Tab could escape after the last dialog control; shared dialogs
now focus the first visible field and explicitly wrap Tab/Shift-Tab. Dirty Escape still confirms discard.
The reviewer then requested 44px phone disclosure targets and accurate design documentation. Both were
fixed and recaptured; the verdict was **ship**, scoped to those two scored fixes, with no regressions
observed in the affected captures. This is not a comprehensive accessibility or cross-browser audit.

### Captures

- Final desktop/phone Vendor details, Budget, Record payment, Upload contract, Edit vendor,
  Add expense, shared expense detail and Contracts: `.impeccable/review/finance/final/`.
  All sixteen captures were validated by the independent reviewer. No overflow or page errors in
  the final capture matrix.
- Before: `.impeccable/review/finance/before-reconstructed/`, including its provenance README.
  Preserved old Vendor/Budget/Dialog/Contracts/CSS source was rendered with current auth/Prisma
  and the synthetic CAD fixture. These are reconstructed comparisons, not historical screenshots.
- Failure, long-name, empty-state and actual PDF preview evidence:
  `.impeccable/review/finance/interaction/`. Native PDF rendering was visibly inspected at both widths;
  the initial blank/loading phone capture was replaced only after the real viewer loaded.

### Actual browser checks

- Initial field focus, twelve forward Tab steps contained, clean Escape, dirty Escape cancellation,
  retained values after synthetic HTTP503, and successful retry.
- Recorded a CAD 50 synthetic payment, confirmed recoverable removal and observed recalculated totals.
- Overpayment revealed an explicit confirmation checkbox; no overpayment was saved.
- From Budget, changed agreed cost5,800 → 5,900 → 5,800; Vendor and Budget tabs updated live without reload.
- Edited the existing fixture payment1,000 → 1,200 → 1,000; both screens recalculated live.
- Invalid disguised PDF rejected with file retained. A long-name PDF uploaded once after two rapid
  clicks, wrapped on the phone, and was recoverably removed. Re-uploading an existing PDF displayed
  already-saved feedback without creating another file. Actual browser download matched source bytes.
- A fresh temporary member of the other fixture wedding was denied the expense, payment mutation and
  actual contract file. The pre-existing inactive test account was preserved; the temporary account
  was deleted afterward. Empty Budget verified in that separate fixture wedding.

The canonical scenario was restored and checked: expected CAD 6,000, paid 1,000, outstanding 5,000, budget
remaining 14,000; Vogue remaining 4,800. The exact old zero-page synthetic PDF (known ID/hash/structure)
was backed up to `.local/finance-contract-fixtures/retired-zero-page.json` and soft-retired. Its duplicate
filename was not proof of duplicate content. Valid fixtures and all genuine/uncertain records remained.

Current checks: **129 tests passed**, 32 skipped in the existing truncating DB suites (not enabled under
the no-reset instruction). The targeted database-backed browser checks above ran. TypeScript and
final OpenNext Cloudflare build passed. Lint: zero errors, four existing warnings. Build retained the
existing middleware-deprecation notice. No new migration, reset, password change, push, deployment or
real message occurred in this continuation. The canonical local development server remains running.

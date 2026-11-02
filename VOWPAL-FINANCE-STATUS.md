# Connected finance — 2026-11-02

Implemented and functionally tested locally. **Visual acceptance is incomplete:** the independent
Impeccable reviewer returned `recapture`. No current finance before/after screenshots exist.

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

## Remaining visual acceptance

Native Chrome control repeatedly timed out, including a final retry; browser-host control is
unavailable. Permission for terminal Playwright/Chrome remains unanswered; it was not run.
The temporary Finder window used for recovery was closed.

Capture Vendor detail, Budget, open Record payment and Contracts before/after at widths 1440 and
390. Old guest-screen screenshots are invalid for this task. Original source was preserved in
`.local/finance-before/`; label any reconstructed baseline honestly. Inspect mobile reachability,
keyboard focus, long filenames, empty/error/upload states and rendered preview, then submit the
complete capture set to the independent reviewer. Do not mark visual acceptance complete first.

No production changes, pushes, deployments, real payments or messages occurred.

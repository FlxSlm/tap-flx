# Controlled Rebuild Roadmap

## Gate 0 — Audit only (mandatory, no coding)
- Back up repo; inspect branch, status, remotes, last commits, tests, migration history, and six PDF fixture availability.
- Identify sensitive tracked files/history; **do not print or commit raw content**.
- Map reusable modules vs refactor vs obsolete; compare current implementation with these specs.
- Propose exact database changes and staged plan; STOP for user approval.

## Gate 1 — Stabilize source contracts and parser boundaries
- Confirm actual PDF layouts and mapping (SOA/TC/CA), add sanitized regression fixtures and extraction tests.
- Separate transaction/snapshot/monthly-summary outputs; no fake BUY/SELL.
- Preserve Increment 1 APIs and tests.

## Gate 2 — Ledger, snapshot, provenance, dedup
- Additive migrations, source metadata, validated import paths, ownership, cross-source duplicate review.
- Privacy Mode supports transaction-based and monthly-only uploads.

## Gate 3 — Reconciliation MVP (research contribution)
- Quantity reconciliation by account/symbol/as-of; completeness, mismatch reasons, late import replay, audit trail.
- Tests and evidence for matched/mismatch/incomplete/review.

## Gate 4 — Dashboard analytics
- Holdings, monthly BUY/SELL counts/amounts, dividend, realized/unrealized P/L when computable, win rate with N/A for insufficient data, charts and reconciliation status.
- Avoid mock figures masquerading as real values.

## Gate 5 — Automatic Mode
- Gmail OAuth 2.0 multi-account, least-privilege scopes, n8n, provider-specific email parsing, retries/idempotency, token handling.
- Do not enable without threat review and permission verification.

## Gate 6 — Market data and valuation
- Stock Yahoo Finance primary / GOAPI fallback subject to provider terms, crypto Indodax; REST/latest price, streaming where supported; stale/delayed labels.

## Gate 7 — Final verification and reporting
- E2E, failure injection, metrics, usability review, documentation and final demo.

Every gate: implement -> automated tests -> manual checks -> documentation -> commit; **do not push without approval and secret scan**.

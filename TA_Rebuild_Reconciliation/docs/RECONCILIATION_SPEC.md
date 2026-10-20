# Portfolio Reconciliation Engine — Functional Specification

## Primary question
At a specified as-of date, do positions calculated from the opening snapshot and subsequent canonical transactions match positions reported by the provider's statement?

## Algorithm (MVP: quantity reconciliation)
1. Select a verified opening snapshot for the same account, with as-of date `t0`.
2. Select valid, accepted, nonduplicate events with effective date in `(t0, t]`, sorted deterministically by effective date and stable tie-breaker.
3. Apply quantity deltas by symbol and normalized units: BUY positive, SELL negative. Transfers, splits, mergers, and other corporate actions require explicit supported rules; otherwise mark incomplete/review.
4. Compute expected holdings at `t`.
5. Compare with snapshot at `t` per account/symbol; classify as MATCHED, MISMATCH, INCOMPLETE, or PENDING_REVIEW.
6. Persist reconciliation run, evidence, delta, parser/rule versions, and review status. Do not create fictitious transactions to make numbers match.
7. On late import/correction/duplicate resolution, invalidate and recompute affected later runs.

## Coverage constraints
- If source period does not cover all relevant transactions, mark INCOMPLETE rather than asserting a mismatch with high certainty.
- If user updates monthly-only, latest snapshot is authoritative **observed position**, while transaction-derived projection may be incomplete. Show the two separately.
- SOA activity lines can become ledger events only when all necessary fields and semantics are validated; aggregate totals go to monthly summary.
- Cross-source TC/SOA/email references require semantic duplicate matching; ambiguous matches go to human review.
- Compare equivalent assets/units; normalize 1 stock lot = 100 shares where applicable, based on source-specific semantics.
- Stock corporate actions can affect quantity; dividend cash does not change stock quantity unless source specifies another event.

## Acceptance criteria
- Correct on complete baseline + transactions + closing snapshot.
- Detect missing or duplicate transactions without silently altering data.
- Handle out-of-order/late imports and rerun.
- Surface incomplete coverage explicitly.
- User/account isolation and audit traceability.
- No false profit/win rate from insufficient cost-basis data.

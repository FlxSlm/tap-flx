# Testing and Evidence Plan

## Test layers
- Unit: PDF extraction, provider/type detection, regex field mapping, normalization, confidence, transaction identity, holdings projection, reconciliation statuses.
- Integration: frontend structured JSON -> Laravel API -> MySQL; source metadata; dedup; snapshots; multi-account isolation.
- E2E: monthly-only; transaction-based; mixed SOA+TC; dividend; late event; repeated import; malformed/encrypted PDF; incomplete source; changed layout.

## Essential scenarios
1. Opening 100 lots, BUY 30, SELL 10, closing 120 -> MATCHED.
2. Closing 110 with same ledger -> MISMATCH delta -10.
3. Missing trade and incomplete coverage -> INCOMPLETE, not confident mismatch.
4. Duplicate TC and SOA event -> counted once or review ambiguous match.
5. Late SELL effective before closing snapshot -> recompute prior run.
6. Monthly-only two SOAs -> current observed holdings update; transaction activity only if evidenced.
7. No transactions/dividends in verified complete period -> zero activity; unknown period -> N/A/incomplete.
8. Dividend cash event -> income without increasing stock quantity.
9. No closed sales -> win rate N/A; unknown cost basis -> N/A.
10. Account A cannot read/write account B data.

## Metrics
- Parser field correctness per field and provider; extraction success.
- Duplicate detection precision/recall on labeled fixture cases.
- Reconciliation classification accuracy on labeled scenarios.
- Holdings quantity error; late-import recomputation correctness.
- Import processing time and failure-safe handling.

## Evidence
Use sanitized fixtures, expected outputs, test run logs with no PII, screenshots of dashboard states, and traceable test case IDs. Separate actual measured results from targets.

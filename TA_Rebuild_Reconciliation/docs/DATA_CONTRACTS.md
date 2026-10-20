# Data Contracts — Draft, inspect migrations before changing

## Core entities
- `users`, `platforms`, `email_connections`, `investment_accounts` (existing; preserve ownership).
- `source_documents` / `import_batches`: source type, provider, account, document type, period, import time, sanitized identifier/hash, parser version, extraction status, coverage status. **No raw PDF in Privacy Mode**.
- `transactions`: account, source/provenance, transaction reference, effective date, type, symbol, quantity, unit, currency, price, gross amount, fee/tax, net settlement amount when available, confidence/review status, unique canonical identity; distinguish signed cash flow from asset quantity.
- `portfolio_snapshots`: account, as-of date, statement period, provenance, completeness/coverage, status.
- `portfolio_snapshot_items`: snapshot, asset symbol, normalized units, quantity, cost basis/average cost if present, currency, market value if present.
- `monthly_activity_summaries`: account, period, known BUY/SELL counts/amounts, dividends, completeness and provenance; only when source supports aggregation.
- `reconciliation_runs`: account, as-of, opening baseline, rule/parser versions, run status, timestamps.
- `reconciliation_items`: run, symbol, ledger quantity, snapshot quantity, delta, reason/status, supporting source references, resolution note.
- `audit_events` / `review_queue`: human review, approvals, corrections and recomputation history.

## Contract rules
- Inspect actual existing database columns and migration history; write additive migrations, no destructive reset.
- `total` from old schema MUST NOT be silently reinterpreted as gross or net; document mapping and migration.
- For BUY/SELL, store gross, fee, net if verified by source; enforce provider-specific sign convention.
- Dividend events require their own field availability contract; quantity/price can be unavailable, not forced to fake values.
- Snapshot item quantities must normalize stock lots versus shares and crypto units; retain original unit for audit.
- `effective_at` and `imported_at` are distinct; late imports recompute affected periods.
- Source provenance supports reconciliation and traceability, without revealing personal details in logs.
- Unique constraints and ownership guards must be tested.
- No placeholder '0' for absent fields; use null + explicit completeness flag. Zero only if absence of activity is established for a complete period.
- Win rate requires closed profitable sales and known cost basis; no sales => N/A, not 0% success.

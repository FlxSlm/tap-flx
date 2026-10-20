# Arsitektur Logis

```text
Stockbit / BIONS / Pluang
  ├── Privacy Mode: local PDF.js extraction / parsing
  └── Automatic Mode: Gmail OAuth (multi-account) -> n8n -> email/PDF processing
              ↓
  Source classification (provider + medium + document/event type)
              ↓
  Provider-specific extraction / parsing / normalization
              ↓
  Hard validation + rule-based confidence + user review
              ↓
  Provenance + dedup / cross-source matching
              ↓
  ┌─────────────────────────┬─────────────────────────┐
  │ Canonical transaction   │ Portfolio snapshots     │
  │ ledger                  │ + snapshot items        │
  └─────────────────────────┴─────────────────────────┘
              ↓
  Holdings projection by account/symbol/effective date
              ↓
  Portfolio Reconciliation Engine
     matched | mismatch | incomplete | pending_review
              ↓
  Analytics / Dashboard / Audit Trail / Resolution Workflow
              ↑
  Market Data Adapters -> Valuation (separate from position integrity)
```

## Boundaries
1. **Document source** is not the ledger: source provenance and content hashes are retained without storing sensitive raw PDF in Privacy Mode.
2. **Transaction** is an event with effective date; **snapshot** is an observed state at as-of date; **monthly summary** is an aggregate observation.
3. A snapshot cannot become a fabricated BUY/SELL.
4. Duplicate detection uses source IDs when available plus deterministic fingerprints and ambiguity review; cross-document duplicates need semantic matching, not just raw PDF hashes.
5. Ledger and snapshot import must be idempotent and scoped by user/investment account.
6. Reconciliation compares **same account, symbol, unit, and as-of date**, respecting opening balance and period boundaries.
7. Market value and unrealized P/L depend on separate pricing data; they do not alter holdings quantity.
8. UI displays unknown/incomplete when source lacks coverage, rather than false zero.

## Design goals
- Pluggable provider/document parsers
- Deterministic, testable rules and auditability
- Graceful partial coverage and document format drift
- Safe late-arriving events and recomputation
- Explicit status transitions and no silent auto-correction

# CHANGELOG

## 2026-09-11
- Created AI-agent context files.
- Established Increment 1 scope.
- Established Git checkpoint protocol.
## 2026-09-22
- REVISION: Validated parsers against real PDF document fixtures.
- Implemented dual-profile parsing: Canonical Transactions for TC/CA, and Portfolio Snapshots for SOA.
- Added `portfolio_snapshots` and `portfolio_snapshot_items` backend schema and API (`POST /api/portfolio-snapshots/bulk`).
- Removed dummy parsers and introduced document-specific parsers (Bions TC, Bions SOA, Bions CA, Stockbit TC, Stockbit SOA, Pluang SOA).
- Refactored `ValidationAndConfidence.js` to support transaction and snapshot profiling rules.
- Updated `/process-document` UI to handle dynamic rendering and submission of both Transactions and Snapshots.
- Created `PARSER_SOURCE_SPEC.md` for explicit mapping and boundaries.
- All 11 frontend tests and 14 backend tests passing.
- Built extensible parser architecture (Interface, Detection, Parsers).
- Created mock parsers for Stockbit, Pluang, and BIONS.
- Implemented Validation and Confidence Scoring algorithm.
- Added `/process-document` React UI page for document preview and bulk import.
- Added `POST /api/transactions/bulk` backend endpoint.
- Added frontend unit tests (Vitest) and backend feature tests.

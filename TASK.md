# CURRENT TASK

## Task ID
I1-04

## Task
Canonical Transaction Schema + Data Model Foundation

## Goal
Build the foundation for the canonical transaction ledger, supporting multiple platforms (Stockbit, Pluang, BIONS) and multiple Gmail connections per user.

## Status
COMPLETE ✅

## Prerequisites (completed)
- [x] I1-00 — Environment inspection
- [x] I1-01 — Scaffolding
- [x] I1-02 — DB Config
- [x] I1-03 — Authentication

## Features Implemented
1. **Migrations**: `platforms`, `email_connections`, `investment_accounts`, `transactions`.
2. **Models**: `Platform`, `EmailConnection`, `InvestmentAccount`, `Transaction`, updated `User`.
3. **Relationships**: User -> EmailConnections/InvestmentAccounts -> Transactions.
4. **Deduplication**: `transaction_hash` unique constraint on `transactions` table.

## Database Tables
- `platforms`: code, name
- `email_connections`: user_id, email_address, oauth_provider, oauth_id, credentials, is_active, last_sync_at
- `investment_accounts`: user_id, platform_id, email_connection_id, account_identifier, account_name
- `transactions`: investment_account_id, transaction_date, type, symbol, asset_name, quantity, price, total_amount, currency, fee_amount, external_identifier, transaction_hash, source_metadata

## Verification Results
- [x] Schema migration successful (`php artisan migrate`).
- [x] Data seeding successful (`I104TestSeeder`).
- [x] Multi-Gmail mapped correctly to investment accounts.
- [x] Transaction deduplication hash rejected duplicate inserts properly.
- [x] Authentication regression test passed (Login still works).

## Next Task
I1-05 — Internal transaction API (CRUD endpoints).

# CURRENT TASK

## Task ID
I1-06

## Task
Mock Transaction Seeder

## Goal
Build a robust, idempotent data seeder to populate the database with realistic dummy transactions across multiple platforms and email connections for testing.

## Status
COMPLETE ✅

## Prerequisites (completed)
- [x] I1-02 — DB Config
- [x] I1-03 — Authentication
- [x] I1-04 — Canonical Transaction Schema
- [x] I1-05 — Internal Transaction API

## Features Implemented
1. **Idempotency**: `MockTransactionSeeder` uses `firstOrCreate` alongside explicit `transaction_hash` generation to allow repeated executions without duplication errors.
2. **Data Structure**:
   - `test@example.com` (1 User)
   - `gmail1@example.com`, `gmail2@example.com` (2 Email Connections)
   - Stockbit, BIONS, Pluang (3 Investment Accounts mapped to emails)
   - 7 canonical transactions representing BUY/SELL behaviors across different dates.
3. **Seeder Registration**: Registered inside `DatabaseSeeder.php` for seamless execution via `php artisan db:seed`.

## Verification Results
- [x] `php artisan db:seed` runs successfully and inserts exact records.
- [x] Running `php artisan db:seed` multiple times correctly rejects duplicate inserts silently (idempotency verified).
- [x] `TransactionApiTest` regression passes.
- [x] Authentication logic remains unaffected (Login works).

## Next Task
I1-07 — React transaction form & list.

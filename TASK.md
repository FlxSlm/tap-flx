# CURRENT TASK

## Task ID
I1-04

## Task
Canonical transaction schema (migration + model).

## Goal
Implement the core transaction table in the database and its corresponding Eloquent model based on the academic proposal's canonical transaction schema.

## Prerequisites (completed)
- [x] I1-00 — Environment inspection
- [x] I1-01a — Git init, project structure, .gitignore
- [x] I1-01b — Laravel backend scaffolding
- [x] I1-01c — React/Vite frontend scaffolding
- [x] I1-02 — MySQL database creation & Laravel .env config
- [x] I1-03 — Authentication (Laravel Sanctum + React login)

## Steps
1. Create a migration for `transactions` table containing fields like `date`, `type`, `ticker`, `shares`, `price`, `fees`, `total_value`, `broker`, `user_id`, etc.
2. Create the `Transaction` Eloquent model with fillable properties and relationships (belongsTo User).
3. Run `php artisan migrate`.
4. Commit checkpoint.

## Do Not
- no transaction API endpoints yet (that is I1-05)
- no PDF parsing yet
- no market valuation or live price fetching
- no React UI for transactions yet

## Expected Output
- Database has `transactions` table with correct schema.
- `Transaction.php` model exists.

## Next Task
I1-05 — Internal transaction API (CRUD endpoints).


# CURRENT TASK

## Task ID
I1-03

## Task
Authentication (Laravel Sanctum + React login) — FIX

## Goal
Fix the login flow so that browser-based login at http://localhost:5173/login works correctly with test credentials.

## Prerequisites (completed)
- [x] I1-00 — Environment inspection
- [x] I1-01a — Git init, project structure, .gitignore
- [x] I1-01b — Laravel backend scaffolding
- [x] I1-01c — React/Vite frontend scaffolding
- [x] I1-02 — MySQL database creation & Laravel .env config

## Root Cause Found
Axios 1.x does NOT automatically send XSRF-TOKEN as X-XSRF-TOKEN header for cross-origin requests (localhost:5173 → localhost:8000). The `withXSRFToken: true` option must be explicitly set.

## Changes Applied
1. **frontend/src/api/axios.js** — Added `withXSRFToken: true` to axios instance config.
2. **backend/.env** — Fixed `APP_URL=http://localhost:8000` (was missing port), set `SESSION_DOMAIN=localhost` explicitly.
3. **backend** — Ran `php artisan optimize:clear` to clear cached config.

## Verification
- [x] PowerShell E2E test passed all 5 steps (CSRF → Login → User → Logout → Reject)
- [ ] User manual browser verification pending

## Status
IN PROGRESS — awaiting user browser verification.

## Do Not
- Do not proceed to I1-04 until user confirms login works in browser
- Do not create register functionality
- Do not create canonical transaction schema
- Do not create any new features

## Next Task (after user verification)
I1-04 — Canonical transaction schema (migration + model).

## Scope Note (for future reference, DO NOT implement now)
Data sources revised to: Stockbit, Pluang, BIONS.
Multi-Gmail + platform mapping architecture noted. Implementation deferred to later increments.

# CURRENT STATUS

## Last Updated
2026-09-11

## Current Increment
Increment 1 — Foundation

## Overall Status
IN PROGRESS

## Completed
- [x] Scope proposal dipahami
- [x] Enam increment ditetapkan
- [x] Stack utama ditetapkan
- [x] Canonical transaction concept ditetapkan
- [x] Increment 1 scope ditetapkan
- [x] I1-00 — Environment inspection (PHP 8.2.12, Composer 2.9.3, Node v25.2.1, npm 11.6.2, MariaDB 10.4.32, Git 2.47.0)
- [x] I1-01a — Git init, project structure (backend/, frontend/, docs/), root .gitignore

## Not Yet Completed
- [ ] I1-04 — Canonical transaction schema (migration + model)
- [ ] I1-05 — Internal transaction API (CRUD endpoints)
- [ ] I1-06 — Mock transaction seeder
- [ ] I1-07 — React transaction form & list
- [ ] I1-08 — Dashboard UI (following design reference)
- [ ] I1-09 — Integration test
- [ ] I1-10 — Final Increment 1 testing & documentation

## Current Task
I1-03 — IN PROGRESS. Authentication fix applied (withXSRFToken, SESSION_DOMAIN, APP_URL). Awaiting user manual browser verification.

## Immediate Next Steps
1. User verifies login via browser at http://localhost:5173/login
2. If verified, mark I1-03 complete and proceed to I1-04.

## Last Successful Test
Laravel Sanctum SPA authentication flow verified via PowerShell E2E test (2026-09-18):
- GET /sanctum/csrf-cookie → 204, XSRF-TOKEN + session cookie set (domain=localhost)
- POST /login (test@example.com / password) → 200, user data returned
- GET /api/user → 200, authenticated user data returned
- POST /logout → 200, session invalidated
- GET /api/user (after logout) → 401, correctly rejected

Root cause of previous failure: Axios 1.x `withXSRFToken` not set (XSRF header not sent on cross-origin requests).
Additional fixes: APP_URL corrected to http://localhost:8000, SESSION_DOMAIN set to localhost.

## Known Issues
- No proposal PDF in docs/ yet (using PROJECT_CONTEXT.md as reference).
- XAMPP MySQL root has no password (acceptable for local dev).

## Definition of Done — Increment 1
- [ ] React/PWA runs
- [ ] Laravel runs
- [ ] MySQL works
- [ ] authentication works
- [ ] canonical transactions table exists
- [ ] POST transactions API works
- [ ] GET transactions API works
- [ ] dummy transaction persists
- [ ] React can create/list transactions
- [ ] tests pass
- [ ] implementation evidence captured

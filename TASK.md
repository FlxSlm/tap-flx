# CURRENT TASK

## Task ID
I1-03

## Task
Authentication (Laravel Sanctum + React Login + Register)

## Goal
Complete authentication for Increment 1: Register, Login, Logout, Protected Route.

## Status
COMPLETE ✅

## Prerequisites (completed)
- [x] I1-00 — Environment inspection
- [x] I1-01a — Git init, project structure, .gitignore
- [x] I1-01b — Laravel backend scaffolding
- [x] I1-01c — React/Vite frontend scaffolding
- [x] I1-02 — MySQL database creation & Laravel .env config

## Features Implemented
1. **Login** — POST /login with email/password, Sanctum SPA session auth.
2. **Register** — POST /register with name/email/password/password_confirmation, auto-login after register.
3. **Logout** — POST /logout, session invalidation.
4. **Protected Route** — GET /api/user guarded by auth:sanctum middleware.
5. **Session Persistence** — Cookie-based session with XSRF protection.

## Backend Files
- `app/Http/Controllers/AuthController.php` — register, login, logout methods
- `routes/web.php` — POST /register, POST /login, POST /logout
- `routes/api.php` — GET /api/user (auth:sanctum)
- `config/cors.php` — register added to CORS paths
- `config/sanctum.php` — stateful SPA config
- `.env` — APP_URL, SESSION_DOMAIN, SANCTUM_STATEFUL_DOMAINS

## Frontend Files
- `src/pages/Login.jsx` — Login form with Register link
- `src/pages/Register.jsx` — Register form with Login link
- `src/pages/Dashboard.jsx` — Placeholder dashboard
- `src/context/AuthContext.jsx` — register, login, logout, checkAuth
- `src/components/ProtectedRoute.jsx` — Redirects unauthenticated to /login
- `src/api/axios.js` — Axios with withCredentials + withXSRFToken
- `src/App.jsx` — Routes for /login, /register, /

## Verification Results
- [x] Register valid user → 201
- [x] Register duplicate email → 422
- [x] Register password mismatch → 422
- [x] Password stored as bcrypt hash
- [x] Login new account → 200
- [x] Login old account (test@example.com) → 200
- [x] Logout → 200
- [x] Protected route after logout → 401
- [x] Browser login verified manually by user

## Next Task
I1-04 — Canonical transaction schema (migration + model).
DO NOT start until user approves.

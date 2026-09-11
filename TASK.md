# CURRENT TASK

## Task ID
I1-03

## Task
Authentication (Laravel Sanctum + React login).

## Goal
Implement a functional authentication flow allowing a user to log in from the React frontend to the Laravel backend.

## Prerequisites (completed)
- [x] I1-00 — Environment inspection
- [x] I1-01a — Git init, project structure, .gitignore
- [x] I1-01b — Laravel backend scaffolding
- [x] I1-01c — React/Vite frontend scaffolding
- [x] I1-02 — MySQL database creation & Laravel .env config

## Steps
1. Configure Laravel Sanctum.
2. Create an authentication controller in Laravel (login, logout, user endpoints).
3. Create a simple Login page component in React.
4. Implement Axios connection with CSRF cookie handling in React.
5. Verify successful login.
6. Commit checkpoint

## Do Not
- no UI dashboard implementation yet (just the login page)
- no API connection for transactions yet
- no PDF parsing
- no valuation / reporting

## Expected Output
- User can successfully log in via the React frontend and receive an authenticated session/token from Laravel.

## After Task
Update CURRENT_STATUS.md and TASK.md.
Create a Git commit.

## Next Task
I1-04 — Canonical transaction schema (migration + model).


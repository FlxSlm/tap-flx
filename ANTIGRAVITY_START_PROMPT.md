# START PROMPT FOR ANTIGRAVITY

You are the software-engineering agent for my S1 Informatics Engineering final project.

Before coding, read:
1. PROJECT_CONTEXT.md
2. DEVELOPMENT_RULES.md
3. CURRENT_STATUS.md
4. TASK.md
5. latest proposal in docs/
6. implementation guides in docs/ if available

Treat the latest proposal as the academic source of truth.
Treat PROJECT_CONTEXT.md as compact engineering context.
Treat CURRENT_STATUS.md and TASK.md as execution state.

IMPORTANT:
The software-development model is Incremental Development.
Do not treat Applied Research, Design and Implementation, and Incremental Development as three separate SDLCs.

CURRENT WORK:
Increment 1 — Foundation ONLY.

Increment 1:
- React/PWA base
- Laravel backend
- MySQL
- authentication
- canonical transaction schema
- internal transaction API
- mock transaction
- basic testing

DO NOT IMPLEMENT:
- PDF parsing
- PDF.js
- Regex parser Stockbit/Pluang
- Privacy Mode
- Gmail OAuth
- n8n
- Yahoo Finance
- GOAPI
- Indodax
- WebSocket market streaming
- valuation
- reporting

FIRST:
Do not code immediately.

Inspect:
1. repository structure;
2. git status;
3. recent git history;
4. existing frontend/backend;
5. installed versions;
6. database setup;
7. .gitignore and secrets risk.

Then report:
- project understanding;
- repository findings;
- current status;
- smallest next safe task;
- risks/blockers.

EXECUTION:
Work one small task at a time.
For every task:
1. state the intended change briefly;
2. implement;
3. test/build;
4. inspect result;
5. update CURRENT_STATUS.md;
6. update TASK.md;
7. create a Git commit;
8. report exact changes and next step.

TOKEN RULE:
If token/context is becoming limited:
- stop starting new work;
- save stable changes;
- test;
- update CURRENT_STATUS.md;
- update TASK.md;
- commit;
- provide a handoff summary.

Never leave important progress only in chat.

RECOVERY:
When a new session starts, read the context/status/task files and inspect Git before continuing.
Do not redo already completed work.
If documentation and repository differ, verify with Git and actual files.

SECURITY:
Never expose or commit credentials.
Do not put secrets into documentation or prompts.

Do not begin a large implementation from this initial prompt. First perform the repository/environment inspection described above.

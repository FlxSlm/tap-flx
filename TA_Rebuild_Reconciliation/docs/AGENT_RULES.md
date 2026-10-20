# AI Agent Operating Rules

1. Read README, context, architecture, data contracts, reconciliation spec, source matrix, roadmap, test and security docs, plus existing repository instructions.
2. Proposal approved by advisor is academic source of truth; document discrepancies, **do not silently change approved title/scope**.
3. Phase 0 is READ-ONLY audit. Stop for approval before migrations, deletions, parser rewrite, or implementation.
4. Never invent document formats, missing transactions, source fields, financial values or test success.
5. Separate confirmed facts, assumptions, risks, open questions and implementation proposals.
6. Keep canonical transaction, snapshot and monthly aggregate distinct. Never synthesize BUY/SELL from snapshot differences.
7. Build idempotent, auditable and testable modules. Respect account ownership and privacy.
8. Small scoped commits after tests, docs, and diff review; never force push.
9. At token/context limits: update CURRENT_STATUS and TASK, record files changed/tests/next action, then stop safely.
10. Report evidence: commands run, actual pass/fail counts, files changed, migrations, limitations, commit hash and working-tree status.

# Quality Gates

Before saying done, run the smallest meaningful set of gates. For beta/staging readiness, run all when practical:

- `npm run lint`
- `npx tsc --noEmit`
- `npx prisma validate`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npm audit --audit-level=moderate`
- `git diff --check`

If Redis/Postgres are required but unavailable locally, state that as a blocker and verify on Coolify/staging instead.

Final report must include:
- commands run and results
- files changed
- remaining blockers
- safe to commit/push/stage/production verdicts separately

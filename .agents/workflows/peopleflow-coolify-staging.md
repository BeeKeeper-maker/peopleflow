# PeopleFlow Coolify Staging Workflow

Use when checking the Coolify deployment.

1. Confirm app, worker, db, and Redis services exist and are running.
2. Confirm branch/commit deployed.
3. Check required env vars without exposing values.
4. Check `/api/health`.
5. Check app logs.
6. Check worker logs.
7. Check DB migration status safely.
8. Verify Redis connectivity.
9. Run role UAT workflow with safe test/demo data.
10. Report whether staging is acceptable and what blocks production.

Do not deploy/restart/migrate/seed/delete without approval.

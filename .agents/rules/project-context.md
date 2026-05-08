# PeopleFlow HR Project Context

This is a full-stack HR/PeopleFlow application. Treat it as a business-critical multi-role, multi-tenant HR system.

## Delivery target
- Current goal: beta/staging readiness first, not production GA.
- Production/market-ready requires real app + worker + database + Redis verification, role-based UAT, and tenant isolation proof.

## Core roles to protect
- super admin / admin
- HR admin
- manager
- employee

Every role must be able to log in and perform only the actions allowed for that role.

## Infrastructure assumptions
Coolify has separate services for app, worker, database, and Redis. Verify app and worker logs separately.

## Never confuse
- local build passing ≠ business workflow ready
- staging ready ≠ production ready
- basic E2E passing ≠ authenticated multi-role UAT passing

# PeopleFlow Operating Doctrine

_Last updated: 2026-06-01_

## Product Standard
PeopleFlow is not treated as a quick AI-generated application. It is a long-term enterprise SaaS product for Bangladeshi offices. The target is not merely “works on my machine”; the target is a trusted office system that companies can confidently shift to.

## Sir's Directive
- No unnecessary rush.
- No compromise with product quality.
- Do not build every feature immediately just to look complete.
- First make the application stable, runnable, organized, secure, and office-ready.
- Then inspect and improve every section one by one.
- If a weak approach exists, refactor it properly instead of patching around it.
- New features/functions should be added only when they support the product vision and core workflows.

## Work Order
1. **Stabilize** — deploy reliably, health checks pass, core services run.
2. **Make usable** — essential office workflows work end-to-end.
3. **Prove safety** — tenant isolation, RBAC, audit logs, backups, security gates.
4. **Polish UX** — Bengali-first, office-friendly, clear empty/error/loading states.
5. **Organize architecture** — maintainable modules, clean APIs, predictable data flow.
6. **Scale** — performance, observability, queues, server upgrade path.
7. **Expand** — advanced features, integrations, analytics, market leadership.

## Section-by-Section Review System
Every PeopleFlow section must eventually receive:

- Current behavior map
- User roles involved
- Data models touched
- API/server actions used
- Security/RBAC checks
- Tenant isolation checks
- Loading/empty/error states
- Bengali copy review
- Mobile/responsive review
- Performance/index review
- QA checklist
- Release/blocker status

## Definition of Done
A section is not “done” until:

- It works end-to-end in realistic office workflow
- It has proper validation and error handling
- It respects tenant and role boundaries
- It is understandable in Bengali
- It passes build/type/lint/test checks where applicable
- It is verified visually or through production/staging QA
- Known gaps are documented with priority

## Immediate Priority
Stabilize production deployment first. After deployment is reliable, continue with structured module audits and fixes rather than random feature development.

# Security, Database, Auth, and Tenant Rules

## Non-negotiable
- Every authenticated API route must enforce auth.
- Data access must be scoped by organization/company/tenant where applicable.
- Role boundaries must be explicit for admin, HR, manager, and employee.
- Upload/download routes must block path traversal and cross-tenant reads.
- Webhooks must verify signatures and be idempotent.
- Do not read or print secrets. Redact env values.
- Do not run production migrations, seeds, deletes, truncates, or data rewrites without explicit approval.

## Review checklist
For every changed API route, check:
- Who can call it?
- What tenant/company/organization scope is applied?
- Can a user pass another tenant's ID?
- Are update/delete operations scoped?
- Are errors safe and non-leaky?

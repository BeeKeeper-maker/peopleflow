# PeopleFlow Platform & Email Strategy

_Last updated: 2026-05-09_

## Mission

PeopleFlow should grow from an HRMS into a complete office operating system for Bangladeshi organizations: HR, payroll, attendance, recruitment, internal communication, website presence, job circulars, applicant pipeline, and future office operations.

The platform must be built slowly but correctly: secure, scalable, multi-tenant, commercially sustainable, and deliverability-safe.

## Strategic Positioning

PeopleFlow should not compete as “just HR software”. It should become:

> The digital office platform for Bangladeshi SMEs, schools, clinics, NGOs, factories, and service businesses.

Target users:
- Offices without proper websites
- Offices using Excel/manual HR
- Offices needing attendance + payroll + recruitment
- Offices wanting job circulars but no career portal
- Growing companies that need employee self-service and automation

## Product Pillars

### 1. Core HRMS
Existing and near-term foundation:
- Employees
- Attendance
- Leave
- Payroll
- Expenses
- Departments/branches
- ESS portal
- Manager approvals
- Audit logs
- Role-based access

### 2. Recruitment & Job Circular System
Required to beat competitors:
- Organization career page
- Job circular publishing
- Application form builder
- CV upload
- Applicant tracking pipeline
- Interview scheduling
- Candidate email/SMS notifications
- Hiring approvals
- Offer letter generation
- Convert hired applicant into employee

### 3. Website Builder for Offices
For offices without websites:
- Tenant-controlled public website
- Custom subdomain: `company.peopleflowbd.online`
- Optional custom domain: `company.com`
- Website templates by industry
- Pages: Home, About, Services, Team, Gallery, Contact, Career
- Admin editable content
- SEO metadata
- Contact form
- Job circular integration
- Bengali/English support

### 4. Communication Layer
Must be quota-controlled and billing-aware:
- Transactional email
- Bulk/job circular email where permitted
- SMS/WhatsApp later
- In-app notifications
- Notification templates
- Delivery logs
- Bounce/suppression management
- Per-tenant quota and billing

### 5. Billing & Subscription Layer
Commercial sustainability:
- Plans: Free/Starter/Growth/Business/Enterprise
- Per-tenant feature gates
- Email quota per plan
- Add-on email packs
- Website/custom-domain add-on
- Recruitment add-on
- Usage metering
- Invoice/payment status
- Grace periods and suspension rules

## Email Strategy

### Key Principle
Do not run a self-hosted mail server for outbound production email.

Reason:
- IP reputation is difficult and slow to build
- Deliverability failures hurt password resets, invites, and job applications
- Blacklist management is operationally expensive
- Bangladesh ISP/cloud IP ranges may have weak mail reputation
- Compliance, bounce handling, suppression, and abuse prevention need mature tooling

A spare server can be used for internal services, monitoring, queue workers, or future analytics — not as the primary SMTP sender.

### Recommended Email Architecture

#### Phase 1: Production Trust Foundation
Use a reputable transactional email provider.

Recommended default: Postmark Platform/Pro.

Why:
- Strong transactional deliverability
- SMTP + API support
- DKIM/SPF/DMARC support
- Message streams separate transactional and broadcast mail
- Webhooks and suppression management
- Unlimited custom sending domains on Platform tier

Alternative for future high-volume cost optimization: Amazon SES.

SES is much cheaper per email but requires more deliverability engineering, AWS security hardening, bounce/complaint pipelines, reputation monitoring, IAM discipline, and warm-up management.

#### Phase 2: PeopleFlow Email Gateway
Build an internal `EmailService` abstraction:
- `sendTransactionalEmail()`
- `sendTenantNotification()`
- `sendRecruitmentEmail()`
- `sendBulkCampaign()` only after compliance controls

All email must go through:
- Queue/BullMQ
- Rate limits
- Tenant quotas
- Template registry
- Audit logging
- Bounce/suppression checks
- Idempotency keys

#### Phase 3: Tenant-Aware Email
Each organization gets quota based on plan:

Example starting model:
- Free/demo: 50 emails/month
- Starter: 1,000 emails/month
- Growth: 5,000 emails/month
- Business: 20,000 emails/month
- Enterprise: custom

If an office sends 100 emails/day:
- 3,000 emails/month per office
- 100 offices = 300,000 emails/month
- 1,000 offices = 3,000,000 emails/month

This must become a paid usage-based feature, not unlimited.

### Sender Domain Model

#### Platform System Email
- From: `PeopleFlow <noreply@peopleflowbd.online>`
- Use cases: verification, password reset, employee invite, billing, system alerts

#### Tenant-Branded Email
Stage 1:
- From: `Company Name via PeopleFlow <notifications@peopleflowbd.online>`
- Reply-To: tenant email

Stage 2:
- Tenant custom domain verification
- From: `hr@company.com` only after DNS verification
- Tenant must configure SPF/DKIM/DMARC records

#### Recruitment Email
- Separate stream/domain to protect core auth deliverability
- Example: `jobs.peopleflowbd.online` or stream-level separation in provider

### DNS Requirements

For `peopleflowbd.online`:
- SPF: include current forwarding plus provider include
- DKIM: provider-generated records
- DMARC: start `p=none`, monitor, then `quarantine`, eventually `reject`
- Return-path/bounce domain

Do not enforce `p=reject` immediately until all senders are aligned.

## Server Strategy

Current PeopleFlow production layout is correct:
- Web app
- PostgreSQL
- Redis
- Worker

For email:
- Do not add self-hosted SMTP as a core production dependency.
- Use provider API/SMTP.
- Keep email queue worker in PeopleFlow worker initially.
- Add a separate notification worker later only when volume requires it.

Spare server options:
1. Monitoring/observability server
2. Staging environment
3. Analytics/reporting worker
4. Future search/indexing services
5. Backup/offsite jobs

Best immediate use for empty server:
- Staging/QA environment for PeopleFlow before production deploys.

## Required Platform Features To Build

### Must Build Before Scale
- Tenant model hardening
- Feature flags and plan limits
- Email quota tables
- Email event log
- Template system
- Bounce/suppression table
- Provider abstraction
- Admin usage dashboard
- Tenant billing state
- Abuse/rate limiting

### Website Builder MVP
- `OrganizationWebsite` settings model
- Public tenant route: `/site/[slug]` or subdomain routing
- Editable sections JSON with validated schema
- Template themes
- SEO metadata
- Contact form with anti-spam
- Career page linked to recruitment jobs

### Recruitment MVP
- `JobPost`
- `JobApplication`
- `ApplicationStage`
- Public application form
- Admin pipeline board
- Candidate notifications
- Convert applicant to employee

## Execution Roadmap

### Phase A — Architecture & Documentation
- PRD update
- Architecture update
- Data model plan
- Email architecture document
- Billing/quota policy

### Phase B — Email Foundation
- Provider account and DNS
- SMTP/API env setup
- Email queue + audit log
- Template registry
- Bounce webhook endpoint
- Suppression handling
- Production test suite

### Phase C — Recruitment Foundation
- Job posting CRUD
- Career page
- Applicant form
- Pipeline
- Email notifications

### Phase D — Website Builder MVP
- Tenant website settings
- Public website templates
- Contact form
- Job circular integration
- SEO

### Phase E — Billing & Scale Controls
- Plan/feature gates
- Email quota enforcement
- Usage billing reports
- Add-on packs

## Free-First Startup Email Path

Sir currently wants no extra monthly cost beyond hosting/domain until PeopleFlow starts generating income. The strategy therefore becomes:

### Recommended Free Provider: Brevo Free

Use Brevo Free initially because it allows 300 emails/day, supports transactional emails/SMTP, and is enough for early beta/demo usage.

Startup rule:
- Platform/system emails only
- No tenant bulk campaigns yet
- No promise of 100 emails/day per office yet
- Strict global daily cap inside PeopleFlow, below provider limit
- Upgrade only after revenue or real customer demand

### Backup Free Options

- Mailjet Free: 6,000 emails/month, 200/day, SMTP/API/webhooks
- Resend Free: 100/day, modern developer API/SMTP, good for dev/startup but lower daily limit
- MailerSend Free: 500/month, too small for PeopleFlow except testing

### Free-Phase Quota Policy

Until paid email infrastructure exists:
- Demo tenant: 10 emails/day
- Real pilot tenant: 25 emails/day
- Platform reserved system pool: 100 emails/day
- Global cap: max 250 emails/day to stay below Brevo's 300/day limit
- Critical emails priority: password reset, verification, employee invite
- Non-critical emails delayed/skipped when quota is near limit

### Upgrade Triggers

Move from free provider to paid Postmark/SES when any condition happens:
- 3+ paying offices onboarded
- Need more than 250 emails/day consistently
- Password reset/invite delivery becomes business-critical at scale
- Need tenant custom sending domains
- Need broadcast/job-circular emails beyond small pilot usage
- Need stronger SLA/support/deliverability reporting

## Immediate Decisions Needed From Sir

1. Create a free Brevo account for startup transactional sending.
2. Keep Namecheap forwarding temporarily for human inbox if no mailbox budget exists.
3. Provide DNS access for `peopleflowbd.online` so SPF/DKIM/DMARC can be configured.
4. Confirm empty server should become PeopleFlow staging/QA server, not outbound SMTP server.

## Non-Negotiable Quality Rules

- No unlimited email sending per tenant.
- No self-hosted SMTP for production transactional mail.
- No bulk/job email mixed with password reset/invite stream.
- No tenant custom sender without DNS verification.
- No production email changes without SPF/DKIM/DMARC validation.
- No feature build without quota/billing/security model.
- Every public website feature must be SEO-friendly and Bengali/English ready.

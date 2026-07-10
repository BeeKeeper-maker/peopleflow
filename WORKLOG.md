# PeopleFlow HRMS — Project Worklog & Technical Overview
> **Developer:** Sharif Mohammad Nasrullah · AI Learners BD
> **Created:** April 2026 · **Status:** ✅ Production (Live)
> **Live URL:** https://hr.ailearnersbd.com

---

## 📋 Table of Contents
1. [Project Summary](#project-summary)
2. [Codebase Metrics](#codebase-metrics)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Feature Modules](#feature-modules)
6. [Business Logic Engines](#business-logic-engines)
7. [Background Workers](#background-workers)
8. [API Endpoints](#api-endpoints)
9. [UI Pages](#ui-pages)
10. [Database Schema](#database-schema)
11. [Security](#security)
12. [Infrastructure & Deployment](#infrastructure--deployment)
13. [Bangladesh-Specific Compliance](#bangladesh-specific-compliance)
14. [Development Timeline](#development-timeline)

---

## Project Summary

**PeopleFlow** is an enterprise-grade, multi-tenant Human Resource Management System (HRMS) built as a B2B SaaS platform tailored for the Bangladesh market.

**Key Differentiators:**
- 🏗️ Multi-tenant architecture — one deployment serves unlimited organizations
- 🇧🇩 Bangladesh Labour Act 2006 compliant payroll & leave policies
- 📍 GPS geo-fenced attendance with ZKTeco biometric hardware sync
- 🔄 Stateful multi-level approval engine
- 💰 Festival bonus engine (Eid, Durga Puja, Christmas)
- 🔐 Enterprise security (2FA, RBAC, OWASP headers, audit trail)
- ⚡ Background job processing via BullMQ + Redis

**Target Sectors:** RMG/Garments, Corporate, NGO, Education, Healthcare

---

## Codebase Metrics

| Metric | Value |
|--------|-------|
| Total Source Files (.ts/.tsx) | **501** |
| Total Lines of Code | **228,143** |
| UI Pages | **81** |
| API Endpoints | **112** |
| Database Models | **61** |
| Reusable UI Components | **85** |
| Background Workers | **7** |
| Business Logic Engines | **17** |
| Validation Modules (Zod) | **12** |
| Prisma Schema | **1,853 lines** |
| Languages | **2** (English + বাংলা) |

---

## Tech Stack

### Core
| Technology | Version | Role |
|-----------|---------|------|
| **Next.js** | 16.1.6 | Full-stack framework (App Router, Server Components) |
| **React** | 19.2.3 | UI rendering |
| **TypeScript** | Latest | Type safety across entire codebase |
| **Prisma** | 6.19.2 | ORM, migrations, type-safe DB queries |
| **PostgreSQL** | 16 | Primary relational database |

### Auth & Security
| Technology | Version | Role |
|-----------|---------|------|
| **NextAuth.js** | v5-beta.30 | JWT authentication, session management |
| **bcrypt** | — | Password hashing |
| **TOTP** | — | Two-Factor Authentication |
| **Zod** | 4.3.6 | Runtime schema validation |

### Background Processing
| Technology | Version | Role |
|-----------|---------|------|
| **BullMQ** | 5.71.1 | Distributed job queue |
| **Redis** | 7 | Queue backend, caching |

### Payments
| Technology | Version | Role |
|-----------|---------|------|
| **Stripe** | 21.0.1 | Subscription billing, webhooks |

### Frontend
| Technology | Version | Role |
|-----------|---------|------|
| **Tailwind CSS** | 4.x | Styling |
| **Framer Motion** | 12.29.2 | Animations |
| **Radix UI** | — | Accessible primitives |
| **@tanstack/react-query** | — | Server state |
| **@tanstack/react-table** | — | Data tables |
| **Recharts** | — | Charts/graphs |

### Observability
| Technology | Version | Role |
|-----------|---------|------|
| **Sentry** | — | Error tracking |
| **Pino** | 10.3.1 | Structured JSON logging |

### Testing
| Technology | Version | Role |
|-----------|---------|------|
| **Vitest** | 4.1.2 | Unit tests |
| **Playwright** | — | E2E tests |

### Deployment
| Technology | Role |
|-----------|------|
| **Docker** | Multi-stage containerization |
| **Coolify** | Self-hosted PaaS (deployment automation) |
| **Traefik** | Reverse proxy + auto TLS |
| **Hetzner VPS** | Cloud server |

---

## Architecture

### Multi-Tenant SaaS Design
```
                        ┌─────────────────────────────┐
                        │      MARKETING SITE          │
                        │  Landing · Pricing · Signup   │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │      PLATFORM PLANE          │
                        │   (SaaS Owner Dashboard)     │
                        │                              │
                        │  Tenants · Plans · Billing    │
                        │  Leads · Impersonation        │
                        │  Audit Logs · Analytics       │
                        └──────────────┬──────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼─────────┐  ┌──────────▼─────────┐  ┌──────────▼──────────┐
    │   ORGANIZATION A   │  │   ORGANIZATION B   │  │   ORGANIZATION C    │
    │                     │  │                     │  │                     │
    │  ┌──────────────┐  │  │  (Same structure)   │  │  (Same structure)   │
    │  │ Admin Portal  │  │  │                     │  │                     │
    │  │ (44 pages)    │  │  └─────────────────────┘  └─────────────────────┘
    │  ├──────────────┤  │
    │  │ Manager Portal│  │
    │  │ (5 pages)     │  │
    │  ├──────────────┤  │
    │  │ ESS Portal    │  │
    │  │ (12 pages)    │  │
    │  └──────────────┘  │
    └────────────────────┘

                        ┌─────────────────────────────┐
                        │      INFRASTRUCTURE          │
                        │                              │
                        │  ┌────────┐  ┌────────┐     │
                        │  │PostgreSQL│ │ Redis  │     │
                        │  │(61 models)│ │(BullMQ)│    │
                        │  └────────┘  └────────┘     │
                        │                              │
                        │  ┌─────────────────────┐     │
                        │  │  BullMQ Workers (7)  │    │
                        │  │  (Separate Process)  │    │
                        │  └─────────────────────┘     │
                        └─────────────────────────────┘
```

### Data Isolation
- Every record belongs to an `Organization` via `organizationId`
- API middleware enforces tenant-scoped queries automatically
- Platform plane operates above tenant boundary for cross-org management

### Request Flow
```
Client → Traefik (TLS) → Next.js Edge Middleware (Auth + RBAC)
  → API Route (Zod Validation) → Business Logic Engine
  → Prisma Query (Org-scoped) → PostgreSQL
  → Response (with security headers)
```

---

## Feature Modules

### 1. Employee Management
- Full lifecycle management: Hire → Onboard → Active → Retire/Terminate
- Auto-generated employee codes
- Bengali name support
- Multi-tab employee profile (Personal, Job, Documents, Salary, Attendance)
- Document uploads with secure storage
- CSV/Excel bulk export
- Department + Designation hierarchy
- Multi-branch assignment

### 2. Attendance System (GPS Geo-Fenced)
- **GPS-based check-in/check-out** with configurable geo-fence radius
- Validates employee location against office coordinates at both entry and exit
- Night shift support (cross-midnight calculation with next-day logic)
- Auto-absent cron job (marks absent for no-shows daily)
- Attendance regularization workflow (employee requests correction → manager approves)
- Monthly report with department/date filters
- Real-time dashboard card showing today's present/absent/late
- Full GPS audit trail (coordinates + distance stored per record)

### 3. Leave Management (BLA 2006 Compliant)
- Configurable leave types: Casual, Sick, Earned, Annual, Maternity, Paternity, etc.
- Annual allocation with pro-rata for mid-year joiners
- Carry-forward rules (max days, expiry period configurable)
- Leave encashment (convert unused leave to cash)
- Sandwich policy (weekends between leaves count as leave days)
- **Bangladesh Labour Act 2006 compliance:**
  - Maternity Leave: Section 46-47 (Pre-delivery 8 weeks + Post-delivery 8 weeks)
  - Earned Leave: 1 day per 18 working days
  - Casual Leave: 10 days/year
  - Sick Leave: 14 days/year (with medical certificate)
- Visual leave calendar
- Multi-level approval workflow integration

### 4. Payroll Engine
- Configurable salary structures with Earnings + Deductions components
- Employee-wise salary structure assignment
- Bulk monthly payroll processing
- PDF salary slip generation + download
- Auto-integration with late deduction engine
- **Festival Bonus Engine:**
  - Supports: Eid-ul-Fitr, Eid-ul-Adha, Durga Puja, Christmas
  - Pro-rata calculation for employees joining mid-year
  - Configurable bonus percentage of basic salary
- **Provident Fund (PF) Ledger:**
  - Double-entry bookkeeping (debit/credit)
  - Employee contribution + employer matching
  - Full PF transaction history
- Bank file generation (bulk salary transfer)
- Tax certificate generation
- Historical salary slip archive

### 5. Approval Engine (Multi-Level, Stateful)
- Configurable multi-step workflows (1 to N approvers)
- Used by: Leaves, Expenses, Loans, Document Requests, Regularization
- State machine: Pending → In-Review → Approved / Rejected
- SLA tracking per approval step (time-to-action metrics)
- Auto-escalation on timeout (cron `/api/cron/escalation`)
- Full step-by-step audit log

### 6. Expense Management
- Configurable expense categories
- Expense claim submission with receipt uploads
- Approval workflow integration
- Status tracking: Draft → Submitted → Approved → Paid / Rejected

### 7. Loan Management
- Loan application (amount, tenure, interest)
- EMI auto-calculation
- Monthly repayment tracking
- Integration with payroll for auto-deduction
- Outstanding balance tracking

### 8. Document Management
- Employee document requests (Salary Certificate, Experience Letter, NOC, etc.)
- Dynamic document templates with placeholder variables
- PDF generation engine
- Secure upload storage with path-based access

### 9. Announcements & Notifications
- Organization-wide announcements
- Real-time notification system
- User notification preferences
- Read/unread status tracking

### 10. Security & Authentication
- NextAuth v5 (JWT strategy)
- Two-Factor Authentication (TOTP — authenticator app)
- Password policy enforcement (length, complexity, special chars)
- Password history (prevents reuse of last N passwords)
- Concurrent session management
- Rate limiting on sensitive endpoints
- Email verification flow
- Secure password reset (time-limited tokens)
- OWASP security headers (CSP, HSTS, X-Frame-Options, etc.)

### 11. RBAC (Role-Based Access Control)
- **5 roles:** `super_admin` · `admin` · `hr_admin` · `manager` · `employee`
- Resource-level fine-grained permissions
- Department-scoped access restrictions
- Time-bounded permission delegations (temporary access grants)
- Enforced at Edge (Next.js middleware) + API layer

### 12. Biometric Device Integration (ZKTeco)
- Device registration + configuration management
- Real-time attendance sync (hardware → cloud)
- Per-device API key authentication
- Device health monitoring + sync logs
- Auto employee-to-biometric ID mapping
- Downloadable Sync Agent with heartbeat API
- Supports ZKTeco proprietary protocol

### 13. Performance Management
- Review cycle management
- OKR framework (Goals + Key Results)
- Performance review submissions
- ESS self-assessment portal

### 14. Recruitment / ATS
- Job posting creation + management
- Candidate profile tracking
- Application pipeline stages

### 15. Reports & Analytics
- Real-time dashboard stats (employee count, present today, etc.)
- Chart-based analytics (Recharts)
- Monthly attendance reports (filterable by dept/date)
- Compliance dashboard

### 16. Platform / SaaS Layer
- Tenant provisioning (create new organizations on-demand)
- Subscription plans: Starter / Growth / Enterprise
- Stripe webhook integration (payment lifecycle management)
- Usage tracking & metering per tenant
- Platform admin impersonation (time-boxed, reason-required, fully audited)
- Sales lead pipeline (lead capture → demo → conversion)
- Cross-tenant employee directory
- Platform-level audit logs

---

## Business Logic Engines

| # | Engine | File | Purpose |
|---|--------|------|---------|
| 1 | Approval Engine | `src/lib/approval-engine.ts` | Multi-step workflow orchestration |
| 2 | Attendance Engine | `src/lib/attendance-engine.ts` | GPS validation, check-in/out, night shift |
| 3 | Leave Engine | `src/lib/leave-engine.ts` | Leave balance, allocation, business rules |
| 4 | Leave Compliance | `src/lib/leave-compliance-engine.ts` | BLA 2006 legal compliance checks |
| 5 | Payroll Engine | `src/lib/payroll-engine.ts` | Salary calculation + slip generation |
| 6 | Festival Bonus | `src/lib/festival-bonus-engine.ts` | Eid/Puja/Christmas bonus computation |
| 7 | Late Deduction | `src/lib/late-deduction-engine.ts` | Tiered late penalty calculation |
| 8 | PF Ledger | `src/lib/pf-ledger-engine.ts` | Provident fund double-entry bookkeeping |
| 9 | Workflow Engine | `src/lib/workflow-engine.ts` | Generic state machine for workflows |
| 10 | Event Bus | `src/lib/event-bus.ts` | Async event dispatch to BullMQ queues |
| 11 | Feature Gate | `src/lib/feature-gate.ts` | Plan-based feature toggling |
| 12 | Plan Enforcement | `src/lib/plan-enforcement.ts` | Subscription limit enforcement |
| 13 | Compliance | `src/lib/compliance.ts` | Regulatory compliance checks |
| 14 | Impersonation | `src/lib/impersonation.ts` | Time-boxed admin session control |
| 15 | Password Policy | `src/lib/password-policy.ts` | Password rules + history + complexity |
| 16 | Rate Limiter | `src/lib/rate-limit.ts` | Per-IP/endpoint rate limiting |
| 17 | Session Security | `src/lib/session-security.ts` | Concurrent session management |

---

## Background Workers

All workers run in a separate Docker container (`peopleflow-worker`) using BullMQ + Redis.

| # | Worker | File | Purpose |
|---|--------|------|---------|
| 1 | Biometric Sync | `src/workers/biometric-sync.ts` | Sync attendance from ZKTeco hardware |
| 2 | Device Health | `src/workers/device-health.ts` | Monitor biometric device uptime |
| 3 | Attendance Reconciliation | `src/workers/attendance-reconciliation.ts` | Cross-check & fix attendance records |
| 4 | Event Worker | `src/workers/event-worker.ts` | Process async events (email, notifications) |
| 5 | Subscription Lifecycle | `src/workers/subscription-lifecycle.ts` | Handle renewals, expirations, downgrades |
| 6 | Usage Tracking | `src/workers/usage-tracking.ts` | Track tenant resource consumption |
| 7 | Impersonation Cleanup | `src/workers/impersonation-cleanup.ts` | Auto-expire impersonation sessions |

---

## API Endpoints (112 Routes)

### Authentication — 8 routes
```
POST   /api/auth/[...nextauth]     NextAuth handlers
POST   /api/auth/register          New user registration
POST   /api/auth/verify-email      Email verification
POST   /api/auth/forgot-password   Password reset request
POST   /api/auth/reset-password    Password reset execution
POST   /api/auth/change-password   Change current password
POST   /api/auth/2fa/setup         Enable 2FA (TOTP)
POST   /api/auth/2fa/verify        Verify 2FA token
```

### Employees — 6 routes
```
GET    /api/employees              List employees
POST   /api/employees              Create employee
GET    /api/employees/[id]         Get employee detail
PUT    /api/employees/[id]         Update employee
DELETE /api/employees/[id]         Delete employee
GET    /api/employees/[id]/profile-data  Full profile data
GET    /api/employees/export       CSV/Excel export
GET    /api/employees/me           Current user's employee record
GET    /api/employees/next-code    Generate next employee code
```

### Attendance — 4 routes
```
POST   /api/attendance/check-in         GPS check-in/check-out
GET    /api/attendance/today             Today's attendance
GET    /api/attendance/regularization    Regularization requests
PUT    /api/attendance/regularization/[id]  Approve/reject
```

### Leaves — 8 routes
```
GET    /api/leaves                       Leave summary
GET    /api/leaves/types                 Leave type list
POST   /api/leaves/types                 Create leave type
PUT    /api/leaves/types/[id]            Update leave type
GET    /api/leaves/allocations           Employee allocations
POST   /api/leaves/applications          Apply for leave
GET    /api/leaves/applications/[id]     Application detail
PUT    /api/leaves/applications/[id]     Approve/reject
POST   /api/leaves/carry-forward         Year-end carry-forward
POST   /api/leaves/encashment            Leave encashment
```

### Payroll — 13 routes
```
GET    /api/payroll                      Payroll overview
GET    /api/payroll/structures           Salary structures
POST   /api/payroll/structures           Create structure
PUT    /api/payroll/structures/[id]      Update structure
GET    /api/payroll/assignments          Structure assignments
POST   /api/payroll/process              Run monthly payroll
GET    /api/payroll/slips                Salary slips list
GET    /api/payroll/slips/[id]           Slip detail
GET    /api/payroll/slips/[id]/download  PDF download
GET    /api/payroll/payslips             Employee payslips
POST   /api/payroll/festival-bonus       Process festival bonus
GET    /api/payroll/pf-ledger            PF transactions
GET    /api/payroll/bank-file            Bank transfer file
GET    /api/payroll/tax-certificate      Tax certificate
```

### Expenses — 4 routes
```
GET    /api/expenses                     Expenses overview
GET    /api/expenses/categories          Expense categories
POST   /api/expenses/claims              Submit claim
PUT    /api/expenses/claims/[id]         Update/approve claim
```

### Loans — 3 routes
```
GET    /api/loans                        Loan list
GET    /api/loans/[id]                   Loan detail
POST   /api/loans/[id]/repayments        Record repayment
```

### Organization — 10 routes
```
GET/POST    /api/departments             Department CRUD
GET/PUT/DEL /api/departments/[id]
GET/POST    /api/designations            Designation CRUD
GET/PUT/DEL /api/designations/[id]
GET/POST    /api/branches                Branch CRUD
GET/PUT/DEL /api/branches/[id]
GET/POST    /api/holidays                Holiday CRUD
GET/PUT/DEL /api/holidays/[id]
GET/POST    /api/shifts                  Shift CRUD
GET/PUT/DEL /api/shifts/[id]
```

### Biometric Devices — 6 routes
```
GET    /api/biometric-devices            Device list
POST   /api/biometric-devices            Register device
GET    /api/biometric-devices/[id]       Device detail
POST   /api/biometric-devices/[id]/sync  Trigger sync
POST   /api/biometric-devices/[id]/test  Test connection
GET    /api/biometric-devices/[id]/users Device-mapped users
POST   /api/biometric-devices/auto-map   Auto-map employees
```

### Sync Agent (External API v1) — 7 routes
```
GET    /api/sync-agent/download          Download sync agent
GET    /api/sync-agent/keys              API keys management
DEL    /api/sync-agent/keys/[id]         Revoke key
POST   /api/v1/sync/push                 Push attendance data
POST   /api/v1/sync/heartbeat            Agent heartbeat
GET    /api/v1/employees                 Employee list for agent
GET    /api/v1/keys                      Validate API key
GET    /api/v1/leaves                    Leave data for agent
GET    /api/v1/organization              Org config for agent
```

### Performance — 3 routes
```
GET    /api/performance                  Performance overview
GET/POST /api/performance/goals          Goals CRUD
PUT    /api/performance/goals/[id]       Update goal
```

### Recruitment — 3 routes
```
GET    /api/recruitment                  Recruitment overview
GET/POST /api/recruitment/jobs           Job postings
PUT    /api/recruitment/jobs/[id]        Update job
```

### Platform Admin — 16 routes
```
POST   /api/platform/auth               Platform login
GET    /api/platform/analytics           SaaS metrics
GET    /api/platform/audit-logs          Platform audit trail
GET    /api/platform/tenants             All organizations
POST   /api/platform/tenants/provision   Provision new tenant
GET    /api/platform/tenants/[id]        Tenant detail
PUT    /api/platform/tenants/[id]        Update tenant
PUT    /api/platform/tenants/[id]/status Activate/suspend
PUT    /api/platform/tenants/[id]/subscription  Subscription mgmt
GET    /api/platform/plans               Plan list
POST   /api/platform/impersonate         Start impersonation
GET    /api/platform/leads               Sales leads
PUT    /api/platform/leads/[id]          Update lead
PUT    /api/platform/leads/[id]/status   Lead status change
GET    /api/platform/employees           Cross-tenant employees
GET    /api/platform/employees/[id]      Employee detail
GET    /api/platform/employees/[id]/profile-data  Full profile
```

### Utility & System — 20 routes
```
GET    /api/dashboard/stats              Dashboard statistics
GET    /api/dashboard/analytics          Chart data
GET    /api/reports/attendance           Attendance report
GET    /api/audit-logs                   Activity logs
GET    /api/documents                    Documents list
POST   /api/documents/generate           Generate PDF document
GET    /api/notifications                Notification list
GET    /api/settings                     Org settings
PUT    /api/settings/geo-fence           GPS geo-fence config
PUT    /api/settings/notifications       Notification preferences
GET    /api/rbac                         RBAC permissions
POST   /api/rbac/delegations             Permission delegation
GET    /api/policies/late-deduction      Late policy config
GET    /api/search                       Global search
POST   /api/upload                       File upload
GET    /api/uploads/[...path]            Serve uploaded files
GET    /api/health                       Health check
POST   /api/leads                        Marketing lead capture
POST   /api/ess/document-request         ESS doc request
POST   /api/webhooks/stripe              Stripe webhook handler
```

### Cron Jobs — 4 routes
```
POST   /api/cron/auto-absent             Mark daily absentees
POST   /api/cron/escalation              Escalate stale approvals
POST   /api/cron/health-ping             System health ping
POST   /api/cron/leave-allocation        Annual leave allocation
```

---

## UI Pages (81 Pages)

### Admin Dashboard — 44 pages
| # | Module | Pages |
|---|--------|-------|
| 1 | Dashboard | Overview with analytics |
| 2 | Employees | List · Detail · New · Edit (4 pages) |
| 3 | Attendance | Dashboard + records |
| 4 | Leaves | Overview · Apply · Requests · Calendar · Types List · Type New · Type Edit (7 pages) |
| 5 | Payroll | Overview · Structures · Festival Bonus · PF Ledger (4 pages) |
| 6 | Expenses | List · New (2 pages) |
| 7 | Loans | List (1 page) |
| 8 | Departments | List · New · Edit (3 pages) |
| 9 | Designations | List · New · Edit (3 pages) |
| 10 | Organization | Branches · Holidays · Shifts (3 pages) |
| 11 | Performance | Overview · New Goal (2 pages) |
| 12 | Recruitment | Overview · New Job (2 pages) |
| 13 | Documents | Management (1 page) |
| 14 | Devices | Biometric Devices (1 page) |
| 15 | Announcements | List (1 page) |
| 16 | Notifications | List (1 page) |
| 17 | Settings | General · Delegations · Late Deduction (3 pages) |
| 18 | Compliance | Dashboard (1 page) |
| 19 | Approval Workflows | Configuration (1 page) |
| 20 | Audit Logs | List (1 page) |
| 21 | Reports | Analytics (1 page) |
| 22 | Profile | My Profile (1 page) |

### Employee Self-Service (ESS) — 12 pages
| # | Page | Purpose |
|---|------|---------|
| 1 | Dashboard | Personal overview |
| 2 | Attendance | Check-in/out + history |
| 3 | Leaves | Balance + history |
| 4 | Apply Leave | Leave form |
| 5 | Payslips | Salary slip downloads |
| 6 | Expenses | Claims list |
| 7 | New Expense | Claim form |
| 8 | Loans | Loan status |
| 9 | Documents | Request documents |
| 10 | Performance | Goals & reviews |
| 11 | Profile | Personal info |
| 12 | Announcements | Org news |

### Manager Portal — 5 pages
| # | Page | Purpose |
|---|------|---------|
| 1 | Dashboard | Team overview |
| 2 | Team | Direct reports |
| 3 | Attendance | Team records |
| 4 | Leaves | Review team leaves |
| 5 | Approvals | Action pending items |

### Platform Admin — 10 pages
| # | Page | Purpose |
|---|------|---------|
| 1 | Login | Platform auth |
| 2 | Dashboard | SaaS metrics |
| 3 | Tenants | All organizations |
| 4 | Tenant Detail | Org management |
| 5 | Plans | Subscription plans |
| 6 | Leads | Sales pipeline |
| 7 | Employees | Cross-tenant view |
| 8 | Employee Detail | Cross-tenant detail |
| 9 | Audit Logs | Platform activity |

### Marketing & Auth — 10 pages
| # | Page | Purpose |
|---|------|---------|
| 1 | Landing Page | Marketing homepage |
| 2 | Login | User authentication |
| 3 | Register | Organization signup |
| 4 | Forgot Password | Reset request |
| 5 | Reset Password | Token-based reset |
| 6 | Verify Email | Email confirmation |
| 7 | Terms of Service | Legal |
| 8 | Privacy Policy | Legal |
| 9 | Cookie Policy | Legal |
| 10 | Dashboard Redirect | Post-login router |

---

## Database Schema (61 Models)

### Platform Layer — 7 models
| Model | Purpose |
|-------|---------|
| PlatformAdmin | SaaS owner accounts |
| PlatformAuditLog | Platform-level activity logs |
| ImpersonationSession | Time-boxed admin sessions |
| Plan | Subscription plans (Starter/Growth/Enterprise) |
| Subscription | Tenant subscriptions |
| Invoice | Payment invoices |
| UsageRecord | Tenant usage metering |

### Core HR — 8 models
| Model | Purpose |
|-------|---------|
| Organization | Tenant (company/org) |
| Employee | Employee records |
| EmployeeDocument | Uploaded documents |
| Department | Department hierarchy |
| Designation | Job titles/grades |
| Branch | Office locations (with GPS coords) |
| Shift | Work shifts (with night shift support) |
| ApiKey | Org-level API keys |

### Auth & Security — 7 models
| Model | Purpose |
|-------|---------|
| User | Login accounts |
| Account | OAuth accounts |
| Session | Active sessions |
| VerificationToken | Generic tokens |
| PasswordResetToken | Reset tokens |
| EmailVerificationToken | Email verify tokens |
| PasswordHistory | Previous password hashes |

### Leave — 3 models
| Model | Purpose |
|-------|---------|
| LeaveType | Leave categories + rules |
| LeaveAllocation | Per-employee yearly allocation |
| LeaveApplication | Leave requests |

### Attendance — 1 model
| Model | Purpose |
|-------|---------|
| Attendance | Check-in/out records with GPS data |

### Payroll — 10 models
| Model | Purpose |
|-------|---------|
| SalaryStructure | Earnings + deductions template |
| SalaryStructureAssignment | Employee → structure mapping |
| SalarySlip | Monthly salary records |
| FestivalBonusConfig | Festival bonus rules |
| FestivalBonusPayment | Bonus payment records |
| LateDeductionPolicy | Late penalty rules |
| LateDeductionTier | Tiered penalty rates |
| PFAccount | Provident fund accounts |
| PFTransaction | PF journal entries |
| HolidayList + Holiday | Holiday calendar |

### Finance — 4 models
| Model | Purpose |
|-------|---------|
| Loan | Loan records |
| LoanRepayment | EMI payments |
| ExpenseCategory | Expense types |
| ExpenseClaim | Expense submissions |

### Approvals — 3 models
| Model | Purpose |
|-------|---------|
| ApprovalWorkflow | Workflow definitions |
| ApprovalRequest | Active approval instances |
| ApprovalStepLog | Step-by-step audit trail |

### Performance — 4 models
| Model | Purpose |
|-------|---------|
| ReviewCycle | Performance review periods |
| Goal | OKR goals |
| KeyResult | Goal key results |
| PerformanceReview | Review submissions |

### Recruitment — 3 models
| Model | Purpose |
|-------|---------|
| JobPosting | Open positions |
| Candidate | Candidate profiles |
| Application | Job applications |

### Communication — 2 models
| Model | Purpose |
|-------|---------|
| Announcement | Org-wide announcements |
| Notification | Per-user notifications |

### Compliance — 3 models
| Model | Purpose |
|-------|---------|
| AuditLog | Tenant activity logs |
| RBACPermission | Fine-grained permissions |
| DocumentRequest | ESS document requests |

### Biometric — 4 models
| Model | Purpose |
|-------|---------|
| BiometricDevice | Device records |
| DeviceSyncLog | Sync history |
| DeviceHealthLog | Health checks |
| SyncApiKey | Device auth keys |

### Sales — 1 model
| Model | Purpose |
|-------|---------|
| SalesLead | Marketing lead pipeline |

---

## Security

| Layer | Implementation |
|-------|---------------|
| **Authentication** | NextAuth v5, JWT tokens, email/password |
| **2FA** | TOTP (Time-based One-Time Password, authenticator app) |
| **Password Policy** | Min 8 chars, uppercase, number, special character required |
| **Password History** | Prevents reusing last N passwords |
| **Rate Limiting** | Per-IP, per-endpoint throttling |
| **Session Mgmt** | Concurrent session tracking + forced logout |
| **HTTPS** | TLS 1.3 via Let's Encrypt (auto-renewed) |
| **Security Headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| **Input Validation** | Zod schemas on every API endpoint |
| **Sanitization** | HTML/XSS sanitize library on user input |
| **RBAC** | 5 roles + resource-level + department-scoped + time-bounded |
| **Audit Trail** | Every sensitive action logged with IP + user agent |
| **Docker Security** | Non-root user, read-only filesystem where possible |
| **Impersonation** | Time-boxed (1 hour), reason-required, fully audited |

---

## Infrastructure & Deployment

### Production Environment
| Item | Detail |
|------|--------|
| **Server** | Hetzner Cloud VPS |
| **PaaS** | Coolify (self-hosted) |
| **Proxy** | Traefik v3.6.13 |
| **TLS** | Let's Encrypt (auto-renewal) |
| **Domain** | hr.ailearnersbd.com |
| **Status** | `running:healthy` ✅ |

### Docker Setup
```
┌─────────────────────────────────────────────┐
│  Traefik (Reverse Proxy)                     │
│  HTTPS termination + Gzip + HTTP→HTTPS       │
├──────────────┬──────────────────────────────┤
│              │                              │
│  ┌───────────▼──────────────┐               │
│  │  peopleflow-app           │  Port 3000   │
│  │  Next.js 16 (standalone)  │              │
│  │  4-stage multi-stage build│              │
│  └───────────────────────────┘              │
│                                              │
│  ┌───────────────────────────┐              │
│  │  peopleflow-worker         │  No port    │
│  │  BullMQ (7 workers)        │             │
│  │  Same codebase, worker cmd │             │
│  └───────────────────────────┘              │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL   │  │  Redis       │        │
│  │  Port 5432    │  │  Port 6379   │        │
│  │  61 tables    │  │  BullMQ +    │        │
│  │              │  │  Auth cache  │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### Docker Build Stages
1. **deps** — Install production dependencies only
2. **build** — Compile TypeScript + Next.js production build
3. **prod-deps** — Prune to production-only node_modules
4. **runner** — Minimal runtime image (non-root, health check)

### CI/CD Pipeline
```
Git Push (main) → GitHub → Coolify Webhook → Docker Build → Deploy → Health Check
```

---

## Bangladesh-Specific Compliance

| Feature | Detail |
|---------|--------|
| **Bangladesh Labour Act 2006** | Full leave compliance |
| **Maternity Leave** | Section 46-47: 8 weeks pre + 8 weeks post delivery |
| **Earned Leave** | 1 day per 18 working days |
| **Casual Leave** | 10 days per year |
| **Sick Leave** | 14 days per year |
| **Festival Bonus** | Eid-ul-Fitr, Eid-ul-Adha, Durga Puja, Christmas |
| **Provident Fund** | Double-entry bookkeeping, employer + employee match |
| **Late Deduction** | Tiered: Grace → Warning → Deduction (industry standard) |
| **Currency** | BDT (Bangladeshi Taka) |
| **Timezone** | Asia/Dhaka (UTC+6) |
| **Biometric** | ZKTeco integration (most popular in BD factories) |
| **Language** | Bengali (বাংলা) + English |
| **Sectors** | RMG, Corporate, NGO, Education, Healthcare |

---

## Development Timeline

| Phase | Status |
|-------|--------|
| Architecture Design & Schema | ✅ Complete |
| Core HR Module (Employee, Dept, Branch) | ✅ Complete |
| Authentication & RBAC | ✅ Complete |
| Attendance (GPS + Biometric) | ✅ Complete |
| Leave Management (BLA Compliant) | ✅ Complete |
| Payroll Engine + Festival Bonus + PF | ✅ Complete |
| Approval Engine | ✅ Complete |
| ESS + Manager Portal | ✅ Complete |
| Platform/SaaS Layer | ✅ Complete |
| Background Workers (BullMQ) | ✅ Complete |
| Security Hardening (OWASP) | ✅ Complete |
| Docker + Production Deployment | ✅ Complete |
| Marketing Landing Page | ✅ Complete |
| i18n (English + Bangla) | ✅ Complete |
| AI-powered Feature Integration | 🔜 Planned |
| Beta User Onboarding | 🔜 Planned |

---

*This worklog is auto-generated from live codebase analysis.*
*Last updated: April 16, 2026*

---

## QA Regression Update — May 8, 2026

- Resumed from context reset using `WORKLOG.md`, git state, Playwright config, and E2E test files as source of truth.
- Mobile regression verified on isolated HR dev server: `PORT=3100`, `TEST_BASE_URL=http://localhost:3100`.
- Local E2E DB used: `peopleflow_mobile_e2e` via `DATABASE_URL=postgresql://sharifmohammadnasrullah@localhost:5432/peopleflow_mobile_e2e`.
- Mobile ESS gate: `tests/e2e/ess-mobile.spec.ts` → **3 passed**.
- Full Playwright E2E gate: `playwright.no-server.config.ts --project=chromium` → **45 passed**.
- Regression fix: expense workflow tests now prefer the reusable `Office Supplies` category instead of the first alphabetic category (`Meals`), avoiding seeded monthly-limit exhaustion and keeping repeat E2E runs deterministic.

## Release-Grade Verification Update — May 8, 2026

- Lint gate: `npm run lint` → **passed** with warnings only, no errors.
- TypeScript gate: `npx tsc --noEmit` → **passed**.
- Production build gate: `npm run build` → **passed**; generated 82 static pages and dynamic routes successfully.
- Production-mode visual UAT smoke: Admin, HR, Manager, and Employee mobile portals checked across 22 role-critical pages → **passed**.
- Mobile UAT fix: `/ess/profile` had horizontal overflow on 390px mobile due wide tab labels; profile tabs now use a responsive 2-column mobile layout and inline desktop layout.
- Production prerequisite noted: local production-mode login requires Redis available because rate limiting fails closed in production. Redis must be healthy in deployment.
- Remaining non-blocking hardening notes: existing lint warnings and Turbopack NFT trace warning around Prisma/next.config should be cleaned up in a later hardening pass.

## Release-Grade Verification Follow-up — May 8, 2026

- Full E2E rerun after mobile profile UI fix initially failed because production-mode Redis auth rate limiting capped localhost login attempts at 10/15min, causing login-dependent tests to cascade.
- Added controlled QA configurability for auth rate limits via `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_AUTH_WINDOW_MS`; production defaults remain strict (`10` attempts / `15` minutes).
- Restarted production server with `RATE_LIMIT_AUTH_MAX=1000` for the E2E gate only.
- Full Playwright E2E gate rerun: **45/45 passed** in 58.7s.

## Checkpoint Hygiene Update — May 8, 2026

- Converted temporary no-server Playwright config into tracked `playwright.no-server.config.ts`.
- Added reusable scripts:
  - `npm run test:e2e:no-server`
  - `npm run test:e2e:prod`
- Added `/uploads/` to `.gitignore` so generated local/test receipt files do not pollute commits.
- Re-verified after hygiene changes:
  - `npm run lint` → passed with warnings only.
  - `npx tsc --noEmit` → passed.
  - `npm run build` → passed.
  - `npm run test:e2e:prod` against production server on port 3100 → **45/45 passed**.

## P17-BUGS-1-8 — Senior-Agent Bug-Fix Sweep (May 8, 2026)

A senior-engineer review (task `P17-BUGS-1-8`) flagged 8 critical bugs across the platform. All 8 were verified against the live code and fixed in a single commit (`efe12bd`). All 474 existing tests continued to pass; 4 new regression tests were added (478/478 green).

### Bug-by-bug summary

1. **Platform Plans API — `maxCustomRoles` missing** (`src/app/api/platform/plans/route.ts`)
   - The `Plan` model in `prisma/schema.prisma` already had `maxCustomRoles Int @default(0)` (added during P3-RBAC-V2), but the platform plans API was silently dropping it on POST create and PATCH update because the field was not in the destructured body / whitelisted update fields.
   - Fix: added `maxCustomRoles = 0` to the POST body destructure + create call, and `"maxCustomRoles"` to the PATCH allowed-fields list.

2. **Billing Plans API — RLS bypass via `auth()` + raw `prisma`** (`src/app/api/billing/plans/route.ts`)
   - The route used `auth()` + raw `prisma.*` calls, bypassing the `requireAuth()` + `auth.withDB()` RLS pattern used by every other tenant-scoped route. A mis-issued session could leak cross-tenant subscription data.
   - Fix: rewrote the GET handler to use `requireAuth()` + `auth.withDB()` (single Promise.all for plan + subscription). The billing/checkout and billing/status routes were already RLS-compliant — only the plans route was affected.

3. **CI/CD workflow couldn't be pushed** (`.github/workflows/ci.yml`)
   - The file historically could not be pushed because the deploy PAT lacked the `workflow` scope. The local file did not exist either.
   - Fix: created `.github/workflows/ci.yml` with the 4 standard quality gates (tsc / eslint / vitest / next build) on push + PR to `masterpiece-v2`, with concurrency cancellation. The push to `origin/masterpiece-v2` succeeded — the PAT now has the `workflow` scope and CI is live.

4. **Buddy punching checks missing `organizationId` filter** (`src/app/api/attendance/check-in/route.ts`)
   - Both the IP-based and device-fingerprint buddy-punch queries scanned the entire `Attendance` table without an org filter. Two different SaaS customers sharing a public IP (e.g. same co-working space) would falsely trigger buddy-punch warnings against each other.
   - Fix: added `organizationId: auth.organizationId` to both WHERE clauses so the signal is only meaningful within a single tenant's workforce.

5. **Payroll deducts loan EMI even when net salary is 0** (`src/lib/payroll-engine.ts`)
   - The previous implementation computed `loanDeduction = Σ emiAmount` unconditionally, summed it into `totalDeductions`, then clamped `netSalary` at 0 via `Math.max(0, …)`. This silently under-paid other priorities (PF, tax) and lost the audit trail of "loan EMI was due but unaffordable this cycle".
   - Fix: compute `netBeforeLoan = max(0, grossEarnings − nonLoanDeductions)` first, then deduct each loan EMI up to the remaining net (per-loan, in order). If net is 0 before any loan, defer the entire EMI bundle. A warn-level log (`LOAN_DEDUCTION_CAPPED_AT_NET_SALARY`) flags the deferred amount for HR to handle manually.

6. **Stripe webhook race condition on same-subscription concurrent events** (`src/app/api/webhooks/stripe/route.ts`)
   - The 3-layer idempotency envelope (DB ledger + Redis claim + DB insert) only protected against duplicate deliveries of the SAME event id. DIFFERENT events targeting the same subscription (e.g. `invoice.payment_succeeded` + `customer.subscription.updated` arriving within milliseconds) could race on `prisma.subscription.update`, causing lost updates or P2034 write conflicts.
   - Fix: added a per-subscription Redis lock (`stripe:sub:${subId}`, 30s TTL, 2s retry-then-give-up). If the lock cannot be acquired, the event-id claim is released and a 503 is returned so Stripe retries after the other worker finishes. The StripeEvent row is NOT persisted in that case.

7. **Stripe payment retry-success ignored** (`src/app/api/webhooks/stripe/route.ts`)
   - When a payment fails first then succeeds on retry, Stripe sends a NEW `invoice.payment_succeeded` event for the SAME `stripeInvoiceId`. The previous handler saw the existing invoice row (status `failed`) and returned early, leaving the invoice stuck at `failed` forever and the subscription's `currentPeriodEnd` never extended.
   - Fix: `handlePaymentSucceeded` now checks `existingInvoice.status === "failed"` and, if so, UPDATE the row to `paid` (clearing `failureReason`, setting `paidAt`, refreshing `amount` from `invoice.amount_paid`) + extend the subscription period in a single `$transaction`. The org is also restored to active in case the failed-payment grace cascade had suspended it.

8. **bKash disbursement — unrounded amount + random `merchantInvoiceNumber`** (`src/lib/disbursement-engine.ts`)
   - The amount was sent as `String(amount)` without rounding — bKash rejects amounts with >2 decimal places (e.g. 1234.56789 → 4001). The `merchantInvoiceNumber` was `PF-${Date.now()}-${Math.floor(Math.random() * 10000)}` which made it impossible to match a bKash transaction back to a salary slip for reconciliation.
   - Fix: amount is now rounded to 2 dp (`Math.round(amount * 100) / 100`) before the API call. The `merchantInvoiceNumber` is now deterministic: `PF-${salarySlipId}-${disbursementId}` — slipId is searchable in the bKash merchant portal, and the disbursementId ensures uniqueness per attempt so a failed-then-retried disbursement is not rejected as a duplicate.

### Test deltas

- `src/tests/stripe-webhook.test.ts`: +2 tests (retry-success on failed invoice, subscription-lock contention).
- `src/tests/payroll-integration.test.ts`: +2 tests (loan EMI cap when net is low, loan EMI fully deferred when net is 0).
- `src/tests/setup.ts`: added `invoice.update` to the prisma mock for the new retry-success path.

### Quality gates

- `npx tsc --noEmit` → **0 errors**.
- `npx vitest run` → **478/478 passed** (was 474, +4 new regression tests).
- `npx eslint` on all 9 changed files → **0 errors** (6 pre-existing warnings only).

### Git

- Branch: `masterpiece-v2`
- Commit: `efe12bd` — `P17-BUGS-1-8: Fix Plans API maxCustomRoles, Billing RLS, Buddy Punch org filter, Payroll zero-salary loan, Stripe race/retry, bKash rounding/merchantID`
- Pushed to `origin/masterpiece-v2` — **success** (the `workflow` PAT scope is now in place; `.github/workflows/ci.yml` is live on the remote).

---

## P17-BUGS-9-16 — Senior-Agent Bug-Fix Sweep, Round 2 (Jul 10, 2026)

A second senior-engineer review (task `P17-BUGS-9-16`) flagged 8 more bugs (9 through 16) across the RBAC, recruitment, and public-careers subsystems. All 8 were verified against the live code and fixed in a single commit (`32eff8b`). The 478-test baseline held; 27 new regression tests were added (505/505 green).

### Bug-by-bug summary

9. **bKash merchantInvoiceNumber — already fixed in bug 8** (`src/lib/disbursement-engine.ts`)
   - Verified at fix time: `merchantInvoiceNumber = \`PF-${salarySlipId}-${disbursementId}\`` is already in place from commit `efe12bd`. No further action.

10. **RBAC permission cache only clears on the local node** (`src/lib/rbac-v2.ts`)
    - The in-process `permissionCache` Map had a 60s TTL, but `invalidatePermissionCache(userId)` only deleted the local entry. On multi-worker/multi-container deployments a stale cache on worker B kept serving old permissions for up to 60s after a role change on worker A.
    - Fix: TTL reduced 60s → 30s. `invalidatePermissionCache` is now `async` and additionally deletes a Redis marker key `rbac:perms:${userId}` (set on cache populate via `cacheSet`). On every cache read, if Redis is reachable but the marker is missing, the local entry is treated as stale and discarded. When Redis is disabled (tests), the local cache is trusted as before. All 4 call sites updated to `await` or fire-and-forget `.catch()`.

11. **Role update can delete system core roles' permissions** (`src/app/api/rbac/roles/[id]/route.ts`)
    - The PATCH handler allowed replacing the entire `RolePermission` set on system roles (admin / hr_admin / manager / employee / super_admin), so a malicious or careless admin could strip critical invariants (e.g. "admin can always view employees") and lock the tenant out of recovery paths.
    - Fix: PATCH now rejects with 403 `SYSTEM_ROLE_PERMISSIONS_LOCKED` when `permissions` is supplied AND `role.isSystem === true`. Cosmetic edits (name / description / color) on system roles remain permitted. Custom roles (`isSystem=false`) are fully editable.

12. **Empty array `[]` for departmentIds treated as "all departments"** (`src/lib/rbac-v2.ts`)
    - The scope check used `if (!perm.departmentIds || perm.departmentIds.length === 0) return true;` — so an explicit `[]` (intended to mean "scoped, but to no departments") was treated as global scope, accidentally granting org-wide access.
    - Fix: scope semantics now distinguish `undefined`/`null` (all departments → allow) from `[]` (explicitly no departments → deny) from `[id1, id2]` (scoped to listed). Same logic mirrored for `branchIds`/branch scope.

13. **Career portal — fake CV overwrites real candidate** (`src/app/api/public/careers/[orgSlug]/jobs/[jobId]/route.ts` POST)
    - The apply endpoint updated the existing candidate's `resumeUrl`/`portfolioUrl`/etc. BEFORE checking for an existing application. An attacker could submit a fake application using a victim's email + a fake resume URL and the victim's real resume would be overwritten, even though the application was ultimately rejected with 409.
    - Fix: the duplicate-application check is now moved BEFORE any candidate mutation. If a candidate with this email has already applied to this job, the route short-circuits with 409 `ALREADY_APPLIED` and touches nothing. Otherwise the existing create/update candidate + create application flow runs as before.

14. **Career portal — closed/expired jobs still visible** (`src/app/api/public/careers/[orgSlug]/jobs/route.ts` + `[jobId]/route.ts`)
    - The public listing and detail endpoints only filtered by `status: "open"`. A job whose `closesAt` had passed but whose status hadn't been manually flipped to `"closed"` was still listed / returned.
    - Fix: added `OR: [{ closesAt: null }, { closesAt: { gte: now } }]` to the WHERE clauses of all three public careers routes (list, detail, apply). Expired jobs now return 404 from the detail/apply routes and disappear from the listing.

15. **Resume parsing — invalid JSON causes 500** (`src/app/api/recruitment/parse-resume/route.ts`)
    - `await req.json()` could throw a `SyntaxError` on a malformed body, which fell through to the generic 500 handler — looking like a server bug rather than a client error. Same issue existed in the careers POST apply route.
    - Fix: JSON parsing is now wrapped in try/catch in both routes; malformed bodies return 400 `Invalid JSON body`.

16. **Career portal public APIs — no rate limiting or pagination**
    - 16a. **Rate limiting**: added IP-based `rateLimit` calls to all three careers public routes. GET list + GET detail: 30 req/min. POST apply: tighter 10 req/min (writes rows + triggers notification emails). `X-RateLimit-*` headers forwarded on success responses via `applyRateLimitHeaders`.
    - 16b. **Pagination**: the listing route now accepts `?page=&limit=` (default 10, clamped to [1, 50]) and runs `findMany` + `count` in parallel via `Promise.all`. Response shape extended to `{ data, jobs (back-compat alias), total, pagination: { page, limit, total, totalPages } }`. Existing clients reading the old `jobs` field continue to work.

### Test deltas

- `src/tests/p17-bugs-9-16.test.ts` (new, 23 tests): covers bugs 10/12/13/14/15/16. Mocks `@/lib/prisma` (jobPosting/candidate/application/role/rolePermission/userRoleAssignment/rBACPermission/permission), `@/lib/rate-limit`, `@/lib/audit-log`, `@/lib/logger`. Uses `vi.hoisted()` for the prisma mock object so the `vi.mock` factory can reference it.
- `src/tests/p17-bugs-11-system-roles.test.ts` (new, 4 tests): covers bug 11. Mocks `@/lib/rbac-v2` (requirePermission + invalidatePermissionCache) and exercises the PATCH handler directly with system / custom / missing roles.

### Quality gates

- `npx tsc --noEmit` → **0 errors**.
- `npx vitest run` → **505/505 passed** (was 478, +27 new regression tests across 2 new files).
- `npx eslint` on the 8 changed files → **0 errors** (0 warnings).

### Git

- Branch: `masterpiece-v2`
- Commit: `32eff8b` — `P17-BUGS-9-16: Fix RBAC cache TTL, system role protection, empty array scope, career portal email/closesAt/resume/rate-limit/pagination`
- Pushed to `origin/masterpiece-v2` — **success** (push confirmed `99cc0d0..32eff8b`).

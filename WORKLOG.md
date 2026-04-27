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

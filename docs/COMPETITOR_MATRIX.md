# PeopleFlow Competitor Matrix

_Last updated: 2026-06-01_

## Purpose
This matrix converts competitor research into product decisions for PeopleFlow. It is not for copying competitors; it is for learning market expectations and finding gaps PeopleFlow can beat.

## Comparison Matrix — Initial Version

| Product | Market | Strengths | Weakness / Gap | PeopleFlow Lesson |
|---|---|---|---|---|
| BambooHR | Global SMB HRIS | Clean employee records, onboarding/offboarding, time-off, reporting, workflows, performance, mobile UX | Payroll mostly US-centric; pricing can be high; less Bangladesh-specific | PeopleFlow needs simple onboarding, polished employee profiles, clean leave UX, and clear reporting. Bangladesh payroll/local office fit can be our edge. |
| Zoho People | Global SMB/mid-market | Attendance via web/mobile/biometric, geo/IP restrictions, facial kiosk, leave policies, shifts, reports, broad suite | Dense UI; ecosystem lock-in; setup complexity | PeopleFlow should learn attendance flexibility but keep UX simpler and Bengali-first. Geo/IP/biometric/device policies should be clear. |
| Rippling | Global HR/IT automation | Deep automation, HR + IT workflows, strong integrations, scalable operations | Too complex/costly for small Bangladesh offices | Long-term inspiration: automation engine, workflow builder, app integrations. Not P0. |
| Gusto | US SMB payroll/HR | Very simple payroll/HR onboarding, strong small-business UX | US-specific payroll/compliance | Learn simplicity and guided setup; localize for Bangladesh payroll/compliance. |
| Workday | Enterprise HCM | Enterprise scale, analytics, org structures, compliance | Too complex/expensive for SMEs | Use as architecture inspiration for role/org hierarchy and reporting, not UX baseline for small offices. |
| AttendanceBot | Leave/attendance specialist | Chat-based leave/attendance in Slack/Teams, fast approvals, calendar visibility | Depends on chat ecosystem; less full HRMS depth | PeopleFlow can add fast leave approvals and calendar visibility without forcing chat dependency. |
| Vacation Tracker | Leave specialist | Simple leave policies, approvals, balances, calendar/payroll integration | Narrow scope | Leave module should be effortless, transparent, and manager-friendly. |
| Homebase / When I Work | Hourly workforce | Scheduling, time clock, mobile punch, shift operations | Less Bangladesh HR/payroll specificity | For attendance/shift UX, learn from hourly workforce products. |
| Odoo / Open HRMS | Modular ERP HR | Modular, extensible, biometric integration patterns | Can feel technical/heavy | PeopleFlow needs modular architecture but simpler office UX. |
| AccordHRM | Bangladesh HR/payroll | Local payroll, PF/GF/WPPF, tax/compliance, GPS + biometric attendance, shifts/overtime, reports, onboarding/bulk upload | UX quality and transparency need deeper inspection | PeopleFlow must match local payroll/attendance expectations and beat with UX, clarity, SaaS packaging, and device strategy. |
| PeopleDesk | Bangladesh HR suite | Payroll, attendance, leave, compliance, KPI/performance, ESS, shift/task management | May be costly/training-heavy; quality needs hands-on inspection | PeopleFlow needs all-in-one HR flow but easier onboarding and better Bengali/office admin guidance. |
| PiHR | Bangladesh/Regional HR | Biometric attendance, payroll automation, ESS, recruitment/performance | Advanced analytics may be limited | PeopleFlow can compete with stronger analytics and better workflow design. |
| SmartHRM / Kormee | Bangladesh HR/payroll | Payroll, attendance, leave, loans/advance, performance, biometric/multi-layer access | Likely traditional UI/workflow | PeopleFlow should provide modern UX and clearer self-service while covering local essentials. |

## Product Principles From Research

1. **Employee records are the foundation**
   - Every module depends on clean employee data, role, branch, department, shift, and manager mapping.

2. **Leave + attendance must feel effortless**
   - These are daily-use workflows. If they are confusing, offices will not switch.

3. **Bangladesh payroll/compliance is a differentiator**
   - Global tools are strong but not local. PeopleFlow must eventually support local payroll realities better.

4. **Biometric/device support must be honest**
   - Local competitors advertise biometric/GPS. PeopleFlow must support devices, but without false universal direct-cloud claims.

5. **Bengali-first UX can beat many tools**
   - Many products list features; few make the office admin journey feel simple in Bangla.

6. **Guided setup matters**
   - Offices need step-by-step setup: company → branches → departments → employees → shifts → leave policies → attendance → payroll.

7. **Reporting must be decision-ready**
   - Attendance, leave, payroll, overtime, employee status, and device sync reports must be clear and exportable.

## Immediate PeopleFlow Upgrade Implications

### P0 / P1
- Stabilize deployment and worker/migration architecture.
- Audit employee data model and setup flow.
- Audit leave + attendance UX against Zoho/BambooHR/local expectations.
- Create tenant isolation and RBAC tests.
- Build office setup checklist/wizard.

### P2
- Improve reports and export flows.
- Add queue/worker monitoring.
- Improve payroll/compliance roadmap.
- Add calendar visibility for leave/attendance.

### P3
- Workflow automation.
- Advanced analytics.
- Marketplace/integrations.
- Certified device/vendor program.

## Research Sources Used
- BambooHR feature summaries and reviews
- Zoho People attendance/features/pricing comparison pages
- AccordHRM Bangladesh HR/payroll page and Bangladesh HR software roundups
- PeopleDesk pages and Bangladesh HR software roundups
- Prior seeded research in `docs/COMPETITOR_RESEARCH_PLAN.md`

## Next Research Needs
- Hands-on screenshots/demo review for local competitors where possible.
- Pricing/package table for Bangladesh competitors.
- Feature-by-feature gap analysis against PeopleFlow current routes/modules.

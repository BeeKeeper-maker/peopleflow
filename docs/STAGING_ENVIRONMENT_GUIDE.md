# PeopleFlow HRMS — Staging Environment Guide

> Guide for setting up a staging environment that mirrors production
> so changes can be validated end-to-end before they ship to real
> customers.

## Overview
A staging environment for testing changes before production deployment.

## Option 1: Local Docker (Recommended for Small Teams)

### Prerequisites
- Docker + Docker Compose installed locally
- Node.js 20+ for development

### Setup
```bash
# Clone repo
git clone https://github.com/BeeKeeper-maker/peopleflow.git
cd peopleflow

# Copy env
cp .env.example .env
# Fill in with test values (use dummy secrets)

# Start services
docker compose up -d

# Run migrations
docker compose --profile release run --rm migrate

# Access at http://localhost:3000
```

### Seed Test Data
```bash
# Seed plans + platform admin
docker compose exec app npx prisma db seed

# Seed a test tenant
docker compose exec app npx tsx scripts/seed-tenant.ts
```

## Option 2: Separate VPS (Recommended for Pre-Production)

### Setup
1. Provision a second Contabo VPS (2 vCPU / 4GB minimum)
2. Use a subdomain: `staging.yourcompany.com`
3. Run the deploy script:
```bash
sudo DOMAIN=staging.yourcompany.com bash scripts/deploy-contabo.sh
```
4. Use Stripe TEST keys (sk_test_*, whsec_*)
5. Use a test SMTP service

### Data Sync
- Do NOT sync production data to staging (PII risk)
- Use seed scripts to generate test data
- Alternatively, use anonymized production dumps

## Testing Checklist

Before deploying to production, verify in staging:

### Functional
- [ ] Tenant registration
- [ ] Employee CRUD
- [ ] Attendance check-in/out
- [ ] Leave application + approval
- [ ] Payroll processing
- [ ] Biometric device sync
- [ ] Bengali language
- [ ] Email notifications
- [ ] Stripe checkout (test mode)

### Non-Functional
- [ ] Health check passes
- [ ] Crons execute successfully
- [ ] Backups run
- [ ] No memory leaks (check system monitor after 24h)
- [ ] SSL valid
- [ ] Rate limiting works (hit an endpoint 100+ times)

### Regression
- [ ] All 402 unit tests pass
- [ ] All E2E tests pass
- [ ] TypeScript compiles (0 errors)
- [ ] ESLint passes (0 errors)
- [ ] Production build succeeds

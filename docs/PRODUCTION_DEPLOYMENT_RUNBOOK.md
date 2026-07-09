# PeopleFlow HRMS — Production Deployment Runbook

> Operator-facing runbook for deploying PeopleFlow HRMS to a production
> Contabo VPS (or equivalent Ubuntu host). Follows the
> `scripts/deploy-contabo.sh` script shipped in this repo.

## Prerequisites

### Infrastructure
- Contabo VPS (or equivalent): 4 vCPU / 8GB RAM / 100GB SSD minimum
- Ubuntu 22.04 or 24.04 LTS
- Domain name with DNS A record pointing to VPS IP
- GitHub repository access

### Required Accounts
- Stripe account (for billing)
- SMTP service (Gmail/SendGrid/Mailgun)
- S3-compatible storage (optional, for backups)
- Sentry account (optional, for error monitoring)

## Pre-Deployment Checklist

- [ ] DNS A record configured (verify: `dig your-domain.com`)
- [ ] Stripe live keys obtained (sk_live_*, whsec_*)
- [ ] SMTP credentials ready
- [ ] S3 backup bucket created (if using off-site backup)
- [ ] Sentry DSN obtained (if using error monitoring)
- [ ] VPS accessible via SSH
- [ ] Firewall configured (ports 80, 443, 22 only)

## Deployment Steps

### Step 1: Run Deployment Script
```bash
sudo DOMAIN=hr.yourcompany.com bash scripts/deploy-contabo.sh
```

The script will:
1. Install Docker + Docker Compose
2. Configure UFW firewall
3. Generate secure passwords and .env file
4. Configure Caddy reverse proxy with auto-SSL
5. Set up database backup cron (daily 2 AM)
6. Set up app cron jobs (auto-absent, escalation, leave-allocation, health-ping)
7. Configure log rotation

### Step 2: Verify Deployment
```bash
# Health check (light)
curl https://hr.yourcompany.com/api/health

# Deep health check
curl https://hr.yourcompany.com/api/health?deep=1

# Should return:
# {"status":"healthy","checks":{"database":{"status":"healthy"},"redis":{"status":"healthy"}}}
```

### Step 3: Configure Platform Admin
```bash
# Read generated credentials
cat /opt/peopleflow/.env | grep PLATFORM_ADMIN

# Login at:
# https://hr.yourcompany.com/platform/login
```

### Step 4: Configure Stripe Webhook
1. Go to Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://hr.yourcompany.com/api/webhooks/stripe`
3. Events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
4. Copy the webhook signing secret (whsec_*)
5. Update .env: `STRIPE_WEBHOOK_SECRET=whsec_*`
6. Restart: `cd /opt/peopleflow && docker compose restart app`

### Step 5: Configure SMTP
1. Update .env with SMTP credentials:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com
```
2. Test email: `docker compose exec app node -e "require('./src/lib/email').sendEmail({...})"`
3. Restart: `docker compose restart app worker`

### Step 6: Configure VAPID Keys (Web Push)
```bash
# Generate VAPID keys
docker compose exec app npx web-push generate-vapid-keys

# Add to .env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generated-public-key>
VAPID_PRIVATE_KEY=<generated-private-key>

# Restart
docker compose restart app worker
```

> Note: `scripts/deploy-contabo.sh` already generates and writes VAPID
> keys to `.env` on first deploy. This step is only needed when
> rotating keys or when the keys are missing.

### Step 7: Run Database Migrations (if updating)
```bash
cd /opt/peopleflow
docker compose --profile release run --rm migrate
```

## Post-Deployment Verification

### Functional Tests
- [ ] Platform admin can login at /platform/login
- [ ] New tenant can register at /register
- [ ] Tenant admin can login at /login
- [ ] Employee can check in/out
- [ ] Leave application works
- [ ] Payroll processing works
- [ ] Bengali language toggle works
- [ ] Email notifications sent

### Cron Job Verification
```bash
# Check cron is configured
crontab -l | grep peopleflow

# Should show:
# 0 2 * * * ... backup-db.sh
# 59 23 * * * ... auto-absent
# 0 * * * * ... escalation
# 5 0 1 * * ... leave-allocation
# */15 * * * * ... health-ping
```

### Backup Verification
```bash
# Check backup directory
ls -la /backups/daily/

# Verify latest backup
gzip -t /backups/daily/peopleflow_*.sql.gz
```

## Rollback Procedure

### If a bad deployment occurs:
```bash
# 1. Stop the app
cd /opt/peopleflow
docker compose down

# 2. Find the previous working image
docker images | grep peopleflow

# 3. Revert to previous .env if needed
cp .env.backup .env

# 4. Restart
docker compose up -d
```

### If a bad migration occurs:
```bash
# 1. Stop the app
docker compose down

# 2. Restore from backup
gunzip < /backups/daily/peopleflow_YYYYMMDD_*.sql.gz | docker compose exec -T db psql -U peopleflow peopleflow

# 3. Restart
docker compose up -d
```

## Monitoring

### Health Endpoints
- Light: `GET /api/health` (server alive only)
- Deep: `GET /api/health?deep=1` (DB + Redis check)

### System Monitor
- URL: `https://hr.yourcompany.com/settings/system-monitor`
- Shows: employee count, attendance, queue depth, memory usage, uptime

### Queue Health
- URL: `https://hr.yourcompany.com/settings/queue-health`
- Shows: BullMQ queue depths, failed jobs

### Log Locations
- App logs: `docker compose logs app`
- Worker logs: `docker compose logs worker`
- Caddy logs: `/var/log/caddy/peopleflow.log`
- Backup logs: `/var/log/peopleflow-backup.log`
- Cron logs: `/var/log/peopleflow-cron.log`
- Docker logs: `/var/log/peopleflow-docker.log`

## Troubleshooting

### App won't start
1. Check logs: `docker compose logs app --tail 50`
2. Check .env: `cat .env | grep -v PASSWORD`
3. Verify DB: `docker compose exec db pg_isready -U peopleflow`
4. Verify Redis: `docker compose exec redis redis-cli ping`

### Database connection errors
1. Check PgBouncer: `docker compose logs pgbouncer`
2. Verify DATABASE_URL uses pgbouncer:6432
3. Check connection limit: `docker compose exec db psql -U peopleflow -c "SELECT count(*) FROM pg_stat_activity;"`

### Email not sending
1. Check SMTP config in .env
2. Test connection: `docker compose exec app node -e "console.log(require('nodemailer').createTransport({host:process.env.SMTP_HOST,port:587,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}).verify())"`
3. Check worker logs: `docker compose logs worker --tail 50 | grep email`

### Cron jobs not running
1. Check crontab: `crontab -l`
2. Check CRON_SECRET: `grep CRON_SECRET .env`
3. Test manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://hr.yourcompany.com/api/cron/health-ping`

### SSL issues
1. Check Caddy: `systemctl status caddy`
2. Check Caddy logs: `journalctl -u caddy --tail 50`
3. Verify DNS: `dig your-domain.com`

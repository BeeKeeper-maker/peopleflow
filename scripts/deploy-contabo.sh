#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# PeopleFlow HRMS — Production Deployment Script for Contabo VPS
# ═══════════════════════════════════════════════════════════════════
#
# This script sets up a complete production environment on a fresh
# Contabo VPS running Ubuntu 22.04/24.04.
#
# What it does:
#   1. Installs Docker + Docker Compose
#   2. Sets up firewall (UFW)
#   3. Creates deployment directory structure
#   4. Generates secure passwords and .env file
#   5. Configures automatic database backups (cron)
#   6. Sets up log rotation
#   7. Configures SSL via Caddy reverse proxy
#
# Usage:
#   chmod +x scripts/deploy-contabo.sh
#   sudo ./scripts/deploy-contabo.sh
#
# Prerequisites:
#   - Fresh Ubuntu 22.04/24.04 VPS from Contabo
#   - Minimum 4 vCPU / 8GB RAM / 100GB SSD
#   - Domain name pointed to VPS IP (A record)
#
# After deployment:
#   - App available at https://your-domain.com
#   - Platform admin at https://your-domain.com/platform
#   - Health check at https://your-domain.com/api/health?deep=1
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ──
DEPLOY_DIR="/opt/peopleflow"
DOMAIN="${DOMAIN:-}"
REPO_URL="https://github.com/BeeKeeper-maker/peopleflow.git"
BRANCH="masterpiece-v2"

# ── Helpers ──
log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }
error() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ERROR: $*" >&2; exit 1; }

# ── Check prerequisites ──
if [ "$(id -u)" -ne 0 ]; then
    error "Please run as root: sudo $0"
fi

if [ -z "$DOMAIN" ]; then
    echo "Enter your domain name (e.g., hr.yourcompany.com):"
    read -r DOMAIN
    if [ -z "$DOMAIN" ]; then
        error "Domain name is required"
    fi
fi

log "═══════════════════════════════════════════════"
log "  PeopleFlow HRMS — Contabo VPS Deployment"
log "  Domain: $DOMAIN"
log "  Branch: $BRANCH"
log "═══════════════════════════════════════════════"

# ── Step 1: System Update ──
log "Step 1/8: Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban htop jq

# ── Step 2: Install Docker ──
log "Step 2/8: Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "  Docker installed ✓"
else
    log "  Docker already installed ✓"
fi

# ── Step 3: Firewall Setup ──
log "Step 3/8: Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp       # SSH
ufw allow 80/tcp       # HTTP (Caddy redirect)
ufw allow 443/tcp      # HTTPS
ufw --force enable
log "  Firewall configured ✓"

# ── Step 4: Create Deployment Directory ──
log "Step 4/8: Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Clone or pull latest code
if [ -d ".git" ]; then
    log "  Updating existing deployment..."
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    log "  Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" .
fi

# ── Step 5: Generate Secure Passwords ──
log "Step 5/8: Generating secure configuration..."

POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
PLATFORM_JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
PF_APP_DB_PASSWORD=$(openssl rand -hex 24)
CRON_SECRET=$(openssl rand -hex 24)

# Check if .env already exists (preserve existing secrets)
if [ -f ".env" ]; then
    log "  .env already exists — preserving secrets..."
    # Source existing .env to keep secrets
    set -a
    source .env 2>/dev/null || true
    set +a
else
    log "  Creating new .env file..."
    cat > .env << EOF
# ═══════════════════════════════════════════════
# PeopleFlow HRMS — Production Environment
# Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')
# Domain: $DOMAIN
# ═══════════════════════════════════════════════

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
PF_APP_DB_PASSWORD=$PF_APP_DB_PASSWORD
DATABASE_URL=postgresql://peopleflow_app:$PF_APP_DB_PASSWORD@db:5432/peopleflow

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379

# Auth
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=https://$DOMAIN
PLATFORM_JWT_SECRET=$PLATFORM_JWT_SECRET

# Encryption (for bKash/Nagad credentials at rest)
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Cron
CRON_SECRET=$CRON_SECRET

# App
NEXT_PUBLIC_APP_URL=https://$DOMAIN
NODE_ENV=production

# Platform Admin (change after first login)
PLATFORM_ADMIN_EMAIL=admin@$DOMAIN
PLATFORM_ADMIN_PASSWORD=$(openssl rand -base64 16)

# SMTP (configure with your provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@$DOMAIN

# Sentry (optional)
SENTRY_DSN=

# Storage (local for Contabo VPS; switch to s3/r2 for cloud)
STORAGE_PROVIDER=local

# Stripe (optional — for billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF
    chmod 600 .env
    log "  .env created with secure passwords ✓"
fi

# ── Step 6: Build and Start ──
log "Step 6/8: Building and starting containers..."
docker compose --profile release build
docker compose up -d

# Wait for database to be healthy
log "  Waiting for database..."
sleep 10
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U peopleflow &>/dev/null; then
        log "  Database is ready ✓"
        break
    fi
    sleep 2
done

# Run migrations
log "  Running database migrations..."
docker compose --profile release run --rm migrate

# ── Step 7: Setup Caddy Reverse Proxy ──
log "Step 7/8: Setting up Caddy reverse proxy with SSL..."

# Create Caddy configuration
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile << CADDYEOF
$DOMAIN {
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        Permissions-Policy "camera=(), microphone=(), geolocation=(self)"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }

    # Compression
    encode gzip zstd

    # Logging
    log {
        output file /var/log/caddy/peopleflow.log
        format json
    }

    # Rate limiting (basic)
    @api path /api/*
    handle @api {
        reverse_proxy localhost:3000
    }
}

# Redirect www to non-www
www.$domain {
    redir https://$DOMAIN{uri} permanent
}
CADDYEOF

# Install Caddy
if ! command -v caddy &> /dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy
fi

systemctl enable caddy
systemctl restart caddy
log "  Caddy configured with automatic SSL ✓"

# ── Step 8: Setup Cron Jobs ──
log "Step 8/8: Setting up automated tasks..."

# Database backup (daily at 2 AM)
mkdir -p /backups
(crontab -l 2>/dev/null; echo "0 2 * * * cd $DEPLOY_DIR && POSTGRES_PASSWORD=\$(grep POSTGRES_PASSWORD .env | cut -d= -f2) DB_HOST=db DB_USER=peopleflow DB_NAME=peopleflow bash scripts/backup-db.sh >> /var/log/peopleflow-backup.log 2>&1") | crontab -

# Docker container auto-restart check (every 5 min)
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $DEPLOY_DIR && docker compose ps | grep -q 'Exit' && docker compose up -d >> /var/log/peopleflow-docker.log 2>&1") | crontab -

# ── App Cron Endpoints (authenticated via CRON_SECRET) ──
# These call the app's internal cron API endpoints with the Bearer token.
# Each endpoint is idempotent and safe to call multiple times.

# Auto-absent: mark employees as absent if they haven't checked in by 11:59 PM
(crontab -l 2>/dev/null; echo "59 23 * * * curl -sf -H \"Authorization: Bearer $CRON_SECRET\" https://$DOMAIN/api/cron/auto-absent >> /var/log/peopleflow-cron.log 2>&1") | crontab -

# Escalation: escalate pending approvals past their SLA (every hour)
(crontab -l 2>/dev/null; echo "0 * * * * curl -sf -H \"Authorization: Bearer $CRON_SECRET\" https://$DOMAIN/api/cron/escalation >> /var/log/peopleflow-cron.log 2>&1") | crontab -

# Leave allocation: annual leave balance allocation (1st of every month at 12:05 AM)
(crontab -l 2>/dev/null; echo "5 0 1 * * curl -sf -H \"Authorization: Bearer $CRON_SECRET\" https://$DOMAIN/api/cron/leave-allocation >> /var/log/peopleflow-cron.log 2>&1") | crontab -

# Health ping: keep worker alive + log heartbeat (every 15 min)
(crontab -l 2>/dev/null; echo "*/15 * * * * curl -sf -H \"Authorization: Bearer $CRON_SECRET\" https://$DOMAIN/api/cron/health-ping >> /var/log/peopleflow-cron.log 2>&1") | crontab -

# Log rotation
cat > /etc/logrotate.d/peopleflow << EOF
/var/log/peopleflow-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

log "  Cron jobs configured ✓"

# ── Summary ──
log ""
log "═══════════════════════════════════════════════════════════════"
log "  ✅ Deployment Complete!"
log "═══════════════════════════════════════════════════════════════"
log ""
log "  Application:    https://$DOMAIN"
log "  Platform Admin: https://$DOMAIN/platform"
log "  Health Check:   https://$DOMAIN/api/health?deep=1"
log ""
log "  Admin Email:    admin@$DOMAIN"
log "  Admin Password: (see .env file)"
log ""
log "  Database:       PostgreSQL 16 (Docker)"
log "  Redis:          Redis 7 (Docker)"
log "  Reverse Proxy:  Caddy (auto SSL)"
log "  Backups:        Daily at 2 AM (/backups)"
log ""
log "  Configuration:  $DEPLOY_DIR/.env"
log "  Logs:           /var/log/caddy/peopleflow.log"
log "                  /var/log/peopleflow-*.log"
log ""
log "  Next steps:"
log "    1. Change admin password after first login"
log "    2. Configure SMTP in .env for email notifications"
log "    3. Set up Stripe keys in .env for billing (optional)"
log "    4. Configure S3/R2 storage in .env (optional)"
log "    5. Test backup restore: bash scripts/backup-db.sh --verify"
log ""
log "═══════════════════════════════════════════════════════════════"

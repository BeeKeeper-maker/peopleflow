import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// ── Environment Variable Validation ──────────────────────────────
// Validates all env vars at build time. Crashes in production if
// required vars are missing. See src/lib/env.ts for details.
// Skip during CI builds where env vars may not be set.
if (process.env.SKIP_ENV_VALIDATION !== "true") {
  try {
    require("./src/lib/env");
  } catch (e) {
    // Only fail in production; dev can proceed with defaults
    if (process.env.NODE_ENV === "production") {
      console.error(e);
      throw e;
    }
  }
}

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Required for Docker deployment — produces self-contained server
  output: 'standalone',

  // Optimize production builds
  reactStrictMode: true,

  // TypeScript errors are NO LONGER ignored in production builds.
  // The local `npx tsc --noEmit` gate plus this production gate together
  // ensure type safety is enforced before any deploy. If a build fails
  // here, fix the type error rather than re-enabling ignoreBuildErrors.
  typescript: {
    ignoreBuildErrors: false,
  },

  // Enable experimental features for performance
  experimental: {
    // Optimize package imports - tree shaking for large libraries
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tanstack/react-query",
      "recharts",
      "framer-motion",
    ],
  },

  // Empty turbopack config to enable Turbopack
  turbopack: {},

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compress responses
  compress: true,

  // Prevent standalone output tracing from accidentally bundling repository
  // documents/config/build artifacts into API route traces. Runtime-required
  // assets such as public/, messages/, Prisma schema and query engines are not
  // excluded here.
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./*.md",
      "./Dockerfile*",
      "./docker-compose*.yml",
      "./docker/**",
      "./docs/**",
      "./tools/**",
      "./coverage/**",
      "./playwright-report/**",
      "./test-results/**",
      "./eslint.config.*",
      "./vitest.config.*",
    ],
  },

  // Enable source maps for Sentry in production (uploaded, not served)
  productionBrowserSourceMaps: false,

  // ══════════════════════════════════════════════════════════════
  // OWASP Security Headers — Global Enforcement
  // ══════════════════════════════════════════════════════════════
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ── Clickjacking Protection ──
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // ── MIME Type Sniffing Prevention ──
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // ── XSS Protection (legacy browsers) ──
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // ── DNS Prefetching ──
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // ── Referrer Policy ──
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // ── HTTPS Enforcement (HSTS) ──
          // 1 year, include subdomains, allow preload list submission
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // ── Browser Feature Restrictions ──
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // ── Content Security Policy ──
          // Production: removes 'unsafe-eval' (only needed for Next.js dev mode)
          // 'unsafe-inline' remains for scripts due to Next.js hydration requirements
          // (nonce-based CSP would require middleware — future enhancement)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + inline (Next.js hydration needs unsafe-inline)
              // 'unsafe-eval' only in development (removed in production for security)
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
              // Styles: self + inline (Tailwind/CSS-in-JS)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: self + data URIs + HTTPS (avatars, uploads)
              "img-src 'self' data: https: blob:",
              // Fonts: self + Google Fonts CDN
              "font-src 'self' data: https://fonts.gstatic.com",
              // API connections: self + Stripe + Sentry + bKash
              "connect-src 'self' https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://tokenized.pay.bka.sh https://*.pay.bka.sh",
              // Block all iframing
              "frame-ancestors 'none'",
              // Restrict base URI
              "base-uri 'self'",
              // Restrict form submissions
              "form-action 'self' https://checkout.stripe.com",
              // Workers: self (for Service Worker / PWA)
              "worker-src 'self' blob:",
              // Object/embed: none
              "object-src 'none'",
            ].join("; "),
          },
          // ── Cross-Origin Isolation ──
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
        ],
      },
      // ── Cache Control for Static Assets ──
      {
        source: "/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // ── No-Cache for API Routes ──
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },
};

import { withSentryConfig } from "@sentry/nextjs";

// ══════════════════════════════════════════════════════════════
// Export Configuration — Sentry + next-intl wrapping
// ══════════════════════════════════════════════════════════════
export default withSentryConfig(withNextIntl(nextConfig), {
    // Sentry Organization & Project (set via env vars)
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Suppress noisy build-time Sentry logs
    silent: !process.env.CI,

    // Route Sentry events through the app to bypass ad blockers
    tunnelRoute: "/monitoring",

    // Source map management — upload for debugging, delete after upload
    sourcemaps: {
        deleteSourcemapsAfterUpload: true,
    },
});

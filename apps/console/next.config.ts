import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

/**
 * Bundle analyzer is opt-in via `ANALYZE=true` env. When the optional
 * `@next/bundle-analyzer` package is installed, it wraps the config
 * and emits HTML reports under `.next/analyze/`. When not installed,
 * the wrapper is a no-op so ordinary builds never break on missing dep.
 */
function maybeBundleAnalyzer<T>(cfg: T): T {
  if (process.env.ANALYZE !== 'true') return cfg
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: true })
    return withBundleAnalyzer(cfg)
  } catch {
    // Package not installed — silent no-op. Install with:
    //   pnpm --filter @nzila/console add -D @next/bundle-analyzer
    return cfg
  }
}

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  env: {
    NZILA_AUTH_ENABLE_PG_FALLBACK: 'true',
    NEXT_PUBLIC_NZILA_AUTH_ENABLE_PG_FALLBACK: 'true',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  transpilePackages: [
    '@nzila/chatops-slack',
    '@nzila/chatops-teams',
    '@nzila/comms-email',
    '@nzila/comms-push',
    '@nzila/comms-sms',
    '@nzila/crm-hubspot',
    '@nzila/ai-core',
    '@nzila/blob',
    '@nzila/commerce-observability',
    '@nzila/db',
    '@nzila/decision-intelligence',
    '@nzila/ml-sdk',
    '@nzila/os-core',
    '@nzila/payments-stripe',
    '@nzila/platform-assurance',
    '@nzila/platform-compliance-snapshots',
    '@nzila/platform-events',
    '@nzila/platform-evidence-pack',
    '@nzila/platform-export',
    '@nzila/platform-integrations-control-plane',
    '@nzila/platform-isolation',
    '@nzila/platform-marketplace',
    '@nzila/platform-metrics',
    '@nzila/platform-observability',
    '@nzila/platform-ops',
    '@nzila/platform-performance',
    '@nzila/platform-policy-engine',
    '@nzila/platform-procurement-proof',
    '@nzila/platform-proof',
    '@nzila/qbo',
    '@nzila/tax',
    '@nzila/ui',
  ],
  output: process.platform === 'win32' ? undefined : 'standalone',
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
  redirects: async () => [
    {
      source: '/dashboard',
      destination: '/console',
      permanent: true,
    },
    {
      source: '/dashboard/:path*',
      destination: '/console/:path*',
      permanent: true,
    },
  ],
}

export default maybeBundleAnalyzer(withNextIntl(nextConfig))

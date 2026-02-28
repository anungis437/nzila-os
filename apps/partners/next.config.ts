import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.nzila.app https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com",
      "img-src 'self' data: blob: https://img.clerk.com",
      "font-src 'self'",
      "connect-src 'self' https: wss: https://clerk.nzila.app https://api.clerk.dev https://api.stripe.com https://*.clerk.com https://*.clerk.accounts.dev",
      "frame-src https://clerk.nzila.app https://accounts.clerk.dev https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://js.stripe.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  transpilePackages: [
    '@nzila/ui',
    '@nzila/db',
    '@nzila/os-core',
    '@nzila/blob',
    '@nzila/payments-stripe',
    '@nzila/tax',
  ],
  output: process.platform === 'win32' ? undefined : 'standalone',
  images: {
    remotePatterns: [
      { hostname: 'images.unsplash.com' },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
}

export default nextConfig

import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@nzila/nen-core', '@nzila/platform-auth'],
  output: process.platform === 'win32' ? undefined : 'standalone',
  headers: async () => [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ],
  }],
}
export default config

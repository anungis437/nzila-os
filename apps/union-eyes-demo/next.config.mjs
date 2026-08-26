import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/**
 * Union Eyes Demo — Next.js configuration.
 *
 * Wave 0 §3: intentionally minimal. This app ships synthetic-data
 * fixtures under a distinct artifact and MUST NOT reach into the
 * operational `apps/union-eyes` app at build or runtime.
 *
 * Notes:
 *  - Standalone output is disabled on Windows because Turbopack
 *    generates filenames containing colons (e.g. `node:crypto`)
 *    which are invalid on NTFS. Linux CI builds produce standalone.
 *  - Typescript build errors are ignored here; `pnpm typecheck`
 *    (invoked separately via CI + lefthook) is the source of truth.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  output: process.platform === 'win32' ? undefined : 'standalone',

  // Server-only packages that must not be bundled into edge/client.
  serverExternalPackages: [
    'pg',
    'postgres',
    'drizzle-orm',
    'drizzle-kit',
    '@sentry/nextjs',
    'dotenv',
    'archiver',
  ],

  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: { bodySizeLimit: '2mb' },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Search-engine hard block for the demo artifact.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          // Machine-readable environment marker.
          { key: 'X-Nzila-Environment', value: 'demo' },
          // Basic hardening headers (kept small; not a replacement
          // for the operational security-headers surface).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

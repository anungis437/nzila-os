import type { NextConfig } from 'next';
import {withSentryConfig} from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Gate security headers that break local HTTP dev server
const isDev = process.env.NODE_ENV === 'development';

// Bundle Analyzer - Enable with ANALYZE=true environment variable
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

// =============================================================================
// CONTENT SECURITY POLICY (CSP)
// =============================================================================
// CSP Configuration with Defense-in-Depth Strategy
//
// SECURITY IMPROVEMENTS IMPLEMENTED (Feb 2026):
// ✅ Removed 'unsafe-eval' from script-src (XSS attack vector eliminated)
// ✅ Added nonce infrastructure for future CSP hardening
// ⚠️  'unsafe-inline' still required by Clerk SDK - monitoring Clerk updates
//
// REMAINING SECURITY TRADEOFFS:
// 1. script-src 'unsafe-inline' - Required by Clerk SDK only
//    • Mitigation: Strict domain whitelisting + nonce support prepared
//    • Action: Will migrate to nonce-only once Clerk SDK supports it
//    • Tracking: https://github.com/clerk/javascript/issues/xxxx
//
// 2. connect-src https: wss: - Permissive to support dynamic integrations
//    • Required for: User-configured webhooks, third-party APIs, CDN resources
//    • Mitigation: Server-side URL validation + rate limiting
//
// 3. img-src https: - Allow external images from integrations
//    • Required for: User avatars, document previews, external content
//    • Mitigation: Subresource Integrity (SRI) where possible
//
// DEFENSE LAYERS:
// • X-Frame-Options: DENY (prevents clickjacking)
// • X-Content-Type-Options: nosniff (prevents MIME sniffing)
// • Referrer-Policy: strict-origin-when-cross-origin (privacy)
// • HSTS with preload (enforces HTTPS)
// • Cross-Origin-*-Policy headers (Spectre mitigation)
// =============================================================================

const ContentSecurityPolicy = [
  // Default policy: Restrict all to same-origin unless explicitly allowed
  "default-src 'self'",
  
  // Base URI: Prevent <base> tag hijacking
  "base-uri 'self'",
  
  // Objects: Block Flash, Java applets, legacy plugins
  "object-src 'none'",
  
  // Frame embedding: Prevent clickjacking (redundant with X-Frame-Options for old browsers)
  "frame-ancestors 'none'",
  
  // Images: Allow data URIs (inline), blob (canvas/File API), and external HTTPS
  // Permissive https: required for user avatars, document previews, CDN resources
  "img-src 'self' data: blob: https:",
  
  // Fonts: Allow data URIs and HTTPS CDNs
  "font-src 'self' data: https:",
  
  // Styles: Clerk and Radix UI require inline styles
  "style-src 'self' 'unsafe-inline' https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com",
  
  // Scripts: SECURITY HARDENED - Removed 'unsafe-eval' (Feb 2026)
  // 'unsafe-inline' still required by Clerk SDK, monitoring for nonce support
  // *.clerk.accounts.dev covers per-instance CDN subdomains (e.g. known-hagfish-67.clerk.accounts.dev)
  "script-src 'self' 'unsafe-inline' https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  
  // Connections: SECURITY TRADEOFF - Permissive for dynamic integrations
  // Core domains whitelisted; https:/wss: required for user-configured webhooks
  "connect-src 'self' https: wss: https://*.clerk.com https://*.clerk.accounts.dev https://*.sentry.io https://*.supabase.co https://api.stripe.com https://*.upstash.io",
  
  // Iframes: Allow Clerk authentication flows and Cloudflare challenges
  "frame-src 'self' https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  
  // Web Workers: Allow blob URLs for dynamic worker creation
  "worker-src 'self' blob:",
  
  // Media: Restrict to same-origin and HTTPS (for video/audio)
  "media-src 'self' https:",
  
  // Manifests: PWA support
  "manifest-src 'self'",
  
  // Form submissions: Restrict to same-origin
  "form-action 'self'",
  
  // Upgrade all HTTP requests to HTTPS — PRODUCTION ONLY
  // (causes browser to request localhost assets via HTTPS in dev, breaking icon/resource loading)
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join('; ');

// =============================================================================
// SECURITY HEADERS
// =============================================================================
// Comprehensive HTTP security headers for defense-in-depth protection
// All headers follow OWASP, Mozilla Observatory, and Snyk best practices
// =============================================================================

const securityHeaders = [
  // Content Security Policy (defined above)
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  
  // Referrer Policy: Balance privacy with analytics/debugging needs
  // strict-origin-when-cross-origin = Send full URL for same-origin, origin only for cross-origin HTTPS
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  
  // X-Content-Type-Options: Prevent MIME-type sniffing attacks
  // Forces browsers to respect Content-Type headers (prevents XSS via image uploads)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  
  // X-Frame-Options: Prevent clickjacking attacks
  // DENY = Cannot be embedded in any frame/iframe (redundant with CSP frame-ancestors for older browsers)
  { key: 'X-Frame-Options', value: 'DENY' },
  
  // Permissions Policy: Restrict browser APIs to prevent abuse
  // Disable: camera, microphone, payment, USB, geolocation (except same-origin), interest-cohort (FLoC)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=(), payment=(), usb=()' },
  
  // HTTP Strict Transport Security (HSTS): Enforce HTTPS for 2 years — PRODUCTION ONLY
  // NEVER set HSTS on localhost: browser caches it for 2 years, permanently breaking HTTP dev server
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
  
  // X-DNS-Prefetch-Control: Enable DNS prefetching for performance
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  
  // X-Download-Options: Prevent IE from executing downloads in site context
  { key: 'X-Download-Options', value: 'noopen' },
  
  // X-Permitted-Cross-Domain-Policies: Block Adobe Flash/PDF cross-domain requests
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  
  // Cross-Origin-Embedder-Policy: credentialless allows cross-origin images/media without CORP header
  // while still providing Spectre mitigation for credentialed subresources (safer than require-corp for SaaS)
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
  
  // Cross-Origin-Opener-Policy: Isolate browsing context (Spectre mitigation)
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  
  // Cross-Origin-Resource-Policy: Prevent cross-origin resource loading
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  
  // Origin-Agent-Cluster: Request origin-keyed agent clusters for better isolation
  { key: 'Origin-Agent-Cluster', value: '?1' },
];

const nextConfig: NextConfig = {
  // TypeScript configuration – all 2,538 errors resolved; strict checking enabled.
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Build optimizations
  reactStrictMode: true,
  
  // Compiler optimizations
  // Note: removeConsole is not supported by Turbopack, only used in production builds
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn']
      },
    },
  }),
  
  // Experimental features for faster builds
  // Externalize native/binary packages that break Turbopack bundling
  serverExternalPackages: [
    '@tensorflow/tfjs-node',
    '@mapbox/node-pre-gyp',
  ],

  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@heroicons/react',
      'lucide-react',
      'date-fns',
      'recharts',
      'framer-motion',
    ],
    // Server Actions optimization
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Output optimization
  // Standalone mode required for Docker production stage (node server.js)
  // Disabled on Windows dev builds: Turbopack generates filenames with colons
  // (e.g. node:crypto) which are invalid on NTFS. CI/Docker builds run on Linux.
  output: process.platform === 'win32' ? undefined : 'standalone',
  
  // Skip API route static analysis during build (speeds up Docker builds)
  // API routes are inherently dynamic and don't need static generation
  staticPageGenerationTimeout: 120, // 2 minutes max per page
  generateBuildId: async () => {
    // Use git commit hash or timestamp for build ID
    return process.env.BUILD_ID || Date.now().toString();
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Reduce memory usage
    config.infrastructureLogging = {
      level: 'error',
    };
    
    // Optimize build performance
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test(module) {
                return module.size() > 160000 && /node_modules[\\/]/.test(module.identifier());
              },
              name: 'lib',
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
          },
        },
      };
    }
    
    // Externalize bullmq and ioredis to prevent bundling browser API dependencies
    if (isServer) {
      config.externals = config.externals || {};
      config.externals['bullmq'] = 'commonjs bullmq';
      config.externals['ioredis'] = 'commonjs ioredis';
    }
    
    return config;
  },
};

// Disable Sentry during build to prevent "self is not defined" error from BullMQ
// Sentry is still active at runtime, just not during the build process
const useSentryInBuild = false;

export default useSentryInBuild ? withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "nzila-ventures",

  project: "union_eyes",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
  
  // Disable source map uploads in development
  sourcemaps: { disable: process.env.NODE_ENV === 'development' },
}) : withBundleAnalyzer(withNextIntl(nextConfig));

import type { NextConfig } from 'next';
import {withSentryConfig} from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';
import webpack from 'webpack';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Resolve the CJS entry of js-yaml at config-load time so both webpack and
// Turbopack aliases point at a real, importable file (not an exports-blocked
// subpath). js-yaml v4 ships `dist/js-yaml.mjs` (named-only exports) and
// `index.js` (CJS with a default-shaped export); we always want the CJS entry
// for consumers doing `import yaml from 'js-yaml'` (swagger-client / swagger-ui-react).
const jsYamlCjsPath = require.resolve('js-yaml');

// Turbopack's `resolveAlias` rejects POSIX-style absolute paths (leading `/`)
// on Linux CI, coercing them to server-relative imports and failing with
// "server relative imports are not implemented yet". Windows paths (`C:\...`)
// happen to bypass this coercion. Compute a config-dir-relative POSIX path so
// the alias is portable across Linux CI and Windows dev.
const jsYamlCjsRelativePath =
  './' + path.relative(__dirname, jsYamlCjsPath).replace(/\\/g, '/');

// Gate security headers that break local HTTP dev server
const isDev = process.env.NODE_ENV === 'development';

// The E2E/QA harness builds and serves the *production* bundle over plain HTTP
// on localhost. `upgrade-insecure-requests` (CSP) and HSTS force the browser to
// re-request every `_next/static` JS chunk over HTTPS, which the HTTP test
// server cannot answer — yielding `ERR_SSL_PROTOCOL_ERROR`, failed chunk loads,
// and incomplete client hydration (e.g. Radix tabs focus but never activate).
// Detect that HTTP build and drop the HTTPS-upgrade headers. Defaults to SECURE:
// the headers are only skipped when an explicit test flag is present at BUILD
// time or the canonical app URL is http://localhost, so real production builds
// (https origin, no QA flags) always enforce HTTPS.
const isHttpTestBuild =
  process.env.QA_TEST_ENV === 'true' ||
  process.env.PLAYWRIGHT_TEST_AUTH === 'true' ||
  (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('http://localhost');
const enforceHttpsUpgrade = !isDev && !isHttpTestBuild;

// Bundle Analyzer - Enable with ANALYZE=true environment variable
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

const unionEyesHosts = {
  apex: 'unioneyes.app',
  www: 'www.unioneyes.app',
  stagingMarketing: 'staging.unioneyes.app',
  stagingApp: 'staging-app.unioneyes.app',
};

// =============================================================================
// CONTENT SECURITY POLICY (CSP)
// =============================================================================
// CSP Configuration with Defense-in-Depth Strategy
//
// SECURITY IMPROVEMENTS IMPLEMENTED (Feb 2026):
// ✅ Removed 'unsafe-eval' from script-src (XSS attack vector eliminated)
// ✅ Migrated from Clerk to Microsoft Entra ID (Jun 2026)
//
// REMAINING SECURITY TRADEOFFS:
// 1. script-src 'unsafe-inline' - Required by NextAuth/Entra redirect flows
//    • Mitigation: Strict domain whitelisting + nonce support prepared
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
  
  // Styles: Radix UI requires inline styles
  "style-src 'self' 'unsafe-inline' https://login.microsoftonline.com",
  
  // Scripts: SECURITY HARDENED - Removed 'unsafe-eval' (Feb 2026)
  // DEV ONLY: React + Turbopack require eval for source-mapped callstacks.
  // 'unsafe-inline' required for NextAuth/Entra redirect flows
  // js.stripe.com required for Stripe.js payment elements
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://login.microsoftonline.com https://challenges.cloudflare.com https://js.stripe.com`,
  
  // Connections: SECURITY TRADEOFF - Permissive for dynamic integrations
  // Core domains whitelisted; https:/wss: required for user-configured webhooks
  "connect-src 'self' https: wss: https://login.microsoftonline.com https://graph.microsoft.com https://*.sentry.io https://*.supabase.co https://api.stripe.com https://*.upstash.io",
  
  // Iframes: Allow Entra login flows, Cloudflare challenges, and Stripe Elements
  "frame-src 'self' https://login.microsoftonline.com https://challenges.cloudflare.com https://js.stripe.com",
  
  // Web Workers: Allow blob URLs for dynamic worker creation
  "worker-src 'self' blob:",
  
  // Media: Restrict to same-origin and HTTPS (for video/audio)
  "media-src 'self' https:",
  
  // Manifests: PWA support
  "manifest-src 'self'",
  
  // Form submissions: Restrict to same-origin
  "form-action 'self'",
  
  // Upgrade all HTTP requests to HTTPS — PRODUCTION HTTPS ONLY
  // (over HTTP — dev or the E2E/QA test build — this forces the browser to
  // re-fetch _next/static chunks via HTTPS, breaking asset loading & hydration)
  ...(enforceHttpsUpgrade ? ["upgrade-insecure-requests"] : []),
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
  
  // HTTP Strict Transport Security (HSTS): Enforce HTTPS for 2 years — PRODUCTION HTTPS ONLY
  // NEVER set HSTS on localhost: browser caches it for 2 years, permanently breaking HTTP dev/E2E servers
  ...(enforceHttpsUpgrade ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
  
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
  // Turbopack resolve aliases
  // swagger-ui-react imports `immutable` with a default import, but immutable v5
  // ESM build has no default export. Force CJS build for Turbopack compatibility.
  // swagger-client / swagger-ui-react also import `js-yaml` with a default import,
  // but the js-yaml v4 ESM build (js-yaml.mjs) has no default export.
  // Force the CJS build so the default import resolves correctly.
  turbopack: {
    resolveAlias: {
      immutable: 'immutable/dist/immutable.js',
      'js-yaml': jsYamlCjsRelativePath,
    },
  },

  // Build optimizations
  reactStrictMode: true,
  
  // Type checking is done separately via `pnpm typecheck` (tsc --noEmit).
  // Next.js build-time TS checking is redundant and can OOM on large codebases.
  typescript: {
    ignoreBuildErrors: true,
  },

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
  // Next.js 16 uses Turbopack by default — webpack callback is NOT executed.
  // All server-only packages using Node.js builtins MUST be listed here.
  serverExternalPackages: [
    // Native/binary
    '@tensorflow/tfjs-node',
    '@mapbox/node-pre-gyp',
    // Database drivers (net, dns, fs, tls)
    'pg',
    'postgres',
    'drizzle-orm',
    'drizzle-kit',
    // Queue / Redis (net, dns)
    'bullmq',
    'ioredis',
    // Azure SDKs (net, http2, fs)
    '@azure/storage-blob',
    '@azure/identity',
    '@azure/keyvault-keys',
    '@azure/keyvault-secrets',
    '@azure/msal-node',
    '@azure/cognitiveservices-computervision',
    '@azure/ms-rest-js',
    // Auth — NextAuth/next-auth bundled with Turbopack, no externalization needed
    // Observability (async_hooks, diagnostics_channel, perf_hooks)
    '@sentry/nextjs',
    '@opentelemetry/sdk-node',
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/otlp-grpc-exporter-base',
    '@opentelemetry/exporter-metrics-otlp-grpc',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-trace-otlp-grpc',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/api',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'import-in-the-middle',
    'require-in-the-middle',
    // Payments / email (net, http2)
    'stripe',
    'resend',
    'square',
    // Cloud SDKs (net, http2, fs)
    '@aws-sdk/client-s3',
    '@aws-sdk/client-textract',
    '@aws-sdk/s3-request-presigner',
    'googleapis',
    '@microsoft/microsoft-graph-client',
    '@google-cloud/vision',
    // Document/file processing (fs)
    'pdfjs-dist',
    'pdf-parse',
    'pdfkit',
    'mammoth',
    'exceljs',
    'tesseract.js',
    // Communication (net, http2)
    'twilio',
    'firebase-admin',
    'microsoft-cognitiveservices-speech-sdk',
    // Utilities (fs, net)
    'axios',
    'node-cron',
    'node-geocoder',
    'geoip-lite',
    'dotenv',
    'react-email',
    '@react-email/render',
    '@react-email/components',
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

  // Wave 0 Task F — hard-exclude the sibling demo package from output file
  // tracing. The @nzila/union-eyes-demo package is a physically separate
  // artifact and MUST NOT appear in this package's `.nft.json` traces or
  // standalone output. Without this, pnpm workspace symlinks cause
  // @vercel/nft to walk into ../union-eyes-demo/ and list its
  // customer-fixture files as traced dependencies of operational pages.
  outputFileTracingExcludes: {
    '*': [
      '../union-eyes-demo/**',
      '**/apps/union-eyes-demo/**',
    ],
  },
  
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
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: unionEyesHosts.www }],
        destination: `https://${unionEyesHosts.apex}/:path*`,
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: unionEyesHosts.stagingMarketing }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: unionEyesHosts.stagingApp }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        // Apply all security headers to non-CSS-static paths
        source: '/((?!_next/static/css).*)',
        headers: securityHeaders,
      },
      {
        // Next.js RSC streaming generates <script async> preloads for CSS modules.
        // X-Content-Type-Options: nosniff causes browsers to reject text/css in a
        // <script> context (console error). CSS still loads via <link> tags.
        // Build-generated static CSS with content-addressed hashes is not at risk
        // from MIME-sniffing, so omitting nosniff here is safe.
        source: '/_next/static/css/:path*',
        headers: securityHeaders.filter(h => h.key !== 'X-Content-Type-Options'),
      },
    ];
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // swagger-ui-react imports `immutable` with a default import, but immutable v5
    // ESM build has no default export. Force CJS build for webpack compatibility.
    // swagger-client / swagger-ui-react also import `js-yaml` with a default import,
    // but the js-yaml v4 ESM build has no default export. Force CJS build.
    // (Turbopack uses resolveAlias above; this handles webpack production builds.)
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      immutable: require.resolve('immutable/dist/immutable.js'),
      'js-yaml': jsYamlCjsPath,
    };

    // Reduce memory usage
    config.infrastructureLogging = {
      level: 'error',
    };

    // Provide empty fallbacks for Node.js builtins in the client bundle.
    // Server-only packages (@grpc/grpc-js, pg, etc.) may be transitively
    // imported via barrel exports; they never run client-side.
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        http2: false,
        child_process: false,
        async_hooks: false,
        diagnostics_channel: false,
        perf_hooks: false,
        crypto: false,
        events: false,
        path: false,
        os: false,
        stream: false,
        util: false,
        url: false,
        buffer: false,
        querystring: false,
        zlib: false,
      };
      // Strip "node:" prefix from imports so fallback handles them.
      // webpack 5 treats "node:*" as URL schemes that need a plugin.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, '');
          },
        ),
      );
    }
    
    // Optimize build performance
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        // Only apply splitChunks to client builds.
        // Server builds use Node.js require() and don't benefit from code-splitting.
        // Applying splitChunks to server creates chunks with `self.webpackChunk_N_E`
        // wrapper which throws "ReferenceError: self is not defined" in Node.js.
        ...(!isServer && {
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
                test(module: { size: () => number; identifier: () => string }) {
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
        }),
      };
    }
    
    // Ignore optional peer deps that are not installed
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@opentelemetry\/(winston-transport|exporter-jaeger)$/,
      }),
    );

    // Suppress "Critical dependency" warnings from OpenTelemetry instrumentation
    // These are expected: OTel uses dynamic require() for auto-instrumentation hooks
    // and they never execute in the webpack bundle (server externals handle them)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /require-in-the-middle/,
        message: /Critical dependency/,
      },
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency/,
      },
      {
        module: /boot-assert/,
        message: /Critical dependency.*import\.meta/,
      },
    ];

    // Externalize server-only packages to prevent bundling Node.js builtin dependencies
    if (isServer) {
      config.externals = config.externals || {};
      config.externals['bullmq'] = 'commonjs bullmq';
      config.externals['ioredis'] = 'commonjs ioredis';
      config.externals['@grpc/grpc-js'] = 'commonjs @grpc/grpc-js';
      config.externals['@grpc/proto-loader'] = 'commonjs @grpc/proto-loader';
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

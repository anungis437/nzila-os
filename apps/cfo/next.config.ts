import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.platform === 'win32' ? undefined : 'standalone',
  transpilePackages: [
    "@nzila/ui",
    "@nzila/os-core",
    "@nzila/db",
    "@nzila/blob",
    "@nzila/commerce-core",
    "@nzila/commerce-observability",
    "@nzila/payments-stripe",
    "@nzila/qbo",
    "@nzila/tax",
    "@nzila/fx",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "**.blob.core.windows.net" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com https://images.pexels.com https://*.blob.core.windows.net",
              "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com wss://*.clerk.accounts.dev",
              "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'framework',
              chunks: 'all' as const,
              priority: 40,
            },
            lib: {
              test: /[\\/]node_modules[\\/](framer-motion|@radix-ui)[\\/]/,
              name: 'lib',
              chunks: 'all' as const,
              priority: 30,
            },
            commons: {
              minChunks: 2,
              name: 'commons',
              chunks: 'all' as const,
              priority: 20,
            },
          },
        },
      }
    }
    return config
  },
};

export default withNextIntl(nextConfig);

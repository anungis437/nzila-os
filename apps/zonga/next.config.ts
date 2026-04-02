import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: process.platform === 'win32' ? undefined : 'standalone',
  reactStrictMode: true,
  turbopack: {},
  transpilePackages: [
    '@nzila/db',
    '@nzila/os-core',
    '@nzila/ui',
    '@nzila/zonga-core',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com",
              "font-src 'self' https://fonts.gstatic.com data: https:",
              "img-src 'self' https://images.unsplash.com https://img.clerk.com data: blob: https:",
              "connect-src 'self' https: wss: https://*.clerk.com https://*.clerk.accounts.dev https://api.stripe.com",
              "frame-src 'self' https://challenges.cloudflare.com https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://js.stripe.com",
              "worker-src 'self' blob:",
              "media-src 'self' https:",
              "manifest-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
            ].join('; '),
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
            framework: { test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, name: 'framework', chunks: 'all', priority: 40 },
            lib: { test: /[\\/]node_modules[\\/](framer-motion|@radix-ui)[\\/]/, name: 'lib', chunks: 'all', priority: 30 },
            commons: { minChunks: 2, name: 'commons', chunks: 'all', priority: 20 },
          },
        },
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);

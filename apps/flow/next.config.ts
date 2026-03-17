import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Cross-Origin-Embedder-Policy",
    value: "credentialless",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.nzila.app https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https: wss: https://clerk.nzila.app https://api.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev",
      "frame-src https://clerk.nzila.app https://accounts.clerk.dev https://clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@nzila/ui",
    "@nzila/os-core",
    "@nzila/commerce-core",
    "@nzila/commerce-services",
    "@nzila/commerce-audit",
    "@nzila/pricing-engine",
    "@nzila/shop-quoter",
  ],
  output: process.platform === 'win32' ? undefined : 'standalone',
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
  webpack: (config) => {
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        cacheGroups: {
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: "framework",
            priority: 40,
            chunks: "all" as const,
          },
          lib: {
            test: /[\\/]node_modules[\\/](framer-motion|@radix-ui)[\\/]/,
            name: "lib",
            priority: 30,
            chunks: "all" as const,
          },
          commons: {
            minChunks: 2,
            name: "commons",
            priority: 20,
            chunks: "all" as const,
          },
        },
      },
    };
    return config;
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@nzila/ui',
    '@nzila/ml-sdk',
    '@nzila/ml-core',
  ],
  output: 'standalone',
}

export default nextConfig

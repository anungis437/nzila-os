import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@nzila/ui', '@nzila/db', '@nzila/os-core', '@nzila/blob'],
  output: 'standalone',
}

export default nextConfig

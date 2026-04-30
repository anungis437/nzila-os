import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  transpilePackages: ['@nzila/flow-engine'],
  output: process.platform === 'win32' ? undefined : 'standalone',
}

export default withNextIntl(nextConfig)
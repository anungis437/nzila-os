import { defineProject } from 'vitest/config'
import { join } from 'node:path'

const pkgSrc = (name: string) =>
  join(__dirname, '..', '..', '..', 'packages', name, 'src', 'index.ts')

export default defineProject({
  test: {
    name: 'e2e-platform',
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@nzila/enforcement': pkgSrc('enforcement'),
      '@nzila/governance': pkgSrc('governance'),
      '@nzila/audit': pkgSrc('audit'),
      '@nzila/ai-control': pkgSrc('ai-control'),
      '@nzila/events': pkgSrc('events'),
      '@nzila/contracts': pkgSrc('contracts'),
      '@nzila/observability': pkgSrc('observability'),
    },
  },
})

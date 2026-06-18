import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineProject({
  test: {
    name: 'console',
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    // @ts-expect-error Coverage options are supported at runtime but not in this ProjectConfig type.
    coverage: {
      provider: 'v8',
      include: [
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/demoSeed.ts',
      ],
      // Strict 99% on console control-surface endpoints:
      // - health: db and blob status checks
      // - ready: database-dependent readiness contract
      // - version: build metadata passthrough
      // Lib coverage (audit, integrations, security context) tracked separately
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
    },
  },
  resolve: {
    alias: {
      // Resolve workspace subpath exports to their TypeScript source files.
      // Required because pnpm + vitest cannot follow package.json `exports`
      // pointing to .ts files without these aliases.
      '@nzila/os-core/health': resolve(ROOT, 'packages/os-core/src/health.ts'),
      '@nzila/os-core/hash': resolve(ROOT, 'packages/os-core/src/hash.ts'),
      '@nzila/os-core/rateLimit': resolve(ROOT, 'packages/os-core/src/rateLimit.ts'),
      '@nzila/os-core/orgRateLimit': resolve(ROOT, 'packages/os-core/src/orgRateLimit.ts'),
      '@nzila/os-core/telemetry': resolve(ROOT, 'packages/os-core/src/telemetry/index.ts'),
      '@nzila/os-core/policy': resolve(ROOT, 'packages/os-core/src/policy/index.ts'),
      '@nzila/os-core/config': resolve(ROOT, 'packages/os-core/src/config/env.ts'),
      '@nzila/os-core/retention': resolve(ROOT, 'packages/os-core/src/retention/index.ts'),
      '@nzila/os-core': resolve(ROOT, 'packages/os-core/src/index.ts'),
    },
  },
})

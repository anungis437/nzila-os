import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineProject({
  test: {
    name: 'Flow-app',
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts', 'app/**/*.test.ts'],
    // Slice tests dynamically import Next.js server components; cold module
    // resolution on Windows + monorepo-scale parallel runners can exceed the
    // 5s vitest default. 30s gives comfortable headroom while still catching
    // genuine hangs.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // @ts-expect-error Coverage options are supported at runtime but not in this ProjectConfig type.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/*.d.ts',
        'lib/demoSeed.ts',
        'lib/seed-flow-staging.ts',
        '**/index.ts',
        '**/types.ts',
      ],
      // Strict 99% on mission-critical layers and control surfaces:
      // - Domain entities (business logic definitions)
      // - Data schemas (validation and types)
      // - Telemetry (observability)
      // - Health/ready/version endpoints (control surface hardening)
      // Data access (repositories) and integrations tested via E2E
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 99,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@nzila/os-core/health': resolve(ROOT, 'packages/os-core/src/health.ts'),
      '@nzila/os-core/hash': resolve(ROOT, 'packages/os-core/src/hash.ts'),
      '@nzila/os-core/rateLimit': resolve(ROOT, 'packages/os-core/src/rateLimit.ts'),
      '@nzila/os-core/telemetry': resolve(ROOT, 'packages/os-core/src/telemetry/index.ts'),
      '@nzila/os-core/policy': resolve(ROOT, 'packages/os-core/src/policy/index.ts'),
      '@nzila/os-core/config': resolve(ROOT, 'packages/os-core/src/config/env.ts'),
      '@nzila/os-core/retention': resolve(ROOT, 'packages/os-core/src/retention/index.ts'),
      '@nzila/os-core': resolve(ROOT, 'packages/os-core/src/index.ts'),
      '@nzila/commerce-core': resolve(ROOT, 'packages/commerce-core/src/index.ts'),
      '@nzila/commerce-core/types': resolve(ROOT, 'packages/commerce-core/src/types/index.ts'),
      '@nzila/commerce-core/enums': resolve(ROOT, 'packages/commerce-core/src/enums.ts'),
    },
  },
})

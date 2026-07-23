import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineProject({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: 'veridian-admin',
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    // @ts-expect-error Coverage options are supported at runtime but not in this ProjectConfig type.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        lines: 99,
        statements: 99,
        functions: 99,
        branches: 99,
      },
    },
  },
  resolve: {
    alias: {
      '@nzila/os-core/health': resolve(ROOT, 'packages/os-core/src/health.ts'),
      '@nzila/os-core': resolve(ROOT, 'packages/os-core/src/index.ts'),
    },
  },
})


import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx'],
    exclude: ['node_modules', '.next', '.turbo', 'dist'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: [
        'lib/api-guards.ts',
        'lib/rbac/requireRole.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        '**/__mocks__/**',
      ],
      // Strict 99% on TrustCore mission-critical auth infrastructure:
      // - API route guards (auth/org context validation)
      // - RBAC middleware (role hierarchy enforcement)
      // These foundational layers prevent privilege escalation and unauthorized access.
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  },
})

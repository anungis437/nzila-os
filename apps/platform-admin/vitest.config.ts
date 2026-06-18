import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

export default defineProject({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'platform-admin',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'lib/org-scope-guard.ts',
        'lib/boot-env.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
      ],
      // Strict 99% on platform-admin mission-critical infrastructure:
      // - org-scope-guard: org membership verification, UUID validation, role enforcement
      // - boot-env: production environment bootstrapping for control-plane and orchestrator
      // These layers prevent cross-org leakage and ensure safe production deployment.
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

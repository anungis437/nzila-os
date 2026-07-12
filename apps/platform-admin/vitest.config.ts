import { defineProject } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'server-only': resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    name: 'platform-admin',
    environment: 'node',
    // Rendered component tests (.test.tsx) run under jsdom; everything else runs
    // under node.
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
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

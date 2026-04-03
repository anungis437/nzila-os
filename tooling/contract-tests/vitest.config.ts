import { defineProject } from 'vitest/config'
import { join } from 'node:path'

export default defineProject({
  test: {
    name: 'contract-tests',
    environment: 'node',
    globals: false,
    testTimeout: 30_000, // Contract tests scan the full file tree — need headroom under parallel load
    include: ['**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/services/financial-service/**', // Uses Jest, not vitest
    ],
  },
  resolve: {
    alias: {
      // Allow contract tests to import from the monorepo root
      '@repo-root': join(__dirname, '..', '..'),
      // Workspace packages used by scripts/slo-gate.ts
      '@nzila/platform-performance': join(__dirname, '..', '..', 'packages', 'platform-performance', 'src', 'index.ts'),
      '@nzila/platform-ops': join(__dirname, '..', '..', 'packages', 'platform-ops', 'src', 'index.ts'),
      // Governance packages used by proof harness
      '@nzila/enforcement': join(__dirname, '..', '..', 'packages', 'enforcement', 'src', 'index.ts'),
      // CUPE vocabulary package used by vocabulary validation contract tests
      '@nzila/cupe-vocabulary': join(__dirname, '..', '..', 'packages', 'cupe-vocabulary', 'src', 'index.ts'),
      // Platform contracts sub-path imports used by registry + org-scope tests
      '@nzila/platform-contracts/registry': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'registry.ts'),
      '@nzila/platform-contracts/org-scope': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'org-scope.ts'),
      '@nzila/platform-contracts': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'index.ts'),
    },
  },
})

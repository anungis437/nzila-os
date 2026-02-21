import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // App & package unit tests — each has its own vitest.config.ts
      'apps/console',
      'apps/partners',
      'apps/web',
      'packages/ai-core',
      'packages/ai-sdk',
      'packages/db',
      'packages/ml-sdk',
      'packages/os-core',
      'packages/payments-stripe',
      'packages/qbo',
      'packages/tools-runtime',
      'packages/ui',
      // Contract tests (architectural invariants)
      'tooling/contract-tests',
    ],
  },
})

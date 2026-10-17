import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'civic-synthetic-slice0',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@nzila/platform-contracts/identity': `${__dirname}/../../packages/platform-contracts/src/identity.ts`,
      '@nzila/platform-contracts/org-scope': `${__dirname}/../../packages/platform-contracts/src/org-scope.ts`,
      '@nzila/platform-contracts/role': `${__dirname}/../../packages/platform-contracts/src/role.ts`,
      '@nzila/platform-contracts/audit-event': `${__dirname}/../../packages/platform-contracts/src/audit-event.ts`,
    },
  },
})

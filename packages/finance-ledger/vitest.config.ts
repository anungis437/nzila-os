import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/finance-ledger',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

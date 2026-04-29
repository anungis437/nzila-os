import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/finance-compliance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

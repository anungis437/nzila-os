import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/finance-analytics',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

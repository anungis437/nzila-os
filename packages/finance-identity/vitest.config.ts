import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/finance-identity',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

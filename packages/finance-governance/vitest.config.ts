import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/finance-governance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

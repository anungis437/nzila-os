import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/finance-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'commerce-integration-tests',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})

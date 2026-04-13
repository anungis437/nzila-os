import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'payments-stripe',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

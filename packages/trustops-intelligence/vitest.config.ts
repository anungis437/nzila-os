import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'trustops-intelligence',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

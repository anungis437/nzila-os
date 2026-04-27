import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'health-ui',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

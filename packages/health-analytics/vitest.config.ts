import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'health-analytics',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

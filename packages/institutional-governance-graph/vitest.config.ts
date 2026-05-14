import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'institutional-governance-graph',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'health-connectors',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

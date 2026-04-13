import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-entity-graph',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

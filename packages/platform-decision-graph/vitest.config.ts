import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-decision-graph',
    include: ['src/**/*.test.ts'],
  },
})

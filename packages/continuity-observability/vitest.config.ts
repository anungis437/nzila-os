import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'continuity-observability',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

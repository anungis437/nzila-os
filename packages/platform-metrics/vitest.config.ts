import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-metrics',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

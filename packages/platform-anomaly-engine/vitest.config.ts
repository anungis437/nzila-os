import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-anomaly-engine',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

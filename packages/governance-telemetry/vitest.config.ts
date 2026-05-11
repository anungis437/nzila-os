import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'governance-telemetry',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'governance-otel',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

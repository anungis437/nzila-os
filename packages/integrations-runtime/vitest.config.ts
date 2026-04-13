import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-runtime',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-performance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

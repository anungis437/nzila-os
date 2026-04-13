import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-intelligence',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

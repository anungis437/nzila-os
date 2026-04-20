import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-intelligence-home',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

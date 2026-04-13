import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    passWithNoTests: true,
    name: 'platform-ai-contract',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

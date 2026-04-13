import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-ai-query',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

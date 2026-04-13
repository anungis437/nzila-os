import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-ai-governance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

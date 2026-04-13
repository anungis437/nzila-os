import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-context-orchestrator',
    include: ['src/**/*.test.ts'],
  },
})

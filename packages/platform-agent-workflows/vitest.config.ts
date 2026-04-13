import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-agent-workflows',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

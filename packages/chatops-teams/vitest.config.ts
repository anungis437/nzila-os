import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'chatops-teams',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-marketplace',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

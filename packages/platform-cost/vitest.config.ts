import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-cost',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

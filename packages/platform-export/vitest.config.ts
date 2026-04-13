import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-export',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

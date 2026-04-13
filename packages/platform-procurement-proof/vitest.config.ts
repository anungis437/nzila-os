import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-procurement-proof',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

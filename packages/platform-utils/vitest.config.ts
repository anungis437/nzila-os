import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-utils',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: 'platform-restricted-data',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})

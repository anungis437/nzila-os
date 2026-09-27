import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/treasurer',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

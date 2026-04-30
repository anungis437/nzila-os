import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/policies',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

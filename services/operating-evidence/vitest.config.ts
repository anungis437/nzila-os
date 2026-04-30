import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/operating-evidence',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

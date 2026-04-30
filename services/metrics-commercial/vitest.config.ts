import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/metrics-commercial',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

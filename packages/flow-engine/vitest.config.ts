import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/flow-engine',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-lakehouse',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})

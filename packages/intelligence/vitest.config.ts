import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    passWithNoTests: true,
    name: 'intelligence',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

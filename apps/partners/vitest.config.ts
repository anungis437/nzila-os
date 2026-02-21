import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'partners',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    passWithNoTests: true,
  },
})

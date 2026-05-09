import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'doctrine-enforcement',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

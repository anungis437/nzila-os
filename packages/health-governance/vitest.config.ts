import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'health-governance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
